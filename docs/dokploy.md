# Messa in produzione con Dokploy

[Dokploy](https://dokploy.com) gestisce il server al posto nostro: scarica il repository da GitHub, costruisce le immagini Docker, avvia i servizi e ottiene il certificato HTTPS. A ogni push su `main` ripete tutto da solo.

Il database resta su Supabase (progetto gestito in UE). Su Dokploy girano i tre servizi di [`docker-compose.yml`](../docker-compose.yml):

| Servizio | Cosa fa | Raggiungibile da internet |
|---|---|---|
| `web` | dashboard, webhook WhatsApp, assistente AI | sì, dal dominio |
| `engine` | motore di pianificazione | no, solo da `web` |
| `waxum` | API WhatsApp self-hosted | no, solo da `web` |

## 1. Prima di iniziare

- **Supabase.** Segui i passi 1 e 2 di «Messa in produzione» nel [README](../README.md): progetto in UE, schema applicato con `supabase db push`, primo coordinatore creato.
- **Server.** Una VPS in UE con almeno 4 GB di RAM: Dokploy ne chiede 2, ma la build della dashboard sul server ne usa parecchia. Installa Dokploy come utente root:
  ```bash
  curl -sSL https://dokploy.com/install.sh | sh
  ```
  Poi apri `http://IP-DEL-SERVER:3000` e crea l'account amministratore.
- **Dominio.** Crea un record DNS di tipo A che punta `gestione.creattivamente.it` (o il dominio che scegli) all'IP del server.
- **GitHub.** In Dokploy, *Settings → Git → GitHub*, collega l'account e concedi l'accesso al repository `00Fil/CreaCloud`.

## 2. Creare il servizio

1. *Projects → Create Project*, per esempio «Creattivamente».
2. Dentro il progetto: *Create Service → Compose*, tipo **Docker Compose** (non Stack: Stack non costruisce le immagini).
3. Scheda **General**: provider **GitHub**, repository `00Fil/CreaCloud`, branch `main`, *Compose Path* `./docker-compose.yml`. Salva.
4. Scheda **Advanced**: attiva **Enable Isolated Deployment** e salva. I tre servizi hanno una rete tutta loro e i nomi `web`, `engine` e `waxum` non si scontrano con altre app sul server.

## 3. Variabili d'ambiente

Nella scheda **Environment** incolla il contenuto di [`.env.example`](../.env.example) e compila i valori. Dokploy li salva in un file `.env` accanto a `docker-compose.yml`, che il compose passa ai servizi.

- Obbligatorie: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENGINE_TOKEN`, `WAXUM_TOKEN`, `WAXUM_JWT_SECRET`, `WAXUM_SESSION_ID`, `WAXUM_WEBHOOK_URL`, `WAXUM_WEBHOOK_SECRET` e la chiave AI (`GEMINI_API_KEY` oppure le variabili `VERTEX_*`). Se ne manca una, il deploy si ferma con il nome della variabile.
- Per i token e i segreti usa stringhe lunghe e casuali, per esempio l'output di `openssl rand -hex 32`.
- `ENGINE_URL` è già impostato dal Compose. `WAXUM_URL` vale `http://waxum:3451` per il servizio incluso. `WAXUM_WEBHOOK_URL` deve invece essere il dominio HTTPS pubblico della dashboard seguito da `/api/whatsapp/waxum`: Waxum rifiuta URL webhook privati/localhost.
- Le variabili `NEXT_PUBLIC_*` finiscono nel codice della dashboard durante la build. Se le cambi, serve un nuovo deploy.

## 4. Dominio e HTTPS

Scheda **Domains → Add Domain**:

| Campo | Valore |
|---|---|
| Service Name | `web` |
| Host | `gestione.creattivamente.it` |
| Path | `/` |
| Container Port | `3000` |
| HTTPS | attivo, certificato **Let's Encrypt** |

Solo `web` riceve un dominio: motore e Waxum restano chiusi dentro il server.

## 5. Deploy

Premi **Deploy** nella scheda General e segui i log. La prima build richiede qualche minuto. Quando tutti e tre i servizi risultano *healthy*, apri il dominio, accedi e continua dal passo 4 del README (pulsante Collega e QR di WhatsApp in *Impostazioni*).

Gli aggiornamenti partono da soli: con il provider GitHub, *Auto Deploy* è attivo e ogni push su `main` rifà il deploy. Si può spegnere dalla scheda General.

## Da sapere

- **Sessione WhatsApp.** Waxum salva SQLite e credenziali del dispositivo nel volume `waxum-data`. Il volume `wa-auth` della vecchia versione non è compatibile: serve un nuovo abbinamento QR. Esegui backup del volume Waxum a servizio fermo (oppure backup coerenti SQLite). Non clonare credenziali attive su due istanze. Dalla scheda **Volume Backups** puoi programmarne il backup.
- **Nuove migrazioni del database.** Dokploy non tocca Supabase: quando arriva una nuova migrazione in `supabase/migrations`, applicala come prima con `supabase db push`.
- **Server senza Dokploy.** [`deploy/docker-compose.yml`](../deploy/docker-compose.yml) avvia gli stessi servizi con Caddy davanti per HTTPS. Non usarlo sullo stesso server di Dokploy: entrambi vogliono le porte 80 e 443.
- **Problemi comuni.** *Bad Gateway* vuol dire quasi sempre porta sbagliata nel dominio (deve essere `3000`). Un *404* dopo aver cambiato il dominio si risolve con un nuovo deploy.

## Migrazione e istanza esterna

Applica `supabase db push` prima di usare la nuova versione. Segui [docs/waxum.md](waxum.md) per passare dal vecchio trasporto o collegare una tua istanza Waxum già installata. Non creare un dominio pubblico sul servizio `waxum` se usi quello interno.
