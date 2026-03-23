# Patch 534 — PreviewScreen Layout-/Safe-Area-Restpunkte nach PR 396

## Ziel
Die zwei echten Review-Follow-up-Restpunkte aus PR 396 im bestehenden PreviewScreen-Layout sauber abschliessen, ohne das Preview-Konzept oder den DeviceFrame/WebView-Kern erneut umzubauen:
1. Der ScrollView-Hauptinhalt soll den verfuegbaren Viewport wieder robust fuellen.
2. Auf iOS soll genau ein Bottom-Safe-Area-Pfad aktiv bleiben, damit hinter der BottomBar kein zusaetzlicher Leerraum entsteht.

## Analyse
- Nach dem letzten ScrollView-Umbau war `preview-screen-active-path` nur noch ein intrinsischer Kind-Container im Scroll-Content. Dadurch konnte der Hauptbereich im Normalfall mit wenig Meta-Inhalt zu klein bleiben und die BottomBar optisch nach oben rutschen.
- Gleichzeitig verwendete der ScrollView `contentInsetAdjustmentBehavior="always"`, waehrend die BottomBar ihr `paddingBottom` bereits aus `useSafeAreaInsets()` bekam. Auf iOS/Home-Indicator-Geraeten entstand dadurch ein doppelter Bottom-Inset-Pfad.
- Der DeviceFrame-/WebView-Kern war nicht das Problem; benoetigt wurde nur eine gezielte Layout-Korrektur im bestehenden Screen-Aufbau.

## Aenderungen
- `screens/PreviewScreen/PreviewScreen.tsx`
  - setzt den ScrollView-Inset-Vertrag fuer diesen Screen auf `contentInsetAdjustmentBehavior="never"`, damit der Bottom-Inset nicht doppelt von iOS und der BottomBar kommt.
  - fuehrt fuer den aktiven Scroll-Hauptpfad eine explizite `screenScrollInner`-Fill-Struktur ein.
  - markiert den fill-orientierten Hauptbereich zusaetzlich mit `testID="preview-screen-main-content"` fuer fokussierte Layout-Regressionen.
- `screens/PreviewScreen/PreviewScreen.styles.ts`
  - fuehrt `screenScrollInner` als `flexGrow`-/`space-between`-Container ein, damit Hauptinhalt und BottomBar im Normalfall wieder den verfuegbaren Screen-Platz sinnvoll aufteilen.
  - stellt `previewBody` wieder explizit fill-orientiert auf (`flexGrow`, kein Kollaps auf rein intrinsische Hoehe).
  - verankert die BottomBar ueber `marginTop: 'auto'`, damit sie bei wenig Inhalt am unteren Bereich bleibt, ohne die Scrollbarkeit bei kurzen Hoehen zu verlieren.
- `__tests__/PreviewScreen.layout.test.tsx`
  - erweitert den bestehenden Layout-Vertrag um eine gezielte Regression fuer den fill-orientierten Tall-Layout-Fall.
  - prueft explizit den Single-Safe-Area-Vertrag (`contentInsetAdjustmentBehavior="never"` + BottomBar-Padding aus `useSafeAreaInsets`).

## Wirkung
- Der Hauptbereich unter `preview-screen-active-path` fuellt den verfuegbaren Viewport wieder robuster, auch wenn nur wenig oder kein Meta-Inhalt vorhanden ist.
- `previewBody` bzw. der DeviceFrame kollabieren im Normalfall nicht mehr unnoetig auf eine kleine intrinsische Hoehe.
- Die BottomBar bleibt im Tall-Layout wieder unten verankert statt optisch nach oben zu rutschen.
- Auf iOS gibt es keinen doppelten Bottom-Safe-Area-Leerraum mehr hinter den Action-Buttons.

## Tests
- `npx jest --runInBand __tests__/PreviewScreen.layout.test.tsx`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
