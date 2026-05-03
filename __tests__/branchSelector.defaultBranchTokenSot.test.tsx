import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { BranchSelector } from '../screens/GitHubReposScreen/components/BranchSelector';

describe('BranchSelector default-branch token SoT behavior', () => {
  it('does not attempt default-branch lookup while token source is not ready', async () => {
    const loadBranches = jest.fn().mockResolvedValue([{ name: 'main', commit: { sha: '1', url: '' }, protected: false }]);
    const loadDefaultBranch = jest.fn().mockRejectedValue(new Error('GitHub-Token fehlt.'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <BranchSelector
        activeRepo="owner/repo"
        activeBranch={null}
        onSelectBranch={jest.fn()}
        loadBranches={loadBranches}
        loadDefaultBranch={loadDefaultBranch}
        canResolveDefaultBranch={false}
      />,
    );

    await waitFor(() => expect(loadBranches).toHaveBeenCalled());
    expect(loadDefaultBranch).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[BranchSelector] Default-Branch konnte nicht ermittelt werden:'),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });
});
