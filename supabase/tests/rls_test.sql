-- Verifica dei permessi (RLS). Esegui con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- tre persone: il titolare demo (dal seed), un coordinatore e un estraneo registrato
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000c1', 'coord@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e1', 'estraneo@test.local', 'authenticated', 'authenticated');
insert into staff (id, full_name, role) values ('00000000-0000-4000-8000-0000000000c1', 'Coord', 'coordinatore');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------- anonimo
set local role anon;
select is((select count(*) from families), 0::bigint, 'anonimo: non vede le famiglie');
select is((select count(*) from messages), 0::bigint, 'anonimo: non vede i messaggi');
select throws_ok($$ insert into families (name) values ('x') $$, '42501', null, 'anonimo: non crea famiglie');

-- ---------------------------------------------------------- utente registrato ma non staff
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000e1');
set local role authenticated;
select is((select count(*) from families), 0::bigint, 'estraneo: non vede le famiglie');
select is((select count(*) from chats), 0::bigint, 'estraneo: non vede le chat');
select is((select count(*) from settings), 0::bigint, 'estraneo: non vede le impostazioni');
select throws_ok($$ insert into staff (id, full_name, role) values ('00000000-0000-4000-8000-0000000000e1', 'io', 'titolare') $$,
  '42501', null, 'estraneo: non si aggiunge allo staff');
select throws_ok($$ insert into families (name) values ('x') $$, '42501', null, 'estraneo: non crea famiglie');
update settings set value = 'false' where key = 'ai_enabled';
reset role;
select is((select value from settings where key = 'ai_enabled'), 'true'::jsonb, 'estraneo: non modifica le impostazioni');

-- ---------------------------------------------------------- coordinatore (staff, non titolare)
select pg_temp.act_as('00000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select ok((select count(*) from families) > 0, 'coordinatore: vede le famiglie');
select lives_ok($$ insert into families (name) values ('Nuova') $$, 'coordinatore: crea famiglie');
select throws_ok($$ insert into staff (id, full_name) values ('00000000-0000-4000-8000-0000000000e1', 'amico') $$,
  '42501', null, 'coordinatore: non aggiunge persone allo staff');
update staff set role = 'titolare' where id = '00000000-0000-4000-8000-0000000000c1';
delete from staff where role = 'titolare';
select lives_ok($$ insert into audit_log (actor, action, entity) values ('c1', 'prova', 'test') $$, 'coordinatore: scrive nel registro');
delete from audit_log;
update audit_log set action = 'alterata';
reset role;
select is((select role from staff where id = '00000000-0000-4000-8000-0000000000c1'), 'coordinatore', 'coordinatore: non si promuove titolare');
select is((select count(*) from staff where role = 'titolare'), 1::bigint, 'coordinatore: non rimuove il titolare');
select ok((select count(*) from audit_log where action = 'prova') = 1, 'registro: non cancellabile');
select is((select count(*) from audit_log where action = 'alterata'), 0::bigint, 'registro: non modificabile');

-- ---------------------------------------------------------- titolare
select pg_temp.act_as('00000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$ insert into staff (id, full_name) values ('00000000-0000-4000-8000-0000000000e1', 'Nuovo coordinatore') $$,
  'titolare: aggiunge un coordinatore');

select * from finish();
rollback;
