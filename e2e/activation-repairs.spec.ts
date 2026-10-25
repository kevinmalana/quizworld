import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Isolated local wire fixtures. No real accounts, AI calls, database or game writes.
const origin = 'https://quizworld-local-fixture.invalid';
const owner = '00000000-0000-4000-8000-000000000099';
const quizId = '00000000-0000-4000-8000-000000000001';
const attemptId = '00000000-0000-4000-8000-000000000088';
const question = { id:'q1', text:'Which city?', order_index:0, answers:[{id:'a1',text:'Paris',is_correct:true},{id:'a2',text:'London',is_correct:false}] };
const quiz = { id:quizId, slug:'local-study', title:'SAA-C03 Geography', category:'Technology', creator_id:owner, plays:10, created_at:'2026-01-01', questions:[question] };
async function fixture(page: Page, baseURL: string) {
  expect(new URL(baseURL).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if(url.origin === new URL(baseURL).origin) return route.continue();
    if(url.origin !== origin) return route.abort();
    if(url.pathname === '/rest/v1/quizzes') {
      const single = route.request().headers().accept?.includes('object+json');
      return route.fulfill({json:single ? quiz : [quiz], headers:{'content-range':'0-0/1'}});
    }
    return route.fulfill({json:[]});
  });
}
async function authenticated(context: BrowserContext, baseURL: string) {
  const user = {id:owner,email:'local-fixture@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{},app_metadata:{},created_at:'2026-01-01'};
  const exp = Math.floor(Date.now()/1000) + 3600;
  const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:owner,exp,aud:'authenticated',role:'authenticated'})).toString('base64url'),'local-fixture-signature'].join('.');
  const value = 'base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'local-fixture-refresh',token_type:'bearer',expires_at:exp,expires_in:3600,user})).toString('base64url');
  await context.addCookies([{name:'sb-quizworld-local-fixture-auth-token',value,url:baseURL}]);
}
test('guest structured paste works without an AI account', async ({page,baseURL}) => {
  await fixture(page,baseURL!);
  await page.goto('/create');
  await page.getByRole('button',{name:/Paste Text/}).click();
  await expect(page.getByText('Structured questions are parsed on this device')).toBeVisible();
  await page.locator('textarea').fill('Question 1: Which city is in France?\n* Paris\n- London\n- Berlin\n- Rome');
  await page.getByRole('button',{name:'Import ✨'}).click();
  await expect(page.getByPlaceholder('Type your question…')).toHaveValue('Question 1: Which city is in France?');
});
test('AI sign-in preserves source content and options', async ({page,baseURL}) => {
  await fixture(page,baseURL!);
  await page.goto('/create?source=topic&topic=SAA-C03');
  const text = page.getByPlaceholder(/Describe your topic/);
  await expect(text).toHaveValue('SAA-C03');
  await text.fill('SAA-C03 architecture exam intent');
  await page.getByRole('button',{name:'Sign in to use AI',exact:true}).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qw_pending_source')!))).toMatchObject({sourceType:'ai-topic',aiTopic:'SAA-C03 architecture exam intent',aiCount:10});
  await page.goto('/create?source=topic&topic=SAA-C03');
  await expect(text).toHaveValue('SAA-C03 architecture exam intent');
});
test('host search and append retries retain cursor, rows and selected quiz', async ({page,context,baseURL}) => {
  await fixture(page,baseURL!); await authenticated(context,baseURL!);
  let fail = false;
  const failed: string[] = []; const retried: string[] = [];
  await page.route(`${origin}/rest/v1/quizzes?**`, route => {
    const request=route.request(); const url=new URL(request.url());
    if(fail) {failed.push(request.method()+' '+url.href);return route.fulfill({status:503,json:{message:'local failure'}});}
    if(failed.length) retried.push(request.method()+' '+url.href);
    if(request.method()==='HEAD') return route.fulfill({headers:{'content-range':'*/25','access-control-expose-headers':'content-range'},body:''});
    const append=url.searchParams.getAll('or').some(x=>x.includes('plays.lt'));
    const rows=append ? [{...quiz,id:'last',title:'Second page',plays:0}] : Array.from({length:24},(_,i)=>({...quiz,id:`row-${i}`,title:`SAA-C03 Geography ${i}`,plays:24-i}));
    return route.fulfill({json:rows});
  });
  await page.goto('/host');
  await page.getByRole('button',{name:'Public Library',exact:false}).click();
  const search=page.getByRole('textbox',{name:'Search public quizzes to host'});
  const searched=page.waitForResponse(response=>response.request().method()==='HEAD' && decodeURIComponent(response.url()).includes('saa-c03'));
  await search.fill('  SAA-C03  ');
  await searched;
  await expect(page.locator('.host-quiz-card')).toHaveCount(24);
  await expect(page.getByRole('button',{name:'Load more quizzes'})).toBeEnabled();
  await page.locator('.host-quiz-card').first().click();
  const selected=await page.locator('.host-quiz-card--selected').innerText();
  fail=true;
  await page.getByRole('button',{name:'Load more quizzes'}).click();
  await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
  await expect(page.locator('.host-quiz-card')).toHaveCount(24);
  fail=false;
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.locator('.host-quiz-card')).toHaveCount(25);
  expect(retried.sort()).toEqual(failed.sort());
  await expect(search).toHaveValue('  SAA-C03  ');
  expect(await page.locator('.host-quiz-card--selected').innerText()).toBe(selected);
  await search.fill('saa-c03');
  await expect(page.locator('.host-quiz-card')).toHaveCount(25);
});
test('completed study retry reuses the attempt after a thrown transport error and persists before XP earned', async ({page,context,baseURL}) => {
  await fixture(page,baseURL!); await authenticated(context,baseURL!);
  await page.addInitScript(({quizId,attemptId})=>sessionStorage.setItem('qw_pending_study',JSON.stringify({quizId,attemptId,mode:'flashcard',answers:[{question_id:'q1',answer_id:'a1'}],result:{correct:1,total:1,wrongQuestions:[]}})),{quizId,attemptId});
  const attempts: unknown[]=[];
  await page.route(`${origin}/rest/v1/rpc/complete_study_session_atomic`, route=>{
    attempts.push(route.request().postDataJSON());
    if(attempts.length===1) return route.abort();
    return route.fulfill({json:{total_xp:175,xp_earned:175}});
  });
  await page.goto('/study/local-study');
  await expect(page.getByText('XP preview — not saved')).toBeVisible();
  await page.getByRole('button',{name:'Retry save',exact:true}).click();
  await expect(page.getByText('Could not save progress. Retry to save this same attempt.')).toBeVisible();
  await expect(page.getByText('XP Earned',{exact:false})).not.toBeVisible();
  await page.getByRole('button',{name:'Retry save',exact:true}).click();
  await expect(page.getByText('⭐ XP Earned',{exact:true})).toBeVisible();
  await expect(page.getByText('Progress saved · +175 XP')).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  expect(attempts[1]).toMatchObject({p_attempt_id:attemptId,p_quiz_id:quizId,p_answers:[{question_id:'q1',answer_id:'a1'}]});
});

test('guest completed session sign-in keeps answers and exact attempt for later save', async ({page,context,baseURL}) => {
  await fixture(page,baseURL!);
  await page.goto('/study/local-study');
  await page.getByRole('button',{name:/Flashcards/}).click();
  await page.getByRole('button',{name:'Reveal answers'}).click();
  await page.getByRole('button',{name:/Paris/}).click();
  await page.getByRole('button',{name:'Sign in to save this session'}).click();
  await expect(page).toHaveURL(url=>url.pathname==='/login' && url.searchParams.get('next')==='/study/local-study');
  const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qw_pending_study')!));
  expect(pending).toMatchObject({quizId,mode:'flashcard',answers:[{question_id:'q1',answer_id:'a1'}],result:{correct:1,total:1}});
  expect(pending.attemptId).toMatch(/^[0-9a-f-]{36}$/);
  await authenticated(context,baseURL!);
  let payload: unknown;
  await page.route(`${origin}/rest/v1/rpc/complete_study_session_atomic`,route=>{
    payload=route.request().postDataJSON();return route.fulfill({json:{total_xp:175,xp_earned:175}});
  });
  await page.goto('/study/local-study');
  await page.getByRole('button',{name:'Retry save',exact:true}).click();
  await expect(page.getByText('Progress saved · +175 XP')).toBeVisible();
  expect(payload).toMatchObject({p_attempt_id:pending.attemptId,p_answers:pending.answers});
});

test('exam cards actually initialize the selected search and creation topic', async ({page,baseURL}) => {
  await fixture(page,baseURL!);
  await page.goto('/aws-practice-test');
  const card=page.locator('.card').filter({hasText:'SAA-C03'}).first();
  await card.getByRole('link',{name:'Browse Quizzes',exact:true}).click();
  await expect(page.getByRole('searchbox')).toHaveValue('SAA-C03');
  await expect(page.locator('.explore-quiz-card')).toHaveCount(1);
  await page.goto('/aws-practice-test');
  await card.getByRole('link',{name:'Create Test',exact:true}).click();
  await expect(page.getByPlaceholder(/Describe your topic/)).toHaveValue(/SAA-C03 AWS Solutions Architect/);
});

test('guest can review missed questions and still sign in to save the original attempt', async ({page,baseURL}) => {
  await fixture(page,baseURL!);
  await page.goto('/study/local-study');
  await page.getByRole('button',{name:/Flashcards/}).click();
  await page.getByRole('button',{name:'Reveal answers'}).click();
  await page.getByRole('button',{name:/London/}).click();
  await page.getByRole('button',{name:/Review 1 Missed/}).click();
  await page.getByRole('button',{name:/Paris/}).click();
  await page.getByRole('button',{name:'Sign in to save this session'}).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qw_pending_study')!));
  expect(pending).toMatchObject({mode:'flashcard',answers:[{question_id:'q1',answer_id:'a2'}],result:{correct:0,total:1}});
});
