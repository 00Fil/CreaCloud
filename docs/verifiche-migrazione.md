# Verifiche della versione Waxum

## Controlli eseguiti

| Controllo | Esito |
|---|---|
| TypeScript (`npm run typecheck`) | Superato |
| Suite web (`npm test`) | 106 test superati, 5 file |
| Test specifici Waxum | 61 test client/parser/firma/ritmo + 14 test webhook, inclusi nella suite web |
| Contratto web → motore Python | Eseguito con dipendenze Python installate; superato |
| Pianificatore (`pytest -q`) | 15 test superati |
| Build Next.js produzione (`npm run build`) | Superata |
| Docker Compose locale/Dokploy | Configurazione valida |
| Docker Compose con Caddy | Configurazione valida |
| Override Waxum esterno, sia base sia Caddy | Configurazioni valide; servizio Waxum locale escluso dal modello attivo |
| Avvio HTTP della build e `GET /api/health` | 200 |
| Webhook senza firma | 401 |
| Webhook HMAC v2 valido, evento connessione | 200 |
| Webhook firmato per altra sessione | 403 |
| Immagine `fdciabdul/waxum:0.16.0` sul registro | Manifest disponibile |

Le quattro configurazioni Compose sono state validate con Docker Compose 2.39.4, senza avviare container. Le prove HTTP hanno usato solo segreti effimeri di test e nessun account WhatsApp. Il motore è stato verificato in un ambiente Python isolato. Le dipendenze installate, i file di build e gli ambienti di test non sono inclusi nello ZIP.

## Controlli non eseguiti

- Avvio dei container e verifica dei volumi sul server di destinazione.
- Esecuzione delle migrazioni su un database Supabase reale.
- Autenticazione contro l’istanza Waxum dell’operatore.
- Abbinamento QR e consegna reale di testi/vocali tramite WhatsApp.
- Verifica DNS/TLS e callback HTTPS dall’istanza self-hosted.

Questi controlli richiedono l’ambiente di destinazione. La checklist in `docs/waxum.md` descrive come completarli. Il pacchetto è codice adattato e verificato localmente, non un deployment già collaudato in produzione.
