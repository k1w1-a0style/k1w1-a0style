import { RateLimiter } from "../../lib/RateLimiter";

// GitHub API rate limit is typically 5000/hour. We use 4000/hour buffer.
export const githubLimiter = new RateLimiter({
  maxRequests: 4000,
  windowMs: 60 * 60 * 1000,
});
