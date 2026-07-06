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
//      supabase secrets set REVENUECAT_WEBHOOK_AUTH_HEADER=<kendi-belirlediğin-gizli-deger>
//
// 3) RevenueCat Dashboard > Project Settings > Integrations > Webhooks:
//      URL: https://<PROJECT_REF>.supabase.co/functions/v1/revenuecat-webhook
//      Authorization header value: (2. adımdaki ile AYNI değer)
//
// 4) RevenueCat'te ürün ID'lerini şu isimlerle eşleştir (veya kendi isimlerinle
//    değiştirip aşağıdaki LIFETIME_PRODUCT_IDS listesini güncelle):
//      - premium_monthly   (149 TL/ay)
//      - premium_lifetime  (999 TL tek seferlik)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_AUTH_HEADER = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER")!;

// Lifetime (ömür boyu, tek seferlik) olarak kabul edilecek ürün ID'leri.
const LIFETIME_PRODUCT_IDS = ["premium_lifetime"];

// RevenueCat event.type değerlerine göre subscriptions.status eşlemesi
function mapEventTypeToStatus(eventType: string): string {
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE":
    case "PRODUCT_CHANGE":
      return "active";
    case "CANCELLATION":
      // Kullanıcı iptal etti ama süre dolana kadar hâlâ aktif olabilir.
      // RevenueCat "expiration_at_ms" ileri bir tarihse yine de "active"
      // kabul edip expires_at'e göre client tarafında kontrol edilebilir.
      return "cancelled";
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

    // app_user_id, RevenueCat'e client tarafında Supabase auth.uid() olarak
    // set edilmelidir (Purchases.logIn(supabaseUserId)). Bu şekilde eşleşme sağlanır.
    const userId: string | undefined = event.app_user_id;
    const productId: string | undefined = event.product_id;
    const eventType: string = event.type;
    const expirationAtMs: number | null = event.expiration_at_ms ?? null;

    if (!userId || !productId) {
      return new Response(
        JSON.stringify({ error: "app_user_id veya product_id eksik" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isLifetime = LIFETIME_PRODUCT_IDS.includes(productId);
    const status = mapEventTypeToStatus(eventType);

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
