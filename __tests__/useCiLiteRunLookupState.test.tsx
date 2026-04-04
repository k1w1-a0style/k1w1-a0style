import { act, renderHook } from "@testing-library/react-native";

import { useCiLiteRunLookupState } from "../components/CiLiteHeaderButton/hooks/useCiLiteRunLookupState";

describe("useCiLiteRunLookupState", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("toggles locatingRun and invalidates old generations when stopping", () => {
    const { result } = renderHook(() => useCiLiteRunLookupState());

    let generation = -1;
    act(() => {
      generation = result.current.startRunLookup();
    });

    expect(result.current.locatingRun).toBe(true);
    expect(result.current.isLookupGenerationActive(generation)).toBe(true);

    act(() => {
      result.current.stopRunLookup();
    });

    expect(result.current.locatingRun).toBe(false);
    expect(result.current.isLookupGenerationActive(generation)).toBe(false);
  });

  it("schedules polling only for the active generation", async () => {
    const { result } = renderHook(() => useCiLiteRunLookupState());

    let generation = -1;
    act(() => {
      generation = result.current.startRunLookup();
    });

    const poll = jest.fn(async () => true);

    act(() => {
      result.current.scheduleLookupPoll({ generation, attempt: 0, poll });
    });

    await act(async () => {
      jest.advanceTimersByTime(1300);
      await Promise.resolve();
    });

    expect(poll).toHaveBeenCalledTimes(1);

    const stalePoll = jest.fn(async () => true);
    act(() => {
      result.current.stopPolling();
      result.current.scheduleLookupPoll({ generation, attempt: 0, poll: stalePoll });
    });

    await act(async () => {
      jest.advanceTimersByTime(1300);
      await Promise.resolve();
    });

    expect(stalePoll).toHaveBeenCalledTimes(0);
  });
});
