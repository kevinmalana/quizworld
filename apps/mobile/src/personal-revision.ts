import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex,utf8ToBytes} from '@noble/hashes/utils.js';
import type {Pack} from './study/types';
/** v1: UTF-8 byte-length-prefixed fields. Question source order, answer UUID order.
 * No JSON whitespace/key-order/locale dependency. Null explanation means empty.
 * Must match personal_public_revision_v1 in the exact SQL migration. */
export function personalRevision(pack:Pick<Pack,'id'|'title'|'category'|'questions'>):string {
 const fields=['qw-personal-1',pack.id,pack.title,pack.category,String(pack.questions.length)];
 for(const q of pack.questions){fields.push(q.id,q.text,q.explanation??'',String(q.answers.length));for(const a of q.answers)fields.push(a.id,a.text,a.is_correct?'1':'0');}
 return bytesToHex(sha256(utf8ToBytes(fields.map(v=>`${utf8ToBytes(v).length}:${v}`).join(''))));
}
