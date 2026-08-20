import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  dispatchPushes,
  type PushCandidate,
} from "../_shared/push.ts";
import { buildDailySupportCopy } from "./dailySupportCopy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ProfileRow = {
  id: string;
  mother_name: string | null;
  father_name: string | null;
  is_pregnant: boolean;
  due_date: string | null;
  notify_daily_support: boolean;
};

type BabyRow = {
  id: string;
  parent_id: string;
  name: string;
  birth_date: string;
};

type ArticleRow = {
  slug: string;
  title: string;
  excerpt: string;
  timeline_start_week: number | null;
  timeline_end_week: number | null;
};

type PushToken = {
  id: string;
  user_id: string;
  expo_push_token: string;
};

type FamilyMembershipRow = {
  owner_id: string;
  member_id: string;
  display_name: string;
  access_scope: "full_family" | "baby_care_only";
};

const pregnancySupport = [
  "Bugün her şeyi yetiştirmek zorunda değilsin. Kısa bir mola da bakımın bir parçası.",
  "Bedeninin hızına güven; su içmek ve birkaç sakin nefes almak bugün için güzel bir başlangıç olabilir.",
  "Kendine gösterdiğin şefkat, bu yolculuğun görünmeyen ama çok değerli bir parçası.",
  "Bugün enerjin azsa bu başarısızlık değil; bedenin büyük bir iş yapıyor.",
  "Küçük bir yürüyüş, sevdiğin bir şarkı veya sessiz bir mola: sana iyi geleni seçebilirsin.",
  "Kaygı yükseldiğinde tek bir şeye dön: şu anki nefesine. Sonraki adımı sonra düşünürsün.",
  "Destek istemek güçsüzlük değil, kendine ve bebeğine iyi bakmanın bir yolu.",
];

const postpartumSupport = [
  "Bugün mükemmel olmaya değil, yeterince iyi ve şefkatli olmaya ihtiyacın var.",
  "Bebeğin kadar senin de bakıma ihtiyacın var. Bir bardak su ve kısa bir dinlenme küçük görünse de değerlidir.",
  "Zor bir an, kötü bir ebeveyn olduğun anlamına gelmez. Sadece zor bir an yaşıyorsun.",
  "Yardım kabul etmek bakımın paylaşılmasıdır; yükünü tek başına taşımak zorunda değilsin.",
  "Bugün yalnızca bir küçük şeyi kolaylaştırmayı seç. Geri kalanı bekleyebilir.",
  "Uykusuzluk duyguları büyütebilir. Kendine bugün daha yumuşak konuşmayı dene.",
  "Bebeğinin ihtiyacı kusursuzluk değil; güvenli, sevgi dolu ve yanında olan bir ebeveyn.",
  "Sen de bu yeni hayata alışıyorsun. Öğrenmek için kendine zaman tanı.",
  "Bir öğün, bir duş ya da on dakikalık sessizlik: bugün kendi ihtiyacına da yer açabilirsin.",
  "İyi hissetmediğin günlerde bunu güvendiğin biriyle paylaşmak önemli bir bakım adımıdır.",
];

const generalSupport = [
  "Bugün kendinize ve birbirinize küçük bir iyilik yapmak için güzel bir gün.",
  "Bakım paylaşıldığında ailece nefes almak kolaylaşır. Bugün tek bir işi birlikte hafifletebilirsiniz.",
  "Küçük rutinler büyük güven duygusu yaratır; bugün yaptığınız bir küçük şey yeterli.",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (!await isAuthorized(req, supabase)) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const today = turkeyDate();
    const [profileResult, membershipResult, babyResult, articleResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,mother_name,father_name,is_pregnant,due_date,notify_daily_support",
          )
          .eq("notify_daily_support", true),
        supabase
          .from("family_members")
          .select("owner_id,member_id,display_name,access_scope"),
        supabase
          .from("babies")
          .select("id,parent_id,name,birth_date")
          .order("birth_date", { ascending: false }),
        supabase
          .from("articles")
          .select(
            "slug,title,excerpt,timeline_start_week,timeline_end_week",
          )
          .eq("is_published", true)
          .not("timeline_start_week", "is", null)
          .not("timeline_end_week", "is", null),
      ]);

    if (profileResult.error) throw profileResult.error;
    if (membershipResult.error) throw membershipResult.error;
    if (babyResult.error) throw babyResult.error;
    if (articleResult.error) throw articleResult.error;

    const memberships = (membershipResult.data ?? []) as FamilyMembershipRow[];
    const memberIds = new Set(memberships.map((item) => item.member_id));
    const memberNames = new Map(
      memberships.map((item) => [item.member_id, item.display_name]),
    );
    const babyCareOnlyMemberIds = new Set(
      memberships
        .filter((item) => item.access_scope === "baby_care_only")
        .map((item) => item.member_id),
    );
    const ownerProfiles = ((profileResult.data ?? []) as ProfileRow[])
      .filter((profile) => !memberIds.has(profile.id));

    const familyByOwner = new Map<string, Set<string>>();
    for (const profile of ownerProfiles) {
      familyByOwner.set(profile.id, new Set([profile.id]));
    }
    for (const membership of memberships) {
      familyByOwner.get(membership.owner_id)?.add(membership.member_id);
    }

    const babyByOwner = new Map<string, BabyRow>();
    for (const baby of (babyResult.data ?? []) as BabyRow[]) {
      if (!babyByOwner.has(baby.parent_id)) babyByOwner.set(baby.parent_id, baby);
    }

    const allRecipientIds = [...new Set(
      [...familyByOwner.values()].flatMap((family) => [...family]),
    )];
    const tokenResult = allRecipientIds.length
      ? await supabase
        .from("push_tokens")
        .select("id,user_id,expo_push_token")
        .eq("enabled", true)
        .in("user_id", allRecipientIds)
      : { data: [], error: null };
    if (tokenResult.error) throw tokenResult.error;

    const tokensByUser = new Map<string, PushToken[]>();
    for (const token of (tokenResult.data ?? []) as PushToken[]) {
      tokensByUser.set(token.user_id, [
        ...(tokensByUser.get(token.user_id) ?? []),
        token,
      ]);
    }

    const dayIndex = Number(today.replaceAll("-", ""));
    const articles = (articleResult.data ?? []) as ArticleRow[];
    const candidates: PushCandidate[] = [];

    for (const profile of ownerProfiles) {
      const baby = babyByOwner.get(profile.id);
      const week = profile.is_pregnant && profile.due_date
        ? pregnancyWeek(profile.due_date, today)
        : null;
      const matchingArticles = week
        ? articles.filter((article) =>
          (article.timeline_start_week ?? 99) <= week &&
          (article.timeline_end_week ?? 0) >= week
        )
        : [];
      const article = matchingArticles.length > 0 && dayIndex % 2 === 0
        ? matchingArticles[dayIndex % matchingArticles.length]
        : null;
      for (const userId of familyByOwner.get(profile.id) ?? []) {
        // A caregiver may coordinate explicitly shared pregnancy tasks, but
        // pregnancy week, maternal articles and wellbeing copy remain private.
        if (profile.is_pregnant && babyCareOnlyMemberIds.has(userId)) continue;

        const recipientName = userId === profile.id
          ? profile.mother_name || "Anne"
          : memberNames.get(userId) || profile.father_name || "Aile üyesi";
        const copy = buildDailySupportCopy({
          articleExcerpt: article?.excerpt ?? null,
          babyName: baby?.name ?? null,
          name: recipientName,
          week,
        });

        for (const token of tokensByUser.get(userId) ?? []) {
          candidates.push({
            dedupeKey: `daily-support:${profile.id}:${today}`,
            kind: copy.screen === "article" ? "daily_article" : "daily_support",
            tokenId: token.id,
            token: token.expo_push_token,
            userId,
            message: {
              title: copy.title,
              body: copy.body,
              sound: "default",
              channelId: "daily-support",
              data: copy.screen === "article" && article
                ? {
                  type: "daily_article",
                  screen: "article",
                  slug: article.slug,
                  week,
                }
                : {
                  type: "daily_support",
                  screen: "home",
                  lifecycle: week ? "pregnancy" : baby ? "postpartum" : "family",
                },
            },
          });
        }
      }
    }

    const delivery = await dispatchPushes(supabase, candidates);
    return json({ success: true, families: ownerProfiles.length, ...delivery });
  } catch (error) {
    console.error("send-daily-support failed", error);
    return json({ error: String(error) }, 500);
  }
});

async function isAuthorized(req: Request, supabase: any) {
  const provided = req.headers.get("x-notification-dispatch-secret");
  if (!provided) return false;

  const { data } = await supabase
    .from("notification_dispatch_config")
    .select("dispatch_secret")
    .eq("singleton", true)
    .maybeSingle();

  return typeof data?.dispatch_secret === "string" &&
    safeEqual(provided, data.dispatch_secret);
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function turkeyDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function pregnancyWeek(dueDate: string, today: string) {
  const due = Date.parse(`${dueDate}T12:00:00Z`);
  const now = Date.parse(`${today}T12:00:00Z`);
  const daysUntilDue = Math.round((due - now) / 86_400_000);
  return Math.max(1, Math.min(42, Math.floor((280 - daysUntilDue) / 7)));
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-notification-dispatch-secret",
      "Content-Type": "application/json",
    },
  });
}
