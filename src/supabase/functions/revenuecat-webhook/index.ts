// ============================================================
// Edge Function: revenuecat-webhook
// ============================================================
// AMAÇ: RevenueCat'ten gelen abonelik olaylarını (satın alma, yenileme,
// iptal, süre dolumu vb.) dinler ve public.subscriptions tablosunu günceller.
//
// KURULUM:
// 1) Bu fonksiyonu deploy et:
//      supabase functions deploy revenuecat-webhook --no-verify-jwt
//    (--no-verify-jwt ZORUNLU, çünkü RevenueCat bir Supabase auth token'ı
//    göndermez, kendi Authorization header'ını gönderir)
//
// 2) Secret'ları ayarla:
//      supabase secrets set REVENUECAT_WEBHOOK_AUTH_HEADER=<kendi-belirlediğin-gizli-değer>
//
// 3) RevenueCat Dashboard > Project Settings > Integrations > Webhooks:
//      URL: https://<PROJECT_REF>.supabase.co/functions/v1/revenuecat-webhook
//      Authorization header value: Bearer <2. adımdaki gizli değer>
//
// 4) RevenueCat'te ürün ID'leri:
//      - com.burakguven.hamiletakip.premium.monthly
//      - com.burakguven.hamiletakip.premium.yearly
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
const WEBHOOK_AUTH_HEADER = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER")!;

// Lifetime (ömür boyu, tek seferlik) olarak kabul edilecek ürün ID'leri.
// Şu an monthly/yearly abonelik kullanıldığı için boş.
const LIFETIME_PRODUCT_IDS: string[] = [];

// RevenueCat event.type değerlerine göre subscriptions.status eşlemesi
function mapEventTypeToStatus(
  eventType: string,
  expirationAtMs: number | null,
): string {
  const expiresInFuture =
    typeof expirationAtMs === "number" && expirationAtMs > Date.now();

  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE":
    case "PRODUCT_CHANGE":
      return "active";
    case "CANCELLATION":
      // Kullanıcı yenilemeyi iptal etmiş olsa bile süre dolana kadar entitlement
      // aktif kalır. Supabase cache de bu dönemde active tutulur.
      return expiresInFuture ? "active" : "cancelled";
    case "EXPIRATION":
      return "expired";
    case "BILLING_ISSUE":
      return "grace_period";
    default:
      return "expired";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ---- Güvenlik: RevenueCat'in gönderdiği Authorization header'ını doğrula ----
  const authHeader = req.headers.get("authorization") ?? "";
  if (!WEBHOOK_AUTH_HEADER || authHeader !== `Bearer ${WEBHOOK_AUTH_HEADER}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const event = payload?.event;

    if (!event) {
      return new Response(JSON.stringify({ error: "no event in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType: string = event.type;

    if (eventType === "TEST") {
      return new Response(JSON.stringify({ success: true, ignored: "test" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // app_user_id, RevenueCat'e client tarafında Supabase auth.uid() olarak
    // set edilmelidir (Purchases.logIn(supabaseUserId)). Bu şekilde eşleşme sağlanır.
    const userId: string | undefined = event.app_user_id;
    const productId: string | undefined = event.product_id;
    const expirationAtMs: number | null = event.expiration_at_ms ?? null;

    if (!userId || !productId) {
      return new Response(
        JSON.stringify({ success: true, ignored: "missing_app_user_id_or_product_id" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isLifetime = LIFETIME_PRODUCT_IDS.includes(productId);
    const status = mapEventTypeToStatus(eventType, expirationAtMs);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          product_id: productId,
          status,
          is_lifetime: isLifetime,
          expires_at: isLifetime
            ? null
            : expirationAtMs
            ? new Date(expirationAtMs).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("subscriptions upsert hatası:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bilgilendirme amaçlı: bu event'i analytics_events tablosuna da yazalım.
    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_name: `revenuecat_${eventType?.toLowerCase()}`,
      event_properties: { product_id: productId, status },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("revenuecat-webhook hata:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
