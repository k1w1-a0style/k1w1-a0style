# Patch 88 – Review Docs Merge (Screens + Supabase)

Datum: **2026-02-12**

## Ziel
- Verifikationen existierten als Einzel-Dokumente, aber es fehlte eine **gemeinsame, zentrale Übersicht**.
- Für einzelne Screens fehlten Verification-Dokumente.
- Supabase (Functions + Migrations) soll explizit Teil der Abnahme-Übersicht sein.

## Änderungen

### 1) Gemeinsame Übersicht (Index)
- Neu: `docs/reviews/SCREENS_VERIFICATION.md`
  - listet alle Haupt-Screens aus `/screens` mit Status + Link zur jeweiligen Detail-Verifikation.
  - enthält zusätzlich den Backend-Bereich „Supabase Functions + Migrations“.

### 2) Fehlende Verification-Dokumente ergänzt
- Neu: `docs/reviews/GITHUB_REPOS_SCREEN_VERIFICATION.md`
  - dokumentiert die Review-Abnahme für GitHubReposScreen (P1 Konsistenz/Race/Double-Submit).
- Neu: `docs/reviews/CODE_SCREEN_VERIFICATION.md`
  - placeholder/Tracking (pending), damit die Abdeckung vollständig bleibt.

### 3) Terminal Review bleibt aktuell
- `docs/reviews/TERMINAL_SCREEN_VERIFICATION.md` verweist nun explizit auf das neue Index-Dokument.

## Optik
- Keine UI/Optik-Änderungen.

## Hinweis
- Sobald ein vollständiges CodeScreen Review (Meta + Critical) vorliegt, wird `CODE_SCREEN_VERIFICATION.md` von „pending“ auf „verified“ hochgezogen und die Übersicht aktualisiert.
