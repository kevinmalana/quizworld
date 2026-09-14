import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlayerAnswerGrid} from '../components/game/PlayerAnswerGrid';
Object.assign(globalThis,{React});
const question={id:'q',text:'Choose',answers:[{id:'a',text:'First'},{id:'b',text:'Second'}]};
test('an accepted answer exposes its selected state and truthful locked guidance without correctness',()=>{
 const html=renderToStaticMarkup(React.createElement(PlayerAnswerGrid,{currentQuestion:question,selectedAnswer:'a',submittingAnswer:false,answerAccepted:true,timeLeft:12,onSubmit(){}}));
 assert.match(html,/aria-pressed="true"/); assert.match(html,/role="status"[^>]*>Answer locked/);
 assert.doesNotMatch(html,/Correct!|Wrong!/);assert.equal((html.match(/ disabled=""/g)||[]).length,2);
});

test('selection without authoritative acknowledgement must not claim acceptance',()=>{
 const html=renderToStaticMarkup(React.createElement(PlayerAnswerGrid,{currentQuestion:question,selectedAnswer:'a',submittingAnswer:false,timeLeft:12,onSubmit(){}}));
 assert.match(html,/Answer not yet confirmed/);assert.doesNotMatch(html,/Answer locked/);
});

test('optimistic selection is sending, not an acknowledged lock',()=>{
 const html=renderToStaticMarkup(React.createElement(PlayerAnswerGrid,{currentQuestion:question,selectedAnswer:'a',submittingAnswer:true,timeLeft:12,onSubmit(){}}));
 assert.match(html,/Sending your answer/); assert.doesNotMatch(html,/Answer locked/);
});
