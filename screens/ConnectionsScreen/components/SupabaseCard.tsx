import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import { ActionButton } from "./ActionButton";
import { InputRow } from "./InputRow";

export function SupabaseCard(props: {
  styles: any;
  busy: boolean;
  supabaseRaw: string;
  onChangeSupabaseRaw: (v: string) => void;
  supabaseUrl: string;
  onChangeSupabaseUrl: (v: string) => void;
  supabaseAnonKey: string;
  onChangeSupabaseAnonKey: (v: string) => void;
  supabaseServiceRoleKey: string;
  onChangeSupabaseServiceRoleKey: (v: string) => void;
  onSave: () => void;
  onTestSupabase: () => void;
}) {
  const {
    styles,
    busy,
    supabaseRaw,
    onChangeSupabaseRaw,
    supabaseUrl,
    onChangeSupabaseUrl,
    supabaseAnonKey,
    onChangeSupabaseAnonKey,
    supabaseServiceRoleKey,
    onChangeSupabaseServiceRoleKey,
    onSave,
    onTestSupabase,
  } = props;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons
          name="server-outline"
          size={18}
          color={theme.palette.primary}
        />
        <Text style={styles.cardTitle}>Supabase</Text>
      </View>

      <InputRow
        styles={styles}
        label="Supabase Project ID oder URL"
        value={supabaseRaw}
        onChangeText={onChangeSupabaseRaw}
        placeholder="xfgnzpcljsuqqdjlxgul  oder  https://xxxxx.supabase.co"
      />

      <InputRow
        styles={styles}
        label="Supabase URL (auto)"
        value={supabaseUrl}
        onChangeText={onChangeSupabaseUrl}
        placeholder="https://xxxxx.supabase.co"
      />

      <InputRow
        styles={styles}
        label="Supabase ANON Key"
        value={supabaseAnonKey}
        onChangeText={onChangeSupabaseAnonKey}
        placeholder="eyJhbGciOi..."
        secure
        showToggle={false}
      />

      <InputRow
        styles={styles}
        label="Supabase Service Role Key (für Edge/Build-Jobs)"
        value={supabaseServiceRoleKey}
        onChangeText={onChangeSupabaseServiceRoleKey}
        placeholder="eyJhbGciOi... (service role)"
        secure
        showToggle={false}
      />

      <View style={styles.row}>
        <ActionButton
          styles={styles}
          busy={busy}
          label="Speichern"
          icon="save-outline"
          onPress={onSave}
        />
        <ActionButton
          styles={styles}
          busy={busy}
          label="Supabase testen"
          icon="pulse-outline"
          variant="ghost"
          onPress={onTestSupabase}
        />
      </View>
    </View>
  );
}
