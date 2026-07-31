const friendlyErrorMap: Array<[RegExp, string]> = [
  [
    /invalid login credentials|invalid_credentials/i,
    "E-posta veya şifre hatalı."
  ],
  [
    /email not confirmed|email_not_confirmed/i,
    "Giriş yapmadan önce e-postandaki onay bağlantısına dokun."
  ],
  [
    /email address not authorized|email_address_not_authorized|error sending confirmation email/i,
    "Onay e-postası şu anda gönderilemiyor. Biraz sonra tekrar dene."
  ],
  [
    /over_email_send_rate_limit|email rate limit|rate limit.*email/i,
    "Çok fazla e-posta isteği gönderildi. Birkaç dakika sonra tekrar dene."
  ],
  [
    /invalid email|email address.*invalid|email_address_invalid|unable to validate email/i,
    "Geçerli bir e-posta adresi gir."
  ],
  [
    /weak_password|password should be at least|password.*(?:characters|length)/i,
    "Şifre en az 8 karakter olmalı."
  ],
  [
    /user already registered|user_already_exists/i,
    "Bu e-posta ile zaten bir hesap var."
  ],
  [
    /database error saving new user|unexpected_failure/i,
    "Hesap şu anda oluşturulamadı. Biraz sonra tekrar dene."
  ],
  [/auth session is required|oturum/i, "Bu işlem için tekrar giriş yapmalısın."],
  [/network|fetch|failed to fetch/i, "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene."],
  [/permission|izin/i, "Bu işlem için gerekli izin verilmemiş."],
  [/duplicate|unique|already exists/i, "Bu kayıt zaten var."],
  [/storage|bucket/i, "Dosya işlemi tamamlanamadı. Biraz sonra tekrar dene."],
  [/row-level security|rls/i, "Bu işlem için yetkin yok."],
  [/cancel/i, "İşlem iptal edildi."]
];

export function getErrorMessage(error: unknown, fallback = "Bir şey yolunda gitmedi.") {
  const revenueCatMessage = getRevenueCatErrorMessage(error);
  if (revenueCatMessage) {
    return revenueCatMessage;
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message)
          : fallback;

  const code = getErrorCode(error);
  const searchableError = `${code} ${raw}`.trim();

  for (const [pattern, message] of friendlyErrorMap) {
    if (pattern.test(searchableError)) {
      return message;
    }
  }

  return raw || fallback;
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }

  return String((error as { code?: unknown }).code ?? "");
}

function getRevenueCatErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const errorObject = error as Record<string, unknown>;
  const userInfo =
    typeof errorObject.userInfo === "object" && errorObject.userInfo !== null
      ? (errorObject.userInfo as Record<string, unknown>)
      : {};
  const code = String(errorObject.code ?? "");
  const readableCode = String(
    errorObject.readableErrorCode ??
      userInfo.readableErrorCode ??
      userInfo.readable_error_code ??
      ""
  );
  const name = String(errorObject.name ?? "");

  if (
    code === "23" ||
    readableCode === "CONFIGURATION_ERROR" ||
    name === "RevenueCatConfigurationError"
  ) {
    return "Abonelik seçenekleri App Store'dan alınamadı. Bağlantını kontrol edip biraz sonra yeniden dene.";
  }

  if (code === "2" || readableCode === "STORE_PROBLEM_ERROR") {
    return "App Store'a şu anda ulaşılamıyor. Biraz sonra yeniden dene.";
  }

  if (code === "3" || readableCode === "PURCHASE_NOT_ALLOWED_ERROR") {
    return "Bu cihazda uygulama içi satın almalara izin verilmiyor.";
  }

  if (
    code === "5" ||
    readableCode === "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR"
  ) {
    return "Seçtiğin abonelik App Store'da şu anda kullanılamıyor. Biraz sonra yeniden dene.";
  }

  if (
    code === "10" ||
    code === "35" ||
    readableCode === "NETWORK_ERROR" ||
    readableCode === "OFFLINE_CONNECTION_ERROR"
  ) {
    return "App Store'a bağlanılamadı. İnternetini kontrol edip tekrar dene.";
  }

  if (
    code === "15" ||
    readableCode === "OPERATION_ALREADY_IN_PROGRESS_ERROR"
  ) {
    return "Satın alma işlemi zaten devam ediyor. Lütfen Apple ekranını tamamla.";
  }

  return null;
}
