# Patch 306 — CI-Lite Parsing, Diagnostics KI-Fix-Flow, EAS-Linking UX, Preview-Härtung, UI-Polish

## Ziel
Fokussierte Stabilisierung für die von dir genannten Bereiche:
- CI/Lint/Typecheck-Status im Header robuster aus Logs ableiten
- Diagnostics: für **jedes** Issue eine Fix-Route (Auto-Fix oder KI-Fix)
- Connections: EAS Project ID direkt testen/verlinken/neu erstellen+verlinken
- PreviewScreen: Navigation-Whitelist korrekt verwenden + UX-Texte verbessern
- Erste visuelle Überarbeitung (Diagnostics + RepoScreen)
- KI-Modelle um neue Optionen ergänzt

## Änderungen

### 1) CI Lite Header robuster
- `components/ciLite/ciLiteUtils.ts`
  - Log-Parser für Lint/Typecheck erweitert (mehr Output-Formate erkannt)
  - Fehlerzählung und Success-Erkennung robuster gemacht

### 2) Diagnostics: Fix-Optionen für alle Checks
- `components/diagnostics/IssueDetailSheet.tsx`
  - Deutschsprachige CTA-Texte
  - Bei Auto-Fix: zusätzlich „An KI senden"
  - Ohne Auto-Fix: expliziter „KI-Fix anfragen"
- `screens/DiagnosticScreen/index.tsx`
  - Neuer `sendIssueToChat`-Flow mit vorbefüllter, strukturierter Nachricht
  - KI-Fix-Button direkt in der Checkliste
- `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
  - Fix-Label in Issue-Details durchgereicht

### 3) Connections: EAS-ID testen/linken/erstellen
- `screens/ConnectionsScreen/components/EasCard.tsx`
  - neue Buttons: „EAS prüfen“, „Vorhandene ID verlinken“, „Neue ID erstellen + verlinken"
- `screens/ConnectionsScreen/index.tsx`
  - Actions aus Hook verdrahtet und Busy-State berücksichtigt

### 4) PreviewScreen Fix
- `screens/PreviewScreen/hooks/usePreviewScreen.ts`
  - `originWhitelist` aus shared navigation hook nach außen gegeben
- `screens/PreviewScreen/PreviewScreen.tsx`
  - WebView nutzt jetzt `originWhitelist` aus Hook (statt hardcoded)
  - mehrere UX-Texte auf Deutsch/Unicode verbessert

### 5) KI-Modelle erweitert
- `contexts/AIContext/models.ts`
  - OpenAI: `gpt-5-mini` ergänzt
  - Anthropic: `claude-3-7-sonnet-20250219` ergänzt
  - Gemini: `gemini-2.5-pro` ergänzt

### 6) UI-Polish
- `screens/DiagnosticScreen/styles.ts`
  - stärkere Neon-/Dark-Kontraste, neue KI-Fix-Chip-Styles
- `screens/GitHubReposScreen/styles.ts`
  - Karten/Controls mit klarerer Neon-Akzentuierung und besserem Spacing

## Checks
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Alle drei Checks sind in dieser Session grün gelaufen.
