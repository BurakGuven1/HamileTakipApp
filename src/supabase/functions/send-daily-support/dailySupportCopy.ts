export type DailySupportCopyInput = {
  articleExcerpt: string | null;
  babyName: string | null;
  name: string;
  week: number | null;
};

export function buildDailySupportCopy(input: DailySupportCopyInput) {
  if (input.articleExcerpt && input.week) {
    return {
      body: `${input.articleExcerpt} 1 dakikalık rehberi aç.`,
      screen: "article" as const,
      title: `${input.name}, ${input.week}. hafta için 1 dakikalık rehberin hazır`
    };
  }

  if (input.babyName) {
    return {
      body: `Bugün için tek küçük bakım adımını seç; ${input.babyName}'in rutinini ve kendi notlarını bir dakikada düzenle.`,
      screen: "home" as const,
      title: `${input.name}, bugünü biraz kolaylaştıralım`
    };
  }

  return {
    body: "Bugünün kısa kontrol listesini aç; kendin ve ailen için tek faydalı adımı seç.",
    screen: "home" as const,
    title: `${input.name}, bugün için küçük bir kolaylık hazır`
  };
}
