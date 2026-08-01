import {
  getPregnancyAgeError,
  getPregnancyAgeFromDueDate,
  getPregnancyDueDateFromAge
} from "../../../lib/dates.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Beklenen ${JSON.stringify(expected)}, alınan ${JSON.stringify(actual)}`
    );
  }
}

Deno.test("5 hafta 2 gün bilgisinden tahmini doğum tarihini hesaplar", () => {
  const reference = new Date(2026, 7, 1);
  assertEquals(
    getPregnancyDueDateFromAge(5, 2, reference),
    "2027-04-01"
  );
});

Deno.test("hesaplanan doğum tarihini aynı hafta ve güne geri çevirir", () => {
  const reference = new Date(2026, 7, 1);
  const dueDate = getPregnancyDueDateFromAge(25, 3, reference);
  assertEquals(getPregnancyAgeFromDueDate(dueDate, reference), {
    day: 3,
    week: 25
  });
});

Deno.test("gebelik hafta ve gün sınırlarını doğrular", () => {
  assertEquals(getPregnancyAgeError(1, 0), null);
  assertEquals(getPregnancyAgeError(42, 0), null);
  assertEquals(
    getPregnancyAgeError(42, 1),
    "42. haftadaysan gün değerini 0 seçmelisin."
  );
  assertEquals(
    getPregnancyAgeError(5, 7),
    "Haftanın gününü 0 ile 6 arasında girmelisin."
  );
});
