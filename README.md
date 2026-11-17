# Content Hero

Gestione dei task gamificata: XP, livelli, badge, sfide a tempo, premi e classifiche, sincronizzati in tempo reale su Firebase.

## Avvio in locale

**Prerequisiti:** Node.js 20+

1. `npm install`
2. Copia `.env.example` in `.env.local` e inserisci la configurazione Firebase (`VITE_FIREBASE_*`).
3. `npm run dev` → http://localhost:3000/content_hero/

Comandi utili: `npm run lint` (typecheck), `npm run build`.

## Funzionalità

| Area | Cosa fa |
| --- | --- |
| **Dashboard** | Livello e progressi, KPI per ruolo, task in scadenza, classifica, coda revisioni |
| **Task** | Vista griglia o kanban, filtri per stato, ricerca, ordinamento, dettaglio con cronologia e punteggio |
| **Revisioni** (manager) | Valutazione task con bonus/malus, respingimento con feedback, verifica sfide e consegna premi |
| **Sfide** | Sfide a tempo per area; il player segnala il completamento, il responsabile lo approva |
| **Traguardi** | Livelli, badge con avanzamento, catalogo premi con saldo XP spendibile |
| **Pianificazione** | Gantt e calendario su giornate lavorative 9–18 (esclusi weekend e festività italiane) |
| **Persone** (manager) | Approvazioni, ruoli, aree, responsabili, simulazione profilo, creazione utenti |
| **Log** (manager) | Cronologia completa con esportazione CSV |
| **Configurazione** (admin) | Aree, bonus/malus, badge e premi personalizzabili |

Tema chiaro/scuro (automatico o manuale), layout responsive con navigazione mobile dedicata.

## Struttura

```
src/
  App.tsx                 # autenticazione, routing (#/pagina), modali globali
  context.tsx             # stato condiviso dell'app
  hooks/                  # sincronizzazione Firestore, tema
  lib/                    # utilità, azioni Firestore, gestione errori
  components/ui           # design system (Button, Modal, Input, …)
  components/layout       # shell con sidebar e bottom nav
  features/<sezione>/     # una cartella per pagina
```

## Regole Firestore

Il file `firestore.rules` va pubblicato dopo ogni modifica:

```bash
firebase deploy --only firestore:rules
```

Le regole aggiornate sono necessarie per: accettazione/consegna dei task da parte dei player, cambio password obbligatorio,
segnalazione delle sfide e la nuova collezione `redemptions` (richieste premi).
