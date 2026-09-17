import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePublicPack} from './catalog';
import {publicRow} from './personal-fixture';
test('personal canonical revision binds visible title as well as full questions',()=>{
 assert.notEqual(parsePublicPack(publicRow).revision,parsePublicPack({...publicRow,title:'Changed'}).revision);
});
