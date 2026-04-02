import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('docs current auth contract drift', () => {
  const activeDocs = [
    'docs/00-overview.md',
    'docs/03-screen-index.md',
    'docs/EDGE_FUNCTIONS_STATUS.md',
    'docs/reviews/Review.md',
  ];

  it('does not describe the current KI contract as JWT plus a local scoped admin key', () => {
    for (const rel of activeDocs) {
      const src = read(rel);
      expect(src).not.toContain('JWT + Claim + scoped Key');
      expect(src).not.toContain('JWT + Claim + scoped key');
      expect(src).not.toContain('Client sendet JWT + scoped key konsistent');
      expect(src).not.toContain('save_preview bleibt auf dem Legacy-Admin-Secret-Vertrag');
      expect(src).not.toContain('save_preview bleibt Legacy');
    }
  });
});
