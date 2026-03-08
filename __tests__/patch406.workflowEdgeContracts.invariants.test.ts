import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('patch406 workflow-edge contracts', () => {
  test('trigger workflow forwards expected dispatch payload fields into eas-build', () => {
    const wf = read('.github/workflows/k1w1-triggered-build.yml');
    expect(wf).toContain("job_id: ${{ github.event.client_payload.job_id || github.event.inputs.job_id || '' }}");
    expect(wf).toContain("autofix: ${{ github.event.client_payload.autofix || (github.event_name == 'workflow_dispatch' && inputs.autofix) || false }}");
    expect(wf).toContain("strict_lockfile: ${{ github.event.client_payload.strict_lockfile || (github.event_name == 'workflow_dispatch' && inputs.strict_lockfile) || 'auto' }}");
  });

  test('eas-build uses android-keystore-export and status/source_commit_sha fields', () => {
    const wf = read('.github/workflows/eas-build.yml');
    expect(wf).toContain('/functions/v1/android-keystore-export');
    expect(wf).toContain('status:"building"');
    expect(wf).toContain('status:"completed"');
    expect(wf).toContain('status:"error"');
    expect(wf).toContain('source_commit_sha');
  });

  test('artifact-json edge response shape matches documented contract', () => {
    const edge = read('supabase/functions/github-run-artifact-json/index.ts');
    expect(edge).toContain('text,');
    expect(edge).toContain('json: parsed');
    expect(edge).toContain('artifactId: artifact.id');
    expect(edge).toContain('artifactName: artifact.name');
    expect(edge).toContain('filePath,');
  });

  test('edge status docs mention active workflow-relevant functions', () => {
    const doc = read('docs/EDGE_FUNCTIONS_STATUS.md');
    expect(doc).toContain('`trigger-eas-build`');
    expect(doc).toContain('`check-eas-build`');
    expect(doc).toContain('`github-run-artifact-json`');
    expect(doc).toContain('`android-keystore-export`');
  });
});
