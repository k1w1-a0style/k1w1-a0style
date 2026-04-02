import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('docs core reference drift invariants', () => {
  it('keeps agent/bootstrap docs on canonical docs/* paths', () => {
    expect(read('AI_START_HERE.md')).toContain('docs/PROJECT_CONTEXT.md');
    expect(read('AI_START_HERE.md')).toContain('docs/SYSTEM_README.md');
    expect(read('AI_START_HERE.md')).toContain('docs/codex/PROMPT_DE.md');

    expect(read('AGENTS.md')).toContain('docs/PROJECT_CONTEXT.md');
    expect(read('AGENTS.md')).toContain('docs/SYSTEM_README.md');

    expect(read('docs/codex/PROMPT_DE.md')).toContain('docs/PROJECT_CONTEXT.md');
    expect(read('docs/codex/PROMPT_DE.md')).toContain('docs/SYSTEM_README.md');
  });

  it('keeps docs/reviews free of redundant legacy verification files', () => {
    const reviewsDir = path.join(ROOT, 'docs/reviews');
    const legacyFiles = fs.readdirSync(reviewsDir).filter((name) => /_VERIFICATION\.md$/.test(name) || name === 'SCREENS_VERIFICATION.md');
    expect(legacyFiles).toEqual([]);
  });

  it('keeps only one canonical deep-scan review in docs/reviews', () => {
    expect(() => read('docs/reviews/Review.md')).not.toThrow();
    expect(fs.existsSync(path.join(ROOT, 'docs/reviews/deep-scan-review-2026-03-30.md'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'docs/reviews/DEEP_SCAN_RESCAN_2026-04-01.md'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'docs/reviews/FINAL_VERIFICATION_REPORT_2026-04-01.md'))).toBe(false);
  });
});
