// lib/__tests__/RateLimiter.test.ts
import { 
  RateLimiter, 
  TokenBucketRateLimiter, 
  ProviderRateLimiterManager,
  PROVIDER_RATE_LIMITS 
} from '../RateLimiter';

// Mock console.warn to avoid test output noise
const originalWarn = console.warn;

beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalWarn;
});

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with valid options', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
      expect(limiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', async () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60000 });
      
      // These should all pass without waiting
      await limiter.checkLimit();
      await limiter.checkLimit();
      await limiter.checkLimit();
      
      expect(limiter.getRemainingRequests()).toBe(0);
    });

    it('should wait when limit is exceeded', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
      
      // Fill up the limit
      await limiter.checkLimit();
      await limiter.checkLimit();
      
      // This should trigger waiting
      const checkPromise = limiter.checkLimit();
      
      // Fast-forward time
      jest.advanceTimersByTime(1000);
      
      await checkPromise;
      
      expect(console.warn).toHaveBeenCalled();
    });

    it('should clean up old requests', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
      
      await limiter.checkLimit();
      expect(limiter.getRemainingRequests()).toBe(1);
      
      // Advance time past the window
      jest.advanceTimersByTime(1500);
      
      // Old request should be cleaned up
      expect(limiter.getRemainingRequests()).toBe(2);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return max requests when empty', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
      expect(limiter.getRemainingRequests()).toBe(5);
    });

    it('should decrease after requests', async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
      
      await limiter.checkLimit();
      expect(limiter.getRemainingRequests()).toBe(4);
      
      await limiter.checkLimit();
      expect(limiter.getRemainingRequests()).toBe(3);
    });

    it('should return 0 when at limit', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });
      
      await limiter.checkLimit();
      await limiter.checkLimit();
      
      expect(limiter.getRemainingRequests()).toBe(0);
    });

    it('should clean old requests and update remaining', async () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
      
      await limiter.checkLimit();
      await limiter.checkLimit();
      expect(limiter.getRemainingRequests()).toBe(1);
      
      jest.advanceTimersByTime(1500);
      
      expect(limiter.getRemainingRequests()).toBe(3);
    });
  });

  describe('reset', () => {
    it('should clear all tracked requests', async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
      
      await limiter.checkLimit();
      await limiter.checkLimit();
      await limiter.checkLimit();
      
      expect(limiter.getRemainingRequests()).toBe(2);
      
      limiter.reset();
      
      expect(limiter.getRemainingRequests()).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle very short window', async () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 10 });
      
      await limiter.checkLimit();
      
      jest.advanceTimersByTime(15);
      
      expect(limiter.getRemainingRequests()).toBe(1);
    });

    it('should handle large number of requests', async () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });
      
      for (let i = 0; i < 50; i++) {
        await limiter.checkLimit();
      }
      
      expect(limiter.getRemainingRequests()).toBe(50);
    });
  });
});

describe('TokenBucketRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with valid options', () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 10, 
        windowMs: 60000,
        burstLimit: 5 
      });
      expect(limiter).toBeInstanceOf(TokenBucketRateLimiter);
    });

    it('should use default burstLimit if not provided', () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 30, 
        windowMs: 60000 
      });
      // Default is ceil(maxRequests / 3) = 10
      expect(limiter.getRemainingRequests()).toBe(30);
    });
  });

  describe('checkLimit', () => {
    it('should allow requests when tokens available', async () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 10, 
        windowMs: 60000,
        burstLimit: 5 
      });
      
      await limiter.checkLimit();
      await limiter.checkLimit();
      await limiter.checkLimit();
      
      expect(limiter.getRemainingRequests()).toBe(7);
    });

    it('should consume multiple tokens', async () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 10, 
        windowMs: 60000,
        burstLimit: 5 
      });
      
      await limiter.checkLimit(3);
      
      expect(limiter.getRemainingRequests()).toBe(7);
    });

    it('should respect burst limit', async () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 10, 
        windowMs: 60000,
        burstLimit: 5 
      });
      
      // Request more than burst limit - should be capped
      await limiter.checkLimit(10);
      
      // Should only consume burstLimit tokens
      expect(limiter.getRemainingRequests()).toBe(5);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Burst-Limit')
      );
    });

    it('should refill tokens over time', async () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 10, 
        windowMs: 1000, // 10 tokens per second = 0.01 per ms
        burstLimit: 5 
      });
      
      await limiter.checkLimit(5);
      expect(limiter.getRemainingRequests()).toBe(5);
      
      // Advance 500ms = 5 tokens refilled
      jest.advanceTimersByTime(500);
      
      expect(limiter.getRemainingRequests()).toBe(10);
    });

    it('should not exceed maxTokens when refilling', async () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 10, 
        windowMs: 1000,
        burstLimit: 5 
      });
      
      // Advance lots of time - tokens should cap at maxTokens
      jest.advanceTimersByTime(10000);
      
      expect(limiter.getRemainingRequests()).toBe(10);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', async () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 10, 
        windowMs: 60000,
        burstLimit: 5 
      });
      
      await limiter.checkLimit(3);
      
      const status = limiter.getStatus();
      
      expect(status.remaining).toBe(7);
      expect(status.total).toBe(10);
      expect(status.isLimited).toBe(false);
    });

    it('should show isLimited when tokens low', async () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 2, 
        windowMs: 60000,
        burstLimit: 2 
      });
      
      await limiter.checkLimit(2);
      
      const status = limiter.getStatus();
      
      expect(status.remaining).toBe(0);
      expect(status.isLimited).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset tokens to max', async () => {
      const limiter = new TokenBucketRateLimiter({ 
        maxRequests: 10, 
        windowMs: 60000,
        burstLimit: 10 // Set burstLimit equal to maxRequests for this test
      });
      
      await limiter.checkLimit(8);
      expect(limiter.getRemainingRequests()).toBe(2);
      
      limiter.reset();
      
      expect(limiter.getRemainingRequests()).toBe(10);
    });
  });
});

describe('ProviderRateLimiterManager', () => {
  let manager: ProviderRateLimiterManager;

  beforeEach(() => {
    manager = new ProviderRateLimiterManager();
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkLimit', () => {
    it('should create limiter for provider on first use', async () => {
      await manager.checkLimit('groq');
      
      const status = manager.getStatus('groq');
      expect(status.total).toBe(PROVIDER_RATE_LIMITS.groq.maxRequests);
    });

    it('should use default config for unknown provider', async () => {
      await manager.checkLimit('unknown_provider');
      
      const status = manager.getStatus('unknown_provider');
      expect(status.total).toBe(PROVIDER_RATE_LIMITS.default.maxRequests);
    });

    it('should track separate limits per provider', async () => {
      await manager.checkLimit('groq', 5);
      await manager.checkLimit('openai', 10);
      
      const groqStatus = manager.getStatus('groq');
      const openaiStatus = manager.getStatus('openai');
      
      expect(groqStatus.remaining).toBe(PROVIDER_RATE_LIMITS.groq.maxRequests - 5);
      expect(openaiStatus.remaining).toBe(PROVIDER_RATE_LIMITS.openai.maxRequests - 10);
    });
  });

  describe('setProviderConfig', () => {
    it('should allow custom config for provider', async () => {
      manager.setProviderConfig('custom', {
        maxRequests: 100,
        windowMs: 30000,
        burstLimit: 25
      });
      
      await manager.checkLimit('custom');
      
      const status = manager.getStatus('custom');
      expect(status.total).toBe(100);
    });

    it('should replace existing limiter with new config', async () => {
      await manager.checkLimit('groq', 10);
      
      manager.setProviderConfig('groq', {
        maxRequests: 100,
        windowMs: 60000,
        burstLimit: 30
      });
      
      // New limiter should be created
      const status = manager.getStatus('groq');
      expect(status.total).toBe(100);
      expect(status.remaining).toBe(100); // Fresh limiter
    });
  });

  describe('getAllStatus', () => {
    it('should return status for all used providers', async () => {
      await manager.checkLimit('groq');
      await manager.checkLimit('openai');
      await manager.checkLimit('anthropic');
      
      const allStatus = manager.getAllStatus();
      
      expect(Object.keys(allStatus)).toContain('groq');
      expect(Object.keys(allStatus)).toContain('openai');
      expect(Object.keys(allStatus)).toContain('anthropic');
    });

    it('should return empty object when no providers used', () => {
      const allStatus = manager.getAllStatus();
      expect(allStatus).toEqual({});
    });
  });

  describe('resetProvider', () => {
    it('should reset specific provider', async () => {
      await manager.checkLimit('groq', 10);
      await manager.checkLimit('openai', 10);
      
      manager.resetProvider('groq');
      
      const groqStatus = manager.getStatus('groq');
      const openaiStatus = manager.getStatus('openai');
      
      expect(groqStatus.remaining).toBe(PROVIDER_RATE_LIMITS.groq.maxRequests);
      expect(openaiStatus.remaining).toBe(PROVIDER_RATE_LIMITS.openai.maxRequests - 10);
    });

    it('should handle reset of non-existent provider gracefully', () => {
      expect(() => manager.resetProvider('nonexistent')).not.toThrow();
    });
  });

  describe('resetAll', () => {
    it('should reset all providers', async () => {
      await manager.checkLimit('groq', 10);
      await manager.checkLimit('openai', 20);
      
      manager.resetAll();
      
      const groqStatus = manager.getStatus('groq');
      const openaiStatus = manager.getStatus('openai');
      
      expect(groqStatus.remaining).toBe(PROVIDER_RATE_LIMITS.groq.maxRequests);
      expect(openaiStatus.remaining).toBe(PROVIDER_RATE_LIMITS.openai.maxRequests);
    });
  });
});

describe('PROVIDER_RATE_LIMITS', () => {
  it('should have config for common providers', () => {
    expect(PROVIDER_RATE_LIMITS.groq).toBeDefined();
    expect(PROVIDER_RATE_LIMITS.openai).toBeDefined();
    expect(PROVIDER_RATE_LIMITS.anthropic).toBeDefined();
    expect(PROVIDER_RATE_LIMITS.gemini).toBeDefined();
    expect(PROVIDER_RATE_LIMITS.huggingface).toBeDefined();
    expect(PROVIDER_RATE_LIMITS.default).toBeDefined();
  });

  it('should have valid config structure', () => {
    Object.values(PROVIDER_RATE_LIMITS).forEach(config => {
      expect(config.maxRequests).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThan(0);
    });
  });
});
