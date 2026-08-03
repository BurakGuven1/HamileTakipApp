import { File } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type {
  BabyDoctorVisitSnapshot,
  DoctorVisitItem,
  DoctorVisitSnapshot,
  PostpartumMotherDoctorVisitSnapshot,
  PregnancyDoctorVisitSnapshot
} from "@/api/doctorVisit";

export type DoctorVisitReportOptions = {
  includePumping: boolean;
};

export async function isDoctorVisitSharingAvailable() {
  return Sharing.isAvailableAsync();
}

export async function createDoctorVisitPdf(
  snapshot: DoctorVisitSnapshot,
  options: DoctorVisitReportOptions
) {
  const html = buildDoctorVisitReportHtml(snapshot, options);
  const result = await Print.printToFileAsync({ html });
  if (!result.uri) throw new Error("PDF dosyası oluşturulamadı.");
  return result.uri;
}

export async function shareAndCleanupDoctorVisitPdf(
  uri: string,
  snapshot: DoctorVisitSnapshot
) {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Bu cihazda paylaşım kullanılamıyor.");
    }

    await Sharing.shareAsync(uri, {
      dialogTitle: `${getReportSubjectName(snapshot)} · doktor görüşmesi özeti`,
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf"
    });
  } finally {
    cleanupDoctorVisitPdf(uri);
  }
}

export function cleanupDoctorVisitPdf(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A temporary PDF should never block the visit flow if the OS already removed it.
  }
}

export function buildDoctorVisitReportHtml(
  snapshot: DoctorVisitSnapshot,
  options: DoctorVisitReportOptions
) {
  const subjectName = getReportSubjectName(snapshot);
  const subjectLabel = getSubjectLabel(snapshot);
  const body = snapshot.subject === "pregnancy"
    ? buildPregnancyBody(snapshot)
    : snapshot.subject === "baby"
      ? buildBabyBody(snapshot)
      : buildPostpartumMotherBody(snapshot, options);

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { margin: 24px 26px 30px; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #372F3D; background: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 11px; line-height: 1.45; }
        h1 { margin: 8px 0 4px; font-size: 24px; line-height: 1.15; color: #372F3D; }
        h2 { margin: 0; font-size: 15px; color: #372F3D; }
        p { margin: 0; }
        .eyebrow { color: #A94F60; font-size: 9px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
        .meta { color: #6F6673; margin-top: 5px; }
        .thread { width: 44px; height: 3px; margin: 15px 0 18px; border-radius: 99px; background: #3F6F59; }
        .context { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
        .context-card { min-height: 62px; padding: 10px 11px; border: 1px solid #E8DFDA; border-radius: 13px 13px 13px 4px; background: #FFFCF8; }
        .context-label { color: #6F6673; font-size: 9px; margin-bottom: 4px; }
        .context-value { font-size: 13px; font-weight: 750; }
        .section { margin-top: 16px; page-break-inside: avoid; }
        .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 7px; border-bottom: 2px solid #E9F0EB; }
        .source { color: #6F6673; font-size: 9px; }
        .empty { margin-top: 8px; padding: 11px; border: 1px dashed #D9CFCA; border-radius: 10px; color: #6F6673; background: #FFFCF8; }
        .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 9px; }
        .fact { padding: 9px; border-radius: 10px; background: #F5EFEB; }
        .fact-label { display: block; color: #6F6673; font-size: 9px; }
        .fact-value { display: block; margin-top: 2px; font-size: 14px; font-weight: 750; }
        table { width: 100%; margin-top: 8px; border-collapse: collapse; page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        th, td { padding: 6px 5px; border-bottom: 1px solid #ECE5E1; text-align: left; vertical-align: top; }
        th { color: #3F6F59; font-size: 9px; font-weight: 800; }
        td { overflow-wrap: anywhere; }
        .pill { display: inline-block; padding: 2px 7px; border-radius: 99px; color: #844153; background: #F7E7EA; font-size: 9px; font-weight: 700; }
        .note { margin-top: 18px; padding: 11px 12px; border-left: 3px solid #C8913A; color: #5F5663; background: #FFF8E8; }
        .footer { margin-top: 12px; color: #807681; font-size: 9px; }
      </style>
    </head>
    <body>
      <div class="eyebrow">Anne+ · görüşmeye hazırlık</div>
      <h1>${escapeHtml(subjectName)}</h1>
      <p class="meta">${escapeHtml(subjectLabel)} · ${formatDate(snapshot.period.start_date)}–${formatDate(snapshot.period.end_date)} · ${snapshot.period.days} günlük gerçek kayıt dönemi</p>
      <p class="meta">PDF oluşturulma zamanı: ${formatDateTime(snapshot.generated_at)}</p>
      <div class="thread"></div>
      <div class="context">
        <div class="context-card"><div class="context-label">Görüşme konusu</div><div class="context-value">${escapeHtml(subjectLabel)}</div></div>
        <div class="context-card"><div class="context-label">Kayıt dönemi</div><div class="context-value">${snapshot.period.days} gün</div></div>
        <div class="context-card"><div class="context-label">Hazırlanan maddeler</div><div class="context-value">${snapshot.items.length}</div></div>
      </div>
      ${buildPreparedItems(snapshot.items)}
      ${body}
      <div class="note"><strong>Önemli:</strong> Bu belge kullanıcı ve aile tarafından girilen kayıtların düzenlenmiş özetidir. Tanı, ölçüm yorumu, büyüme persentili veya tedavi önerisi içermez. Sağlık kararları için doktorunuza başvurun.</div>
      <p class="footer">Kayıt olmayan bağımsız alanlar “Kayıt girilmedi” olarak gösterilir. Günlük bakım özetindeki 0, o gün ilgili türde olay kaydı bulunmadığını; sayaç satırındaki 0 ise kayıtlı sayaç değerini ifade eder.</p>
    </body>
  </html>`;
}

function buildPreparedItems(items: DoctorVisitItem[]) {
  const rows = items.map((item) => {
    const started = item.started_at ? formatDateTime(item.started_at) : "—";
    const severity = item.item_type === "symptom" && item.severity != null
      ? `${item.severity}/5 (kullanıcı değerlendirmesi)`
      : "—";
    return `<tr>
      <td><span class="pill">${escapeHtml(itemTypeLabel(item.item_type))}</span></td>
      <td><strong>${escapeHtml(item.title)}</strong>${item.details ? `<br />${escapeHtml(item.details)}` : ""}</td>
      <td>${escapeHtml(started)}</td>
      <td>${escapeHtml(severity)}</td>
      <td>${item.answer ? escapeHtml(item.answer) : "—"}</td>
    </tr>`;
  }).join("");

  return section(
    "Görüşmede ele alınacaklar",
    "Seçili dönemde eklenen veya henüz çözülmemiş kullanıcı/aile girişi",
    rows
      ? `<table><thead><tr><th>Tür</th><th>Konu</th><th>Başlangıç</th><th>Şiddet</th><th>Görüşme sonrası kaydedilen yanıt</th></tr></thead><tbody>${rows}</tbody></table>`
      : emptyState("Henüz soru, belirti, ilaç veya not eklenmedi.")
  );
}

function buildPregnancyBody(snapshot: PregnancyDoctorVisitSnapshot) {
  const age = snapshot.pregnancy_age
    ? `${snapshot.pregnancy_age.week}. hafta + ${snapshot.pregnancy_age.day_of_week} gün`
    : "Kayıt girilmedi";

  const measurements = snapshot.measurements.map((item) => `<tr>
    <td>${formatDateTime(item.measured_at)}</td>
    <td>${item.source === "health_team" ? "Kullanıcının sağlık ekibinden kopyaladığı ölçüm" : "Kullanıcının kendi ölçümü"}</td>
    <td>${formatBloodPressure(item.systolic_bp, item.diastolic_bp)}</td>
    <td>${formatUnit(item.pulse_bpm, "atım/dk")}</td>
    <td>${formatUnit(item.fundal_height_cm, "cm")}</td>
    <td>${formatUnit(item.fetal_heart_rate_bpm, "atım/dk")}</td>
    <td>${optionalText(item.notes)}</td>
  </tr>`).join("");

  const weights = snapshot.weight_records.map((item) => `<tr>
    <td>${formatDate(item.record_date)}</td><td>${formatUnit(item.weight_kg, "kg")}</td><td>${optionalText(item.notes)}</td>
  </tr>`).join("");

  const counters = snapshot.daily_counters.map((item) => `<tr>
    <td>${formatDate(item.counter_date)}</td><td>${item.kick_count}</td><td>${item.contraction_count}</td>
  </tr>`).join("");

  const vaccines = snapshot.vaccinations.map((item) => `<tr>
    <td>${escapeHtml(item.vaccine_name)}</td><td>${item.recommended_week_start}–${item.recommended_week_end}. hafta</td>
    <td>${formatDate(item.scheduled_date)}</td><td>${item.completed ? `Tamamlandı${item.completed_date ? ` · ${formatDate(item.completed_date)}` : ""}` : "Tamamlanmadı"}</td>
    <td>${optionalText(item.notes)}</td>
  </tr>`).join("");

  return `${section(
    "Hamilelik bağlamı",
    "Profildeki tahmini doğum tarihinden hesaplanır",
    `<div class="facts">
      ${fact("Gebelik yaşı", age)}
      ${fact("Tahmini doğum tarihi", snapshot.profile.due_date ? formatDate(snapshot.profile.due_date) : "Kayıt girilmedi")}
      ${fact("Dönemde kilo kaydı", snapshot.weight_records.length ? String(snapshot.weight_records.length) : "Kayıt girilmedi")}
    </div>`
  )}
  ${section(
    "Görüşme ölçümleri",
    "Kullanıcı tarafından girilen veya sağlık ekibi ölçümünden kopyalanan ham değerler; Anne+ doğrulaması değildir",
    measurements
      ? `<table><thead><tr><th>Zaman</th><th>Kaynak</th><th>Tansiyon</th><th>Nabız</th><th>Fundal yükseklik</th><th>Fetal kalp hızı</th><th>Not</th></tr></thead><tbody>${measurements}</tbody></table>`
      : emptyState()
  )}
  ${section(
    "Kilo kayıtları",
    "Kullanıcı girişi",
    weights ? `<table><thead><tr><th>Tarih</th><th>Kilo</th><th>Not</th></tr></thead><tbody>${weights}</tbody></table>` : emptyState()
  )}
  ${section(
    "Günlük hareket ve kasılma sayaçları",
    "Sayaç kaydı olan günler; tıbbi yorum içermez",
    counters ? `<table><thead><tr><th>Tarih</th><th>Hareket sayacı</th><th>Kasılma sayacı</th></tr></thead><tbody>${counters}</tbody></table>` : emptyState()
  )}
  ${section(
    "Aşı kayıtları",
    "Uygulamadaki plan ve tamamlanma kaydı",
    vaccines ? `<table><thead><tr><th>Aşı</th><th>Planlanan hafta</th><th>Planlanan tarih</th><th>Durum</th><th>Not</th></tr></thead><tbody>${vaccines}</tbody></table>` : emptyState()
  )}`;
}

function buildBabyBody(snapshot: BabyDoctorVisitSnapshot) {
  const daily = snapshot.care_daily.map((day) => `<tr>
    <td>${formatDate(day.record_date)}</td>
    <td>${day.breastfeeding_count}</td>
    <td>${day.bottle_count}${day.bottle_amount_ml != null ? ` · ${formatUnit(day.bottle_amount_ml, "ml")}` : " · miktar girilmedi"}</td>
    <td>${day.sleep_count}${day.sleep_minutes != null ? ` · ${formatMinutes(day.sleep_minutes)}` : " · süre girilmedi"}</td>
    <td>${day.diaper_count}</td><td>${day.solid_food_count}</td><td>${day.medicine_count}</td><td>${day.temperature_count}</td>
  </tr>`).join("");

  const temperatures = snapshot.temperatures.map((item) => `<tr>
    <td>${formatDateTime(item.occurred_at)}</td><td>${formatUnit(item.temperature_c, "°C")}</td>
    <td>${optionalText(temperatureSiteLabel(item.temperature_site))}</td><td>${optionalText(item.notes)}</td>
  </tr>`).join("");

  const medicines = snapshot.medicines.map((item) => `<tr>
    <td>${formatDateTime(item.occurred_at)}</td><td>${optionalText(item.medicine_name)}</td><td>${optionalText(item.medicine_dose)}</td><td>${optionalText(item.notes)}</td>
  </tr>`).join("");

  const growth = snapshot.growth_records.map((item) => `<tr>
    <td>${formatDate(item.record_date)}</td><td>${formatUnit(item.weight_kg, "kg")}</td><td>${formatUnit(item.height_cm, "cm")}</td>
    <td>${formatUnit(item.head_circumference_cm, "cm")}</td><td>${optionalText(item.notes)}</td>
  </tr>`).join("");

  const vaccines = snapshot.vaccinations.map((item) => `<tr>
    <td>${escapeHtml(item.vaccine_name)}</td><td>${item.dose_number}</td><td>${formatDate(item.scheduled_date)}</td>
    <td>${item.completed ? `Tamamlandı${item.completed_date ? ` · ${formatDate(item.completed_date)}` : ""}` : "Tamamlanmadı"}</td><td>${optionalText(item.notes)}</td>
  </tr>`).join("");

  return `${section(
    "Kayıt kapsamı",
    "Bebek bakım günlüğü; sağım kayıtları bu bebek raporuna dahil edilmez",
    `<div class="facts">
      ${fact("Bakım kaydı", snapshot.care_coverage.has_records ? String(snapshot.care_coverage.record_count) : "Kayıt girilmedi")}
      ${fact("Kayıt olan gün", snapshot.care_coverage.has_records ? String(snapshot.care_coverage.recorded_days) : "Kayıt girilmedi")}
      ${fact("Bebek yaşı", `${snapshot.baby.age_days} gün`)}
    </div>`
  )}
  ${section(
    "Günlük bakım özeti",
    "Aile/bakıcı tarafından girilen olayların günlük dökümü",
    daily
      ? `<table><thead><tr><th>Tarih</th><th>Emzirme</th><th>Biberon</th><th>Uyku</th><th>Bez</th><th>Ek gıda</th><th>İlaç</th><th>Isı</th></tr></thead><tbody>${daily}</tbody></table>`
      : emptyState()
  )}
  ${section(
    "Vücut ısısı kayıtları",
    "Kullanıcı tarafından girilen ham ölçümler",
    temperatures ? `<table><thead><tr><th>Zaman</th><th>Değer</th><th>Ölçüm yeri</th><th>Not</th></tr></thead><tbody>${temperatures}</tbody></table>` : emptyState()
  )}
  ${section(
    "İlaç / vitamin kayıtları",
    "Kullanıcı girişi; reçete veya doz önerisi değildir",
    medicines ? `<table><thead><tr><th>Zaman</th><th>Ad</th><th>Doz notu</th><th>Ek not</th></tr></thead><tbody>${medicines}</tbody></table>` : emptyState()
  )}
  ${section(
    "Büyüme ölçümleri",
    "En son 12 ham ölçüm; seçili dönem dışında olabilir, persentil veya yorum içermez",
    growth ? `<table><thead><tr><th>Tarih</th><th>Kilo</th><th>Boy</th><th>Baş çevresi</th><th>Not</th></tr></thead><tbody>${growth}</tbody></table>` : emptyState()
  )}
  ${section(
    "Aşı kayıtları",
    "Uygulamadaki plan ve tamamlanma kaydı",
    vaccines ? `<table><thead><tr><th>Aşı</th><th>Doz</th><th>Planlanan tarih</th><th>Durum</th><th>Not</th></tr></thead><tbody>${vaccines}</tbody></table>` : emptyState()
  )}`;
}

function buildPostpartumMotherBody(
  snapshot: PostpartumMotherDoctorVisitSnapshot,
  options: DoctorVisitReportOptions
) {
  const wellbeing = snapshot.wellbeing.map((item) => `<tr>
    <td>${formatDate(item.checkin_date)}</td><td>${item.mood}/5</td><td>${item.rest}/5</td><td>${optionalText(item.self_care_note)}</td>
  </tr>`).join("");

  const pumping = options.includePumping
    ? section(
      "Sağım özeti",
      "İsteğe bağlı; seçili bebeğe ait kullanıcının girdiği kayıtlar",
      snapshot.pumping_summary.has_records
        ? `<div class="facts">
          ${fact("Sağım kaydı", String(snapshot.pumping_summary.record_count))}
          ${fact("Girilen toplam miktar", formatUnit(snapshot.pumping_summary.total_amount_ml, "ml"))}
          ${fact("Tamamlanan toplam süre", snapshot.pumping_summary.total_duration_minutes != null ? formatMinutes(snapshot.pumping_summary.total_duration_minutes) : "Süre girilmedi")}
        </div>`
        : emptyState()
    )
    : "";

  return `${section(
    "Doğum sonrası bağlamı",
    "Seçili bebeğin kayıtlı doğum tarihine göre",
    `<div class="facts">
      ${fact("Doğum sonrası gün", String(snapshot.postpartum_days))}
      ${fact("Bebek", snapshot.baby.name)}
      ${fact("Öz değerlendirme kaydı", snapshot.wellbeing.length ? String(snapshot.wellbeing.length) : "Kayıt girilmedi")}
    </div>`
  )}
  ${section(
    "Anne iyi oluş kayıtları",
    "Annenin 1–5 arası öz değerlendirmesi; tarama testi veya tanı değildir",
    wellbeing ? `<table><thead><tr><th>Tarih</th><th>Ruh hali</th><th>Dinlenme</th><th>Kendime bakım notu</th></tr></thead><tbody>${wellbeing}</tbody></table>` : emptyState()
  )}
  ${pumping}`;
}

function section(title: string, source: string, content: string) {
  return `<section class="section"><div class="section-heading"><h2>${escapeHtml(title)}</h2><span class="source">${escapeHtml(source)}</span></div>${content}</section>`;
}

function fact(label: string, value: string) {
  return `<div class="fact"><span class="fact-label">${escapeHtml(label)}</span><span class="fact-value">${escapeHtml(value)}</span></div>`;
}

function emptyState(message = "Bu dönem için kayıt girilmedi.") {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function getReportSubjectName(snapshot: DoctorVisitSnapshot) {
  if (snapshot.subject === "pregnancy") {
    return snapshot.profile.mother_name?.trim() || snapshot.profile.display_name?.trim() || "Anne";
  }
  if (snapshot.subject === "postpartum_mother") {
    return snapshot.profile.mother_name?.trim() || snapshot.profile.display_name?.trim() || "Anne";
  }
  return snapshot.baby.name;
}

function getSubjectLabel(snapshot: DoctorVisitSnapshot) {
  if (snapshot.subject === "pregnancy") return "Hamilelik · anne";
  if (snapshot.subject === "postpartum_mother") return "Doğum sonrası · anne";
  return "Doğum sonrası · bebek";
}

function itemTypeLabel(type: DoctorVisitItem["item_type"]) {
  return ({
    question: "Soru",
    symptom: "Belirti",
    medication: "İlaç / vitamin",
    note: "Not"
  })[type];
}

function temperatureSiteLabel(value: string | null) {
  if (!value) return null;
  return ({
    armpit: "Koltuk altı",
    forehead: "Alın",
    ear: "Kulak",
    oral: "Ağız",
    rectal: "Rektal",
    other: "Diğer"
  } as Record<string, string>)[value] ?? value;
}

function optionalText(value: string | null | undefined) {
  return value?.trim() ? escapeHtml(value.trim()) : "—";
}

function formatBloodPressure(systolic: number | null, diastolic: number | null) {
  if (systolic == null || diastolic == null) return "—";
  return `${formatNumber(systolic)}/${formatNumber(diastolic)} mmHg`;
}

function formatUnit(value: number | null, unit: string) {
  return value == null ? "—" : `${formatNumber(value)} ${unit}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

function formatMinutes(value: number) {
  if (value < 60) return `${value} dk`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} sa ${minutes} dk` : `${hours} sa`;
}

function formatDate(value: string) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date) : "—";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function parseDate(value: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (parts) {
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    return new Date(year, month - 1, day, 12);
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[character] as string);
}
