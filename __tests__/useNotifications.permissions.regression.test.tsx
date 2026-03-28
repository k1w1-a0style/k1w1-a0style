import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useNotifications } from "../hooks/useNotifications";

const mockInitialize = jest.fn();
const mockGetPushToken = jest.fn();

jest.mock("../lib/notificationService", () => ({
  __esModule: true,
  default: {
    initialize: (...args: any[]) => mockInitialize(...args),
    getPushToken: (...args: any[]) => mockGetPushToken(...args),
    sendLocalNotification: jest.fn(),
    notifyBuildSuccess: jest.fn(),
    notifyBuildFailure: jest.fn(),
    notifyBuildStarted: jest.fn(),
    clearAllNotifications: jest.fn(),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe("useNotifications requestPermissions state sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("synchronisiert pushToken/isInitialized/hasPermissions nach spaeterem Permission-Grant", async () => {
    mockInitialize.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockGetPushToken.mockReturnValueOnce(null).mockReturnValueOnce("ExponentPushToken[fresh]");

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });
    expect(result.current.hasPermissions).toBe(false);
    expect(result.current.pushToken).toBeNull();

    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(result.current.isInitialized).toBe(true);
    expect(result.current.hasPermissions).toBe(true);
    expect(result.current.pushToken).toBe("ExponentPushToken[fresh]");
  });

  it("setzt pushToken sauber auf null bei erneut verweigerter Permission", async () => {
    mockInitialize.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockGetPushToken
      .mockReturnValueOnce("ExponentPushToken[old]")
      .mockReturnValueOnce(null);

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.hasPermissions).toBe(true);
    });
    expect(result.current.pushToken).toBe("ExponentPushToken[old]");

    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(result.current.isInitialized).toBe(true);
    expect(result.current.hasPermissions).toBe(false);
    expect(result.current.pushToken).toBeNull();
  });
});
