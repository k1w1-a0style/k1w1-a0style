import { parseRequestBody } from '../supabase/functions/k1w1-handler/helpers.ts';

describe('k1w1-handler request validation', () => {
  it('normalizes provider/message fields for valid payloads', () => {
    const body = parseRequestBody({
      provider: ' OpenAI ',
      quality: 'balanced',
      mode: ' builder ',
      model: ' gpt-5.3-codex ',
      messages: [{ role: ' USER ', content: '  Hello  ' }],
    });

    expect(body).toMatchObject({
      provider: 'openai',
      quality: 'balanced',
      mode: 'builder',
      model: 'gpt-5.3-codex',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('fails closed for unsupported provider', () => {
    expect(() =>
      parseRequestBody({
        provider: 'azure-openai',
        quality: 'speed',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).toThrow('Unsupported provider');

    expect(() =>
      parseRequestBody({
        provider: '   ',
        quality: 'speed',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).toThrow('provider must be a non-empty string');
  });

  it('fails closed for malformed messages', () => {
    expect(() =>
      parseRequestBody({
        provider: 'openai',
        quality: 'speed',
        messages: [{ role: 'tool', content: 'Hi' }],
      })
    ).toThrow('messages[0].role is invalid');

    expect(() =>
      parseRequestBody({
        provider: 'openai',
        quality: 'speed',
        messages: [{ role: 'user', content: '   ' }],
      })
    ).toThrow('messages[0].content must be a non-empty string');
  });

  it('fails closed for invalid quality/mode/model values', () => {
    expect(() =>
      parseRequestBody({
        provider: 'openai',
        quality: 'fast',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).toThrow('quality must be one of speed|balanced|quality|review');

    expect(() =>
      parseRequestBody({
        provider: 'openai',
        quality: 'speed',
        mode: ' '.repeat(5),
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).toThrow('mode must be a non-empty string');

    expect(() =>
      parseRequestBody({
        provider: 'openai',
        quality: 'speed',
        model: ' ',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).toThrow('model must be a non-empty string when provided');
  });
});
