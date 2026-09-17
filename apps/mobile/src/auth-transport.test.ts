import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseAuthTransport} from './auth-transport';

// SDK over isolated HTTP fixtures, not a simulated production login.
const user={id:'00000000-0000-4000-8000-000000000001',email:'a@fixture.invalid',aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z'};
test('official SDK uses password/refresh and server user validation; logout is current-session only',async()=>{
 const requests:{url:string,body:string}[]=[];
 const transport=createSupabaseAuthTransport('https://auth.fixture.invalid','sb_publishable_fixture',async(input,init)=>{
  const url=String(input); requests.push({url,body:String(init?.body||'')});
  if(url.includes('/logout'))return new Response(null,{status:204});
  const body=url.includes('/user')?user:{access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user};
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 });
 const login=await transport.login('a@fixture.invalid','synthetic');
 assert.equal(login.user.id,user.id); assert.equal(login.refreshToken,'fixture-refresh');
 await transport.restore('fixture-refresh'); await transport.logout();
 assert.ok(requests.some(r=>r.url.endsWith('/token?grant_type=password')));
 assert.ok(requests.some(r=>r.url.endsWith('/token?grant_type=refresh_token')));
 assert.equal(requests.filter(r=>r.url.endsWith('/user')).length,2);
 assert.ok(requests.some(r=>r.url.endsWith('/logout?scope=local')));
});
test('authenticated user errors fail closed even if token endpoint succeeds',async()=>{
 const transport=createSupabaseAuthTransport('https://auth.fixture.invalid','sb_publishable_fixture',async(input)=>{
  const isUser=String(input).includes('/user');
  return new Response(JSON.stringify(isUser?{message:'expired',code:'bad_jwt'}:{access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user}),{status:isUser?401:200,headers:{'Content-Type':'application/json'}});
 });
 await assert.rejects(transport.login('a@fixture.invalid','synthetic'));
});
