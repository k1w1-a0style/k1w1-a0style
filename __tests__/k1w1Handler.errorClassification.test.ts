import { classifyK1w1HandlerError } from '../supabase/functions/k1w1-handler/helpers.ts';

describe('k1w1-handler error classification', () => {
  it('klassifiziert fehlende Provider-Env-Keys ohne Secret-Leak', () => {
    const payload = classifyK1w1HandlerError(new Error('GROQ_API_KEY not set in Edge env'));

    expect(payload).toMatchObject({
      ok: false,
      code: 'provider_env_missing',
      provider: 'groq',
      status: 500,
    });
    expect(payload.error).toContain('serverseitig nicht konfiguriert');
    expect(payload.error).not.toContain('GROQ_API_KEY');
  });

  it('klassifiziert Upstream-401 sauber', () => {
    const payload = classifyK1w1HandlerError(
      new Error('openai_http_401 (model=gpt-4o-mini): {"error":{"message":"bad auth"}}'),
    );

    expect(payload).toMatchObject({
      ok: false,
      code: 'provider_http_401',
      provider: 'openai',
      model: 'gpt-4o-mini',
      status: 401,
    });
    expect(payload.error).toContain('(401)');
    expect(payload.error).not.toContain('bad auth');
  });

  it('klassifiziert Upstream-429 als Rate-Limit', () => {
    const payload = classifyK1w1HandlerError(
      new Error('anthropic_http_429 (model=claude-3-5-sonnet-20241022): rate_limit_error'),
    );

    expect(payload).toMatchObject({
      ok: false,
      code: 'provider_http_429',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      status: 429,
    });
    expect(payload.error).toContain('Rate-Limit');
  });

  it('trennt Modell-nicht-gefunden von generischem 404', () => {
    const payload = classifyK1w1HandlerError(
      new Error('groq_http_404 (model=groq/compound-mini): model_not_found'),
    );

    expect(payload).toMatchObject({
      ok: false,
      code: 'provider_model_not_found',
      provider: 'groq',
      model: 'groq/compound-mini',
      status: 404,
    });
    expect(payload.error).toContain('nicht verfuegbar');
  });
});
