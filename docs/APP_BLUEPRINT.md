# AO-Style – App Blueprint (Single Source of Truth)

## Worum geht’s (kurz)
AO-Style ist ein **automatischer APK-Builder**.

Du schreibst im **Chat**, was die Ziel-App können soll (z.B. Musikplayer).
Die App erzeugt/ändert dafür **Code + Dateien** im Projekt.
Du kannst alles in der App prüfen (**Code Screen**, **Preview**, **Terminal**).
Wenn alles passt, wird über **Diagnostic** geprüft/geflickt und danach über **Build** ein **GitHub → EAS Build** getriggert.

## Das wichtigste Gesetz (niemals brechen)
**Repo + Branch + Workflow werden IMMER aus der In-App Auswahl genommen.**

Das heißt:
- Nichts darf fest auf `main` oder auf eine feste Workflow-Datei verdrahtet werden.
- Falls Repo/Branch fehlen, muss die UI **blocken** und **klar sagen**, was fehlt.
- Nur ganz unten im Stack (z.B. GitHub API Default-Branch Lookup) darf es einen letzten Notfall-Fallback geben.

## Haupt-Flows

### 1) Verbinden (Tokens / Keys)
Screen: **Connections**
- User trägt GitHub Token + Expo/EAS Token + (optional) Admin Key ein.
- Danach können alle anderen Screens arbeiten.

### 2) Ziel-Repo & Branch auswählen
Screen: **GitHub Repos**
- User wählt **Repo** und **Branch** (Ziel-Projekt-Repo).
- Das wird als **Source of Truth** gespeichert (ProjectContext/GitHubContext).

### 3) Diagnose / Autofix
Screen: **Diagnostic**
- Prüft ob alles vorhanden ist (Workflows, Config, Secrets, Struktur).
- Darf kleine Fixes automatisch anwenden (Autofix), aber niemals Auswahl überschreiben.

### 4) Build starten
Screen: **Build**
- Startet den Build **für genau das ausgewählte Repo + Branch**.
- Trigger passiert über Supabase Edge Functions:
  - `trigger-eas-build` (repository_dispatch → GitHub Actions im Ziel-Repo)
  - CI Lite / Workflow dispatch (workflow_dispatch → optional für Checks/Linking)

### 5) Status / Logs
Screen: **Status / CI Lite Modal**
- Zeigt Fortschritt, Logs, Ergebnis.
- Muss sichtbar machen, was wirklich genutzt wurde:
  - Repo, Branch, Workflow, Build-Profil, Job-ID

## Screens (grobe Karte)
- Tabs: **Chat**, **Code**, **Terminal**
- Drawer: **Preview**, **Build**, **Status**, **GitHub Repos**, **Connections**, **Credentials Wizard**, **Settings**, **Diagnostic**, **App Info**

> Hinweis: Diese Liste ist „was der Code aktuell hergibt“ – beim Screen-für-Screen Abgleich wird das final festgezurrt.

## „Nicht wieder kaputt“ (Guardrails)
Wir nutzen **Invariants-Tests** ("YES-Tests"), die verhindern, dass jemand:
- `main` als Default im UI fest einbaut
- Repo/Branch/Workflow ignoriert

Wenn sowas passiert, muss **CI rot** werden.
