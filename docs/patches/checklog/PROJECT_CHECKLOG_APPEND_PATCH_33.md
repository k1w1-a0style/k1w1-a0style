# Patch 33 – CodeScreen Deep-Dive (Focus + Bridge)

## Ziel
- WebView-Editor stabilisieren: **Focus-Tracking** korrekt auswerten, damit externe `value`-Updates nicht während des Tippens reindrücken (Cursor-Sprünge / Zeichenverlust vermeiden).
- Wert-Updates konsequent über **postMessage** in die WebView schicken (statt ständig JS-Strings neu zu bauen).

## Änderungen
- `screens/CodeScreen/components/WebCodeEditor.tsx`
  - Web-Seite sendet jetzt Events: `ready`, `focus`/`blur`, `value`.
  - Native-Seite tracked Focus über `focusedRef`.
  - Wenn der Editor fokussiert ist, werden eingehende `value`-Prop-Updates **nicht** in die WebView gedrückt.
  - `setValue`/`undo`/`redo` laufen über `postMessage` (sauberer Bridge-Channel).

## Tests
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweis
- Keine beabsichtigten UI-Änderungen außer einem kleinen Toolbar-Bereich (Undo/Redo) – falls dieser im aktuellen Stand schon vorhanden ist, bleibt er im Stil minimal.
