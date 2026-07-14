-- ============================================================
-- 0013: İş Mantığı Fonksiyonları ve Trigger'lar
-- ============================================================

-- ------------------------------------------------------------
-- Bir bebek eklendiğinde, vaccine_schedule referans tablosundaki
-- tüm aşılar için otomatik olarak kişiselleştirilmiş
-- baby_vaccinations satırları oluşturur.
-- ------------------------------------------------------------
create or replace function public.generate_baby_vaccination_schedule()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.baby_vaccinations (baby_id, vaccine_schedule_id, scheduled_date)
  select
    new.id,
    vs.id,
    (new.birth_date + (vs.recommended_age_days || ' days')::interval)::date
  from public.vaccine_schedule vs
  on conflict (baby_id, vaccine_schedule_id) do nothing;

  return new;
end;
$$;

comment on function public.generate_baby_vaccination_schedule() is
  'babies tablosuna INSERT sonrası tetiklenir, resmi aşı takvimine göre kişiye özel aşı planı oluşturur.';

drop trigger if exists on_baby_created_generate_vaccinations on public.babies;
create trigger on_baby_created_generate_vaccinations
  after insert on public.babies
  for each row execute function public.generate_baby_vaccination_schedule();

-- ------------------------------------------------------------
-- Yaklaşan aşıları bulan yardımcı fonksiyon (Edge Function bunu çağırabilir
-- veya benzer bir sorguyu doğrudan RPC olarak kullanabilir).
-- Örnek: bugünden itibaren 3 gün içinde zamanı gelen, henüz yapılmamış aşılar.
-- ------------------------------------------------------------
create or replace function public.get_upcoming_vaccinations(days_ahead int default 3)
returns table (
  baby_id uuid,
  parent_id uuid,
  vaccine_name text,
  scheduled_date date
)
language sql
security definer set search_path = public
stable
as $$
  select
    bv.baby_id,
    b.parent_id,
    vs.vaccine_name,
    bv.scheduled_date
  from public.baby_vaccinations bv
  join public.babies b on b.id = bv.baby_id
  join public.vaccine_schedule vs on vs.id = bv.vaccine_schedule_id
  where bv.completed = false
    and bv.scheduled_date between current_date and (current_date + (days_ahead || ' days')::interval)::date;
$$;

comment on function public.get_upcoming_vaccinations(int) is
  'Push bildirim gönderecek Edge Function tarafından çağrılır; yalnızca aşı hatırlatma amaçlıdır.';

-- ------------------------------------------------------------
-- GÜNLÜK CRON JOB ÖRNEĞİ (opsiyonel — pg_cron + pg_net gerektirir)
-- Bu job, her gün saat 08:00 UTC'de bir Edge Function'ı tetikleyerek
-- get_upcoming_vaccinations() sonucuna göre push bildirim gönderilmesini sağlar.
--
-- ÖNEMLİ: <PROJECT_REF> ve <SERVICE_ROLE_KEY> yerine kendi değerlerinizi
-- yazın. Güvenlik için service_role key'i doğrudan SQL'e yazmak yerine
-- Supabase Vault (vault.decrypted_secrets) kullanılması önerilir.
-- Alternatif olarak bu cron job'u Supabase Dashboard > Database > Cron Jobs
-- arayüzünden de oluşturabilirsiniz.
-- ------------------------------------------------------------
-- select cron.schedule(
--   'daily-vaccine-reminder',
--   '0 8 * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-vaccine-reminders',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
