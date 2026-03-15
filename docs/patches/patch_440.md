# Patch 440 — Konservatives UX-/Flow-Feintuning der Kernpfade

## Ziel
Nach den großen Architektur-/Vertragsarbeiten verbleibende Alltags-Reibungen in zentralen Screens reduzieren, ohne neue Features oder Umbauten.

## Gefundene Feintuning-Probleme
- Preview-Fallback war technisch korrekt, aber unklar formuliert (kein Hinweis auf „letzter bekannter Stand“).
- Connections-Status unterschied „gespeichert“ vs. „letzter Context/Fallback“ sprachlich nicht klar genug.
- Build-/Diagnosis-/Credentials-Header verwendeten teils technische oder inkonsistente Begriffe.
- Chat-Menütext für „Neues Projekt“ war funktional korrekt, aber in Folgen/Erwartung etwas unklar.

## Minimaler Fix
- Wording in den betroffenen Komponenten gezielt geschärft (keine Struktur-/Flow-Umbauten).
- `getStatusText` aus `PreviewStatusBar` exportiert und über einen kleinen Regressionstest abgesichert.
- Bestehende EAS-Semantiktests auf die präzisierten Formulierungen aktualisiert.
- Backlog/To-do auf Patch-440-Stand aktualisiert.

## Warum bewusst klein
- Keine neue Architektur, keine State-Migrationen, keine Screen-Refactors.
- Nur Texte/Statussemantik + ein lokaler Test für stabile Logik.
