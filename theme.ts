import { Dimensions, Platform } from 'react-native';

// HINWEIS: Für reaktive Dimensions in Components, verwende useWindowDimensions() Hook
const { width, height } = Dimensions.get('window');

export const theme = {
  palette: {
    // Hauptfarben - Neon Giftgrün
    primary: '#00FF00', // Neongrün / Giftgrün
    primaryDark: '#00CC00', // Dunkleres Neongrün
    primaryLight: '#33FF33', // Helleres Neongrün
    secondary: '#1a1a1a',

    // Hintergründe - Deep Dark
    background: '#0a0a0a', // Sehr dunkles Schwarz
    backgroundDark: '#050505', // Noch dunkler
    card: '#121212',
    cardHover: '#181818',
    border: '#2a2a2a',
    borderLight: '#333333',

    // Chat-Bubbles (transparent mit Rahmen - Neon Style)
    userBubble: {
      background: 'rgba(0, 255, 0, 0.08)',
      border: '#00FF00',
      text: '#00FF00',
    },
    aiBubble: {
      background: 'rgba(68, 68, 68, 0.15)',
      border: '#444444',
      text: '#e0e0e0',
    },
    systemBubble: {
      background: 'rgba(255, 170, 0, 0.08)',
      border: '#ffaa00',
      text: '#ffaa00',
    },

    // Textfarben
    text: {
      primary: '#e0e0e0',
      secondary: '#999999',
      disabled: '#555555',
      muted: '#666666',
      accent: '#00FF00', // Neon-Akzent für Text
    },

    // Inputs
    input: {
      background: '#1a1a1a',
      border: '#2a2a2a',
      borderFocused: '#00FF00',
      placeholder: '#666666',
    },

    // Statusfarben
    error: '#ff4444',
    errorDark: '#cc3333',
    success: '#00FF00',
    warning: '#ffaa00',
    info: '#00aaff',

    // Syntax-Highlighting Farben (Neon Style)
    syntax: {
      keyword: '#FF00FF', // Neon Magenta
      string: '#00FFAA', // Neon Türkis
      comment: '#666666', // Grau
      function: '#FFFF00', // Neon Gelb
      number: '#FF8800', // Neon Orange
      operator: '#00FF00', // Neon Grün
      default: '#e0e0e0', // Standard Text
      type: '#00AAFF', // Neon Blau für Types
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

  // Border-Radii
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
    full: 999,
  },

  // 🔥 NEU: Neon Glow Effekte
  glow: {
    primary: {
      shadowColor: '#00FF00',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 8,
    },
    primarySubtle: {
      shadowColor: '#00FF00',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 4,
    },
    error: {
      shadowColor: '#ff4444',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    warning: {
      shadowColor: '#ffaa00',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
  },

  // Typography
  typography: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    monoFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
};

export const HEADER_HEIGHT = 60;

// Hilfsfunktion für Neon-Glow auf Android (elevation + Farbe)
export const getNeonGlow = (
  color: string,
  intensity: 'subtle' | 'normal' | 'strong' = 'normal'
) => {
  const opacities = { subtle: 0.2, normal: 0.4, strong: 0.6 };
  const radii = { subtle: 4, normal: 8, strong: 12 };
  const elevations = { subtle: 3, normal: 6, strong: 10 };

  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: opacities[intensity],
    shadowRadius: radii[intensity],
    elevation: elevations[intensity],
  };
};

// ✅ Safety-Net: erlaubt auch "import theme from '../theme';"
export default theme;
