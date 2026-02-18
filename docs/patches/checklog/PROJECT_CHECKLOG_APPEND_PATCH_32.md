# Patch 32 – CodeScreen WebView Injection-Hardening

## Ziel
Die initiale Text-Injektion im `WebCodeEditor` wurde bisher in den HTML-String eingebettet ("...>${initialValue}</textarea>..."). Das ist fragil (Quotes/Backticks) und kann im Worst-Case zu JS/HTML-String-Breakouts führen.

Patch 32 setzt **Initial-Value** und **Placeholder** ausschließlich per **JSON-Literal** *nach* dem DOM-Setup (also: `ta.value = INITIAL_VALUE; ta.placeholder = PLACEHOLDER_TEXT;`). Dadurch gibt es kein "User-Content in JS-String-Literals" mehr.

## Änderungen
- `screens/CodeScreen/components/WebCodeEditor.tsx`
  - Entfernt: HTML-Embedding von `initialValue`/`placeholder`
  - Neu: `INITIAL_VALUE` + `PLACEHOLDER_TEXT` als JSON-Literale im injected Script
  - Setzt `ta.value` und `ta.placeholder` nach dem `document.write()`/DOM-Setup
- `docs/TODO.md`
  - CodeScreen: Injection-Hardening als erledigt markiert

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- Manuell: CodeScreen öffnen, Datei wechseln, editieren, Undo/Redo-Toolbar testen
- Manuell: Inhalt mit `'`, `\`, `` ` ``, `${...}` testen (darf nichts crashen / keine Blackscreens)
