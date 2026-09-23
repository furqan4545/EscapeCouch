import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const posts=JSON.parse(await readFile('research/data/posts.json','utf8'));
const media=JSON.parse(await readFile('research/raw/media-references.json','utf8'));
const selected=process.argv.slice(2).map(id=>posts.find(p=>p.id===id)).filter(Boolean);
const context=await chromium.launchPersistentContext('research/.browser-profile',{headless:false,viewport:{width:1280,height:900}});
await mkdir('research/evidence',{recursive:true});
try {
 for(const post of selected){
  const page=await context.newPage();const dir=`research/evidence/${post.id}`;await mkdir(dir,{recursive:true});
  const entry={...post,inspectionAt:new Date().toISOString(),frames:[],transcript:null,status:'not_loaded'};
  try{
   await page.goto(post.url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2 || /drag the slider|complete the puzzle|verify to continue/i.test(document.body.innerText),{timeout:15000}).catch(()=>{});
   const body=await page.locator('body').innerText();await writeFile(`${dir}/page.txt`,body);
   if(/drag the slider|complete the puzzle|verify to continue/i.test(body)){
    entry.status='verification_required';await page.screenshot({path:`${dir}/verification.png`});
   }else{
    const v=page.locator('video').first();
    if(await v.count()){
     const dimensions=await v.evaluate(el=>({duration:el.duration,width:el.videoWidth,height:el.videoHeight,readyState:el.readyState}));
     entry.player=dimensions;
     if(dimensions.readyState>=2&&dimensions.width>0){
      const duration=dimensions.duration;
      const times=[0.5,3,Math.min(8,duration/2),Math.min(16,duration-1)].filter((x,i,a)=>x>0&&x<duration&&a.indexOf(x)===i);
      for(const t of times){
       await v.evaluate((el,t)=>{el.pause();el.currentTime=t;},t);
       await page.waitForFunction(t=>{const v=document.querySelector('video');return v&&!v.seeking&&Math.abs(v.currentTime-t)<0.5;},t,{timeout:6000}).catch(()=>{});
       await v.screenshot({path:`${dir}/frame-${t}.png`});entry.frames.push(t);
      }
      entry.status='frames_captured';
     }else entry.status='player_not_ready';
    }else entry.status='no_player';
    const subtitle=media[post.id]?.subtitles?.find(x=>x.LanguageCodeName?.startsWith('eng'));
    if(subtitle?.Url){
     const r=await context.request.get(subtitle.Url,{timeout:15000});
     if(r.ok()){const txt=await r.text();if(txt.includes('WEBVTT')){await writeFile(`${dir}/captions.vtt`,txt);entry.transcript=`${dir}/captions.vtt`;}}
    }
   }
  }catch(e){entry.status='error';entry.error=e.message;}
  await writeFile(`${dir}/inspection.json`,JSON.stringify(entry,null,2));
  console.log(JSON.stringify({id:post.id,author:post.author,status:entry.status,frames:entry.frames,transcript:!!entry.transcript}));
  await page.close();
  if(entry.status==='verification_required')break;
 }
}finally{await context.close();}
