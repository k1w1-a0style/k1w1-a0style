import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { SegmentedTabs } from "../../../components/diagnostics/SegmentedTabs";
import { InlineToast } from "../../../components/diagnostics/InlineToast";

type TabKey = "overview" | "issues" | "fixes";

type HeaderStats = {
  name: string;
  mode: string;
};

type ToastState = {
  message: string | null;
  anim: any;
};

export function HeaderSection(props: {
  styles: any;
  headerStats: HeaderStats;
  busy: boolean;
  running: boolean;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  tabDefs: { key: TabKey; label: string }[];
  toast: ToastState;
}) {
  const { styles, headerStats, busy, running, tab, setTab, tabDefs, toast } =
    props;

  return (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Diagnostics</Text>
          <Text style={styles.subtitle}>
            {headerStats.name} • {headerStats.mode}
          </Text>
        </View>

        {busy ? (
          <View style={styles.busyPill}>
            <ActivityIndicator size="small" />
            <Text style={styles.busyText}>
              {running ? "Running…" : "Applying…"}
            </Text>
          </View>
        ) : null}
      </View>

      <SegmentedTabs value={tab} onChange={setTab} tabs={tabDefs} />

      <InlineToast message={toast.message} anim={toast.anim} />
    </>
  );
}
