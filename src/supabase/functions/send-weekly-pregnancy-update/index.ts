// ============================================================
// Edge Function: send-weekly-pregnancy-update (BONUS / opsiyonel)
// ============================================================
// AMAÇ: is_pregnant = true olan ve due_date'i dolu kullanıcılara, o anki
// gebelik haftasını hesaplayıp haftalık bir "bebeğinde neler oluyor"
// bildirimi gönderir. Bu, retention için önerdiğimiz özelliklerden biridir.
//
// TETİKLEME: Haftada 1 kez (örn. her Pazartesi 09:00) pg_cron ile.
// 0013 migration'daki cron.schedule örneğine benzer şekilde ayrı bir
// job olarak eklenebilir:
//
// SQL örneği (Supabase SQL Editor'de ayrıca çalıştırılmalı, bu dosyanın
// parçası değildir):
//
//   select cron.schedule(
//     'weekly-pregnancy-update',
//     '0 9 * * 1',
//     $$
//     select net.http_post(
//       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-weekly-pregnancy-update',
//       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>'),
//       body := '{}'::jsonb
//     );
//     $$
//   );
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const PREGNANCY_TOTAL_DAYS = 280; // standart 40 hafta hesaplaması

function calculatePregnancyWeek(dueDate: string): number {
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const daysUntilDue = Math.round((due - now) / (1000 * 60 * 60 * 24));
  const daysPregnant = PREGNANCY_TOTAL_DAYS - daysUntilDue;
  return Math.max(1, Math.min(42, Math.floor(daysPregnant / 7)));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: pregnantUsers, error } = await supabase
      .from("profiles")
      .select("id, due_date, mother_name")
      .eq("is_pregnant", true)
      .eq("notify_weekly_pregnancy_updates", true)
      .not("due_date", "is", null);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pregnantUsers || pregnantUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = pregnantUsers.map((u) => u.id);
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("user_id, expo_push_token")
      .in("user_id", userIds);

    const tokensByUser = new Map<string, string[]>();
    for (const t of tokens ?? []) {
      const list = tokensByUser.get(t.user_id) ?? [];
      list.push(t.expo_push_token);
      tokensByUser.set(t.user_id, list);
    }

    const messages = [];
    for (const user of pregnantUsers) {
      const week = calculatePregnancyWeek(user.due_date as string);
      const motherName = user.mother_name || "Anne";
      const userTokens = tokensByUser.get(user.id) ?? [];
      for (const token of userTokens) {
        messages.push({
          to: token,
          sound: "default",
          title: `${motherName}, ${week}. hafta güncellemen hazır`,
          body: "Bu hafta bebeğinde ve sende neler değişiyor? Görmek için dokun.",
          data: { type: "weekly_pregnancy_update", week },
        });
      }
    }

    let sentCount = 0;
    for (const batch of chunk(messages, 100)) {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (response.ok) sentCount += batch.length;
      else console.error("Expo push hatası:", await response.text());
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-weekly-pregnancy-update hata:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
