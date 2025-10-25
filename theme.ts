import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const theme = {
  palette: {
    primary: '#00FF00',        // Neongrün
    secondary: '#1a1a1a',
    background: '#0a0a0a',     // Sehr dunkles Schwarz
    card: '#121212',
    border: '#2a2a2a',
    
    // Chat-Bubble-Farben (TRANSPARENT mit Rahmen)
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
    
    text: {
      primary: '#e0e0e0',
      secondary: '#999999',
      disabled: '#555555',
    },
    input: {
      background: '#1a1a1a',
      border: '#2a2a2a',
      placeholder: '#666666',
    },
    error: '#ff4444',
    success: '#00FF00',
    warning: '#ffaa00',
  },
};

export const HEADER_HEIGHT = 60;
