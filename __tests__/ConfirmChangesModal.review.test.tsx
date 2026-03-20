import React from "react";
import { render } from "@testing-library/react-native";

import ConfirmChangesModal from "../components/chat/ConfirmChangesModal";
import { buildChangePreviews } from "../lib/changePreview";
import type { PendingChange } from "../hooks/chatAIFlowTypes";

function buildPendingChange(overrides: Partial<PendingChange> = {}): PendingChange {
  const finalFiles = [
    { path: "components/NewBadge.tsx", content: "export const NewBadge = () => <Text>Neu</Text>;" },
    { path: "App.tsx", content: "export default function App() { return <Text>After</Text>; }" },
  ];

  return {
    files: finalFiles,
    proposedFiles: finalFiles,
    baseProjectDigest: "digest",
    summary: "Zusammenfassung",
    created: ["components/NewBadge.tsx"],
    updated: ["App.tsx"],
    skipped: [],
    errors: ["styles/theme.ts wurde bewusst nicht angefasst"],
    aiResponse: { ok: true, provider: "openai" } as any,
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
    const { getAllByText, getByText } = render(
      <ConfirmChangesModal
        visible
        pendingChange={pendingChange}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
    );

    expect(getByText("Neue Datei")).toBeTruthy();
    expect(getByText("Vorschau")).toBeTruthy();
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

    expect(getByText("Kompakter Diff-Ausschnitt")).toBeTruthy();
    expect(getByText(/- export default function App\(\) \{ return <Text>Before<\/Text>; \}/)).toBeTruthy();
    expect(getByText(/\+ export default function App\(\) \{ return <Text>After<\/Text>; \}/)).toBeTruthy();
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
    expect(getByText(/styles\/theme.ts wurde bewusst nicht angefasst/)).toBeTruthy();
  });
});
