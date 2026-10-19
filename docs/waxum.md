# Migrazione completa dell’integrazione WhatsApp a Waxum

## Ambito e architettura

```
Telefono WhatsApp ↔ Waxum self-hosted
                       ↑ REST /api/v1/sessions/{id}/...
                       ↓ webhook HTTPS + HMAC v2
                 CreaCloud (Next.js) ↔ Supabase
                       ↓
                 assistente AI e motore lezioni
```

Il trasporto unico è `waxum`: invii del coordinatore, invii AI, conversazioni esistenti e nuove, ricezione testo/interattivi, vocali, QR, stato e logout. Rimossi servizio Baileys, webhook proprietario `/api/whatsapp/gateway`, client Meta diretto e webhook `/api/whatsapp/cloud`. Non occorrono più variabili `WA_GATEWAY_*`, `WA_CLOUD_*`, `WA_TEMPLATE_*`.

Il progetto originale invia testo e scarica i vocali per l’AI: queste funzioni sono migrate. Non vengono aggiunti invio di allegati, campagne, gruppi, importazione della cronologia WhatsApp o funzionalità Waxum che la dashboard non aveva. Le altre funzioni del gestionale restano invariate. “Migrazione” riguarda il codice del progetto, non il porting del vecchio archivio credenziali a Waxum.

Versione di riferimento: **Waxum 0.16.0**, immagine upstream `fdciabdul/waxum:0.16.0`. L’immagine è stata verificata sul registro Docker Hub. Le API utilizzate sono `/api/v1`; il logout che conserva la sessione richiede almeno 0.14.0. Non considerare automaticamente compatibili versioni precedenti o future: eseguire il collaudo a ogni upgrade.

## Configurazione

Copia `.env.example` in `.env` e completa Supabase, AI e motore come nel README. Per Waxum:

| Variabile | Significato |
|---|---|
| `WAXUM_URL` | Origine dell’istanza, es. `http://waxum:3451` nel Compose oppure `https://wa.example.org`; senza `/api/v1` (è tollerato anche tale suffisso). Solo server-side. |
| `WAXUM_TOKEN` | Bearer API; nel servizio incluso è anche `SUPERADMIN_TOKEN`. Non usare nel browser o in variabili `NEXT_PUBLIC_*`. |
| `WAXUM_SESSION_ID` | Sessione stabile dedicata al numero del centro, ad esempio `creacloud`. Non cambiarla dopo l’abbinamento. |
| `WAXUM_WEBHOOK_URL` | **URL pubblico HTTPS** della dashboard, es. `https://gestione.example.org/api/whatsapp/waxum`. Deve essere raggiungibile da Waxum e risolvere a un indirizzo pubblico. |
| `WAXUM_WEBHOOK_SECRET` | Segreto HMAC distinto dal token API. Va registrato nel webhook. |
| `WAXUM_JWT_SECRET` | Segreto JWT del servizio Waxum incluso; non sostituisce `WAXUM_TOKEN`. |
| `WAXUM_IMAGE` | Immagine Docker, di default `fdciabdul/waxum:0.16.0`. Preferire una versione o digest verificato, non `latest`. |
| `WAXUM_PACE_SENDS` | `true` di default: presenza, indicatore di digitazione e ritardo casuale come nel gateway precedente. Non è una garanzia anti-ban. |
| `ALLOW_FIRST_CONTACT` | `false` di default: impedisce all’AI di inviare se la chat non ha `last_inbound_at`; gli invii manuali dello staff sono consentiti. |

Genera token API, segreto webhook e segreto JWT **separatamente**, per esempio eseguendo tre volte `openssl rand -hex 32`.

**Attenzione alla rete:** Waxum valida gli URL webhook contro SSRF. Non configurare `http://web:3000`, localhost o IP privati come URL di callback. Anche se CreaCloud e Waxum sono sulla stessa macchina, la callback deve passare dal dominio pubblico HTTPS. Verifica DNS, certificati, eventuale hairpin NAT e firewall in uscita. Non disabilitare i controlli SSRF per far funzionare la rete interna. L’API REST Waxum può invece rimanere privata nella rete Docker.

## Avvio con il Waxum incluso

1. Applica `supabase db push`, senza seed in produzione.
2. Completa `.env` e configura DNS e HTTPS della dashboard.
3. In Dokploy usa `docker-compose.yml`, esponendo **solo web:3000**. Senza Dokploy:
   ```bash
   docker compose -f deploy/docker-compose.yml --env-file .env up -d --build
   ```
4. Apri la dashboard e vai in **Impostazioni → WhatsApp · Waxum**.
5. Premi **Collega / riconfigura webhook**. L’azione autenticata:
   - legge la sessione e la crea con ID stabile solo se assente;
   - registra il webhook con eventi `message`, `receipt`, `connected`, `disconnected`, `logged_out`, `account_locked`;
   - evita registrazioni duplicate e, se necessario, ricrea quella dello stesso URL per aggiornare eventi/segreto;
   - non modifica webhook di URL diversi;
   - azzera eventuale sospensione del webhook corrispondente e invoca `/connect`.
6. Inquadra il QR da **WhatsApp → Dispositivi collegati**. Il QR proviene da `qr_codes` e viene convertito in PNG localmente: nessun servizio QR esterno.

La lettura della pagina impostazioni è osservativa: non crea sessioni e non riconnette da sola. **Scollega questo numero** usa `/logout`, non `DELETE`: conserva sessione, webhook e dati. Per un nuovo abbinamento premi di nuovo Collega. Il pulsante invoca una riconnessione esplicita, quindi non premerlo ripetutamente su un account bloccato da WhatsApp: rispettare i cooldown e verificare la causa.

## Usare una tua istanza Waxum già installata

Imposta URL HTTPS e Bearer dell’istanza in `.env`, mantieni un ID sessione dedicato e il webhook della dashboard. Il token deve poter leggere/creare tale sessione e gestirne i webhook, lo stato, i media, l’invio e il logout. Un token ristretto può richiedere che l’amministratore crei preventivamente la sessione.

Per non avviare anche il Waxum locale, con Docker Compose **>= 2.24.4**:

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.external-waxum.yml up -d --build
```

In Dokploy indica entrambi i file Compose (base + override). L’override mette il servizio locale nel profilo inattivo `local-waxum`: non abilitare quel profilo. Se stai passando da un deploy locale a uno esterno, arresta/rimuovi esplicitamente il vecchio container locale dopo averne fatto backup: disattivare un profilo non è un arresto garantito di un container già avviato. Non usare `down -v`.

Lascia comunque valorizzati i segnaposto dei segreti locali richiesti dal Compose base: la risoluzione delle variabili precede l’esclusione del servizio. L’istanza esterna usa i propri segreti, non viene riconfigurata dall’override. Per Caddy su un’istanza esterna, aggiungi l’override anche al comando di avvio di `deploy/docker-compose.yml`.

## Passaggio dalla vecchia versione

1. Esegui backup del database Supabase e del vecchio volume `wa-auth` prima di sostituire il deploy.
2. Sospendi l’AI durante il passaggio per non avere due gestionali attivi sullo stesso numero.
3. Arresta il vecchio gateway e rimuovi i vecchi webhook Meta per questa applicazione. Il nuovo codice non espone gli endpoint precedenti.
4. Esegui `supabase db push`: `0002_waxum.sql` imposta il provider corrente a `waxum`, conservando messaggi, chat e relativi provider storici. Non è stata riscritta la migrazione originale già applicata.
5. Configura Waxum e abbina nuovamente il telefono con il QR. **Le credenziali Baileys non sono importabili come sessione Waxum.**
6. Le nuove risposte alle chat storiche passano sempre da Waxum, anche se l’ultimo messaggio ha provider storico `baileys` o `cloud`.
7. I vecchi `provider_message_id` e `media_ref` restano storici: non fingiamo che siano identificativi Waxum. I media precedenti non sono riscaricabili tramite la nuova API; le trascrizioni già salvate restano disponibili. I vocali nuovi salvano metadati persistenti per il download Waxum.
8. Verifica ricezione/invio e riattiva l’AI.

La cronologia già presente nel database resta visibile; il progetto non importa automaticamente lo storico presente sul telefono. Se si cambia `WAXUM_SESSION_ID`, cambiano anche le credenziali e il contesto dei media: serve una migrazione pianificata, non basta rinominare la variabile. Se si cambia dominio della dashboard, rimuovi manualmente il vecchio webhook di CreaCloud nell’istanza Waxum: l’app non elimina URL diversi per non toccare altre integrazioni.

## Corrispondenza dei contratti

| Funzione | API Waxum |
|---|---|
| Creazione sessione | `POST /api/v1/sessions` con `id`, `name` |
| Lettura sessione | `GET /api/v1/sessions/{id}` |
| Collegamento | `POST /api/v1/sessions/{id}/connect` |
| Stato | `GET /api/v1/sessions/{id}/status` |
| QR | `GET /api/v1/sessions/{id}/qr`, array `qr_codes` |
| Invio testo | `POST /api/v1/sessions/{id}/messages/text`, `{to,text}` → `message_id` |
| Webhook | `GET/POST /api/v1/sessions/{id}/webhooks`, `DELETE .../{webhook_id}`, `POST .../{webhook_id}/enable` |
| Presenza / digitazione | `POST /api/v1/sessions/{id}/presence/subscribe`, `POST .../chatstate/send` |
| Download vocale | `POST /api/v1/sessions/{id}/media/download` con `direct_path`, chiavi/hash base64, `file_length`, `media_type` → `data` base64 |
| Scollegamento telefono | `POST /api/v1/sessions/{id}/logout` |

### Identità, duplicati e controllo manuale

- Il webhook viene autenticato sul corpo **grezzo** con HMAC-SHA256 **v2** di `timestamp.corpo`, controllo dell’header versione e tolleranza temporale di 300 secondi. Nessun fallback alla firma legacy v1. Mantieni l’orologio dei server sincronizzato con NTP.
- Viene verificato `session_id` prima di accedere al database. Un evento firmato di un’altra sessione viene rifiutato.
- `from_phone`/`chat_phone` hanno precedenza sui JID LID quando disponibili. Senza numero noto si conserva `lid:...`, che viene riconvertito in `...@lid` per rispondere. Non si trasformano LID in falsi numeri telefonici.
- Se un contatto arriva prima come LID e solo più tardi con un numero risolto, l’associazione anagrafica/riunificazione delle chat va verificata dallo staff: non viene inferita arbitrariamente dal sistema.
- Per `is_from_me`, il destinatario è `chat`/`chat_phone`, non il proprio `from`. Un messaggio genuino dal telefono mantiene la pausa AI già prevista (120 minuti).
- Gli echo con `message_id` già registrato non vengono reinseriti. Se un echo arriva mentre lo stesso testo è ancora `in_invio` (anche se il destinatario è rappresentato da un LID diverso dal numero salvato), il webhook risponde 503 per farlo ritentare da Waxum, evitando una falsa presa di controllo. L’algoritmo non è una garanzia transazionale in caso di crash/timeout ambiguo : controllare eventuali righe pendenti ed echo durante il collaudo.
- I duplicati restano protetti dall’unicità `(provider, provider_message_id)` nel database. I messaggi live e quelli `offline` sono entrambi gestiti, con timestamp originale quando disponibile.
- Gruppi, broadcast, newsletter, reazioni, eventi tecnici e aggiornamenti di stato non attivano l’AI. I messaggi diretti e le risposte a pulsanti/liste vengono normalizzati.
- L’AI usa la protezione applicativa sul primo contatto; non viene inventato un parametro Waxum `force`. Un limite server `new-chat-limit`, se configurato dall’operatore Waxum, continua ad applicarsi anche agli invii manuali.
- Invii 429/5xx e timeout non vengono ritentati automaticamente: un timeout può nascondere un invio già effettuato. L’errore espone il codice e l’eventuale `Retry-After`, non token o contenuti remoti. Verificare la consegna prima di reinviare.

### Limiti da conoscere

**Ricevute nel collegamento QR:** nel sorgente Waxum verificato, l’evento linked-device `receipt` espone `data.receipt` come stringa Rust Debug, non come contratto JSON stabile con ID/stato. Non vengono inventate conferme “consegnato” o “letto”: dopo una risposta HTTP positiva il messaggio resta **inviato**. Il parser gestisce ricevute JSON strutturate `message_id`/`status` quando Waxum le fornisce (ad esempio sul suo provider Cloud); non analizza stringhe Debug fragili. La configurazione pronta del progetto è per una sessione QR linked-device, non per l’onboarding Meta attraverso Waxum.

**Affidabilità AI:** rimane il modello originario Next.js `after()` per l’elaborazione AI; non è una coda applicativa durevole. Il webhook conferma dopo la registrazione del messaggio, non dopo il completamento dell’AI. Un crash dopo la risposta HTTP può richiedere intervento manuale; l’assenza di una coda durevole non viene mascherata come garanzia exactly-once. I retry Waxum proteggono la consegna HTTP, non completano automaticamente un’elaborazione AI già persa dopo l’ACK.

**Invii e ritmo:** sono mantenuti la serializzazione in-memory, il ritardo casuale del vecchio gateway e l’indicatore di digitazione tramite `/presence/subscribe` e `/chatstate/send`. Gli errori della sola presenza non bloccano il messaggio. La coda ora vive nel processo Next.js: non è durevole e non serializza tra repliche diverse. Il deployment incluso prevede una sola replica web; per più repliche serve una coda condivisa. Nessuna garanzia anti-ban: non usare invii massivi.

## Dati, backup e osservabilità

Il Compose usa SQLite Waxum e le credenziali dei dispositivi nel volume `waxum-data`, montato in `/app/whatsapp_sessions`; non usa il database applicativo Supabase per le sessioni Waxum. NATS non è necessario per REST e webhook e non viene avviato. La porta 3451 non è pubblicata sull’host.

Esegui backup coerenti del volume a servizio fermo o con gli strumenti SQLite appropriati; contiene dati sensibili e chiavi del dispositivo. Non usare le stesse credenziali di dispositivo contemporaneamente su più istanze. Il backup Supabase va gestito separatamente. Non cancellare i volumi durante un aggiornamento.

Per diagnosticare “collegato ma non ricevo”, consulta `GET /api/v1/sessions/{id}/status`, in particolare `socket_alive` e `diagnostics.webhooks`. Verifica `enabled`, sospensione/circuit breaker, `last_error`, firma, orologio e reachability del webhook pubblico. La lettura della pagina impostazioni non supera cooldown o blocchi dell’account.

Waxum può sospendere un URL dopo fallimenti ripetuti: durante la sospensione alcuni eventi vengono saltati, non accodati. Le consegne fallite possono finire nella DLQ; la parte in-memory non sopravvive ai riavvii. Consulta e ripeti le consegne dalla gestione Waxum solo dopo aver risolto il problema. Non promettere il recupero di ogni evento perso durante un’interruzione.

## Collaudo reale obbligatorio

Da eseguire sulla propria istanza, con un numero di prova e senza dati sensibili:

- [ ] Deploy e healthcheck di web, engine e Waxum completati; migrazioni Supabase applicate.
- [ ] Dal container web si raggiunge l’API Waxum; da Waxum si raggiunge il webhook pubblico HTTPS.
- [ ] Collega crea una sola sessione e un solo webhook per l’URL configurato; premere di nuovo non li duplica.
- [ ] Il QR si aggiorna e il telefono passa a `logged_in` con socket vivo.
- [ ] Un testo diretto crea/aggiorna una chat e l’AI risponde una volta; ripetere un webhook identico non duplica il messaggio.
- [ ] Un vocale reale viene scaricato da Waxum e passa alla trascrizione AI; verificare anche dopo un riavvio di CreaCloud.
- [ ] Un invio manuale dalla dashboard arriva al destinatario e salva il `message_id`.
- [ ] Un invio AI non genera falsa presa di controllo; un messaggio dal telefono invece sospende l’AI.
- [ ] Verificare contatto con numero normale e, se disponibile, LID con/senza numero risolto; i gruppi non attivano AI.
- [ ] Firma errata, timestamp scaduto e sessione sbagliata vengono rifiutati.
- [ ] Riavvio di Waxum mantiene la sessione senza nuovo QR; un logout rimuove il collegamento ma non cancella i dati.
- [ ] Una chat preesistente riceve la nuova risposta tramite Waxum; i vecchi messaggi restano visibili.
- [ ] Rate limit/timeout non causano retry automatici di invio; verificare eventuali esiti incerti prima di ritentare.

I test automatici del progetto simulano API e webhook. **Non sostituiscono** questo collaudo e non certificano una sessione WhatsApp reale.

## Riferimenti verificati

- https://waxum.imtaqin.id/docs/api/sessions/
- https://waxum.imtaqin.id/docs/api/messages/
- https://waxum.imtaqin.id/docs/api/webhooks/
- https://waxum.imtaqin.id/docs/api/media/
- https://waxum.imtaqin.id/docs/installation
- Sorgente upstream verificato: https://github.com/imtaqin/waxum/tree/f392179f8d4cd43a9df4bc152014a183c5afdb72 (tag v0.16.0).
