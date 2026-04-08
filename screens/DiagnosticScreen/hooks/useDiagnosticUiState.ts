import { useCallback, useState } from "react";
import { LayoutAnimation } from "react-native";
import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";
import type { TabKey } from "../../../components/diagnostics/SegmentedTabs";

export function useDiagnosticUiState() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedFixesOpen, setAdvancedFixesOpen] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [issueSheetVisible, setIssueSheetVisible] = useState(false);
  const [activeIssue, setActiveIssue] = useState<PreflightCheckResult | null>(null);

  const toggleAdvanced = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((v) => !v);
  }, []);

  const toggleAdvancedFixes = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedFixesOpen((v) => !v);
  }, []);

  return {
    tab,
    setTab,
    advancedOpen,
    advancedFixesOpen,
    toggleAdvanced,
    toggleAdvancedFixes,
    reportVisible,
    setReportVisible,
    issueSheetVisible,
    setIssueSheetVisible,
    activeIssue,
    setActiveIssue,
  };
}
