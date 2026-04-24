# Patch 786: Gradle-Wrapper-SHA und Android-Task-Verifikation (Prompt 4A)

## Kontext

Prompt 4A fordert die praktische Verifikation der bereits gesetzten Gradle-Wrapper-Checksumme (`distributionSha256Sum`) und einen minimalen Wrapper-Task in kompatibler Java-Umgebung.

## Umsetzung (enger Scope)

1. `android/gradle/wrapper/gradle-wrapper.properties` wurde unverändert geprüft:
   - `distributionUrl=https://services.gradle.org/distributions/gradle-8.14.3-bin.zip`
   - `distributionSha256Sum=bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531`
2. SHA-Verifikation ausgeführt:
   - offizieller Remote-Wert über `https://services.gradle.org/distributions/gradle-8.14.3-bin.zip.sha256`
   - lokaler Hash eines frisch heruntergeladenen ZIPs
   - Property-Wert == Remote-Wert == lokaler Hash.
3. Wrapper-Lauf in kompatibler Umgebung geprüft:
   - Mit Java 25 läuft `./gradlew --version` grün.
   - `./gradlew help -q` scheitert unter Java 25 mit `Unsupported class file major version 69`.
   - Java 21 gesetzt (`JAVA_HOME=/root/.local/share/mise/installs/java/21.0.2`), danach `./gradlew --version` weiterhin grün.
   - `./gradlew help -q` scheitert dann nicht mehr an classfile-Version, sondern an fehlender lokaler Toolchain-Auflösung für Java 17 im Build-Plugin (`Cannot find a Java installation ... matching languageVersion=17`) bei geblockter Auto-Provisionierung (`foojay ... 403`).
4. JitPack-Risiko bewertet:
   - Im aktuellen Lauf trat kein Dependency-Resolution-Fehler auf, der auf fehlendes JitPack verweist.
   - Der verbleibende Blocker ist Toolchain-/Umgebungsauflösung (Java 17), nicht Repository-Source für Artefakte.

## Ergebnis

- `distributionSha256Sum` ist korrekt und muss **nicht** geändert werden.
- Ein minimaler Wrapper-Check (`./gradlew --version`) läuft in kompatibler Java-Umgebung erfolgreich.
- `./gradlew help -q` ist reproduzierbar durch Runner-Toolchain-Umgebung (fehlende Java-17-Erkennung + kein Auto-Download via foojay) blockiert; kein Codefix im Android-Buildlogik-Scope erforderlich.
