import { Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import type { DocumentResultAsset } from "./chatScreenTypes";

export const pickChatDocument = async (): Promise<DocumentResultAsset | null> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const sizeKB = asset.size ? (asset.size / 1024).toFixed(2) : "?";

      if (asset.size && asset.size > 100000) {
        Alert.alert(
          "📎 Große Datei ausgewählt",
          `${asset.name} (${sizeKB} KB)\n\nHinweis: Große Dateien können die Verarbeitung verlangsamen.`,
        );
      }

      return asset;
    }

    return null;
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    Alert.alert("Fehler", error.message || "Dateiauswahl fehlgeschlagen");
    return null;
  }
};
