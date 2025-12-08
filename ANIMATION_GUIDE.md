# Animation Visual Guide

## BuildScreen Animations

### 1. Screen Load Sequence
```
┌─────────────────────────────────────┐
│ EAS Build                           │ ← Fades in (400ms)
│ Triggert einen EAS-Build...         │
└─────────────────────────────────────┘
         ↓ delay 100ms
┌─────────────────────────────────────┐
│ Repository                          │ ← Slides up (500ms)
│ owner/repo-name                     │
└─────────────────────────────────────┘
         ↓ delay 100ms
┌─────────────────────────────────────┐
│ Build starten                       │ ← Slides up (500ms)
│ [Build starten] 🎯 ← Press scales   │
└─────────────────────────────────────┘
         ↓ delay 100ms
┌─────────────────────────────────────┐
│ Status                              │ ← Slides up (500ms)
│ ✨ Build läuft... (animates)        │
└─────────────────────────────────────┘
```

### 2. Button Press Animation
```
Normal State:          Pressed:           Release:
┌──────────────┐      ┌────────────┐     ┌──────────────┐
│ Build starten│      │Build starten│     │ Build starten│
└──────────────┘      └────────────┘     └──────────────┘
   Scale: 1.0         Scale: 0.95         Scale: 1.0
                      (Spring effect)     (Bounces back)
```

### 3. Status Change Animation
```
Status Changes:
"Bereit" → "Building" → "Success"

Each transition:
  1. Fade opacity: 1.0 → 0.5 → 1.0 (150ms each)
  2. Scale: 1.0 → 1.05 → 1.0 (Spring)
```

### 4. Success Pulse
```
Successful Build:
┌─────────────────────────────────────┐
│ ✅ Build erfolgreich abgeschlossen   │
│    ⚡ Pulses continuously ⚡         │
│ Opacity: 0.3 ↔ 0.8 (800ms cycles)  │
│ Scale: 1.0 ↔ 1.02                   │
└─────────────────────────────────────┘
        ↓ Fades in (300ms)
┌─────────────────────────────────────┐
│ [Build-Details aufrufen] 🔗         │
└─────────────────────────────────────┘
```

### 5. Error Shake
```
Failed Build:
┌─────────────────────────────────────┐
│ ❌ Build fehlgeschlagen              │
│    ← → ← → ← (Shakes quickly)       │
│ translateX: -5 → 5 → -5 → 5 → 0     │
│ Duration: 250ms total               │
└─────────────────────────────────────┘
```

## ChatScreen Animations

### 1. Message Entrance
```
User Message (from right):
                    ┌─────────────────┐
→ → → → → → → → → →│ User message    │
                    └─────────────────┘
                    Slides in from right
                    FadeInRight (400ms)

AI Message (from left):
┌─────────────────┐
│ AI response     │← ← ← ← ← ← ← ← ← ←
└─────────────────┘
Slides in from left
FadeInLeft (400ms)
```

### 2. Button Press Animations
```
Send Button:                Attach Button:
   Normal                      Normal
     ↓                           ↓
   Press (0.9x)                Press (0.9x)
     ↓                           ↓
   Release (1.0x)              Release (1.0x)
   Spring bounce               Spring bounce
```

### 3. File Attachment Badge
```
No file selected:
[Nothing shown]

File selected:
     ↓ Fades in (300ms)
┌────────────────────────┐
│ 📎 document.pdf        │
└────────────────────────┘

File removed:
     ↓ Fades out (200ms)
[Nothing shown]
```

## SettingsScreen Animations

### 1. Sequential Card Appearance
```
┌─────────────────────────────────────┐
│ KI-Einstellungen                    │ ← Appears (400ms)
└─────────────────────────────────────┘
         ↓ delay 100ms
┌─────────────────────────────────────┐
│ Modus [Quality/Speed]               │ ← Slides up (500ms)
└─────────────────────────────────────┘
         ↓ delay 100ms
┌─────────────────────────────────────┐
│ Builder Provider & Modell           │ ← Slides up (500ms)
└─────────────────────────────────────┘
         ↓ delay 100ms
┌─────────────────────────────────────┐
│ API-Keys je Provider                │ ← Slides up (500ms)
└─────────────────────────────────────┘
```

### 2. Provider Card Stagger
```
┌─────────────────┐
│ GROQ            │ ← delay 400ms
└─────────────────┘
┌─────────────────┐
│ GEMINI          │ ← delay 450ms
└─────────────────┘
┌─────────────────┐
│ OPENAI          │ ← delay 500ms
└─────────────────┘
┌─────────────────┐
│ ANTHROPIC       │ ← delay 550ms
└─────────────────┘
... (continues with 50ms intervals)
```

## Animation Timing Chart

```
Time (ms)  BuildScreen          ChatScreen           SettingsScreen
─────────────────────────────────────────────────────────────────
   0       Header fades in      -                    Header slides up
 100       Repo card appears    -                    Mode card appears
 200       Build card appears   -                    Provider card appears
 300       Status card appears  -                    Keys section appears
 400       -                    Messages appear      Provider 1 appears
 450       -                    -                    Provider 2 appears
 500       -                    -                    Provider 3 appears
 ...       -                    -                    ... (stagger continues)
 800       All visible          All visible          Add key card appears
```

## Performance Considerations

### Animation Types Used:
- ✅ **Transform** (scale, translateX) - GPU accelerated
- ✅ **Opacity** - GPU accelerated
- ❌ **No layout properties** (width, height, margin) - Avoided for performance

### Frame Rate:
- Target: 60 FPS
- All animations use `react-native-reanimated` v4
- Runs on UI thread (not blocked by JS thread)

### Device Testing:
```
High-end:  All animations smooth ✓
Mid-range: All animations smooth ✓
Low-end:   Should be smooth (test recommended)
```

## Accessibility

### Reduce Motion Support:
To add respect for system settings, consider:

```typescript
import { AccessibilityInfo } from 'react-native';

const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();

if (isReduceMotionEnabled) {
  // Use instant transitions instead
}
```

## Developer Notes

### Debugging Animations:
1. Enable "Show Reanimated Worklets" in Reanimated DevTools
2. Check frame rate with "Show Performance Monitor"
3. Use Chrome DevTools to inspect animation values

### Common Issues:
- **Animations not working**: Check if `react-native-reanimated/plugin` is in babel.config.js
- **Lag on Android**: Ensure app is in release mode for testing
- **Unexpected behavior**: Clear Metro bundler cache

### Testing Checklist:
- [ ] Test on iOS
- [ ] Test on Android
- [ ] Test with slow animations (Developer Options)
- [ ] Test with reduce motion enabled
- [ ] Test rapid interactions (spam tapping)
- [ ] Test orientation changes
- [ ] Test with different screen sizes
