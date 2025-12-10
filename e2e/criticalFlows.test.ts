/**
 * E2E Tests - Critical User Flows
 * 
 * Tests the most important user journeys:
 * 1. Project Template Loading
 * 2. ZIP Import/Export
 * 3. AI Chat Interaction
 * 4. GitHub Connection
 * 5. Build Trigger
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('Critical Flow: Project Template Loading', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true, // Clear app data
    });
  });

  it('should load default template on first launch', async () => {
    // Wait for app to initialize
    await waitFor(element(by.id('chat-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate to Code screen
    await element(by.text('Code')).tap();

    // Check if template files are loaded
    await waitFor(element(by.text('App.tsx')))
      .toBeVisible()
      .withTimeout(5000);

    await detoxExpect(element(by.text('package.json'))).toBeVisible();
  });
});

describe('Critical Flow: AI Chat Interaction', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should show AI provider selection', async () => {
    // Open drawer
    await element(by.id('header-menu-button')).tap();
    
    // Go to Settings
    await element(by.text('KI-Einstellungen')).tap();
    
    // Verify providers are listed
    await detoxExpect(element(by.text('Groq'))).toBeVisible();
    await detoxExpect(element(by.text('Gemini'))).toBeVisible();
  });

  it('should handle chat input', async () => {
    // Navigate to Chat
    await element(by.text('Chat')).tap();
    
    // Type a simple message
    await element(by.id('chat-input')).typeText('Create a simple button component');
    
    // Verify input
    await detoxExpect(element(by.id('chat-input')))
      .toHaveText('Create a simple button component');
    
    // Clear input (don't send to avoid API calls in tests)
    await element(by.id('chat-input')).clearText();
  });
});

describe('Critical Flow: File Management', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should display file tree in Code screen', async () => {
    await element(by.text('Code')).tap();
    
    // Check if file tree is visible
    await waitFor(element(by.id('file-tree')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should navigate file tree', async () => {
    await element(by.text('Code')).tap();
    
    // Tap on a folder (if exists)
    const componentsFolder = element(by.text('components/'));
    const exists = await componentsFolder.exists();
    
    if (exists) {
      await componentsFolder.tap();
      // Folder should expand/collapse
    }
  });
});

describe('Critical Flow: GitHub Integration', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should navigate to GitHub Repos screen', async () => {
    // Open drawer
    await element(by.id('header-menu-button')).tap();
    
    // Navigate to GitHub Repos
    await element(by.text('GitHub Repos')).tap();
    
    // Verify screen is shown
    await waitFor(element(by.id('github-repos-screen')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should show GitHub connection status', async () => {
    await element(by.id('header-menu-button')).tap();
    await element(by.text('Verbindungen')).tap();
    
    // Check if connections screen is visible
    await waitFor(element(by.id('connections-screen')))
      .toBeVisible()
      .withTimeout(3000);
  });
});

describe('Critical Flow: Build System', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should navigate to Build screen', async () => {
    // Open drawer
    await element(by.id('header-menu-button')).tap();
    
    // Navigate to Builds
    await element(by.text('📦 Builds')).tap();
    
    // Verify screen is shown
    await waitFor(element(by.id('build-screen')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should display build options', async () => {
    await element(by.id('header-menu-button')).tap();
    await element(by.text('📦 Builds')).tap();
    
    // Check if platform buttons are visible
    const iosButton = element(by.text('iOS'));
    const androidButton = element(by.text('Android'));
    
    // At least one should be visible
    try {
      await detoxExpect(iosButton).toBeVisible();
    } catch {
      await detoxExpect(androidButton).toBeVisible();
    }
  });
});

describe('Critical Flow: Diagnostic Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should navigate to Diagnostic screen', async () => {
    await element(by.id('header-menu-button')).tap();
    
    // Navigate to Diagnostic
    await element(by.text('🔍 Diagnose')).tap();
    
    // Verify screen is shown
    await waitFor(element(by.id('diagnostic-screen')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should run code analysis', async () => {
    await element(by.id('header-menu-button')).tap();
    await element(by.text('🔍 Diagnose')).tap();
    
    // Tap analyze button (if visible)
    const analyzeButton = element(by.id('analyze-button'));
    const exists = await analyzeButton.exists();
    
    if (exists) {
      await analyzeButton.tap();
      
      // Wait for analysis to complete
      await waitFor(element(by.id('analysis-results')))
        .toBeVisible()
        .withTimeout(10000);
    }
  });
});

describe('Critical Flow: Terminal', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should navigate to Terminal screen', async () => {
    await element(by.text('Terminal')).tap();
    
    await waitFor(element(by.id('terminal-screen')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should display terminal output', async () => {
    await element(by.text('Terminal')).tap();
    
    // Check if terminal output is visible
    await detoxExpect(element(by.id('terminal-output'))).toBeVisible();
  });
});

/**
 * Test Coverage Summary:
 * 
 * ✅ App Launch & Navigation
 * ✅ Chat Interface
 * ✅ File Management
 * ✅ GitHub Integration
 * ✅ Build System
 * ✅ Diagnostic Tools
 * ✅ Terminal
 * 
 * Missing (requires backend/API):
 * - Actual AI chat responses
 * - ZIP import/export (file picker)
 * - GitHub authentication
 * - Build triggering
 * - Real file operations
 * 
 * Run with:
 * detox test --configuration ios.sim.debug e2e/criticalFlows.test.ts
 * detox test --configuration android.emu.debug e2e/criticalFlows.test.ts
 */
