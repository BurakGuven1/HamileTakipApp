// Creates a durable Supabase Auth session for family-code login without
// requiring Supabase anonymous sign-ins to be enabled. The linked person may
// be the baby's father or a caregiver; the database role decides the data
// scope and must never be inferred from display copy on the client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type FamilyRole = "father" | "caregiver";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ success: true });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cleanCode = String(body?.code ?? "").replace(/\D/g, "");
    const requestedRole = normalizeRole(body?.role);
    const requestedDisplayName = normalizeDisplayName(body?.displayName);

    if (cleanCode.length !== 7) {
      return json({ error: "Aile kodu 7 haneli olmalı." }, 400);
    }
    if (!requestedRole) {
      return json({ error: "Aile üyesi rolü geçerli değil." }, 400);
    }
    if (!requestedDisplayName) {
      return json({ error: "Aile üyesinin adı 2–40 karakter olmalı." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const rateLimit = await consumeFamilyCodeAttempt(supabase, req, cleanCode);
    if (!rateLimit.allowed) {
      return json(
        {
          error: "Çok fazla kod denemesi yapıldı. Lütfen biraz sonra yeniden dene.",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        },
        429,
      );
    }

    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("id")
      .eq("family_referral_code", cleanCode)
      .maybeSingle();

    if (ownerError) {
      console.error("family code lookup failed", ownerError);
      return json({ error: ownerError.message }, 500);
    }

    if (!ownerProfile) {
      return json({ error: "Aile kodu bulunamadı." }, 400);
    }

    const { data: ownerMembership, error: ownerMembershipError } = await supabase
      .from("family_members")
      .select("id")
      .eq("member_id", ownerProfile.id)
      .maybeSingle();
    if (ownerMembershipError) {
      console.error("family code owner eligibility lookup failed", ownerMembershipError);
      return json({ error: "Aile kodu doğrulanamadı." }, 500);
    }
    if (ownerMembership) {
      return json({ error: "Bu kod birincil aile profiline ait değil." }, 400);
    }

    const { data: existingCodeClaim, error: existingClaimError } =
      await supabase
        .from("family_code_redemptions")
        .select("member_id")
        .eq("owner_id", ownerProfile.id)
        .maybeSingle();

    if (existingClaimError) {
      console.error("existing family code claim lookup failed", existingClaimError);
      return json({ error: existingClaimError.message }, 500);
    }

    if (existingCodeClaim?.member_id) {
      const { data: linkedMember, error: linkedMemberError } = await supabase
        .from("family_members")
        .select("member_id,role,display_name")
        .eq("owner_id", ownerProfile.id)
        .eq("member_id", existingCodeClaim.member_id)
        .maybeSingle();

      if (linkedMemberError) {
        console.error("linked family member lookup failed", linkedMemberError);
        return json({ error: linkedMemberError.message }, 500);
      }
      if (!linkedMember) {
        return json(
          { error: "Bu aile bağlantısı kaldırılmış. Profil sahibinin destek ekibiyle iletişime geçmesi gerekiyor." },
          409,
        );
      }

      const storedRole = normalizeRole(linkedMember.role) ?? "caregiver";
      const storedDisplayName = normalizeDisplayName(linkedMember.display_name) ??
        (storedRole === "father" ? "Baba" : "Bakıcı");
      const password = createSessionPassword();
      const { data: existingUserResult, error: existingUserError } =
        await supabase.auth.admin.getUserById(existingCodeClaim.member_id);

      if (existingUserError || !existingUserResult.user?.email) {
        console.error("linked family auth user lookup failed", existingUserError);
        return json({ error: "Aile üyesi oturumu yenilenemedi." }, 500);
      }

      const { error: refreshError } = await supabase.auth.admin.updateUserById(
        existingCodeClaim.member_id,
        {
          password,
          user_metadata: {
            ...existingUserResult.user.user_metadata,
            family_referral_code: cleanCode,
            role: storedRole,
            display_name: storedDisplayName,
          },
        },
      );
      if (refreshError) {
        console.error("linked family session refresh failed", refreshError);
        return json({ error: "Aile üyesi oturumu yenilenemedi." }, 500);
      }

      return json({
        email: existingUserResult.user.email,
        password,
        profile: ownerProfile,
      });
    }

    const password = createSessionPassword();
    const email = `family-${crypto.randomUUID()}@family-login.anneplus.local`;

    const {
      data: { user },
      error: createUserError,
    } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        family_referral_code: cleanCode,
        role: requestedRole,
        display_name: requestedDisplayName,
      },
    });

    if (createUserError || !user) {
      console.error("family auth user create failed", createUserError);
      return json(
        { error: createUserError?.message ?? "Aile üyesi oturumu oluşturulamadı." },
        500,
      );
    }

    const profileError = await ensureFamilyProfile(
      supabase,
      user.id,
      requestedDisplayName,
      requestedRole,
    );
    if (profileError) {
      await supabase.auth.admin.deleteUser(user.id).catch(() => undefined);
      return json({ error: profileError }, 500);
    }

    const { error: memberError } = await supabase
      .from("family_members")
      .upsert(
        {
          owner_id: ownerProfile.id,
          member_id: user.id,
          role: requestedRole,
          display_name: requestedDisplayName,
          access_scope:
            requestedRole === "father" ? "full_family" : "baby_care_only",
        },
        { onConflict: "member_id" },
      );

    if (memberError) {
      console.error("family member link failed", memberError);
      await supabase.auth.admin.deleteUser(user.id).catch(() => undefined);
      if (memberError.code === "23505") {
        return json(
          { error: "Bu aile kodu daha önce başka bir aile üyesine bağlandı." },
          409,
        );
      }
      return json({ error: memberError.message }, 500);
    }

    return json({
      email,
      password,
      profile: ownerProfile,
    });
  } catch (error) {
    console.error("father-code-login failed", error);
    return json({ error: String(error) }, 500);
  }
});

async function ensureFamilyProfile(
  supabase: ReturnType<typeof createClient<any>>,
  userId: string,
  displayName: string,
  role: FamilyRole,
) {
  const nicknamePrefix = role === "father" ? "Baba" : "Bakici";
  const nickname = `${nicknamePrefix}${userId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName,
      father_name: role === "father" ? displayName : "",
      forum_nickname: nickname,
      mother_name: "",
      onboarding_completed: true,
      onboarding_step: "family-code",
    },
    { onConflict: "id" },
  );

  return error?.message ?? null;
}

function normalizeRole(value: unknown): FamilyRole | null {
  return value === "father" || value === "caregiver" ? value : null;
}

function normalizeDisplayName(value: unknown) {
  const displayName = String(value ?? "").trim().replace(/\s+/g, " ");
  return displayName.length >= 2 && displayName.length <= 40
    ? displayName
    : null;
}

function createSessionPassword() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

async function consumeFamilyCodeAttempt(
  supabase: ReturnType<typeof createClient<any>>,
  req: Request,
  code: string,
) {
  const forwardedFor = req.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const callerKey = forwardedFor ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    `unknown:${req.headers.get("user-agent") ?? "client"}`;
  const hashes = await Promise.all([
    sha256Hex(`caller:${callerKey}`),
    sha256Hex(`code:${code}`),
  ]);
  const checks = await Promise.all(
    hashes.map(async (keyHash) => {
      const { data, error } = await supabase.rpc(
        "consume_family_code_login_attempt",
        {
          p_block_seconds: 30 * 60,
          p_key_hash: keyHash,
          p_max_attempts: 10,
          p_window_seconds: 15 * 60,
        },
      );
      if (error) throw error;
      return data as {
        allowed?: boolean;
        retry_after_seconds?: number;
      } | null;
    }),
  ).catch((error) => {
    console.error("family code rate-limit update failed", error);
    throw new Error("Aile kodu güvenlik kontrolü tamamlanamadı.");
  });

  const retryAfterSeconds = checks.reduce(
    (maximum, check) => Math.max(maximum, check?.retry_after_seconds ?? 0),
    0,
  );

  return {
    allowed: checks.every((check) => check?.allowed === true),
    retryAfterSeconds,
  };
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
