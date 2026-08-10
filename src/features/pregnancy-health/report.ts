import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { PregnancyHealthTimelineItem } from "@/api/pregnancyHealthFile";

export async function sharePregnancyHealthFilePdf(input: {
  dueDate: string | null;
  motherName: string;
  timeline: PregnancyHealthTimelineItem[];
}) {
  const { uri } = await Print.printToFileAsync({
    html: buildHtml(input),
    base64: false
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Bu cihazda PDF paylaşımı kullanılamıyor.");
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: "Anne+ Sağlık Dosyam",
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf"
  });
}

function buildHtml(input: {
  dueDate: string | null;
  motherName: string;
  timeline: PregnancyHealthTimelineItem[];
}) {
  const rows = input.timeline.map((item) => {
    const labs = item.labValues.length
      ? `<ul>${item.labValues.map((value) => `<li>${escapeHtml(value.test_name)}: ${escapeHtml(value.result_text)} ${escapeHtml(value.unit ?? "")}${value.reference_range ? ` · Referans: ${escapeHtml(value.reference_range)}` : ""}</li>`).join("")}</ul>`
      : "";
    return `<section><div class="date">${formatDateTime(item.occurredAt)}</div><h2>${escapeHtml(item.title)}</h2>${item.details ? `<p>${escapeHtml(item.details)}</p>` : ""}${labs}</section>`;
  }).join("");

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#2f2a2d;padding:30px;line-height:1.45}
    header{border-bottom:2px solid #6e8f7c;margin-bottom:24px;padding-bottom:14px}h1{font-size:26px;margin:0 0 6px}h2{font-size:16px;margin:4px 0}p,li{font-size:12px}section{border-bottom:1px solid #e8dfdb;padding:12px 0}.date{color:#6e8f7c;font-size:11px;font-weight:700}.notice{background:#f9f4f0;border-radius:10px;margin-top:24px;padding:12px;font-size:11px}
  </style></head><body><header><h1>Anne+ Sağlık Dosyam</h1><p>${escapeHtml(input.motherName)}${input.dueDate ? ` · Tahmini doğum: ${formatDate(input.dueDate)}` : ""}</p></header>${rows || "<p>Henüz kayıt bulunmuyor.</p>"}<div class="notice">Bu belge kullanıcının kendi kayıtlarını düzenler; teşhis, tedavi, aciliyet değerlendirmesi veya tıbbi öneri değildir. Sağlık kararları için sağlık profesyoneline başvurun.</div></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
