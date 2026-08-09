export {
  createAnalyticsEventId,
  flushAnalyticsEvents,
  getAnalyticsContext,
  initializeAnalytics,
  linkAnalyticsIdentity,
  trackProductEvent as trackEvent,
  trackSessionStartedIfNeeded,
  type AnalyticsEventName,
  type AnalyticsEventOptions,
  type AnalyticsProperties
} from "@/services/analytics/productAnalytics";
