# Patch 192.3

## Fix
- Stabilisiert Jest Tests fuer `useOneClickDeploy`:
  - `TouchableOpacity.onPress` gibt **keinen Promise** mehr zurueck (`void hook.runDeploy()`), damit `act()` nicht haengen bleibt.
  - `AsyncStorage.getItem` wird pro Test **deterministisch gemockt** (Key vorhanden/nicht vorhanden), damit kein globaler Mock-Store reinfunkt.
  - `waitFor` hat einen kurzen, expliziten Timeout.

## Warum
Einige Test-Setups warten in `act()` auf den Rueckgabewert des Press-Handlers. Wenn der Handler ein Promise returnt und AsyncStorage-Mocks nicht sauber aufloesen, laeuft der Test in ein 5s Jest Timeout.
