export type FirebaseSignUpMethod = "email";

export type FirebaseAnalyticsEventMap = {
  sign_up: {
    method: FirebaseSignUpMethod;
  };
};
