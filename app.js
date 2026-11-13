(function(){
'use strict';
const NAME='Word Bend';             // rename the game here (and in index.html <title>/<h1>)
const EPOCH=Date.UTC(2026,10,13);   // puzzle #1 = 13 Nov 2026 (local date)
const ANSWERS=window.DF_ANSWERS, VALID=new Set(window.DF_VALID);
ANSWERS.forEach(w=>VALID.add(w));
const LS='wordbend:';
const qs=new URLSearchParams(location.search);
const isLocal=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// ---------- daily word ----------
function dayIndex(d){return Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-EPOCH)/864e5);}
let today=new Date();
if(isLocal&&qs.get('date')){const p=qs.get('date').split('-').map(Number);today=new Date(p[0],p[1]-1,p[2]);}
const puzzleNo=dayIndex(today)+1;
const answer=ANSWERS[((puzzleNo-1)%ANSWERS.length+ANSWERS.length)%ANSWERS.length];
if(isLocal&&qs.has('debug')){window.__wb={answer,puzzleNo};console.log('[debug] answer:',answer);}

// ---------- storage ----------
const load=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(LS+k));return v==null?d:v;}catch(e){return d;}};
const save=(k,v)=>{try{localStorage.setItem(LS+k,JSON.stringify(v));}catch(e){}};
const settings=Object.assign({hard:false,dark:true,contrast:false},load('settings',{}));
let stats=Object.assign({played:0,wins:0,cur:0,max:0,dist:[0,0,0,0,0,0],lastWon:null,lastPlayed:null},load('stats',{}));
let state=load('state',null);
if(!state||state.puzzle!==puzzleNo) state={puzzle:puzzleNo,guesses:[],status:'playing',hard:settings.hard};

// ---------- leaderboard backend (Supabase RPCs; publishable key is safe client-side) ----------
const SB_URL='https://jhhjfgydktndtlhsjzvo.supabase.co',SB_KEY='sb_publishable_bdds9iFlNTu6ZpyobwADuA_dJ5s6wnP';
let deviceId=load('device',null);
if(!deviceId){deviceId=(crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));save('device',deviceId);}
async function rpc(fn,body){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),8000);
  try{const r=await fetch(SB_URL+'/rest/v1/rpc/'+fn,{method:'POST',signal:ac.signal,headers:{'apikey':SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(body||{})});
    if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(t);}}

// ---------- scoring with duplicate handling ----------
function score(guess,ans){
  const res=Array(5).fill('absent'),counts={};
  for(let i=0;i<5;i++){if(guess[i]===ans[i])res[i]='correct';else counts[ans[i]]=(counts[ans[i]]||0)+1;}
  for(let i=0;i<5;i++){if(res[i]!=='correct'&&counts[guess[i]]>0){res[i]='present';counts[guess[i]]--;}}
  return res;
}
const ORD=['1st','2nd','3rd','4th','5th'];
function hardModeError(guess){
  for(const g of state.guesses){
    const r=score(g,answer);
    for(let i=0;i<5;i++) if(r[i]==='correct'&&guess[i]!==g[i]) return ORD[i]+' letter must be '+g[i].toUpperCase();
    const need={};for(let i=0;i<5;i++) if(r[i]!=='absent') need[g[i]]=(need[g[i]]||0)+1;
    for(const ch in need){const have=guess.split('').filter(c=>c===ch).length;if(have<need[ch])return 'Guess must contain '+ch.toUpperCase();}
  }
  return null;
}

// ---------- DOM ----------
const $=s=>document.querySelector(s);
const board=$('#board'),kb=$('#keyboard');
const rows=[];
for(let r=0;r<6;r++){const row=document.createElement('div');row.className='row';const tiles=[];
  for(let c=0;c<5;c++){const t=document.createElement('div');t.className='tile';t.dataset.state='empty';row.appendChild(t);tiles.push(t);}
  board.appendChild(row);rows.push({el:row,tiles});}
const KEYS=['qwertyuiop','-asdfghjkl-','>zxcvbnm<'];
const keyEls={};
KEYS.forEach(line=>{const kr=document.createElement('div');kr.className='krow';
  for(const ch of line){
    if(ch==='-'){const s=document.createElement('div');s.className='half';kr.appendChild(s);continue;}
    const b=document.createElement('button');b.className='key';b.type='button';
    if(ch==='>'){b.textContent='enter';b.dataset.key='enter';b.classList.add('wide');}
    else if(ch==='<'){b.dataset.key='back';b.classList.add('wide');b.setAttribute('aria-label','backspace');
      b.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7.07L2.4 12l4.66-7H22v14zm-11.59-2L14 13.41 17.59 17 19 15.59 15.41 12 19 8.41 17.59 7 14 10.59 10.41 7 9 8.41 12.59 12 9 15.59z"/></svg>';}
    else {b.textContent=ch;b.dataset.key=ch;keyEls[ch]=b;}
    kr.appendChild(b);}
  kb.appendChild(kr);});

function sizeBoard(){const c=$('#board-container');const h=Math.min(420,c.clientHeight),w=Math.min(350,c.clientWidth,Math.floor(h*5/6));
  board.style.width=w+'px';board.style.height=Math.floor(w*6/5)+'px';
  const fs=Math.max(16,Math.floor(w/11));rows.forEach(r=>r.tiles.forEach(t=>t.style.fontSize=fs+'px'));}
window.addEventListener('resize',sizeBoard);

function toast(msg,ms=1000){const t=document.createElement('div');t.className='toast';t.textContent=msg;$('#toaster').prepend(t);
  if(ms>0)setTimeout(()=>{t.classList.add('fade');setTimeout(()=>t.remove(),300);},ms);}

const RANK={absent:1,present:2,correct:3};
function colorKeys(guess,res){for(let i=0;i<5;i++){const k=keyEls[guess[i]];if(!k)continue;const cur=k.dataset.state;
  if(!cur||RANK[res[i]]>RANK[cur])k.dataset.state=res[i];}}

// ---------- game ----------
let current='',busy=false;
const rowIdx=()=>state.guesses.length;
function renderCurrent(){const r=rows[rowIdx()];if(!r)return;
  r.tiles.forEach((t,i)=>{const ch=current[i]||'';if(t.textContent!==ch){t.textContent=ch;t.dataset.state=ch?'tbd':'empty';}});}

function restore(){state.guesses.forEach((g,ri)=>{const res=score(g,answer);rows[ri].tiles.forEach((t,i)=>{t.textContent=g[i];t.dataset.state=res[i];});colorKeys(g,res);});}

function shake(){const el=rows[rowIdx()].el;el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');setTimeout(()=>el.classList.remove('shake'),600);}

function press(k){
  if(busy||state.status!=='playing'||anyModalOpen())return;
  if(k==='enter')return submit();
  if(k==='back'){current=current.slice(0,-1);return renderCurrent();}
  if(/^[a-z]$/.test(k)&&current.length<5){current+=k;renderCurrent();}
}

function submit(){
  if(current.length<5){shake();return toast('Not enough letters');}
  if(!VALID.has(current)){shake();return toast('Not in word list');}
  if(state.hard){const e=hardModeError(current);if(e){shake();return toast(e);}}
  const guess=current,res=score(guess,answer),r=rows[rowIdx()];
  busy=true;current='';
  state.guesses.push(guess);
  const won=guess===answer,lost=!won&&state.guesses.length===6;
  if(won||lost){state.status=won?'won':'lost';updateStats(won);state.pendingSubmit=true;}
  save('state',state);if(state.pendingSubmit)submitResult();
  r.tiles.forEach((t,i)=>{setTimeout(()=>{t.classList.add('flip-in');
    setTimeout(()=>{t.classList.remove('flip-in');t.dataset.state=res[i];t.classList.add('flip-out');
      setTimeout(()=>t.classList.remove('flip-out'),250);},250);},i*300);});
  setTimeout(()=>{colorKeys(guess,res);busy=false;
    if(won){const msgs=['Genius','Magnificent','Impressive','Splendid','Great','Phew'];
      toast(msgs[state.guesses.length-1],2000);
      r.tiles.forEach((t,i)=>setTimeout(()=>{t.classList.add('bounce');setTimeout(()=>t.classList.remove('bounce'),1000);},i*100));
      setTimeout(()=>openModal('stats'),2400);}
    else if(lost){toast(answer.toUpperCase(),-1);setTimeout(()=>openModal('stats'),2400);}
  },4*300+500);
}

function updateStats(won){
  const hist=load('history',{});hist[puzzleNo]={won,guesses:state.guesses.length};save('history',hist);
  if(stats.lastPlayed===puzzleNo)return;
  stats.played++;stats.lastPlayed=puzzleNo;
  if(won){stats.wins++;stats.dist[state.guesses.length-1]++;stats.cur=(stats.lastWon===puzzleNo-1)?stats.cur+1:1;stats.lastWon=puzzleNo;stats.max=Math.max(stats.max,stats.cur);}
  else stats.cur=0;
  save('stats',stats);
}
// streak breaks if a day was missed
if(stats.lastWon!=null&&stats.lastWon<puzzleNo-1&&stats.cur){stats.cur=0;save('stats',stats);}

// ---------- modals ----------
const anyModalOpen=()=>!!document.querySelector('.overlay:not([hidden]),.screen:not([hidden])');
function openModal(n){closeModals();if(n==='stats')renderStats();$('#modal-'+n).hidden=false;}
function closeModals(){document.querySelectorAll('.overlay').forEach(o=>o.hidden=true);}
document.querySelectorAll('.overlay').forEach(o=>{o.addEventListener('click',e=>{if(o.dataset.required)return;if(e.target===o||e.target.closest('.close'))closeModals();});});
$('#btn-help').onclick=()=>openModal('help');
$('#btn-stats').onclick=()=>openModal('stats');
$('#btn-settings').onclick=()=>openModal('settings');

function renderStats(){
  $('#st-played').textContent=stats.played;
  $('#st-win').textContent=stats.played?Math.round(stats.wins/stats.played*100):0;
  $('#st-cur').textContent=stats.cur;$('#st-max').textContent=stats.max;
  const max=Math.max(1,...stats.dist),d=$('#dist');d.innerHTML='';
  stats.dist.forEach((n,i)=>{const row=document.createElement('div');row.className='drow';
    const hl=state.status==='won'&&state.guesses.length===i+1;
    row.innerHTML=`<div class="g">${i+1}</div><div class="barw"><div class="bar${hl?' hl':''}" style="width:${Math.max(7,Math.round(n/max*100))}%">${n}</div></div>`;d.appendChild(row);});
  $('#stats-footer').hidden=state.status==='playing';
}
function tick(){const now=new Date(),next=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
  let s=Math.max(0,Math.floor((next-now)/1000));if(qs.get('date'))s=Math.max(0,Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)-now)/1000));
  const p=n=>String(n).padStart(2,'0');$('#timer').textContent=`${p(Math.floor(s/3600))}:${p(Math.floor(s/60)%60)}:${p(s%60)}`;
  if(s===0&&!qs.get('date'))setTimeout(()=>location.reload(),1500);}
setInterval(tick,1000);tick();

// ---------- share ----------
function shareText(){const sq={correct:settings.contrast?'🟧':'🟩',present:settings.contrast?'🟦':'🟨',absent:settings.dark?'⬛':'⬜'};
  const n=state.status==='won'?state.guesses.length:'X';
  return `${NAME} ${puzzleNo.toLocaleString()} ${n}/6${state.hard?'*':''}${username?' — @'+username:''}\n\n`+state.guesses.map(g=>score(g,answer).map(s=>sq[s]).join('')).join('\n');}
async function copy(text){
  try{await navigator.clipboard.writeText(text);return true;}catch(e){}
  try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok;}catch(e){return false;}
}
$('#btn-share').onclick=async()=>{const t=shareText();window.__lastShare=t;
  if(await copy(t))toast('Copied results to clipboard',2000);
  else if(navigator.share){try{await navigator.share({text:t});}catch(e){}}
  else toast('Share failed',2000);};

// ---------- settings ----------
function applySettings(){
  document.body.classList.toggle('dark',settings.dark);document.body.classList.toggle('contrast',settings.contrast);
  document.querySelector('meta[name=theme-color]').content=settings.dark?'#121213':'#ffffff';
  $('#sw-hard').setAttribute('aria-checked',state.status==='playing'&&state.guesses.length?state.hard:settings.hard);$('#sw-dark').setAttribute('aria-checked',settings.dark);$('#sw-contrast').setAttribute('aria-checked',settings.contrast);
  $('#sw-hard').classList.toggle('disabled',state.guesses.length>0&&state.status==='playing');
  save('settings',settings);}
$('#sw-hard').onclick=()=>{
  if(state.guesses.length>0&&state.status==='playing'&&!state.hard)return toast('Hard mode can only be enabled at the start of a round',1500);
  settings.hard=!state.hard;if(state.status==='playing'&&state.guesses.length===0){state.hard=settings.hard;save('state',state);}
  applySettings();$('#sw-hard').setAttribute('aria-checked',settings.hard);};
$('#sw-dark').onclick=()=>{settings.dark=!settings.dark;applySettings();};
$('#sw-contrast').onclick=()=>{settings.contrast=!settings.contrast;applySettings();};
$('#puzzle-no').textContent='#'+puzzleNo;

// help examples
document.querySelectorAll('.ex-row').forEach(r=>{const w=r.dataset.word,[pos,st]=r.dataset.state.split(':');
  [...w].forEach((ch,i)=>{const t=document.createElement('div');t.className='tile';t.textContent=ch;t.dataset.state=i==+pos?st:'tbd';t.style.animation='none';r.appendChild(t);});});

// ---------- username ----------
let afterUserSaved=()=>{};
let username=load('username',null);
const USER_RE=/^[A-Za-z0-9_]{2,20}$/;
function renderUser(){const u=username?'@'+username:'';
  $('#hdr-user').textContent=u;$('#hdr-user').hidden=!username;$('#stats-user').textContent=u;$('#set-user').textContent=u;}
function openUser(changing){closeModals();const m=$('#modal-user');m.hidden=false;
  $('#user-close').hidden=!changing;m.dataset.required=changing?'':'1';
  const i=$('#user-input');i.value=username||'';i.classList.remove('bad');$('#user-err').textContent='';
  $('#user-save').textContent=changing?'Save':'Play';setTimeout(()=>i.focus(),50);}
$('#user-form').addEventListener('submit',async e=>{e.preventDefault();
  const v=$('#user-input').value.trim();
  const bad=m=>{$('#user-input').classList.add('bad');$('#user-err').textContent=m;};
  if(!USER_RE.test(v))return bad(v.length<2?'Username must be at least 2 characters':v.length>20?'Username must be 20 characters or fewer':'Use only letters, numbers or _');
  const btn=$('#user-save'),label=btn.textContent;btn.disabled=true;btn.textContent='Checking…';
  let synced=false;
  try{const r=await rpc('claim_username',{p_device:deviceId,p_name:v});
    if(r==='taken'){btn.disabled=false;btn.textContent=label;return bad('That username is taken');}
    if(r==='invalid'){btn.disabled=false;btn.textContent=label;return bad('Use only letters, numbers or _');}
    synced=r==='ok';
  }catch(err){/* offline: keep it locally, sync later */}
  btn.disabled=false;btn.textContent=label;
  const first=!username;username=v;save('username',v);save('userSynced',synced);renderUser();closeModals();
  if(synced)submitResult();
  if(synced)save('nameTaken',false);
  if(first)afterUserSaved(true);
  else{afterUserSaved(false);afterUserSaved=f=>{if(f)openCalendar();};toast(synced?'Username saved':'Saved on this phone (offline)',1400);}});
$('#user-input').addEventListener('input',()=>{$('#user-input').classList.remove('bad');$('#user-err').textContent='';});
$('#btn-change-user').onclick=()=>openUser(true);

// ---------- result submission ----------
async function submitResult(){
  if(!state.pendingSubmit||!username||!load('userSynced',false))return;
  try{const res=await rpc('submit_result',{p_device:deviceId,p_puzzle:state.puzzle,p_won:state.status==='won',p_guesses:state.status==='won'?state.guesses.length:6,p_hard:!!state.hard});
    if(res==='ok'||res==='duplicate'||res==='invalid'){state.pendingSubmit=false;save('state',state);}
    else if(res==='no_player'){save('userSynced',false);syncUser();}
  }catch(e){/* offline: retry on next load */}
}
async function syncUser(){
  if(!username||load('userSynced',false))return submitResult();
  try{const r=await rpc('claim_username',{p_device:deviceId,p_name:username});
    if(r==='ok'){save('userSynced',true);save('nameTaken',false);submitResult();}
    else if(r==='taken')save('nameTaken',true);
  }catch(e){}
}

// ---------- leaderboard modal ----------
let boardTab='today';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadBoard(){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===boardTab));
  const list=$('#board-list'),sub=$('#board-sub');list.innerHTML='<div class="board-empty">Loading…</div>';
  sub.textContent=boardTab==='today'?`Puzzle #${puzzleNo} · fewest guesses, then earliest finish`:'Most wins, then win %, then avg guesses';
  const tab=boardTab;
  try{const rows=tab==='today'?await rpc('get_today_board',{p_puzzle:puzzleNo,p_limit:50}):await rpc('get_alltime_board',{p_limit:50});
    if(tab!==boardTab)return;
    if(!rows.length){list.innerHTML='<div class="board-empty">'+(tab==='today'?'No winners yet today. Be the first!':'No results yet.')+'</div>';return;}
    const me=(username||'').toLowerCase();
    list.innerHTML=rows.map(r=>{const mine=r.username.toLowerCase()===me;
      const val=tab==='today'?`${r.guesses}/6<small>${new Date(r.finished_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</small>`
        :`${r.wins} wins<small>${r.win_pct}% · ${r.avg_guesses??'–'} avg · 🔥${r.current_streak}</small>`;
      return `<div class="brow${mine?' me':''}"><div class="rk">${r.rank}</div><div class="nm">@${esc(r.username)}${tab==='today'&&r.hard_mode?'<span class="hm">★ hard</span>':''}</div><div class="vl">${val}</div></div>`;}).join('');
  }catch(e){if(tab===boardTab)list.innerHTML='<div class="board-empty">Leaderboard unavailable right now. Check your connection.</div>';}
}
$('#btn-board').onclick=()=>{openModal('board');loadBoard();};
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{boardTab=t.dataset.tab;loadBoard();});

// ---------- input ----------
kb.addEventListener('click',e=>{const b=e.target.closest('.key');if(b){press(b.dataset.key);b.blur();}});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'){if(!$('#modal-user').hidden&&$('#modal-user').dataset.required)return;return closeModals();}
  if(!$('#modal-user').hidden)return;
  if(e.key==='Enter'){e.preventDefault();press('enter');}
  else if(e.key==='Backspace')press('back');
  else if(/^[a-zA-Z]$/.test(e.key))press(e.key.toLowerCase());
});

// ---------- init ----------
applySettings();restore();renderUser();sizeBoard();
// ---------- welcome + calendar ----------
(function(){const words=['WORD','BEND'],cols=[['g','a','y','g'],['y','g','a','g']];let k=0;
  words.forEach((w,ri)=>{const row=document.createElement('div');row.className='wl-row';
    [...w].forEach((ch,i)=>{const t=document.createElement('div');t.className='wl-tile '+cols[ri][i];t.textContent=ch;t.style.setProperty('--d',(0.15+k++*0.18)+'s');row.appendChild(t);});
    $('#wl-tiles').appendChild(row);});})();
const FIRST=new Date(2026,10,13);
let calMonth=new Date(today.getFullYear(),today.getMonth(),1);
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>{if(s.id!==id&&!s.hidden){s.classList.add('leaving');setTimeout(()=>{s.hidden=true;s.classList.remove('leaving');},350);}});
  if(id){const s=$('#'+id);s.hidden=false;}}
function renderCal(){
  const hist=load('history',{});if(state.status!=='playing')hist[puzzleNo]={won:state.status==='won',guesses:state.guesses.length};
  $('#cal-user').textContent=username?'@'+username:'';
  $('#cal-month').textContent=calMonth.toLocaleDateString([],{month:'long',year:'numeric'});
  $('#cal-prev').disabled=calMonth<=new Date(FIRST.getFullYear(),FIRST.getMonth(),1);
  $('#cal-next').disabled=calMonth>=new Date(today.getFullYear(),today.getMonth(),1);
  const g=$('#cal-days');g.innerHTML='';
  for(let i=0;i<calMonth.getDay();i++)g.appendChild(document.createElement('span'));
  const days=new Date(calMonth.getFullYear(),calMonth.getMonth()+1,0).getDate();
  for(let d=1;d<=days;d++){const dt=new Date(calMonth.getFullYear(),calMonth.getMonth(),d),n=dayIndex(dt)+1;
    const b=document.createElement('button');b.className='cday';b.type='button';b.innerHTML=`<span>${d}</span>`;b.disabled=true;
    const h=hist[n];
    if(n===puzzleNo){b.classList.add('today');b.disabled=false;b.setAttribute('aria-label','Play today’s challenge');
      if(h){b.classList.add(h.won?'won':'lost');b.innerHTML+=`<span class="r">${h.won?'✓ '+h.guesses+'/6':'✗ X/6'}</span>`;}
      else{b.classList.add('open');b.innerHTML+='<span class="r">PLAY</span>';}
      b.onclick=openGame;}
    else if(n>=1&&n<puzzleNo){b.classList.add('past');if(h){b.classList.add(h.won?'won':'lost');b.innerHTML+=`<span class="r">${h.won?'✓ '+h.guesses+'/6':'✗'}</span>`;}}
    g.appendChild(b);}
}
$('#cal-prev').onclick=()=>{calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()-1,1);renderCal();};
$('#cal-next').onclick=()=>{calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+1,1);renderCal();};
$('#cal-back').onclick=()=>showScreen('screen-welcome');
function openCalendar(){renderCal();showScreen('screen-cal');}
function openGame(){showScreen(null);
  if(!load('seenHelp',false)){save('seenHelp',true);setTimeout(()=>openModal('help'),360);}
  else if(state.status!=='playing')setTimeout(()=>openModal('stats'),500);}
afterUserSaved=first=>{if(first)openCalendar();};
$('#btn-start').onclick=()=>{if(!username)openUser(false);
  else if(load('nameTaken',false)){openUser(true);$('#user-err').textContent='That username is taken – please choose another';$('#user-input').classList.add('bad');afterUserSaved=()=>openCalendar();}
  else openCalendar();};
if(username)syncUser();
})();
