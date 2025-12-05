// lib/RateLimiter.ts - Simple Rate Limiter für API Calls

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
