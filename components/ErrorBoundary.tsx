// components/ErrorBoundary.tsx - Error Boundary für React Native
import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  View,
  Text,

  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, getNeonGlow } from "../theme";

import { styles } from "./ErrorBoundary.styles";

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
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
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

          <View
            style={[
              styles.errorCard,
              getNeonGlow(theme.palette.error, "normal"),
            ]}
          >
            {/* Error Icon mit Glow */}
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconCircle,
                  getNeonGlow(theme.palette.error, "strong"),
                ]}
              >
                <Ionicons
                  name="warning"
                  size={40}
                  color={theme.palette.error}
                />
              </View>
            </View>

            <Text style={styles.errorTitle}>
              Oops! Etwas ist schiefgelaufen
            </Text>

            <View style={styles.errorMessageContainer}>
              <Text style={styles.errorMessage}>
                {this.state.error?.message || "Unbekannter Fehler"}
              </Text>
            </View>

            {__DEV__ && this.state.errorInfo && (
              <View style={styles.devSection}>
                <Text style={styles.devSectionTitle}>
                  🔧 Debug Info (nur in DEV)
                </Text>
                <ScrollView style={styles.stackTrace} nestedScrollEnabled>
                  <Text style={styles.stackTraceText} selectable>
                    {this.state.errorInfo.componentStack}
                  </Text>
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.resetButton,
                getNeonGlow(theme.palette.primary, "subtle"),
              ]}
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

