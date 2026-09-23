import {chromium} from 'playwright';
const source='https://video.twimg.com/amplify_video/2098051313192022016/vid/avc1/720x1280/ZaRokT41wKmkxCfm.mp4?tag=29';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1600}});
await page.goto(source,{waitUntil:'domcontentloaded',timeout:45000});
await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2,{timeout:30000});
await page.locator('video').evaluate(v=>{v.pause();v.controls=false;});
for(let batch=0;batch<3;batch++){
 const times=Array.from({length:8},(_,i)=>batch*16+i*2+.3).filter(t=>t<48);
 await page.evaluate(()=>{document.querySelector('#contact')?.remove();const c=document.createElement('canvas');c.id='contact';c.width=1440;c.height=1336;c.style.cssText='position:absolute;top:0;left:0;z-index:999;background:white;';document.body.append(c);});
 for(let i=0;i<times.length;i++){
  const t=times[i];
  await page.locator('video').evaluate((v,t)=>new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);resolve()};const timer=setTimeout(()=>{v.removeEventListener('seeked',done);reject(new Error('Seek timed out'))},10000);v.addEventListener('seeked',done,{once:true});v.currentTime=t;}),t);
  await page.evaluate(({i,t})=>{const c=document.querySelector('#contact');const ctx=c.getContext('2d');const v=document.querySelector('video');const x=i%4*360,y=Math.floor(i/4)*668;ctx.fillStyle='#ffffff';ctx.fillRect(x,y,360,668);ctx.drawImage(v,x,y+28,360,640);ctx.fillStyle='#000000';ctx.font='bold 20px sans-serif';ctx.fillText(t.toFixed(1)+' seconds',x+10,y+22);},{i,t});
 }
 await page.locator('#contact').screenshot({path:`research/evidence/gamified-reference/sequence-${batch+1}.png`});
 console.log('Captured sequence',batch+1,times);
}
await browser.close();
