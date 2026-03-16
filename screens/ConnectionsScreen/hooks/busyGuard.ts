export class BusyGuardActiveError extends Error {
  constructor() {
    super("Ein anderer Save/Test-Lauf ist noch aktiv.");
    this.name = "BusyGuardActiveError";
  }
}

export const isBusyGuardActiveError = (error: unknown): error is BusyGuardActiveError =>
  error instanceof BusyGuardActiveError;

