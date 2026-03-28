# Patch 560 — Prompt-/Validator-Kontext-Haertung (Stopwords + AI-Pfad-Manifest)

## Ziel
Prompt-/Validator-Kontext minimal und ehrlich haerten, ohne Broad Refactor:

- englische Stopwords in der Fokus-Extraktion ergaenzen
- sicherstellen, dass der Validator alle vorgeschlagenen AI-Zielpfade sieht
- Budgetierung beibehalten, aber stille Pfad-Drops vermeiden

## Umsetzung

### 1) Englische Stopwords ergaenzt
- `collectFocusTerms(...)` in `lib/promptEngine.ts` und `lib/aiContextBudget.ts` enthaelt jetzt zusaetzlich eine kleine pragmatische Menge englischer Stopwords (`the`, `and`, `please`, `make`, `create`, `add`, `update`, `improve`, ...).
- Ziel: weniger Rauschen bei einfachen englischen Prompts, ohne aggressive NLP-Filterung.

### 2) Validator sieht alle AI-Zielpfade
- `buildValidatorMessages(...)` in `lib/promptEngine.ts` erzeugt jetzt zusaetzlich ein kompaktes System-Manifest mit **vollstaendiger Liste aller AI-Zielpfade**.
- Wenn `aiFiles` durch Budgetierung gekuerzt werden, nennt das Manifest explizit die Pfade, die nicht vollstaendig inline im JSON-Entwurf enthalten sind.
- Der JSON-Entwurf bleibt weiter budgetiert (keine Prompt-Explosion), aber der Validator verliert keine Zielpfad-Information mehr still.

### 3) Ehrliche Guard-Aussagen
- Manifest-Text sagt explizit, dass Inhalte wegen Budget gekuerzt/ausgelassen sein koennen und nur Pfad-Sicht garantiert ist.
- Keine neuen Schutzversprechen ueber Vollinhalt/Full-Repo.

## Tests
- Aktualisiert: `__tests__/promptEngine.contextPriority.test.ts`
  - englische Stopwords verbessern die Relevanz-Priorisierung (`please add login screen`)
  - Validator-Manifest enthaelt alle AI-Zielpfade auch bei budgetiertem JSON-Entwurf
- Bestehende Budget-/Prompt-Tests bleiben unveraendert gruen

## Validierung
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent -- --runInBand __tests__/promptEngine.contextPriority.test.ts lib/__tests__/aiContextBudget.test.ts __tests__/aiFlowPrivacyContract.test.ts` ✅
- `npm run test:silent` ✅
- `git diff --check` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
