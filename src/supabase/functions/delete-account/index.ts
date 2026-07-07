// ============================================================
// Edge Function: delete-account
// ============================================================
// AMAÇ: Kullanıcının hesabını ve tüm ilişkili verilerini kalıcı olarak siler.
//
// NEDEN GEREKLİ: Apple App Store Guideline 5.1.1(v) ve Google Play, hesap
// oluşturma imkânı sunan her uygulamanın UYGULAMA İÇİNDEN hesap silme
// imkânı sunmasını ZORUNLU kılar. Bu fonksiyon olmadan uygulama App
// Store'dan reddedilir.
//
// GÜVENLİK: Bu fonksiyon supabase.auth.admin.deleteUser() çağırdığı için
// service_role key gerektirir. Bu yüzden İSTEMCİDEN DOĞRUDAN service_role
// key ile çağrılamaz — kullanıcının kendi geçerli auth token'ı ile bu
// fonksiyonu çağırması, fonksiyonun ise içeride service_role client'ı
// kullanması gerekir (aşağıdaki kod tam olarak bunu yapar).
//
// KURULUM:
//   supabase functions deploy delete-account
//
// CLIENT KULLANIMI (React Native):
//   const { data, error } = await supabase.functions.invoke('delete-account');
//   (Supabase client otomatik olarak kullanıcının oturum token'ını
//   Authorization header'ına ekler, ekstra bir şey yapmana gerek yok.)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) Çağıranın kimliğini, kendi Authorization header'ındaki token'dan
    // doğrula (service_role DEĞİL, kullanıcının kendi anon-context client'ı)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "geçersiz oturum" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) service_role client'ı ile kullanıcıyı ve TÜM ilişkili verilerini sil.
    // profiles/babies/growth_records/baby_photos/baby_vaccinations/
    // push_tokens/subscriptions tabloları "on delete cascade" ile
    // tanımlandığı için auth.users silinince otomatik temizlenir.
    // forum_posts / forum_comments KASITLI OLARAK cascade silinmiyor
    // (0009 migration'da "on delete cascade" var, dilersen "on delete set null"
    // yaparak geçmiş forum gönderilerini anonim şekilde tutabilirsin —
    // bunu bir sonraki adımda birlikte kararlaştırabiliriz).
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      user.id,
    );

    if (deleteError) {
      console.error("Hesap silme hatası:", deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account hata:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
