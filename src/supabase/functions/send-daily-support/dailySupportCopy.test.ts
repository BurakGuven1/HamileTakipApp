import { buildDailySupportCopy } from "./dailySupportCopy.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

Deno.test("article notification gives a concrete, time-relevant reason to open the app", () => {
  assertEquals(
    buildDailySupportCopy({
      articleExcerpt: "Bebeğinizin hareketlerini rahatça takip etmek için kısa bir yöntem.",
      articleTitle: "24. hafta hareket takibi",
      babyName: null,
      name: "Elif",
      week: 24
    }),
    {
      body: "Bebeğinizin hareketlerini rahatça takip etmek için kısa bir yöntem. 1 dakikalık rehberi aç.",
      screen: "article",
      title: "Elif, 24. hafta için 1 dakikalık rehberin hazır"
    }
  );
});

Deno.test("postpartum notification offers a small useful action and opens home", () => {
  assertEquals(
    buildDailySupportCopy({
      articleExcerpt: null,
      articleTitle: null,
      babyName: "Deniz",
      name: "Elif",
      week: null
    }),
    {
      body: "Bugün için tek küçük bakım adımını seç; Deniz'in rutinini ve kendi notlarını bir dakikada düzenle.",
      screen: "home",
      title: "Elif, bugünü biraz kolaylaştıralım"
    }
  );
});
