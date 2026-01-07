import { chromium } from 'playwright';

async function analyzeArtifacts() {
  console.log('Starting Playwright analysis...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log console messages - filter for artifact related
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Artifact') || text.includes('showArtifacts')) {
      console.log(`[Browser]: ${text}`);
    }
  });

  // Go to the app
  console.log('Navigating to app...');
  await page.goto('http://localhost:3004');
  await page.waitForTimeout(3000);

  // Find and interact with chat
  const chatInput = page.locator('textarea').first();
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });

  console.log('Typing message...');
  await chatInput.type('Create a markdown document about cats. Use markdown code block format.');

  console.log('Sending message...');
  await chatInput.press('Enter');

  // Wait for streaming to complete
  console.log('Waiting for streaming...');
  await page.waitForTimeout(15000);
  await page.screenshot({ path: '.playwright-mcp/final-01-complete.png', fullPage: true });
  console.log('Screenshot 1: After streaming complete');

  // Now close the panel by clicking the X button
  const closeButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).last();
  const panelCloseBtn = page.locator('.border-l button').filter({ hasText: '' }).last();

  // Try to find and click the panel close button
  const xButton = page.locator('button').filter({ has: page.locator('svg[class*="lucide-x"]') });
  const closeButtons = await xButton.all();
  console.log(`Found ${closeButtons.length} X buttons`);

  // Click the last X button (should be in the panel header)
  if (closeButtons.length > 0) {
    await closeButtons[closeButtons.length - 1].click();
    console.log('Clicked close button');
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: '.playwright-mcp/final-02-panel-closed.png', fullPage: true });
  console.log('Screenshot 2: After closing panel');

  // Check if Artifacts button is visible
  const artifactsBtn = page.locator('button:has-text("Artifacts")');
  const isBtnVisible = await artifactsBtn.isVisible();
  console.log(`Artifacts button visible: ${isBtnVisible}`);

  if (isBtnVisible) {
    // Click to re-open panel
    await artifactsBtn.click();
    console.log('Clicked Artifacts button to re-open');
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: '.playwright-mcp/final-03-panel-reopened.png', fullPage: true });
  console.log('Screenshot 3: After re-opening panel');

  console.log('\n--- Done. Check screenshots in .playwright-mcp/ ---');
  await page.waitForTimeout(5000);
  await browser.close();
}

analyzeArtifacts().catch(console.error);
