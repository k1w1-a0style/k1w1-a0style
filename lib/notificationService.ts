/**
 * notificationService.ts
 *
 * Service für Push-Benachrichtigungen nach Build-Events
 * Unterstützt lokale Notifications für Build-Status-Updates
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Notification Handler Configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  badge?: number;
}

class NotificationService {
  private permissionGranted: boolean = false;
  private expoPushToken: string | null = null;

  /**
   * Initialisiert den Notification Service
   * Fordert Permissions an (falls noch nicht gewährt)
   */
  async initialize(): Promise<boolean> {
    try {
      // Permissions prüfen und anfordern
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("⚠️ Notification permissions not granted");
        this.permissionGranted = false;
        return false;
      }

      this.permissionGranted = true;

      // Android-spezifische Channel-Konfiguration
      if (Platform?.OS === "android") {
        await Notifications.setNotificationChannelAsync("build-updates", {
          name: "Build Updates",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
          sound: "default",
        });
      }

      // Expo Push Token abrufen (für zukünftige Remote-Notifications)
      try {
        // ✅ FIX: projectId aus app.config.js laden
        const projectId =
          (Constants as any).expoConfig?.extra?.eas?.projectId ||
          (Constants as any).expoConfig?.owner ||
          "your-project-id"; // Fallback

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId as string,
        });
        this.expoPushToken = tokenData.data;
        console.log("📱 Expo Push Token:", this.expoPushToken);
      } catch (error) {
        console.warn("⚠️ Could not get Expo Push Token (Dev-Mode?):", error);
      }

      return true;
    } catch (error) {
      console.error("❌ Notification Service Initialization failed:", error);
      return false;
    }
  }

  /**
   * Sendet eine lokale Notification
   */
  async sendLocalNotification(
    options: NotificationOptions,
  ): Promise<string | null> {
    if (!this.permissionGranted) {
      console.warn("⚠️ Notifications not permitted, skipping...");
      return null;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          data: options.data || {},
          sound: options.sound !== false,
          badge: options.badge,
        },
        trigger: null, // Sofort senden
      });

      console.log("✅ Notification sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("❌ Failed to send notification:", error);
      return null;
    }
  }

  /**
   * Sendet Notification für erfolgreichen Build
   */
  async notifyBuildSuccess(
    buildId: string,
    platform: string = "Android",
  ): Promise<void> {
    await this.sendLocalNotification({
      title: "✅ Build Successful",
      body: `${platform} build completed successfully!`,
      data: { buildId, status: "success" },
      sound: true,
    });
  }

  /**
   * Sendet Notification für fehlgeschlagenen Build
   */
  async notifyBuildFailure(
    buildId: string,
    error: string,
    platform: string = "Android",
  ): Promise<void> {
    await this.sendLocalNotification({
      title: "❌ Build Failed",
      body: `${platform} build failed: ${error}`,
      data: { buildId, status: "failed", error },
      sound: true,
    });
  }

  /**
   * Sendet Notification für Build-Start
   */
  async notifyBuildStarted(
    buildId: string,
    platform: string = "Android",
  ): Promise<void> {
    await this.sendLocalNotification({
      title: "🚀 Build Started",
      body: `${platform} build has been queued...`,
      data: { buildId, status: "building" },
      sound: false,
    });
  }

  /**
   * Löscht alle Notifications
   */
  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
    console.log("🗑️ All notifications cleared");
  }
  /**
   * Gibt zurück, ob Permissions gewährt wurden
   */
  hasPermissions(): boolean {
    return this.permissionGranted;
  }

  /**
   * Gibt den Expo Push Token zurück (für Remote-Notifications)
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Listener für empfangene Notifications
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void,
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Listener für Notification-Taps
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void,
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

// Singleton Export
export const notificationService = new NotificationService();
export default notificationService;
