import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { theme } from '../theme';

const TerminalScreen = () => {
  // Kein useTerminal mehr nötig, da keine Logs von WebSocket kommen
  // const { logs } = useTerminal();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.placeholderText}>
          Terminal-Ausgabe (Manuell in Termux starten)
        </Text>
        {/* Hier könnten später Logs von anderen Prozessen angezeigt werden */}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
    padding: 15,
    justifyContent: 'center', // Zentriert den Platzhalter
    alignItems: 'center',
  },
  placeholderText: {
    color: theme.palette.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

export default TerminalScreen;
