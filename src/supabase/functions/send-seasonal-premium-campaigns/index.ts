// ============================================================
// Edge Function: send-seasonal-premium-campaigns
// ============================================================
// AMAÇ: Türkiye için güçlü sezonsal günlerde Premium teklif bildirimleri
// göndermek. Gün 0/1 agresif paywall yok; en az 5 günlük, premium olmayan
// ve push token'ı bulunan kullanıcılara kampanya/yıl başına tek bildirim gider.
//
// Deploy:
//   supabase functions deploy send-seasonal-premium-campaigns --project-ref <PROJECT_REF>
//
// Cron önerisi:
//   Her gün 06:00 UTC civarı çalıştır. Fonksiyon kampanya günü değilse 0 gönderir.
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
const DAY_MS = 24 * 60 * 60 * 1000;

type Campaign = {
  body: string;
  key: "mothers_day" | "black_friday" | "new_year";
  title: string;
  year: number;
};

type ProfileRow = {
  created_at: string;
  id: string;
  mother_name: string | null;
};

type PushTokenRow = {
  expo_push_token: string;
  user_id: string;
};

type SubscriptionRow = {
  expires_at: string | null;
  status: string;
  user_id: string;
};

type CampaignLogRow = {
  user_id: string;
};

type ExpoPushMessage = {
  body: string;
  data: Record<string, unknown>;
  sound: "default";
  title: string;
  to: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // App Review 4.5.4 requires explicit in-app marketing consent before a
    // promotional push is sent. The app currently has no separate, persisted
    // marketing-consent preference, so promotional push delivery is disabled.
    // Re-enable only after adding an opt-in preference (default false), its
    // settings control, and filtering recipients by that preference.
    return json({
      success: true,
      sent: 0,
      message: "Promotional push notifications are disabled pending explicit opt-in."
    });

    /*
    const requestBody = await req.json().catch(() => ({}));
    const campaign =
      getForcedCampaign(requestBody?.campaignKey) ?? getActiveTurkeyCampaign();

    if (!campaign) {
      return json({ success: true, sent: 0, message: "Aktif kampanya yok" });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const eligibleBefore = new Date(Date.now() - 5 * DAY_MS).toISOString();
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, mother_name, created_at")
      .lte("created_at", eligibleBefore)
      .limit(5000);

    if (profileError) {
      return json({ error: profileError.message }, 500);
    }

    const profileRows = (profiles ?? []) as ProfileRow[];
    if (profileRows.length === 0) {
      return json({ success: true, sent: 0, message: "Uygun profil yok" });
    }

    const profileIds = profileRows.map((profile) => profile.id);
    const [{ data: subscriptions, error: subscriptionError }, { data: logs, error: logError }] =
      await Promise.all([
        supabase
          .from("subscriptions")
          .select("user_id, status, expires_at")
          .in("user_id", profileIds),
        supabase
          .from("premium_campaign_notification_logs")
          .select("user_id")
          .eq("campaign_key", campaign.key)
          .eq("campaign_year", campaign.year)
          .in("user_id", profileIds),
      ]);

    if (subscriptionError) {
      return json({ error: subscriptionError.message }, 500);
    }

    if (logError) {
      return json({ error: logError.message }, 500);
    }

    const activeUserIds = new Set(
      ((subscriptions ?? []) as SubscriptionRow[])
        .filter((subscription) => {
          if (subscription.status !== "active") {
            return false;
          }

          return (
            subscription.expires_at === null ||
            Date.parse(subscription.expires_at) > Date.now()
          );
        })
        .map((subscription) => subscription.user_id),
    );
    const alreadySentUserIds = new Set(
      ((logs ?? []) as CampaignLogRow[]).map((log) => log.user_id),
    );
    const eligibleProfiles = profileRows.filter(
      (profile) =>
        !activeUserIds.has(profile.id) && !alreadySentUserIds.has(profile.id),
    );

    if (eligibleProfiles.length === 0) {
      return json({
        campaign,
        success: true,
        sent: 0,
        message: "Bildirim gönderilecek yeni kullanıcı yok",
      });
    }

    const eligibleUserIds = eligibleProfiles.map((profile) => profile.id);
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("user_id, expo_push_token")
      .in("user_id", eligibleUserIds);

    if (tokenError) {
      return json({ error: tokenError.message }, 500);
    }

    const profilesById = new Map(
      eligibleProfiles.map((profile) => [profile.id, profile]),
    );
    const usersWithMessages = new Set<string>();
    const messages: ExpoPushMessage[] = [];

    for (const token of (tokens ?? []) as PushTokenRow[]) {
      const profile = profilesById.get(token.user_id);
      if (!profile) {
        continue;
      }

      usersWithMessages.add(token.user_id);
      messages.push({
        to: token.expo_push_token,
        sound: "default",
        title: campaign.title,
        body: personalizeBody(campaign.body, profile.mother_name),
        data: {
          campaign_key: campaign.key,
          campaign_year: campaign.year,
          screen: "paywall",
          type: "premium_campaign",
        },
      });
    }

    if (messages.length === 0) {
      return json({
        campaign,
        success: true,
        sent: 0,
        message: "Uygun kullanıcı var ama push token yok",
      });
    }

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

    if (sentCount > 0) {
      await supabase.from("premium_campaign_notification_logs").upsert(
        [...usersWithMessages].map((userId) => ({
          user_id: userId,
          campaign_key: campaign.key,
          campaign_year: campaign.year,
          sent_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,campaign_key,campaign_year" },
      );
    }

    return json({
      campaign,
      success: true,
      sent: sentCount,
      users: usersWithMessages.size,
    });
    */
  } catch (error) {
    console.error("send-seasonal-premium-campaigns hata:", error);
    return json({ error: String(error) }, 500);
  }
});

function getActiveTurkeyCampaign(now = new Date()): Campaign | null {
  const today = getTurkeyDateOnly(now);
  const year = today.getUTCFullYear();
  const mothersDay = getSecondSundayOfMay(year);
  const blackFriday = getBlackFriday(year);
  const newYearCampaignYear = today.getUTCMonth() === 11 ? year + 1 : year;

  if (sameDay(today, mothersDay)) {
    return {
      key: "mothers_day",
      year,
      title: "Anneler Günü'nde Anne+ Premium",
      body:
        "{{name}}, bugün kendine küçük bir alan aç. Premium özellikleri ve güncel abonelik seçeneklerini incele.",
    };
  }

  if (sameDay(today, blackFriday)) {
    return {
      key: "black_friday",
      year,
      title: "Anne+ Premium'u keşfet",
      body:
        "{{name}}, Premium araçları, forumu ve anı galerisini güncel paket seçenekleriyle keşfet.",
    };
  }

  if (
    sameDay(today, new Date(Date.UTC(newYearCampaignYear - 1, 11, 31))) ||
    sameDay(today, new Date(Date.UTC(newYearCampaignYear, 0, 1)))
  ) {
    return {
      key: "new_year",
      year: newYearCampaignYear,
      title: "Yeni yılda Anne+ Premium",
      body:
        "{{name}}, yeni yılda bebeğinle daha yakın bir takip alanı kur. Premium özellikleri ve güncel paketleri incele.",
    };
  }

  return null;
}

function getForcedCampaign(campaignKey?: string): Campaign | null {
  if (!campaignKey) {
    return null;
  }

  const year = getTurkeyDateOnly().getUTCFullYear();
  if (campaignKey === "mothers_day") {
    return {
      key: "mothers_day",
      year,
      title: "Anneler Günü'nde Anne+ Premium",
      body:
        "{{name}}, bugün kendine küçük bir alan aç. Premium özellikleri ve güncel abonelik seçeneklerini incele.",
    };
  }

  if (campaignKey === "black_friday") {
    return {
      key: "black_friday",
      year,
      title: "Anne+ Premium'u keşfet",
      body:
        "{{name}}, Premium araçları, forumu ve anı galerisini güncel paket seçenekleriyle keşfet.",
    };
  }

  if (campaignKey === "new_year") {
    return {
      key: "new_year",
      year,
      title: "Yeni yılda Anne+ Premium",
      body:
        "{{name}}, yeni yılda bebeğinle daha yakın bir takip alanı kur. Premium özellikleri ve güncel paketleri incele.",
    };
  }

  return null;
}

function personalizeBody(body: string, motherName: string | null) {
  return body.replace("{{name}}", motherName || "Anne");
}

function getTurkeyDateOnly(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  );
}

function getSecondSundayOfMay(year: number) {
  const mayFirst = new Date(Date.UTC(year, 4, 1));
  const firstSundayOffset = (7 - mayFirst.getUTCDay()) % 7;
  return new Date(Date.UTC(year, 4, 1 + firstSundayOffset + 7));
}

function getBlackFriday(year: number) {
  const novemberFirst = new Date(Date.UTC(year, 10, 1));
  const firstThursdayOffset = (4 - novemberFirst.getUTCDay() + 7) % 7;
  const thanksgiving = new Date(
    Date.UTC(year, 10, 1 + firstThursdayOffset + 21),
  );
  return new Date(thanksgiving.getTime() + DAY_MS);
}

function sameDay(first: Date, second: Date) {
  return first.toISOString().slice(0, 10) === second.toISOString().slice(0, 10);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < arr.length; index += size) {
    chunks.push(arr.slice(index, index + size));
  }
  return chunks;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
