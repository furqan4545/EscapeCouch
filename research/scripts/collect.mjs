import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root='research';
await mkdir(`${root}/raw/search`,{recursive:true});
await mkdir(`${root}/data`,{recursive:true});
const queries = process.argv.slice(2);
if (!queries.length) throw new Error('Pass public TikTok search phrases as arguments.');
const nullableNumber = value => value == null ? null : Number(value);
function normalize(i,query) {
 const s=i.statsV2??i.stats??{}; const a=i.author??{};
 return {id:String(i.id),url:`https://www.tiktok.com/@${a.uniqueId}/${i.imagePost?'photo':'video'}/${i.id}`,
  author:a.uniqueId,authorName:a.nickname,followers:nullableNumber((i.authorStatsV2??i.authorStats)?.followerCount),
  createdAt:i.createTime?new Date(Number(i.createTime)*1000).toISOString():null,
  collectedAt:new Date().toISOString(),caption:i.desc??'',language:i.textLanguage??null,
  views:nullableNumber(s.playCount),likes:nullableNumber(s.diggCount),comments:nullableNumber(s.commentCount),
  shares:nullableNumber(s.shareCount),saves:nullableNumber(s.collectCount),durationSeconds:Number(i.video?.duration)>0?Number(i.video.duration):null,
  photo:!!i.imagePost,adFlag:i.isAd??null,pinned:!!i.isPinnedItem,
  sound:i.music?.title??'',soundAuthor:i.music?.authorName??'',
  stickers:(i.stickersOnItem??[]).flatMap(x=>x.stickerText??[]),
  queries:[query],sampleType:'ranked_search',
 };
}
let previous=[];try{previous=JSON.parse(await readFile(`${root}/data/posts.json`,'utf8'));}catch{}
const all=new Map(previous.map(p=>[p.id,p]));
let media={};try{media=JSON.parse(await readFile(`${root}/raw/media-references.json`,'utf8'));}catch{}
const logs=[];const runId=Date.now();
const context=await chromium.launchPersistentContext(`${root}/.browser-profile`,{headless:false,viewport:{width:1280,height:900}});
context.setDefaultTimeout(12000);
try {
 for (const query of queries) {
  const page=await context.newPage();let responses=0;let itemCount=0;const pending=[];
  const slug=query.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  page.on('response',response=>{
   if (!new URL(response.url()).pathname.startsWith('/api/search/')) return;
   const task=(async()=>{
    let j;try{j=await response.json();}catch{return;}
    const items=[...(Array.isArray(j.data)?j.data:[]).map(d=>d.item).filter(Boolean),...(j.itemList??[])];
    if(!items.length)return;responses++;itemCount+=items.length;
    const normalized=items.map(i=>normalize(i,query));
    await writeFile(`${root}/raw/search/${slug}-${responses}.json`,JSON.stringify({query,url:page.url(),collectedAt:new Date().toISOString(),posts:normalized},null,2));
    for(let n=0;n<items.length;n++){
     const i=items[n],p=normalized[n],old=all.get(p.id);
     p.queries=[...new Set([...(old?.queries??[]),query])];
     for(const key of ['followers','views','likes','comments','shares','saves','durationSeconds']){
      if(p[key]==null && old?.[key]!=null) p[key]=old[key];
     }
     all.set(p.id,p);
     media[p.id]={cover:i.video?.cover,subtitles:i.video?.subtitleInfos??[],video:i.video?.playAddr};
    }
   })();pending.push(task);
  });
  let status='ok',error=null;
  try{
   await page.goto(`https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelectorAll('a[href*="/video/"],a[href*="/photo/"]').length>3 || /verify to continue|drag the slider|complete the puzzle/i.test(document.body.innerText),{timeout:12000}).catch(()=>{});
   for(let round=0;round<2;round++){
    const body=await page.locator('body').innerText();
    if(/verify to continue|drag the slider|complete the puzzle|verify that you.re human/i.test(body)) {status='verification_required';break;}
    await page.mouse.wheel(0,1300);
    await page.waitForTimeout(1800);
   }
   await page.screenshot({path:`${root}/raw/search/${slug}.png`});
   await writeFile(`${root}/raw/search/${slug}.txt`,await page.locator('body').innerText());
  }catch(e){status='error';error=e.message;}
  await Promise.allSettled(pending);
  if(!itemCount&&status==='ok')status='no_items';
  logs.push({query,status,error,responses,itemCount});
  await writeFile(`${root}/data/posts.json`,JSON.stringify([...all.values()],null,2));
  await writeFile(`${root}/raw/media-references.json`,JSON.stringify(media,null,2));
  await writeFile(`${root}/data/collection-log-${runId}.json`,JSON.stringify(logs,null,2));
  console.log(JSON.stringify({query,status,responses,itemCount,totalUnique:all.size}));
  await page.close();
  if(status==='verification_required'){console.log('Stopped at verification. No challenge was solved or bypassed.');break;}
 }
}finally{await context.close();}
