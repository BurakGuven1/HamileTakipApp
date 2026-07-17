import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { dispatchPushes, type PushCandidate } from "../_shared/push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const { data: tokens, error } = await supabase
    .from("push_tokens")
    .select("id,user_id,expo_push_token")
    .eq("user_id", userData.user.id)
    .eq("enabled", true);
  if (error) return json({ error: error.message }, 500);
  if (!tokens?.length) return json({ error: "no_active_push_token" }, 409);

  const nonce = new Date().toISOString();
  const candidates: PushCandidate[] = tokens.map((token) => ({
    dedupeKey: `test:${userData.user.id}:${nonce}`,
    kind: "test_notification",
    tokenId: token.id,
    token: token.expo_push_token,
    userId: userData.user.id,
    message: {
      title: "Anne+ bildirim testi başarılı",
      body: "Bu bildirimi görüyorsanız cihazınız push bildirimlerini almaya hazır.",
      sound: "default",
      channelId: "daily-support",
      data: { type: "test_notification", screen: "home" },
    },
  }));

  const delivery = await dispatchPushes(supabase, candidates);
  return json({ success: delivery.ticketed > 0, ...delivery }, delivery.failed ? 502 : 200);
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}
