import {
  getGuidanceForMonth,
  getPregnancyMonth,
  getPregnancyMonthRange,
  pregnancyGuidanceSources,
  pregnancySupplementGuidance
} from "../../../features/pregnancy/nutritionGuidance.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Beklenen ${JSON.stringify(expected)}, alınan ${JSON.stringify(actual)}`
    );
  }
}

Deno.test("gebelik haftasını kullanıcıya gösterilen aya eşler", () => {
  assertEquals(getPregnancyMonth(1), 1);
  assertEquals(getPregnancyMonth(12), 3);
  assertEquals(getPregnancyMonth(16), 4);
  assertEquals(getPregnancyMonth(28), 7);
  assertEquals(getPregnancyMonth(42), 9);
});

Deno.test("ay aralıkları boşluk veya çakışma oluşturmaz", () => {
  const ranges = Array.from({ length: 9 }, (_, index) =>
    getPregnancyMonthRange(index + 1)
  );
  assertEquals(ranges[0]?.startWeek, 1);
  assertEquals(ranges[8]?.endWeek, 42);
  for (let index = 1; index < ranges.length; index += 1) {
    assertEquals(ranges[index]?.startWeek, (ranges[index - 1]?.endWeek ?? 0) + 1);
  }
});

Deno.test("döneme yalnızca çakışan takviye başlıklarını getirir", () => {
  assertEquals(
    getGuidanceForMonth(1).map((item) => item.id),
    ["folic-acid"]
  );
  assertEquals(
    getGuidanceForMonth(3).map((item) => item.id),
    ["folic-acid", "vitamin-d"]
  );
  assertEquals(
    getGuidanceForMonth(4).map((item) => item.id),
    ["vitamin-d", "iron"]
  );
});

Deno.test("her takviye kartının uygulamada açılabilir kaynak kaydı vardır", () => {
  const sourceIds = new Set(pregnancyGuidanceSources.map((source) => source.id));
  const missing = pregnancySupplementGuidance.flatMap((item) =>
    item.sourceIds.filter((sourceId) => !sourceIds.has(sourceId))
  );
  assertEquals(missing, []);
});
