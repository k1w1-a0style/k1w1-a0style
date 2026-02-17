import React from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";

import { styles } from "../../../styles/enhancedBuildScreenStyles";
import type { BuildProfile } from "../types";

export function RepoProfileSection({
  repoFullName,
  onChangeRepoFullName,
  branchName,
  onChangeBranchName,
  onSaveRepoBranch,
  buildProfile,
  onSelectBuildProfile,
  hasSetLinkedRepo,
  savingRepo,
  onSaveLinkedRepo,
}: {
  repoFullName: string;
  onChangeRepoFullName: (v: string) => void;
  branchName: string;
  onChangeBranchName: (v: string) => void;
  onSaveRepoBranch: () => void;
  buildProfile: BuildProfile;
  onSelectBuildProfile: (p: BuildProfile) => void;
  hasSetLinkedRepo: boolean;
  savingRepo: boolean;
  onSaveLinkedRepo: () => void;
}): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Repo & Profile</Text>

      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>GitHub Repo (owner/repo)</Text>
          <TextInput
            value={repoFullName}
            onChangeText={onChangeRepoFullName}
            placeholder="z.B. k1w1-pro-plus/k1w1-a0style"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={styles.inputLabel}>
            Branch (z.B. work, main, feature-x)
          </Text>
          <TextInput
            style={styles.input}
            value={branchName}
            onChangeText={onChangeBranchName}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="work"
            accessibilityLabel="Branch"
          />
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSaveRepoBranch}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>
              Repo/Branch speichern
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.profileRow}>
        {(["development", "preview", "production"] as const).map((p) => {
          const active = buildProfile === p;
          const emoji = p === "development" ? "" : p === "preview" ? "" : "";
          return (
            <TouchableOpacity
              key={p}
              style={[styles.profileBtn, active && styles.profileBtnActive]}
              onPress={() => onSelectBuildProfile(p)}
              activeOpacity={0.8}
              accessibilityLabel={`Build-Profile: ${p}`}
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.profileBtnText,
                  active && styles.profileBtnTextActive,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (!hasSetLinkedRepo ||
            repoFullName.trim().length === 0 ||
            savingRepo) &&
            styles.btnDisabled,
        ]}
        onPress={onSaveLinkedRepo}
        disabled={!hasSetLinkedRepo || repoFullName.trim().length === 0 || savingRepo}
        accessibilityLabel="Repo speichern"
      >
        {savingRepo ? (
          <ActivityIndicator color="#1a1a1a" />
        ) : (
          <Text style={styles.primaryBtnText}>💾 Repo speichern</Text>
        )}
      </TouchableOpacity>

      {!hasSetLinkedRepo && (
        <Text style={styles.warningText}>
          ⚠️ setLinkedRepo() ist nicht verfügbar – Repo wird nicht persistent gespeichert.
        </Text>
      )}
    </View>
  );
}
