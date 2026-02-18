# Patch 30 – CodeScreen: Mini-Toolbar + robust command bridge

## Ziel
- Keine große UI-Änderung am CodeScreen.
- WebView-Editor bekommt eine **kleine, unauffällige** Overlay-Toolbar mit **Undo/Redo**.
- Bridge wird erweitert, sodass RN ↔ Web zuverlässig **Commands** (undo/redo/focus/selectAll) schicken kann.
- TODO wird aktualisiert (CodeScreen-Stand + offene Punkte).

## Änderungen
### `screens/CodeScreen/components/WebCodeEditor.tsx`
- Bridge-Protokoll:
  - `postMessage({ __t: "set", value })` für Content-Sync
  - `postMessage({ __t: "cmd", cmd })` für Commands (undo/redo/etc.)
- Backwards compatible: wenn nur ein String kommt, wird das wie bisher als Content behandelt.
- Mini-Toolbar (Overlay oben rechts):
  - Undo / Redo
  - deaktiviert im ReadOnly-Modus
- Navigation wird blockiert (`onShouldStartLoadWithRequest`) damit kein "weg-navigieren" passiert.

### `docs/TODO.md`
- Neuer Abschnitt **CodeScreen**: erledigt/offen.

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
