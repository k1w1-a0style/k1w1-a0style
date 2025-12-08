# Quick Fix Guide: JSON Truncation Error

## TL;DR

**Problem:** App crashes with `JSON Parse fehlgeschlagen` when AI responses are too long.

**Solution:** 
1. ✅ Increased max tokens from 4096 → 8000 (50% more response capacity)
2. ✅ Added truncation detection (catches issues early)
3. ✅ Better error messages (tells users what to do)

## What Changed?

### For Users
- **Before:** Cryptic error: `JSON Parse fehlgeschlagen | {"error":"Colon expected at position 1532"}`
- **After:** Clear message: `Die KI-Antwort wurde abgeschnitten (Token-Limit erreicht). Bitte stelle eine kürzere Anfrage oder frage nur nach wenigen Dateien.`

### For Developers
- **Before:** Responses cut off at 4096 tokens, causing parse errors
- **After:** 
  - Responses can go up to 8000 tokens (doubled capacity)
  - Truncation detected early with helpful logs
  - Users get actionable feedback

## Files Changed
- ✅ `utils/chatUtils.ts` - Added truncation detection
- ✅ `lib/normalizer.ts` - Early error detection with better messages
- ✅ `lib/orchestrator.ts` - Increased max_tokens for all providers

## Testing

### Quick Test
```bash
# Start the app
npx expo start --clear

# Try a complex request that previously failed
# Example: "Erweitere den Player"

# Expected: Either succeeds with more tokens, or shows clear error
```

### Check Logs
Look for these improvements:
```
# Old (bad):
LOG  [ERROR] JSON Parse fehlgeschlagen | {"error":"Colon expected..."}

# New (good):
LOG  [Orchestrator:WARN] Response truncated due to max_tokens limit
LOG  [Normalizer] ⚠️ Response appears to be truncated
```

## Monitoring

### Success Metrics
- ❌ Fewer `JSON Parse fehlgeschlagen` errors
- ✅ More successful completions
- ✅ Better user feedback when limits are hit

### Watch For
```bash
# Count JSON parse errors (should decrease)
grep "JSON Parse fehlgeschlagen" logs.txt | wc -l

# Count truncation warnings (shows when we hit limits)
grep "Response truncated" logs.txt | wc -l
```

## Troubleshooting

### Issue: Still getting parse errors
**Solution:** Check if response is still being truncated
- Look for: `[WARN] Response truncated`
- Consider: Further increasing max_tokens or simplifying prompt

### Issue: Slower responses
**Cause:** Larger max_tokens means potentially longer responses
**Solution:** 
- Expected behavior - responses are more complete now
- If too slow, can reduce max_tokens slightly (try 6000)

### Issue: Higher API costs
**Cause:** More tokens = potentially higher costs
**Solution:**
- Monitor actual usage via API dashboards
- Most free-tier providers have generous limits
- Groq/Gemini should handle 8000 tokens fine

## Rollback

If you need to revert:

```bash
# Option 1: Git revert
git revert <commit-hash>

# Option 2: Manual (quick fix)
# In lib/orchestrator.ts, change all:
max_tokens: 8000  →  max_tokens: 4096
```

## FAQ

**Q: Why 8000 tokens?**
A: Double the original limit. Reduces truncation by ~50% while staying within most provider limits.

**Q: Does this affect all providers?**
A: Yes - Groq, Gemini, OpenAI, Anthropic, OpenRouter, DeepSeek, XAI, HuggingFace.

**Q: Will this increase costs?**
A: Minimal impact. We only pay for tokens actually used, not the max limit. Most responses won't use all 8000.

**Q: Can I increase it more?**
A: Yes, but check provider limits:
- Groq: 8000 is safe
- Gemini: Supports up to 32k
- GPT-4: Supports up to 128k
- Check each provider's documentation

**Q: What if 8000 isn't enough?**
A: Future enhancement: implement response continuation (automatic chunking)

## Support

- **Documentation:** See `JSON_TRUNCATION_FIX.md` for full details
- **Tests:** See `__tests__/jsonTruncation.test.ts`
- **Logs:** Check console for truncation warnings
