/**
 * Logger Service - Environment-aware logging
 * 
 * ✅ Features:
 * - Environment-based log filtering (DEV vs PROD)
 * - Log levels: debug, info, warn, error
 * - Structured logging with context
 * - Production-safe (no sensitive data)
 * - Ready for Sentry integration
 * 
 * @author k1w1-team
 * @version 1.0.0
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, any>;

class Logger {
  private isDev = __DEV__;
  private minLevel: LogLevel = this.isDev ? 'debug' : 'warn';
  
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  
  /**
   * Checks if a log level should be logged based on current environment
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.minLevel];
  }
  
  /**
   * Formats a log message with timestamp and level
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${level.toUpperCase()}] ${timestamp} - ${message}`;
  }
  
  /**
   * Sanitizes context to remove sensitive data
   */
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;
    
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Debug level logging - only in development
   * Use for detailed debugging information
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message);
      const sanitized = this.sanitizeContext(context);
      console.log(formatted, sanitized || '');
    }
  }
  
  /**
   * Info level logging - general information
   * Use for non-critical information
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message);
      const sanitized = this.sanitizeContext(context);
      console.log(formatted, sanitized || '');
    }
  }
  
  /**
   * Warning level logging - potential issues
   * Use for recoverable errors or deprecation warnings
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message);
      const sanitized = this.sanitizeContext(context);
      console.warn(formatted, sanitized || '');
    }
  }
  
  /**
   * Error level logging - always logged
   * Use for errors that should be tracked in production
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const formatted = this.formatMessage('error', message);
    const sanitized = this.sanitizeContext(context);
    
    console.error(formatted, error || '', sanitized || '');
    
    // TODO: Send to error tracking service (Sentry, Firebase Crashlytics, etc.)
    // if (!this.isDev && error) {
    //   Sentry.captureException(error, {
    //     extra: sanitized,
    //     tags: { level: 'error' },
    //   });
    // }
  }
  
  /**
   * Performance logging - measures execution time
   */
  performance(label: string, startTime: number): void {
    const duration = Date.now() - startTime;
    this.debug(`Performance: ${label}`, { durationMs: duration });
  }
  
  /**
   * Group logging - useful for complex operations
   */
  group(label: string, callback: () => void): void {
    if (this.isDev) {
      console.group(label);
      callback();
      console.groupEnd();
    } else {
      callback();
    }
  }
  
  /**
   * API logging - structured logging for API calls
   */
  api(
    method: string,
    url: string,
    status: number,
    duration: number,
    error?: Error
  ): void {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    
    const context = {
      method,
      url: url.replace(/\/[a-f0-9-]{36}/gi, '/:id'), // Sanitize IDs
      status,
      durationMs: duration,
    };
    
    if (error) {
      this.error(`API ${method} ${url} failed`, error, context);
    } else {
      this[level](`API ${method} ${url}`, context);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogLevel, LogContext };
