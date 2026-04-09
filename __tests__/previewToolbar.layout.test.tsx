import React from 'react';
import { Animated } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PreviewToolbar } from '../screens/PreviewScreen/components/PreviewToolbar';

describe('PreviewToolbar responsive layout', () => {
  it('keeps compact mobile controls visible without letting the title consume the action row', () => {
    render(
      <PreviewToolbar
        projectName="Sehr langer Projektname fuer eine schmale Mobil-Toolbar"
        compact
        runtimeHint="active=PreviewScreen source=supabase/url state=remote_ready phase=ready"
        hotReloadEnabled
        hotDotAnim={new Animated.Value(1)}
        hasPreviewUrl
        canFullscreen
        onToggleHotReload={jest.fn()}
        onReload={jest.fn()}
        onCopy={jest.fn()}
        onOpenExternal={jest.fn()}
        onFullscreen={jest.fn()}
      />,
    );

    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('Hot')).toBeTruthy();
    expect(screen.getByTestId('preview-toolbar-actions')).toBeTruthy();
    expect(screen.getByLabelText('Preview neu laden')).toBeTruthy();
    expect(screen.getByLabelText('Preview im Browser öffnen')).toBeTruthy();
    expect(screen.getByTestId('preview-runtime-hint')).toBeTruthy();
  });
});
