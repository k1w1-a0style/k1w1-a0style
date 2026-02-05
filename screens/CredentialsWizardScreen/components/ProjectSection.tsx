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
      subtitle="Source of truth: linked repo + Supabase client"
      icon="cube-outline"
      right={<Chip label={repoFullName ? "Linked" : "Not linked"} tone={repoFullName ? "success" : "muted"} />}
    >
      <KeyValue label="Repo" value={repoFullName || "—"} />
      <KeyValue label="Branch" value={branch || "—"} />
      <KeyValue label="Supabase" value={supabaseUrl ? supabaseUrl.replace(/https:\/\//, "") : "—"} />
    </SectionCard>
  );
}
