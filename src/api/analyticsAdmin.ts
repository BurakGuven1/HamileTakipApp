import { supabase } from "@/lib/supabase";

export type AnalyticsRangeDays = 7 | 30 | 90;

export type AnalyticsOverview = {
  active_subscribers: number;
  accounts: number;
  activated: number;
  first_opens: number;
  median_hours_to_purchase: number | null;
  onboarding_completed: number;
  paywall_conversion_7d: number;
  paywall_viewers: number;
  verified_customers: number;
};

export type FunnelStep = {
  step_key: string;
  step_order: number;
  users: number;
};

export type PaywallSourcePerformance = {
  conversion_rate: number;
  impressions: number;
  source: string;
  unique_viewers: number;
  verified_conversions: number;
};

export type OfferingPerformance = {
  impressions: number;
  offering_id: string;
  purchase_starts: number;
  verified_purchases: number;
};

export type SubscriptionHealth = {
  customers: number;
  event_type: string;
  events: number;
  gross_revenue: number;
};

export type AnalyticsTimeseriesPoint = {
  active_users: number;
  metric_date: string;
  paywall_viewers: number;
  verified_purchases: number;
};

export type RetentionCohort = {
  cohort_date: string;
  cohort_users: number;
  d1_users: number | null;
  d7_users: number | null;
  d30_users: number | null;
};

export type AnalyticsDataQuality = {
  client_completions: number;
  legacy_paywall_fallbacks: number;
  missing_offering: number;
  missing_paywall_source: number;
  sandbox_webhooks: number;
  subscription_cache_fallbacks: number;
  verified_purchases: number;
};

export type AnalyticsDashboardData = {
  dataQuality: AnalyticsDataQuality;
  from: string;
  funnel: FunnelStep[];
  offerings: OfferingPerformance[];
  overview: AnalyticsOverview;
  paywallSources: PaywallSourcePerformance[];
  retention: RetentionCohort[];
  subscriptionHealth: SubscriptionHealth[];
  timeseries: AnalyticsTimeseriesPoint[];
  to: string;
};

export async function isAnalyticsAdmin() {
  const { data, error } = await supabase.rpc("is_analytics_admin");
  if (error) throw error;
  return Boolean(data);
}

export async function loadAnalyticsDashboard(
  days: AnalyticsRangeDays
): Promise<AnalyticsDashboardData> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const args = { p_from: from.toISOString(), p_to: to.toISOString() };

  const [
    overview,
    funnel,
    paywallSources,
    offerings,
    subscriptionHealth,
    timeseries,
    retention,
    dataQuality
  ] = await Promise.all([
    supabase.rpc("get_analytics_overview", args),
    supabase.rpc("get_analytics_funnel", args),
    supabase.rpc("get_paywall_source_performance", args),
    supabase.rpc("get_offering_performance", args),
    supabase.rpc("get_subscription_health", args),
    supabase.rpc("get_analytics_timeseries", args),
    supabase.rpc("get_analytics_retention", args),
    supabase.rpc("get_analytics_data_quality", args)
  ]);

  const firstError = [
    overview.error,
    funnel.error,
    paywallSources.error,
    offerings.error,
    subscriptionHealth.error,
    timeseries.error,
    retention.error,
    dataQuality.error
  ].find(Boolean);

  if (firstError) throw firstError;

  return {
    dataQuality: normalizeDataQuality(dataQuality.data),
    from: args.p_from,
    funnel: funnel.data ?? [],
    offerings: offerings.data ?? [],
    overview: normalizeOverview(overview.data),
    paywallSources: paywallSources.data ?? [],
    retention: retention.data ?? [],
    subscriptionHealth: subscriptionHealth.data ?? [],
    timeseries: timeseries.data ?? [],
    to: args.p_to
  };
}

function normalizeOverview(value: unknown): AnalyticsOverview {
  const row = isRecord(value) ? value : {};
  return {
    active_subscribers: toNumber(row.active_subscribers),
    accounts: toNumber(row.accounts),
    activated: toNumber(row.activated),
    first_opens: toNumber(row.first_opens),
    median_hours_to_purchase:
      row.median_hours_to_purchase === null
        ? null
        : toNumber(row.median_hours_to_purchase),
    onboarding_completed: toNumber(row.onboarding_completed),
    paywall_conversion_7d: toNumber(row.paywall_conversion_7d),
    paywall_viewers: toNumber(row.paywall_viewers),
    verified_customers: toNumber(row.verified_customers)
  };
}

function normalizeDataQuality(value: unknown): AnalyticsDataQuality {
  const row = isRecord(value) ? value : {};
  return {
    client_completions: toNumber(row.client_completions),
    legacy_paywall_fallbacks: toNumber(row.legacy_paywall_fallbacks),
    missing_offering: toNumber(row.missing_offering),
    missing_paywall_source: toNumber(row.missing_paywall_source),
    sandbox_webhooks: toNumber(row.sandbox_webhooks),
    subscription_cache_fallbacks: toNumber(row.subscription_cache_fallbacks),
    verified_purchases: toNumber(row.verified_purchases)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
