# Patch 329: ConnectionsScreen TS-Hygiene (mehrere Fixlistenpunkte)

## Ziel
Mehrere kleine Restpunkte aus der TypeScript-Fixliste in einem sicheren, zusammenhängenden Patch umsetzen.

## Änderungen

### 1) Component-Props in ConnectionsScreen ohne `any`
- Neue zentrale Typdatei `screens/ConnectionsScreen/components/types.ts` ergänzt.
- `styles: any` in allen Connections-Komponenten durch `ConnectionsStyles` ersetzt.
- `ActionButton`-Icon von `any` auf `Ionicons`-Name typisiert.

### 2) Hook-Hardening in `useConnectionsScreen`
- `useNavigation<any>()` auf `NavigationProp<ParamListBase>` umgestellt.
- Alle `catch (e: any)` in diesem Hook auf `catch (e: unknown)` umgestellt.
- Sichere Fehlertexte konsistent über `safeAlertText(e)` verwendet.
- JSON-Handling typisiert:
  - Expo-Projektantwort (`ExpoProjectResponse`)
  - Expo-GraphQL-Antwort (`ExpoGraphQLResponse`)
  - kleine Helper-Funktion `parseJsonSafe<T>` statt ungetyptem Parse.

### 3) Ergebnis
- Mehrere `any`-Hotspots im Connections-Flow in einem Schritt reduziert,
  ohne Runtime-Verhalten zu verändern.

## Validierung

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
