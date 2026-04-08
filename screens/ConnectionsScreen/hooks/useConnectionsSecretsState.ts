import { useState } from "react";

export function useConnectionsSecretsState() {
  const [githubToken, setGithubToken] = useState("");
  const [expoToken, setExpoToken] = useState("");
  const [workflowAdminKey, setWorkflowAdminKey] = useState("");
  const [androidKeystoreExportAdminKey, setAndroidKeystoreExportAdminKey] = useState("");

  const [showGitHub, setShowGitHub] = useState(false);
  const [showExpo, setShowExpo] = useState(false);
  const [showWorkflowAdmin, setShowWorkflowAdmin] = useState(false);
  const [showKeystoreAdmin, setShowKeystoreAdmin] = useState(false);
  const [showSupabaseAnon, setShowSupabaseAnon] = useState(false);

  const [supabaseRaw, setSupabaseRaw] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");

  const [easProjectId, setEasProjectId] = useState("");

  return {
    githubToken,
    setGithubToken,
    expoToken,
    setExpoToken,
    workflowAdminKey,
    setWorkflowAdminKey,
    androidKeystoreExportAdminKey,
    setAndroidKeystoreExportAdminKey,
    showGitHub,
    setShowGitHub,
    showExpo,
    setShowExpo,
    showWorkflowAdmin,
    setShowWorkflowAdmin,
    showKeystoreAdmin,
    setShowKeystoreAdmin,
    showSupabaseAnon,
    setShowSupabaseAnon,
    supabaseRaw,
    setSupabaseRaw,
    supabaseUrl,
    setSupabaseUrl,
    supabaseAnonKey,
    setSupabaseAnonKey,
    easProjectId,
    setEasProjectId,
  };
}
