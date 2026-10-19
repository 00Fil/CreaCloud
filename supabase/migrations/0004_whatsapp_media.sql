-- WhatsApp completo, come WhatsApp Web: allegati salvati nello storage del
-- centro (foto, video, vocali, audio, documenti, sticker), posizioni, contatti,
-- risposte citate, reazioni, modifiche e cancellazioni.

-- ------------------------------------------------------------------ messaggi

alter table messages
  -- tipo di contenuto mostrato nella chat
  add column kind text not null default 'testo'
    check (kind in ('testo', 'immagine', 'video', 'audio', 'vocale', 'documento', 'sticker',
                    'posizione', 'contatto', 'sondaggio', 'sistema', 'altro')),
  -- allegato: percorso nel bucket whatsapp-media e metadati
  add column media_path text,
  add column media_mime text,
  add column media_size bigint,
  add column media_name text,
  add column media_duration integer,
  add column media_width integer,
  add column media_height integer,
  -- forma d'onda dei vocali: 64 valori da 0 a 100
  add column media_waveform smallint[],
  -- in_attesa: da scaricare; pronto: nello storage; errore: download fallito;
  -- non_disponibile: WhatsApp non lo consegna ai dispositivi collegati (es. visualizza una volta)
  add column media_status text
    check (media_status in ('in_attesa', 'pronto', 'errore', 'non_disponibile')),
  -- {latitude, longitude, name, address, url}
  add column location jsonb,
  -- {display_name, phones: [{number, type}], organization}
  add column contact jsonb,
  -- risposta: messaggio citato (risolto) e suo id WhatsApp (sempre)
  add column quoted_message_id uuid references messages (id) on delete set null,
  add column quoted_provider_id text,
  -- [{from: 'noi' | 'loro', emoji, at, by?}]
  add column reactions jsonb not null default '[]',
  add column edited_at timestamptz,
  -- cancellato per tutti (dal contatto o dal centro)
  add column deleted_at timestamptz,
  -- persona dello staff che ha scritto o approvato il messaggio
  add column sent_by uuid references staff (id) on delete set null;

-- I messaggi esistenti con allegato: il vecchio campo media_type contiene il MIME.
update messages set
  kind = case
    when media_type like 'image/webp%' then 'sticker'
    when media_type like 'image/%' then 'immagine'
    when media_type like 'video/%' then 'video'
    when media_type like 'audio/%' then 'vocale'
    else 'documento'
  end,
  media_mime = media_type,
  media_status = case when media_ref is not null then 'in_attesa' else 'non_disponibile' end
where media_type is not null;

create index messages_quoted_idx on messages (chat_id, provider_message_id);
create index messages_media_idx on messages (chat_id, created_at desc)
  where kind in ('immagine', 'video', 'documento', 'audio', 'vocale');

-- ------------------------------------------------------------------ chat

alter table chats
  -- JID usato da WhatsApp per questa chat (es. 39333…@s.whatsapp.net o …@lid):
  -- serve per conferme di lettura, "sta scrivendo" e azioni sui messaggi
  add column wa_jid text,
  -- foto profilo salvata nello storage
  add column avatar_path text,
  add column avatar_checked_at timestamptz,
  add column pinned_at timestamptz,
  add column archived_at timestamptz,
  -- ultimo stato di scrittura del contatto: 'scrive' | 'registra' | null
  add column typing_state text check (typing_state in ('scrive', 'registra')),
  add column typing_at timestamptz;

create index chats_list_idx on chats (archived_at, pinned_at desc nulls last, last_message_at desc nulls last);

-- ------------------------------------------------------------------ storage

insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp-media', 'whatsapp-media', false, 104857600)
on conflict (id) do nothing;

-- Lo staff legge gli allegati (URL firmati dal browser); scrive solo il server.
create policy whatsapp_media_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'whatsapp-media' and is_staff());
