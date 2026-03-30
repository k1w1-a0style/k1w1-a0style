import React from "react";
import { Platform, ScrollView, UIManager, View } from "react-native";

import { InlineToast } from "../../components/diagnostics/InlineToast";

import { useCredentialsWizardScreen } from "./hooks/useCredentialsWizardScreen";
import { styles } from "./styles";

import { AdminKeySection } from "./components/AdminKeySection";
import { BusyFooter } from "./components/BusyFooter";
import { DebugSection } from "./components/DebugSection";
import { ErrorSection } from "./components/ErrorSection";
import { HeaderSection } from "./components/HeaderSection";
import { KeystoreStatusSection } from "./components/KeystoreStatusSection";
import { ModeSection } from "./components/ModeSection";
import { ProjectSection } from "./components/ProjectSection";
import { Spacer } from "./components/ui";

// NOTE: In der New Architecture ist setLayoutAnimationEnabledExperimental ein No-Op (warn spam).
const isNewArch = !!(globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental && !isNewArch) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CredentialsWizardScreen() {
  const s = useCredentialsWizardScreen();

  return (
    <View style={styles.root}>
      <InlineToast message={s.toast.message} anim={s.toast.anim} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <HeaderSection subtitle={s.headerSubtitle} />

        <ProjectSection repoFullName={s.repoFullName} branch={s.branch} supabaseUrl={s.supabaseUrl} />

        <Spacer />

        <AdminKeySection
          adminKey={s.adminKey}
          setAdminKey={s.setAdminKey}
          adminKeyLoaded={s.adminKeyLoaded}
          canRun={s.canRun}
          busy={s.busy}
          showAdvanced={s.showAdvanced}
          setShowAdvanced={s.setShowAdvanced}
          onSaveAdminKey={s.onSaveAdminKey}
          refreshAll={s.refreshAll}
        />

        <Spacer />

        <ModeSection
          modeHint={s.modeHint}
          modes={s.MODES}
          selectedMode={s.selectedMode}
          setSelectedMode={s.setSelectedMode}
          canRun={s.canRun}
          busy={s.busy}
          refreshStatus={s.refreshStatus}
          generate={s.generate}
        />

        <Spacer />

        <KeystoreStatusSection
          modes={s.MODES}
          statusByMode={s.statusByMode}
          selectedMode={s.selectedMode}
          setSelectedMode={s.setSelectedMode}
          canRun={s.canRun}
          busy={s.busy}
          metaForStatus={s.metaForStatus}
          normalizeModeForUi={s.normalizeModeForUi}
          pickStorageBucket={s.pickStorageBucket}
          pickStoragePath={s.pickStoragePath}
          pickUpdatedAt={s.pickUpdatedAt}
          refreshStatus={s.refreshStatus}
          generate={s.generate}
        />

        {(s.lastError || s.lastDebug) ? <Spacer /> : null}

        {s.lastError ? (
          <ErrorSection
            lastError={s.lastError}
            prettyError={s.prettyError}
            showError={s.showError}
            setShowError={s.setShowError}
            onCopyError={s.onCopyError}
          />
        ) : null}

        {s.lastDebug ? (
          <>
            <Spacer />
            <DebugSection
              lastDebug={s.lastDebug}
              prettyDebug={s.prettyDebug}
              showDebug={s.showDebug}
              setShowDebug={s.setShowDebug}
              onCopyDebug={s.onCopyDebug}
            />
          </>
        ) : null}

        {s.formatBusyLabel ? <BusyFooter busy={s.formatBusyLabel} /> : null}

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}
