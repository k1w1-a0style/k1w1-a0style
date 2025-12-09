// lib/__tests__/retryWithBackoff.test.ts
import { fetchWithBackoff, retryWithBackoff } from '../retryWithBackoff';

// Mock console.log to avoid test output noise
const originalLog = console.log;

beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalLog;
});

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('fetchWithBackoff', () => {
    it('should return response on successful fetch', async () => {
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithBackoff('https://api.example.com', {});
      
      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 errors', async () => {
      const mockResponse = { ok: false, status: 404 };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithBackoff('https://api.example.com', {});
      
      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 errors', async () => {
      const mockResponse = { ok: false, status: 403 };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithBackoff('https://api.example.com', {});
      
      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 500 errors', async () => {
      const mockErrorResponse = { ok: false, status: 500 };
      const mockSuccessResponse = { ok: true, status: 200 };
      
      mockFetch
        .mockResolvedValueOnce(mockErrorResponse)
        .mockResolvedValueOnce(mockSuccessResponse);

      const fetchPromise = fetchWithBackoff('https://api.example.com', {}, 3);
      
      // Advance past the first backoff (1000ms)
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await fetchPromise;
      
      expect(result).toBe(mockSuccessResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return last response after max retries on 500', async () => {
      const mockErrorResponse = { ok: false, status: 500 };
      
      mockFetch.mockResolvedValue(mockErrorResponse);

      const fetchPromise = fetchWithBackoff('https://api.example.com', {}, 3);
      
      // Advance through all retries
      await jest.advanceTimersByTimeAsync(1000); // First retry
      await jest.advanceTimersByTimeAsync(2000); // Second retry
      
      const result = await fetchPromise;
      
      expect(result).toBe(mockErrorResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on network errors', async () => {
      const networkError = new Error('Network error');
      const mockSuccessResponse = { ok: true, status: 200 };
      
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockSuccessResponse);

      const fetchPromise = fetchWithBackoff('https://api.example.com', {}, 3);
      
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await fetchPromise;
      
      expect(result).toBe(mockSuccessResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries on network errors', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const networkError = new Error('Network error');
      
      mockFetch.mockRejectedValue(networkError);

      // Use maxRetries of 1 to make this test fast
      await expect(fetchWithBackoff('https://api.example.com', {}, 1)).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should pass options to fetch', async () => {
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const options = { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      };

      await fetchWithBackoff('https://api.example.com', options);
      
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com', options);
    });

    it('should use default maxRetries of 3', async () => {
      const mockErrorResponse = { ok: false, status: 500 };
      mockFetch.mockResolvedValue(mockErrorResponse);

      const fetchPromise = fetchWithBackoff('https://api.example.com', {});
      
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      
      await fetchPromise;
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryWithBackoff (generic)', () => {
    it('should return result on successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce('success');

      const retryPromise = retryWithBackoff(operation);
      
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await retryPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const error = new Error('Always fails');
      const operation = jest.fn().mockRejectedValue(error);

      // Use maxRetries of 1 to make test fast
      await expect(retryWithBackoff(operation, 1)).rejects.toThrow('Always fails');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect shouldRetry callback', async () => {
      const retryableError = new Error('Retryable');
      (retryableError as any).retryable = true;
      
      const nonRetryableError = new Error('Not retryable');
      (nonRetryableError as any).retryable = false;

      const shouldRetry = (error: any) => error.retryable === true;

      // Test retryable error
      const operation1 = jest.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('success');

      const promise1 = retryWithBackoff(operation1, 3, shouldRetry);
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await promise1;
      expect(result).toBe('success');
      expect(operation1).toHaveBeenCalledTimes(2);

      // Test non-retryable error
      const operation2 = jest.fn().mockRejectedValueOnce(nonRetryableError);

      await expect(retryWithBackoff(operation2, 3, shouldRetry)).rejects.toThrow('Not retryable');
      expect(operation2).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      jest.useRealTimers(); // Use real timers for this test
      
      let callCount = 0;
      const delays: number[] = [];
      let lastCallTime = Date.now();
      
      const operation = jest.fn().mockImplementation(() => {
        const now = Date.now();
        if (callCount > 0) {
          delays.push(now - lastCallTime);
        }
        lastCallTime = now;
        callCount++;
        return Promise.reject(new Error('Fail'));
      });

      // Use only 2 retries to keep test fast
      await expect(retryWithBackoff(operation, 2)).rejects.toThrow('Fail');
      expect(operation).toHaveBeenCalledTimes(2);
      
      // First delay should be around 1000ms (with some tolerance)
      if (delays.length > 0) {
        expect(delays[0]).toBeGreaterThanOrEqual(900);
        expect(delays[0]).toBeLessThan(1500);
      }
    });

    it('should handle custom maxRetries', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Fail 4'))
        .mockResolvedValueOnce('success');

      const retryPromise = retryWithBackoff(operation, 5);
      
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);
      await jest.advanceTimersByTimeAsync(8000);
      
      const result = await retryPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(5);
    });
  });
});
