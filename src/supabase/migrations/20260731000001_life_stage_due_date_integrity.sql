-- Keep the life-stage discriminator and pregnancy due date coherent even when
-- a client bypasses the app-side date picker.

create or replace function public.validate_profile_pregnancy_due_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_pregnant is not distinct from old.is_pregnant
     and new.due_date is not distinct from old.due_date then
    return new;
  end if;

  if new.is_pregnant and new.due_date is null and new.onboarding_completed then
    raise exception 'Hamilelik profili için tahmini doğum tarihi gereklidir.';
  end if;

  if new.is_pregnant
     and (new.due_date < current_date - 14 or new.due_date > current_date + 294) then
    raise exception 'Tahmini doğum tarihi bugünden en fazla 14 gün önce veya 42 hafta sonra olabilir.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_pregnancy_due_date_on_write
  on public.profiles;
create trigger validate_profile_pregnancy_due_date_on_write
  before insert or update on public.profiles
  for each row execute function public.validate_profile_pregnancy_due_date();
