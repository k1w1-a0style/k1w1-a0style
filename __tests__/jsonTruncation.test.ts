import { isJsonTruncated } from '../utils/chatUtils';

describe('isJsonTruncated', () => {
  test('detects unbalanced brackets', () => {
    const truncated = '[{"path": "test.ts", "content": "hello"]';
    expect(isJsonTruncated(truncated)).toBe(true);
  });

  test('detects unbalanced braces', () => {
    const truncated = '{"path": "test.ts", "content": {"nested": "value"';
    expect(isJsonTruncated(truncated)).toBe(true);
  });

  test('detects incomplete strings', () => {
    const truncated = '[{"path": "test.ts", "content": "hello';
    expect(isJsonTruncated(truncated)).toBe(true);
  });

  test('detects incomplete property (ends with colon)', () => {
    const truncated = '[{"path": "test.ts", "content":';
    expect(isJsonTruncated(truncated)).toBe(true);
  });

  test('detects trailing comma with no content', () => {
    const truncated = '[{"path": "test.ts", "content": "hello"},';
    expect(isJsonTruncated(truncated)).toBe(true);
  });

  test('recognizes complete JSON array', () => {
    const complete = '[{"path": "test.ts", "content": "hello"}]';
    expect(isJsonTruncated(complete)).toBe(false);
  });

  test('recognizes complete JSON object', () => {
    const complete = '{"path": "test.ts", "content": "hello"}';
    expect(isJsonTruncated(complete)).toBe(false);
  });

  test('handles empty string', () => {
    expect(isJsonTruncated('')).toBe(false);
  });
});
