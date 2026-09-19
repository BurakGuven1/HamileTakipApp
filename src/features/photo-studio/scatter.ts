import type { BellyConcept, BellyEllipse, BellySticker } from "./types";

/**
 * Taşların dağılımı rastgele görünmeli ama her çizimde aynı kalmalı: anne
 * konsepti değiştirip geri dönünce kartı yeniden dizilmesin, dışa aktarım da
 * ekranda gördüğünün aynısı olsun. Bu yüzden tohumdan beslenen bir üreteç.
 */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type ScatterOptions = {
  count: number;
  seed: string;
};

/** Karın kenarına taş düşmesin; dış %8'lik halka boş bırakılır. */
const EDGE_MARGIN = 0.92;
const MIN_DISTANCE = 0.11;
const MAX_ATTEMPTS = 40;

/**
 * Taşlar birim çember içinde üretilir; ekranda elipsin yarıçaplarıyla
 * ölçeklenir. Böylece anne elipsi büyütüp küçülttüğünde dağılım bozulmaz,
 * sadece birlikte ölçeklenir.
 */
export function scatterBellyStickers(
  concept: BellyConcept,
  { count, seed }: ScatterOptions
): BellySticker[] {
  const random = createRandom(hashSeed(`${concept.id}:${seed}`));
  const stickers: BellySticker[] = [];
  const target = Math.max(0, Math.min(140, Math.round(count)));

  for (let index = 0; index < target; index += 1) {
    let placed: { x: number; y: number; radius: number } | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      // r = u^0.62 merkeze doğru yoğunlaştırır; düz uniform dağılım karnın
      // ortasını boş, kenarını kalabalık gösteriyordu.
      const radius = Math.pow(random(), 0.62) * EDGE_MARGIN;
      const angle = random() * Math.PI * 2;
      const candidate = {
        radius,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      };

      const tooClose = stickers.some((sticker) => {
        const dx = sticker.offsetX - candidate.x;
        const dy = sticker.offsetY - candidate.y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_DISTANCE;
      });

      if (!tooClose) {
        placed = candidate;
        break;
      }
    }

    if (!placed) {
      // Alan doldu; zorlayıp üst üste taş bindirmektense erken duruyoruz.
      break;
    }

    const shape =
      concept.shapes[Math.floor(random() * concept.shapes.length)] ?? "dot";
    const color = concept.sequence[index % concept.sequence.length] ?? "#FFFFFF";
    // Karın bir küre; kenardaki taş hem küçülür hem soluklaşır, aksi halde
    // yapıştırma değil üstüne basılmış bir desen gibi duruyor.
    const falloff = 1 - placed.radius * 0.42;

    stickers.push({
      color,
      offsetX: placed.x,
      offsetY: placed.y,
      opacity: Math.round((0.78 + falloff * 0.22) * 100) / 100,
      rotation: Math.round(random() * 360),
      shape,
      size: Math.round((0.018 + random() * 0.016) * falloff * 1000) / 1000
    });
  }

  return stickers;
}

export const DEFAULT_BELLY_ELLIPSE: BellyEllipse = {
  centerX: 0.5,
  centerY: 0.58,
  radiusX: 0.24,
  radiusY: 0.2
};

/** Elips karttan taşmasın; kenardan tamamen çıkarsa anne onu geri bulamıyor. */
export function clampBellyEllipse(ellipse: BellyEllipse): BellyEllipse {
  const radiusX = clamp(ellipse.radiusX, 0.08, 0.48);
  const radiusY = clamp(ellipse.radiusY, 0.06, 0.4);

  return {
    centerX: clamp(ellipse.centerX, radiusX * 0.4, 1 - radiusX * 0.4),
    centerY: clamp(ellipse.centerY, radiusY * 0.4, 1 - radiusY * 0.4),
    radiusX,
    radiusY
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

/**
 * Taş sayısı elipsin alanıyla büyür; küçük bir karına 90 taş sığmıyor, büyük
 * bir karında 30 taş seyrek kalıyor.
 */
export function getSuggestedStickerCount(ellipse: BellyEllipse) {
  const area = ellipse.radiusX * ellipse.radiusY;
  const scaled = Math.round(area * 1400);
  return Math.max(18, Math.min(90, scaled));
}
