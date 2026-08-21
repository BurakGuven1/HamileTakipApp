import {
  normalizeRevenueCatEnvironment,
  type RevenueCatEnvironment,
  type RevenueCatSubscriptionStatus
} from "./revenuecatSubscription.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RevenueCatWebhookEvent = Record<string, unknown> & {
  aliases?: unknown;
  app_user_id?: unknown;
  environment?: unknown;
  event_timestamp_ms?: unknown;
  expiration_at_ms?: unknown;
  original_app_user_id?: unknown;
  product_id?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
  type?: unknown;
};

export type WebhookSubscriptionWrite = {
  environment: RevenueCatEnvironment;
  eventAt: string;
  expiresAt: string | null;
  isLifetime: boolean;
  productId: string;
  status: RevenueCatSubscriptionStatus;
  userId: string;
  verifiedAt: null;
};

export function buildWebhookSubscriptionWrite(
  event: RevenueCatWebhookEvent,
  userId: string
): WebhookSubscriptionWrite | null {
  const eventType = stringValue(event.type);
  const productId = stringValue(event.product_id);
  const eventTimestampMs = numberValue(event.event_timestamp_ms);
  const expirationAtMs = numberValue(event.expiration_at_ms);
  if (!eventType || !productId || eventTimestampMs === null) return null;

  const status = mapEventTypeToStatus(eventType, expirationAtMs);
  if (!status) return null;

  return {
    environment: normalizeRevenueCatEnvironment(event.environment),
    eventAt: new Date(eventTimestampMs).toISOString(),
    expiresAt: expirationAtMs === null
      ? null
      : new Date(expirationAtMs).toISOString(),
    isLifetime: false,
    productId,
    status,
    userId,
    verifiedAt: null
  };
}

export function mapEventTypeToStatus(
  eventType: string,
  expirationAtMs: number | null
): RevenueCatSubscriptionStatus | null {
  const expiresInFuture =
    expirationAtMs !== null && expirationAtMs > Date.now();

  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE":
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED":
    case "REFUND_REVERSED":
      return "active";
    case "CANCELLATION":
      return expiresInFuture ? "active" : "cancelled";
    case "EXPIRATION":
    case "REFUND":
      return "expired";
    case "BILLING_ISSUE":
      return "grace_period";
    default:
      return null;
  }
}

export function getTransferUserIds(event: RevenueCatWebhookEvent) {
  const candidates = [
    ...stringArray(event.transferred_from),
    ...stringArray(event.transferred_to)
  ];
  return [...new Set(candidates.filter((value) => UUID_PATTERN.test(value)))];
}

export function getWebhookIdentityCandidates(event: RevenueCatWebhookEvent) {
  return [...new Set([
    stringValue(event.app_user_id),
    stringValue(event.original_app_user_id),
    ...stringArray(event.aliases),
    ...stringArray(event.transferred_to)
  ].filter((value): value is string => Boolean(value && UUID_PATTERN.test(value))))];
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
