-- Rafforzamento dei permessi.
-- 1. Solo il titolare gestisce lo staff: un coordinatore non può aggiungere
--    persone allo staff, cambiare ruoli o rimuovere altri.
-- 2. Il registro delle operazioni (audit_log) è in sola aggiunta: nessuno
--    dalla dashboard può modificarlo o cancellarlo.

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and role = 'titolare');
$$;

revoke execute on function is_owner() from public, anon;
revoke execute on function is_staff() from public, anon;
grant execute on function is_owner() to authenticated;
grant execute on function is_staff() to authenticated;

drop policy staff_all on staff;
create policy staff_read on staff for select to authenticated using (is_staff());
create policy staff_owner_insert on staff for insert to authenticated with check (is_owner());
create policy staff_owner_update on staff for update to authenticated using (is_owner()) with check (is_owner());
-- il titolare non può rimuovere sé stesso: resta sempre almeno un titolare
create policy staff_owner_delete on staff for delete to authenticated using (is_owner() and id <> auth.uid());

drop policy staff_all on audit_log;
create policy audit_read on audit_log for select to authenticated using (is_staff());
create policy audit_insert on audit_log for insert to authenticated with check (is_staff());
