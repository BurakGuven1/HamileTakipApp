import AsyncStorage from "@react-native-async-storage/async-storage";

const DAY_MS = 24 * 60 * 60 * 1000;
const PASSIVE_OFFER_STATE_KEY = "premium-passive-offer-state-v1";
const MIN_ACCOUNT_AGE_DAYS = 5;
const PASSIVE_OFFER_COOLDOWN_DAYS = 4;
const MAX_PASSIVE_OFFERS_PER_30_DAYS = 3;

export type PassivePremiumOfferKind = "day5_offer" | "seasonal";

export type PassivePremiumOffer = {
  campaignKey?: string;
  cta: string;
  kind: PassivePremiumOfferKind;
  message: string;
  title: string;
};

type PassiveOfferState = {
  lastShownAt?: string;
  recentShownAt?: string[];
  seasonalShownKeys?: string[];
};

type PassiveOfferInput = {
  createdAt?: string | null;
  isPremium: boolean;
  now?: Date;
};

export function getAccountAgeDays(createdAt?: string | null, now = new Date()) {
  if (!createdAt) {
    return 0;
  }

  const createdTime = Date.parse(createdAt);
  if (!Number.isFinite(createdTime)) {
    return 0;
  }

  return Math.floor((now.getTime() - createdTime) / DAY_MS);
}

export function canShowPremiumFeaturePaywall() {
  return true;
}

export async function getPassivePremiumOffer({
  createdAt,
  isPremium,
  now = new Date()
}: PassiveOfferInput): Promise<PassivePremiumOffer | null> {
  if (isPremium || getAccountAgeDays(createdAt, now) < MIN_ACCOUNT_AGE_DAYS) {
    return null;
  }

  const state = await readPassiveOfferState();
  const seasonalCampaign = getActiveSeasonalPremiumCampaign(now);
  if (
    seasonalCampaign &&
    seasonalCampaign.campaignKey &&
    !state.seasonalShownKeys?.includes(seasonalCampaign.campaignKey)
  ) {
    return seasonalCampaign;
  }

  const lastShownTime = state.lastShownAt ? Date.parse(state.lastShownAt) : 0;
  if (
    Number.isFinite(lastShownTime) &&
    lastShownTime > 0 &&
    now.getTime() - lastShownTime < PASSIVE_OFFER_COOLDOWN_DAYS * DAY_MS
  ) {
    return null;
  }

  const recentShownAt = (state.recentShownAt ?? []).filter((shownAt) => {
    const shownTime = Date.parse(shownAt);
    return Number.isFinite(shownTime) && now.getTime() - shownTime < 30 * DAY_MS;
  });

  if (recentShownAt.length >= MAX_PASSIVE_OFFERS_PER_30_DAYS) {
    return null;
  }

  return {
    cta: "Paketleri ve fiyatları gör",
    kind: "day5_offer",
    message:
      "Anne+ Premium seçeneklerini incele. Paket süresi ve tahsil edilecek toplam tutar satın almadan önce gösterilir.",
    title: "Premium'u keşfet"
  };
}

export async function recordPassivePremiumOfferShown(offer: PassivePremiumOffer) {
  const state = await readPassiveOfferState();
  const nowIso = new Date().toISOString();
  const recentShownAt = [...(state.recentShownAt ?? []), nowIso].filter(
    (shownAt) => {
      const shownTime = Date.parse(shownAt);
      return Number.isFinite(shownTime) && Date.now() - shownTime < 30 * DAY_MS;
    }
  );

  const seasonalShownKeys = new Set(state.seasonalShownKeys ?? []);
  if (offer.campaignKey) {
    seasonalShownKeys.add(offer.campaignKey);
  }

  await AsyncStorage.setItem(
    PASSIVE_OFFER_STATE_KEY,
    JSON.stringify({
      lastShownAt: nowIso,
      recentShownAt,
      seasonalShownKeys: [...seasonalShownKeys]
    } satisfies PassiveOfferState)
  );
}

export function getActiveSeasonalPremiumCampaign(
  now = new Date()
): PassivePremiumOffer | null {
  const today = toDateOnly(now);
  const year = today.getUTCFullYear();
  const mothersDay = getSecondSundayOfMay(year);
  const blackFriday = getBlackFriday(year);
  const newYearCampaignYear =
    today.getUTCMonth() === 11 ? year + 1 : year;

  if (isInRange(today, addDays(mothersDay, -3), addDays(mothersDay, 1))) {
    return {
      campaignKey: `mothers_day_${year}`,
      cta: "Premium paketlerini gör",
      kind: "seasonal",
      message:
        "Bugün kendine küçük bir alan aç. Premium özellikleri ve güncel abonelik seçeneklerini incele.",
      title: "Anneler Günü'nde Anne+ Premium"
    };
  }

  if (isInRange(today, addDays(blackFriday, -2), addDays(blackFriday, 2))) {
    return {
      campaignKey: `black_friday_${year}`,
      cta: "Premium paketlerini gör",
      kind: "seasonal",
      message:
        "Premium araçları, forumu ve anı galerisini güncel paket seçenekleriyle keşfet.",
      title: "Anne+ Premium'u keşfet"
    };
  }

  if (
    isInRange(
      today,
      new Date(Date.UTC(newYearCampaignYear - 1, 11, 28)),
      new Date(Date.UTC(newYearCampaignYear, 0, 2))
    )
  ) {
    return {
      campaignKey: `new_year_${newYearCampaignYear}`,
      cta: "Premium paketlerini gör",
      kind: "seasonal",
      message:
        "Yeni yılda bebeğinle daha yakın bir takip alanı kur. Premium özellikleri ve güncel paketleri incele.",
      title: "Yeni yılda Anne+ Premium"
    };
  }

  return null;
}

async function readPassiveOfferState(): Promise<PassiveOfferState> {
  try {
    const raw = await AsyncStorage.getItem(PASSIVE_OFFER_STATE_KEY);
    return raw ? (JSON.parse(raw) as PassiveOfferState) : {};
  } catch {
    return {};
  }
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
    Date.UTC(year, 10, 1 + firstThursdayOffset + 21)
  );
  return addDays(thanksgiving, 1);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function isInRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function toDateOnly(date: Date) {
  const turkeyParts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric"
  }).formatToParts(date);
  const values = Object.fromEntries(
    turkeyParts.map((part) => [part.type, part.value])
  );

  return new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day))
  );
}
