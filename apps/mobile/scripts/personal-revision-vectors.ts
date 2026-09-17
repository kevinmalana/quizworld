import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePublicPack} from '../src/catalog';
const vectors=JSON.parse(readFileSync(0,'utf8')) as {row:unknown;revision:string}[];
for(const vector of vectors)assert.equal(parsePublicPack(vector.row).revision,vector.revision);
console.log(`PASS: ${vectors.length} exact PostgreSQL/client canonical revision vectors`);
