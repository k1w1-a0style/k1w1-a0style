const mockSvc = {
  getLegacyEdgeAdminKey: jest.fn(),
  getExpoToken: jest.fn(),
  getGitHubToken: jest.fn(),
  getRepoFileText: jest.fn(),
  listRepoSecretNames: jest.fn(),
  triggerWorkflow: jest.fn(),
};

jest.doMock(require.resolve('../infra/github/githubService'), () => mockSvc);
jest.doMock(require.resolve('../lib/supabase'), () => ({ ensureSupabaseClient: jest.fn() }));
const { runBuildPipelineDiagnostics } = require('../lib/diagnostics/buildPipelineDiagnostics');

describe('runBuildPipelineDiagnostics - expo-dev-client package.json reader', () => {
  it('treats malformed dependency blocks as missing without crashing', async () => {
    mockSvc.getGitHubToken.mockResolvedValue('gh');
    mockSvc.getExpoToken.mockResolvedValue('expo');
    mockSvc.getLegacyEdgeAdminKey.mockResolvedValue('admin');
    mockSvc.listRepoSecretNames.mockResolvedValue(['EXPO_TOKEN']);

    const files = {
      'eas.json': JSON.stringify({ build: { development: { developmentClient: true } } }),
      'app.json': JSON.stringify({ expo: {} }),
      'eas-project.json': JSON.stringify({ projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
      'package.json': JSON.stringify({ dependencies: 'bad-shape', devDependencies: null }),
      '.github/workflows/eas-link.yml': 'name: x',
      '.github/workflows/k1w1-triggered-build.yml': 'name: y',
    };

    mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
      if (!(path in files)) throw new Error(`missing ${path}`);
      return files[path as keyof typeof files];
    });

    const res = await runBuildPipelineDiagnostics({ owner: 'o', repo: 'r', branch: 'main' });
    const dep = res.checks.find((c: { id: string }) => c.id === 'repo.dep.expoDevClient');

    expect(dep?.status).toBe('warn');
    expect(dep?.details).toMatch(/expo-dev-client fehlt/i);
  });
});
