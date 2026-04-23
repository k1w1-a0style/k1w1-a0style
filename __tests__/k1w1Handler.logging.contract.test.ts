import fs from 'fs';
import path from 'path';

describe('k1w1-handler logging contract', () => {
  it('gates request logging behind explicit K1W1_HANDLER_DEBUG_LOG=true', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'supabase/functions/k1w1-handler/index.ts'),
      'utf8',
    );

    expect(src).toContain('const shouldDebugLogRequests = Deno.env.get("K1W1_HANDLER_DEBUG_LOG") === "true";');
    expect(src).toContain('if (shouldDebugLogRequests) {');
    expect(src).toContain('console.warn(');
  });
});
