import React, { useMemo, useState } from "react";
import {
  ScrollView,

  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

import { styles } from "./DiffPreview.styles";

export type DiffPreviewProps = {
  oldText?: string | null;
  newText?: string | null;
  maxLines?: number;
};

type DiffLine = { kind: "same" | "add" | "del"; text: string };

function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  // DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: a[i] });
      i++;
    } else {
      out.push({ kind: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", text: a[i++] });
  while (j < m) out.push({ kind: "add", text: b[j++] });
  return out;
}

export function DiffPreview({
  oldText,
  newText,
  maxLines = 1200,
}: DiffPreviewProps) {
  const [mode, setMode] = useState<"diff" | "split">("diff");
  const [onlyChanges, setOnlyChanges] = useState(false);

  const computed = useMemo(() => {
    const a = (oldText ?? "").split("\n");
    const b = (newText ?? "").split("\n");
    if (a.length > maxLines || b.length > maxLines) {
      // fallback: show truncated split
      return {
        kind: "fallback" as const,
        a: a.slice(0, maxLines).join("\n"),
        b: b.slice(0, maxLines).join("\n"),
        note: `Diff zu groß (>${maxLines} lines) – Vorschau gekürzt.`,
      };
    }
    const raw = lcsDiff(a, b);
    return { kind: "diff" as const, raw };
  }, [oldText, newText, maxLines]);

  const lines = useMemo(() => {
    if (computed.kind !== "diff") return [];
    if (!onlyChanges) return computed.raw;
    return computed.raw.filter((x) => x.kind !== "same");
  }, [computed, onlyChanges]);

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.tbtn, mode === "diff" && styles.tbtnOn]}
          onPress={() => setMode("diff")}
        >
          <Ionicons
            name="git-compare"
            size={14}
            color={theme.palette.text.primary}
          />
          <Text style={styles.tbtnText}>Diff</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tbtn, mode === "split" && styles.tbtnOn]}
          onPress={() => setMode("split")}
        >
          <Ionicons
            name="documents"
            size={14}
            color={theme.palette.text.primary}
          />
          <Text style={styles.tbtnText}>Before/After</Text>
        </TouchableOpacity>

        {mode === "diff" ? (
          <TouchableOpacity
            style={[styles.tbtn, onlyChanges && styles.tbtnOn]}
            onPress={() => setOnlyChanges((p) => !p)}
          >
            <Ionicons
              name="filter"
              size={14}
              color={theme.palette.text.primary}
            />
            <Text style={styles.tbtnText}>Nur Änderungen</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {computed.kind === "fallback" ? (
        <View style={styles.fallback}>
          <Text style={styles.note}>{computed.note}</Text>
          <View style={styles.split}>
            <ScrollView style={styles.pane}>
              <Text style={styles.mono}>{computed.a}</Text>
            </ScrollView>
            <ScrollView style={styles.pane}>
              <Text style={styles.mono}>{computed.b}</Text>
            </ScrollView>
          </View>
        </View>
      ) : mode === "split" ? (
        <View style={styles.split}>
          <ScrollView style={styles.pane}>
            <Text style={styles.label}>Before</Text>
            <Text style={styles.mono}>{oldText ?? ""}</Text>
          </ScrollView>
          <ScrollView style={styles.pane}>
            <Text style={styles.label}>After</Text>
            <Text style={styles.mono}>{newText ?? ""}</Text>
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.diff}>
          {lines.map((l, idx) => (
            <Text
              key={idx}
              style={[
                styles.line,
                l.kind === "add" && styles.add,
                l.kind === "del" && styles.del,
                l.kind === "same" && styles.same,
              ]}
            >
              {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}
              {l.text}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

