import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WELCOME_EMAIL_FROM = Deno.env.get("WELCOME_EMAIL_FROM") ?? "";
const WELCOME_EMAIL_REPLY_TO = Deno.env.get("WELCOME_EMAIL_REPLY_TO") ?? "";
const APP_URL = "https://hamile-takip-app-vqgw.vercel.app";

type ClaimedDelivery = {
  user_id: string;
  display_name: string;
  is_pregnant: boolean;
  include_premium_offer: boolean;
  attempt_count: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (!await isAuthorized(req, supabase)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!RESEND_API_KEY || !WELCOME_EMAIL_FROM) {
    return json({ error: "welcome_email_provider_not_configured" }, 503);
  }

  const { data, error } = await supabase.rpc(
    "claim_welcome_email_deliveries",
    { p_limit: 25 },
  );
  if (error) {
    console.error("welcome email claim failed", error);
    return json({ error: "claim_failed" }, 500);
  }

  const rows = (data ?? []) as ClaimedDelivery[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let index = 0; index < rows.length; index += 5) {
    const results = await Promise.all(
      rows.slice(index, index + 5).map((row) => deliverWelcomeEmail(supabase, row)),
    );
    sent += results.filter((result) => result === "sent").length;
    failed += results.filter((result) => result === "failed").length;
    skipped += results.filter((result) => result === "skipped").length;
  }

  return json({ success: true, claimed: rows.length, sent, failed, skipped });
});

async function deliverWelcomeEmail(supabase: any, row: ClaimedDelivery) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(row.user_id);
    if (error) throw error;
    const email = data.user?.email?.trim();
    if (!email || email.endsWith("@family-login.anneplus.local")) {
      await markDelivery(supabase, row.user_id, {
        status: "skipped",
        last_error: "deliverable_email_missing",
      });
      return "skipped" as const;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `anneplus-welcome-${row.user_id}`,
      },
      body: JSON.stringify({
        from: WELCOME_EMAIL_FROM,
        to: [email],
        subject: `${row.display_name}, Anne+’a hoş geldin 💜`,
        html: buildHtml(row),
        text: buildText(row),
        ...(WELCOME_EMAIL_REPLY_TO ? { reply_to: WELCOME_EMAIL_REPLY_TO } : {}),
      }),
    });

    const providerBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`resend_${response.status}:${JSON.stringify(providerBody).slice(0, 400)}`);
    }

    await markDelivery(supabase, row.user_id, {
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: typeof providerBody.id === "string" ? providerBody.id : null,
      last_error: null,
    });
    return "sent" as const;
  } catch (error) {
    const delayMinutes = Math.min(24 * 60, 5 * (2 ** Math.max(0, row.attempt_count - 1)));
    await markDelivery(supabase, row.user_id, {
      status: "failed",
      next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      last_error: String(error).slice(0, 800),
    });
    console.error("welcome email failed", row.user_id, error);
    return "failed" as const;
  }
}

function buildHtml(row: ClaimedDelivery) {
  const name = escapeHtml(row.display_name);
  const stageCopy = row.is_pregnant
    ? "Gebelik haftanı takip edebilir, sana uygun günlük küçük adımları görebilir ve doktor görüşmelerini düzenleyebilirsin."
    : "Bebeğinin bakım, uyku ve gelişim kayıtlarını tek yerde tutabilir; ailece daha kolay koordine olabilirsin.";
  const premiumBlock = row.include_premium_offer
    ? `<div style="margin-top:24px;padding:20px;background:#f1ecff;border-radius:16px"><strong style="color:#2d2438">Daha fazlasını istediğinde Anne+ yanında</strong><p style="margin:8px 0 16px;color:#5f586b;line-height:1.6">Premium ile kişisel eğilimler, ayrıntılı planlar, daha geniş geçmiş ve PDF özetleri açılır.</p><a href="${APP_URL}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#8b6fe8;color:#fff;text-decoration:none;font-weight:700">Premium’u incele</a></div>`
    : "";

  return `<!doctype html><html lang="tr"><body style="margin:0;background:#fff8f3;font-family:Arial,sans-serif;color:#2d2438"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:22px;padding:28px;box-shadow:0 12px 32px rgba(45,36,56,.08)"><div style="font-size:26px;font-weight:800;color:#8b6fe8">Anne+</div><h1 style="font-size:26px;line-height:1.25;margin:20px 0 10px">Hoş geldin ${name} 💜</h1><p style="color:#5f586b;line-height:1.7">Bu yolculukta her şeyi tek başına hatırlamak zorunda değilsin. Anne+, gününü biraz daha anlaşılır ve hafif yapmak için burada.</p><p style="color:#5f586b;line-height:1.7">${stageCopy}</p><div style="margin-top:22px;padding:20px;background:#e3f8f5;border-radius:16px"><strong>Ücretsiz kullanabileceklerin</strong><ul style="padding-left:20px;color:#5f586b;line-height:1.8"><li>Haftalık kısa check-in ve günlük kişisel öneri</li><li>Temel gebelik veya bebek gelişim takibi</li><li>Aile ve bakım düzenini kolaylaştıran temel araçlar</li></ul></div>${premiumBlock}<p style="margin-top:26px;color:#5f586b;line-height:1.7">Kendine nazik davran. Küçük bir adım bugün için yeterli.</p><p style="margin:0;font-weight:700">Anne+ ekibi</p></div><p style="font-size:12px;color:#82798d;text-align:center;line-height:1.5;margin:18px">Bu e-posta Anne+ hesabının kurulumu tamamlandığı için bir kez gönderildi.</p></div></body></html>`;
}

function buildText(row: ClaimedDelivery) {
  const stageCopy = row.is_pregnant
    ? "Gebelik haftanı takip edebilir, günlük küçük adımlarını görebilir ve doktor görüşmelerini düzenleyebilirsin."
    : "Bebeğinin bakım, uyku ve gelişim kayıtlarını tek yerde tutabilir; ailece koordine olabilirsin.";
  const premiumCopy = row.include_premium_offer
    ? "\nPremium ile kişisel eğilimler, ayrıntılı planlar, geniş geçmiş ve PDF özetleri açılır.\n"
    : "";
  return `Hoş geldin ${row.display_name}\n\nAnne+, gününü biraz daha anlaşılır ve hafif yapmak için burada. ${stageCopy}\n\nÜcretsiz: haftalık kısa check-in, günlük kişisel öneri, temel gelişim takibi ve bakım araçları.${premiumCopy}\nKendine nazik davran. Küçük bir adım bugün için yeterli.\n\nAnne+ ekibi`;
}

async function markDelivery(
  supabase: any,
  userId: string,
  update: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("welcome_email_deliveries")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}

async function isAuthorized(req: Request, supabase: any) {
  const provided = req.headers.get("x-notification-dispatch-secret");
  if (!provided) return false;
  const { data } = await supabase
    .from("notification_dispatch_config")
    .select("dispatch_secret")
    .eq("singleton", true)
    .maybeSingle();
  return typeof data?.dispatch_secret === "string" && safeEqual(provided, data.dispatch_secret);
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notification-dispatch-secret",
      "Content-Type": "application/json",
    },
  });
}
