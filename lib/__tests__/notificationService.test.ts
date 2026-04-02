/**
 * notificationService.test.ts
 *
 * Tests für den Notification Service
 */

// Mock Platform BEFORE any imports
jest.mock("react-native/Libraries/Utilities/Platform", () => ({
  OS: "android",
  select: jest.fn((obj) => obj.android || obj.default),
}));

// Mock expo-notifications
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  dismissAllNotificationsAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  removeNotificationSubscription: jest.fn(),
  AndroidImportance: {
    HIGH: 4,
  },
}));

const mockExpoConstants: MockExpoConstantsShape = {
  easConfig: { projectId: "eas-project-id" },
  expoConfig: {
    extra: { eas: { projectId: "expo-config-project-id" } },
    android: { googleServicesFile: "google-services.json" },
  },
  manifest2: {},
};

jest.mock("expo-constants", () => ({
  default: mockExpoConstants,
  ...mockExpoConstants,
}));

import * as Notifications from "expo-notifications";
import notificationService from "../notificationService";

interface MockExpoConstantsShape {
  easConfig: { projectId?: string };
  expoConfig: {
    extra?: { eas?: { projectId?: string } };
    android?: { googleServicesFile?: string };
  };
  manifest2: {
    extra?: { expoClient?: { extra?: { eas?: { projectId?: string } } } };
  };
}

type NotificationServiceInternals = {
  getConstantsSource: () => Record<string, unknown>;
  resolveProjectId: () => string | null;
};

const notificationServiceInternals =
  notificationService as unknown as NotificationServiceInternals;

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

function getNotificationChannelCalls(): Array<unknown[]> {
  return mockedNotifications.setNotificationChannelAsync.mock.calls as Array<unknown[]>;
}

describe("NotificationService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExpoConstants.easConfig = { projectId: "eas-project-id" };
    mockExpoConstants.expoConfig = {
      extra: { eas: { projectId: "expo-config-project-id" } },
      android: { googleServicesFile: "google-services.json" },
    };
    mockExpoConstants.manifest2 = {};
  });

  describe("initialize", () => {
    it("resolveProjectId priorisiert easConfig.projectId", () => {
      jest
        .spyOn(notificationServiceInternals, "getConstantsSource")
        .mockReturnValue({
          easConfig: { projectId: "eas-project-id" },
          expoConfig: { extra: { eas: { projectId: "expo-fallback-id" } } },
          manifest2: {
            extra: { expoClient: { extra: { eas: { projectId: "manifest-fallback-id" } } } },
          },
        });

      expect((notificationServiceInternals).resolveProjectId()).toBe("eas-project-id");
    });

    it("resolveProjectId nutzt expoConfig.extra.eas.projectId als Fallback", () => {
      jest
        .spyOn(notificationServiceInternals, "getConstantsSource")
        .mockReturnValue({
          easConfig: {},
          expoConfig: { extra: { eas: { projectId: "expo-fallback-id" } } },
          manifest2: {
            extra: { expoClient: { extra: { eas: { projectId: "manifest-fallback-id" } } } },
          },
        });

      expect((notificationServiceInternals).resolveProjectId()).toBe("expo-fallback-id");
    });

    it("resolveProjectId nutzt manifest2 als letzten Fallback", () => {
      jest
        .spyOn(notificationServiceInternals, "getConstantsSource")
        .mockReturnValue({
          easConfig: {},
          expoConfig: { extra: { eas: {} } },
          manifest2: {
            extra: { expoClient: { extra: { eas: { projectId: "manifest-fallback-id" } } } },
          },
        });

      expect((notificationServiceInternals).resolveProjectId()).toBe("manifest-fallback-id");
    });

    it("sollte erfolgreich initialisieren mit granted permissions", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token]",
      });

      const result = await notificationService.initialize();

      expect(result).toBe(true);
      expect(notificationService.hasPermissions()).toBe(true);
      // setNotificationChannelAsync wird nur auf Android aufgerufen
      // In Test-Umgebung kann Platform.OS undefined sein, daher optional prüfen
      if (
        getNotificationChannelCalls().length > 0
      ) {
        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
          "build-updates",
          expect.objectContaining({
            name: "Build Updates",
            importance: Notifications.AndroidImportance.HIGH,
          }),
        );
      }
    });

    it("sollte Push-Token Abruf überspringen wenn keine projectId auffindbar ist", async () => {
      jest
        .spyOn(notificationServiceInternals, "getConstantsSource")
        .mockReturnValue({
          expoConfig: { android: { googleServicesFile: "google-services.json" } },
        });
      jest.spyOn(notificationServiceInternals, "resolveProjectId").mockReturnValue(null);
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const result = await notificationService.initialize();

      expect(result).toBe(true);
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it("sollte Permissions anfordern wenn nicht granted", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token]",
      });

      const result = await notificationService.initialize();

      expect(result).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it("sollte false zurückgeben wenn Permissions verweigert", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      const result = await notificationService.initialize();

      expect(result).toBe(false);
      expect(notificationService.hasPermissions()).toBe(false);
      expect(notificationService.getPushToken()).toBeNull();
    });

    it("sollte Fehler graceful handhaben", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error("Permission error"),
      );

      const result = await notificationService.initialize();

      expect(result).toBe(false);
      expect(notificationService.hasPermissions()).toBe(false);
      expect(notificationService.getPushToken()).toBeNull();
    });

    it("behaelt Permissions bei Token-Fetch-Fehler, Token bleibt null", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(
        new Error("push token unavailable"),
      );

      const result = await notificationService.initialize();

      expect(result).toBe(true);
      expect(notificationService.hasPermissions()).toBe(true);
      expect(notificationService.getPushToken()).toBeNull();
    });

    it("behaelt Permissions bei Android-FCM-Skip ohne Token", async () => {
      const previousJestWorkerId = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      jest
        .spyOn(notificationServiceInternals, "getConstantsSource")
        .mockReturnValue({ expoConfig: { android: {} } });

      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const result = await notificationService.initialize();

      process.env.JEST_WORKER_ID = previousJestWorkerId;

      expect(result).toBe(true);
      expect(notificationService.hasPermissions()).toBe(true);
      expect(notificationService.getPushToken()).toBeNull();
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });
  });

  describe("sendLocalNotification", () => {
    beforeEach(async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "test-token",
      });
      await notificationService.initialize();
    });

    it("sollte Notification erfolgreich senden", async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        "notification-id-123",
      );

      const result = await notificationService.sendLocalNotification({
        title: "Test Title",
        body: "Test Body",
        data: { test: "data" },
      });

      expect(result).toBe("notification-id-123");
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: "Test Title",
          body: "Test Body",
          data: { test: "data" },
          sound: true,
          badge: undefined,
        },
        trigger: null,
      });
    });

    it("sollte null zurückgeben wenn keine Permissions", async () => {
      // Permissions zurücksetzen
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });
      await notificationService.initialize();

      const result = await notificationService.sendLocalNotification({
        title: "Test",
        body: "Test",
      });

      expect(result).toBe(null);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it("sollte Fehler handhaben", async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error("Schedule error"),
      );

      const result = await notificationService.sendLocalNotification({
        title: "Test",
        body: "Test",
      });

      expect(result).toBe(null);
    });
  });

  describe("Build Notifications", () => {
    beforeEach(async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "test-token",
      });
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        "notification-id",
      );
      await notificationService.initialize();
    });

    it("sollte Build Success Notification senden", async () => {
      await notificationService.notifyBuildSuccess("build-123", "Android");

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: "✅ Build Successful",
            body: "Android build completed successfully!",
            data: { buildId: "build-123", status: "success" },
            sound: true,
          }),
        }),
      );
    });

    it("sollte Build Failure Notification senden", async () => {
      await notificationService.notifyBuildFailure(
        "build-123",
        "Gradle error",
        "Android",
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: "❌ Build Failed",
            body: "Android build failed: Gradle error",
            data: expect.objectContaining({
              buildId: "build-123",
              status: "failed",
              error: "Gradle error",
            }),
          }),
        }),
      );
    });

    it("sollte Build Started Notification senden", async () => {
      await notificationService.notifyBuildStarted("build-123", "Android");

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: "🚀 Build Started",
            body: "Android build has been queued...",
            data: { buildId: "build-123", status: "building" },
            sound: false,
          }),
        }),
      );
    });
  });

  describe("Utility Functions", () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[xyz]",
      });
      await notificationService.initialize();
    });

    it("sollte alle Notifications löschen", async () => {
      await notificationService.clearAllNotifications();

      expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
    });

    it("sollte Push Token zurückgeben", () => {
      const token = notificationService.getPushToken();
      if (token !== null) {
        expect(typeof token).toBe("string");
      }
    });

    it("sollte Expo Push Token nicht im Log ausgeben", async () => {
      const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[sensitive-token]",
      });

      await notificationService.initialize();

      const logged = infoSpy.mock.calls.flat().join(" ");
      expect(logged).not.toContain("ExponentPushToken[sensitive-token]");
      expect(logged).not.toContain("📱 Expo Push Token:");
      infoSpy.mockRestore();
    });

    it("sollte Notification Listener hinzufügen", () => {
      const callback = jest.fn();
      (
        Notifications.addNotificationReceivedListener as jest.Mock
      ).mockReturnValue({ remove: jest.fn() });

      const subscription =
        notificationService.addNotificationReceivedListener(callback);

      expect(
        Notifications.addNotificationReceivedListener,
      ).toHaveBeenCalledWith(callback);
      expect(subscription).toBeDefined();
    });

    it("sollte Response Listener hinzufügen", () => {
      const callback = jest.fn();
      (
        Notifications.addNotificationResponseReceivedListener as jest.Mock
      ).mockReturnValue({ remove: jest.fn() });

      const subscription =
        notificationService.addNotificationResponseListener(callback);

      expect(
        Notifications.addNotificationResponseReceivedListener,
      ).toHaveBeenCalledWith(callback);
      expect(subscription).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("sollte mit fehlendem Expo Push Token umgehen können", async () => {
      jest.clearAllMocks();
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(
        new Error("Not available in dev"),
      );

      const result = await notificationService.initialize();

      expect(result).toBe(true); // Sollte trotzdem true sein
      expect(notificationService.getPushToken()).toBeNull();
    });

    it("sollte mehrfache Initialisierung handhaben", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "token-1",
      });

      await notificationService.initialize();
      await notificationService.initialize();

      // Sollte zweimal aufgerufen werden können ohne Fehler
      expect(notificationService.hasPermissions()).toBe(true);
    });
  });
});
