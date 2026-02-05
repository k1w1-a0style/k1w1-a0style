import React from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSettingsScreen } from "./hooks/useSettingsScreen";
import { styles } from "./styles";

import { AgentSection } from "./components/AgentSection";
import { ApiKeysSection } from "./components/ApiKeysSection";
import { GeneratorSection } from "./components/GeneratorSection";
import { NotificationsSection } from "./components/NotificationsSection";
import { QualitySection } from "./components/QualitySection";

export default function SettingsScreen() {
  const s = useSettingsScreen();

  const generatorHighlightPersona =
    s.qualityMode === "quality" ? "quality" : "speed";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <Text style={styles.h1}>KI Einstellungen</Text>

        <GeneratorSection
          generatorProvider={s.generatorProvider}
          selectedChatMode={s.selectedChatMode}
          onSelectProvider={s.setSelectedChatProvider}
          onSelectMode={s.setSelectedChatMode}
          highlightPersona={generatorHighlightPersona}
          apiKeys={s.apiKeys}
          getProviderStatus={s.getProviderStatus}
        />

        <AgentSection
          agentProvider={s.agentProvider}
          selectedAgentMode={s.selectedAgentMode}
          onSelectProvider={s.setSelectedAgentProvider}
          onSelectMode={s.setSelectedAgentMode}
          apiKeys={s.apiKeys}
          getProviderStatus={s.getProviderStatus}
          agentEnabled={s.agentEnabled}
          setAgentEnabled={s.setAgentEnabled}
        />

        <QualitySection
          qualityMode={s.qualityMode}
          limitInfo={s.limitInfo}
          onSetQuality={s.handleSetQuality}
        />

        <ApiKeysSection
          apiKeys={s.apiKeys}
          selectedProvider={s.selectedKeyProvider}
          setSelectedProvider={s.setSelectedKeyProvider}
          newKey={s.newKey}
          setNewKey={s.setNewKey}
          keys={s.allKeys}
          hasMultipleKeys={s.hasMultipleKeys}
          onAddKey={() => {
            void s.handleAddKey();
          }}
          onRemoveKey={(k) => {
            void s.handleRemoveKey(k);
          }}
          onRotateKey={() => {
            void s.handleRotateKey();
          }}
          onMoveKeyToFront={(k, idx) => {
            void s.handleMoveKeyToFront(k, idx);
          }}
        />

        <NotificationsSection
          isInitialized={s.isInitialized}
          hasPermissions={s.hasPermissions}
          requestPermissions={s.requestPermissions}
          pushToken={s.pushToken}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
