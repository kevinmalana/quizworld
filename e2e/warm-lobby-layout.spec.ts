import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Real component/CSS layout test only; not a substitute for realtime acceptance.
// Render in tsx rather than Playwright's component-testing JSX transform.
test('mobile lobby keeps readable PIN beside full-sized QR at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const html = execFileSync(process.execPath, ['--import', 'tsx', '-e', `
    const React = require('react'); globalThis.React = React;
    const { renderToStaticMarkup } = require('react-dom/server');
    const { WaitingLobbyPanel } = require('./components/game/WaitingLobbyPanel.tsx');
    process.stdout.write(renderToStaticMarkup(React.createElement(WaitingLobbyPanel, {
      pin: '123456', joinUrl: 'https://www.quizworld.xyz/join?pin=123456', notice: null,
      players: [], readyPlayers: new Set(), readyCount: 0, isHost: false,
      currentPlayer: null, playerSessionReady: true, amReady: false,
      onReady() {}, onStart() {},
    })));
  `], { encoding: 'utf8' });
  const css = ['styles/game.css', 'styles/warm-ui.css'].map(path => readFileSync(path, 'utf8')).join('\n');
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}.container{padding:16px}${css}</style>${html}`);
  await expect(page.locator('.game-lobby-pin-area')).toHaveCSS('flex-direction', 'row');
  await expect(page.getByRole('img', { name: 'Scan to join' })).toHaveCSS('width', '120px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
