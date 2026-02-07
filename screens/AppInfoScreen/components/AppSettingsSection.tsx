import React from "react";
import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";

type AssetsStatus = {
  icon: boolean;
  adaptiveIcon: boolean;
  splash: boolean;
  favicon: boolean;
};

type Props = {
  styles: any;

  appName: string;
  setAppName: (v: string) => void;
  packageName: string;
  setPackageNameState: (v: string) => void;

  iconPreview: string | null;
  setIconPreview: (v: string | null) => void;
  assetsStatus: AssetsStatus;

  handleSaveAppName: () => void;
  handleSavePackageName: () => void;
  handleChooseIcon: () => void;
};

export function AppSettingsSection({
  styles,
  appName,
  setAppName,
  packageName,
  setPackageNameState,
  iconPreview,
  setIconPreview,
  assetsStatus,
  handleSaveAppName,
  handleSavePackageName,
  handleChooseIcon,
}: Props) {
  return (
    <>
      {/* APP SETTINGS */}
      <Text style={styles.sectionTitle}>📱 App-Einstellungen</Text>

      <View style={styles.settingsContainer}>
        <Text style={styles.label}>App Name:</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={appName}
            onChangeText={setAppName}
            placeholder="Meine App"
            placeholderTextColor={theme.palette.text.secondary}
          />
          <TouchableOpacity onPress={handleSaveAppName} style={styles.saveButton}>
            <Ionicons name="checkmark" size={24} color={theme.palette.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingsContainer}>
        <Text style={styles.label}>Package Name (Slug):</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={packageName}
            onChangeText={setPackageNameState}
            placeholder="meine-app"
            placeholderTextColor={theme.palette.text.secondary}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={handleSavePackageName} style={styles.saveButton}>
            <Ionicons name="checkmark" size={24} color={theme.palette.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Ändert package.json (name) und app.config.js (slug, package)
        </Text>
      </View>

      <View style={styles.settingsContainer}>
        <Text style={styles.label}>App Icon & Assets:</Text>
        <TouchableOpacity onPress={handleChooseIcon} style={styles.iconButton}>
          {iconPreview ? (
            <Image
              source={{ uri: iconPreview }}
              style={styles.iconPreview}
              onError={() => {
                setIconPreview(null);
              }}
            />
          ) : (
            <View style={styles.iconPlaceholder}>
              <Ionicons
                name="image-outline"
                size={24}
                color={theme.palette.text.secondary}
              />
            </View>
          )}
          <Text style={styles.iconButtonText}>
            {iconPreview ? "App Assets ändern..." : "App Assets auswählen..."}
          </Text>
        </TouchableOpacity>

        {/* Assets Status */}
        <View style={styles.assetsStatus}>
          <Text style={styles.assetsStatusTitle}>Gesetzte Assets:</Text>
          <View style={styles.assetsStatusList}>
            <View style={styles.assetStatusItem}>
              <Ionicons
                name={assetsStatus.icon ? "checkmark-circle" : "close-circle"}
                size={16}
                color={assetsStatus.icon ? theme.palette.success : theme.palette.error}
              />
              <Text style={styles.assetStatusText}>icon.png</Text>
            </View>
            <View style={styles.assetStatusItem}>
              <Ionicons
                name={
                  assetsStatus.adaptiveIcon
                    ? "checkmark-circle"
                    : "close-circle"
                }
                size={16}
                color={
                  assetsStatus.adaptiveIcon
                    ? theme.palette.success
                    : theme.palette.error
                }
              />
              <Text style={styles.assetStatusText}>adaptive-icon.png</Text>
            </View>
            <View style={styles.assetStatusItem}>
              <Ionicons
                name={assetsStatus.splash ? "checkmark-circle" : "close-circle"}
                size={16}
                color={assetsStatus.splash ? theme.palette.success : theme.palette.error}
              />
              <Text style={styles.assetStatusText}>splash.png</Text>
            </View>
            <View style={styles.assetStatusItem}>
              <Ionicons
                name={assetsStatus.favicon ? "checkmark-circle" : "close-circle"}
                size={16}
                color={assetsStatus.favicon ? theme.palette.success : theme.palette.error}
              />
              <Text style={styles.assetStatusText}>favicon.png</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );
}
