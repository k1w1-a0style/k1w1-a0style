// __tests__/jsonTruncation.test.ts
// Tests for JSON truncation detection

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

  test('detects real-world truncated response', () => {
    // This is similar to the actual truncated response from the logs
    const truncated = `[
  {
    "path": "screens/MusicPlayer.tsx",
    "content": "import React from 'react';
export const Player = () => {
  return <View><Text style={styles.title}>Player</Text></View>;
};
const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    color: theme.palette.text.primary,
    fontWeight`;
    expect(isJsonTruncated(truncated)).toBe(true);
  });

  test('recognizes complete multi-line JSON', () => {
    const complete = `[
  {
    "path": "screens/MusicPlayer.tsx",
    "content": "import React from 'react';\\nexport const Player = () => {\\n  return <View><Text>Player</Text></View>;\\n};"
  }
]`;
    expect(isJsonTruncated(complete)).toBe(false);
  });
});
