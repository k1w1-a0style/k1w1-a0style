# Expo Web / QR-Web-Preview – Machbarkeits-Audit (Projekt k1w1-a0style)

## Scope

Dieses Dokument bewertet **nur die Machbarkeit**, nicht die direkte Implementierung.
Fokus: Kann Expo Web / Browser-Preview (inkl. QR) in diesem Repo als offizieller Preview-Modus tragfähig sein?

## Ist-Zustand (relevant)

1. Das Projekt ist eine Expo-App, aber die öffentliche Expo-Config ist aktuell auf `ios`/`android` begrenzt (kein `web` in `platforms`).
2. Navigation läuft über React Navigation in `App.tsx` (Drawer + Tabs + Stack), nicht über Expo Router.
3. Der bestehende Preview-Flow in der App ist bereits zweistufig:
   - bevorzugt **Supabase-hosted Preview** (`save_preview` -> `preview_page`)
   - fallback auf **lokales HTML** (`buildSandpackHtml`)
4. Preview-Rendering im Host erfolgt über `react-native-webview` (PreviewScreen + Fullscreen), inkl. spezifischer WebView-Guards/Navigation.
5. Für die zu previewenden Projektdateien werden RN/Expo-Imports im Fallback bereits heuristisch Richtung Web normalisiert (`react-native` -> `react-native-web`, Expo-Pakete rausgefiltert).

## Bewertung Expo Web / QR-Web-Preview

### Positiv (was bereits passt)

- Expo SDK 54 + React 19 + RN 0.81 sind im Repo vorhanden.
- Es gibt einen klaren App-Einstieg (`App.tsx`) und konsistente Navigation.
- Es existiert bereits ein browserbasierter Preview-Gedanke (Supabase Preview URL), wodurch ein QR-Flow organisatorisch schon nahe liegt.

### Kritische Hürden / Blocker

1. **Web-Plattform nicht aktiv konfiguriert**
   - Die derzeitige Expo-Config listet nur `ios` und `android`.
   - Damit ist Expo Web als offizieller Modus aktuell nicht „ready by config".

2. **Starke Native-Abhängigkeit in Kern-Screens**
   - Viele Screens importieren Expo-/Native-Module direkt (`expo-file-system`, `expo-sharing`, `expo-image-picker`, `expo-document-picker`, `expo-notifications`, `expo-secure-store`, `react-native-webview`, etc.).
   - Ohne harte Guards/Fallbacks können solche Imports in einer echten Web-Laufzeit zu Feature-Lücken oder Bruchstellen führen.

3. **Preview-UX basiert aktuell auf WebView, nicht auf Browser-Renderpfad des Host-Apps**
   - Der zentrale Preview-UI-Flow setzt auf `react-native-webview`.
   - Für eine offizielle Expo-Web-App müsste dieser Kernpfad für Web explizit ersetzt/abgezweigt werden (z. B. iframe/div + direkte URL-Navigation statt WebView-API).

4. **Produktanforderung „echte visuelle Vorschau“ betrifft Zielprojekt, nicht nur Host-App**
   - Der aktuelle Preview-Mechanismus erzeugt aus Dateiinhalten eine Web-Vorschau (Supabase/Sandpack).
   - Ein Expo-Web-Start der **Builder-App selbst** löst nicht automatisch die robuste Vorschau des **bearbeiteten Zielprojekts**.
   - Für eine echte Expo-Web-Preview des Zielprojekts wäre ein separater Bundling/Runtime-Ansatz nötig (deutlich größer als „kleiner Modus-Switch").

5. **Praktikabilitätstest im Environment**
   - `expo start --web` lief hier nicht stabil durch (CLI-Fetch/Netzthema), d. h. Web-Betrieb ist in dieser Umgebung nicht ohne Weiteres validierbar.

## Vergleich: Expo Web / QR-Web vs. aktueller lokaler HTML/WebView-Fallback

- Der **lokale Fallback** ist technisch klar als Notfallpfad implementiert (heuristische Transpilation/Normalisierung).
- Eine **Expo-Web-Alternative** wäre nur dann klar besser, wenn sie reale Projekt-UI reproduzierbar rendert und native Abhängigkeiten kontrolliert degradiert.
- Im aktuellen Stand wäre Expo Web voraussichtlich **nicht sofort stabiler** als der bestehende lokale Fallback – eher ein zusätzlicher, potenziell ebenso fragiler Pfad ohne Vorarbeiten.
- Dagegen ist der vorhandene **Supabase Preview URL**-Pfad bereits browserfähig und QR-tauglich (URL-basiert), daher kurzfristig realistischer als ein vollständiger Expo-Web-Hostmodus.

## Empfehlung

**Entscheidung: B) Expo Web / QR-Web-Preview wäre sinnvoll, aber erst nach gezielten Vorarbeiten.**

Nicht als sofortiger Hauptmodus.
Kurzfristig ist Supabase-Preview (URL/QR) als offizieller Browser-Preview-Weg realistischer.

## Kleinste sinnvolle Vorarbeiten (ohne Großumbau)

1. **Config-Vorarbeit:** Web-Plattform in Expo-Konfiguration sauber aktivieren und dokumentieren (inkl. klarer „supported on web"-Grenzen).
2. **Web-Kompatibilitäts-Audit pro Screen:** alle direkten nativen Imports markieren und für Web-Path mit Guards/Fallbacks versehen (priorisiert: Preview, Code, AppInfo, Terminal, Notifications, SecureStore).
3. **Preview-Rendering entkoppeln:** WebView-zentrierte Preview-Komponenten um einen Web-spezifischen Renderpfad erweitern (kein Totalrefactor, nur gezielte Adapter-Schicht).
4. **QR-UX offiziell machen:** vorhandene Supabase-Preview-URL als standardisierten QR-/Browser-Preview-Flow produktisieren (inkl. Ablaufzeit-/Fehlerhinweise).
5. **Stabilitätskriterien definieren:** Mindestkriterien für „brauchbare visuelle Vorschau" festlegen (Navigation sichtbar, Kernscreen rendert, Fehlerbanner statt Blankscreen, reproduzierbar).

## Schlussfazit

Expo Web klingt strategisch sinnvoll, ist hier aber **noch nicht unmittelbar tragfähig als Hauptalternative**.
Als **sekundärer Modus nach kleinen, gezielten Vorarbeiten** realistisch.
Bis dahin liefert die bestehende Supabase-URL-Preview (ggf. QR-geführt) den pragmatischsten Weg zu einer brauchbaren visuellen Vorschau.
