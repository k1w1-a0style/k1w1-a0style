# Patch 516: finalen SecureKeyManager-Rest entfernt

## Kontext

Im finalen Audit blieb `lib/SecureKeyManager.ts` als potenzieller Legacy-Rest offen. Die erneute Usage-Pruefung ueber Runtime-, Test- und Doku-Referenzen zeigte: Die Datei hatte keine produktiven Imports mehr und wurde nur noch von ihrem eigenen Test sowie von einer Invariant-Datei indirekt erwaehnt. Gleichzeitig enthielt `docs/SYSTEM_README.md` noch veraltete Hinweise, die den alten Key-/Token-Manager-Pfad wie einen aktiven Runtime-Vertrag beschrieben.

## Geprueft

- Runtime-Scope unter `lib/` und `contexts/`: keine produktiven `SecureKeyManager`-Imports
- Test-Scope: nur `lib/__tests__/SecureKeyManager.test.ts` nutzte den Manager noch direkt
- Doku: `docs/SYSTEM_README.md` empfahl noch veraltete SecureKeyManager-/SecureTokenManager-Nutzung
- `signing_audit_log`: unveraendert gelassen, weil aktive RLS ohne Policy bereits konservativ den Zugriff sperrt und kein zusaetzlicher Policy-Eintrag fuer diesen Patch noetig war

## Aenderungen

- `lib/SecureKeyManager.ts` entfernt
- `lib/__tests__/SecureKeyManager.test.ts` entfernt
- `__tests__/patch513.keyManagerRuntimeBoundary.invariants.test.ts` so angepasst, dass nun die Abwesenheit von `lib/SecureKeyManager.ts` regressionsfest geprueft wird
- `docs/SYSTEM_README.md` minimal auf den echten Edge-Proxy-only-Vertrag aktualisiert und veraltete Key-/Token-Manager-Referenzen im aktuellen Doku-Text entfernt

## Bewusst nicht geaendert

- keine SQL-/Policy-Aenderung an `signing_audit_log`, weil der bestehende Sicherheitsvertrag bereits konservativ ist
- keine historischen Patchnotes umgeschrieben; historische Erwaehnungen bleiben als Verlauf erhalten
- kein weiterer `any`-/Auth-/CORS-/Workflow- oder Architektur-Refactor
