// ============================================================
// Edge Function: send-vaccine-reminders
// ============================================================
// AMAÇ: Yaklaşan (3 gün içinde zamanı gelen, henüz yapılmamış) aşıları
// bulur ve ilgili ebeveynin cihaz(lar)ına Expo Push Notification gönderir.
//
// TETİKLEME: Her gün 1 kez, migration dosyasındaki (0013) pg_cron job'u
// veya Supabase Dashboard > Database > Cron Jobs üzerinden.
//
// KURULUM:
//   supabase functions deploy send-vaccine-reminders
//   supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//   (Bu iki secret genelde Supabase tarafından otomatik enjekte edilir,
//   ayrıca ayarlamanız gerekmeyebilir - deploy sonrası test edin.)
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

interface UpcomingVaccination {
  baby_id: string;
  parent_id: string;
  vaccine_name: string;
  scheduled_date: string;
}

interface ExpoPushMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Expo push API tek seferde en fazla 100 mesaj kabul eder.
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
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

    // 1) Yaklaşan aşıları çek (0013 migration'daki RPC fonksiyonu)
    const { data: upcoming, error: rpcError } = await supabase.rpc(
      "get_upcoming_vaccinations",
      { days_ahead: 3 },
    );

    if (rpcError) {
      console.error("get_upcoming_vaccinations hatası:", rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = (upcoming ?? []) as UpcomingVaccination[];
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "Yaklaşan aşı yok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) İlgili ebeveynlerin push token'larını çek
    const parentIds = [...new Set(rows.map((r) => r.parent_id))];
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("user_id, expo_push_token")
      .in("user_id", parentIds);

    if (tokenError) {
      console.error("push_tokens sorgu hatası:", tokenError);
      return new Response(JSON.stringify({ error: tokenError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokensByUser = new Map<string, string[]>();
    for (const t of tokens ?? []) {
      const list = tokensByUser.get(t.user_id) ?? [];
      list.push(t.expo_push_token);
      tokensByUser.set(t.user_id, list);
    }

    // 3) Her yaklaşan aşı için Expo push mesajı oluştur
    const messages: ExpoPushMessage[] = [];
    for (const row of rows) {
      const userTokens = tokensByUser.get(row.parent_id) ?? [];
      for (const token of userTokens) {
        messages.push({
          to: token,
          sound: "default",
          title: "Aşı Hatırlatması 💉",
          body: `${row.vaccine_name} için önerilen tarih yaklaşıyor (${row.scheduled_date}).`,
          data: { type: "vaccine_reminder", baby_id: row.baby_id },
        });
      }
    }

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: "Yaklaşan aşı var ama kayıtlı push token bulunamadı",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4) Expo push API'ye 100'lük gruplar halinde gönder
    let sentCount = 0;
    for (const batch of chunk(messages, 100)) {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error("Expo push gönderim hatası:", await response.text());
        continue;
      }
      sentCount += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, vaccinations: rows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-vaccine-reminders hata:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
