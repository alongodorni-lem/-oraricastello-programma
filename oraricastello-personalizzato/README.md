# OrariCastello Personalizzato

Seconda versione separata da `oraricastello-programma`, con:
- form utente per preferenze e profilo famiglia
- generazione itinerario personalizzato
- download diretto PDF
- registrazione preferenze (inclusa email utente) su Google Sheets

## Stack
- Node.js + Express
- Frontend statico (`public/`)
- PDFKit
- Google Sheets API
- opzionale rifinitura testo con OpenAI

## Avvio locale
1. Copia `.env.example` in `.env` e configura le variabili.
2. Installa dipendenze:
   - `npm install`
3. Avvia in sviluppo:
   - `npm run dev`
4. Apri:
   - `http://localhost:3000`

## API
- `GET /api/health` stato servizio
- `GET /api/program` dataset attività
- `POST /api/personalize` genera piano + PDF scaricabile + log sheets

### Payload `/api/personalize`
```json
{
  "email": "utente@email.it",
  "arrivalTime": "10:30",
  "stayDuration": "between_2_5h_4h",
  "hasChildren": true,
  "childrenAges": [4, 7],
  "interests": ["Principesse", "Maghi", "Natura"],
  "freeText": "Preferiamo attività tranquille"
}
```

## Render deploy
1. Crea nuovo repo `oraricastello-personalizzato`.
2. Push del progetto.
3. Su Render crea **Web Service**:
   - Build command: `npm install`
   - Start command: `npm start`
4. Aggiungi Environment Variables da `.env.example`.

## Google Sheets setup
1. Crea Service Account in Google Cloud.
2. Abilita Google Sheets API.
3. Condividi il foglio con la mail del service account.
4. Inserisci `GOOGLE_SERVICE_ACCOUNT_JSON` e `GOOGLE_SHEET_ID`.
