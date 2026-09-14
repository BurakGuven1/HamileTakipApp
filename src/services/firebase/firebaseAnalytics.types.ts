export type FirebaseSignUpMethod = "email";

/**
 * Google Ads can only bid towards a goal it receives. `first_open` arrives for
 * free once Firebase is linked to Google Ads, but every downstream conversion
 * has to be logged explicitly with the reserved event names Google Ads knows
 * how to import.
 */
export type FirebaseAnalyticsEventMap = {
  sign_up: {
    method: FirebaseSignUpMethod;
  };
  begin_checkout: {
    value: number;
    currency: string;
  };
  purchase: {
    value: number;
    currency: string;
    transaction_id: string;
  };
};

export type FirebaseConsentState = {
  /** True once the user accepted the iOS App Tracking Transparency prompt. */
  trackingGranted: boolean;
};
