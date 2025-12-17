#!/usr/bin/env node
const { runOrchestrator } = require('./dist/lib/orchestrator');

const prompt = process.argv.slice(2).join(' ');
if (!prompt) {
  console.error('❌ Kein Prompt angegeben');
  process.exit(1);
}

(async () => {
  const res = await runOrchestrator('groq', 'llama-3.1-8b-instant', 'speed', [
    { role: 'user', content: prompt }
  ]);
  console.log(res.ok ? '✅ Build gestartet' : '❌ Fehler:', res);
})();
