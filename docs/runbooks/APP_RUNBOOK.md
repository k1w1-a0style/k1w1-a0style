# App Runbook (QA/Operator)

Stand: 2026-03-01

Ziel: Schnell entscheiden “Warum ist Build rot?” und **was ist der nächste sichere Fix-Schritt**.

## 1) Wenn Build nicht startet (Gate)
Checkliste:
- Repo/Branch gesetzt?
- Tokens (GitHub/Expo) gesetzt?
- `DIAGNOSTIC_LAST_OK == "true"` ?
- EAS Project ID vorhanden?
- Workflows vorhanden?
- EXPO_TOKEN Secret vorhanden?

Siehe: `docs/06-build-readiness.md` + `docs/07-diagnostics-fix-playbook.md`

## 2) Diagnose Loop
1) Diagnostics Screen → Scan
2) Fix issues (AutoFix zuerst)
3) Re-Scan
4) Gate prüfen
5) Build triggern

## 3) Häufige Failures

### Missing EXPO_TOKEN
- GitHub Repo → Settings → Secrets and variables → Actions → `EXPO_TOKEN`
- Danach: Re-Scan pipeline diagnostics

### YAML name quoting (": ")
- AutoFix quotet `name: "A: B"` in workflows

### EAS projectId missing
- Run `eas-link.yml` oder link wizard
- Danach: Re-Scan

## 4) Smoke Commands
- `npm run preflight:fast`
- `npm run preflight`
