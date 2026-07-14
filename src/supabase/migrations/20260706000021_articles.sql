-- ============================================================
-- 0021: Dynamic articles and article images
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'article-images',
    'article-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  period text not null default 'Makale',
  category text not null check (category in ('hafta', 'ay', 'bebek', 'ipuclari')),
  excerpt text not null,
  body text not null,
  image_path text,
  accent text not null default '#6E8F7C',
  sort_order int not null default 1000,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.articles is
  'CMS-backed article content shown in the app. Body is stored as plain text or lightweight markdown separated by blank lines.';
comment on column public.articles.image_path is
  'Path inside the public article-images storage bucket, for example hamileligin-10-haftasi/cover.webp.';

drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

alter table public.articles enable row level security;

drop policy if exists "articles_select_published" on public.articles;
create policy "articles_select_published"
  on public.articles for select
  using (is_published = true);

drop policy if exists "article_images_select_public" on storage.objects;
create policy "article_images_select_public"
  on storage.objects for select
  using (bucket_id = 'article-images');

insert into public.articles (
  slug,
  title,
  period,
  category,
  excerpt,
  body,
  accent,
  sort_order,
  is_published,
  published_at
)
values
  (
    'hamileligin-10-haftasi',
    'Hamileliğin 10. Haftası',
    '10. hafta',
    'hafta',
    '10. haftada yüz hatları, göz kapakları ve kulak yapısı gelişimini hızlandırır.',
    'Bu hafta bebeğin yüz hatları daha belirginleşir. Göz kapakları, kulak yapısı ve minik parmak ayrımları gelişmeye devam eder.

Anne tarafında yorgunluk, koku hassasiyeti ve mide bulantısı hâlâ görülebilir. Küçük ama sık öğünler ve yeterli sıvı alımı bu dönemde destekleyici olabilir.

Her gebelik kişiseldir. Ağrı, kanama, şiddetli kusma veya seni endişelendiren bir belirti varsa doktoruna danışmalısın.',
    '#D97895',
    10,
    true,
    now()
  ),
  (
    'hamileligin-11-haftasi',
    'Hamileliğin 11. Haftası',
    '11. hafta',
    'hafta',
    'Minik hareketler artar, kulaklar şekillenir ve büyüme temposu hızlanır.',
    '11. haftada bebek içeride aktif şekilde hareket eder; anne bu hareketleri çoğu zaman henüz hissetmez.

Dış kulaklar şekillenmeye, kemik ve kas sistemi güçlenmeye devam eder. Bu dönem hızlı büyüme ve olgunlaşma dönemidir.

Düzenli doktor kontrolleri, beslenme ve dinlenme planı için en güvenilir rehberdir.',
    '#6B96C7',
    11,
    true,
    now()
  ),
  (
    'hamilelikte-3-ay',
    'Hamilelikte 3. Ay Rehberi',
    '3. ay',
    'ay',
    'İlk trimesterin sonuna yaklaşırken anne ve bebekte beklenen değişimler.',
    '3. ay, ilk trimesterin sonuna yaklaşırken hem anne hem bebek için önemli bir geçiş dönemidir.

Bulantı ve yorgunluk bazı annelerde hafiflemeye başlarken, iştah ve enerji seviyesi kişiden kişiye değişebilir.

Bu ayda doktorunun önerdiği tarama ve takip planını aksatmamak önemlidir.',
    '#E3B873',
    30,
    true,
    now()
  ),
  (
    'gebelikte-gunluk-rutin-ipuclari',
    'Günlük Rutin İçin Nazik İpuçları',
    'İpuçları',
    'ipuclari',
    'Gebelik takibini daha sakin ve sürdürülebilir hale getiren küçük rutinler.',
    'Gün içinde kısa nefes molaları, su içme hatırlatmaları ve hafif yürüyüşler gebelik döneminde rutini yumuşatabilir.

Kendini zorlamadan ilerlemek ve bedeninin verdiği sinyalleri dikkate almak daha sürdürülebilir bir takip sağlar.

Tıbbi kararlar için uygulamadaki bilgiler yerine doktorunun önerilerini esas almalısın.',
    '#6E8F7C',
    100,
    true,
    now()
  )
on conflict (slug) do update
set
  title = excluded.title,
  period = excluded.period,
  category = excluded.category,
  excerpt = excluded.excerpt,
  body = excluded.body,
  accent = excluded.accent,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published,
  published_at = coalesce(public.articles.published_at, excluded.published_at);

grant select on public.articles to anon, authenticated;
