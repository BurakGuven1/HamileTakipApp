import { supabase } from "@/lib/supabase";
import { fallbackArticles, type Article } from "@/features/articles/articles";
import type { ExperienceStage } from "@/features/life-stage/lifeStage";
import type { Tables } from "@/types/database";

const ARTICLE_IMAGE_BUCKET = "article-images";

type ArticleRow = Tables<"articles">;

function toArticle(row: ArticleRow): Article {
  const bundledArticle = fallbackArticles.find((article) => article.slug === row.slug);

  return {
    accent: row.accent,
    body: splitBody(row.body),
    category: row.category,
    excerpt: row.excerpt,
    imageSource: bundledArticle?.imageSource,
    imagePath: row.image_path,
    imageUrl: getArticleImageUrl(row.image_path),
    period: row.period,
    slug: row.slug,
    sortOrder: row.sort_order,
    sources: bundledArticle?.sources,
    timelineEndWeek: row.timeline_end_week,
    timelineStartWeek: row.timeline_start_week,
    title: row.title
  };
}

function splitBody(body: string) {
  return body
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function getArticleImageUrl(imagePath?: string | null) {
  if (!imagePath) return undefined;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const { data } = supabase.storage
    .from(ARTICLE_IMAGE_BUCKET)
    .getPublicUrl(imagePath);

  return data.publicUrl;
}

export async function listArticles() {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    return fallbackArticles;
  }

  const remoteArticles = (data ?? []).map(toArticle);
  const remoteSlugs = new Set(remoteArticles.map((article) => article.slug));
  const bundledPostpartumArticles = fallbackArticles.filter(
    (article) => article.category === "bebek" && !remoteSlugs.has(article.slug)
  );

  return [...remoteArticles, ...bundledPostpartumArticles].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

export async function getArticleBySlug(slug: string) {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    return fallbackArticles.find((article) => article.slug === slug) ?? null;
  }

  return data
    ? toArticle(data)
    : fallbackArticles.find((article) => article.slug === slug) ?? null;
}

export async function getFeaturedArticles(limit = 4) {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return [...fallbackArticles]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, limit);
  }

  return (data ?? []).map(toArticle);
}

export function filterArticlesForExperience(
  articles: Article[],
  stage: ExperienceStage,
  pregnancyWeek?: number | null
) {
  return articles.filter((article) => {
    if (stage === "postpartum") {
      return article.category === "bebek";
    }

    if (stage === "general") {
      return (
        article.category === "ipuclari" &&
        article.timelineStartWeek == null &&
        article.timelineEndWeek == null
      );
    }

    if (article.category === "bebek") return false;
    if (!pregnancyWeek) return true;
    if (
      article.timelineStartWeek == null ||
      article.timelineEndWeek == null
    ) {
      return article.category === "ipuclari";
    }
    return (
      pregnancyWeek >= article.timelineStartWeek &&
      pregnancyWeek <= article.timelineEndWeek
    );
  });
}

export async function getFeaturedArticlesForExperience(
  stage: ExperienceStage,
  pregnancyWeek?: number | null,
  limit = 4
) {
  const articles = await listArticles();
  return filterArticlesForExperience(articles, stage, pregnancyWeek).slice(0, limit);
}
