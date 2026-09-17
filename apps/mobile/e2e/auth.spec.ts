import {test,expect,type Page} from '@playwright/test';
const ids={A:'00000000-0000-4000-8000-000000000001',B:'00000000-0000-4000-8000-000000000002'};
const user=(who:'A'|'B')=>({id:ids[who],email:`${who.toLowerCase()}@fixture.invalid`,aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z'});
async function account(page:Page){await page.getByRole('tab',{name:'Account',exact:true}).click();}
async function login(page:Page,who:'A'|'B'){
 await account(page);
 await page.getByLabel('Account email',{exact:true}).fill(`${who.toLowerCase()}@fixture.invalid`);
 await page.getByLabel('Account password',{exact:true}).fill('synthetic-fixture-only');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await account(page); await expect(page.getByText(`Signed in as ${who.toLowerCase()}@fixture.invalid`,{exact:true})).toBeVisible();
}
async function logout(page:Page){
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.getByRole('button',{name:'Confirm sign out',exact:true}).click();
 await account(page);
}
async function fixture(page:Page,options:{failRestore?:boolean}={}){
 // Synthetic Supabase HTTP boundary ONLY. No production account, emails, or JWTs.
 await page.route('https://**/*',async route=>{
  const req=route.request(),url=req.url();
  if(!url.startsWith('https://quizworld-mobile-fixture.invalid/auth/v1/'))return route.abort();
  if(url.includes('/logout'))return route.fulfill({status:204});
  if(url.includes('/user'))return route.fulfill({json:user(req.headers().authorization?.includes('fixture-B')?'B':'A')});
  if(url.includes('/token')){
   const body=req.postDataJSON();
   if(body.refresh_token&&options.failRestore)return route.fulfill({status:401,json:{code:'refresh_token_not_found',message:'Synthetic expired session'}});
   const who: 'A'|'B'=body.email?.startsWith('b@')||body.refresh_token==='fixture-B'?'B':'A';
   return route.fulfill({json:{access_token:`fixture-${who}`,refresh_token:`fixture-${who}`,expires_in:3600,token_type:'bearer',user:user(who)}});
  }
  return route.abort();
 });
}
test('synthetic account login, local mistakes, export isolation, logout, B and A recovery',async({page})=>{
 await fixture(page); await page.goto('/'); await login(page,'A');
 await page.getByRole('tab',{name:'Study',exact:true}).click();
 await page.getByRole('button',{name:'Try a sample',exact:true}).click();
 await page.getByRole('button',{name:'Start quickfire',exact:true}).click();
 await page.getByRole('button',{name:'Africa',exact:true}).click();
 await page.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(page.getByText('Not quite',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save and exit',exact:true}).click();
 await account(page);
 await page.getByRole('button',{name:'Export device practice',exact:true}).click();
 await expect(page.getByLabel('Practice export JSON')).toContainText('World Geography Basics');
 await logout(page);
 await expect(page.getByLabel('Practice export JSON')).toHaveCount(0);
 await login(page,'B');
 await page.getByRole('tab',{name:'Study',exact:true}).click();
 await expect(page.getByRole('button',{name:'Resume practice',exact:true})).toHaveCount(0);
 await account(page); await logout(page); await login(page,'A');
 await page.reload();
 await page.getByRole('button',{name:'Resume practice',exact:true}).click();
 await expect(page.getByText('Not quite',{exact:true})).toBeVisible();
 const data=await page.evaluate(()=>({guest:localStorage.getItem('quizworld:guest-study:v1'),keys:Object.keys(localStorage),token:sessionStorage.getItem('quizworld.auth.refresh.v1')}));
 expect(data.guest===null||JSON.parse(data.guest).active===null).toBe(true);
 expect(data.keys).toContain(`quizworld:account-study:v1:${ids.A}`);
 expect(data.keys.some(k=>k.includes('auth-token'))).toBe(false);
 expect(data.token).toBe('fixture-A');
});
test('restore rejection hides account cache and explicit forget returns to guest',async({page})=>{
 const options={failRestore:false}; await fixture(page,options); await page.goto('/'); await login(page,'A');
 options.failRestore=true; await page.reload();
 await expect(page.getByText('Your session needs attention',{exact:true})).toBeVisible();
 await expect(page.getByRole('tab',{name:'Account',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Forget session / use guest',exact:true}).click();
 await account(page); await expect(page.getByText('You are practising as a guest.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem('quizworld.auth.refresh.v1'))).toBeNull();
});
