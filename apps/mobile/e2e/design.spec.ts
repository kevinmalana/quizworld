import {test,expect} from '@playwright/test';

test('small-screen sample is honest, usable and motion-optional',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await expect(page.getByText('QUESTION PREVIEW',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open review queue',exact:true})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'Study',exact:true})).toBeVisible();
 const start=page.getByRole('button',{name:'Try a sample',exact:true});
 const box=await start.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(48);
 await start.click();await page.getByRole('button',{name:'Start quickfire',exact:true}).click();
 await expect(page.getByLabel('0 of 2 answers checked',{exact:true})).toBeVisible();
 const answer=page.getByRole('button',{name:'Asia',exact:true});
 expect((await answer.boundingBox())!.height).toBeGreaterThanOrEqual(56);
 await answer.click();await page.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(page.getByLabel('1 of 2 answers checked',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Next question',exact:true}).click();
 await page.getByRole('button',{name:'Tokyo',exact:true}).click();await page.getByRole('button',{name:'Check answer',exact:true}).click();
 await page.getByRole('button',{name:'See results',exact:true}).click();
 await expect(page.getByText('2 of 2 correct',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Review mistakes',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
