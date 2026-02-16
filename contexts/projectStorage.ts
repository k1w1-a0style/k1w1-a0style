// contexts/projectStorage.ts
// Facade re-export (moved implementation to infra/storage/projectPersistence.ts)
// Keep this file to avoid breaking imports during refactor.

export * from "../infra/storage/projectPersistence";
