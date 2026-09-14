import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const token=(name:string)=>{const value=css.match(new RegExp(`${name}: (#[0-9a-f]{6})[; ]`))?.[1];assert.ok(value,name);return value;};
function luminance(hex:string){return hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);}
const contrast=(a:string,b:string)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (hi+.05)/(lo+.05);};
test('core text and signal pairs meet normal-text contrast',()=>{
 for(const [fg,bg] of [['--ink','--bg'],['--muted','--bg'],['--stage-ink','--stage'],['--ink','--signal']])assert.ok(contrast(token(fg),token(bg))>=4.5,`${fg}/${bg}`);
});
test('meaningful control borders contrast against both light surfaces',()=>{
 for(const bg of ['--bg','--surface'])assert.ok(contrast(token('--line-strong'),token(bg))>=3,`control border / ${bg}`);
});
