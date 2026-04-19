import React from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppInfoScreen } from "./hooks/useAppInfoScreen";
import { styles } from "./styles";

import { AppSettingsSection } from "./components/AppSettingsSection";
import { SecureBackupSection } from "./components/SecureBackupSection";
import { ApiBackupSection } from "./components/ApiBackupSection";
import { ActiveApiKeysSection } from "./components/ActiveApiKeysSection";
import { TemplateInfoSection } from "./components/TemplateInfoSection";
import { ProjectInfoSection } from "./components/ProjectInfoSection";
import { BackupPassphraseModal } from "./components/BackupPassphraseModal";

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
    handleExportSecretsBackup,
    handleExportConfigSecretsBackup,
    handleImportSecureBackup,
    secureBackupRequest,
    secureBackupBusy,
    closeSecureBackupPrompt,
    handleSubmitSecureBackupPassphrase,
    fileCount,
    messageCount,
    assetsStatus,
    config,
  } = useAppInfoScreen();

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]} testID="app-info-screen-root">
      <ScrollView testID="app-info-screen-scroll" style={styles.container} contentContainerStyle={styles.contentContainer}>
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

        <SecureBackupSection
          styles={styles}
          handleExportSecretsBackup={handleExportSecretsBackup}
          handleExportConfigSecretsBackup={handleExportConfigSecretsBackup}
          handleImportSecureBackup={handleImportSecureBackup}
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

      <BackupPassphraseModal
        styles={styles}
        visible={!!secureBackupRequest}
        busy={secureBackupBusy}
        mode={secureBackupRequest?.mode ?? "import"}
        scope={secureBackupRequest?.mode === "export" ? secureBackupRequest.scope : undefined}
        onClose={closeSecureBackupPrompt}
        onSubmit={handleSubmitSecureBackupPassphrase}
      />
    </SafeAreaView>
  );
}
