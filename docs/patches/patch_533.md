# Patch 533 — PreviewScreen-Mobilpfad und aktive Renderstruktur gehaertet

## Ziel
Der bestehende PreviewScreen soll auf echten schmalen Mobilgeraeten sichtbar stabiler wirken: keine optisch in den Inhaltsbereich kippende Toolbar, keine ueberlange Statuszeile, keine „schwebende“ Mittelzonen-Anmutung und keine stille leere Flaeche bei fehlender oder defekter Preview-Quelle. Gleichzeitig sollte geprueft werden, ob ueberhaupt noch ein zweiter oder veralteter Preview-Renderpfad aktiv ist.

## Analyse
- Der aktuelle Drawer-Route-Eintrag zeigt bereits direkt auf `screens/PreviewScreen`, waehrend `PreviewFullscreen` nur als separates Modal fuer den expliziten Vollbildpfad haengt. Es wurde kein zweiter aktiver Legacy-Preview-Screen gefunden; vorhanden sind nur Re-export-Shims auf denselben Implementierungsordner.
- Die eigentliche Mobilinstabilitaet lag vor allem in der Verdichtung von langem Titel, Hot-Reload-Button und mehreren Action-Buttons in eine einzige Toolbar-Zeile sowie in einer Statusbar, die Text, Stats, Badges und Hinweise ebenfalls in eine knappe Row presste. Auf schmalen Geraeten wirkte das schnell so, als rutsche die Control-Leiste in den Hauptbereich.
- Der DeviceFrame-Kernfix selbst war bereits vorhanden. Der noetige Restfix lag daher tiefer in der Layout-Haertung rund um Toolbar/Status/Hauptflaechenvertrag statt im erneuten Umschreiben des WebView-/Fallback-Kerns.

## Aenderungen
- `screens/PreviewScreen/PreviewScreen.tsx`
  - nutzt `useWindowDimensions()` fuer einen kleinen Compact-Mode auf schmalen Breiten.
  - verankert Statusbereich und Preview-Hauptflaeche jetzt in einer klaren `screenContent`-/`previewBody`-Struktur, damit DeviceFrame den Hauptplatz behaelt und BottomBar weiter sauber am unteren Rand sitzt.
  - fuehrt einen kleinen `testID`-/Renderanker (`preview-screen-active-path`) fuer die aktive PreviewScreen-Struktur ein.
- `screens/PreviewScreen/hooks/usePreviewScreen.ts`
  - exponiert einen kleinen Runtime-Hinweis mit aktivem Screen, Preview-Quelle, Display-State und Phase, damit leichter erkennbar ist, dass der aktuelle Pfad laeuft.
- `screens/PreviewScreen/components/PreviewToolbar.tsx`
  - unterstuetzt jetzt einen kompakten Mobilmodus.
  - kuerzt im Compact-Mode den Titel auf `Preview`, laesst die Actions umbrechen und verhindert so, dass der Titel die Action-Leiste kaputtquetscht.
  - versieht die Controls mit klaren Accessibility-Labels und rendert den kleinen Runtime-Hinweis in Dev/Test unaufdringlich mit.
- `screens/PreviewScreen/components/PreviewStatusBar.tsx`
  - trennt Status-Headline und Meta-Badges in flexiblere Teilbereiche.
  - begrenzt lange Texte auf kompakte Mehrzeilen-/Line-Clamp-Darstellung fuer schmale Geraete.
  - zeigt den Runtime-Hinweis auch hier in Dev/Test unaufdringlich an.
- `screens/PreviewScreen/PreviewScreen.styles.ts`
  - fuehrt die noetigen Wrap-/Compact-/Meta-Layout-Regeln fuer Toolbar, Statusbar, Preview-Hauptflaeche und Meta-Karten ein.
  - entfernt die alte Margin-Stapelung der URL-/Error-Karten zugunsten eines zusammenhaengenden Meta-Stacks unter dem DeviceFrame.
- Tests
  - neuer Narrow-Layout-Test fuer die Toolbar.
  - Layout-Test um den aktiven Renderanker erweitert.
  - bestehende Status-/WebView-/Fallback-Tests an die neue Struktur angepasst.
  - `__tests__/k1w1Handler.providers.invariants.test.ts` auf den bestehenden `getRuntimeEnv(...)`-Server-Secret-Vertrag aktualisiert, damit die volle Suite wieder mit dem aktuellen Branch-Stand grün laeuft.

## Wirkung
- Auf schmalen Mobilgeraeten bleibt die Toolbar oberhalb des Inhaltsbereichs optisch zusammenhaengend und kippt nicht mehr als gequetschte Einzelzeile in den Screen.
- Die Statusbar kann lange Hinweise kompakter aufnehmen, ohne den Hauptbereich unnoetig stark zusammenzudruecken.
- Der DeviceFrame behaelt den Hauptplatz, waehrend URL-/Error-Karten sauber darunter gruppiert sind.
- Fehlende oder defekte Preview-Quellen bleiben weiter als sichtbarer Fallback-/Fehlerzustand erkennbar statt als dunkle „Nichts passiert“-Flaeche.
- Ein zweiter aktiver Legacy-Preview-Pfad wurde nicht gefunden; die aktive Implementierung bleibt der bestehende `PreviewScreen`-Ordnerpfad.

## Tests
- `npx jest --runInBand __tests__/PreviewScreen.layout.test.tsx __tests__/previewToolbar.layout.test.tsx __tests__/previewStatusBar.statusText.test.ts __tests__/previewWebViewContract.test.tsx`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
