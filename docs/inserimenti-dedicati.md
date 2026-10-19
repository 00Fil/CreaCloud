# Inserimenti dedicati · seconda revisione UX

Questa revisione supera la semplice aggiunta di controlli standard. I moduli sono organizzati attorno all’operazione che la persona deve compiere, mantenendo font, palette, forme e preferenze di movimento del progetto.

## Interfacce implementate

| Operazione | Interfaccia dedicata |
| --- | --- |
| Creare una famiglia | Tre sezioni riconoscibili: famiglia, genitore facoltativo, studente facoltativo. Spiegazione di ciò che verrà creato. |
| Creare un tutor | Identità, contatto, modalità visive selezionabili e compenso. Indicazione del passaggio successivo: materie e disponibilità. |
| Aggiungere studente o genitore | Etichette visibili, contatti e indicazioni specifiche sull’associazione alla famiglia. |
| Richiedere lezioni | Materia e obiettivo, selettore di frequenza, durata a segmenti, modalità, tutor preferito, scelta esplicita sulla flessibilità e riepilogo dinamico. |
| Aggiungere un impegno | Scelta tra ricorrenza settimanale e data precisa; i campi non pertinenti non vengono mostrati né inviati. Priorità spiegate in linguaggio comune. |
| Inserire disponibilità o orari | Giorni come pulsanti selezionabili, nessun giorno preselezionato, orari iniziale/finale e spiegazione dell’effetto sulle nuove pianificazioni. |
| Registrare un’assenza | Data e scelta esplicita tra fascia oraria e giornata intera. Gli orari compaiono solo quando servono. |
| Registrare una chiusura | Scelta tra singolo giorno e periodo; data finale visibile solo per il periodo, con indicazione che gli estremi sono inclusi. |
| Aggiungere una postazione | Nome riconoscibile, contatore dei posti con meno/più e spiegazione della capienza. |
| Aggiungere una materia | Nome e indicazioni su come sarà usata nelle richieste e associata ai tutor. |
| Associare materia a un tutor | Materia non preselezionata e livelli scolastici facoltativi con spiegazione del significato. |
| Incassare da una famiglia / pagare un tutor | Destinatario e periodo in evidenza, importo effettivo, residuo richiamabile con azione esplicita, data correggibile e nota. Specificato che si registra denaro già movimentato, senza trasferire fondi. |
| Spostare una lezione | Nuova data, ora e tutor con valori dell’appuntamento attuale, più spiegazione del blocco della lezione nel motore. |
| Annullare una lezione | Condizioni economiche descritte per ogni scelta e pulsante finale coerente con l’azione distruttiva. |

Anche le checkbox precedenti di modalità tutor, assistente AI e consensi sono state sostituite con controlli visivi descrittivi. Nelle modifiche vengono mostrati i dati realmente già salvati: non sono nuovi consensi o preferenze attribuiti automaticamente.

## Principi applicati

- Nessuna checkbox nativa renderizzata nelle interfacce applicative aggiornate.
- Nessuna modalità di insegnamento, materia, frequenza, durata, flessibilità o giornata intera selezionata implicitamente nei nuovi inserimenti che richiedono tali scelte.
- Per i dati naturalmente suggeribili, la proposta è esplicita: la data di pagamento parte da oggi ma è modificabile; una postazione parte da un posto perché deve averne almeno uno; il residuo non viene usato senza premere il relativo pulsante.
- Le alternative esclusive usano semanticamente radio button, ma con schede e segmenti disegnati nel linguaggio visivo del progetto. Le scelte multiple di giorni/modalità usano pulsanti con stato `aria-pressed`.
- Campi condizionali al posto di opzioni contraddittorie mostrate tutte insieme.
- Titoli, sezioni, esempi e messaggi spiegano l’effetto dell’operazione, non soltanto il nome tecnico del campo.
- Pulsanti con descrizioni concrete, non un generico “Aggiungi” per operazioni diverse.
- Stato di salvataggio e messaggi di errore; in caso di errore i dati restano compilati.
- Dopo un salvataggio riuscito, i controlli vengono reimpostati dopo il reset nativo di React, evitando che un select mostri silenziosamente la prima opzione valida.
- Le transizioni dei nuovi controlli rispettano la disattivazione delle animazioni già implementata.

## Integrazione tecnica

I moduli sono in `apps/web/components/entries/` e sono collegati alle Server Actions già presenti. `primitives.tsx` contiene soltanto struttura, accessibilità e comportamento condiviso; il contenuto dei flussi è separato per dominio.

`apps/web/lib/ui/entry-validation.ts` valida anche lato server le scelte esplicite. In particolare non vengono più inventate modalità in presenza, fasce orarie complete o variazioni di durata se i valori sono mancanti. Le richieste di lezione inviano `flexible_duration` come `on` o `off`.

Nessuna nuova dipendenza applicativa e nessuna migrazione del database.

## Verifiche

- TypeScript e build produzione verificati dopo la rimozione delle anteprime di test.
- Vitest: 133 test riportati come passati su 8 file. Il test preesistente che richiama il motore Python termina anticipatamente se mancano i suoi moduli: il solver non è stato collaudato realmente in questo ambiente.
- Chromium: 29 schermate/stati dei componenti con dati dimostrativi, a 390 px mobile e 1100 px desktop; nessun overflow orizzontale e nessuna checkbox nativa rilevata negli stati provati.
- Verificati dati effettivamente inviati per richieste, giorni multipli, assenza di giornata intera e pagamenti; nessun invio dei moduli incompleti o di un incasso di zero euro.
- Verificato il passaggio da ricorrenza settimanale a data precisa e da fascia oraria a giornata intera: i campi non pertinenti vengono rimossi.
- Verificati: nessuna materia o radio preselezionata nel nuovo modulo lezioni, assenza di selezioni implicite dopo il salvataggio, tastiera con frecce nei radio, conservazione del testo dopo un errore simulato, tema scuro e movimento ridotto.
- Anteprima con dati dimostrativi: `anteprima-inserimento-lezioni.png`.

Le verifiche interattive hanno usato componenti reali e azioni dimostrative, non un centro collegato a Supabase/Waxum. Resta necessario il collaudo in staging con le policy RLS, utenti e contatti di prova, browser e dispositivi del team. Non è stata aggiunta alcuna route pubblica di anteprima al progetto finale e non è stato eseguito un deploy.
