// screens/CodeScreen/components/ImageViewer.tsx
import React from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface ImageViewerProps {
  filePath: string;
  content: string;
  onBack: () => void;
  onCopy: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  filePath,
  content,
  onBack,
  onCopy,
}) => {
  const base64Content = typeof content === "string" ? content : "";
  const imageUri = base64Content.startsWith("data:image")
    ? base64Content
    : `data:image/png;base64,${base64Content}`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.editorHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.palette.primary} />
          <Text style={styles.fileName} numberOfLines={1}>
            {filePath}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onCopy}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="copy-outline"
            size={22}
            color={theme.palette.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.imageScrollContainer}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
          <Text style={styles.imageInfo}>
            {filePath} • {(base64Content.length / 1024).toFixed(1)} KB
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
