import { renderHook, waitFor } from '@testing-library/react-native';
import { usePreview } from '../hooks/usePreview';
import type { ProjectData } from '../shared/types/project';

jest.mock('../contexts/ProjectContext', () => ({
  useProject: () => ({
    setLastPreview: jest.fn().mockResolvedValue(undefined),
    setPreferredPreviewMode: jest.fn().mockResolvedValue(undefined),
  }),
}));

const baseProject: ProjectData = {
  id: 'p1',
  name: 'Preview A',
  slug: 'preview-a',
  files: [],
  chatHistory: [],
  createdAt: '2026-03-14T10:00:00.000Z',
  lastModified: '2026-03-14T10:00:00.000Z',
  preferredPreviewMode: 'supabase',
  lastPreview: {
    url: 'https://example.com/a',
    source: 'supabase',
    createdAt: '2026-03-14T10:00:00.000Z',
    expiresAt: '2026-03-14T11:00:00.000Z',
  },
};

describe('usePreview rehydration', () => {
  test('clears in-memory last preview when persisted preview disappears', async () => {
    const { result, rerender } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: baseProject,
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.url).toBe('https://example.com/a');
    });

    rerender({
      ...baseProject,
      id: 'p2',
      name: 'Preview B',
      lastPreview: null,
    });

    await waitFor(() => {
      expect(result.current.lastPreview).toBeNull();
    });
  });


  test('shows clear hint when only transient local preview metadata is restored', async () => {
    const localProject: ProjectData = {
      ...baseProject,
      id: 'p-local',
      lastPreview: {
        url: null,
        source: 'local',
        createdAt: '2026-03-14T10:00:00.000Z',
        expiresAt: null,
      },
    };

    const { result } = renderHook((projectData: ProjectData | null) => usePreview(projectData), {
      initialProps: localProject,
    });

    await waitFor(() => {
      expect(result.current.lastPreview?.source).toBe('local');
      expect(result.current.lastPreview?.html).toBeNull();
      expect(result.current.state.error).toContain('lokaler HTML-Fallback');
    });
  });

});
