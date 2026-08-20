export function formatOfferingLabel(offeringId: string): string {
  if (offeringId === "unknown") {
    return "Bilinmeyen (eski kayıtta RevenueCat offering kimliği yok)";
  }

  return offeringId;
}

export function describeMissingOfferingEvents(count: number): string {
  if (count === 0) {
    return "Seçili dönemde tüm paywall gösterimlerinin RevenueCat offering kimliği kaydedildi.";
  }

  return `${count} paywall gösteriminde RevenueCat offering kimliği alınamadı; bu kayıtlar offering karşılaştırmasına dahil edilemez.`;
}
