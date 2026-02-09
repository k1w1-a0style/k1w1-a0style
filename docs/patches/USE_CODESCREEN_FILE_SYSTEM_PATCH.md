# Patch 23: `useCodeScreen.ts` txt dump fix

Your repo's `expo-file-system` types do not expose `documentDirectory`, `cacheDirectory`, or `EncodingType`,
so TypeScript + eslint(import/namespace) fail.

## What to change
In `screens/CodeScreen/hooks/useCodeScreen.ts`, locate the txt dump / export code block where you currently have something like:

- `const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;`
- `encoding: FileSystem.EncodingType.UTF8`

Replace that part with this snippet:

```ts
// NOTE: Patch 23: expo-file-system typing in this repo doesn't expose documentDirectory/cacheDirectory/EncodingType.
// We intentionally use (FileSystem as any) for these specific fields to satisfy TS + eslint(import/namespace).
const baseDir: string | undefined =
  ((FileSystem as any).documentDirectory as string | undefined) ??
  ((FileSystem as any).cacheDirectory as string | undefined);

if (!baseDir) {
  throw new Error("No writable directory available (documentDirectory/cacheDirectory missing).");
}

const fileUri = `${baseDir.replace(/\/?$/, "/")}${fileName}`;

await FileSystem.writeAsStringAsync(fileUri, textDump); // UTF-8 is default
```

Also remove any `EncodingType` usage.
