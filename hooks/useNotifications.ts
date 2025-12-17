/**
 * useNotifications.ts
 * 
 * React Hook für Push-Benachrichtigungen
 * Verwaltet Lifecycle und Event-Listener
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import notificationService, { NotificationOptions } from '../lib/notificationService';

export interface UseNotificationsReturn {
  isInitialized: boolean;
  hasPermissions: boolean;
  pushToken: string | null;
  lastNotification: Notifications.Notification | null;
  sendNotification: (options: NotificationOptions) => Promise<string | null>;
  notifyBuildSuccess: (buildId: string, platform?: string) => Promise<void>;
  notifyBuildFailure: (buildId: string, error: string, platform?: string) => Promise<void>;
  notifyBuildStarted: (buildId: string, platform?: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

export function useNotifications(): UseNotificationsReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Initialisierung beim Mount
  useEffect(() => {
    const initializeNotifications = async () => {
      const success = await notificationService.initialize();
      setIsInitialized(true);
      setHasPermissions(success);
      if (success) {
        setPushToken(notificationService.getPushToken());
      }
    };

    initializeNotifications();

    // Event Listeners registrieren
    notificationListener.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('📬 Notification received:', notification);
        setLastNotification(notification);
      }
    );

    responseListener.current = notificationService.addNotificationResponseListener(
      (response) => {
        console.log('👆 Notification tapped:', response);
        // Hier könnte Navigation zu BuildScreen erfolgen
        const buildId = response.notification.request.content.data?.buildId;
        if (buildId) {
          console.log('📱 Navigate to build:', buildId);
        }
      }
    );

    // Cleanup
    return () => {
      if (notificationListener.current) {
        notificationListener.current?.remove();
      }
      if (responseListener.current) {
        responseListener.current?.remove();
      }
    };
  }, []);

  // Wrapper-Funktionen
  const sendNotification = useCallback(
    async (options: NotificationOptions) => {
      return await notificationService.sendLocalNotification(options);
    },
    []
  );

  const notifyBuildSuccess = useCallback(
    async (buildId: string, platform: string = 'Android') => {
      return await notificationService.notifyBuildSuccess(buildId, platform);
    },
    []
  );

  const notifyBuildFailure = useCallback(
    async (buildId: string, error: string, platform: string = 'Android') => {
      return await notificationService.notifyBuildFailure(buildId, error, platform);
    },
    []
  );

  const notifyBuildStarted = useCallback(
    async (buildId: string, platform: string = 'Android') => {
      return await notificationService.notifyBuildStarted(buildId, platform);
    },
    []
  );

  const clearAllNotifications = useCallback(async () => {
    return await notificationService.clearAllNotifications();
  }, []);

  const requestPermissions = useCallback(async () => {
    const success = await notificationService.initialize();
    setHasPermissions(success);
    return success;
  }, []);

  return {
    isInitialized,
    hasPermissions,
    pushToken,
    lastNotification,
    sendNotification,
    notifyBuildSuccess,
    notifyBuildFailure,
    notifyBuildStarted,
    clearAllNotifications,
    requestPermissions,
  };
}

export default useNotifications;
