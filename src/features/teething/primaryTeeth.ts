export type PrimaryTooth = {
  code: string;
  jaw: "upper" | "lower";
  side: "right" | "left";
  name: string;
  shortName: string;
  minMonth: number;
  maxMonth: number;
};

function makeSide(
  jaw: PrimaryTooth["jaw"],
  side: PrimaryTooth["side"],
  teeth: Array<Omit<PrimaryTooth, "jaw" | "side">>
) {
  return teeth.map((tooth) => ({ ...tooth, jaw, side }));
}

const upperRight = makeSide("upper", "right", [
  { code: "UR-CI", name: "Üst sağ orta kesici", shortName: "Orta kesici", minMonth: 8, maxMonth: 12 },
  { code: "UR-LI", name: "Üst sağ yan kesici", shortName: "Yan kesici", minMonth: 9, maxMonth: 13 },
  { code: "UR-C", name: "Üst sağ köpek dişi", shortName: "Köpek", minMonth: 16, maxMonth: 22 },
  { code: "UR-M1", name: "Üst sağ birinci azı", shortName: "1. azı", minMonth: 13, maxMonth: 19 },
  { code: "UR-M2", name: "Üst sağ ikinci azı", shortName: "2. azı", minMonth: 25, maxMonth: 33 }
]);

const upperLeft = makeSide("upper", "left", [
  { code: "UL-CI", name: "Üst sol orta kesici", shortName: "Orta kesici", minMonth: 8, maxMonth: 12 },
  { code: "UL-LI", name: "Üst sol yan kesici", shortName: "Yan kesici", minMonth: 9, maxMonth: 13 },
  { code: "UL-C", name: "Üst sol köpek dişi", shortName: "Köpek", minMonth: 16, maxMonth: 22 },
  { code: "UL-M1", name: "Üst sol birinci azı", shortName: "1. azı", minMonth: 13, maxMonth: 19 },
  { code: "UL-M2", name: "Üst sol ikinci azı", shortName: "2. azı", minMonth: 25, maxMonth: 33 }
]);

const lowerRight = makeSide("lower", "right", [
  { code: "LR-CI", name: "Alt sağ orta kesici", shortName: "Orta kesici", minMonth: 6, maxMonth: 10 },
  { code: "LR-LI", name: "Alt sağ yan kesici", shortName: "Yan kesici", minMonth: 10, maxMonth: 16 },
  { code: "LR-C", name: "Alt sağ köpek dişi", shortName: "Köpek", minMonth: 17, maxMonth: 23 },
  { code: "LR-M1", name: "Alt sağ birinci azı", shortName: "1. azı", minMonth: 14, maxMonth: 18 },
  { code: "LR-M2", name: "Alt sağ ikinci azı", shortName: "2. azı", minMonth: 23, maxMonth: 31 }
]);

const lowerLeft = makeSide("lower", "left", [
  { code: "LL-CI", name: "Alt sol orta kesici", shortName: "Orta kesici", minMonth: 6, maxMonth: 10 },
  { code: "LL-LI", name: "Alt sol yan kesici", shortName: "Yan kesici", minMonth: 10, maxMonth: 16 },
  { code: "LL-C", name: "Alt sol köpek dişi", shortName: "Köpek", minMonth: 17, maxMonth: 23 },
  { code: "LL-M1", name: "Alt sol birinci azı", shortName: "1. azı", minMonth: 14, maxMonth: 18 },
  { code: "LL-M2", name: "Alt sol ikinci azı", shortName: "2. azı", minMonth: 23, maxMonth: 31 }
]);

export const primaryTeeth = [
  ...lowerLeft,
  ...lowerRight,
  ...upperLeft,
  ...upperRight
];

export const primaryTeethQuadrants = [
  { id: "upper-right", label: "Üst çene · sağ", teeth: upperRight },
  { id: "upper-left", label: "Üst çene · sol", teeth: upperLeft },
  { id: "lower-right", label: "Alt çene · sağ", teeth: lowerRight },
  { id: "lower-left", label: "Alt çene · sol", teeth: lowerLeft }
] as const;

export function getNextExpectedTooth(eruptedCodes: Set<string>) {
  return [...primaryTeeth]
    .filter((tooth) => !eruptedCodes.has(tooth.code))
    .sort((a, b) => a.minMonth - b.minMonth || a.maxMonth - b.maxMonth)[0];
}
