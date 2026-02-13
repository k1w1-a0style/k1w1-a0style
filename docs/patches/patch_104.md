# Patch 104 — ChatScreen Hardening & UX/Perf

Datum: 2026-02-13

## Summary

Dieses Patch bündelt die wichtigsten Findings aus dem kritischen ChatScreen-Review und setzt sie als **low-risk Hardening** um:

- AI-Flow: Race/Stale-Closure-Fix via Refs (wichtig für AutoFix-Queue-Aufrufe über `processAIRequestRef.current`).
- AutoFix: Queue ist **bounded** (Default: 5) inkl. Drop-Warnung.
- Scroll: `hardScrollToBottom` ist debounced + **ein** Retry nach 150ms (Retry ohne Animation, Timer-Cleanup bei Unmount).
- ConfirmChangesModal: Summary ist scrollbar und wird ab **15.000** Zeichen gekürzt.
- UX: Confirm-Dialoge vor destruktiven Aktionen, `TouchableWithoutFeedback` Wrapper entfernt.
- Typ-Konsistenz: `MessageItem` nutzt zentralen `ChatMessage`-Typ.

## Files

- `hooks/useChatAIFlow.ts`
- `screens/ChatScreen/hooks/useChatScreen.ts`
- `screens/ChatScreen/index.tsx`
- `components/chat/ConfirmChangesModal.tsx`
- `components/ChatHeaderActions.tsx`
- `components/MessageItem.tsx`
- `components/chat/Chat*` (kleinere UX/Perf Anpassungen)
- Docs: `docs/TODO.md`, `docs/reviews/CHAT_SCREEN_VERIFICATION.md`, `PROJECT_CHECKLOG.md`

## Verification

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Manual smoke:
- Chat öffnen, lange Historie (50–200 Messages), schnell scrollen.
- Während Streaming/AI-Response zwischen Tabs wechseln und zurück.
- „Chat leeren“ / „Neues Projekt“ → Confirm/Cancel prüfen.
- ConfirmChangesModal öffnen: sehr lange Summary (>
  15k chars) → scrollbar + gekürzt.
