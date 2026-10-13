-- An isolated schema; this migration does not alter mobile-app tables.
create schema if not exists escapecouch_launch;
revoke all on schema escapecouch_launch from public;
create table if not exists escapecouch_launch.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) <= 254),
  platform text not null check (platform in ('ios', 'android', 'both')),
  source text not null,
  campaign text not null,
  consent_version text not null,
  created_at timestamptz not null default now()
);
create table if not exists escapecouch_launch.signup_limits (
  key text primary key,
  count integer not null,
  expires_at timestamptz not null
);
alter table escapecouch_launch.waitlist enable row level security;
alter table escapecouch_launch.signup_limits enable row level security;

create or replace function escapecouch_launch.register_waitlist(
  p_email text, p_platform text, p_source text, p_campaign text, p_key text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare attempts integer;
begin
  if length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_platform not in ('ios','android','both') or length(p_key) != 64 then
    raise exception 'Invalid signup';
  end if;
  insert into escapecouch_launch.signup_limits(key, count, expires_at)
    values(p_key, 1, now() + interval '15 minutes')
    on conflict(key) do update set count = escapecouch_launch.signup_limits.count + 1
    returning count into attempts;
  delete from escapecouch_launch.signup_limits where expires_at < now();
  if attempts > 10 then return false; end if;
  insert into escapecouch_launch.waitlist(email, platform, source, campaign, consent_version)
    values(lower(trim(p_email)), p_platform, left(p_source,100), left(p_campaign,100), 'launch-updates-v1')
    on conflict(email) do nothing;
  return true;
end;
$$;
revoke all on function escapecouch_launch.register_waitlist(text,text,text,text,text) from public;
-- Provision the server login separately and grant only schema usage and function execution.
