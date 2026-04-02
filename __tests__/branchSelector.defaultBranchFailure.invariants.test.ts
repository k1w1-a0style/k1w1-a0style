import fs from 'fs';
import path from 'path';

describe('BranchSelector default-branch fallback hardening', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'screens/GitHubReposScreen/components/BranchSelector.tsx'),
    'utf8',
  );

  it('keeps loading branches even when default-branch resolution fails', () => {
    expect(source).toContain('const branchList = await loadBranches(owner, repo);');
    expect(source).toContain('setBranches(branchList);');
    expect(source).toContain('const defaultBranch = await loadDefaultBranch(owner, repo);');
    expect(source).toContain('Default-Branch konnte nicht ermittelt werden');
  });

  it('does not gate the full branch list behind Promise.all(loadBranches, loadDefaultBranch)', () => {
    expect(source).not.toContain('Promise.all([');
  });
});
