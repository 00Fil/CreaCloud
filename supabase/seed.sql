-- Dati di esempio per lo sviluppo locale (`supabase db reset`).
-- Non usare in produzione: crea anche un coordinatore demo
--   email: demo@creattivamente.local   password: creattivamente

do $$
declare
  demo uuid := '00000000-0000-4000-8000-000000000001';
  mat uuid; ita uuid; ing uuid; fis uuid; lat uuid; chi uuid;
  t_anna uuid; t_luca uuid; t_sara uuid; t_marco uuid;
  f uuid; s uuid; s2 uuid; r uuid;
begin
  -- coordinatore demo
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', demo, 'authenticated', 'authenticated', 'demo@creattivamente.local',
          crypt('creattivamente', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), demo, demo::text, jsonb_build_object('sub', demo::text, 'email', 'demo@creattivamente.local'), 'email', now(), now(), now());
  insert into staff (id, full_name, role) values (demo, 'Coordinatore Demo', 'titolare');

  -- centro: lun–ven 14:30–19:30, sabato 9–13; tre postazioni
  insert into center_hours (weekday, start_min, end_min)
  select d, 870, 1170 from generate_series(0, 4) d;
  insert into center_hours (weekday, start_min, end_min) values (5, 540, 780);
  insert into rooms (name, capacity) values ('Aula Pesca', 1), ('Aula Pervinca', 1), ('Aula grande', 4);
  insert into center_closures (date, note) values (make_date(extract(year from now())::int, 12, 8), 'Immacolata');

  insert into subjects (name) values ('Matematica') returning id into mat;
  insert into subjects (name) values ('Italiano') returning id into ita;
  insert into subjects (name) values ('Inglese') returning id into ing;
  insert into subjects (name) values ('Fisica') returning id into fis;
  insert into subjects (name) values ('Latino') returning id into lat;
  insert into subjects (name) values ('Chimica') returning id into chi;

  -- tutor
  insert into tutors (first_name, last_name, phone, modes, hourly_rate_cents, max_weekly_minutes)
  values ('Anna', 'Ferri', '393331110001', array['presenza', 'online'], 1300, 900) returning id into t_anna;
  insert into tutors (first_name, last_name, phone, modes, hourly_rate_cents)
  values ('Luca', 'Moretti', '393331110002', array['presenza'], 1200) returning id into t_luca;
  insert into tutors (first_name, last_name, phone, modes, hourly_rate_cents)
  values ('Sara', 'Conti', '393331110003', array['presenza', 'online'], 1200) returning id into t_sara;
  insert into tutors (first_name, last_name, phone, modes, hourly_rate_cents, max_daily_minutes)
  values ('Marco', 'Galli', '393331110004', array['online'], 1100, 180) returning id into t_marco;

  insert into tutor_subjects (tutor_id, subject_id, levels) values
    (t_anna, mat, '{}'), (t_anna, fis, '{superiori}'),
    (t_luca, ita, '{}'), (t_luca, lat, '{superiori}'),
    (t_sara, ing, '{}'), (t_sara, mat, '{elementari,medie}'),
    (t_marco, fis, '{}'), (t_marco, chi, '{}'), (t_marco, mat, '{superiori}');

  insert into tutor_availability (tutor_id, weekday, start_min, end_min) values
    (t_anna, 0, 900, 1170), (t_anna, 2, 900, 1170), (t_anna, 3, 960, 1140),
    (t_luca, 1, 870, 1170), (t_luca, 3, 870, 1170), (t_luca, 5, 540, 780),
    (t_sara, 0, 870, 1080), (t_sara, 1, 870, 1080), (t_sara, 4, 870, 1170),
    (t_marco, 0, 1020, 1260), (t_marco, 2, 1020, 1260), (t_marco, 4, 1020, 1260);

  -- famiglie
  insert into families (name, privacy_consent_at) values ('Famiglia Rossi', now()) returning id into f;
  insert into parents (family_id, first_name, last_name, phone, is_primary) values (f, 'Giulia', 'Rossi', '393401000001', true);
  insert into parents (family_id, first_name, last_name, phone) values (f, 'Paolo', 'Rossi', '393401000002');
  insert into students (family_id, first_name, last_name, school_level) values (f, 'Matteo', 'Rossi', '2 media') returning id into s;
  insert into students (family_id, first_name, last_name, school_level, phone) values (f, 'Chiara', 'Rossi', '3 liceo scientifico', '393401000003') returning id into s2;
  insert into student_constraints (student_id, priority, category, label, weekday, start_min, end_min, priority_confirmed)
  values (s, 2, 'sport', 'Calcio', 1, 990, 1110, true), (s2, 1, 'terapia', 'Logopedia', 2, 960, 1050, true),
         (s2, 3, 'sport', 'Pallavolo', 3, 1080, 1200, false);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min, topic) values (mat, 2, 60, 'equazioni') returning id into r;
  insert into lesson_request_students values (r, s);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min) values (fis, 1, 90) returning id into r;
  insert into lesson_request_students values (r, s2);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min) values (lat, 1, 60) returning id into r;
  insert into lesson_request_students values (r, s2);

  insert into families (name) values ('Famiglia Bianchi') returning id into f;
  insert into parents (family_id, first_name, last_name, phone, is_primary) values (f, 'Elena', 'Bianchi', '393401000011', true);
  insert into students (family_id, first_name, last_name, school_level) values (f, 'Sofia', 'Bianchi', '2 media') returning id into s;
  insert into student_constraints (student_id, priority, category, label, weekday, start_min, end_min, priority_confirmed)
  values (s, 2, 'altra_lezione', 'Pianoforte', 0, 1020, 1080, true);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min, topic) values (mat, 1, 60, 'equazioni') returning id into r;
  insert into lesson_request_students values (r, s);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min, mode) values (ing, 1, 60, 'indifferente') returning id into r;
  insert into lesson_request_students values (r, s);

  insert into families (name) values ('Famiglia Esposito') returning id into f;
  insert into parents (family_id, first_name, last_name, phone, is_primary) values (f, 'Marta', 'Esposito', '393401000021', true);
  insert into students (family_id, first_name, last_name, school_level) values (f, 'Leonardo', 'Esposito', '4 elementare') returning id into s;
  insert into student_constraints (student_id, priority, category, label, weekday, start_min, end_min, priority_confirmed)
  values (s, 1, 'scuola', 'Tempo pieno', 4, 0, 990, true);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min) values (ita, 2, 60) returning id into r;
  insert into lesson_request_students values (r, s);

  insert into families (name) values ('Famiglia Colombo') returning id into f;
  insert into parents (family_id, first_name, last_name, phone, is_primary) values (f, 'Andrea', 'Colombo', '393401000031', true);
  insert into students (family_id, first_name, last_name, school_level, phone) values (f, 'Giorgia', 'Colombo', '5 liceo classico', '393401000032') returning id into s;
  insert into lesson_requests (subject_id, sessions_per_week, duration_min, mode) values (chi, 1, 120, 'online') returning id into r;
  insert into lesson_request_students values (r, s);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min) values (lat, 2, 90) returning id into r;
  insert into lesson_request_students values (r, s);

  insert into families (name) values ('Famiglia Ricci') returning id into f;
  insert into parents (family_id, first_name, last_name, phone, is_primary) values (f, 'Laura', 'Ricci', '393401000041', true);
  insert into students (family_id, first_name, last_name, school_level) values (f, 'Tommaso', 'Ricci', '1 media') returning id into s;
  insert into student_constraints (student_id, priority, category, label, weekday, start_min, end_min, priority_confirmed)
  values (s, 4, 'preferenza', 'Preferisce non il venerdì', 4, 0, 1440, true);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min, flexible_duration) values (mat, 1, 90, false) returning id into r;
  insert into lesson_request_students values (r, s);
  insert into lesson_requests (subject_id, sessions_per_week, duration_min) values (ing, 1, 60) returning id into r;
  insert into lesson_request_students values (r, s);

  -- una chat di esempio
  insert into chats (phone, display_name, parent_id, last_inbound_at, last_message_at, last_message_preview, unread_count)
  select p.phone, p.first_name || ' ' || p.last_name, p.id, now() - interval '5 minutes', now() - interval '4 minutes',
         'Perfetto, grazie! A mercoledì', 1
  from parents p where p.phone = '393401000001';
  insert into messages (chat_id, direction, author, body, provider, status, created_at)
  select c.id, x.direction, x.author, x.body, 'waxum', x.status, now() - x.ago
  from chats c,
       (values ('in', 'utente', 'Buongiorno, Matteo il martedì ha calcio dalle 16:30 alle 18:30', 'ricevuto', interval '9 minutes'),
               ('out', 'ai', 'Buongiorno Giulia! Il calcio di Matteo è un impegno fisso che non si può spostare, o se serve si può saltare ogni tanto?', 'letto', interval '8 minutes'),
               ('in', 'utente', 'Si può saltare solo in casi eccezionali', 'ricevuto', interval '7 minutes'),
               ('out', 'ai', 'Ho segnato il calcio di Matteo ogni martedì 16:30–18:30 come impegno importante: non metteremo lezioni in quell''orario.', 'letto', interval '6 minutes'),
               ('in', 'utente', 'Perfetto, grazie! A mercoledì', 'ricevuto', interval '5 minutes')) as x(direction, author, body, status, ago)
  where c.phone = '393401000001';
end $$;
