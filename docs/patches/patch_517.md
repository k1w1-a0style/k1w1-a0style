# Patch 517: Preview-Remotepfad als klare SoT geschaerft

## Kontext

Der Preview-Hauptpfad existierte bereits: `DeviceFrame` rendert per `react-native-webview`, `usePreviewScreen` bevorzugt bereits vertrauenswuerdige Remote-URLs, und `usePreview` versucht schon zuerst `save_preview` / `preview_page`. Gleichzeitig wirkte der lokale HTML-/Sandpack-Pfad in Texten und Builder-Ausgabe noch zu nah an einem normalen gleichwertigen Produktpfad, obwohl er technisch nur als Rest-/Dev-Fallback gedacht ist.

## Geprueft

- `screens/PreviewScreen/hooks/usePreviewScreen.ts`: Remote-URL bleibt bereits vor HTML priorisiert, inkl. trusted-URL- und Expiry-Guard
- `screens/PreviewScreen/components/DeviceFrame.tsx`: Rendering laeuft bereits zentral ueber WebView
- `hooks/usePreview.ts`: Supabase wird bereits zuerst versucht; lokaler HTML-Pfad springt nur bei Ausfall oder explizitem Local-Mode ein
- `hooks/previewHelpers.ts`: Status-/Badge-/Channel-Texte praegen die sichtbare Produktwahrheit
- `lib/sandpackBuilder.ts`: lokaler HTML-/Eval-Pfad nutzt weiterhin Babel + `new Function(...)` und musste deshalb klarer als Dev-/Best-Effort-Fallback eingeordnet werden

## Aenderungen

- Preview-Status- und Channel-Texte auf "primaere Remote-Preview" vs. "lokaler HTML-/Eval-Dev-Fallback" geschaerft
- `DeviceFrame`-Lade-/CTA-Texte so angepasst, dass der erste Nutzerpfad explizit die Remote-Preview anfordert und lokales HTML nur als Fallback benannt wird
- `usePreview`-Kommentare und Fehltexte auf denselben Vertrag gezogen: Remote ist Produkt-SoT, lokaler HTML-/Eval-Pfad nur Best-Effort-Restrolle
- `lib/sandpackBuilder.ts` sichtbar als lokaler Dev-Fallback markiert; generiertes HTML weist nun selbst darauf hin, dass es kein server-verifizierter Produktpfad ist
- gezielte Tests erweitert: Remote-success bleibt primaer, lokaler Fallback bleibt sichtbar sekundaer, Sandpack-HTML bleibt explizit als Fallback gekennzeichnet

## Bewusst nicht geaendert

- keine neue Preview-Architektur und kein Umbau von Auth-/Workflow-/CORS-Themen
- kein Entfernen des lokalen Fallbacks, weil bestehende Flows und Tests ihn weiterhin als Best-Effort-Rettungsweg brauchen
- keine Dependency-Updates und keine unrelatierten Refactors
