// lib/RateLimiter.ts

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
}

export type RateLimiterStatus = {
  remaining: number;
  total: number;
  isLimited: boolean;
  resetInMs: number;
  tokens: number;
  maxTokens: number;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Sliding-window rate limiter.
 *
 * Important: Jest fake timers advance timers BEFORE awaiting the promise.
 * To stay test-compatible and still avoid races, we use a lightweight mutex
 * that can acquire synchronously (no await) when unlocked.
 */
export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[] = [];

  // lightweight mutex (test-friendly)
  private locked = false;
  private waiters: Array<() => void> = [];

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  private acquire(): void | Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.locked = false;
  }

  async checkLimit(): Promise<void> {
    const ticket = this.acquire();
    if (ticket) await ticket;

    try {
      await this.checkLimitInternal();
    } finally {
      this.release();
    }
  }

  private async checkLimitInternal(): Promise<void> {
    const now = Date.now();

    // Keep only requests within window
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldest = Math.min(...this.requests);
      const resetAt = oldest + this.windowMs;
      const waitTime = Math.max(0, resetAt - now);

      console.warn(
        `[RateLimiter] Rate limit exceeded. Waiting ${waitTime}ms before proceeding.`,
      );

      if (waitTime > 0) {
        await sleep(waitTime);
      } else {
        // yield once (also helps with fake timers / microtasks)
        await Promise.resolve();
      }

      const now2 = Date.now();
      this.requests = this.requests.filter((t) => now2 - t < this.windowMs);
    }

    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  reset(): void {
    this.requests = [];
  }

  getConfig(): RateLimitConfig {
    return { maxRequests: this.maxRequests, windowMs: this.windowMs };
  }
}

export interface TokenBucketConfig extends RateLimitConfig {
  burstLimit?: number;
}

/**
 * Token Bucket with continuous refill (important for mid-window refills in tests).
 */
export class TokenBucketRateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private burstLimit: number;

  private tokens: number;
  private lastRefill: number;

  // lightweight mutex (test-friendly)
  private locked = false;
  private waiters: Array<() => void> = [];

  constructor(config: TokenBucketConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;

    // burstLimit optional; default to maxRequests
    this.burstLimit =
      typeof config.burstLimit === "number" && config.burstLimit > 0
        ? config.burstLimit
        : config.maxRequests;

    this.tokens = this.maxRequests;
    this.lastRefill = Date.now();
  }

  private acquire(): void | Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.locked = false;
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;

    const refillRate = this.maxRequests / this.windowMs; // tokens per ms
    const add = elapsed * refillRate;

    this.tokens = Math.min(this.maxRequests, this.tokens + add);
    this.lastRefill = now;
  }

  async checkLimit(tokensRequested = 1): Promise<void> {
    const ticket = this.acquire();
    if (ticket) await ticket;

    try {
      await this.checkLimitInternal(tokensRequested);
    } finally {
      this.release();
    }
  }

  private async checkLimitInternal(tokensRequested: number): Promise<void> {
    this.refillTokens();

    let effective = tokensRequested;

    if (effective > this.burstLimit) {
      console.warn(
        `[TokenBucketRateLimiter] Burst-Limit: requested ${effective} tokens exceeds burst limit ${this.burstLimit}. Capping.`,
      );
      effective = this.burstLimit;
    }

    while (this.tokens < effective) {
      const deficit = effective - this.tokens;
      const refillRate = this.maxRequests / this.windowMs; // tokens per ms
      const waitMs = Math.max(1, Math.ceil(deficit / refillRate));

      await sleep(waitMs);
      this.refillTokens();
    }

    this.tokens -= effective;
  }

  getRemainingRequests(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }

  getStatus(): RateLimiterStatus {
    this.refillTokens();

    const remainingInt = Math.floor(this.tokens);
    const refillRate = this.maxRequests / this.windowMs; // tokens per ms
    const resetInMs =
      remainingInt >= 1
        ? 0
        : Math.max(1, Math.ceil((1 - this.tokens) / refillRate));

    return {
      remaining: remainingInt,
      total: this.maxRequests,
      isLimited: remainingInt <= 0,
      resetInMs,
      tokens: this.tokens,
      maxTokens: this.maxRequests,
    };
  }

  reset(): void {
    this.tokens = this.maxRequests;
    this.lastRefill = Date.now();
  }

  getConfig(): TokenBucketConfig {
    return {
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      burstLimit: this.burstLimit,
    };
  }
}

export type ProviderLimitConfig = TokenBucketConfig;

export const PROVIDER_RATE_LIMITS: Record<string, ProviderLimitConfig> = {
  openai: { maxRequests: 60, windowMs: 60000, burstLimit: 10 },
  anthropic: { maxRequests: 50, windowMs: 60000, burstLimit: 10 },
  gemini: { maxRequests: 60, windowMs: 60000, burstLimit: 10 },
  huggingface: { maxRequests: 30, windowMs: 60000, burstLimit: 5 },
  groq: { maxRequests: 120, windowMs: 60000, burstLimit: 20 },
  default: { maxRequests: 30, windowMs: 60000, burstLimit: 5 },
};

export class ProviderRateLimiterManager {
  private limiters: Map<string, TokenBucketRateLimiter> = new Map();
  private limits: Record<string, ProviderLimitConfig>;

  constructor(
    limits: Record<string, ProviderLimitConfig> = PROVIDER_RATE_LIMITS,
  ) {
    this.limits = { ...limits };
  }

  private getProviderConfig(provider: string): ProviderLimitConfig {
    return this.limits[provider] || this.limits.default;
  }

  private getLimiter(provider: string): TokenBucketRateLimiter {
    let limiter = this.limiters.get(provider);
    if (!limiter) {
      limiter = new TokenBucketRateLimiter(this.getProviderConfig(provider));
      this.limiters.set(provider, limiter);
    }
    return limiter;
  }

  async checkLimit(provider: string, tokensRequested = 1): Promise<void> {
    await this.getLimiter(provider).checkLimit(tokensRequested);
  }

  setProviderConfig(provider: string, config: ProviderLimitConfig): void {
    this.limits[provider] = config;
    this.limiters.set(provider, new TokenBucketRateLimiter(config));
  }

  getStatus(provider: string): RateLimiterStatus & { provider: string } {
    const status = this.getLimiter(provider).getStatus();
    return { ...status, provider };
  }

  getAllStatus(): Record<string, RateLimiterStatus & { provider: string }> {
    const result: Record<string, RateLimiterStatus & { provider: string }> = {};
    for (const [provider, limiter] of this.limiters.entries()) {
      const status = limiter.getStatus();
      result[provider] = { ...status, provider };
    }
    return result;
  }

  resetProvider(provider: string): void {
    const limiter = this.limiters.get(provider);
    if (limiter) limiter.reset();
  }

  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }
}

export const providerRateLimiter = new ProviderRateLimiterManager();
