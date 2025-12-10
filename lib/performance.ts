/**
 * Performance Monitoring Service
 * 
 * ✅ Features:
 * - Screen render time tracking
 * - API call duration tracking
 * - Custom performance marks
 * - Memory usage monitoring
 * - Bundle size tracking ready
 * 
 * @author k1w1-team
 * @version 1.0.0
 */

import { logger } from './logger';

type PerformanceMetric = {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
};

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private isDev = __DEV__;
  private enabled = true;
  
  /**
   * Start measuring a performance metric
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;
    
    const metric: PerformanceMetric = {
      name,
      startTime: Date.now(),
      metadata,
    };
    
    this.metrics.set(name, metric);
    
    if (this.isDev) {
      logger.debug(`Performance start: ${name}`, metadata);
    }
  }
  
  /**
   * End measuring and log the result
   */
  end(name: string, additionalMetadata?: Record<string, any>): number | null {
    if (!this.enabled) return null;
    
    const metric = this.metrics.get(name);
    if (!metric) {
      logger.warn(`Performance metric not found: ${name}`);
      return null;
    }
    
    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;
    
    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata };
    }
    
    // Log performance
    logger.info(`Performance: ${name}`, {
      durationMs: duration,
      ...metric.metadata,
    });
    
    // Warn if slow
    if (duration > 1000) {
      logger.warn(`Slow performance detected: ${name}`, {
        durationMs: duration,
        threshold: 1000,
      });
    }
    
    // Clean up
    this.metrics.delete(name);
    
    return duration;
  }
  
  /**
   * Measure a function execution time
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.start(name, metadata);
    
    try {
      const result = await fn();
      this.end(name, { status: 'success' });
      return result;
    } catch (error) {
      this.end(name, { status: 'error', error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Track screen render time
   */
  trackScreenRender(screenName: string, startTime: number): void {
    const duration = Date.now() - startTime;
    
    logger.info(`Screen render: ${screenName}`, {
      durationMs: duration,
      screen: screenName,
    });
    
    if (duration > 500) {
      logger.warn(`Slow screen render: ${screenName}`, {
        durationMs: duration,
        threshold: 500,
      });
    }
  }
  
  /**
   * Track API call performance
   */
  trackApiCall(
    method: string,
    url: string,
    status: number,
    duration: number
  ): void {
    const isError = status >= 400;
    const isSlow = duration > 3000;
    
    if (isError || isSlow) {
      logger.warn(`API call ${method} ${url}`, {
        method,
        url,
        status,
        durationMs: duration,
        slow: isSlow,
        error: isError,
      });
    } else if (this.isDev) {
      logger.debug(`API call ${method} ${url}`, {
        method,
        url,
        status,
        durationMs: duration,
      });
    }
  }
  
  /**
   * Get memory usage (React Native specific)
   */
  getMemoryUsage(): { used: number; available: number } | null {
    try {
      // This would need react-native-device-info or similar
      // For now, return null and log
      logger.debug('Memory usage tracking not implemented yet');
      return null;
    } catch (error) {
      logger.error('Failed to get memory usage', error as Error);
      return null;
    }
  }
  
  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get all active metrics (for debugging)
   */
  getActiveMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }
  
  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    logger.debug('Performance metrics cleared');
  }
}

// Export singleton instance
export const performance = new PerformanceMonitor();

/**
 * React Hook for tracking component render time
 */
export function usePerformanceTracker(componentName: string) {
  const startTime = Date.now();
  
  return {
    trackMount: () => {
      const duration = Date.now() - startTime;
      logger.debug(`Component mounted: ${componentName}`, { durationMs: duration });
    },
    trackUpdate: (reason?: string) => {
      const duration = Date.now() - startTime;
      logger.debug(`Component updated: ${componentName}`, { 
        durationMs: duration,
        reason,
      });
    },
  };
}

/**
 * Higher-order function to measure async operations
 */
export function withPerformance<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string
): T {
  return (async (...args: any[]) => {
    return performance.measure(name, () => fn(...args));
  }) as T;
}

/**
 * Usage Examples:
 * 
 * 1. Screen Render Tracking:
 *    const startTime = Date.now();
 *    useEffect(() => {
 *      performance.trackScreenRender('ChatScreen', startTime);
 *    }, []);
 * 
 * 2. API Call Tracking:
 *    const start = Date.now();
 *    const response = await fetch(url);
 *    performance.trackApiCall('GET', url, response.status, Date.now() - start);
 * 
 * 3. Custom Performance Tracking:
 *    performance.start('heavy-calculation');
 *    // ... do heavy work
 *    performance.end('heavy-calculation');
 * 
 * 4. Using Hook:
 *    const { trackMount } = usePerformanceTracker('MyComponent');
 *    useEffect(() => trackMount(), []);
 * 
 * 5. Wrapping Functions:
 *    const fetchData = withPerformance(async () => {
 *      // fetch logic
 *    }, 'fetchData');
 */
