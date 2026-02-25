import { useEffect, useState } from "react";

import type { DebugEntry } from "../lib/debugOverlay";
import { getDebugEntries, subscribeDebugEntries } from "../lib/debugOverlay";

export function useDebugEntries(): DebugEntry[] {
  const [items, setItems] = useState<DebugEntry[]>(() => getDebugEntries());

  useEffect(() => {
    return subscribeDebugEntries(setItems);
  }, []);

  return items;
}
