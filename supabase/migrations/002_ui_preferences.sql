-- Apply after 001_flowdesk.sql. Presentation preferences are user-owned.
alter table public.flowdesk_accounts add column if not exists locale text not null default 'th';
alter table public.flowdesk_accounts add column if not exists theme text not null default 'system';
alter table public.flowdesk_accounts add column if not exists onboarding_completed integer not null default 0;

create or replace function public.flowdesk_change_password(p_input jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed text;
begin
 update public.flowdesk_accounts set password_hash=p_input->>'newHash'
 where id=p_input->>'id' and password_hash=p_input->>'oldHash' and active=1 returning id into changed;
 if changed is null then return false; end if;
 delete from public.flowdesk_account_sessions where account_id=changed;
 insert into public.flowdesk_account_sessions(token_hash,account_id,expires_at,created_at)
 values(p_input->>'tokenHash',changed,(p_input->>'expires')::bigint,(p_input->>'now')::bigint);
 return true;
end;$$;
revoke all on function public.flowdesk_change_password(jsonb) from public,anon,authenticated;
grant execute on function public.flowdesk_change_password(jsonb) to service_role;
