// lib/RateLimiter.ts
// Rate Limiter Utilities (Project-compatible / test-compatible)

export type RateLimiterConfig = {
  maxRequests: number;
  windowMs: number;
};

export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
};

export const PROVIDER_RATE_LIMITS: Record<string, RateLimitConfig> = {
  groq: { maxRequests: 30, windowMs: 60000, burstLimit: 10 },
  openai: { maxRequests: 60, windowMs: 60000, burstLimit: 20 },
  anthropic: { maxRequests: 50, windowMs: 60000, burstLimit: 15 },
  gemini: { maxRequests: 60, windowMs: 60000, burstLimit: 20 },
  huggingface: { maxRequests: 20, windowMs: 60000, burstLimit: 5 },
  default: { maxRequests: 30, windowMs: 60000, burstLimit: 10 },
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Simple Rate Limiter mit Sliding Window
 * (Test-kompatibel: nutzt setTimeout + console.warn bei Waiting)
 * (Race-safe: serialisiert checkLimit via Promise-Queue)
 */
export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  // serialize checkLimit calls to avoid race conditions
  private queue: Promise<void> = Promise.resolve();

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  async checkLimit(): Promise<void> {
    // serialize calls to keep internal state consistent under concurrency
    this.queue = this.queue.then(() => this.checkLimitInternal());
    return this.queue;
  }

  private async checkLimitInternal(): Promise<void> {
    while (true) {
      const now = Date.now();

      // Alte Requests entfernen
      this.requests = this.requests.filter(
        (time) => now - time < this.windowMs,
      );

      if (this.requests.length < this.maxRequests) {
        this.requests.push(now);
        return;
      }

      // Limit erreicht → warten bis Window weiter ist
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);

      // Test erwartet, dass gewarnt wird wenn gewartet wird
      console.warn(
        `[RateLimiter] Rate limit erreicht. Warte ${waitTime}ms bevor fortgesetzt wird.`,
      );

      await sleep(waitTime > 0 ? waitTime : 0);
      // loop → danach nochmal prüfen, dann eintragen
    }
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  reset(): void {
    this.requests = [];
  }
}

/**
 * Enhanced Token Bucket Rate Limiter
 * - Ermöglicht Burst-Traffic bis zu einem Limit
 * - Token-Replenish über Zeit
 * - Queue für parallele Requests
 */
export class TokenBucketRateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private burstLimit: number;

  private tokens: number;
  private maxTokens: number;

  private lastRefillTime: number;

  // Queue for concurrent calls
  private requestQueue: Array<() => void> = [];
  private processing = false;

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.burstLimit = Math.max(1, config.burstLimit ?? config.maxRequests);

    this.maxTokens = this.maxRequests;
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  private refillTokens(now: number) {
    const elapsed = now - this.lastRefillTime;
    if (elapsed <= 0) return;

    // Refill proportional to time elapsed
    const refillRatePerMs = this.maxRequests / this.windowMs;
    const refillAmount = elapsed * refillRatePerMs;

    this.tokens = Math.min(this.maxTokens, this.tokens + refillAmount);
    this.lastRefillTime = now;
  }

  async checkLimit(requestedTokens = 1): Promise<void> {
    const tokensToConsume = Math.max(1, Math.floor(requestedTokens));

    // Burst cap handling (test expects "Burst-Limit" substring)
    if (tokensToConsume > this.burstLimit) {
      console.warn(
        `[TokenBucketRateLimiter] Burst-Limit: Requested ${tokensToConsume} tokens exceeds burst limit ${this.burstLimit}. Capping to ${this.burstLimit}.`,
      );
    }
    const effectiveTokens = Math.min(tokensToConsume, this.burstLimit);

    return new Promise<void>((resolve) => {
      this.requestQueue.push(() => {
        this.consumeTokens(effectiveTokens)
          .then(resolve)
          .catch(() => resolve()); // never reject here; limiter behavior in tests is wait-based
      });
      this.processQueue();
    });
  }

  private async consumeTokens(tokens: number): Promise<void> {
    while (true) {
      const now = Date.now();
      this.refillTokens(now);

      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }

      const deficit = tokens - this.tokens;
      const refillRatePerMs = this.maxRequests / this.windowMs;

      // time needed to refill deficit
      const waitTime = Math.ceil(deficit / refillRatePerMs);

      console.warn(
        `[TokenBucketRateLimiter] Rate limit erreicht. Warte ${waitTime}ms (Token deficit: ${deficit.toFixed(
          2,
        )}).`,
      );

      await sleep(waitTime > 0 ? waitTime : 0);
    }
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.refillTokens(now);
    return Math.max(0, Math.floor(this.tokens));
  }

  getStatus(): {
    remaining: number;
    total: number;
    isLimited: boolean;
    resetInMs: number;
    tokens: number;
    maxTokens: number;
    remainingRequests: number;
    maxRequests: number;
    windowMs: number;
    burstLimit: number;
  } {
    const now = Date.now();
    this.refillTokens(now);

    const remaining = Math.max(0, Math.floor(this.tokens));
    const total = this.maxTokens;

    // estimate reset time: how long until at least 1 token available if limited
    let resetInMs = 0;
    const isLimited = remaining <= 0;

    if (isLimited) {
      const refillRatePerMs = this.maxRequests / this.windowMs;
      const deficit = 1 - this.tokens;
      resetInMs = Math.max(0, Math.ceil(deficit / refillRatePerMs));
    }

    return {
      remaining,
      total,
      isLimited,
      resetInMs,
      tokens: this.tokens,
      maxTokens: this.maxTokens,
      remainingRequests: remaining,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      burstLimit: this.burstLimit,
    };
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.requestQueue.length > 0) {
        const fn = this.requestQueue.shift();
        if (fn) fn();
        // yield to event loop
        await Promise.resolve();
      }
    } finally {
      this.processing = false;
    }
  }
}

export type ProviderLimitConfig = RateLimitConfig;

export class ProviderRateLimiterManager {
  private limiters = new Map<string, TokenBucketRateLimiter>();
  private limits: Record<string, ProviderLimitConfig>;

  constructor(
    limits: Record<string, ProviderLimitConfig> = PROVIDER_RATE_LIMITS,
  ) {
    this.limits = { ...limits };
  }

  getLimiter(provider: string): TokenBucketRateLimiter {
    const key = provider || "default";
    if (this.limiters.has(key)) return this.limiters.get(key)!;

    const config =
      this.limits[key] || this.limits.default || PROVIDER_RATE_LIMITS.default;
    const limiter = new TokenBucketRateLimiter(config);
    this.limiters.set(key, limiter);
    return limiter;
  }

  setProviderConfig(provider: string, config: ProviderLimitConfig) {
    const key = provider || "default";
    this.limits[key] = config;

    // if already created, replace it to apply config
    if (this.limiters.has(key)) {
      this.limiters.set(key, new TokenBucketRateLimiter(config));
    }
  }

  resetProvider(provider: string) {
    const key = provider || "default";
    const limiter = this.limiters.get(key);
    if (limiter) limiter.reset();
  }

  resetAll() {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  getStatus(provider: string): {
    provider: string;
    remaining: number;
    total: number;
    isLimited: boolean;
    resetInMs: number;
    remainingRequests: number;
    maxRequests: number;
    windowMs: number;
    burstLimit: number;
    tokens: number;
    maxTokens: number;
  } {
    const key = provider || "default";
    const limiter = this.getLimiter(key);
    const s = limiter.getStatus();

    return {
      provider: key,
      remaining: s.remaining,
      total: s.total,
      isLimited: s.isLimited,
      resetInMs: s.resetInMs,
      remainingRequests: s.remainingRequests,
      maxRequests: s.maxRequests,
      windowMs: s.windowMs,
      burstLimit: s.burstLimit,
      tokens: s.tokens,
      maxTokens: s.maxTokens,
    };
  }

  getAllStatus(): Record<
    string,
    {
      provider: string;
      remaining: number;
      total: number;
      isLimited: boolean;
      resetInMs: number;
      remainingRequests: number;
      maxRequests: number;
      windowMs: number;
      burstLimit: number;
      tokens: number;
      maxTokens: number;
    }
  > {
    const result: Record<string, any> = {};

    // Wichtig für deine Tests: wenn noch kein Provider benutzt wurde -> {}
    for (const [provider] of this.limiters.entries()) {
      result[provider] = this.getStatus(provider);
    }

    return result;
  }
}

export const providerRateLimiter = new ProviderRateLimiterManager();
