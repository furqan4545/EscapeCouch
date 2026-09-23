"""Build a short-excerpt research export and a local, searchable evidence browser."""
from pathlib import Path
import collections
import datetime
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output'
OUT.mkdir(exist_ok=True)
posts = json.loads((ROOT / 'data/posts.json').read_text())
assert len({p['id'] for p in posts}) == len(posts)

# A second search response can omit duration. Recover only observed positive values.
durations = {}
for file in (ROOT / 'raw/search').glob('*.json'):
    for p in json.loads(file.read_text()).get('posts', []):
        if (p.get('durationSeconds') or 0) > 0:
            durations[p['id']] = p['durationSeconds']

annotations = {
    '7677540614002461985': ('Compare → reveal', 'Face-led calorie question; search thumbnail and metadata inspected.'),
    '7626786535215549729': ('Compare → reveal', 'Face with two plates; same question visible in search thumbnail.'),
    '7660914692809854241': ('Compare → reveal', 'Overhead portion comparison visible in search thumbnail.'),
    '7662078317817892128': ('Compare → reveal', 'Overhead portion comparison visible in search thumbnail.'),
    '7665744749533433121': ('Compare → reveal', 'Overhead portion comparison visible in search thumbnail.'),
    '7650175974226595102': ('Compare → reveal', 'Four-plate comparison described in caption; opening thumbnail visible.'),
    '7331085516437245226': ('Compare → reveal', 'Historical 2024 calorie-comparison example; metadata evidence.'),
    '7331789236556860714': ('Compare → reveal', 'Historical 2024 repetition; metadata evidence.'),
    '7665762605453118750': ('Compare → reveal', 'Lower-view comparison example; metadata evidence.'),
    '7673608726246411553': ('Compare → reveal', 'Lower-view app comparison; metadata evidence.'),
    '7598216751146355990': ('Cheap vs expensive', 'Razor comparison; repeated series identified in captions/search thumbnails.'),
    '7597845730899791126': ('Cheap vs expensive', 'Shop-vac comparison; series metadata evidence.'),
    '7598591248978496790': ('Cheap vs expensive', 'Controller comparison; series metadata evidence.'),
    '7630860752831761686': ('Cheap vs expensive', 'Duct-tape comparison; series metadata evidence.'),
    '7665089891419688214': ('Two types / expectation', 'Gym comedy candidate; metadata evidence.'),
    '7654794153447984397': ('Two types / expectation', 'Gym comedy candidate; metadata evidence.'),
    '7668744495046905110': ('Two types / expectation', 'Gym comedy candidate; metadata evidence.'),
    '7348500031562992938': ('Reaction', 'Historical 2024 dermatology duet; metadata evidence.'),
    '7682911522284195102': ('Reaction', 'Recent lower-view dermatology duet; metadata evidence.'),
    '7676112210552311070': ('Reaction', 'Recent lower-view dermatology duet; metadata evidence.'),
    '7665764946508139790': ('Blind ranking', 'Recent food ranking; metadata evidence.'),
    '7678941641448623381': ('Blind ranking', 'Recent training-split ranking; metadata evidence.'),
    '7444859216449277202': ('Before / after', 'Historical rug-cleaning example; metadata evidence.'),
    '7572022336094866701': ('Before / after', 'Pool-cleaning example; metadata evidence.'),
}

# Updated brief: retain food/product records only in the historical dataset.
annotations = {k: v for k, v in annotations.items() if v[0] in {'Reaction', 'Two types / expectation'}}
annotations['7659240499898748191'] = ('Reaction', 'Reaction candidate from search metadata; full clip and production effort unverified.')

export = []
for p in posts:
    duration = p.get('durationSeconds') or durations.get(p['id'])
    if p.get('photo'):
        duration = None
    p['durationSeconds'] = duration
    for field in ['views', 'likes', 'comments', 'shares', 'saves', 'followers']:
        assert p[field] is None or p[field] >= 0, (p['id'], field)
    words = re.findall(r'\S+', p.get('caption', ''))
    annotation = annotations.get(p['id'])
    export.append({
        **{key: p.get(key) for key in ['id', 'url', 'author', 'createdAt', 'collectedAt', 'views', 'likes', 'comments', 'shares', 'saves', 'durationSeconds', 'photo', 'adFlag', 'queries', 'sampleType']},
        'followersAtCollection': p.get('followers'),
        'captionExcerpt': ' '.join(words[:12]) + (' …' if len(words) > 12 else ''),
        'promotionStatus': 'Unknown; platform ad flag is not a complete promotion history',
        'shortlistFamily': annotation[0] if annotation else None,
        'inspection': annotation[1] if annotation else 'Search-result metadata only; not individually classified or watched',
    })

summary = {
    'collectedFrom': min(p['collectedAt'] for p in posts),
    'collectedTo': max(p['collectedAt'] for p in posts),
    'uniquePosts': len(posts),
    'uniqueCreators': len({p['author'] for p in posts}),
    'uniqueQueries': len({q for p in posts for q in p['queries']}),
    'photoPosts': sum(p['photo'] for p in posts),
    'videoPosts': sum(not p['photo'] for p in posts),
    'queries': dict(sorted(collections.Counter(q for p in posts for q in p['queries']).items())),
    'method': 'Public TikTok ranked search pages opened with Microsoft Playwright. Metadata from responses delivered to the browser. No complete consecutive profile sample.',
    'limitations': ['Ranked search selection bias; not a viral hit-rate dataset.', 'Public counts can be rounded or cached.', 'Follower counts are current, not historical.', 'Paid promotion status is unknown.', 'Full clip inspection paused after TikTok verification challenge.', 'Query labels are discovery lanes, not validated template labels.'],
}
(ROOT / 'data/posts.json').write_text(json.dumps(posts, ensure_ascii=False, indent=2))
(ROOT / 'data/search-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
(OUT / 'tiktok-posts.json').write_text(json.dumps({'summary': summary, 'posts': export}, ensure_ascii=False, indent=2))

template = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TikTok format evidence · September 2026</title>
<style>
:root{font:15px/1.5 system-ui,sans-serif;color:#e8edf5;background:#10161e;color-scheme:dark}*{box-sizing:border-box}body{margin:0}main{max-width:1400px;margin:auto;padding:36px 30px}header{max-width:1000px}h1{font-size:38px;line-height:1.1;letter-spacing:-1px;margin:8px 0 18px}h2{font-size:20px;margin-top:0}a{color:#80d6c6;text-underline-offset:3px}.eyebrow{color:#80d6c6;letter-spacing:2px;font-size:12px}p{color:#bcc6d5}.metrics,.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:26px 0}.metric,.card{background:#19232f;border:1px solid #2c3d50;padding:20px;border-radius:12px}.metric strong{display:block;font-size:32px}.metric span,.muted{color:#9facc0}.tag{font-size:11px;color:#91e3d2;letter-spacing:1px;text-transform:uppercase}.card p{margin-bottom:0}.caution{padding:16px 20px;border-left:3px solid #e1b776;background:#28251f;border-radius:4px;color:#e4d0ae}.toolbar{display:flex;align-items:end;gap:14px;flex-wrap:wrap;margin:32px 0 16px}label{font-size:12px;color:#b9c6d7;display:block}input,select{font:inherit;padding:10px 12px;border:1px solid #425267;border-radius:7px;background:#19232f;color:#edf2f7}input[type=search]{width:310px}.check{display:flex;align-items:center;gap:7px;padding:12px 0;font-size:14px}.table-wrap{overflow:auto;border:1px solid #2c3d50;border-radius:10px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:13px;text-align:left;border-bottom:1px solid #2c3d50;vertical-align:top}th{background:#1c2835;white-space:nowrap;color:#aebdd0}td.num{font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}td.post{min-width:330px;max-width:430px}td.notes{min-width:260px;max-width:360px;color:#b1bfd0}small{display:block;color:#99aabd;margin-top:5px}button{font:inherit;border:1px solid #43566b;background:#213547;color:#eaf1f7;padding:8px 14px;border-radius:7px;cursor:pointer}button:disabled{opacity:.35;cursor:default}.pagination{display:flex;justify-content:space-between;align-items:center;margin:18px 0}footer{margin:32px 0;color:#93a4b8;font-size:12px}.empty{text-align:center;padding:30px}@media(max-width:760px){main{padding:24px 16px}h1{font-size:31px}.cards,.metrics{grid-template-columns:1fr}.metrics{gap:8px}.metric{padding:12px 20px}.metric strong{font-size:26px}input[type=search]{width:100%}}
</style></head><body><main>
<header><div class="eyebrow">CONTENT-FIRST APP RESEARCH · 22 SEP 2026 KST</div><h1>Find the repeatable structure.<br>Then choose the niche.</h1><p>A first-pass evidence library for one personal-brand account and up to four supporting accounts. The earlier food recommendation is withdrawn. Priorities below require existing footage plus one short recording; they are candidates awaiting full clip inspection.</p><p><a href="REPORT.md">Research brief</a> · <a href="TEMPLATE_PACK.md">Filming templates</a> · <a href="tiktok-posts.json" download>Download metadata</a></p></header>
<section class="metrics"><div class="metric"><strong>425</strong><span>unique posts</span></div><div class="metric"><strong>340</strong><span>creators</span></div><div class="metric"><strong>21</strong><span>search phrases</span></div></section>
<section class="cards"><article class="card"><span class="tag">First research priority</span><h2>Source hook → matching cut</h2><p>An existing funny clip connects directly to one short action or line from you. Source-specific selection and editing remain to be validated; transition references are in the report.</p></article><article class="card"><span class="tag">Second research priority</span><h2>Clip → specific reaction</h2><p>One prepared observation or punchline from you. Research supplies the source and script; a fixed layout handles the edit. Exact filming burden is not yet verified.</p></article><article class="card"><span class="tag">Adaptation to test</span><h2>Existing footage → punchline</h2><p>Use footage already captured during your normal routine. Short gym humour has large examples, but the low-filming adaptation is not yet validated.</p></article></section>
<p class="caution">Food and product-testing recommendations have been removed. Their records remain available in the historical dataset with Shortlist only turned off. These are ranked search results, not consecutive account histories. High-view examples are overrepresented. Promotion status is unknown. Search thumbnails and metadata were inspected for selected posts; full-video inspection stopped at TikTok verification. “Shortlisted” means selected for review, not confirmed frame-by-frame.</p>
<div class="toolbar"><label>Search creator, excerpt or query<br><input id="search" type="search" placeholder="Try: reaction, gym, dermangelo"></label><label>Discovery lane<br><select id="query"><option value="">All search phrases</option></select></label><label>Order<br><select id="sort"><option value="views">Most views</option><option value="recent">Newest published</option><option value="shares">Most shares</option><option value="saves">Most saves</option></select></label><label class="check"><input id="shortlist" type="checkbox" checked>Shortlist only</label><label class="check"><input id="current" type="checkbox">2026 posts only</label></div>
<p id="count" aria-live="polite"></p><div class="table-wrap"><table><thead><tr><th>Post / original source</th><th>Published UTC</th><th>Views</th><th>Shares</th><th>Saves</th><th>Length</th><th>Evidence note</th></tr></thead><tbody id="rows"></tbody></table></div><div class="pagination"><button id="prev">← Previous</button><span id="page"></span><button id="next">Next →</button></div>
<footer>Collected 21 Sep 2026 UTC / 22 Sep KST using Microsoft Playwright. Counts are public snapshots and may be rounded. No reach, retention, conversion or historical follower analytics are available. This file works locally without fetching TikTok. The full JSON includes per-post search provenance and timestamps.</footer>
</main><script type="application/json" id="data">__DATA__</script><script>
const {posts,summary}=JSON.parse(document.getElementById('data').textContent);
const $=id=>document.getElementById(id);let page=0;const pageSize=25;
for(const q of Object.keys(summary.queries)){const o=document.createElement('option');o.value=q;o.textContent=q;$('query').append(o)}
const fmt=x=>x==null?'—':new Intl.NumberFormat('en-US').format(x);
function cell(tr,text,cls){const td=document.createElement('td');td.textContent=text;if(cls)td.className=cls;tr.append(td);return td}
function render(){const term=$('search').value.toLowerCase();const lane=$('query').value;const sort=$('sort').value;
const list=posts.filter(p=>(!$('shortlist').checked||p.shortlistFamily)&&(!$('current').checked||p.createdAt?.startsWith('2026'))&&(!lane||p.queries.includes(lane))&&(!term||[p.author,p.captionExcerpt,...p.queries].join(' ').toLowerCase().includes(term))).sort((a,b)=>sort==='recent'?(b.createdAt||'').localeCompare(a.createdAt||''):(b[sort]??-1)-(a[sort]??-1));
page=Math.min(page,Math.max(0,Math.ceil(list.length/pageSize)-1));$('count').textContent=`${fmt(list.length)} matching posts · ${$('shortlist').checked?'selected examples':'all discovered results; includes off-topic matches'}`;$('rows').replaceChildren();
for(const p of list.slice(page*pageSize,(page+1)*pageSize)){const tr=document.createElement('tr');const title=cell(tr,'','post');const a=document.createElement('a');a.href=p.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='@'+p.author;title.append(a);const caption=document.createElement('div');caption.textContent=p.captionExcerpt||'(No caption)';title.append(caption);const family=document.createElement('small');family.textContent=p.shortlistFamily||'Unclassified search result';title.append(family);cell(tr,p.createdAt?.slice(0,10)||'—');cell(tr,fmt(p.views),'num');cell(tr,fmt(p.shares),'num');cell(tr,fmt(p.saves),'num');cell(tr,p.photo?'Photo':p.durationSeconds?`${p.durationSeconds}s`:'Unknown','num');cell(tr,p.inspection,'notes');$('rows').append(tr)}
if(!list.length){const tr=document.createElement('tr');const td=cell(tr,'No matching posts. Clear a filter or turn off “Shortlist only”.','empty');td.colSpan=7;$('rows').append(tr)}
$('page').textContent=list.length?`Page ${page+1} of ${Math.ceil(list.length/pageSize)}`:'0 results';$('prev').disabled=page===0;$('next').disabled=(page+1)*pageSize>=list.length}
for(const id of ['search','query','sort','shortlist','current'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()});$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render()};render();
</script></body></html>'''
(OUT / 'evidence-browser.html').write_text(template.replace('__DATA__', json.dumps({'summary': summary, 'posts': export}, ensure_ascii=False).replace('<', '\\u003c')))
print(json.dumps(summary, indent=2))
