-- A device token can already belong to a previous account on the same phone.
-- Register it through a narrowly scoped function so onboarding can safely move
-- the token to the currently authenticated user without weakening table RLS.

create or replace function public.save_push_token_for_current_user(
  p_expo_push_token text,
  p_device_type text default null,
  p_project_id text default null
)
returns public.push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := trim(coalesce(p_expo_push_token, ''));
  v_push_token public.push_tokens;
begin
  if v_user_id is null then
    raise exception 'Oturum gerekli.';
  end if;

  if length(v_token) < 12 or length(v_token) > 512 then
    raise exception 'Geçerli bir bildirim anahtarı gerekli.';
  end if;

  if p_device_type is not null and p_device_type not in ('ios', 'android') then
    raise exception 'Desteklenmeyen cihaz türü.';
  end if;

  insert into public.push_tokens (
    user_id,
    expo_push_token,
    device_type,
    project_id,
    enabled,
    disabled_at,
    last_error,
    last_seen_at,
    updated_at
  ) values (
    v_user_id,
    v_token,
    p_device_type,
    nullif(trim(coalesce(p_project_id, '')), ''),
    true,
    null,
    null,
    now(),
    now()
  )
  on conflict (expo_push_token) do update
    set user_id = v_user_id,
        device_type = excluded.device_type,
        project_id = excluded.project_id,
        enabled = true,
        disabled_at = null,
        last_error = null,
        last_seen_at = now(),
        updated_at = now()
  returning * into v_push_token;

  return v_push_token;
end;
$$;

revoke all on function public.save_push_token_for_current_user(text, text, text)
  from public;
grant execute on function public.save_push_token_for_current_user(text, text, text)
  to authenticated;

comment on function public.save_push_token_for_current_user(text, text, text) is
  'Registers or transfers one Expo device token to auth.uid() without exposing other users push token rows.';
