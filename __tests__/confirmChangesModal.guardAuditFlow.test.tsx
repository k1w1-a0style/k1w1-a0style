import React from "react";
import { render } from "@testing-library/react-native";

import ConfirmChangesModal from "../components/chat/ConfirmChangesModal";
import type { PendingChange } from "../hooks/chatAIFlowTypes";
import { recordGuardAuditEvent } from "../lib/guardAuditTelemetry";

jest.mock("../lib/guardAuditTelemetry", () => ({
  recordGuardAuditEvent: jest.fn(() => Promise.resolve()),
}));

function makePendingChange(errors: string[]): PendingChange {
  return {
    files: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
    proposedFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
    baseProjectDigest: "digest",
    summary: "summary",
    created: [],
    updated: [],
    skipped: [],
    errors,
    aiResponse: { ok: true, provider: "openai" },
    changePreviews: [],
    finalFileSource: "builder",
    validatorState: "builder-fallback-error",
    sourceSummary: "builder",
  };
}

describe("ConfirmChangesModal guard audit flow", () => {
  const recordGuardAuditEventMock = recordGuardAuditEvent as jest.MockedFunction<typeof recordGuardAuditEvent>;

  beforeEach(() => {
    recordGuardAuditEventMock.mockClear();
  });

  it("records guard audit once per unchanged visible state and resets on close", () => {
    const guarded = makePendingChange([
      "package.json bleibt geblockt: kritischer/manual-only Pfad",
      "baseline file ist read-only",
    ]);

    const { rerender } = render(
      <ConfirmChangesModal visible pendingChange={guarded} onAccept={jest.fn()} onReject={jest.fn()} />,
    );

    expect(recordGuardAuditEventMock).toHaveBeenCalledTimes(1);

    rerender(
      <ConfirmChangesModal visible pendingChange={guarded} onAccept={jest.fn()} onReject={jest.fn()} />,
    );
    expect(recordGuardAuditEventMock).toHaveBeenCalledTimes(1);

    const reordered = makePendingChange([
      "BASELINE file ist read-only",
      "package.json bleibt geblockt: kritischer/manual-only Pfad",
      "package.json bleibt geblockt: kritischer/manual-only Pfad",
    ]);
    rerender(
      <ConfirmChangesModal visible pendingChange={reordered} onAccept={jest.fn()} onReject={jest.fn()} />,
    );
    expect(recordGuardAuditEventMock).toHaveBeenCalledTimes(1);

    rerender(
      <ConfirmChangesModal visible={false} pendingChange={guarded} onAccept={jest.fn()} onReject={jest.fn()} />,
    );
    rerender(
      <ConfirmChangesModal visible pendingChange={guarded} onAccept={jest.fn()} onReject={jest.fn()} />,
    );

    expect(recordGuardAuditEventMock).toHaveBeenCalledTimes(2);
  });
});
