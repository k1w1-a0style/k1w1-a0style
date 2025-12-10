/**
 * Accessibility Helpers
 * 
 * ✅ Features:
 * - Consistent accessibility labels
 * - ARIA-like roles for React Native
 * - Screen reader hints
 * - Focus management helpers
 * 
 * @author k1w1-team
 * @version 1.0.0
 */

import { AccessibilityRole, AccessibilityState } from 'react-native';

export type A11yRole = AccessibilityRole;

export type A11yState = AccessibilityState;

export type A11yProps = {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: A11yRole;
  accessibilityState?: A11yState;
  accessible?: boolean;
};

/**
 * Common accessibility labels for buttons
 */
export const A11Y_LABELS = {
  // Navigation
  BACK: 'Zurück',
  CLOSE: 'Schließen',
  MENU: 'Menü',
  HOME: 'Startseite',
  
  // Actions
  SEND: 'Senden',
  SAVE: 'Speichern',
  DELETE: 'Löschen',
  EDIT: 'Bearbeiten',
  CANCEL: 'Abbrechen',
  CONFIRM: 'Bestätigen',
  RETRY: 'Wiederholen',
  
  // Media
  PLAY: 'Abspielen',
  PAUSE: 'Pausieren',
  STOP: 'Stoppen',
  
  // File operations
  UPLOAD: 'Hochladen',
  DOWNLOAD: 'Herunterladen',
  SHARE: 'Teilen',
  
  // Common
  SEARCH: 'Suchen',
  FILTER: 'Filtern',
  SORT: 'Sortieren',
  REFRESH: 'Aktualisieren',
  MORE: 'Mehr',
  LESS: 'Weniger',
} as const;

/**
 * Common accessibility hints
 */
export const A11Y_HINTS = {
  BUTTON: 'Doppeltippen zum Aktivieren',
  LINK: 'Doppeltippen zum Öffnen',
  TEXT_INPUT: 'Doppeltippen zum Bearbeiten',
  DISMISSABLE: 'Wischen zum Schließen',
  EXPANDABLE: 'Doppeltippen zum Erweitern',
  COLLAPSIBLE: 'Doppeltippen zum Minimieren',
} as const;

/**
 * Creates accessibility props for a button
 */
export function buttonA11y(
  label: string,
  hint?: string,
  disabled?: boolean
): A11yProps {
  return {
    accessible: true,
    accessibilityRole: 'button',
    accessibilityLabel: label,
    accessibilityHint: hint || A11Y_HINTS.BUTTON,
    accessibilityState: {
      disabled: disabled || false,
    },
  };
}

/**
 * Creates accessibility props for a link
 */
export function linkA11y(label: string, hint?: string): A11yProps {
  return {
    accessible: true,
    accessibilityRole: 'link',
    accessibilityLabel: label,
    accessibilityHint: hint || A11Y_HINTS.LINK,
  };
}

/**
 * Creates accessibility props for a text input
 */
export function textInputA11y(
  label: string,
  placeholder?: string,
  required?: boolean
): A11yProps {
  const hint = required
    ? `${A11Y_HINTS.TEXT_INPUT}. Pflichtfeld.`
    : A11Y_HINTS.TEXT_INPUT;
    
  return {
    accessible: true,
    accessibilityRole: 'none', // 'text' role doesn't exist, use 'none'
    accessibilityLabel: label,
    accessibilityHint: hint,
  };
}

/**
 * Creates accessibility props for a heading
 */
export function headingA11y(text: string, level?: number): A11yProps {
  return {
    accessible: true,
    accessibilityRole: 'header',
    accessibilityLabel: `${text}${level ? `, Ebene ${level}` : ''}`,
  };
}

/**
 * Creates accessibility props for an image
 */
export function imageA11y(description: string): A11yProps {
  return {
    accessible: true,
    accessibilityRole: 'image',
    accessibilityLabel: description,
  };
}

/**
 * Creates accessibility props for a list item
 */
export function listItemA11y(
  text: string,
  position?: { current: number; total: number }
): A11yProps {
  const label = position
    ? `${text}, ${position.current} von ${position.total}`
    : text;
    
  return {
    accessible: true,
    accessibilityRole: 'none', // 'listitem' doesn't exist in RN
    accessibilityLabel: label,
  };
}

/**
 * Creates accessibility props for a checkbox
 */
export function checkboxA11y(
  label: string,
  checked: boolean,
  disabled?: boolean
): A11yProps {
  return {
    accessible: true,
    accessibilityRole: 'checkbox',
    accessibilityLabel: label,
    accessibilityState: {
      checked,
      disabled: disabled || false,
    },
  };
}

/**
 * Creates accessibility props for a switch/toggle
 */
export function switchA11y(
  label: string,
  checked: boolean,
  disabled?: boolean
): A11yProps {
  return {
    accessible: true,
    accessibilityRole: 'switch',
    accessibilityLabel: label,
    accessibilityState: {
      checked,
      disabled: disabled || false,
    },
  };
}

/**
 * Creates accessibility props for a tab
 */
export function tabA11y(
  label: string,
  selected: boolean,
  position?: { current: number; total: number }
): A11yProps {
  const fullLabel = position
    ? `${label}, Tab ${position.current} von ${position.total}`
    : label;
    
  return {
    accessible: true,
    accessibilityRole: 'tab',
    accessibilityLabel: fullLabel,
    accessibilityState: {
      selected,
    },
  };
}

/**
 * Creates accessibility props for loading indicators
 */
export function loadingA11y(message: string = 'Lädt'): A11yProps {
  return {
    accessible: true,
    accessibilityRole: 'progressbar',
    accessibilityLabel: message,
    accessibilityState: {
      busy: true,
    },
  };
}

/**
 * Creates accessibility props for alerts/notifications
 */
export function alertA11y(
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info'
): A11yProps {
  const typeLabels = {
    info: 'Information',
    warning: 'Warnung',
    error: 'Fehler',
    success: 'Erfolg',
  };
  
  return {
    accessible: true,
    accessibilityRole: 'alert',
    accessibilityLabel: `${typeLabels[type]}: ${message}`,
  };
}

/**
 * Announces a message to screen readers
 * Note: This is a placeholder - actual implementation would use AccessibilityInfo.announceForAccessibility
 */
export function announceToScreenReader(message: string): void {
  // TODO: Implement with AccessibilityInfo.announceForAccessibility
  if (__DEV__) {
    console.log('[A11Y] Announce:', message);
  }
}

/**
 * Usage Examples:
 * 
 * 1. Button:
 *    <TouchableOpacity {...buttonA11y('Senden', 'Sendet die Nachricht')}>
 *      <Text>Send</Text>
 *    </TouchableOpacity>
 * 
 * 2. Text Input:
 *    <TextInput
 *      {...textInputA11y('E-Mail-Adresse', 'email@example.com', true)}
 *      placeholder="E-Mail"
 *    />
 * 
 * 3. Checkbox:
 *    <TouchableOpacity
 *      {...checkboxA11y('Newsletter abonnieren', isChecked)}
 *      onPress={toggleCheck}
 *    >
 *      <Text>{isChecked ? '☑' : '☐'} Newsletter</Text>
 *    </TouchableOpacity>
 * 
 * 4. Loading:
 *    <ActivityIndicator {...loadingA11y('Daten werden geladen')} />
 * 
 * 5. Alert:
 *    <View {...alertA11y('Speichern erfolgreich', 'success')}>
 *      <Text>✓ Gespeichert!</Text>
 *    </View>
 */
