# Patch 356 — CI Lite: Schlussfolgerung immer respektieren

## Problem
Die CI‑Lite Anzeige konnte **"Alles grün"** zeigen, obwohl der zugehörige GitHub Actions Run bereits **`completed`** war und die **`conclusion`** z.B. **`failure`** hatte.

Ursache: In `useCiLiteWorkflow` wurde bei `completed` nur dann ein Fehler gezeigt, wenn der Log‑Parser mindestens eine Error‑Zeile extrahieren konnte. Wenn GitHub mit `failure` endet, aber der Parser nichts Greifbares findet (oder Logs kurz/leer sind), wurde fälschlicherweise **OK** angezeigt.

## Fix
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
  - Sobald `status === "completed"` und GitHub eine `conclusion` liefert, wird diese **als Source of Truth** verwendet:
    - `success` => OK
    - alles andere (`failure`, `cancelled`, `timed_out`, `action_required`, …) => **Fehler**
  - Nur wenn GitHub **keine** `conclusion` liefert (selten), wird auf den Log‑Fehler‑Scan fallbackt.

## Erwartetes Ergebnis
- Keine False‑Positives mehr: **Run = failure ⇒ UI = Fehler**, auch wenn die Error‑Extraktion nichts findet.
