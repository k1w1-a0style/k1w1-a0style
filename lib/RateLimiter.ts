// lib/RateLimiter.ts - Enhanced Rate Limiter mit Token Bucket Algorithm

/**
 * Provider-spezifische Rate Limit Konfiguration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstLimit?: number; // Maximale Burst-Requests
}

/**
 * Rate Limit Status für Monitoring
 */
export interface RateLimitStatus {
  remaining: number;
  total: number;
  resetMs: number;
  isLimited: boolean;
}

/**
 * Standard Rate Limits für verschiedene AI-Provider
 */
export const PROVIDER_RATE_LIMITS: Record<string, RateLimitConfig> = {
  groq: { maxRequests: 30, windowMs: 60000, burstLimit: 10 },
  openai: { maxRequests: 60, windowMs: 60000, burstLimit: 20 },
  anthropic: { maxRequests: 50, windowMs: 60000, burstLimit: 15 },
  gemini: { maxRequests: 60, windowMs: 60000, burstLimit: 20 },
  huggingface: { maxRequests: 20, windowMs: 60000, burstLimit: 5 },
  default: { maxRequests: 30, windowMs: 60000, burstLimit: 10 },
};

/**
 * Simple Rate Limiter mit Sliding Window
 */
export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(options: { maxRequests: number; windowMs: number }) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const resetTime = oldestRequest + this.windowMs;
      const waitTime = resetTime - now;
      
      console.warn(
        `[RateLimiter] Limit erreicht (${this.maxRequests}/${this.windowMs}ms). Warte ${Math.ceil(waitTime / 1000)}s...`
      );
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Cleanup after wait
      this.requests = this.requests.filter(time => Date.now() - time < this.windowMs);
    }
    
    this.requests.push(now);
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  reset(): void {
    this.requests = [];
  }
}

/**
 * Enhanced Token Bucket Rate Limiter
 * - Ermöglicht Burst-Traffic bis zu einem Limit
 * - Tokens werden kontinuierlich nachgefüllt
 * - Bessere UX bei kurzzeitig erhöhter Last
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // Tokens pro Millisekunde
  private lastRefill: number;
  private burstLimit: number;
  private waitQueue: Array<{
    resolve: () => void;
    tokensNeeded: number;
  }> = [];
  private isProcessingQueue: boolean = false;

  constructor(options: RateLimitConfig) {
    this.maxTokens = options.maxRequests;
    this.tokens = options.maxRequests;
    this.refillRate = options.maxRequests / options.windowMs;
    this.lastRefill = Date.now();
    this.burstLimit = options.burstLimit ?? Math.ceil(options.maxRequests / 3);
  }

  /**
   * Füllt Tokens basierend auf vergangener Zeit nach
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Verarbeitet wartende Requests in der Queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.waitQueue.length > 0) {
      this.refillTokens();
      
      const next = this.waitQueue[0];
      if (this.tokens >= next.tokensNeeded) {
        this.tokens -= next.tokensNeeded;
        this.waitQueue.shift();
        next.resolve();
      } else {
        // Warte bis genug Tokens verfügbar sind
        const tokensNeeded = next.tokensNeeded - this.tokens;
        const waitTime = Math.ceil(tokensNeeded / this.refillRate);
        await new Promise(r => setTimeout(r, Math.min(waitTime, 1000)));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Prüft und wartet auf Rate Limit
   * @param tokensNeeded - Anzahl benötigter Tokens (Standard: 1)
   */
  async checkLimit(tokensNeeded: number = 1): Promise<void> {
    this.refillTokens();

    // Prüfe Burst-Limit
    if (tokensNeeded > this.burstLimit) {
      console.warn(
        `[TokenBucketRateLimiter] Request überschreitet Burst-Limit (${tokensNeeded} > ${this.burstLimit})`
      );
      tokensNeeded = this.burstLimit;
    }

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return;
    }

    // Nicht genug Tokens - in Warteschlange einreihen
    console.warn(
      `[TokenBucketRateLimiter] Nicht genug Tokens (${this.tokens.toFixed(2)}/${tokensNeeded}). Warte...`
    );

    return new Promise<void>((resolve) => {
      this.waitQueue.push({ resolve, tokensNeeded });
      this.processQueue();
    });
  }

  /**
   * Gibt aktuellen Status zurück
   */
  getStatus(): RateLimitStatus {
    this.refillTokens();
    const resetMs = this.tokens < this.maxTokens
      ? Math.ceil((this.maxTokens - this.tokens) / this.refillRate)
      : 0;

    return {
      remaining: Math.floor(this.tokens),
      total: this.maxTokens,
      resetMs,
      isLimited: this.tokens < 1,
    };
  }

  /**
   * Gibt verbleibende Tokens zurück (Kompatibilität mit RateLimiter)
   */
  getRemainingRequests(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }

  /**
   * Setzt Rate Limiter zurück
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.waitQueue = [];
  }
}

/**
 * Provider-spezifischer Rate Limiter Manager
 * Verwaltet separate Rate Limiter für jeden AI-Provider
 */
export class ProviderRateLimiterManager {
  private limiters: Map<string, TokenBucketRateLimiter> = new Map();
  private customConfigs: Map<string, RateLimitConfig> = new Map();

  /**
   * Setzt benutzerdefinierte Rate Limit Config für einen Provider
   */
  setProviderConfig(provider: string, config: RateLimitConfig): void {
    this.customConfigs.set(provider, config);
    // Lösche bestehenden Limiter damit er mit neuer Config neu erstellt wird
    this.limiters.delete(provider);
  }

  /**
   * Holt oder erstellt Rate Limiter für einen Provider
   */
  private getLimiter(provider: string): TokenBucketRateLimiter {
    if (!this.limiters.has(provider)) {
      const config = this.customConfigs.get(provider) 
        ?? PROVIDER_RATE_LIMITS[provider] 
        ?? PROVIDER_RATE_LIMITS.default;
      
      this.limiters.set(provider, new TokenBucketRateLimiter(config));
    }
    return this.limiters.get(provider)!;
  }

  /**
   * Prüft Rate Limit für einen Provider
   */
  async checkLimit(provider: string, tokensNeeded: number = 1): Promise<void> {
    const limiter = this.getLimiter(provider);
    await limiter.checkLimit(tokensNeeded);
  }

  /**
   * Gibt Status für einen Provider zurück
   */
  getStatus(provider: string): RateLimitStatus {
    const limiter = this.getLimiter(provider);
    return limiter.getStatus();
  }

  /**
   * Gibt alle Provider-Status zurück
   */
  getAllStatus(): Record<string, RateLimitStatus> {
    const status: Record<string, RateLimitStatus> = {};
    for (const [provider, limiter] of this.limiters) {
      status[provider] = limiter.getStatus();
    }
    return status;
  }

  /**
   * Setzt Rate Limiter für einen Provider zurück
   */
  resetProvider(provider: string): void {
    this.limiters.get(provider)?.reset();
  }

  /**
   * Setzt alle Rate Limiter zurück
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }
}

// Globale Instanz des Provider Rate Limiter Managers
export const providerRateLimiter = new ProviderRateLimiterManager();
