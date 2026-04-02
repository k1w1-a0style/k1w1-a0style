import AsyncStorage from "@react-native-async-storage/async-storage";

type AsyncStorageMockInternals = {
  __resetMockStorage?: () => void;
  __setMockStorage?: (values: Record<string, string>) => void;
};

function getAsyncStorageMockInternals(): typeof AsyncStorage & AsyncStorageMockInternals {
  return AsyncStorage as typeof AsyncStorage & AsyncStorageMockInternals;
}

export function resetMockAsyncStorage(): void {
  getAsyncStorageMockInternals().__resetMockStorage?.();
}

export function seedMockAsyncStorage(values: Record<string, string>): void {
  getAsyncStorageMockInternals().__setMockStorage?.(values);
}
