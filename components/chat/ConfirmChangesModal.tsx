import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { styles } from "../../styles/chatScreenStyles";

type Props = {
  visible: boolean;
  summary: string;
  onAccept: () => void;
  onReject: () => void;
};

/** Max characters for the summary display. Prevents UI lag from oversized LLM output. */
const SUMMARY_MAX_CHARS = 15_000;

const ConfirmChangesModal: React.FC<Props> = ({
  visible,
  summary,
  onAccept,
  onReject,
}) => {
  const modalScale = useRef(new Animated.Value(0.92)).current;
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
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      modalScale.setValue(0.92);
      modalOpacity.setValue(0);
    }
  }, [visible, modalOpacity, modalScale]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onReject}
      accessibilityViewIsModal
    >
      <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ scale: modalScale }], opacity: modalOpacity },
          ]}
          accessibilityRole="alert"
          accessibilityLabel="Änderungen bestätigen"
        >
          <View style={styles.modalHeader}>
            <Ionicons
              name="code-slash"
              size={28}
              color={theme.palette.primary}
            />
            <Text style={styles.modalTitle}>Änderungen bestätigen</Text>
          </View>

          {/* ✅ FIX #9: Wrap summary in ScrollView so long LLM outputs are scrollable */}
          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator
            bounces={false}
          >
            <Text style={styles.modalText}>
              {summary.length > SUMMARY_MAX_CHARS
                ? summary.slice(0, SUMMARY_MAX_CHARS) + "\n\n… (Text gekürzt)"
                : summary}
            </Text>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonReject]}
              onPress={onReject}
              activeOpacity={0.85}
              accessibilityLabel="Änderungen ablehnen"
              accessibilityRole="button"
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.palette.error}
              />
              <Text style={styles.modalButtonTextReject}>Ablehnen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonAccept]}
              onPress={onAccept}
              activeOpacity={0.85}
              accessibilityLabel="Änderungen bestätigen und anwenden"
              accessibilityRole="button"
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
