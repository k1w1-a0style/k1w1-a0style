import React from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProject } from "../../contexts/ProjectContext";
import { useAI } from "../../contexts/AIContext";

import { styles } from "./styles";
import { useAppInfoProjectFields } from "./hooks/useAppInfoProjectFields";
import { useAppInfoHandlers } from "./hooks/useAppInfoHandlers";

import { SectionTitle } from "./components/SectionTitle";
import { AppSettingsSection } from "./components/AppSettingsSection";
import { ApiBackupSection } from "./components/ApiBackupSection";
import { ActiveApiKeysSection } from "./components/ActiveApiKeysSection";
import { TemplateInfoSection } from "./components/TemplateInfoSection";
import { ProjectInfoSection } from "./components/ProjectInfoSection";

const AppInfoScreen = () => {
  const { projectData, setProjectName, updateProjectFiles, setPackageName } =
    useProject();
  const { config, addApiKey } = useAI();

  const {
    appName,
    setAppName,
    packageName,
    setPackageNameState,
    iconPreview,
    setIconPreview,
    fileCount,
    messageCount,
    assetsStatus,
  } = useAppInfoProjectFields(projectData, config);

  const {
    handleSaveAppName,
    handleSavePackageName,
    handleChooseIcon,
    handleExportAPIConfig,
    handleImportAPIConfig,
    handleIconPreviewError,
  } = useAppInfoHandlers({
    appName,
    packageName,
    setIconPreview,
    setProjectName,
    setPackageName,
    updateProjectFiles,
    config,
    addApiKey,
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <SectionTitle>📱 App-Einstellungen</SectionTitle>

        <AppSettingsSection
          appName={appName}
          setAppName={setAppName}
          packageName={packageName}
          setPackageNameState={setPackageNameState}
          iconPreview={iconPreview}
          onIconPreviewError={handleIconPreviewError}
          assetsStatus={assetsStatus}
          onSaveAppName={handleSaveAppName}
          onSavePackageName={handleSavePackageName}
          onChooseIcon={handleChooseIcon}
        />

        <SectionTitle>💾 API-Backup & Wiederherstellung</SectionTitle>
        <ApiBackupSection
          onExport={handleExportAPIConfig}
          onImport={handleImportAPIConfig}
        />

        <SectionTitle>🔑 Aktive API-Keys</SectionTitle>
        <ActiveApiKeysSection config={config} />

        <SectionTitle>📦 Projekt-Template</SectionTitle>
        <TemplateInfoSection fileCount={fileCount} />

        <SectionTitle>ℹ️ Aktuelles Projekt</SectionTitle>
        <ProjectInfoSection
          projectData={projectData}
          fileCount={fileCount}
          messageCount={messageCount}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AppInfoScreen;
