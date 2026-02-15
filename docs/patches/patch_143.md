# Patch 143: Drawer UI Revamp (Neon/Dark) + Quick Actions

Datum: 2026-02-16

## Ziel
- Seitenleiste moderner und übersichtlicher (mehr Struktur, klare Icons).
- Neon-Giftgrün auf Dark als durchgängiger Look.
- Auswahl/Status sofort sichtbar.

## Änderungen

### Drawer UI
- `components/CustomDrawer.tsx`
  - Header-Hintergrund: Gradient in Dark-Tönen.
  - Status-Leuchte: **grün** wenn ein Repo aktiv ist, sonst **grau** ("Repo wählen").
  - Chips: aktuelles **Repo/Branch** und **Build-Profil** direkt im Header.
  - Quick Actions: **Repos / Build / Diagnose** als schnelle Buttons.
  - Menü-Einträge: kleines Lamp-Dot (grün aktiv, grau idle) + Active-Glow.

### Repo-Hygiene
- Alte Backup-Dateien (z.B. `*.bak.*`) werden nicht mehr gebraucht.
  - Entfernen (einmalig im Repo-Root):

```bash
rm -f components/ChatHeaderActions.tsx.bak.ui-polish
```

## CodeScreen Check
- Es wurde kein "versteckter" zweiter Header/Toolbar gefunden, der nur nicht gerendert wird.
  Der aktuelle Code nutzt `ExplorerHeader` und `EditorHeaderContent`. Keine ungenutzte Zusatzleiste im Code.

## Verifikation
Lokal im Repo-Root:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Ergebnis
- Drawer wirkt konsistenter zum Neon/Dark Stil und zeigt Auswahl/Status schneller.
