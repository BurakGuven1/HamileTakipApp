// ============================================================
// Edge Function: moderate-forum-content
// ============================================================
// AMAÇ: Veritabanı ön-filtresine ek bir savunma katmanı olarak yeni forum
// içeriğini tarar. Ağır ihlallerde içeriği gizler, bağlama bağlı olabilecek
// ifadeleri moderatör kuyruğu için işaretler.
//
// TETİKLEME: Supabase "Database Webhooks" özelliği ile.
//   Dashboard > Database > Webhooks > Create a new webhook
//     - Table: forum_posts   (ayrı bir webhook da forum_comments için kur)
//     - Events: Insert
//     - Type: HTTP Request
//     - URL: https://<PROJECT_REF>.supabase.co/functions/v1/moderate-forum-content
//     - HTTP Headers:
//         Authorization: Bearer <SERVICE_ROLE_KEY>
//         x-moderation-secret: <MODERATION_WEBHOOK_SECRET>
//
// Kullanıcı raporları ayrı 24 saatlik moderasyon kuyruğunda insan tarafından
// değerlendirilir; otomatik filtre tek başına nihai hesap yaptırımı uygulamaz.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-moderation-secret",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("MODERATION_WEBHOOK_SECRET") ?? "";

const SEVERE_TERMS = new Set([
  "amk",
  "escort",
  "gerizekalı",
  "onlyfans",
  "orospu",
  "pezevenk",
  "pornografi",
  "porno",
  "sikik",
  "siktir",
  "şerefsiz",
]);

const REVIEW_TERMS = new Set([
  "aptal",
  "salak",
  "beceriksiz",
  "iğrenç",
]);

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
  const normalized = text.normalize("NFKC").toLocaleLowerCase("tr-TR");
  const tokens = normalized
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const compact = normalized.replace(/[^\p{L}\p{N}]+/gu, "");

  if (
    tokens.some((token) => SEVERE_TERMS.has(token)) ||
    /(seni|sizi).{0,18}(öldür|gebert|döver|tecavüz)/u.test(normalized) ||
    /(seniöldür|siziöldür|senigebert|sizigebert|çıplakfotoğrafgönder|nudegönder)/u.test(
      compact,
    )
  ) {
    return "severe";
  }

  if (tokens.some((token) => REVIEW_TERMS.has(token))) return "mild";
  return "clean";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "moderasyon yapılandırması eksik" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestSecret = req.headers.get("x-moderation-secret") ?? "";
  const bearerSecret = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (
    requestSecret !== WEBHOOK_SECRET &&
    bearerSecret !== WEBHOOK_SECRET
  ) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload: DatabaseWebhookPayload = await req.json();
    const { table, record } = payload;

    if (
      !["forum_posts", "forum_comments"].includes(table) ||
      !record?.id ||
      !record?.content
    ) {
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
