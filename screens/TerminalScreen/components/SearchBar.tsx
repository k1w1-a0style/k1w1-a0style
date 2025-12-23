import React from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type Props = {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onCopyVisibleLogs: () => void;
};

export default function SearchBar({
  searchQuery,
  setSearchQuery,
  onCopyVisibleLogs,
}: Props) {
  return (
    <View style={styles.searchRow}>
      <Ionicons name="search" size={18} color={theme.palette.text.secondary} />
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Suche in Logs..."
        placeholderTextColor={theme.palette.text.secondary}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!!searchQuery && (
        <TouchableOpacity
          onPress={() => setSearchQuery("")}
          style={styles.headerBtn}
        >
          <Ionicons
            name="close-circle"
            size={18}
            color={theme.palette.text.secondary}
          />
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onCopyVisibleLogs} style={styles.headerBtn}>
        <Ionicons
          name="copy-outline"
          size={18}
          color={theme.palette.text.secondary}
        />
      </TouchableOpacity>
    </View>
  );
}
