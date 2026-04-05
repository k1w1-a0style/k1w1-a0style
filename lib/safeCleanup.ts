import { logger } from "./logger";

export async function runWithCleanupFallback<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  context: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.warn(context, { err: error });
    return fallbackValue;
  }
}

export async function runCleanupTask(
  operation: () => Promise<unknown>,
  context: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    logger.warn(context, { err: error });
  }
}
