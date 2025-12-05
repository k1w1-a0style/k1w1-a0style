// components/ErrorBoundary.tsx - Error Boundary für React Native
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from '../theme';

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
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>⚠️ Ups, etwas ist schiefgelaufen</Text>
            <Text style={styles.errorMessage}>
              {this.state.error?.message || 'Unbekannter Fehler'}
            </Text>

            {__DEV__ && this.state.errorInfo && (
              <ScrollView style={styles.stackTrace}>
                <Text style={styles.stackTraceText}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </ScrollView>
            )}

            <TouchableOpacity style={styles.resetButton} onPress={this.handleReset}>
              <Text style={styles.resetButtonText}>🔄 Erneut versuchen</Text>
            </TouchableOpacity>
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
  },
  errorCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: theme.palette.error,
    maxWidth: 500,
    width: '100%',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.palette.error,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: theme.palette.text.primary,
    marginBottom: 16,
    lineHeight: 20,
  },
  stackTrace: {
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    maxHeight: 200,
  },
  stackTraceText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: theme.palette.text.secondary,
  },
  resetButton: {
    backgroundColor: theme.palette.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
