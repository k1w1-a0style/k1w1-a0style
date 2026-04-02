import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import ConfirmChangesModal from "../components/chat/ConfirmChangesModal";
import { buildChangePreviews } from "../lib/changePreview";
import type { PendingChange } from "../hooks/chatAIFlowTypes";
import type { OrchestratorResult } from "../lib/orchestrator";

function buildPendingChange(overrides: Partial<PendingChange> = {}): PendingChange {
  const finalFiles = [
    { path: "components/NewBadge.tsx", content: "export const NewBadge = () => <Text>Neu</Text>;" },
    { path: "App.tsx", content: "export default function App() { return <Text>After</Text>; }" },
  ];

  const aiResponse: OrchestratorResult = { ok: true, provider: "openai" };

  return {
    files: finalFiles,
    proposedFiles: finalFiles,
    baseProjectDigest: "digest",
    summary: "Zusammenfassung",
    created: ["components/NewBadge.tsx"],
    updated: ["App.tsx"],
    skipped: [],
    errors: ["styles/theme.ts wurde bewusst nicht angefasst"],
    aiResponse,
    changePreviews: buildChangePreviews({
      baseFiles: [{ path: "App.tsx", content: "export default function App() { return <Text>Before</Text>; }" }],
      finalFiles,
      created: ["components/NewBadge.tsx"],
      updated: ["App.tsx"],
    }),
    finalFileSource: "builder",
    validatorState: "builder-fallback-error",
    sourceSummary:
      "Finale Dateiliste stammt direkt vom Builder; der Validator war nur advisory und hat diesmal nicht übernommen.",
    ...overrides,
  };
}

describe("ConfirmChangesModal review UX", () => {
  it("shows a compact preview for new files", () => {
    const pendingChange = buildPendingChange();
    const { getByText } = render(
      <ConfirmChangesModal
        visible
        pendingChange={pendingChange}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
    );

    expect(getByText("Neue Datei")).toBeTruthy();
    expect(getByText("Neue Datei · kompakte Inhaltsvorschau")).toBeTruthy();
    expect(getByText(/export const NewBadge/)).toBeTruthy();
  });

  it("shows compact diff snippets for changed files", () => {
    const pendingChange = buildPendingChange();
    const { getByText } = render(
      <ConfirmChangesModal
        visible
        pendingChange={pendingChange}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
    );

    expect(getByText("Delta · kompakter Diff-Ausschnitt")).toBeTruthy();
    expect(getByText(/- export default function App\(\) \{ return <Text>Before<\/Text>; \}/)).toBeTruthy();
    expect(getByText(/\+ export default function App\(\) \{ return <Text>After<\/Text>; \}/)).toBeTruthy();
    expect(getByText("Vorher")).toBeTruthy();
    expect(getByText("Nachher")).toBeTruthy();
  });

  it("makes builder vs validator provenance explicit and advisory", () => {
    const pendingChange = buildPendingChange({
      finalFileSource: "validator",
      validatorState: "validated",
      sourceSummary:
        "Finale Dateiliste stammt aus dem Validator-Review (advisory Nachschärfer auf Builder-Basis).",
    });

    const { getAllByText, getByText } = render(
      <ConfirmChangesModal
        visible
        pendingChange={pendingChange}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
    );

    expect(getAllByText(/Validator-Review/).length).toBeGreaterThan(0);
    expect(getByText(/advisory Nachschärfer/)).toBeTruthy();
    expect(getByText(/Finale Liste kommt aus dem Validator-Review/)).toBeTruthy();
    expect(getByText(/styles\/theme.ts wurde bewusst nicht angefasst/)).toBeTruthy();
  });

  it("shows skipped and blocked hints outside the long summary text", () => {
    const pendingChange = buildPendingChange({
      skipped: ["package.json"],
      errors: [
        "package.json bleibt geblockt: kritischer/manual-only Pfad",
        "styles/theme.ts wurde bewusst nicht angefasst",
      ],
    });

    const { getAllByText, getByText, queryByText } = render(
      <ConfirmChangesModal
        visible
        pendingChange={pendingChange}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
    );

    expect(getAllByText("Übersprungen").length).toBeGreaterThan(0);
    expect(getAllByText("package.json").length).toBeGreaterThan(0);
    expect(getByText(/kritischer\/manual-only Pfad/)).toBeTruthy();
    expect(queryByText("Noch keine Änderungen zum Bestätigen.")).toBeNull();
  });

  it("keeps the existing accept/reject flow intact", () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const pendingChange = buildPendingChange();
    const { getByLabelText } = render(
      <ConfirmChangesModal
        visible
        pendingChange={pendingChange}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    fireEvent.press(getByLabelText("Änderungen bestätigen und anwenden"));
    fireEvent.press(getByLabelText("Änderungen ablehnen"));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
