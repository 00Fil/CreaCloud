# Migliorie UX e accessibilità

**Revisione inserimenti:** i moduli di creazione sono stati ulteriormente riprogettati con interfacce dedicate, senza checkbox native e con scelte esplicite. Vedi [Inserimenti dedicati](inserimenti-dedicati.md) per il dettaglio aggiornato.

## Obiettivo e perimetro

Rendere il coordinamento più semplice anche per utenti non esperti, intervenendo sul comportamento dei componenti e non con un redesign.

Sono stati conservati Fraunces e Manrope, la palette carta/pervinca/pesca, le superfici, le forme arrotondate e la struttura di navigazione. I testi sui pulsanti con fondo pervinca/pesca e sui contatori usano l'inchiostro già presente nel sistema, invece del bianco, per migliorare il contrasto. Le dimensioni dei controlli sono state leggermente aumentate per facilitarne l'uso.

Nessuna nuova dipendenza applicativa, modifica allo schema Supabase o cambiamento al motore di pianificazione. Configurazione e comandi di avvio restano quelli del README.

## Cosa è cambiato

### Componenti condivisi

- Pulsanti con stato di attesa e blocco degli ulteriori clic nello stesso modulo durante l'operazione. Questa è una protezione UX, non un meccanismo di idempotenza lato server.
- Aree di attivazione dei pulsanti condivisi di almeno 44 px, etichette meno piccole e testo che può andare a capo anziché uscire dal contenitore.
- Campi con altezza minima, stati di disabilitazione ed errore; testo di almeno 16 px per evitare lo zoom automatico dei form su iOS.
- Tabelle scorribili e raggiungibili da tastiera, intestazioni con scope e regione identificata.
- Intestazioni delle card flessibili quando titolo e azioni non stanno sulla stessa riga.

### Orientamento e navigazione

- Guida facoltativa e richiudibile in Oggi: persone → bozza → calendario, con collegamenti reali alle sezioni.
- Link “Vai al contenuto”, navigazioni identificate e stato della pagina corrente esposto alle tecnologie assistive.
- Menu mobile basato su dialog nativo: sfondo non interagibile, focus iniziale sul pulsante di chiusura, ciclo Tab/Shift+Tab, Escape, ripristino del focus e chiusura passando al layout desktop.
- Altezza coerente di intestazione e pannelli chat; spazio per la barra inferiore e per la safe area del dispositivo.
- Spazi di scorrimento per evitare di portare i controlli focalizzati sotto le barre fisse.

### Moduli e azioni delicate

- Feedback di attesa, successo ed errore nei moduli delle impostazioni. Gli errori restituiti dal database non vengono più ignorati in questi salvataggi.
- Controlli su importi non negativi, capienza intera, fasce orarie e intervalli delle chiusure. La validazione dei valori generali avviene prima delle scritture; non è stata aggiunta una transazione per eventuali errori di rete tra scritture successive.
- Campi delle postazioni con etichette visibili e disposizione verticale su telefono; campi orario nativi e nomi accessibili per date, materia e altre impostazioni.
- Rimozione degli orari visibile anche senza hover, con conferma. Conferme anche per rimozione di chiusure e materie e scollegamento di WhatsApp.
- Conferma prima di sostituire il calendario con una bozza, scartare la bozza o inviare gli orari ai destinatari selezionati. Le conferme mantengono i dati del modulo e le Server Actions esistenti.
- Conferma prima di riattivare l'assistente automatico in una chat. Le etichette indicano l'azione (“Passa a manuale” / “Attiva assistente AI”), non soltanto lo stato.
- Stato di caricamento e pagina di errore del gruppo applicativo con istruzioni semplici; in caso di esito incerto si invita a verificare prima di ripetere un invio.

### Chat

- Ricerca identificata per nome e numero, filtri con stato selezionato accessibile e conteggio dei risultati per gli screen reader.
- Ricerca senza risultati con azione “Mostra tutte le chat”, che azzera ricerca e filtro.
- Testi alternativi per i messaggi non letti; etichette accessibili per scrittura e modifica delle bozze.
- Eliminata la larghezza minima della textarea della bozza che poteva creare problemi sugli schermi piccoli.

## Animazioni e preferenze

Percorso: **Impostazioni → Comfort e accessibilità → Animazioni e microinterazioni**.

- **Discrete (automatiche)**: transizioni dei pulsanti di 150 ms e ingresso di menu, conferme e guida di 180 ms, con spostamenti limitati. Nessun nuovo effetto decorativo continuo.
- **Disattivate**: animazioni e transizioni CSS vengono rimosse, inclusi gli indicatori animati e i movimenti dei pulsanti/link-pulsante. I messaggi di stato e la funzionalità rimangono disponibili.
- `prefers-reduced-motion: reduce` disattiva sempre il movimento, anche in modalità discreta.
- Preferenza locale al browser, non al profilo del centro, salvata con la chiave `creacloud.motion`. Applicata prima del primo rendering visibile e sincronizzata tra schede aperte.
- Se il browser impedisce il salvataggio, la scelta viene applicata alla sessione corrente e l'interfaccia lo segnala; non viene dichiarato un salvataggio persistente inesistente.
- Il bootstrap in `app/layout.tsx` è uno script inline statico. Se il deployment aggiunge una Content Security Policy restrittiva, autorizzarlo tramite hash/nonce secondo la policy del progetto.

## Verifiche eseguite

- `npm run typecheck`: superato.
- `npm run build`: superato, dopo la rimozione delle route temporanee di anteprima.
- `npm test`: Vitest riporta **133 test passati su 8 file**, inclusi 27 nuovi test complessivi per movimento, salvataggi e scelte esplicite. Il test preesistente di integrazione con il motore Python termina anticipatamente quando mancano i moduli Python: in questo ambiente il motore non è stato realmente eseguito. Il conteggio Vitest non equivale quindi a una verifica completa del solver.
- Prove interattive Chromium con componenti reali e dati dimostrativi: 1440 px desktop e 390 px mobile, tema chiaro/scuro, ricerca vuota, caricamento, errore, successo, attesa e conferme. Nessun overflow orizzontale rilevato negli stati provati e nessun errore JavaScript registrato nella suite finale.
- Verificati: persistenza dopo ricaricamento, fallback quando `localStorage.setItem` fallisce, propagazione tra schede e rispetto del movimento ridotto del sistema.
- Verificati: focus iniziale, Tab/Shift+Tab nel menu, Escape, ritorno al pulsante di apertura, chiusura al resize desktop e ripristino dello scorrimento.
- Verificato che la conferma inoltri i dati del modulo (`run_id`) e che i pulsanti siano disabilitati durante l'attesa.
- Ispezione visiva delle schermate e catture statiche con font, logo e stili originali incorporati.

Le anteprime dimostrative sono state usate solo localmente e rimosse dal progetto consegnato. Non sono stati aggiunti accessi pubblici alle pagine riservate o bypass dell'autenticazione.

## Prima del rilascio

Le prove UI non sostituiscono un collaudo delle pagine autenticate con un centro reale. Non sono state fornite credenziali Supabase/Waxum né è stato eseguito un deploy. Restano da verificare in staging:

1. Salvataggi reali con le policy RLS e aggiornamento dei dati nelle impostazioni.
2. Tentativo di rimozione di una materia già usata e messaggio di errore conseguente.
3. Conferma/scarto di una bozza reale e controllo delle lezioni bloccate.
4. Invio degli orari esclusivamente a numeri di prova, con controllo del mese e dei destinatari.
5. Chat reali, disattivazione/riattivazione dell'AI e collegamento WhatsApp.
6. Utilizzo su Safari/iOS, tastiere virtuali e screen reader del team: le prove automatiche sono state svolte su Chromium, non su tutti i browser o dispositivi.

Le migliorie di accessibilità sono mirate; non costituiscono una certificazione WCAG dell'intera applicazione o un audit completo di tutti i flussi esistenti.
