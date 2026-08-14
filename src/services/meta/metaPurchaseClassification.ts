export type MetaPurchaseClassificationInput = {
  currencyCode: string | null;
  entitlementProductIdentifier: string;
  hasActiveEntitlement: boolean;
  introPrice: number | null;
  isSubscriptionProduct: boolean;
  periodType: string;
  productPrice: number | null;
  transactionProductIdentifier: string;
};

export type MetaPurchaseClassification = {
  currencyCode: string | null;
  purchaseValue: number | null;
  shouldLogStartTrial: boolean;
  shouldLogSubscribe: boolean;
};

export function classifyMetaPurchase(
  input: MetaPurchaseClassificationInput
): MetaPurchaseClassification {
  const matchesActiveEntitlement =
    input.hasActiveEntitlement &&
    input.entitlementProductIdentifier === input.transactionProductIdentifier;

  if (!matchesActiveEntitlement) {
    return emptyClassification();
  }

  const normalizedPeriodType = input.periodType.trim().toUpperCase();
  const isFreeTrial =
    input.isSubscriptionProduct && normalizedPeriodType === "TRIAL";
  const currencyCode = normalizeCurrencyCode(input.currencyCode);
  const chargedValue =
    normalizedPeriodType === "INTRO"
      ? getPositivePrice(input.introPrice) ?? getPositivePrice(input.productPrice)
      : getPositivePrice(input.productPrice);

  return {
    currencyCode: isFreeTrial ? null : currencyCode,
    purchaseValue: isFreeTrial ? null : chargedValue,
    shouldLogStartTrial: isFreeTrial,
    shouldLogSubscribe: input.isSubscriptionProduct
  };
}

function emptyClassification(): MetaPurchaseClassification {
  return {
    currencyCode: null,
    purchaseValue: null,
    shouldLogStartTrial: false,
    shouldLogSubscribe: false
  };
}

function getPositivePrice(value: number | null) {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeCurrencyCode(value: string | null) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}
