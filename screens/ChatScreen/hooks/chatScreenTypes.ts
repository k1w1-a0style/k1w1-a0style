// screens/ChatScreen/hooks/chatScreenTypes.ts
// Extracted from useChatScreen.ts: types and constants.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  InteractionManager,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProject } from "../../../contexts/ProjectContext";
import type { ChatMessage } from "../../../shared/types/chat";
import type { ProjectFile } from "../../../shared/types/project";
import { useAI } from "../../../contexts/AIContext";

import { useKeyboardHeight } from "../../../hooks/useKeyboardHeight";
import { useChatAIFlow } from "../../../hooks/useChatAIFlow";


export type DocumentResultAsset = NonNullable<
  import("expo-document-picker").DocumentPickerResult["assets"]
>[0];

export const INPUT_BAR_MIN_H = 56;

// Composer 1–2px näher an die Tastatur (wenn offen)
export const KEYBOARD_NUDGE = 2;

export const FOOTER_LIFT_WHEN_BUSY = 72;
