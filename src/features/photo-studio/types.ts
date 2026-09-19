/**
 * Foto Stüdyo, annenin yüklediği fotoğrafa asla dokunmaz: fotoğraf olduğu gibi
 * altta durur, tüm süslemeler üstüne ayrı bir katman olarak çizilir. Buradaki
 * tipler o katmanın sözleşmesidir.
 */

export type StudioKind = "milestone" | "belly";

/** Kartın tamamına göre 0..1 aralığında konum; piksel yok ki her ekranda aynı dursun. */
export type NormalizedPoint = {
  x: number;
  y: number;
};

export type MilestoneSlotId =
  | "headline"
  | "caption"
  | "weight"
  | "height"
  | "date"
  | "age";

export type MilestoneSlot = {
  /** Slotun yatay hizası; metin kutusu bu kenardan büyür. */
  align: "left" | "right";
  id: MilestoneSlotId;
  position: NormalizedPoint;
  /** Kart genişliğine oranla azami genişlik. */
  width: number;
};

export type MilestoneValues = {
  ageLabel: string | null;
  caption: string | null;
  dateLabel: string | null;
  heightLabel: string | null;
  weightLabel: string | null;
};

export type StudioPalette = {
  /** Rozetlerin ve tabelaların zemini. */
  paper: string;
  /** Çerçeve, kontur ve yazı rengi. */
  ink: string;
  /** Vurgu (ay tabelası, ikon dolgusu). */
  accent: string;
  /** İkincil vurgu. */
  accentSoft: string;
  /** Doğa öğeleri (ağaç, yaprak, dağ). */
  nature: string;
};

export type MilestoneDecorId =
  | "campsite"
  | "forest"
  | "clouds"
  | "garden";

export type MilestoneConcept = {
  decor: MilestoneDecorId;
  description: string;
  headline: string[];
  id: string;
  isPremium: boolean;
  kind: "milestone";
  palette: StudioPalette;
  title: string;
};

export type BellyStickerShape = "gem" | "heart" | "star" | "sparkle" | "flower" | "dot";

export type BellyConcept = {
  description: string;
  id: string;
  isPremium: boolean;
  kind: "belly";
  palette: StudioPalette;
  /** Serpilecek taşların renk çemberi; sırayla dönülür. */
  sequence: string[];
  shapes: BellyStickerShape[];
  title: string;
};

export type StudioConcept = MilestoneConcept | BellyConcept;

/** Karın bölgesini işaretleyen elips; kart boyutuna göre 0..1. */
export type BellyEllipse = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
};

export type BellySticker = {
  color: string;
  /** Elips merkezine göre 0..1 normalize konum (kart koordinatı değil). */
  offsetX: number;
  offsetY: number;
  opacity: number;
  rotation: number;
  shape: BellyStickerShape;
  /** Kart genişliğine oranla yarıçap. */
  size: number;
};
