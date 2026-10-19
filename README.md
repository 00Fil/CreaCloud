# CreaCloud

Piattaforma di coordinamento per il centro Creattivamente: le famiglie e i tutor scrivono su WhatsApp, un assistente AI capisce le richieste e le registra, e un motore di pianificazione colloca le lezioni del mese rispettando i vincoli di tutti. Il coordinatore segue tutto da una dashboard che funziona da telefono e da computer.

## Cosa fa

- **Chat WhatsApp con assistente.** L'assistente gestisce impegni e disponibilità, richieste di nuove lezioni, cambi di orario e annullamenti. Quando un genitore segnala un impegno, chiede di cosa si tratta e propone una priorità. Le azioni critiche (nuove lezioni, cambi del numero di lezioni, spostamenti, richieste di non pagare un annullamento tardivo) aspettano l'approvazione del coordinatore nella pagina **Oggi**.
- **Presa di controllo.** Ogni chat si può prendere in mano in qualsiasi momento: scrivendo dalla dashboard o dal telefono, l'assistente si mette in pausa. Una chat segnata come **manuale** non riceve mai risposte automatiche.
- **Motore di pianificazione** (OR-Tools CP-SAT). Crea il piano mensile delle lezioni ricorrenti (1h, 1h30 o 2h). Può fare piccole variazioni di durata o di orario, sempre segnalate. Le lezioni che non si possono collocare vengono elencate con il motivo e una proposta. Il motore suggerisce anche i gruppi, che vanno approvati.
- **Annullamenti.** Con almeno 24 ore di preavviso (valore configurabile) la lezione non si paga. Dopo si fattura alla famiglia e si paga al tutor, salvo lo stato «Annullata (senza compenso)» che può scegliere solo il coordinatore.
- **Conti in contanti, IVA esclusa.** Per ogni famiglia: maturato, pagato, da saldare e stima di fine mese. Per ogni tutor: ore, compenso, quanto è già stato pagato e quanto resta.

### Priorità dei vincoli

| Priorità | Significato | Effetto sul motore |
|---|---|---|
| P1 inderogabile | scuola, terapie, impegni fissi | mai violato |
| P2 importante | sport, altre lezioni | violato solo se non c'è alternativa |
| P3 preferenza | | sacrificato prima di P2 |
| P4 gradimento | | sacrificato per primo |

Collocare una lezione vale più di qualsiasi preferenza. Se una lezione si può collocare solo violando un P2, P3 o P4, il motore la colloca e lo segnala. Se l'unico modo è violare un P1, la lezione resta fuori dal piano.

## Struttura

```
apps/web                  dashboard Next.js, webhook WhatsApp, assistente AI
services/engine           motore di pianificazione (Python, FastAPI, OR-Tools)
docker service waxum      API WhatsApp self-hosted (immagine upstream)
supabase                  schema del database e dati di esempio
docker-compose.yml        servizi applicativi, usato da Dokploy
deploy                    Caddy per un server senza Dokploy
docs                      guida a Dokploy
```

Tutta l’integrazione WhatsApp usa **Waxum self-hosted**: nessun gateway Node/Baileys e nessuna chiamata diretta a Meta. Una sessione Waxum dedicata gestisce il numero del centro. Il database applicativo resta Supabase; AI e pianificatore non cambiano.

Guida completa: [configurazione, migrazione e collaudo Waxum](docs/waxum.md).

## Provarlo in locale

Servono Node 22, Python 3.13, Docker e la [CLI di Supabase](https://supabase.com/docs/guides/cli).

```bash
# database con schema e dati di esempio
supabase start -x studio,mailpit,imgproxy,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta

# motore
cd services/engine && pip install -r requirements-dev.txt
ENGINE_TOKEN=dev uvicorn engine.api:app --port 8000

# dashboard (in un altro terminale)
cd apps/web && npm install
cp ../../.env.example .env.local   # URL e chiavi stampati da `supabase start`, ENGINE_TOKEN=dev
npm run dev
```

Apri http://localhost:3000 e accedi con `demo@creattivamente.local`, password `creattivamente` (solo dati di esempio).

Test: `pytest` in `services/engine`; `npm run typecheck`, `npm test` e `npm run build` in `apps/web`.

Per provare anche WhatsApp in locale serve un’istanza Waxum raggiungibile dalla dashboard e un URL HTTPS pubblico che inoltri `/api/whatsapp/waxum` alla dashboard. Il webhook non accetta URL Docker interni o localhost (protezione SSRF di Waxum). Imposta `WAXUM_URL` su un indirizzo raggiungibile dal processo Next.js, non sul DNS Docker `waxum` se avvii Next.js fuori dai container.

## Messa in produzione

1. **Supabase.** Crea un progetto in regione UE (Francoforte), poi applica lo schema:
   ```bash
   supabase link --project-ref <ref> && supabase db push
   ```
   Il file `seed.sql` non va applicato in produzione. In *Authentication → Sign In / Providers* disattiva **Allow new users to sign up**: gli accessi li crea solo il titolare.
2. **Primo coordinatore.** In Supabase, sotto *Authentication → Users*, crea l'utente con email e password. Poi, nell'editor SQL:
   ```sql
   insert into staff (id, full_name, role)
   select id, 'Nome Cognome', 'titolare' from auth.users where email = 'tua@email.it';
   ```
3. **Server.** Il modo consigliato è [Dokploy](docs/dokploy.md): scarica il repository da GitHub, avvia i servizi, gestisce HTTPS e rifà il deploy a ogni push. In alternativa, su una VPS in UE con solo Docker:
   ```bash
   cp .env.example .env   # compila tutti i valori
   docker compose -f deploy/docker-compose.yml --env-file .env up -d --build
   ```
   Caddy ottiene il certificato HTTPS per `DOMAIN`.
4. **Waxum.** Configura `WAXUM_TOKEN`, `WAXUM_JWT_SECRET`, `WAXUM_SESSION_ID`, `WAXUM_WEBHOOK_SECRET` e `WAXUM_WEBHOOK_URL` nel file `.env`. Usa segreti distinti generati con `openssl rand -hex 32`. Nel Compose è inclusa l’istanza `fdciabdul/waxum:0.16.0`, con dati persistenti e senza porte pubbliche.
5. **Collegare il numero.** Apri *Impostazioni → WhatsApp · Waxum*, premi **Collega / riconfigura webhook**, poi inquadra il QR dal telefono (*WhatsApp → Dispositivi collegati*). Il pulsante crea la sessione se manca e registra il webhook firmato. Il telefono continua a funzionare normalmente.
6. **Collaudo.** Segui la checklist in [docs/waxum.md](docs/waxum.md). Servono un vero telefono e l’istanza self-hosted: i test automatici simulano le API, non la rete WhatsApp.

### Sicurezza

- Ogni tabella ha Row Level Security: anonimi e utenti registrati che non fanno parte dello staff non vedono né modificano nulla. Il titolare gestisce lo staff, i coordinatori no. Il registro delle operazioni non si può modificare né cancellare. I test in `supabase/tests` lo verificano a ogni modifica.
- La chiave `SUPABASE_SERVICE_ROLE_KEY` resta solo sul server: la usano webhook, assistente e motore, mai il browser.
- Il webhook della Cloud API verifica la firma di Meta; gateway e motore accettano solo richieste con il loro token e non sono esposti su internet nel `docker-compose`.

### Costi AI

L'assistente usa Gemini: un modello veloce per i messaggi semplici e uno più capace per i casi dubbi o delicati. Le date, gli orari e i messaggi di conferma li calcola il codice, non il modello. Con 60 famiglie e 10 tutor la spesa stimata è di pochi euro al mese. Il tetto mensile si imposta da *Impostazioni*: oltre il tetto l'assistente non risponde più da solo e prepara bozze da approvare.

### Rischi del canale non ufficiale

Waxum collega il numero come dispositivo WhatsApp tramite una libreria non ufficiale. Il self-hosting non elimina possibili blocchi dell’account né rende l’integrazione una Cloud API ufficiale. Di default l’AI risponde solo a chat con messaggi ricevuti; lo staff può scrivere manualmente. Nessuna funzione di “fake reply” viene utilizzata.

## Migliorie UX e accessibilità

Per interventi, preferenze delle animazioni, verifiche e collaudo prima del rilascio, consulta [la nota UX](docs/ux-accessibilita.md).

La revisione successiva introduce [interfacce dedicate per gli inserimenti](docs/inserimenti-dedicati.md), senza checkbox native o scelte implicite nei nuovi moduli.
