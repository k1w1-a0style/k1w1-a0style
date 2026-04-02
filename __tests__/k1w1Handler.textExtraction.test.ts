import { readAnthropicTextParts, readGeminiTextParts } from '../supabase/functions/k1w1-handler/helpers.ts';

describe('k1w1-handler text extraction helpers', () => {
  it('reads gemini text parts without crashing on malformed entries', () => {
    expect(
      readGeminiTextParts([
        { text: 'one' },
        null,
        { nope: true },
        { text: 'two' },
      ]),
    ).toBe('one\ntwo');
  });

  it('reads only anthropic text parts', () => {
    expect(
      readAnthropicTextParts([
        { type: 'text', text: 'alpha' },
        { type: 'tool_use', text: 'ignored' },
        { type: 'text', text: 'beta' },
      ]),
    ).toBe('alpha\nbeta');
  });
});
