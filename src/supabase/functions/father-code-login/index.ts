// Creates a durable Supabase Auth session for father-code login without
// requiring Supabase anonymous sign-ins to be enabled.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    if (cleanCode.length !== 7) {
      return json({ error: "Aile kodu 7 haneli olmalı." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("*")
      .eq("family_referral_code", cleanCode)
      .maybeSingle();

    if (ownerError) {
      console.error("family code lookup failed", ownerError);
      return json({ error: ownerError.message }, 500);
    }

    if (!ownerProfile) {
      return json({ error: "Aile kodu bulunamadı." }, 400);
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

    if (existingCodeClaim) {
      return json(
        { error: "Bu aile kodu daha önce bir baba hesabına bağlandı." },
        409,
      );
    }

    const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const email = `father-${crypto.randomUUID()}@family-login.anneplus.local`;

    const {
      data: { user },
      error: createUserError,
    } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        family_referral_code: cleanCode,
        role: "father",
      },
    });

    if (createUserError || !user) {
      console.error("father auth user create failed", createUserError);
      return json(
        { error: createUserError?.message ?? "Baba oturumu oluşturulamadı." },
        500,
      );
    }

    const profileError = await ensureFatherProfile(supabase, user.id);
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
          role: "father",
        },
        { onConflict: "member_id" },
      );

    if (memberError) {
      console.error("family member link failed", memberError);
      await supabase.auth.admin.deleteUser(user.id).catch(() => undefined);
      if (memberError.code === "23505") {
        return json(
          { error: "Bu aile kodu daha önce bir baba hesabına bağlandı." },
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

async function ensureFatherProfile(
  supabase: ReturnType<typeof createClient<any>>,
  userId: string,
) {
  const nickname = `Baba${userId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      display_name: "Baba",
      father_name: "Baba",
      forum_nickname: nickname,
      mother_name: "",
      onboarding_completed: true,
      onboarding_step: "family-code",
    },
    { onConflict: "id" },
  );

  return error?.message ?? null;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
