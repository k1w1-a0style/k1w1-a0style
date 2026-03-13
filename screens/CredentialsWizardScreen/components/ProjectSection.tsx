import React from "react";

import { SectionCard } from "../../../components/diagnostics/SectionCard";

import { Chip, KeyValue } from "./ui";

export function ProjectSection({
  repoFullName,
  branch,
  supabaseUrl,
}: {
  repoFullName: string;
  branch: string;
  supabaseUrl: string;
}) {
  return (
    <SectionCard
      title="Project"
      subtitle="Aktive Projektauswahl (SoT) + gespeicherter Supabase-Client"
      icon="cube-outline"
      right={<Chip label={repoFullName ? "Linked" : "Not linked"} tone={repoFullName ? "success" : "muted"} />}
    >
      <KeyValue label="Aktives Repo" value={repoFullName || "—"} />
      <KeyValue label="Aktiver Branch" value={branch || "—"} />
      <KeyValue
        label="Supabase URL (gespeichert)"
        value={supabaseUrl ? supabaseUrl.replace(/https:\/\//, "") : "—"}
      />
    </SectionCard>
  );
}
