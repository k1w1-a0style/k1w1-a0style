import { useEffect } from "react";

import type { BuildProfile } from "../types";

export function useMountedFlag(ref: { current: boolean }) {
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, [ref]);
}

export function useBuildProfileSync(params: {
  preferredBuildProfile: BuildProfile | null | undefined;
  setBuildProfile: (profile: BuildProfile) => void;
}) {
  const { preferredBuildProfile, setBuildProfile } = params;
  useEffect(() => {
    const p = preferredBuildProfile;
    if (p === "development" || p === "preview" || p === "production") {
      setBuildProfile(p);
    }
  }, [preferredBuildProfile, setBuildProfile]);
}

export function useModeFilterSync(params: {
  buildProfile: BuildProfile;
  setActionsFilter: (updater: (prev: BuildProfile | "all") => BuildProfile | "all") => void;
  setHistoryFilter: (updater: (prev: BuildProfile | "all") => BuildProfile | "all") => void;
}) {
  const { buildProfile, setActionsFilter, setHistoryFilter } = params;
  useEffect(() => {
    setActionsFilter((prev) => (prev === "all" ? prev : buildProfile));
    setHistoryFilter((prev) => (prev === "all" ? prev : buildProfile));
  }, [buildProfile, setActionsFilter, setHistoryFilter]);
}
