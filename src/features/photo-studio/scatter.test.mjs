import assert from "node:assert/strict";
import test from "node:test";

import { BELLY_CONCEPTS } from "./concepts.ts";
import {
  clampBellyEllipse,
  DEFAULT_BELLY_ELLIPSE,
  getSuggestedStickerCount,
  scatterBellyStickers
} from "./scatter.ts";

const concept = BELLY_CONCEPTS[0];

test("aynı tohum aynı dağılımı verir", () => {
  const first = scatterBellyStickers(concept, { count: 40, seed: "photo-1" });
  const second = scatterBellyStickers(concept, { count: 40, seed: "photo-1" });
  assert.deepEqual(first, second);
});

test("farklı fotoğraf farklı dağılım alır", () => {
  const first = scatterBellyStickers(concept, { count: 40, seed: "photo-1" });
  const second = scatterBellyStickers(concept, { count: 40, seed: "photo-2" });
  assert.notDeepEqual(first, second);
});

test("taşlar birim çemberin içinde ve kenardan uzakta kalır", () => {
  const stickers = scatterBellyStickers(concept, { count: 80, seed: "x" });
  for (const sticker of stickers) {
    const radius = Math.hypot(sticker.offsetX, sticker.offsetY);
    assert.ok(radius <= 0.92, `yarıçap ${radius} kenarı aşmamalı`);
    assert.ok(sticker.size > 0 && sticker.size < 0.05);
    assert.ok(sticker.opacity > 0.7 && sticker.opacity <= 1);
    assert.ok(concept.shapes.includes(sticker.shape));
  }
});

test("taşlar üst üste binmez", () => {
  const stickers = scatterBellyStickers(concept, { count: 60, seed: "overlap" });
  for (let i = 0; i < stickers.length; i += 1) {
    for (let j = i + 1; j < stickers.length; j += 1) {
      const distance = Math.hypot(
        stickers[i].offsetX - stickers[j].offsetX,
        stickers[i].offsetY - stickers[j].offsetY
      );
      assert.ok(distance >= 0.11 - 1e-9, `taşlar ${distance} kadar yakın olmamalı`);
    }
  }
});

test("kenardaki taş merkezdekinden sönük ve küçüktür", () => {
  const stickers = scatterBellyStickers(concept, { count: 90, seed: "falloff" });
  const sorted = [...stickers].sort(
    (a, b) => Math.hypot(a.offsetX, a.offsetY) - Math.hypot(b.offsetX, b.offsetY)
  );
  assert.ok(sorted[0].opacity >= sorted[sorted.length - 1].opacity);
});

test("elips karttan taşmaz ve makul boyutta kalır", () => {
  const clamped = clampBellyEllipse({
    centerX: 2,
    centerY: -1,
    radiusX: 0.9,
    radiusY: 0.001
  });

  assert.ok(clamped.centerX <= 1 && clamped.centerX >= 0);
  assert.ok(clamped.centerY <= 1 && clamped.centerY >= 0);
  assert.equal(clamped.radiusX, 0.48);
  assert.equal(clamped.radiusY, 0.06);
});

test("taş sayısı elips alanıyla büyür", () => {
  const small = getSuggestedStickerCount({ ...DEFAULT_BELLY_ELLIPSE, radiusX: 0.1, radiusY: 0.09 });
  const large = getSuggestedStickerCount({ ...DEFAULT_BELLY_ELLIPSE, radiusX: 0.34, radiusY: 0.3 });
  assert.ok(small < large);
  assert.ok(small >= 18 && large <= 90);
});
