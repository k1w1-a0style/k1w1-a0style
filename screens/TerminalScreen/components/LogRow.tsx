import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import type { LogEntry } from '../../../contexts/TerminalContext';
import * as Clipboard from 'expo-clipboard';
import theme from '../../../theme';
import { redactSecrets, truncateWithMarker } from '../../../lib/secretRedaction';

type Props = {
  item: LogEntry;
};

export default function LogRow({ item }: Props) {
  const tsLabel = useMemo(() => {
    try {
      const d = new Date(item.timestamp);
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  }, [item.timestamp]);

  const levelLabel = useMemo(() => item.type.toUpperCase(), [item.type]);

  const onCopy = async () => {
    try {
      const safe = redactSecrets(item.message);
      await Clipboard.setStringAsync(safe);
      Alert.alert('Kopiert', 'Log-Zeile wurde in die Zwischenablage kopiert.');
    } catch {
      Alert.alert('Fehler', 'Konnte nicht kopieren.');
    }
  };

  const safeMessage = truncateWithMarker(redactSecrets(item.message), 6000, '<truncated>');

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.ts}>{tsLabel}</Text>
        <Text style={styles.level}>{levelLabel}</Text>
      </View>

      <Pressable style={styles.body} onLongPress={onCopy}>
        <Text style={styles.message}>{safeMessage}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  left: {
    width: 92,
    marginRight: 10,
    gap: 2,
  },
  ts: {
    fontSize: 11,
    color: theme.palette.text.muted,
  },
  level: {
    fontSize: 11,
    color: theme.palette.text.muted,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 13,
    color: theme.palette.text.primary,
  },
});
