# Patch 518: lokaler Edge-Admin-Key-Vertrag fuer Wizard/Preview/Build ehrlich und konsistent gezogen

## Kontext / Problem

Der lokale Edge Admin Key wird in der App bewusst getrennt von Repo-/Server-Secrets gehalten. In der Praxis lagen aber drei Probleme gleichzeitig vor:

1. `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts` hat den lokalen Key nur einmal beim Mount geladen; nach Save/Import/Screen-Return blieb deshalb leicht ein stale In-Memory-Wert aktiv.
2. Der Wizard hat auth-bezogene 401/403-Fehler nur als vages `zugriff unklar` gezeigt, obwohl der eigentliche Blocker oft klar der lokale Edge Admin Key war.
3. Build-Preconditions / One-Click-Deploy kannten nur das persistierte `cred_key_exists_*`-Bool und konnten daher bei fehlendem/abgelehntem lokalem Key keinen ehrlichen Blocker-Text liefern.

Repo-/Server-Secrets konnten also fachlich vorhanden sein, waehrend Wizard, Remote-Preview und Build-Vorbereitung lokal trotzdem an `x-k1w1-admin-key` scheiterten.

## Umsetzung

- `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
  - laedt den lokalen Edge Admin Key jetzt beim Fokus erneut aus SecureStore,
  - liest ihn nach `saveEdgeAdminKey(...)` explizit nochmals zurueck,
  - persistiert neben `cred_key_exists_*` jetzt auch Wizard-Status + Detailtext projektbezogen, damit Build/Return denselben letzten ehrlichen Zustand sehen.
- `screens/CredentialsWizardScreen/utils/localAdminKey.ts`
  - klassifiziert lokale Edge-Admin-Key-Faelle (`missing`, `invalid`, `rejected`) aus Save-/401-/403-/Admin-Fehltexten.
- `screens/CredentialsWizardScreen/statusContract.ts`
  - zeigt fuer diese Faelle jetzt explizite UI-Texte wie `lokaler Key fehlt` bzw. `lokaler Key abgelehnt` statt nur pauschal `zugriff unklar`.
- `screens/EnhancedBuildScreen/hooks/signingKeyGate.ts`
  - zentralisiert die Build-/Autoflow-Sicht auf `cred_key_exists_*`, den lokalen Edge Admin Key sowie den zuletzt persistierten Wizard-Status.
- `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts` und `useOneClickDeploy.ts`
  - rehydrieren den Zustand beim Fokus,
  - blockieren weiter konservativ,
  - nennen den lokalen Edge Admin Key jetzt aber als echten Blocker, wenn genau dieser fehlt/abgelehnt ist.
- `hooks/previewHelpers.ts`
  - benennt Remote-Preview-Fails bei lokal fehlendem bzw. abgelehntem Admin Key ehrlich, waehrend der lokale HTML-Fallback weiter nur sekundaerer Dev-/Best-Effort-Pfad bleibt.

## Tests / Regressionen

- neuer TokenStore-Test fuer Save + Re-Read des lokalen Edge Admin Keys
- neuer Signing-Key-Gate-Test fuer praezise Build-Blockertexte
- Preview-Regression fuer `Missing Edge Admin Key` -> ehrlicher Remote-Fail + lokaler Fallback
- bestehende Wizard-/OneClickDeploy-Tests auf neue lokale Admin-Key-Texte/Fokus-Rehydration angepasst

## Nicht Teil dieses Patches

- keine neue Key-Architektur
- keine Backup-Verschluesselung
- keine Auth-/CORS-/Workflow-Aenderungen ausserhalb dieses lokalen App-Key-Vertrags
