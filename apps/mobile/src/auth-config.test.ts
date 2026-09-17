import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validAuthConfig} from './auth-config';
test('auth client accepts public credentials only, never secret/service-role keys or non-HTTPS origins',()=>{
 const jwt=(role:string)=>`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role})).toString('base64url')}.fixture`;
 assert.equal(validAuthConfig('https://fixture.supabase.co','sb_publishable_fixture'),true);
 assert.equal(validAuthConfig('https://fixture.supabase.co',jwt('anon')),true);
 for(const key of ['sb_secret_fixture',jwt('service_role'),jwt('authenticated'),'garbage'])assert.equal(validAuthConfig('https://fixture.supabase.co',key),false);
 for(const url of ['http://fixture.supabase.co','https://user:password@fixture.supabase.co','https://fixture.supabase.co/path'])assert.equal(validAuthConfig(url,'sb_publishable_fixture'),false);
});
