import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../../theme';
import { styles } from '../styles';
import type { ValidationIssue } from '../types';

type Props = {
  validationIssues: ValidationIssue[];
};

export function ValidationSection({ validationIssues }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>✓ Build-Validierung</Text>

      {validationIssues.map((issue, index) => (
        <View
          key={index}
          style={[
            styles.validationCard,
            issue.type === 'error' && styles.validationCardError,
            issue.type === 'warning' && styles.validationCardWarning,
            issue.type === 'info' && styles.validationCardInfo,
          ]}
        >
          <View style={styles.validationHeader}>
            <Ionicons
              name={
                issue.type === 'error'
                  ? 'close-circle'
                  : issue.type === 'warning'
                  ? 'warning'
                  : 'checkmark-circle'
              }
              size={22}
              color={
                issue.type === 'error'
                  ? theme.palette.error
                  : issue.type === 'warning'
                  ? theme.palette.warning
                  : theme.palette.success
              }
            />
            <Text
              style={[
                styles.validationMessage,
                issue.type === 'error' && styles.validationMessageError,
                issue.type === 'warning' && styles.validationMessageWarning,
                issue.type === 'info' && styles.validationMessageInfo,
              ]}
            >
              {issue.message}
            </Text>
          </View>
          {issue.details && (
            <Text style={styles.validationDetails}>{issue.details}</Text>
          )}
        </View>
      ))}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={18} color={theme.palette.primary} />
        <Text style={styles.infoCardText}>
          Beheben Sie alle Fehler bevor Sie einen Build starten. Warnungen sind optional, sollten aber überprüft werden.
        </Text>
      </View>
    </View>
  );
}
