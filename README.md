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
services/whatsapp-gateway collegamento al numero attuale (Baileys, non ufficiale)
supabase                  schema del database e dati di esempio
deploy                    docker compose + Caddy per un server unico
```

I due canali WhatsApp, il **numero attuale** (tramite gateway) e la **Cloud API ufficiale**, si scambiano da *Impostazioni*. Le risposte partono sempre dal canale da cui la persona ha scritto.

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

Test: `pytest` in `services/engine`, `npm test` in `apps/web`, `npm run build && npm test` in `services/whatsapp-gateway`.

## Messa in produzione

1. **Supabase.** Crea un progetto in regione UE (Francoforte), poi applica lo schema:
   ```bash
   supabase link --project-ref <ref> && supabase db push
   ```
   Il file `seed.sql` non va applicato in produzione.
2. **Primo coordinatore.** In Supabase, sotto *Authentication → Users*, crea l'utente con email e password. Poi, nell'editor SQL:
   ```sql
   insert into staff (id, full_name, role)
   select id, 'Nome Cognome', 'titolare' from auth.users where email = 'tua@email.it';
   ```
3. **Server.** Su una VPS in UE con Docker:
   ```bash
   cd deploy && cp ../.env.example .env   # compila tutti i valori
   docker compose up -d --build
   ```
   Caddy ottiene il certificato HTTPS per `DOMAIN`.
4. **Collegare il numero attuale.** Apri *Impostazioni* e inquadra il QR dal telefono (*WhatsApp → Dispositivi collegati*). Il telefono continua a funzionare normalmente.
5. **Cloud API (facoltativa).** Configura il webhook dell'app Meta su `https://DOMAIN/api/whatsapp/cloud` con il token `WA_CLOUD_VERIFY_TOKEN`. Per scrivere a chi non ha scritto nelle ultime 24 ore serve un modello approvato (`WA_TEMPLATE_NAME`).

### Costi AI

L'assistente usa Gemini: un modello veloce per i messaggi semplici e uno più capace per i casi dubbi o delicati. Le date, gli orari e i messaggi di conferma li calcola il codice, non il modello. Con 60 famiglie e 10 tutor la spesa stimata è di pochi euro al mese. Il tetto mensile si imposta da *Impostazioni*: oltre il tetto l'assistente non risponde più da solo e prepara bozze da approvare.

### Rischi del canale non ufficiale

Il gateway si collega come WhatsApp Web e Meta può limitare o bloccare un numero se rileva un uso automatico. Per ridurre il rischio, il gateway risponde solo a chi ha già scritto al centro, con ritmi umani e l'indicatore «sta scrivendo». Per la produzione stabile conviene la Cloud API.
