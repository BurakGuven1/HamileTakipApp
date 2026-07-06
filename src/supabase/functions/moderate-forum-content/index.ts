// ============================================================
// Edge Function: moderate-forum-content
// ============================================================
// AMAÇ: Yeni bir forum_posts veya forum_comments satırı eklendiğinde
// basit bir anahtar kelime filtresiyle içeriği tarar. Ağır ihlallerde
// içeriği otomatik gizler (is_hidden = true), hafif şüpheli durumlarda
// sadece işaretler (is_flagged = true) ki moderatör incelesin.
//
// TETİKLEME: Supabase "Database Webhooks" özelliği ile.
//   Dashboard > Database > Webhooks > Create a new webhook
//     - Table: forum_posts   (ayrı bir webhook da forum_comments için kur)
//     - Events: Insert
//     - Type: HTTP Request
//     - URL: https://<PROJECT_REF>.supabase.co/functions/v1/moderate-forum-content
//     - HTTP Headers: Authorization: Bearer <SERVICE_ROLE_KEY veya ayrı bir secret>
//
// NOT: Bu, gerçek bir toksisite/ML modeli değildir — başlangıç seviyesi bir
// anahtar kelime filtresidir. Prod'a çıkmadan önce:
//   1) BANNED_WORDS_SEVERE / BANNED_WORDS_MILD listelerini genişletin
//      (Türkçe küfür/hakaret sözlüğü kütüphaneleri araştırılabilir)
//   2) İsterseniz OpenAI/Anthropic moderation API'si gibi bir servisle
//      bu fonksiyonu güçlendirebilirsiniz (ek maliyet + gecikme getirir)
//   3) forum_reports tablosundaki kullanıcı raporlarını düzenli inceleyen
//      bir moderatör süreci MUTLAKA olmalı — otomatik filtre tek başına yeterli değildir
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("MODERATION_WEBHOOK_SECRET") ?? "";

// Örnek/başlangıç listesi — gerçek kullanım öncesi mutlaka genişletilmeli.
// Küçük harfe çevrilip kelime bazlı kontrol edilir.
const BANNED_WORDS_SEVERE = ["küfür_ornek1", "hakaret_ornek1"]; // ağır ihlal -> otomatik gizle
const BANNED_WORDS_MILD = ["aptal", "salak", "gerizekalı"]; // hafif -> flagle, moderatör baksın

interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: "forum_posts" | "forum_comments";
  record: {
    id: string;
    title?: string;
    content: string;
    [key: string]: unknown;
  };
}

function scanText(text: string): "severe" | "mild" | "clean" {
  const lower = text.toLowerCase();
  if (BANNED_WORDS_SEVERE.some((w) => lower.includes(w))) return "severe";
  if (BANNED_WORDS_MILD.some((w) => lower.includes(w))) return "mild";
  return "clean";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Webhook secret kontrolü (Database Webhook header'ında gönderilmeli)
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const payload: DatabaseWebhookPayload = await req.json();
    const { table, record } = payload;

    if (!record?.id || !record?.content) {
      return new Response(JSON.stringify({ error: "geçersiz payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullText = `${record.title ?? ""} ${record.content}`;
    const result = scanText(fullText);

    if (result === "clean") {
      return new Response(JSON.stringify({ success: true, action: "none" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const updatePayload =
      result === "severe"
        ? { is_flagged: true, is_hidden: true, flagged_reason: "otomatik_filtre_agir" }
        : { is_flagged: true, flagged_reason: "otomatik_filtre_hafif" };

    const { error } = await supabase
      .from(table)
      .update(updatePayload)
      .eq("id", record.id);

    if (error) {
      console.error("moderasyon güncelleme hatası:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, action: result, table, id: record.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("moderate-forum-content hata:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
