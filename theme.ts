import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const theme = {
  palette: {
    // Grundfarben
    primary: '#00FF00',
    secondary: '#1a1a1a',
    background: '#050505',
    card: '#111111',
    surface: '#151515',
    border: '#272727',

    // Soft-Farben
    primarySoft: 'rgba(0,255,0,0.08)',
    successSoft: 'rgba(0,255,0,0.10)',
    warningSoft: 'rgba(255,170,0,0.10)',

    // Chat-Bubbles
    userBubble: {
      background: 'transparent',
      border: '#00FF00',
      text: '#00FF00',
    },
    aiBubble: {
      background: 'transparent',
      border: '#444444',
      text: '#e0e0e0',
    },
    systemBubble: {
      background: 'transparent',
      border: '#ffaa00',
      text: '#ffaa00',
    },

    // Text
    text: {
      primary: '#e0e0e0',
      secondary: '#a0a0a0',
      disabled: '#555555',
      muted: '#777777',
      accent: '#00FF00',
      success: '#00ff7f',
      warning: '#ffcc66',
    },

    // Inputs
    input: {
      background: '#111111',
      border: '#2a2a2a',
      placeholder: '#777777',
    },

    // Status
    error: '#ff4444',
    success: '#00FF00',
    warning: '#ffaa00',

    // Badges / Labels
    badge: {
      defaultBg: '#1f1f1f',
      defaultText: '#cccccc',
      successBg: '#004d00',
      successText: '#00ff00',
      warningBg: '#4d2e00',
      warningText: '#ffcc00',
      errorBg: '#4d0000',
      errorText: '#ff6666',
    },

    // Code / Terminal
    code: {
      background: '#05070b',
      border: '#202634',
      keyword: '#ff79c6',
      string: '#f1fa8c',
      comment: '#6272a4',
    },
    terminal: {
      background: '#050505',
      border: '#222222',
      text: '#e0e0e0',
      success: '#00ff00',
      error: '#ff4444',
      warning: '#ffaa00',
    },

    // Kleine Chips
    chip: {
      background: '#1e1e1e',
      border: '#333333',
      text: '#e0e0e0',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  layout: {
    screenPadding: 16,
  },

  sizes: {
    screenWidth: width,
    screenHeight: height,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
  },
};
