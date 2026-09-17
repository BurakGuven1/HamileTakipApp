import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCardDate,
  formatHeightLabel,
  formatWeightLabel,
  getMilestoneAgeLabel,
  getMilestoneSlots,
  MAX_CAPTION_LENGTH,
  sanitizeCaption
} from "./milestone.ts";

test("serbest yazı 30 karakterde kesilir ve boşlukları sadeleşir", () => {
  assert.equal(sanitizeCaption("  Bir  aylık   oldun  "), "Bir aylık oldun");
  assert.equal(sanitizeCaption(null), "");
  assert.equal(
    Array.from(sanitizeCaption("a".repeat(60))).length,
    MAX_CAPTION_LENGTH
  );
});

test("emoji tek karakter sayılır", () => {
  // Kod birimiyle kesilseydi yarım emoji kalır, kartta kutu görünürdü.
  const caption = sanitizeCaption("🍼".repeat(40));
  assert.equal(Array.from(caption).length, MAX_CAPTION_LENGTH);
});

test("ölçü etiketleri Türkçe ondalık ayracıyla yazılır", () => {
  assert.equal(formatWeightLabel(4.2), "4,2 kg");
  assert.equal(formatWeightLabel(5), "5 kg");
  assert.equal(formatHeightLabel(58.5), "58,5 cm");
  assert.equal(formatHeightLabel(60), "60 cm");
});

test("eksik ya da anlamsız ölçü rozet üretmez", () => {
  assert.equal(formatWeightLabel(null), null);
  assert.equal(formatWeightLabel(0), null);
  assert.equal(formatHeightLabel(Number.NaN), null);
  assert.equal(formatCardDate(null), null);
});

test("yaş etiketi bugüne göre değil fotoğrafın gününe göre hesaplanır", () => {
  assert.equal(getMilestoneAgeLabel("2026-05-17", "2026-06-17"), "1 AYLIK");
  assert.equal(getMilestoneAgeLabel("2026-05-17", "2026-05-20"), "3 GÜNLÜK");
  assert.equal(getMilestoneAgeLabel("2026-05-17", "2026-05-17"), "YENİ DOĞAN");
  assert.equal(getMilestoneAgeLabel("2025-05-17", "2026-05-17"), "1 YAŞINDA");
  assert.equal(getMilestoneAgeLabel("2025-05-17", "2026-08-17"), "1 YAŞ 3 AY");
});

test("doğum gününden önceki bir fotoğraf yaş etiketi almaz", () => {
  assert.equal(getMilestoneAgeLabel("2026-05-17", "2026-04-01"), null);
  assert.equal(getMilestoneAgeLabel(null, "2026-04-01"), null);
});

test("değeri olmayan rozet çizilmez, kalanlar yukarı kayar", () => {
  const slots = getMilestoneSlots({
    ageLabel: "1 AYLIK",
    caption: null,
    dateLabel: "17 MAYIS 2026",
    heightLabel: null,
    weightLabel: "4,2 kg"
  });

  const ids = slots.map((slot) => slot.id);
  assert.deepEqual(ids, ["headline", "weight", "date", "age"]);

  const weight = slots.find((slot) => slot.id === "weight");
  const date = slots.find((slot) => slot.id === "date");
  assert.ok(date.position.y - weight.position.y < 0.13, "rozetler arada boşluk bırakmaz");
});

test("hiç ölçü yoksa kart yalnızca başlıkla çizilir", () => {
  const slots = getMilestoneSlots({
    ageLabel: null,
    caption: null,
    dateLabel: null,
    heightLabel: null,
    weightLabel: null
  });

  assert.deepEqual(slots.map((slot) => slot.id), ["headline"]);
});
