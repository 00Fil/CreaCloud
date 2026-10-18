-- Mantiene gli identificativi e i provider storici: non sono ID Waxum.
-- Nessuna cancellazione di chat o messaggi; il nuovo trasporto è sempre Waxum.
insert into settings (key, value) values ('whatsapp_provider', '"waxum"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
