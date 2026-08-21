create table if not exists public.weekly_checkin_question_packs (
  id uuid primary key default gen_random_uuid(),
  life_stage text not null check (life_stage in ('pregnancy', 'postpartum')),
  rotation_index integer not null check (rotation_index between 0 and 7),
  version integer not null default 1 check (version > 0),
  title text not null,
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (life_stage, rotation_index, version)
);

create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  life_stage text not null check (life_stage in ('pregnancy', 'postpartum')),
  week_key date not null,
  pack_id uuid not null references public.weekly_checkin_question_packs(id),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  focus_tags text[] not null default '{}',
  optional_note text check (char_length(optional_note) <= 160),
  created_at timestamptz not null default now(),
  unique (profile_id, life_stage, week_key)
);

create table if not exists public.daily_experience_content (
  content_key text primary key check (char_length(content_key) between 3 and 80),
  life_stage text not null check (life_stage in ('pregnancy', 'postpartum')),
  day_slot integer not null check (day_slot between 0 and 6),
  focus_tag text,
  title text not null,
  body text not null,
  action_label text not null,
  destination text not null,
  stage_fact text not null,
  premium_title text not null,
  premium_body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_experience_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  experience_date date not null,
  life_stage text not null check (life_stage in ('pregnancy', 'postpartum')),
  content_key text not null references public.daily_experience_content(content_key),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  opened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, experience_date)
);

alter table public.weekly_checkin_question_packs enable row level security;
alter table public.weekly_checkins enable row level security;
alter table public.daily_experience_content enable row level security;
alter table public.daily_experience_assignments enable row level security;

drop policy if exists "weekly_checkins_owner_all" on public.weekly_checkins;
create policy "weekly_checkins_owner_all"
  on public.weekly_checkins for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "daily_experience_assignments_owner_select" on public.daily_experience_assignments;
create policy "daily_experience_assignments_owner_select"
  on public.daily_experience_assignments for select
  using (auth.uid() = profile_id);

revoke all on public.weekly_checkin_question_packs from public, anon, authenticated;
revoke all on public.daily_experience_content from public, anon, authenticated;
revoke all on public.weekly_checkins from public, anon;
revoke all on public.daily_experience_assignments from public, anon;
grant select, insert on public.weekly_checkins to authenticated;
grant select on public.daily_experience_assignments to authenticated;

insert into public.weekly_checkin_question_packs (
  life_stage, rotation_index, version, title, questions
)
select stage, rotation_index, 1, title, questions::jsonb
from (values
  ('pregnancy', 0, 'Bu hafta bedenini dinleyelim', '[{"id":"energy","text":"Enerjin bu hafta nasıl?","options":[{"id":"steady","label":"Dengeli","focus_tag":"balance"},{"id":"changing","label":"Değişken","focus_tag":"energy"},{"id":"low","label":"Oldukça düşük","focus_tag":"rest"}]},{"id":"sleep","text":"Uykun seni ne kadar dinlendiriyor?","options":[{"id":"good","label":"İyi","focus_tag":"balance"},{"id":"mixed","label":"Bazen","focus_tag":"sleep"},{"id":"hard","label":"Zorlanıyorum","focus_tag":"sleep"}]},{"id":"support","text":"Bu hafta en çok ne iyi gelir?","options":[{"id":"rest","label":"Dinlenmek","focus_tag":"rest"},{"id":"movement","label":"Hafif hareket","focus_tag":"movement"},{"id":"talk","label":"Destek almak","focus_tag":"support"}]}]'),
  ('pregnancy', 1, 'Haftanın konfor alanı', '[{"id":"comfort","text":"Bedeninde en çok hangi alan dikkat istiyor?","options":[{"id":"back","label":"Bel ve sırt","focus_tag":"comfort"},{"id":"legs","label":"Bacaklar","focus_tag":"movement"},{"id":"general","label":"Genel yorgunluk","focus_tag":"rest"}]},{"id":"appetite","text":"Beslenme düzenin nasıl gidiyor?","options":[{"id":"easy","label":"Rahat","focus_tag":"balance"},{"id":"variable","label":"Değişken","focus_tag":"nutrition"},{"id":"hard","label":"Zorlanıyorum","focus_tag":"nutrition"}]},{"id":"priority","text":"Bugün neyi kolaylaştırmak istersin?","options":[{"id":"plan","label":"Plan yapmak","focus_tag":"preparation"},{"id":"calm","label":"Sakinleşmek","focus_tag":"calm"},{"id":"learn","label":"Bilgi edinmek","focus_tag":"learning"}]}]'),
  ('pregnancy', 2, 'Duygularına yer açalım', '[{"id":"mood","text":"Duyguların bu hafta nasıl?","options":[{"id":"calm","label":"Sakin","focus_tag":"balance"},{"id":"mixed","label":"Karışık","focus_tag":"calm"},{"id":"worried","label":"Kaygılı","focus_tag":"support"}]},{"id":"connection","text":"Bebeğinle bağını bugün nasıl hissediyorsun?","options":[{"id":"close","label":"Yakın","focus_tag":"connection"},{"id":"curious","label":"Meraklı","focus_tag":"learning"},{"id":"distant","label":"Biraz uzak","focus_tag":"connection"}]},{"id":"help","text":"Desteği nerede istersin?","options":[{"id":"home","label":"Günlük işler","focus_tag":"support"},{"id":"information","label":"Doğru bilgi","focus_tag":"learning"},{"id":"listening","label":"Dinlenmek ve paylaşmak","focus_tag":"calm"}]}]'),
  ('pregnancy', 3, 'Hazırlıklarını sadeleştirelim', '[{"id":"prepared","text":"Doğuma hazırlıkta kendini nerede görüyorsun?","options":[{"id":"ready","label":"Hazır hissediyorum","focus_tag":"balance"},{"id":"starting","label":"Yeni başlıyorum","focus_tag":"preparation"},{"id":"overwhelmed","label":"Nereden başlayacağımı bilmiyorum","focus_tag":"preparation"}]},{"id":"appointments","text":"Kontrol ve soruların düzenli mi?","options":[{"id":"yes","label":"Evet","focus_tag":"balance"},{"id":"some","label":"Kısmen","focus_tag":"planning"},{"id":"no","label":"Düzenlemek istiyorum","focus_tag":"planning"}]},{"id":"focus","text":"Bu hafta tek odağın ne olsun?","options":[{"id":"body","label":"Bedenim","focus_tag":"comfort"},{"id":"baby","label":"Bebeğim","focus_tag":"connection"},{"id":"birth","label":"Doğum hazırlığı","focus_tag":"preparation"}]}]'),
  ('pregnancy', 4, 'Günlük ritmini bulalım', '[{"id":"pace","text":"Günlük tempon nasıl?","options":[{"id":"comfortable","label":"Rahat","focus_tag":"balance"},{"id":"busy","label":"Yoğun","focus_tag":"rest"},{"id":"slow","label":"Yavaşlamak istiyorum","focus_tag":"rest"}]},{"id":"water","text":"Su içmeyi hatırlamak nasıl gidiyor?","options":[{"id":"good","label":"İyi","focus_tag":"balance"},{"id":"sometimes","label":"Bazen unutuyorum","focus_tag":"nutrition"},{"id":"hard","label":"Takip etmek istiyorum","focus_tag":"nutrition"}]},{"id":"minute","text":"Bir dakikalık hangi adım iyi gelir?","options":[{"id":"breathe","label":"Nefes","focus_tag":"calm"},{"id":"stretch","label":"Esneme","focus_tag":"movement"},{"id":"plan","label":"Mini plan","focus_tag":"planning"}]}]'),
  ('pregnancy', 5, 'Bilgi ihtiyacını seç', '[{"id":"curiosity","text":"Bu hafta en çok neyi merak ediyorsun?","options":[{"id":"baby","label":"Bebek gelişimi","focus_tag":"learning"},{"id":"body","label":"Bedenimdeki değişimler","focus_tag":"comfort"},{"id":"birth","label":"Doğuma hazırlık","focus_tag":"preparation"}]},{"id":"clarity","text":"Bilgiler sana ne kadar anlaşılır geliyor?","options":[{"id":"clear","label":"Net","focus_tag":"balance"},{"id":"mixed","label":"Karışık","focus_tag":"learning"},{"id":"too_much","label":"Fazla geliyor","focus_tag":"calm"}]},{"id":"format","text":"Bugün hangi format kolay olur?","options":[{"id":"short","label":"Kısa bilgi","focus_tag":"learning"},{"id":"checklist","label":"Kontrol listesi","focus_tag":"planning"},{"id":"action","label":"Tek bir adım","focus_tag":"balance"}]}]'),
  ('pregnancy', 6, 'Destek çemberini güçlendirelim', '[{"id":"supported","text":"Bu hafta kendini ne kadar desteklenmiş hissediyorsun?","options":[{"id":"yes","label":"İyi","focus_tag":"balance"},{"id":"some","label":"Biraz","focus_tag":"support"},{"id":"no","label":"Daha çok desteğe ihtiyacım var","focus_tag":"support"}]},{"id":"share","text":"Neyi paylaşmak rahatlatır?","options":[{"id":"task","label":"Bir günlük işi","focus_tag":"support"},{"id":"feeling","label":"Nasıl hissettiğimi","focus_tag":"calm"},{"id":"plan","label":"Hazırlık planını","focus_tag":"planning"}]},{"id":"together","text":"Bugün birlikte ne yapabilirsiniz?","options":[{"id":"walk","label":"Kısa yürüyüş","focus_tag":"movement"},{"id":"talk","label":"10 dakika konuşma","focus_tag":"connection"},{"id":"prepare","label":"Bir işi hazırlama","focus_tag":"preparation"}]}]'),
  ('pregnancy', 7, 'Haftayı nazikçe kapatalım', '[{"id":"win","text":"Bu haftanın küçük kazanımı neydi?","options":[{"id":"rest","label":"Kendimi dinledim","focus_tag":"rest"},{"id":"learn","label":"Yeni bir şey öğrendim","focus_tag":"learning"},{"id":"prepare","label":"Bir hazırlık yaptım","focus_tag":"preparation"}]},{"id":"next","text":"Yeni haftada neyi korumak istersin?","options":[{"id":"calm","label":"Sakinliği","focus_tag":"calm"},{"id":"routine","label":"Küçük rutini","focus_tag":"balance"},{"id":"support","label":"Desteği","focus_tag":"support"}]},{"id":"kindness","text":"Kendine bugün nasıl yaklaşacaksın?","options":[{"id":"rest","label":"Dinlenerek","focus_tag":"rest"},{"id":"move","label":"Hafif hareketle","focus_tag":"movement"},{"id":"pause","label":"Kısa bir molayla","focus_tag":"calm"}]}]'),
  ('postpartum', 0, 'Bu hafta yükünü hafifletelim', '[{"id":"rest","text":"Dinlenme durumun nasıl?","options":[{"id":"enough","label":"Yeterli","focus_tag":"balance"},{"id":"broken","label":"Bölünüyor","focus_tag":"sleep"},{"id":"low","label":"Çok az","focus_tag":"rest"}]},{"id":"load","text":"Bakım yükü bugün nasıl hissettiriyor?","options":[{"id":"shared","label":"Paylaşılıyor","focus_tag":"balance"},{"id":"variable","label":"Değişken","focus_tag":"support"},{"id":"heavy","label":"Ağır","focus_tag":"support"}]},{"id":"need","text":"En çok neyi kolaylaştırmak istersin?","options":[{"id":"sleep","label":"Uyku düzeni","focus_tag":"sleep"},{"id":"records","label":"Bakım kayıtları","focus_tag":"planning"},{"id":"self","label":"Kendime zaman","focus_tag":"rest"}]}]'),
  ('postpartum', 1, 'Günün bakım ritmi', '[{"id":"routine","text":"Bebeğinin rutini bugün nasıl?","options":[{"id":"clear","label":"Belirgin","focus_tag":"balance"},{"id":"changing","label":"Değişiyor","focus_tag":"routine"},{"id":"unclear","label":"Takip etmek istiyorum","focus_tag":"planning"}]},{"id":"feeding","text":"Beslenme takibi sana nasıl geliyor?","options":[{"id":"easy","label":"Kolay","focus_tag":"balance"},{"id":"mixed","label":"Bazen zor","focus_tag":"feeding"},{"id":"help","label":"Düzenlemek istiyorum","focus_tag":"feeding"}]},{"id":"minute","text":"Bir dakikada ne iyi gelir?","options":[{"id":"record","label":"Son bakımı kaydetmek","focus_tag":"planning"},{"id":"water","label":"Su içmek","focus_tag":"rest"},{"id":"handover","label":"Bakımı paylaşmak","focus_tag":"support"}]}]'),
  ('postpartum', 2, 'Sen de bu bakımın içindesin', '[{"id":"mood","text":"Bugün duyguların nasıl?","options":[{"id":"steady","label":"Dengeli","focus_tag":"balance"},{"id":"mixed","label":"Karışık","focus_tag":"calm"},{"id":"hard","label":"Zorlanıyorum","focus_tag":"support"}]},{"id":"selfcare","text":"Kendin için alan bulabiliyor musun?","options":[{"id":"yes","label":"Evet","focus_tag":"balance"},{"id":"little","label":"Çok az","focus_tag":"rest"},{"id":"none","label":"Desteğe ihtiyacım var","focus_tag":"support"}]},{"id":"kind","text":"Bugünkü küçük öz bakımın ne olsun?","options":[{"id":"meal","label":"Bir öğün","focus_tag":"rest"},{"id":"shower","label":"Kısa duş","focus_tag":"rest"},{"id":"quiet","label":"Sessiz bir mola","focus_tag":"calm"}]}]'),
  ('postpartum', 3, 'Uyku işaretlerini okuyalım', '[{"id":"baby_sleep","text":"Bebeğinin uyku işaretleri nasıl?","options":[{"id":"clear","label":"Fark ediyorum","focus_tag":"balance"},{"id":"sometimes","label":"Bazen","focus_tag":"sleep"},{"id":"track","label":"Takip etmek istiyorum","focus_tag":"sleep"}]},{"id":"night","text":"Geceler nasıl geçiyor?","options":[{"id":"shared","label":"Paylaşıyoruz","focus_tag":"balance"},{"id":"variable","label":"Değişken","focus_tag":"routine"},{"id":"hard","label":"Çok yorucu","focus_tag":"support"}]},{"id":"next","text":"Bu gece tek kolaylık ne olsun?","options":[{"id":"prepare","label":"Önceden hazırlık","focus_tag":"planning"},{"id":"shift","label":"Bakım vardiyası","focus_tag":"support"},{"id":"record","label":"Uyku kaydı","focus_tag":"sleep"}]}]'),
  ('postpartum', 4, 'Ailece koordinasyon', '[{"id":"sharing","text":"Bakım görevleri nasıl paylaşılıyor?","options":[{"id":"well","label":"Dengeli","focus_tag":"balance"},{"id":"some","label":"Kısmen","focus_tag":"support"},{"id":"alone","label":"Çoğu bende","focus_tag":"support"}]},{"id":"communication","text":"Son durum aile için ne kadar net?","options":[{"id":"clear","label":"Net","focus_tag":"balance"},{"id":"mixed","label":"Bazen karışıyor","focus_tag":"planning"},{"id":"unclear","label":"Özet istiyorum","focus_tag":"planning"}]},{"id":"delegate","text":"Bugün neyi devredebilirsin?","options":[{"id":"feeding","label":"Bir beslenme hazırlığı","focus_tag":"feeding"},{"id":"diaper","label":"Bir bakım görevi","focus_tag":"support"},{"id":"home","label":"Bir ev işi","focus_tag":"support"}]}]'),
  ('postpartum', 5, 'Gelişimi merakla izle', '[{"id":"curiosity","text":"Bu hafta en çok neyi merak ediyorsun?","options":[{"id":"sleep","label":"Uyku","focus_tag":"sleep"},{"id":"feeding","label":"Beslenme","focus_tag":"feeding"},{"id":"development","label":"Gelişim","focus_tag":"learning"}]},{"id":"records","text":"Bakım kayıtları ne kadar düzenli?","options":[{"id":"good","label":"Düzenli","focus_tag":"balance"},{"id":"some","label":"Aralıklı","focus_tag":"routine"},{"id":"start","label":"Kolaylaştırmak istiyorum","focus_tag":"planning"}]},{"id":"format","text":"Bugün ne işine yarar?","options":[{"id":"fact","label":"Kısa bilgi","focus_tag":"learning"},{"id":"summary","label":"Gün özeti","focus_tag":"planning"},{"id":"action","label":"Tek bir adım","focus_tag":"balance"}]}]'),
  ('postpartum', 6, 'Kendine destek iste', '[{"id":"heard","text":"Kendini ne kadar duyulmuş hissediyorsun?","options":[{"id":"yes","label":"İyi","focus_tag":"balance"},{"id":"some","label":"Biraz","focus_tag":"support"},{"id":"no","label":"Daha çok desteğe ihtiyacım var","focus_tag":"support"}]},{"id":"ask","text":"Bugün ne istemek kolay olur?","options":[{"id":"rest","label":"Dinlenme zamanı","focus_tag":"rest"},{"id":"task","label":"Bir bakım görevi","focus_tag":"support"},{"id":"talk","label":"Konuşmak","focus_tag":"calm"}]},{"id":"connection","text":"Ailece küçük bağ anınız ne olsun?","options":[{"id":"photo","label":"Bir fotoğraf","focus_tag":"connection"},{"id":"walk","label":"Kısa yürüyüş","focus_tag":"movement"},{"id":"quiet","label":"Birlikte sakinlik","focus_tag":"connection"}]}]'),
  ('postpartum', 7, 'Haftanın küçük kazanımları', '[{"id":"win","text":"Bu hafta ne biraz kolaylaştı?","options":[{"id":"routine","label":"Bir rutin","focus_tag":"routine"},{"id":"sharing","label":"Bakımı paylaşmak","focus_tag":"support"},{"id":"understanding","label":"Bebeği anlamak","focus_tag":"connection"}]},{"id":"keep","text":"Yeni haftada neyi korumak istersin?","options":[{"id":"record","label":"Kısa kayıtları","focus_tag":"planning"},{"id":"rest","label":"Dinlenme fırsatını","focus_tag":"rest"},{"id":"support","label":"Aile desteğini","focus_tag":"support"}]},{"id":"today","text":"Bugünlük ne yeterli?","options":[{"id":"one_task","label":"Tek bir bakım işi","focus_tag":"balance"},{"id":"one_break","label":"Tek bir mola","focus_tag":"rest"},{"id":"one_note","label":"Tek bir not","focus_tag":"planning"}]}]')
) as seed(stage, rotation_index, title, questions)
on conflict (life_stage, rotation_index, version) do update
set title = excluded.title, questions = excluded.questions, active = true;

insert into public.daily_experience_content (
  content_key, life_stage, day_slot, focus_tag, title, body, action_label,
  destination, stage_fact, premium_title, premium_body
)
values
  ('pregnancy_mon_calm','pregnancy',0,null,'Bugüne sakin bir başlangıç','Omuzlarını gevşet ve dört yavaş nefes al. Küçük bir duraklama günün temposunu değiştirebilir.','1 dakikalık nefesi başlat','pregnancy-exercise','Gebelikte enerji gün içinde değişebilir; temponu bedenine göre ayarlaman normaldir.','Bu haftanın enerji eğilimi','Premium ile son haftalardaki enerji ve dinlenme cevaplarını birlikte gör.'),
  ('pregnancy_tue_nutrition','pregnancy',1,null,'Bugünün küçük desteği','Yanına bir bardak su koy ve bir sonraki öğününü acele etmeden planla.','Beslenme alanını aç','pregnancy-nutrition','Düzenli küçük öğünler bazı günlerde büyük porsiyonlardan daha rahat gelebilir.','Kişisel haftalık plan','Premium, check-in yanıtlarından ayrıntılı bir haftalık plan oluşturur.'),
  ('pregnancy_wed_learn','pregnancy',2,null,'Bu haftanı biraz daha tanı','Bebeğinin ve bedeninin bu haftadaki değişimlerini bir dakikada gözden geçir.','Haftamı aç','pregnancy-timeline','Her gebelik farklı ilerler; haftalık bilgiler genel bir rehberdir.','Haftalar arası değişim','Premium ile önceki haftaların odağını ve değişimini karşılaştır.'),
  ('pregnancy_thu_move','pregnancy',3,null,'Bedenine uygun küçük hareket','Kendini iyi hissediyorsan kısa ve rahat bir esneme için alan aç. Ağrı varsa dur.','Güvenli hareketleri aç','pregnancy-exercise','Yeni veya şiddetli bir belirti olduğunda egzersiz yerine sağlık uzmanına danışmak önemlidir.','Kişisel hareket özeti','Premium ile enerji ve konfor yanıtlarına göre ayrıntılı planı gör.'),
  ('pregnancy_fri_prepare','pregnancy',4,null,'Haftanın tek hazırlığı','Doktoruna sormak istediğin tek soruyu şimdi not et.','Doktor hazırlığını aç','doctor-visit','Kısa bir soru listesi görüşmede önemli ayrıntıları hatırlamayı kolaylaştırabilir.','Doktor için haftalık PDF','Premium ile check-in ve kayıtlarından doktor görüşmesi özeti oluştur.'),
  ('pregnancy_sat_support','pregnancy',5,null,'Bugün yükü paylaş','Ailenden bugün tek, net ve küçük bir destek iste.','Aile planını aç','family-planner','Net ve küçük bir istek, desteğin paylaşılmasını kolaylaştırabilir.','Destek eğilimleri','Premium ile hangi alanlarda daha çok desteğe ihtiyaç duyduğunu gör.'),
  ('pregnancy_sun_reflect','pregnancy',6,null,'Bu hafta ne iyi geldi?','Bu haftadan korumak istediğin tek küçük alışkanlığı seç.','Haftamı gözden geçir','home','Küçük ve sürdürülebilir rutinler yoğun haftalarda daha kolay korunabilir.','Haftalık kişisel özet','Premium ile cevaplarının haftalık özetini ve sonraki adımlarını aç.'),
  ('postpartum_mon_rest','postpartum',0,null,'Bugün sen de bakım listesindesin','Bir bardak su, kısa bir öğün veya beş dakikalık mola seç. Bir tanesi yeter.','Bakım günlüğünü aç','care-journal','Doğum sonrası dönemde bakım veren kişinin dinlenmesi de aile bakımının parçasıdır.','Dinlenme eğilimin','Premium ile son haftalardaki dinlenme ve bakım yükü değişimini gör.'),
  ('postpartum_tue_routine','postpartum',1,null,'Bugünün ritmini görünür yap','Son beslenme, uyku veya bez kaydından yalnızca birini ekle.','Hızlı kayıt aç','care-journal','Kısa kayıtlar zaman içinde rutindeki değişimleri görmeyi kolaylaştırır.','Bakım eğilimleri','Premium ile 7 ve 30 günlük bakım örüntülerini karşılaştır.'),
  ('postpartum_wed_sleep','postpartum',2,null,'Uyku işaretlerine küçük bakış','Bugün tek bir uyku başlangıç ve bitişini kaydetmeyi dene.','Uyku ritmini aç','sleep-rhythm','Bebek uykusu özellikle ilk aylarda sık değişebilir; tek bir gün kesin düzen göstermez.','Akıllı uyku tahmini','Premium ile yeterli kayıt oluştuğunda yaklaşan uyku penceresini gör.'),
  ('postpartum_thu_share','postpartum',3,null,'Bir görevi paylaş','Aileden bir kişiye tek ve net bir bakım işi devret.','Aile planını aç','family-planner','Bakım devri sırasında son beslenme, uyku ve ilaç bilgisinin net olması yardımcı olabilir.','Aile koordinasyon özeti','Premium ile bakım devirlerini ve aile görevlerini tek yerde izle.'),
  ('postpartum_fri_connect','postpartum',4,null,'Bugünün küçük anısı','Bugünden saklamak istediğin tek küçük anı seç.','Anı galerisine git','gallery','Günlük hayatın sıradan görünen anları zaman içinde değerli bir arşive dönüşebilir.','Sınırsız anı arşivi','Premium ile daha fazla fotoğraf ve kalıcı aile arşivi oluştur.'),
  ('postpartum_sat_prepare','postpartum',5,null,'Kontrol için bir not','Bebeğin veya kendin için sağlık uzmanına sormak istediğin tek soruyu kaydet.','Doktor hazırlığını aç','doctor-visit','Kayıtların tarih ve saat içermesi görüşmede örüntüyü anlatmayı kolaylaştırabilir.','Doktor için PDF özeti','Premium ile bakım kayıtlarını doktor görüşmesi için düzenli PDF yap.'),
  ('postpartum_sun_reflect','postpartum',6,null,'Bu hafta ne kolaylaştı?','Yeni haftaya taşımak istediğin tek bakım kolaylığını seç.','Bugünün özetini aç','care-journal','Her hafta aynı ilerlemek zorunda değildir; küçük kolaylıkları fark etmek değerlidir.','Kişisel haftalık özet','Premium ile haftalık check-in ve bakım değişimlerini birlikte gör.')
on conflict (content_key) do update set
  title = excluded.title,
  body = excluded.body,
  action_label = excluded.action_label,
  destination = excluded.destination,
  stage_fact = excluded.stage_fact,
  premium_title = excluded.premium_title,
  premium_body = excluded.premium_body,
  active = true;

-- Weekly answers are allowed to change the next daily recommendation. These
-- focused variants intentionally stay small and actionable; the generic card
-- remains the fallback when there is no recent check-in.
insert into public.daily_experience_content (
  content_key, life_stage, day_slot, focus_tag, title, body, action_label,
  destination, stage_fact, premium_title, premium_body
)
values
  ('pregnancy_focus_rest','pregnancy',0,'rest','Bugün temponu yumuşat','Yapılacaklarından birini ertele ve kendine on dakikalık gerçek bir dinlenme alanı aç.','Sakin hareketleri aç','pregnancy-exercise','Enerji ihtiyacının günden güne değişmesi gebelikte sık görülebilir.','Dinlenme eğilimin','Premium ile haftalık enerji ve dinlenme cevaplarının değişimini gör.'),
  ('pregnancy_focus_nutrition','pregnancy',1,'nutrition','Bugün beslenmeni kolaylaştır','Bir sonraki öğün için ulaşması kolay tek bir seçenek ve yanına su hazırla.','Beslenme alanını aç','pregnancy-nutrition','Küçük hazırlıklar yoğun veya iştahsız günlerde düzeni korumayı kolaylaştırabilir.','Kişisel beslenme planın','Premium ile haftalık yanıtlarından ayrıntılı bir plan oluştur.'),
  ('pregnancy_focus_learning','pregnancy',2,'learning','Merak ettiğin haftayı keşfet','Bugün yalnızca bulunduğun haftanın en önemli değişimine göz at.','Bu haftayı aç','pregnancy-timeline','Haftalık gelişim bilgileri genel rehberdir; kişisel tıbbi değerlendirme yerine geçmez.','Haftalık gelişim özeti','Premium ile haftalar arasındaki değişimleri tek yerde karşılaştır.'),
  ('pregnancy_focus_movement','pregnancy',3,'movement','Harekete küçük bir yer aç','Kendini iyi hissediyorsan kısa ve rahat bir esneme seç; rahatsızlıkta dur.','Güvenli hareketleri aç','pregnancy-exercise','Yeni veya şiddetli belirtilerde sağlık uzmanına danışmak önemlidir.','Kişisel hareket planı','Premium ile enerji ve konfor yanıtlarına göre ayrıntılı planı gör.'),
  ('pregnancy_focus_preparation','pregnancy',4,'preparation','Hazırlık yükünü tek adıma indir','Doktoruna veya doğum hazırlığına dair yalnızca tek soruyu not et.','Doktor notlarını aç','doctor-visit','Kısa bir soru listesi görüşmedeki önemli ayrıntıları hatırlatabilir.','Doktor için PDF','Premium ile kayıtlarından düzenli doktor görüşmesi özeti oluştur.'),
  ('pregnancy_focus_support','pregnancy',5,'support','Bugün desteği görünür yap','Yakınından isteyebileceğin küçük ve net bir işi şimdi seç.','Aile planını aç','family-planner','Net bir istek bakım ve hazırlık yükünün paylaşılmasını kolaylaştırabilir.','Destek eğilimlerin','Premium ile desteğe en çok ihtiyaç duyduğun alanları gör.'),
  ('postpartum_focus_rest','postpartum',0,'rest','Bugün sen de bakım listesindesin','Su, öğün veya kısa mola: şimdi yalnızca birini kendin için seç.','Bakım günlüğünü aç','care-journal','Bakım veren kişinin temel ihtiyaçları da aile bakımının bir parçasıdır.','Dinlenme eğilimin','Premium ile dinlenme ve bakım yükündeki değişimi gör.'),
  ('postpartum_focus_feeding','postpartum',1,'feeding','Beslenme takibini tek kayda indir','Bir sonraki beslenmede yalnızca saat ve süreyi kaydetmen bugün için yeterli.','Hızlı kayıt aç','care-journal','Kısa ve düzenli kayıtlar rutindeki değişimleri fark etmeyi kolaylaştırabilir.','Beslenme eğilimleri','Premium ile 7 ve 30 günlük bakım örüntülerini karşılaştır.'),
  ('postpartum_focus_sleep','postpartum',2,'sleep','Bugün tek uyku penceresini izle','Yalnızca bir uyku başlangıcı ve bitişini kaydet; bütün günü takip etmek zorunda değilsin.','Uyku ritmini aç','sleep-rhythm','Bebek uykusu özellikle ilk aylarda sık değişebilir.','Akıllı uyku tahmini','Premium ile yeterli kayıt olduğunda yaklaşan uyku penceresini gör.'),
  ('postpartum_focus_support','postpartum',3,'support','Bir bakım işini devret','Aileden bir kişiye bugün tamamlayabileceği tek ve net bir bakım işi ver.','Aile planını aç','family-planner','Net bakım devri aile içi koordinasyonu kolaylaştırabilir.','Aile koordinasyon özeti','Premium ile bakım devirlerini ve aile görevlerini tek yerde izle.'),
  ('postpartum_focus_connection','postpartum',4,'connection','Bugünden küçük bir an sakla','Günün kusursuz olmasını beklemeden size iyi gelen tek anı kaydet.','Anı galerisine git','gallery','Sıradan anlar zaman içinde değerli bir aile arşivine dönüşebilir.','Sınırsız anı arşivi','Premium ile daha fazla fotoğraf ve kalıcı aile arşivi oluştur.'),
  ('postpartum_focus_planning','postpartum',5,'planning','Kontrol için tek not hazırla','Sağlık uzmanına sormak istediğin tek soruyu tarih ve saatiyle kaydet.','Doktor hazırlığını aç','doctor-visit','Tarihli kısa kayıtlar görüşmede örüntüyü anlatmayı kolaylaştırabilir.','Doktor için PDF özeti','Premium ile bakım kayıtlarını düzenli doktor görüşmesi PDF’ine dönüştür.')
on conflict (content_key) do update set
  title = excluded.title,
  body = excluded.body,
  action_label = excluded.action_label,
  destination = excluded.destination,
  stage_fact = excluded.stage_fact,
  premium_title = excluded.premium_title,
  premium_body = excluded.premium_body,
  active = true;

create or replace function public.current_turkey_date()
returns date
language sql
stable
set search_path = public
as $$
  select timezone('Europe/Istanbul', now())::date;
$$;

create or replace function public.ensure_daily_experience_for_profile(p_profile_id uuid)
returns public.daily_experience_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.current_turkey_date();
  v_stage text;
  v_slot integer := extract(isodow from v_today)::integer - 1;
  v_focus_tags text[] := array[]::text[];
  v_content public.daily_experience_content;
  v_assignment public.daily_experience_assignments;
begin
  if p_profile_id is null then
    raise exception 'profile_required' using errcode = '22023';
  end if;

  select case when p.is_pregnant then 'pregnancy' else 'postpartum' end
  into v_stage
  from public.profiles p
  where p.id = p_profile_id and p.onboarding_completed;

  if v_stage is null then return null; end if;

  select coalesce(w.focus_tags, array[]::text[])
  into v_focus_tags
  from public.weekly_checkins w
  where w.profile_id = p_profile_id
    and w.life_stage = v_stage
  order by w.week_key desc
  limit 1;

  select * into v_assignment
  from public.daily_experience_assignments
  where profile_id = p_profile_id and experience_date = v_today;
  if found then return v_assignment; end if;

  select c.* into v_content
  from public.daily_experience_content c
  where c.life_stage = v_stage
    and c.active
    and (
      (c.focus_tag is null and c.day_slot = v_slot)
      or c.focus_tag = any(coalesce(v_focus_tags, array[]::text[]))
    )
    and not exists (
      select 1 from public.daily_experience_assignments recent
      where recent.profile_id = p_profile_id
        and recent.content_key = c.content_key
        and recent.experience_date >= v_today - 14
    )
  order by
    case when c.focus_tag = any(coalesce(v_focus_tags, array[]::text[])) then 0 else 1 end,
    hashtextextended(p_profile_id::text || v_today::text || c.content_key, 0)
  limit 1;

  if v_content.content_key is null then
    select c.* into v_content
    from public.daily_experience_content c
    where c.life_stage = v_stage and c.day_slot = v_slot and c.active
    order by c.content_key
    limit 1;
  end if;

  insert into public.daily_experience_assignments (
    profile_id, experience_date, life_stage, content_key, payload
  ) values (
    p_profile_id,
    v_today,
    v_stage,
    v_content.content_key,
    jsonb_build_object(
      'title', v_content.title,
      'body', v_content.body,
      'action_label', v_content.action_label,
      'destination', v_content.destination,
      'stage_fact', v_content.stage_fact,
      'premium_title', v_content.premium_title,
      'premium_body', v_content.premium_body
    )
  )
  on conflict (profile_id, experience_date) do update
    set profile_id = excluded.profile_id
  returning * into v_assignment;

  return v_assignment;
end;
$$;

create or replace function public.get_weekly_checkin_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_stage text;
  v_week_key date := date_trunc('week', timezone('Europe/Istanbul', now()))::date;
  v_rotation integer := mod(extract(week from timezone('Europe/Istanbul', now()))::integer, 8);
  v_pack public.weekly_checkin_question_packs;
  v_existing public.weekly_checkins;
begin
  if auth.uid() is null or v_profile_id is null or auth.uid() <> v_profile_id then
    raise exception 'maternal_account_required' using errcode = '42501';
  end if;

  select case when p.is_pregnant then 'pregnancy' else 'postpartum' end
  into v_stage from public.profiles p where p.id = v_profile_id;

  select * into v_pack from public.weekly_checkin_question_packs
  where life_stage = v_stage and rotation_index = v_rotation and active
  order by version desc limit 1;

  select * into v_existing from public.weekly_checkins
  where profile_id = v_profile_id and life_stage = v_stage and week_key = v_week_key;

  return jsonb_build_object(
    'life_stage', v_stage,
    'week_key', v_week_key,
    'needs_checkin', v_existing.id is null,
    'pack_id', v_pack.id,
    'pack_version', v_pack.version,
    'title', v_pack.title,
    'questions', coalesce(v_pack.questions, '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_weekly_checkin(
  p_answers jsonb,
  p_optional_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_stage text;
  v_week_key date := date_trunc('week', timezone('Europe/Istanbul', now()))::date;
  v_rotation integer := mod(extract(week from timezone('Europe/Istanbul', now()))::integer, 8);
  v_pack public.weekly_checkin_question_packs;
  v_checkin public.weekly_checkins;
  v_focus_tags text[];
begin
  if auth.uid() is null or v_profile_id is null or auth.uid() <> v_profile_id then
    raise exception 'maternal_account_required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers_object_required' using errcode = '22023';
  end if;
  if char_length(coalesce(p_optional_note, '')) > 160 then
    raise exception 'optional_note_too_long' using errcode = '22001';
  end if;

  select case when p.is_pregnant then 'pregnancy' else 'postpartum' end
  into v_stage from public.profiles p where p.id = v_profile_id;

  select * into v_pack from public.weekly_checkin_question_packs
  where life_stage = v_stage and rotation_index = v_rotation and active
  order by version desc limit 1;

  if exists (
    select 1
    from jsonb_array_elements(v_pack.questions) question
    where not (p_answers ? (question->>'id'))
      or not exists (
        select 1 from jsonb_array_elements(question->'options') option
        where option->>'id' = p_answers->>(question->>'id')
      )
  ) then
    raise exception 'invalid_checkin_answers' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct option->>'focus_tag'), '{}')
  into v_focus_tags
  from jsonb_array_elements(v_pack.questions) question
  cross join lateral jsonb_array_elements(question->'options') option
  where option->>'id' = p_answers->>(question->>'id')
    and nullif(option->>'focus_tag', '') is not null;

  insert into public.weekly_checkins (
    profile_id, life_stage, week_key, pack_id, answers, focus_tags, optional_note
  ) values (
    v_profile_id, v_stage, v_week_key, v_pack.id, p_answers,
    coalesce(v_focus_tags, '{}'), nullif(trim(p_optional_note), '')
  )
  on conflict (profile_id, life_stage, week_key) do nothing
  returning * into v_checkin;

  if v_checkin.id is null then
    select * into v_checkin from public.weekly_checkins
    where profile_id = v_profile_id and life_stage = v_stage and week_key = v_week_key;
  end if;

  return jsonb_build_object(
    'id', v_checkin.id,
    'life_stage', v_checkin.life_stage,
    'week_key', v_checkin.week_key,
    'focus_tags', v_checkin.focus_tags,
    'created_at', v_checkin.created_at
  );
end;
$$;

create or replace function public.get_today_daily_experience()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.get_active_profile_id();
  v_assignment public.daily_experience_assignments;
begin
  if auth.uid() is null or v_profile_id is null or auth.uid() <> v_profile_id then
    raise exception 'maternal_account_required' using errcode = '42501';
  end if;

  v_assignment := public.ensure_daily_experience_for_profile(v_profile_id);
  if v_assignment.id is null then return null; end if;

  update public.daily_experience_assignments
  set opened_at = coalesce(opened_at, now())
  where id = v_assignment.id
  returning * into v_assignment;

  return jsonb_build_object(
    'id', v_assignment.id,
    'experience_date', v_assignment.experience_date,
    'life_stage', v_assignment.life_stage,
    'content_key', v_assignment.content_key,
    'payload', v_assignment.payload,
    'opened_at', v_assignment.opened_at,
    'completed_at', v_assignment.completed_at
  );
end;
$$;

create or replace function public.complete_daily_experience(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.daily_experience_assignments;
begin
  update public.daily_experience_assignments
  set completed_at = coalesce(completed_at, now()), opened_at = coalesce(opened_at, now())
  where id = p_assignment_id and profile_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'daily_experience_not_found' using errcode = '42501';
  end if;

  return jsonb_build_object('id', v_row.id, 'completed_at', v_row.completed_at);
end;
$$;

revoke all on function public.current_turkey_date() from public, anon;
revoke all on function public.ensure_daily_experience_for_profile(uuid) from public, anon, authenticated;
revoke all on function public.get_weekly_checkin_context() from public, anon;
revoke all on function public.submit_weekly_checkin(jsonb, text) from public, anon;
revoke all on function public.get_today_daily_experience() from public, anon;
revoke all on function public.complete_daily_experience(uuid) from public, anon;
grant execute on function public.current_turkey_date() to authenticated, service_role;
grant execute on function public.ensure_daily_experience_for_profile(uuid) to service_role;
grant execute on function public.get_weekly_checkin_context() to authenticated;
grant execute on function public.submit_weekly_checkin(jsonb, text) to authenticated;
grant execute on function public.get_today_daily_experience() to authenticated;
grant execute on function public.complete_daily_experience(uuid) to authenticated;
