/**
 * E2E Test - Basic App Flow
 * 
 * Tests the fundamental app functionality:
 * - App launches successfully
 * - Navigation works
 * - Basic user interactions
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('App Smoke Test', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should launch app successfully', async () => {
    // Wait for app to load
    await waitFor(element(by.text('k1w1-a0style')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should show tab navigation', async () => {
    // Check if tabs are visible
    await detoxExpect(element(by.text('Chat'))).toBeVisible();
    await detoxExpect(element(by.text('Code'))).toBeVisible();
    await detoxExpect(element(by.text('Terminal'))).toBeVisible();
  });

  it('should navigate between tabs', async () => {
    // Navigate to Code tab
    await element(by.text('Code')).tap();
    await waitFor(element(by.id('code-screen')))
      .toBeVisible()
      .withTimeout(2000);

    // Navigate to Terminal tab
    await element(by.text('Terminal')).tap();
    await waitFor(element(by.id('terminal-screen')))
      .toBeVisible()
      .withTimeout(2000);

    // Navigate back to Chat tab
    await element(by.text('Chat')).tap();
    await waitFor(element(by.id('chat-screen')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should open drawer menu', async () => {
    // Open drawer (swipe from left or tap menu button)
    await element(by.id('header-menu-button')).tap();
    
    // Check if drawer items are visible
    await waitFor(element(by.text('KI-Einstellungen')))
      .toBeVisible()
      .withTimeout(2000);
    
    await waitFor(element(by.text('Verbindungen')))
      .toBeVisible()
      .withTimeout(2000);
  });
});

describe('Chat Screen Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should display chat interface', async () => {
    await waitFor(element(by.id('chat-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Check for input field
    await detoxExpect(element(by.id('chat-input'))).toBeVisible();
    
    // Check for send button
    await detoxExpect(element(by.id('send-button'))).toBeVisible();
  });

  it('should type and send a message', async () => {
    const testMessage = 'Hello, this is a test';
    
    // Type message
    await element(by.id('chat-input')).typeText(testMessage);
    
    // Verify text was entered
    await detoxExpect(element(by.id('chat-input'))).toHaveText(testMessage);
    
    // Note: Actual sending would trigger AI call, skip in basic test
    // await element(by.id('send-button')).tap();
  });
});

describe('Settings Screen Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should navigate to settings', async () => {
    // Open drawer
    await element(by.id('header-menu-button')).tap();
    
    // Tap on Settings
    await element(by.text('KI-Einstellungen')).tap();
    
    // Verify settings screen is shown
    await waitFor(element(by.id('settings-screen')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should display AI provider options', async () => {
    // Navigate to settings first
    await element(by.id('header-menu-button')).tap();
    await element(by.text('KI-Einstellungen')).tap();
    
    // Check if provider sections are visible
    await detoxExpect(element(by.text('Groq'))).toBeVisible();
    await detoxExpect(element(by.text('Gemini'))).toBeVisible();
    await detoxExpect(element(by.text('OpenAI'))).toBeVisible();
  });
});

describe('Code Screen Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should navigate to code screen', async () => {
    await element(by.text('Code')).tap();
    
    await waitFor(element(by.id('code-screen')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should display file tree', async () => {
    await element(by.text('Code')).tap();
    
    // Check if file tree is visible
    await detoxExpect(element(by.id('file-tree'))).toBeVisible();
  });
});

/**
 * Installation & Setup Instructions:
 * 
 * 1. Install Detox:
 *    npm install --save-dev detox jest
 * 
 * 2. Install Detox CLI globally:
 *    npm install -g detox-cli
 * 
 * 3. Setup iOS (Mac only):
 *    brew tap wix/brew
 *    brew install applesimutils
 * 
 * 4. Setup Android:
 *    - Install Android Studio
 *    - Create AVD: Pixel_5_API_31
 * 
 * 5. Build app for testing:
 *    detox build --configuration ios.sim.debug
 *    detox build --configuration android.emu.debug
 * 
 * 6. Run tests:
 *    detox test --configuration ios.sim.debug
 *    detox test --configuration android.emu.debug
 * 
 * 7. Add test IDs to components:
 *    - Add testID prop to important elements
 *    - Example: <View testID="chat-screen">
 */
