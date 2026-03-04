# Castello delle Sorprese 2026 — Knowledge Pack Chatbot (v2)

## Contenuto
Questo pacchetto contiene un file JSON con:
- Orari di ingresso e chiusura
- Aree con finestre di apertura
- Eventi speciali e sessioni (K-POP, BEE-Dance, lezioni, tornei, benessere, turni Snoezelen)
- FAQ/Intent con esempi di domande dei visitatori + template di risposta
- Regole/euristiche per generare programmi personalizzati

## File
- castello_chatbot_knowledge_v2.json

## Come usarlo
### 1) Custom GPT / Assistant
Carica il JSON come knowledge e chiedi al bot di rispondere usando solo i dati del file.
Per un programma personalizzato, fai raccogliere:
- ora di arrivo
- presenza bambini + età
- preferenze (K-pop, Magia, Principesse, Tornei, Ballo, Snoezelen, Merlino, Benessere, Sentiero)

### 2) Chat widget (RAG)
Indicizza il JSON. Per 'cosa c'è ad una certa ora':
- calcola cosa è aperto (open_windows o sessioni che coprono l'orario)
- mostra i prossimi 2 eventi speciali che partono entro 60 minuti

### 3) Bot deterministico (senza LLM)
Usa le liste 'open_windows' e 'specials' per calcolare aperture e prossimi eventi.

## Nota
Il Sentiero Incantato è lungo circa 1 km ed è aperto 09:30–17:00.
