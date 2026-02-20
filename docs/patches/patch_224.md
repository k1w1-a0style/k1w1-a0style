# Patch 224 — CI Lite details + Connections Sync Summary + Repo Hygiene

## Ziel

Dieses Patch bündelt drei kleine, aber praktische Verbesserungen:

1) **CI Lite**: Mehr Kontext zur letzten Workflow-Run + **Fehler direkt als Chat-Nachricht** übernehmen.
2) **Connections Screen**: Ein **Sync Summary** (Modal), damit sofort klar ist, was beim Sync ins Repo/Supabase passiert.
3) **Repo Hygiene**: Unused Dependency raus + kleine Format-Altlast.

---

## Änderungen

### 1) CI Lite: Details + „in Chat übernehmen"

_Datei:_ `components/CiLiteHeaderButton.tsx`

- **Run Meta** wird im Modal angezeigt:
  - Run Nummer
  - Status
  - Conclusion
  - Dauer (updated_at - created_at)
- Neuer Button **„Chat“**:
  - nimmt die gefilterten Error-Lines (redacted + truncated)
  - schreibt sie als `user`-Message in den Chat (`ProjectContext.addChatMessage`).
  - zeigt Feedback via `Alert`.

### 2) Connections: Sync Summary Modal

_Datei:_ `screens/ConnectionsScreen/index.tsx`

- Titel-Zeile bekommt ein kleines **List/Icon**.
- Öffnet ein **Sync Summary** Modal mit:
  - Repo / Branch Linie
  - GitHub User + Scopes
  - Supabase URL + Ref
  - Expo User
  - EAS Project ID
  - „Welche Keys werden beim Sync geschrieben“ (nur Key-Namen, keine Werte)

> Hinweis: Das ist bewusst „read-only“. Es ist kein zweiter Sync-Button, sondern eine klare Anzeige/Checklist.

### 3) Repo Hygiene

- `openai` npm package entfernt (unused).
  - `package.json`
  - `package-lock.json`
- `App.tsx`: Tabs/Spaces Mischmasch im Drawer Block bereinigt.

---

## Testplan

- CI Lite Run starten → Modal öffnen:
  - Run-Meta sichtbar
  - Bei Fehlern: „Chat“ drücken → Chat enthält Message.
  - Bei 0 Fehlern: Warn-Alert.
- Connections Screen:
  - „List“-Icon → Modal öffnet
  - Inhalte plausibel (Repo, User, Scopes, Supabase Ref).
- `npm run typecheck && npm run lint:ci && npm run test:silent`

---

## Install / Apply

```bash
# 1) ZIP entpacken
unzip -o k1w1-a0style_patch_224.zip -d .

# 2) ZIP löschen
rm -f k1w1-a0style_patch_224.zip

# 3) Checks
npm run typecheck
npm run lint:ci
npm run test:silent

# 4) Commit + Push
git add -A
git commit -m "Patch 224: CI Lite details + Connections sync summary + repo hygiene"
git push
```
