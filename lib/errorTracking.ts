/**
 * Error Tracking Service
 * 
 * ✅ Features:
 * - Sentry integration ready
 * - Environment-aware (DEV vs PROD)
 * - Context enrichment
 * - User context tracking
 * - Custom error tags
 * 
 * @author k1w1-team
 * @version 1.0.0
 */

// Uncomment when Sentry is installed:
// import * as Sentry from '@sentry/react-native';

type ErrorContext = {
  userId?: string;
  userName?: string;
  screen?: string;
  action?: string;
  [key: string]: any;
};

type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

class ErrorTrackingService {
  private initialized = false;
  private isDev = __DEV__;
  
  /**
   * Initialize error tracking service
   * Should be called once at app startup
   */
  init(config?: {
    dsn?: string;
    environment?: string;
    release?: string;
    enableInDev?: boolean;
  }): void {
    // Only initialize in production or if explicitly enabled in dev
    if (this.isDev && !config?.enableInDev) {
      console.log('[ErrorTracking] Skipped in development mode');
      return;
    }
    
    try {
      // TODO: Uncomment when @sentry/react-native is installed
      /*
      Sentry.init({
        dsn: config?.dsn || process.env.EXPO_PUBLIC_SENTRY_DSN,
        environment: config?.environment || (__DEV__ ? 'development' : 'production'),
        release: config?.release,
        tracesSampleRate: this.isDev ? 1.0 : 0.2,
        enableInExpoDevelopment: config?.enableInDev,
        debug: this.isDev,
        beforeSend: (event) => {
          // Filter sensitive data
          if (event.request?.headers) {
            delete event.request.headers['Authorization'];
            delete event.request.headers['Cookie'];
          }
          return event;
        },
      });
      */
      
      this.initialized = true;
      console.log('[ErrorTracking] Initialized successfully');
    } catch (error) {
      console.error('[ErrorTracking] Failed to initialize:', error);
    }
  }
  
  /**
   * Set user context for error tracking
   */
  setUser(user: { id?: string; email?: string; username?: string } | null): void {
    if (!this.initialized) return;
    
    try {
      // TODO: Uncomment when Sentry is installed
      /*
      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
          username: user.username,
        });
      } else {
        Sentry.setUser(null);
      }
      */
      
      console.log('[ErrorTracking] User context set:', user?.id || 'anonymous');
    } catch (error) {
      console.error('[ErrorTracking] Failed to set user:', error);
    }
  }
  
  /**
   * Capture an exception with context
   */
  captureException(
    error: Error,
    context?: ErrorContext,
    severity?: ErrorSeverity
  ): void {
    // Always log to console
    console.error('[ErrorTracking] Exception:', error.message, context);
    
    if (!this.initialized) return;
    
    try {
      // TODO: Uncomment when Sentry is installed
      /*
      Sentry.captureException(error, {
        level: severity || 'error',
        extra: context,
        tags: {
          screen: context?.screen,
          action: context?.action,
        },
      });
      */
    } catch (err) {
      console.error('[ErrorTracking] Failed to capture exception:', err);
    }
  }
  
  /**
   * Capture a message (non-error event)
   */
  captureMessage(
    message: string,
    severity: ErrorSeverity = 'info',
    context?: ErrorContext
  ): void {
    console.log(`[ErrorTracking] Message [${severity}]:`, message, context);
    
    if (!this.initialized) return;
    
    try {
      // TODO: Uncomment when Sentry is installed
      /*
      Sentry.captureMessage(message, {
        level: severity,
        extra: context,
      });
      */
    } catch (error) {
      console.error('[ErrorTracking] Failed to capture message:', error);
    }
  }
  
  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(
    message: string,
    category: string = 'default',
    data?: Record<string, any>
  ): void {
    if (!this.initialized) return;
    
    try {
      // TODO: Uncomment when Sentry is installed
      /*
      Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
        timestamp: Date.now() / 1000,
      });
      */
      
      if (this.isDev) {
        console.log('[ErrorTracking] Breadcrumb:', category, message, data);
      }
    } catch (error) {
      console.error('[ErrorTracking] Failed to add breadcrumb:', error);
    }
  }
  
  /**
   * Set custom tag for filtering
   */
  setTag(key: string, value: string): void {
    if (!this.initialized) return;
    
    try {
      // TODO: Uncomment when Sentry is installed
      /*
      Sentry.setTag(key, value);
      */
    } catch (error) {
      console.error('[ErrorTracking] Failed to set tag:', error);
    }
  }
  
  /**
   * Set custom context
   */
  setContext(key: string, context: Record<string, any>): void {
    if (!this.initialized) return;
    
    try {
      // TODO: Uncomment when Sentry is installed
      /*
      Sentry.setContext(key, context);
      */
    } catch (error) {
      console.error('[ErrorTracking] Failed to set context:', error);
    }
  }
  
  /**
   * Flush pending events (useful before app closes)
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    if (!this.initialized) return true;
    
    try {
      // TODO: Uncomment when Sentry is installed
      /*
      await Sentry.flush(timeout);
      */
      return true;
    } catch (error) {
      console.error('[ErrorTracking] Failed to flush:', error);
      return false;
    }
  }
}

// Export singleton instance
export const errorTracking = new ErrorTrackingService();

// Export types
export type { ErrorContext, ErrorSeverity };

/**
 * Installation Instructions:
 * 
 * 1. Install Sentry:
 *    npm install @sentry/react-native
 * 
 * 2. Setup Sentry project at https://sentry.io
 * 
 * 3. Add DSN to .env:
 *    EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
 * 
 * 4. Uncomment Sentry imports and calls in this file
 * 
 * 5. Initialize in App.tsx:
 *    import { errorTracking } from './lib/errorTracking';
 *    errorTracking.init();
 * 
 * 6. Use in components:
 *    try {
 *      // risky operation
 *    } catch (error) {
 *      errorTracking.captureException(error, { screen: 'ChatScreen' });
 *    }
 */
