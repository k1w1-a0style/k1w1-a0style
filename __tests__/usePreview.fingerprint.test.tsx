import { renderHook } from '@testing-library/react-native';
import { usePreview } from '../hooks/usePreview';
import type { ProjectData } from '../shared/types/project';

jest.mock('../contexts/ProjectContext', () => ({
  useProject: () => ({
    setLastPreview: jest.fn().mockResolvedValue(undefined),
    setPreferredPreviewMode: jest.fn().mockResolvedValue(undefined),
  }),
}));

const baseProject: ProjectData = {
  id: 'fp1',
  name: 'Fingerprint',
  slug: 'fingerprint',
  files: [
    { path: 'App.tsx', content: 'const x = 1;\n' },
  ],
  chatHistory: [],
  createdAt: '2026-03-15T10:00:00.000Z',
  lastModified: '2026-03-15T10:00:00.000Z',
  preferredPreviewMode: 'supabase',
  lastPreview: null,
};

describe('usePreview fingerprint', () => {
  test('changes when file content changes with same length', () => {
    const { result, rerender } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    const before = result.current.filesFingerprint;

    rerender({
      ...baseProject,
      files: [{ path: 'App.tsx', content: 'const y = 1;\n' }],
    });

    const after = result.current.filesFingerprint;
    expect(after).not.toBe(before);
  });
});
