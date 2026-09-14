-- Anne+ / makale kategori duzeltmesi - Eylul 2026
--
-- SORUN: Dogum sonrasi (lohusa) moddaki anneler SADECE category = 'bebek'
-- olan makaleleri gorur (src/api/articles.ts > filterArticlesForExperience).
-- Asagidaki dort makale tam olarak lohusa annenin arayacagi icerik oldugu
-- halde 'ipuclari' kategorisinde durdugu icin onlara hic gorunmuyor;
-- bunun yerine hamilelere gosteriliyorlar.
--
-- Bu dosya sadece kategori alanini degistirir, icerige dokunmaz.
-- Uygulama guncellemesi gerekmez.

-- Once mevcut durumu gor (istege bagli, calistirmadan once bakmak icin):
-- select slug, category, sort_order from public.articles
-- where category = 'ipuclari' order by sort_order;

update public.articles
set
  category   = 'bebek',
  sort_order = case slug
    when 'altin-sivi-kolostrum-ilk-emzirme-neden-hayati-onem-tasir'            then 205
    when 'dogru-emzirme-pozisyonlari-ve-memeye-dogru-yerlestirme-teknikleri'   then 235
    when 'lohusalik-donemi-vucutta-ve-ruh-halinde-yasanan-hormonal-degisimler' then 215
    when 'yenidogan-bebeklerin-ilkel-refleksleri-ve-anlamlari'                 then 255
    else sort_order
  end,
  -- 'bebek' kategorisindeki makalelerde hafta araligi kullanilmaz.
  timeline_start_week = null,
  timeline_end_week   = null,
  updated_at = now()
where slug in (
  'altin-sivi-kolostrum-ilk-emzirme-neden-hayati-onem-tasir',
  'dogru-emzirme-pozisyonlari-ve-memeye-dogru-yerlestirme-teknikleri',
  'lohusalik-donemi-vucutta-ve-ruh-halinde-yasanan-hormonal-degisimler',
  'yenidogan-bebeklerin-ilkel-refleksleri-ve-anlamlari'
);

-- ISTEGE BAGLI: Sezaryen iyilesme makalesi hem hamileyi (dogum oncesi merak)
-- hem lohusayi (iyilesme sureci) ilgilendiriyor. Su an hamilelerde gorunuyor.
-- Lohusa tarafina tasimak istersen asagidaki iki satirin basindaki -- isaretini
-- kaldirip calistir:
--
-- update public.articles set category = 'bebek', sort_order = 225, updated_at = now()
-- where slug = 'sezaryen-dogum-nedir-hangi-durumlarda-yapilir-ve-iyilesme-sureci-nasildir';

-- Kontrol: dogum sonrasi annelere gorunen tum makaleler.
select sort_order, category, slug
from public.articles
where category = 'bebek' and is_published = true
order by sort_order;
