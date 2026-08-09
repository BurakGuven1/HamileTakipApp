import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { Baby } from "@/api/babies";
import type { CareJournalEntry } from "@/api/careJournal";
import type { MilkContainer, MilkStorageEvent } from "@/features/care-journal/milkInventory";
import { trackEvent } from "@/lib/analytics";

export type ReportPeriod = 1 | 7 | 30;

export async function shareCareJournalReport(baby: Baby, entries: CareJournalEntry[], days: ReportPeriod) {
  const html = buildReportHtml(baby, entries, days);
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) throw new Error("Bu cihazda paylaşım kullanılamıyor.");
  await Sharing.shareAsync(uri, { dialogTitle: `${baby.name} doktor bakım özeti`, mimeType: "application/pdf", UTI: ".pdf" });
  await trackEvent("care_journal_report_shared", { days });
}

export async function shareCareJournalArchive(
  baby: Baby,
  entries: CareJournalEntry[],
  containers: MilkContainer[] = [],
  milkEvents: MilkStorageEvent[] = []
) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Bu cihazda paylaşım kullanılamıyor.");
  const safeName = baby.name.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_-]/g, "-");
  const file = new File(Paths.document, `AnnePlus-${safeName}-kalici-arsiv-${new Date().toISOString().slice(0, 10)}.json`);
  file.write(JSON.stringify({
    archive_version: 1,
    exported_at: new Date().toISOString(),
    baby: { id: baby.id, name: baby.name, birth_date: baby.birth_date },
    care_entries: entries,
    milk_containers: containers,
    milk_events: milkEvents
  }, null, 2));
  await Sharing.shareAsync(file.uri, { dialogTitle: `${baby.name} kalıcı bakım arşivi`, mimeType: "application/json", UTI: "public.json" });
  await trackEvent("care_journal_archive_shared", { entries: entries.length });
}

function buildReportHtml(baby: Baby, entries: CareJournalEntry[], days: ReportPeriod) {
  const byType = (type: CareJournalEntry["entry_type"]) => entries.filter((entry) => entry.entry_type === type);
  const durationMinutes = (entry: CareJournalEntry) => {
    if (!entry.ended_at) return 0;
    const endedAt = Date.parse(entry.ended_at);
    const occurredAt = Date.parse(entry.occurred_at);
    return Number.isFinite(endedAt) && Number.isFinite(occurredAt)
      ? Math.max(0, Math.round((endedAt - occurredAt) / 60_000))
      : 0;
  };
  const sleep = byType("sleep");
  const breastfeeding = byType("breastfeeding");
  const bottles = byType("bottle");
  const pumping = byType("pumping");
  const diapers = byType("diaper");
  const medicine = byType("medicine");
  const temperatures = byType("temperature").filter((entry) => Number.isFinite(Number(entry.temperature_c)));
  const totalSleepMinutes = sleep.reduce((sum, entry) => sum + durationMinutes(entry), 0);
  const bottleMl = bottles.reduce((sum, entry) => sum + (entry.amount_ml ?? 0), 0);
  const pumpingMl = pumping.reduce((sum, entry) => sum + (entry.amount_ml ?? 0), 0);
  const pumpingLeftMl = pumping.filter((entry) => entry.breast_side === "left").reduce((sum, entry) => sum + (entry.amount_ml ?? 0), 0);
  const pumpingRightMl = pumping.filter((entry) => entry.breast_side === "right").reduce((sum, entry) => sum + (entry.amount_ml ?? 0), 0);
  const temperatureValues = temperatures.map((entry) => Number(entry.temperature_c));
  const periodLabel = days === 1 ? "Son 24 saat" : `Son ${days} gün`;
  const rows = entries.map((entry) => `<tr><td>${escapeHtml(formatReportDate(entry.occurred_at))}</td><td>${label(entry.entry_type)}</td><td>${escapeHtml(detail(entry, durationMinutes(entry)))}</td><td>${escapeHtml(entry.caregiver_name || "—")}</td></tr>`).join("");
  const medicineRows = medicine.map((entry) => `<tr><td>${escapeHtml(formatReportDate(entry.occurred_at))}</td><td>${escapeHtml(entry.medicine_name || "—")}</td><td>${escapeHtml(entry.medicine_dose || "—")}</td><td>${escapeHtml(entry.caregiver_name || "—")}</td></tr>`).join("");
  const pumpingRows = pumping.map((entry) => `<tr><td>${escapeHtml(formatReportDate(entry.occurred_at))}</td><td>${escapeHtml(formatBreastSide(entry.breast_side))}</td><td>${escapeHtml(formatMinutesOrDash(durationMinutes(entry)))}</td><td>${escapeHtml(formatMlOrDash(entry.amount_ml))}</td><td>${escapeHtml(entry.caregiver_name || "—")}</td></tr>`).join("");

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
  @page{margin:22px}body{font-family:-apple-system,BlinkMacSystemFont,Arial;color:#372f3d;font-size:12px}h1{color:#557764;margin-bottom:4px}h2{margin:24px 0 8px;color:#372f3d}.muted{color:#6f6673}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.box{border:1px solid #ded9df;border-radius:10px;padding:11px}.value{font-size:18px;font-weight:700;margin-top:4px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #ece8ed;padding:7px 5px;vertical-align:top}th{color:#557764}.note{border-top:1px solid #ddd;padding-top:12px;color:#6f6673;font-size:10px;margin-top:24px}</style></head><body>
  <h1>${escapeHtml(baby.name)} · Doktor için bakım özeti</h1><p class="muted">${periodLabel} · Oluşturulma: ${new Date().toLocaleString("tr-TR")}</p>
  <div class="grid">
    <div class="box"><b>Beslenme</b><div class="value">${breastfeeding.length + bottles.length}</div><span>${Math.round(bottleMl)} ml biberon · ${breastfeeding.reduce((s,e)=>s+durationMinutes(e),0)} dk emzirme</span></div>
    <div class="box"><b>Uyku</b><div class="value">${formatMinutes(totalSleepMinutes)}</div><span>${sleep.length} kayıt · ort. ${sleep.length ? formatMinutes(Math.round(totalSleepMinutes / sleep.length)) : "—"}</span></div>
    <div class="box"><b>Bez</b><div class="value">${diapers.length}</div><span>${diapers.filter(e=>e.diaper_type==="wet"||e.diaper_type==="both").length} ıslak · ${diapers.filter(e=>e.diaper_type==="dirty"||e.diaper_type==="both").length} kaka</span></div>
    <div class="box"><b>Sağım</b><div class="value">${Math.round(pumpingMl)} ml</div><span>${pumping.length} kayıt · ${pumping.reduce((s,e)=>s+durationMinutes(e),0)} dk · sol ${Math.round(pumpingLeftMl)} ml · sağ ${Math.round(pumpingRightMl)} ml</span></div>
    <div class="box"><b>İlaç / vitamin</b><div class="value">${medicine.length}</div><span>Doz ve veren kişi aşağıda</span></div>
    <div class="box"><b>Ateş ölçümü</b><div class="value">${temperatureValues.length ? `${temperatureValues[0]?.toFixed(1)} °C` : "—"}</div><span>${temperatureValues.length ? `aralık ${Math.min(...temperatureValues).toFixed(1)}–${Math.max(...temperatureValues).toFixed(1)} °C` : "kayıt yok"}</span></div>
  </div>
  ${medicine.length ? `<h2>İlaç ve vitamin kayıtları</h2><table><thead><tr><th>Zaman</th><th>Ad</th><th>Doz</th><th>Veren</th></tr></thead><tbody>${medicineRows}</tbody></table>` : ""}
  ${pumping.length ? `<h2>Sağım ayrıntıları</h2><table><thead><tr><th>Başlangıç</th><th>Taraf</th><th>Süre</th><th>Miktar</th><th>Kaydeden</th></tr></thead><tbody>${pumpingRows}</tbody></table>` : ""}
  <h2>Tam zaman akışı (${entries.length} kayıt)</h2><table><thead><tr><th>Zaman</th><th>Tür</th><th>Detay</th><th>Kaydeden</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="note">Bu belge ebeveyn/bakıcı tarafından girilen kayıtların düzenlenmiş özetidir; tıbbi değerlendirme, tanı veya tedavi önerisi değildir. Acil ya da ciddi bir endişede sağlık profesyoneline başvurun.</p>
  </body></html>`;
}

function label(type: CareJournalEntry["entry_type"]) { return ({ breastfeeding: "Emzirme", bottle: "Biberon", sleep: "Uyku", diaper: "Bez", pumping: "Sağım", medicine: "İlaç/vitamin", solid_food: "Ek gıda", temperature: "Ateş" })[type]; }
function detail(entry: CareJournalEntry, minutes: number) {
  const values = [
    entry.amount_ml ? `${entry.amount_ml} ml` : null,
    entry.breast_side ? ({ left: "sol", right: "sağ", both: "iki taraf" })[entry.breast_side] : null,
    minutes ? `${minutes} dk` : null,
    entry.diaper_type ? ({ wet: "ıslak", dirty: "kaka", both: "ıslak + kaka" })[entry.diaper_type] : null,
    entry.medicine_name, entry.medicine_dose, entry.food_name, entry.food_amount,
    Number.isFinite(Number(entry.temperature_c)) ? `${Number(entry.temperature_c).toFixed(1)} °C` : null,
    entry.notes
  ];
  return values.filter(Boolean).join(" · ") || "—";
}
function formatBreastSide(value: CareJournalEntry["breast_side"]) { return value ? ({ left: "Sol meme", right: "Sağ meme", both: "İki taraf" })[value] : "—"; }
function formatMinutesOrDash(value: number) { return value > 0 ? `${value} dk` : "—"; }
function formatMlOrDash(value: number | null) { return typeof value === "number" && value > 0 ? `${value} ml` : "—"; }
function formatMinutes(value: number) { return value < 60 ? `${value} dk` : `${Math.floor(value / 60)} sa ${value % 60} dk`; }
function formatReportDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString("tr-TR") : "Zaman bilinmiyor"; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] as string); }
