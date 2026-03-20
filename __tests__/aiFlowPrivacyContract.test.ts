import { buildBuilderMessages, buildValidatorMessages } from '../lib/promptEngine';
import { getEffectiveChatWritePolicy } from '../lib/effectiveWritePolicy';
import { buildSanitizedLlmHistory } from '../lib/promptSanitizer';
import { canActorModifyPath } from '../lib/projectOwnership';
import { handleMetaCommand, MAX_FILE_PREVIEW_CHARS } from '../utils/metaCommands';
import type { ChatMessage } from '../shared/types/chat';
import type { ProjectFile } from '../shared/types/project';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signatureTOKEN12345';
const BEARER = 'secretToken1234567890';
const API_KEY = 'sk_test_ABCDEFGHIJKLMN';
const NPM_TOKEN = 'npm_abcdefghijklmnopqrstuvwxyz123456';

const makeMessage = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: overrides.id ?? 'msg-1',
  role: overrides.role ?? 'user',
  content: overrides.content ?? '',
  timestamp: overrides.timestamp ?? new Date('2026-03-19T00:00:00.000Z').toISOString(),
  meta: overrides.meta,
});

describe('AI flow privacy and prompt contract', () => {
  test('redacts raw bearer/api key/jwt secrets from provider-bound prompt context', () => {
    const history = buildSanitizedLlmHistory([
      makeMessage({
        content: `Authorization: Bearer ${BEARER}\napiKey=${API_KEY}\nJWT=${JWT}`,
      }),
    ]);
    const files: ProjectFile[] = [
      {
        path: '.npmrc',
        content: `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`,
      },
      {
        path: 'screens/HomeScreen.tsx',
        content: `export const token = "${BEARER}";`,
      },
    ];

    const messages = buildBuilderMessages(history, `Bitte nutze Authorization: Bearer ${BEARER}`, files);
    const combined = messages.map((message) => message.content).join('\n---\n');

    expect(combined).not.toContain(BEARER);
    expect(combined).not.toContain(API_KEY);
    expect(combined).not.toContain(JWT);
    expect(combined).not.toContain(NPM_TOKEN);
    expect(combined).toContain('Bearer <redacted>');
    expect(combined).toContain('<redacted-jwt>');
    expect(combined).toContain('[redacted sensitive file content from .npmrc]');
  });

  test('filters localOnly messages out of provider history', () => {
    const history = buildSanitizedLlmHistory([
      makeMessage({ content: 'Bitte baue einen Screen' }),
      makeMessage({ id: 'local', role: 'assistant', content: 'Lokale Notiz', meta: { localOnly: true } }),
    ]);

    expect(history).toEqual([{ role: 'user', content: 'Bitte baue einen Screen' }]);
  });

  test('filters containsFilePreview messages out of provider history', () => {
    const history = buildSanitizedLlmHistory([
      makeMessage({ content: 'Normale Historie' }),
      makeMessage({ id: 'preview', role: 'assistant', content: '📄 preview', meta: { containsFilePreview: true } }),
    ]);

    expect(history).toEqual([{ role: 'user', content: 'Normale Historie' }]);
  });

  test('keeps file preview local but marks it as preview metadata', () => {
    const result = handleMetaCommand('zeige datei src/demo.ts', [
      { path: 'src/demo.ts', content: 'export const demo = 1;\n' },
    ]);

    expect(result.handled).toBe(true);
    expect(result.message?.content).toContain('src/demo.ts');
    expect(result.message?.content).toContain('export const demo = 1;');
    expect(result.message?.meta).toEqual({ localOnly: true, metaCommand: true, containsFilePreview: true });
  });


  test('marks non-preview meta command results as local-only meta history', () => {
    const result = handleMetaCommand('liste alle dateien', [
      { path: 'src/demo.ts', content: 'export const demo = 1;\n' },
    ]);

    expect(result.handled).toBe(true);
    expect(result.message?.meta).toEqual({ localOnly: true, metaCommand: true });
  });

  test('truncates file previews much earlier than before', () => {
    const longContent = 'a'.repeat(MAX_FILE_PREVIEW_CHARS + 500);
    const result = handleMetaCommand('cat src/huge.ts', [
      { path: 'src/huge.ts', content: longContent },
    ]);

    expect(result.handled).toBe(true);
    expect(result.message?.content).toContain(`gekürzt auf ${MAX_FILE_PREVIEW_CHARS} Zeichen`);
    expect(result.message?.content.length ?? 0).toBeLessThanOrEqual(MAX_FILE_PREVIEW_CHARS + 120);
    expect(result.message?.content).not.toContain('a'.repeat(MAX_FILE_PREVIEW_CHARS + 100));
  });

  test('write-contract hint stays aligned with chat ownership guards for critical and manual-only paths', () => {
    const policy = getEffectiveChatWritePolicy();
    const builderSystemMessage = buildBuilderMessages([], 'Bitte ändere den Build-Flow', [
      { path: 'App.tsx', content: 'export default function App(){ return null; }' },
    ])[0]?.content ?? '';

    expect(canActorModifyPath('chat', 'package.json').allowed).toBe(false);
    expect(canActorModifyPath('chat', '.github/workflows/eas-build.yml').allowed).toBe(false);
    expect(canActorModifyPath('chat', 'templates/example.json').allowed).toBe(false);
    expect(canActorModifyPath('chat', 'scripts/example.sh').allowed).toBe(false);
    expect(canActorModifyPath('chat', 'supabase/functions/example/index.ts').allowed).toBe(false);

    expect(policy.writableRoots).not.toContain('package.json');
    expect(policy.writableRoots).not.toContain('app.config.js');
    expect(policy.writablePrefixes).not.toContain('.github/');
    expect(policy.writablePrefixes).not.toContain('supabase/');
    expect(policy.writablePrefixes).not.toContain('templates/');
    expect(policy.writablePrefixes).not.toContain('scripts/');

    expect(builderSystemMessage).toContain('Guarded/manual-only statt normal beschreibbar');
    expect(builderSystemMessage).toContain('package.json (kritisch/manual-only)');
    expect(builderSystemMessage).toContain('.github/workflows/eas-build.yml');
    expect(builderSystemMessage).toContain('templates/example.json (baseline-verwaltet/read-only)');
    expect(builderSystemMessage).toContain('scripts/example.sh (baseline-verwaltet/read-only)');
    expect(builderSystemMessage).toContain('supabase/functions/example/index.ts (kritisch/manual-only)');
  });

  test('prompt contract keeps normal writable paths and snapshot honesty visible for builder and validator', () => {
    const policy = getEffectiveChatWritePolicy();
    const builderMessages = buildBuilderMessages([], 'Bitte passe den Chat-Flow im Screen an', [
      { path: 'screens/HomeScreen.tsx', content: 'export function HomeScreen(){ return null; }' },
      { path: 'lib/chatFlow.ts', content: 'export const chatFlow = true;' },
    ]);
    const validatorMessages = buildValidatorMessages(
      'Bitte validiere den Chat-Flow',
      [{ path: 'screens/HomeScreen.tsx', content: 'export function HomeScreen(){ return null; }' }],
      [{ path: 'screens/HomeScreen.tsx', content: 'export function HomeScreen(){ return null; }' }],
    );

    expect(policy.writablePrefixes).toEqual(expect.arrayContaining(['lib/', 'screens/', 'components/']));
    expect(builderMessages[0]?.content ?? '').toContain('Realistische normale Schreibbereiche im Chat-Flow');
    expect(builderMessages[0]?.content ?? '').toContain('lib/');
    expect(builderMessages[0]?.content ?? '').toContain('screens/');
    expect(builderMessages[0]?.content ?? '').toContain('priorisierten, gekürzten Snapshot');
    expect(builderMessages[1]?.content ?? '').toContain('Priorisierter Ausschnitt der aktuellen Projektdateien');
    expect(builderMessages[1]?.content ?? '').toContain('Nicht gezeigte Pfade koennen fehlen');
    expect(validatorMessages[1]?.content ?? '').toContain('Priorisierter Ausschnitt der aktuellen Projektdateien');
  });

  test('keeps normal non-local chat history in provider context', () => {
    const history = buildSanitizedLlmHistory([
      makeMessage({ role: 'user', content: 'Bitte passe den Buttontext an' }),
      makeMessage({ id: 'assistant-1', role: 'assistant', content: 'Ich ändere den Buttontext im Screen.' }),
    ]);

    expect(history).toEqual([
      { role: 'user', content: 'Bitte passe den Buttontext an' },
      { role: 'assistant', content: 'Ich ändere den Buttontext im Screen.' },
    ]);
  });
});
