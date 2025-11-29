import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const theme = {
  palette: {
    // Hauptfarben
    primary: '#00FF00',        // Neongrün
    secondary: '#1a1a1a',

    // Hintergründe
    background: '#0a0a0a',     // Sehr dunkles Schwarz
    card: '#121212',
    border: '#2a2a2a',

    // Chat-Bubbles (transparent mit Rahmen)
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
    systemBubble: {              // ✅ NEU
      background: 'transparent',
      border: '#ffaa00',
      text: '#ffaa00',
    },

    // Textfarben
    text: {
      primary: '#e0e0e0',
      secondary: '#999999',
      disabled: '#555555',
      muted: '#666666',          // ✅ NEU
    },

    // Inputs
    input: {
      background: '#1a1a1a',
      border: '#2a2a2a',
      placeholder: '#666666',
    },

    // Statusfarben
    error: '#ff4444',
    success: '#00FF00',
    warning: '#ffaa00',
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
};

export const HEADER_HEIGHT = 60;
