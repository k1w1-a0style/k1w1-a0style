import type { BuildStatus } from "../../../shared/types/build";

export function resolveContextLabel(status: BuildStatus, hasRuntimeContext: boolean): string {
  const isRunning = status === "starting" || status === "queued" || status === "building";
  if (isRunning && hasRuntimeContext) return "Laufender Build (aktiver Kontext)";
  if (hasRuntimeContext) return "Letzter bekannter Build-Kontext (kein Live-Status)";
  return "Aktuelle Auswahl (noch kein Lauf)";
}

export function resolvePhaseHint(status: BuildStatus, buildBlockedReason?: string | null): string {
  if (status === "starting") return "Build-Start läuft";
  if (status === "queued" || status === "building") return "Build läuft";
  if (status === "success") return "Build abgeschlossen";
  if (status === "failed" || status === "error") return "Build blockiert (Fehler)";
  if (buildBlockedReason) return "Vorbereitung unvollständig";
  return "Bereit zum Start";
}

export function resolvePrimaryActionLabel(opts: {
  isDeploying: boolean;
  hasFail: boolean;
  deployDone: boolean;
  deployBlocked: boolean;
}): string {
  const { isDeploying, hasFail, deployDone, deployBlocked } = opts;

  if (isDeploying) return "Vorbereitung läuft";
  if (deployBlocked) return "Build noch nicht bereit";
  if (hasFail) return "Vorbereitung erneut ausführen";
  if (deployDone) return "Ablauf zurücksetzen";
  return "Build mit Vorbereitung starten";
}
