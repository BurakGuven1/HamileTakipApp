export type VerifiedSubscriptionEnvironment =
  | "PRODUCTION"
  | "SANDBOX"
  | "UNKNOWN";

export type VerifiedSubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "grace_period"
  | "none";

export type VerifiedSubscriptionAccess = {
  environment: VerifiedSubscriptionEnvironment;
  expiresAt: string | null;
  isPremium: boolean;
  productId: string | null;
  repaired: boolean;
  status: VerifiedSubscriptionStatus;
};

const environments = new Set<VerifiedSubscriptionEnvironment>([
  "PRODUCTION",
  "SANDBOX",
  "UNKNOWN"
]);
const statuses = new Set<VerifiedSubscriptionStatus>([
  "active",
  "cancelled",
  "expired",
  "grace_period",
  "none"
]);

export function parseVerifiedSubscriptionAccess(
  value: unknown
): VerifiedSubscriptionAccess {
  const row = asRecord(value);
  const environment = row?.environment;
  const status = row?.status;
  const expiresAt = row?.expires_at;
  const productId = row?.product_id;

  if (
    !row
    || typeof environment !== "string"
    || !environments.has(environment as VerifiedSubscriptionEnvironment)
    || typeof status !== "string"
    || !statuses.has(status as VerifiedSubscriptionStatus)
    || typeof row.is_premium !== "boolean"
    || typeof row.repaired !== "boolean"
    || (expiresAt !== null && typeof expiresAt !== "string")
    || (productId !== null && typeof productId !== "string")
  ) {
    throw new Error("Abonelik doğrulama yanıtı okunamadı.");
  }

  return {
    environment: environment as VerifiedSubscriptionEnvironment,
    expiresAt,
    isPremium: row.is_premium,
    productId,
    repaired: row.repaired,
    status: status as VerifiedSubscriptionStatus
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
