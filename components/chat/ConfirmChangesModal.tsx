import React, { useEffect, useRef } from 'react';
import { Animated, Keyboard, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme';
import { styles } from '../../styles/chatScreenStyles';

type Props = {
  visible: boolean;
  summary: string;
  onReject: () => void;
  onAccept: () => void;
};

const ConfirmChangesModal: React.FC<Props> = ({ visible, summary, onReject, onAccept }) => {
  const modalScale = useRef(new Animated.Value(0.8)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 10,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      modalScale.setValue(0.8);
      modalOpacity.setValue(0);
    }
  }, [visible, modalOpacity, modalScale]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onReject}>
      <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
        <Animated.View style={[styles.modalContent, { transform: [{ scale: modalScale }], opacity: modalOpacity }]}>
          <View style={styles.modalHeader}>
            <Ionicons name="code-slash" size={28} color={theme.palette.primary} />
            <Text style={styles.modalTitle}>Änderungen bestätigen</Text>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalText}>{summary}</Text>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonReject]}
              onPress={onReject}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={20} color={theme.palette.error} />
              <Text style={styles.modalButtonTextReject}>Ablehnen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonAccept]}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color="#000" />
              <Text style={styles.modalButtonTextAccept}>Bestätigen</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ConfirmChangesModal;
