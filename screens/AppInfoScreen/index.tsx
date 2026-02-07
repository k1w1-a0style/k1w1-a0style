import React from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppInfoScreen } from "./hooks/useAppInfoScreen";
import { styles } from "./styles";

import { AppSettingsSection } from "./components/AppSettingsSection";
import { FullBackupSection } from "./components/FullBackupSection";
import { ApiBackupSection } from "./components/ApiBackupSection";
import { ActiveApiKeysSection } from "./components/ActiveApiKeysSection";
import { TemplateInfoSection } from "./components/TemplateInfoSection";
import { ProjectInfoSection } from "./components/ProjectInfoSection";

export default function AppInfoScreen() {
  const {
    projectData,
    appName,
    setAppName,
    packageName,
    setPackageNameState,
    iconPreview,
    setIconPreview,
    handleSaveAppName,
    handleSavePackageName,
    handleChooseIcon,
    handleExportAPIConfig,
    handleImportAPIConfig,
    handleExportFullBackup,
    handleImportFullBackup,
    fileCount,
    messageCount,
    assetsStatus,
    config,
  } = useAppInfoScreen();

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <AppSettingsSection
          styles={styles}
          appName={appName}
          setAppName={setAppName}
          packageName={packageName}
          setPackageNameState={setPackageNameState}
          iconPreview={iconPreview}
          setIconPreview={setIconPreview}
          assetsStatus={assetsStatus}
          handleSaveAppName={handleSaveAppName}
          handleSavePackageName={handleSavePackageName}
          handleChooseIcon={handleChooseIcon}
        />

        <FullBackupSection
          styles={styles}
          handleExportFullBackup={handleExportFullBackup}
          handleImportFullBackup={handleImportFullBackup}
        />

        <ApiBackupSection
          styles={styles}
          handleExportAPIConfig={handleExportAPIConfig}
          handleImportAPIConfig={handleImportAPIConfig}
        />

        <ActiveApiKeysSection styles={styles} config={config} />

        <TemplateInfoSection styles={styles} projectData={projectData} fileCount={fileCount} />

        <ProjectInfoSection
          styles={styles}
          projectData={projectData}
          fileCount={fileCount}
          messageCount={messageCount}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
