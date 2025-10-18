import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { useTerminal } from '../contexts/TerminalContext';
import { theme } from '../theme';

const TerminalScreen = () => {
  const { logs } = useTerminal();
  const flatListRef = useRef<FlatList>(null);

  // Auto-Scroll zum Ende, wenn neue Logs hinzukommen (optional)
  useEffect(() => {
    if (flatListRef.current && logs.length > 0) {
      // flatListRef.current.scrollToEnd({ animated: true }); // Kann ruckeln, Alternative s.u.
    }
  }, [logs]);


  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        ref={flatListRef}
        data={logs} // Nicht mehr umdrehen
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <Text style={styles.logText} key={index}>
            <Text style={styles.prompt}>$ </Text>{item}
          </Text>
        )}
        style={styles.container}
        contentContainerStyle={styles.listContent}
        inverted // FlatList dreht die Anzeige um, neueste unten
        // Alternative zum Scrollen ans Ende bei inverted: Keine Aktion nötig!
        // onContentSizeChange={() => flatListRef.current?.scrollToOffset({ animated: true, offset: 0 })} // Scrollt nach oben (Ende bei inverted)
      />
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
    paddingHorizontal: 10, // Nur horizontal
  },
  listContent: {
    paddingTop: 10, // Oben und unten Padding für inverted Liste
    paddingBottom: 20,
  },
  logText: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  prompt: {
    color: theme.palette.primary, // Neongrünes Prompt-Zeichen
  },
});

export default TerminalScreen;
