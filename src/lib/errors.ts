const friendlyErrorMap: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "E-posta veya şifre hatalı."],
  [/password/i, "Şifre en az 8 karakter olmalı."],
  [/email/i, "Geçerli bir e-posta adresi gir."],
  [/auth session is required|oturum/i, "Bu işlem için tekrar giriş yapmalısın."],
  [/network|fetch|failed to fetch/i, "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene."],
  [/permission|izin/i, "Bu işlem için gerekli izin verilmemiş."],
  [/duplicate|unique|already exists/i, "Bu kayıt zaten var."],
  [/storage|bucket/i, "Dosya işlemi tamamlanamadı. Biraz sonra tekrar dene."],
  [/row-level security|rls/i, "Bu işlem için yetkin yok."],
  [/cancel/i, "İşlem iptal edildi."]
];

export function getErrorMessage(error: unknown, fallback = "Bir şey yolunda gitmedi.") {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message)
          : fallback;

  for (const [pattern, message] of friendlyErrorMap) {
    if (pattern.test(raw)) {
      return message;
    }
  }

  return raw || fallback;
}
