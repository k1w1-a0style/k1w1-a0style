# Patch 505: Service-Role-Secret-Pfade auf Shared-Helper und Legacy-Cleanup zurechtgezogen

## Ziel
Inkonsistente bzw. irrefuehrende Secret-Pfade rund um Android-Signing und AppInfo-Backup im engen Scope bereinigen, ohne neue Secret-Nutzung einzufuehren oder bestehende Guards zu lockern.

## Geaenderte Bereiche

- `supabase/functions/android-keystore-generate/index.ts`
  - nutzt fuer den serverseitigen Supabase-Service-Role-Key jetzt `getServiceRoleKey(req)` aus dem bestehenden Shared-Auth-Scope statt eines parallelen direkten `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`-Pfads.
- `supabase/functions/android-keystore-generate/helpers.ts`
  - reexportiert den vorhandenen Shared-Auth-Helper sichtbar fuer den bestehenden keystore-generate Helper-Importpfad.
- `lib/storageKeys.ts`
  - entfernt den normalen Client-`STORAGE_KEYS.SUPABASE_SERVICE_ROLE_KEY`-Slot.
  - fuehrt stattdessen einen kleinen expliziten Legacy-Cleanup-Helper fuer historische AsyncStorage-Reste ein, damit der Client den Service-Role-Key nicht mehr wie einen regulaeren lokalen Storage-/Backup-Wert behandelt.
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
  - Voll-Backup-Export und -Import raeumen nur noch ueber den Legacy-Cleanup-Helper alte Service-Role-Reste weg, ohne einen regulaeren Client-Storage-Key zu referenzieren.
- `__tests__/patch415.edgeAuthGuards.invariants.test.ts`
  - neue Invariant dafuer, dass `android-keystore-generate` den Shared-Secret-Helper nutzt und keinen direkten `SUPABASE_SERVICE_ROLE_KEY`-Env-Zugriff mehr hat.
- `__tests__/storageKeys.projectScope.test.ts`
  - deckt ab, dass `STORAGE_KEYS` keinen regulaeren Service-Role-Slot mehr exportiert und Cleanup nur noch ueber den expliziten Legacy-Helper laeuft.
- `__tests__/patch410b.clientServiceRoleContainment.invariants.test.ts`
  - sichert ab, dass AppInfo-Backup-/Import-Pfade keinen normalen Client-Service-Role-Slot mehr referenzieren.

## Guard-/Scope-Status
- Keine neue Secret-Architektur.
- Keine neue Client-Speicherung fuer Service-Role-Secrets.
- Keine Lockerung bestehender Auth-/Signing-Guards.
- Backup-/Import-Cleanup bleibt funktional nur fuer Legacy-Reste bestehen.

## Checks
- `npm run test:silent -- --runInBand __tests__/patch415.edgeAuthGuards.invariants.test.ts __tests__/storageKeys.projectScope.test.ts __tests__/patch410b.clientServiceRoleContainment.invariants.test.ts`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis
- Serverseitige Service-Role-Lookups im Android-Keystore-Generate-Pfad laufen ueber denselben Shared-Helper wie angrenzende Edge-Pfade.
- Client-seitig bleibt kein normaler `STORAGE_KEYS`-Pfad mehr uebrig, der suggeriert, `SUPABASE_SERVICE_ROLE_KEY` werde regulaer lokal gehalten oder gesichert.
- Historische AsyncStorage-Reste koennen weiterhin klein und explizit bereinigt werden, ohne neue Produktiv-Semantik fuer Client-Secrets einzufuehren.
