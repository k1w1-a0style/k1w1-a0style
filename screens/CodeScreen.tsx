import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme'; // Theme importieren

const CodeScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Code Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background, // Theme nutzen
  },
  text: {
    fontSize: 20,
    color: theme.palette.text.primary, // Theme nutzen
  },
});

export default CodeScreen;
