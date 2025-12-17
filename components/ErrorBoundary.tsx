// components/ErrorBoundary.tsx - Error Boundary für React Native
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, getNeonGlow } from '../theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          {/* Neon Glow Background */}
          <View style={styles.glowOverlay} />
          
          <View style={[styles.errorCard, getNeonGlow(theme.palette.error, 'normal')]}>
            {/* Error Icon mit Glow */}
            <View style={styles.iconContainer}>
              <View style={[styles.iconCircle, getNeonGlow(theme.palette.error, 'strong')]}>
                <Ionicons name="warning" size={40} color={theme.palette.error} />
              </View>
            </View>
            
            <Text style={styles.errorTitle}>Oops! Etwas ist schiefgelaufen</Text>
            
            <View style={styles.errorMessageContainer}>
              <Text style={styles.errorMessage}>
                {this.state.error?.message || 'Unbekannter Fehler'}
              </Text>
            </View>

            {__DEV__ && this.state.errorInfo && (
              <View style={styles.devSection}>
                <Text style={styles.devSectionTitle}>🔧 Debug Info (nur in DEV)</Text>
                <ScrollView style={styles.stackTrace} nestedScrollEnabled>
                  <Text style={styles.stackTraceText} selectable>
                    {this.state.errorInfo.componentStack}
                  </Text>
                </ScrollView>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.resetButton, getNeonGlow(theme.palette.primary, 'subtle')]} 
              onPress={this.handleReset}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#000" />
              <Text style={styles.resetButtonText}>Erneut versuchen</Text>
            </TouchableOpacity>

            <Text style={styles.hintText}>
              Falls das Problem weiterhin besteht, starte die App neu.
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    position: 'relative',
  },
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: `${theme.palette.error}08`,
  },
  errorCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: theme.palette.error,
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${theme.palette.error}15`,
    borderWidth: 2,
    borderColor: theme.palette.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessageContainer: {
    backgroundColor: `${theme.palette.error}10`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${theme.palette.error}30`,
  },
  errorMessage: {
    fontSize: 14,
    color: theme.palette.error,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  devSection: {
    marginBottom: 16,
  },
  devSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.palette.text.secondary,
    marginBottom: 8,
  },
  stackTrace: {
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    padding: 12,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  stackTraceText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: theme.palette.text.secondary,
    lineHeight: 16,
  },
  resetButton: {
    backgroundColor: theme.palette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  hintText: {
    fontSize: 12,
    color: theme.palette.text.disabled,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
