import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

test('selected quiz keeps readable title width on a narrow host screen',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 const html=execFileSync(process.execPath,['--import','tsx','-e',`const React=require('react');globalThis.React=React;const {renderToStaticMarkup}=require('react-dom/server');const {HostSelectedQuiz}=require('./components/host/HostSelectedQuiz.tsx');process.stdout.write(renderToStaticMarkup(React.createElement(HostSelectedQuiz,{quiz:{title:'A long quiz title that must remain readable',emoji:'📝',color:null,category:'General',question_count:10,plays:0},gameMode:'classic',onChange(){}})));`],{encoding:'utf8'});
 await page.setContent(`<style>${readFileSync('app/globals.css','utf8')}</style><div class="container">${html}</div>`);
 expect((await page.locator('.host-selected-title').boundingBox())!.width).toBeGreaterThan(155);
 await expect(page.getByRole('button',{name:'Change',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

// CSS contract fixture, not authenticated hosting or realtime acceptance.
// The real authorized host flow separately caught the 320px badge overflow.
test('compact host controls wrap status labels and expose one launch region',async({page})=>{
 const css=readFileSync('app/globals.css','utf8');
 await page.setViewportSize({width:320,height:844});
 await page.setContent(`<style>${css}</style><div class="container"><header><button class="host-launch-btn--header">Launch lobby</button></header><div class="host-modes-grid"><button class="host-mode-btn"><span class="host-mode-btn__header"><span class="host-mode-btn__icon">🎮</span><span class="host-mode-btn__label">Classic</span></span></button><button class="host-mode-btn host-mode-btn--locked" disabled><span class="host-mode-btn__header"><span class="host-mode-btn__icon">📖</span><span class="host-mode-btn__label">Practice Mode</span><span class="host-mode-btn__badge">Coming Soon</span></span></button></div></div><div class="host-launch-bar"><button>Launch lobby</button></div>`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 const badge=page.locator('.host-mode-btn__badge');expect((await badge.boundingBox())!.x+(await badge.boundingBox())!.width).toBeLessThanOrEqual(320);
 await expect(page.locator('.host-launch-btn--header')).not.toBeVisible();await expect(page.locator('.host-launch-bar')).toBeVisible();
 await page.setViewportSize({width:1440,height:960});await expect(page.locator('.host-launch-btn--header')).toBeVisible();await expect(page.locator('.host-launch-bar')).not.toBeVisible();
});
