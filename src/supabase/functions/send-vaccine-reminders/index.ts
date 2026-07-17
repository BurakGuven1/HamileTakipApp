import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  dispatchPushes,
  type PushCandidate,
} from "../_shared/push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ReminderGroup = {
  babyId?: string;
  ownerId: string;
  pregnancyVaccinationIds?: string[];
  scheduledDate: string;
  source: "baby" | "pregnancy";
  subjectName: string;
  vaccineNames: string[];
  vaccinationIds: string[];
};

type PushToken = {
  id: string;
  user_id: string;
  expo_push_token: string;
};

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
    const tomorrow = addDays(today, 1);

    const [babyResult, pregnancyResult] = await Promise.all([
      supabase
        .from("baby_vaccinations")
        .select(
          "id,baby_id,scheduled_date,babies!inner(name,parent_id),vaccine_schedule!inner(vaccine_name)",
        )
        .eq("completed", false)
        .in("scheduled_date", [today, tomorrow]),
      supabase
        .from("pregnancy_vaccinations")
        .select(
          "id,profile_id,scheduled_date,vaccine_name,profiles!inner(mother_name,is_pregnant)",
        )
        .eq("completed", false)
        .eq("profiles.is_pregnant", true)
        .in("scheduled_date", [today, tomorrow]),
    ]);

    if (babyResult.error) throw babyResult.error;
    if (pregnancyResult.error) throw pregnancyResult.error;

    const groups = new Map<string, ReminderGroup>();

    for (const row of babyResult.data ?? []) {
      const baby = asObject(row.babies);
      const schedule = asObject(row.vaccine_schedule);
      const key = `baby:${row.baby_id}:${row.scheduled_date}`;
      const group: ReminderGroup = groups.get(key) ?? {
        babyId: row.baby_id,
        ownerId: String(baby.parent_id),
        scheduledDate: row.scheduled_date,
        source: "baby" as const,
        subjectName: String(baby.name || "Bebek"),
        vaccineNames: [],
        vaccinationIds: [],
      };
      group.vaccineNames.push(String(schedule.vaccine_name || "Aşı"));
      group.vaccinationIds.push(row.id);
      groups.set(key, group);
    }

    for (const row of pregnancyResult.data ?? []) {
      const profile = asObject(row.profiles);
      const key = `pregnancy:${row.profile_id}:${row.scheduled_date}`;
      const group: ReminderGroup = groups.get(key) ?? {
        ownerId: row.profile_id,
        scheduledDate: row.scheduled_date,
        source: "pregnancy" as const,
        subjectName: String(profile.mother_name || "Anne"),
        vaccineNames: [],
        vaccinationIds: [],
      };
      group.vaccineNames.push(row.vaccine_name);
      group.vaccinationIds.push(row.id);
      groups.set(key, group);
    }

    if (groups.size === 0) {
      const delivery = await dispatchPushes(supabase, []);
      return json({ success: true, reminders: 0, ...delivery });
    }

    const ownerIds = [...new Set([...groups.values()].map((item) => item.ownerId))];
    const [profileResult, memberResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,mother_name,father_name,notify_vaccine_reminders")
        .in("id", ownerIds),
      supabase
        .from("family_members")
        .select("owner_id,member_id")
        .in("owner_id", ownerIds),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (memberResult.error) throw memberResult.error;

    const profiles = new Map(
      (profileResult.data ?? []).map((profile) => [profile.id, profile]),
    );
    const recipientsByOwner = new Map<string, Set<string>>();
    for (const ownerId of ownerIds) {
      if (profiles.get(ownerId)?.notify_vaccine_reminders !== false) {
        recipientsByOwner.set(ownerId, new Set([ownerId]));
      }
    }
    for (const member of memberResult.data ?? []) {
      recipientsByOwner.get(member.owner_id)?.add(member.member_id);
    }

    const recipientIds = [...new Set(
      [...recipientsByOwner.values()].flatMap((recipients) => [...recipients]),
    )];
    const tokenResult = recipientIds.length
      ? await supabase
        .from("push_tokens")
        .select("id,user_id,expo_push_token")
        .eq("enabled", true)
        .in("user_id", recipientIds)
      : { data: [], error: null };
    if (tokenResult.error) throw tokenResult.error;

    const tokensByUser = new Map<string, PushToken[]>();
    for (const token of (tokenResult.data ?? []) as PushToken[]) {
      tokensByUser.set(token.user_id, [
        ...(tokensByUser.get(token.user_id) ?? []),
        token,
      ]);
    }

    const candidates: PushCandidate[] = [];
    for (const group of groups.values()) {
      const isToday = group.scheduledDate === today;
      const profile = profiles.get(group.ownerId);
      for (const userId of recipientsByOwner.get(group.ownerId) ?? []) {
        const recipientName = userId === group.ownerId
          ? profile?.mother_name || "Anne"
          : profile?.father_name || "Baba";
        for (const token of tokensByUser.get(userId) ?? []) {
          const countText = group.vaccineNames.length > 1
            ? `${group.vaccineNames.length} aşı`
            : group.vaccineNames[0];
          const title = group.source === "baby"
            ? `${recipientName}, ${group.subjectName} için ${isToday ? "bugün" : "yarın"} aşı günü`
            : `${recipientName}, ${isToday ? "bugün" : "yarın"} gebelik aşısı hatırlatman var`;
          const body = group.source === "baby"
            ? `${countText}. Planı aile hekiminizle doğrulamayı unutmayın.`
            : `${countText}. Uygun tarih ve aşı geçmişiniz için aile hekiminize danışın.`;

          candidates.push({
            dedupeKey:
              `vaccine:${group.source}:${group.babyId ?? group.ownerId}:${group.scheduledDate}:${today}`,
            kind: "vaccine_reminder",
            tokenId: token.id,
            token: token.expo_push_token,
            userId,
            message: {
              title,
              body,
              sound: "default",
              channelId: "vaccines",
              priority: "high",
              data: {
                type: "vaccine_reminder",
                screen: group.source === "baby" ? "baby-vaccines" : "home",
                source: group.source,
                baby_id: group.babyId,
                vaccination_ids: group.vaccinationIds,
                scheduled_date: group.scheduledDate,
              },
            },
          });
        }
      }
    }

    const delivery = await dispatchPushes(supabase, candidates);
    return json({ success: true, reminders: groups.size, ...delivery });
  } catch (error) {
    console.error("send-vaccine-reminders failed", error);
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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function asObject(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return (value[0] ?? {}) as Record<string, unknown>;
  return (value ?? {}) as Record<string, unknown>;
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
