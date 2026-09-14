import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';

test('Study cards have independent keyboard actions and readable mobile geometry',async()=>{
 const bundle=await build({stdin:{loader:'tsx',resolveDir:process.cwd(),contents:`import React from 'react';import{createRoot}from'react-dom/client';import{AvailableStudyQuizCard,ContinueStudyQuizCard}from'./components/study/study-quiz-card';const quiz={id:'local-quiz',title:'A longer study title for geography and curious people',category:'Geography',emoji:null,color:null,questions:[{id:'q'}]};createRoot(document.getElementById('root')).render(<><AvailableStudyQuizCard quiz={quiz}/><ContinueStudyQuizCard quiz={quiz}/></>);`},bundle:true,write:false,platform:'browser',jsx:'automatic',plugins:[{name:'link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:process.cwd(),contents:`import React from 'react';export default function Link(p){return <a {...p}/>} `}));}}]});
 const css=['app/globals.css','styles/study.css','styles/primitives.css'].map(f=>readFileSync(f,'utf8').replace(/@import[^;]+;/g,'')).join('\n');
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent(`<style>${css}</style><main id="root" style="padding:20px;max-width:550px;margin:auto"></main>`);await page.addScriptTag({content:bundle.outputFiles[0].text});await page.locator('.study-quiz-card').first().waitFor();
 assert.equal(await page.locator('a button,a a').count(),0,'content links cannot contain other interactive actions');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});const rows=await page.locator('.study-quiz-card').evaluateAll(cards=>cards.map(card=>({display:getComputedStyle(card).display,buttons:[...card.querySelectorAll('.btn')].map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,client:el.clientWidth,scroll:el.scrollWidth}))})));for(const row of rows){assert.equal(row.display,'block');for(const b of row.buttons){assert.ok(b.w>=44&&b.h>=44,JSON.stringify({width,b}));assert.ok(b.scroll<=b.client,JSON.stringify({width,b}));}}}
 await page.getByRole('link',{name:'Study Now',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:/Share/}).first().evaluate(e=>e===document.activeElement),true);
 }finally{await browser.close()}
});
