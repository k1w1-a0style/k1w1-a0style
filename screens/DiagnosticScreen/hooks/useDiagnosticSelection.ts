import { useCallback, useMemo, useState } from "react";

export type SelectedMap = Record<string, boolean>;

/**
 * Keeps selection state and helpers separate from the main DiagnosticScreen hook.
 *
 * External shape stays a plain object map (Record<string, boolean>) because other
 * parts of the app rely on it.
 */
export function useDiagnosticSelection(initial: SelectedMap = {}) {
  const [selected, setSelected] = useState<SelectedMap>(initial);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const clearSelection = useCallback(() => {
    setSelected({});
  }, []);

  const toggleSelectedId = useCallback((id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setSelectedIds = useCallback((ids: string[], value: boolean = true) => {
    setSelected((prev) => {
      const next: SelectedMap = { ...prev };
      for (const id of ids) {
        if (value) next[id] = true;
        else delete next[id];
      }
      return next;
    });
  }, []);

  return {
    selected,
    setSelected,
    selectedCount,
    clearSelection,
    toggleSelectedId,
    setSelectedIds,
  };
}
