import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const context=await chromium.launchPersistentContext('research/.browser-profile',{headless:false,viewport:{width:1280,height:900}});
const pages=context.pages();const page=pages[0]??await context.newPage();
await page.goto('https://www.tiktok.com/search?q=letstestlaurence%20cheap%20vs%20expensive',{waitUntil:'domcontentloaded'});
await page.bringToFront();
let seen=false;
for(let i=0;i<180;i++){
 const body=await page.locator('body').innerText().catch(()=> '');
 const challenge=/drag the slider|complete the puzzle|verify to continue|verify that you.re human/i.test(body);
 if(challenge)seen=true;
 await writeFile('research/raw/verification-status.json',JSON.stringify({time:new Date().toISOString(),challenge,seen,url:page.url()}));
 if(seen&&!challenge){console.log('Verification is no longer visible. Browser state saved.');break;}
 if(i===0)console.log(challenge?'TikTok verification is visible. Waiting for the user.':'Page opened for manual verification; no challenge visible yet.');
 await page.waitForTimeout(5000);
}
await context.close();
