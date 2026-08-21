export type RevenueCatEnvironment = "PRODUCTION" | "SANDBOX" | "UNKNOWN";
export type RevenueCatSubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "grace_period";

export type NormalizedRevenueCatSubscription = {
  environment: RevenueCatEnvironment;
  expiresAt: string | null;
  isLifetime: boolean;
  productId: string;
  status: RevenueCatSubscriptionStatus;
};

type UnknownRecord = Record<string, unknown>;

export function normalizeRevenueCatEnvironment(
  value: unknown
): RevenueCatEnvironment {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  if (normalized === "PRODUCTION" || normalized === "SANDBOX") {
    return normalized;
  }
  return "UNKNOWN";
}

export function normalizeRevenueCatSubscriber(
  payload: unknown,
  entitlementId: string,
  now = new Date()
): NormalizedRevenueCatSubscription | null {
  const subscriber = asRecord(asRecord(payload)?.subscriber);
  const entitlements = asRecord(subscriber?.entitlements);
  const entitlement = asRecord(entitlements?.[entitlementId]);
  const productId = stringValue(entitlement?.product_identifier);
  if (!productId) return null;

  const subscriptions = asRecord(subscriber?.subscriptions);
  const subscription = asRecord(subscriptions?.[productId]);
  if (!subscription) return null;

  const expirationValue = stringValue(subscription.expires_date);
  const graceExpirationValue = stringValue(
    subscription.grace_period_expires_date
  );
  const expirationDate = dateValue(expirationValue);
  const graceExpirationDate = dateValue(graceExpirationValue);
  const refundedAt = dateValue(subscription.refunded_at);
  const isLifetime = expirationDate === null;
  const expirationTime = expirationDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const graceExpirationTime = graceExpirationDate?.getTime() ?? 0;
  const nowTime = now.getTime();

  let status: RevenueCatSubscriptionStatus;
  let effectiveExpiresAt = expirationValue;
  if (refundedAt) {
    status = "expired";
  } else if (graceExpirationTime > nowTime && expirationTime <= nowTime) {
    status = "grace_period";
    effectiveExpiresAt = graceExpirationValue ?? effectiveExpiresAt;
  } else if (isLifetime || expirationTime > nowTime) {
    status = "active";
  } else {
    status = "expired";
  }

  return {
    environment: normalizeRevenueCatEnvironment(
      typeof subscription.is_sandbox === "boolean"
        ? subscription.is_sandbox
          ? "SANDBOX"
          : "PRODUCTION"
        : null
    ),
    expiresAt: effectiveExpiresAt,
    isLifetime,
    productId,
    status
  };
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function dateValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
