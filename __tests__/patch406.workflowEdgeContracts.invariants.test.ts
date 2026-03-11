import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('patch406 workflow-edge contracts', () => {
  test('trigger workflow resolves dispatch payload fields before forwarding into eas-build', () => {
    const wf = read('.github/workflows/k1w1-triggered-build.yml');
    expect(wf).toContain('job_id: ${{ steps.resolve.outputs.job_id }}');
    expect(wf).toContain('autofix: ${{ steps.resolve.outputs.autofix }}');
    expect(wf).toContain('strict_lockfile: ${{ steps.resolve.outputs.strict_lockfile }}');
    expect(wf).toContain('job_id: ${{ needs.resolve.outputs.job_id }}');
    expect(wf).toContain('autofix: ${{ fromJSON(needs.resolve.outputs.autofix) }}');
    expect(wf).toContain('strict_lockfile: ${{ needs.resolve.outputs.strict_lockfile }}');
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
