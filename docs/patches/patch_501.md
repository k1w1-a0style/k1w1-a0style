# Patch 501 - produktiven Chat-Sendepfad gegen lokale Preview-/Secret-Leaks gehaertet

## Kontext

Im Chat-Flow gab es bereits Bausteine fuer Input-Validierung (`validateChatInput(...)`), Sanitizing und Prompt-Redaction. Im produktiven Sendepfad wurden diese Schutzschichten aber nicht konsequent vor jedem echten Provider-Call erzwungen, und lokale Meta-/Preview-Ausgaben konnten als normale History sichtbar bleiben. Dadurch bestand das Risiko, dass lokale Dateipreviews oder unsanitizte Inhalte spaeter ungewollt im LLM-Kontext landen.

## Ziel

- Jeder produktive KI-Call bekommt vor Planner/Builder/Validator einen validierten und sanitizten Input.
- Lokale Meta-/Preview-Nachrichten bleiben im Chat sichtbar, werden aber klar markiert und nicht in spaetere Provider-History uebernommen.
- Normale Chat-History bleibt fuer den Provider erhalten.
- Secrets/Header/Credentials werden vor Provider-Weitergabe weiter redigiert.
- Attachment-/Meta-Command-/Pending-Plan-Pfade bleiben ohne Architekturumbau kompatibel.

## Umsetzung

1. **Produktiven Sendepfad zentral gehaertet**
   - `hooks/useChatAIFlow.ts` nutzt mit `prepareValidatedChatInput(...)` jetzt einen kleinen gemeinsamen Guard fuer den echten KI-Pfad.
   - `processAIRequest(...)` validiert und sanitizt den Request direkt vor Planner/Builder/Validator nochmals und verwendet anschliessend nur noch den sanitizten Request-Text weiter.
   - `handleSendWithMeta(...)` verwendet denselben Guard fuer den Benutzerpfad, blockt leere/zu lange Eingaben weiter sauber und zeigt bei XSS-/Script-Mustern weiterhin einen Hinweis an.

2. **Lokale Meta-/Preview-History klar markiert**
   - `utils/metaCommands.ts` markiert jetzt alle lokalen Meta-Command-Antworten mit `localOnly + metaCommand`.
   - Datei-Preview-Ausgaben behalten zusaetzlich `containsFilePreview`, bleiben lokal sichtbar, werden aber nicht mehr als normale Provider-History behandelt.
   - Auch die vom Nutzer eingegebene lokale Meta-Command-Zeile wird im Chat lokal markiert, damit der Verlauf sichtbar bleibt ohne spaeter blind in den Provider-Kontext zu fliessen.

3. **Provider-History-Filter und Secret-Redaction nachgezogen**
   - `lib/promptSanitizer.ts` filtert jetzt neben `localOnly`/`containsFilePreview` auch explizit `metaCommand` aus der LLM-History.
   - `lib/secretRedaction.ts` redigiert zusaetzlich Cookie-/Set-Cookie-Header sowie `password`/`passwd`/`client_secret`-Assignments, bevor diese in providergebundene Prompts gelangen.

4. **Gezielte Regressionstests erweitert**
   - `__tests__/useChatAIFlow.inputValidation.test.tsx` deckt jetzt den produktiven Sendepfad fuer Sanitizing, lokale History-Filter und Secret-Redaction direkter ab.
   - `__tests__/aiFlowPrivacyContract.test.ts` prueft die neue Meta-Flag-Semantik fuer lokale Commands.
   - `__tests__/terminalSecretRedaction.test.ts` deckt Cookie-/Credential-Redaction ab.

## Geaenderte Dateien

- `hooks/useChatAIFlow.ts`
- `utils/metaCommands.ts`
- `lib/promptSanitizer.ts`
- `lib/secretRedaction.ts`
- `shared/types/chat.ts`
- `__tests__/useChatAIFlow.inputValidation.test.tsx`
- `__tests__/aiFlowPrivacyContract.test.ts`
- `__tests__/terminalSecretRedaction.test.ts`
- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_501.md`

## Checks

Geplant/auszufuehren:

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
