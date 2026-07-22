/* ============================================================
   ui.js — bottom-dock interface, input, audio glue, main loop (v2)
   ============================================================ */
'use strict';

function SFXp(n){try{if(typeof SFX2!=='undefined')SFX2.play(n);}catch(err){}}

const IS_TOUCH=(function(){
  try{return matchMedia('(pointer: coarse)').matches||'ontouchstart' in window;}catch(err){return false;}
})();
const UIS={mode:'none',buildType:null,selTower:null,selWall:null,hoverC:-1,hoverR:-1,hoverX:-1,hoverY:-1,tab:'towers',tapArmed:false,pendC:-1,pendR:-1,dragPlace:false};
let started=false;
let canvas,ctx;
const $=id=>document.getElementById(id);

function iconCanvas(kind,id,size){
  try{
    if(typeof SpriteLib==='undefined')return null;
    const src=SpriteLib.icon(kind,id);
    if(!src)return null;
    const cv=document.createElement('canvas');
    cv.width=size;cv.height=size;
    cv.getContext('2d').drawImage(src,0,0,size,size);
    cv.className='icon-cv';
    return cv;
  }catch(err){return null;}
}
function iconHtmlInto(el,kind,id,size,fallback){
  const cv=iconCanvas(kind,id,size);
  if(cv){el.innerHTML='';el.appendChild(cv);}
  else el.textContent=fallback;
}

/* ================= boot ================= */
window.addEventListener('DOMContentLoaded',()=>{
  canvas=$('game');ctx=canvas.getContext('2d');
  try{if(typeof loadThemePref==='function')loadThemePref();}catch(err){console.warn('theme load failed',err);}
  applyThemeChrome();
  try{if(typeof SpriteLib!=='undefined')SpriteLib.build();}catch(err){console.warn('SpriteLib.build failed',err);}
  if(IS_TOUCH){document.body.classList.add('touch');LOW_FX=true;}
  buildTowerCards();
  buildPremiumCards();
  buildSideBars();
  buildSpellBar();
  bindHud();
  window.addEventListener('resize',updateSidebarsVisible);
  bindCanvas();
  bindKeys();
  loadPrefs();
  showMapSelect();
  requestAnimationFrame(frame);
  setInterval(bgTick,250);
  setInterval(()=>{if(started&&G&&!G.over&&!G.villain)refreshCards();},300);
  document.addEventListener('pointerdown',()=>{
    try{if(typeof Music!=='undefined')Music.init();}catch(err){}
  },{passive:true});
});
function applyThemeChrome(){
  try{
    const reef=typeof THEME!=='undefined'&&THEME.flavor==='reef';
    const tt=$('tab-towers');
    if(tt)tt.innerHTML=(reef?'🪸':'🏰')+' Towers';
    const m=document.querySelector('meta[name="theme-color"]');
    if(m)m.setAttribute('content',reef?'#0a2430':'#1c1830');
  }catch(err){}
}
function loadPrefs(){
  try{
    if(localStorage.getItem('rs2_sfx')==='0'&&typeof SFX2!=='undefined')SFX2.setEnabled(false);
    if(localStorage.getItem('rs2_music')==='0'&&typeof Music!=='undefined')Music.setEnabled(false);
    const dockPref=localStorage.getItem('rs2_dock');
    if(dockPref==='0')setDock(false,true);
    else if(dockPref===null&&IS_TOUCH&&window.innerHeight<560)setDock(false,true); // phones: start canvas-first
  }catch(err){}
  refreshAudioBtns();
}

/* ================= main loop ================= */
let lastF=performance.now();
function frame(now){
  const dt=Math.min(0.1,(now-lastF)/1000);
  lastF=now;
  if(started&&G&&G.villain){
    villainStep(dt);
    drawVillain(ctx);
    refreshVillainHud();
    try{if(typeof Music!=='undefined'){const boss=G.enemies.some(e=>e.boss);Music.setIntensity(G.over?'calm':boss?'boss':'battle');Music.update(dt);}}catch(err){}
    requestAnimationFrame(frame);return;
  }
  if(started&&G){
    stepSim(dt);
    if(G.blitz>0&&!G.over&&!G.paused){
      const t0=performance.now();
      while(performance.now()-t0<12&&G.blitz>0&&!G.over){
        if(!G.waveActive)startWave(0);
        stepSim(1/30);
      }
    }
    drawFrame(ctx,UIS);
    refreshHud();
    try{
      if(typeof Music!=='undefined'){
        const boss=G.enemies.some(e=>e.boss);
        Music.setIntensity(G.over?'calm':boss?'boss':(G.waveActive?'battle':'calm'));
        Music.update(dt);
      }
    }catch(err){}
  }
  requestAnimationFrame(frame);
}
let lastBg=performance.now();
function bgTick(){
  const now=performance.now();
  const dt=Math.min(1,(now-lastBg)/1000);
  lastBg=now;
  if(document.hidden&&started&&G){
    if(G.villain)villainStep(dt);else stepSim(dt);
    try{if(typeof Music!=='undefined')Music.update(dt);}catch(err){}
  }
}

/* ================= overlays ================= */
function pathPreview(mdef,w,h){
  const cv=document.createElement('canvas');
  cv.width=w;cv.height=h;
  const c=cv.getContext('2d');
  const cols={meadow:['#3f7a38','#2e5c2c'],autumn:['#9a7434','#6e5224'],ashen:['#443f4e','#2b2733']}[mdef.theme];
  const g=c.createLinearGradient(0,0,0,h);
  g.addColorStop(0,cols[0]);g.addColorStop(1,cols[1]);
  c.fillStyle=g;c.fillRect(0,0,w,h);
  const sx=w/CFG.W,sy=h/CFG.H;
  c.lineCap='round';c.lineJoin='round';
  for(const cells of mdef.paths){
    c.strokeStyle='rgba(30,22,14,0.65)';c.lineWidth=7;
    c.beginPath();
    cells.forEach(([pc,pr],i)=>{
      const x=(pc*40+20)*sx,y=(pr*40+20)*sy;
      if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
    });
    c.stroke();
    c.strokeStyle='#c9a768';c.lineWidth=4;c.stroke();
  }
  c.fillStyle='#b4aec4';c.fillRect(w-16,h*0.42,10,h*0.16);
  c.fillStyle='#8d8798';c.fillRect(w-19,h*0.40,16,4);
  return cv;
}
function showMapSelect(){
  started=false;
  document.body.classList.remove('villain');
  const ov=$('overlay');
  const diffCol={Easy:'#6ad06a',Medium:'#e8c93a',Hard:'#e05a5a'};
  const TX=(typeof THEME!=='undefined'&&THEME.txt)?THEME.txt:{h1:'Castle Siege',h2:'Endless Defense',lore:'Choose your battlefield, commander.',themeBtn:'🪸 Switch theme'};
  let html='<div class="panel-box start-box"><h1>'+TX.h1+'</h1><h2>'+TX.h2+'</h2>'+
    '<p class="lore">'+TX.lore+'</p><div class="map-row">';
  for(const m of MAPS){
    const best=bestWave(m.id);
    html+='<div class="map-card" id="map-'+m.id+'">'+
      '<div class="map-prev" id="mp-'+m.id+'"></div>'+
      '<div class="map-name">'+m.name+'</div>'+
      '<div class="map-diff" style="color:'+diffCol[m.diff]+'">'+m.diff+' • '+m.paths.length+' path'+(m.paths.length>1?'s':'')+'</div>'+
      '<div class="map-desc">'+m.desc+'</div>'+
      (best?'<div class="map-best">Best: Wave '+best+'</div>':'')+
      '<div class="btn-row">'+
      (hasSave(m.id)?'<button class="small-btn" data-cont="'+m.id+'">▶ Continue</button>':'')+
      '<button class="small-btn gold" data-new="'+m.id+'">✦ New</button>'+
      (vaultPeak(m.id)?'<button class="small-btn peak" data-peak="'+m.id+'" title="Restart at wave 1 with your best-ever heroes, relics, troop levels and a rebuild budget">⭐ Peak (W'+vaultPeak(m.id).wave+')</button>':'')+
      '<button class="small-btn villbtn" data-vill="'+m.id+'" title="VILLAIN MODE: you are the besieger — flood creeps at an AI Citadel">😈 '+(vHasSave(m.id)?'Villain ▶':'Villain')+'</button>'+
      (vBestWave(m.id)?'<div class="map-best" style="color:#c060ff">😈 Siege best: W'+vBestWave(m.id)+'</div>':'')+
      '</div></div>';
  }
  html+='</div><p class="hint-line">Towers auto-fight • your army auto-resummons • progress autosaves every wave.<br>Built for leaving open while you work.</p>'+
    '<div class="btn-row" style="margin-top:10px;justify-content:center"><button class="small-btn" id="btnTheme">'+TX.themeBtn+'</button></div></div>';
  ov.innerHTML=html;
  ov.style.display='flex';
  for(const m of MAPS){
    $('mp-'+m.id).appendChild(pathPreview(m,240,120));
    const nb=ov.querySelector('[data-new="'+m.id+'"]');
    nb.onclick=()=>{try{localStorage.removeItem('rs2_save_'+m.id);}catch(err){};beginRun(m.id,false);};
    const cb=ov.querySelector('[data-cont="'+m.id+'"]');
    if(cb)cb.onclick=()=>beginRun(m.id,true);
    const pb=ov.querySelector('[data-peak="'+m.id+'"]');
    if(pb)pb.onclick=()=>{try{localStorage.removeItem('rs2_save_'+m.id);}catch(err){};beginRun(m.id,false,true);};
    const vb=ov.querySelector('[data-vill="'+m.id+'"]');
    if(vb)vb.onclick=()=>beginVillain(m.id,vHasSave(m.id));
  }
  const tb=ov.querySelector('#btnTheme');
  if(tb)tb.onclick=()=>{
    try{applyTheme(CUR_THEME==='reef'?'castle':'reef');}catch(err){console.warn('theme switch failed',err);return;}
    applyThemeChrome();
    try{if(typeof SpriteLib!=='undefined')SpriteLib.build();}catch(err){}
    buildTowerCards();buildSideBars();buildSpellBar();
    if(G){buildArmyCards();buildHeroCards();buildRelicCards();buildPremiumCards();refreshCards();}
    showMapSelect();
    SFXp('ui_click');
  };
}
function beginRun(mapId,cont,peak){
  $('overlay').style.display='none';
  delete bgCache[mapId];
  document.body.classList.remove('villain');
  if(peak)startPeakRun(mapId);
  else if(!cont||!loadGame(mapId))newGame(mapId);
  started=true;
  UIS.mode='none';UIS.selTower=null;UIS.selWall=null;
  buildSpellBar();buildArmyCards();buildHeroCards();buildRelicCards();buildPremiumCards();refreshCards();
  hideTowerDetail();setCursorHint('');
  closeMobilePanel();
  SFXp('horn_wave');
  if(!cont&&G&&!G.spun)showWheel();
}

/* ================= VILLAIN MODE UI ================= */
function beginVillain(mapId,cont){
  $('overlay').style.display='none';
  delete bgCache[mapId];
  document.body.classList.add('villain');
  if(!cont||!vLoadGame(mapId))newVillain(mapId);
  started=true;
  UIS.mode='none';UIS.buildType=null;UIS.selBarr=null;UIS.pendC=-1;UIS.pendR=-1;
  buildVillainDock();buildSideBars();buildSpellBar();updateSidebarsVisible();
  hideTowerDetail();setCursorHint('');closeMobilePanel();
  if(G.bossPending)showBossSelect();
  SFXp('horn_wave');
}
function refreshVillainHud(){
  $('stGold').textContent=fmt(G.dp);
  $('stLives').textContent=G.lives;
  $('stWave').textContent=G.wave+(G.wave%10===0?' 💀':'');
  const sp=$('spdCycle');if(sp){sp.textContent=G.speed+'×';sp.classList.toggle('active',G.speed>1);}
  for(const s of [1,2,3]){const b=$('spd'+s);if(b)b.classList.toggle('active',G.speed===s);}
  $('btnPause').textContent=G.paused?'▶':'⏸';
  refreshVillainDock();refreshSpellBar();refreshSideBars();updateSidebarsVisible();
}
function buildVillainDock(){
  const box=$('vBarrCards');box.innerHTML='';
  for(const def of VTROOPS){
    const d=document.createElement('div');
    d.className='card v-card';d.id='vc-'+def.id;d.dataset.vid=def.id;d.title=def.desc;
    d.innerHTML='<div class="card-icon" id="vci-'+def.id+'"></div>'+
      '<div class="card-name">'+vName(def)+'</div>'+
      '<div class="tgt-chip" style="color:'+V_TIER_COL[def.tier]+'">✦ '+def.tier+'</div>'+
      '<div class="troop-stats" id="vcs-'+def.id+'"></div>'+
      '<div class="card-cost" id="vcc-'+def.id+'">'+def.bcost+' DP</div>'+
      '<div class="lock-cover" id="vlk-'+def.id+'">🔒 W'+def.unlock+'</div>';
    d.onclick=()=>villainSelectBuild(def);
    box.appendChild(d);
  }
  const up=$('vUpCards');up.innerHTML='';
  for(const u of V_UPGR){
    const d=document.createElement('div');
    d.className='card v-up-card';d.id='vu-'+u.id;
    d.innerHTML='<div class="card-icon big" style="font-size:26px">'+u.ico+'</div>'+
      '<div class="card-name">'+u.name+' <span class="lvl-badge" id="vul-'+u.id+'"></span></div>'+
      '<div class="troop-stats rdesc">'+u.desc+'</div>'+
      '<button class="small-btn gold" id="vub-'+u.id+'"></button>';
    up.appendChild(d);
    $('vub-'+u.id).onclick=()=>{if(vBuyUpgrade(u.id))refreshVillainDock();};
  }
  $('vtab-barr').onclick=()=>villainTab('barr');
  $('vtab-up').onclick=()=>villainTab('up');
  $('vBossBtn').onclick=()=>{if(G.bossPending)showBossSelect();};
  $('vDock').onclick=()=>{const b=$('vdBody');b.style.display=b.style.display==='none'?'flex':'none';$('vDock').textContent=b.style.display==='none'?'▲':'▼';};
  setTimeout(()=>{for(const def of VTROOPS)villainIcon(def);},0);
  villainTab('barr');
  refreshVillainDock();
}
function villainIcon(def){
  const el=$('vci-'+def.id);if(!el)return;
  const cv=document.createElement('canvas');cv.width=40;cv.height=42;
  const g=cv.getContext('2d');g.translate(20,26);
  const e={def:{kind:def.kind,col:def.col,fly:def.fly,armor:def.armor},x:0,y:0,
    size:Math.min(13,def.size),anim:1.2,rarity:def.tier==='legendary'?'champ':null,boss:false,slowP:0,flash:0};
  try{drawEnemy(g,e);}catch(err){}
  el.innerHTML='';el.appendChild(cv);
}
function refreshVillainDock(){
  if(!G||!G.villain)return;
  const dp=$('vdDp');if(dp)dp.textContent=fmt(G.dp);
  const rt=$('vdRate');if(rt)rt.textContent=Math.round(vDpRate());
  for(const def of VTROOPS){
    const locked=def.unlock>G.wave;
    const lk=$('vlk-'+def.id);if(lk)lk.style.display=locked?'flex':'none';
    const el=$('vc-'+def.id);if(el)el.classList.toggle('cant',locked||G.dp<def.bcost);
    if(!locked){const st=vCreepStat(def,0);const cs=$('vcs-'+def.id);if(cs)cs.textContent='⚔ '+fmt(st.dmg)+' ❤ '+fmt(st.hp);}
  }
  for(const u of V_UPGR){
    const l=$('vul-'+u.id);if(l)l.textContent='Lv '+(G.up[u.id]||0);
    const c=vUpCost(u.id);const b=$('vub-'+u.id);if(b){b.textContent='Buy '+fmt(c)+' DP';b.disabled=G.dp<c;}
  }
  const bb=$('vBossBtn');if(bb)bb.style.display=G.bossPending?'inline-block':'none';
}
function villainSelectBuild(def){
  if(def.unlock>G.wave){setBanner(vName(def)+' unlocks at Wave '+def.unlock);SFXp('ui_click');return;}
  if(UIS.mode==='vbuild'&&UIS.buildType===def.id){villainCancelBuild();return;}
  UIS.mode='vbuild';UIS.buildType=def.id;UIS.selBarr=null;UIS.pendC=-1;UIS.pendR=-1;
  syncVillainSel();hideTowerDetail();
  setCursorHint(IS_TOUCH?'Tap twice to raise the barracks':'Double-click to raise the barracks');
  SFXp('ui_click');
}
function syncVillainSel(){
  document.querySelectorAll('#vBarrCards .card').forEach(x=>x.classList.toggle('selected',UIS.mode==='vbuild'&&x.dataset.vid===UIS.buildType));
}
function villainCancelBuild(){
  UIS.mode='none';UIS.buildType=null;UIS.pendC=-1;UIS.pendR=-1;clearPending();syncVillainSel();setCursorHint('');
}
function villainTab(t){
  $('vtab-barr').classList.toggle('active',t==='barr');
  $('vtab-up').classList.toggle('active',t==='up');
  $('vpane-barr').style.display=t==='barr'?'flex':'none';
  $('vpane-up').style.display=t==='up'?'flex':'none';
  SFXp('ui_tab');
}
function villainCanvasClick(p,c,r){
  if(G.targetMode&&G.targetMode.indexOf('vspell:')===0){vSpellAt(G.targetMode.slice(7),p.x,p.y);setCursorHint('');return;}
  if(UIS.mode==='vbuild'){
    if(UIS.justPlacedGhost){UIS.justPlacedGhost=false;return;}
    if(UIS.pendC===c&&UIS.pendR===r){
      if(vPlaceBarracks(UIS.buildType,c,r)){
        clearPending();setCursorHint('');refreshVillainDock();
        if(G.dp<VTROOP_BY[UIS.buildType].bcost)villainCancelBuild();
      }else setCursorHint(vCanBuildBarracks(UIS.buildType,c,r)?'':'Blocked tile or not enough DP');
    }else{
      UIS.pendC=c;UIS.pendR=r;UIS.hoverC=c;UIS.hoverR=r;
      setCursorHint(vCanBuildBarracks(UIS.buildType,c,r)?(IS_TOUCH?'Tap again to build':'Click again to build'):'Blocked tile / not enough DP');
    }
    return;
  }
  const b=G.barracks.find(x=>x.c===c&&x.r===r);
  if(b){villainBarracksDetail(b);SFXp('ui_click');}
  else{hideTowerDetail();UIS.selBarr=null;}
}
function villainBarracksDetail(b){
  UIS.selBarr=b;
  const def=VTROOP_BY[b.id],box=$('towerDetail');
  const st=vCreepStat(def,b.lvl),up=vBarracksUpCost(b);
  box.innerHTML='<div class="td-head">'+vName(def)+' Barracks <span class="lvl-badge">Lv '+b.lvl+'</span>'+
    '<button class="x-btn" id="btnTdClose">✕</button></div>'+
    '<div class="td-stats"><span style="color:'+V_TIER_COL[def.tier]+'">✦ '+def.tier+'</span><span>⚔ '+fmt(st.dmg)+'</span><span>❤ '+fmt(st.hp)+'</span><span>⏱ '+(def.cd/(1+b.lvl*0.14)).toFixed(1)+'s</span></div>'+
    '<div class="btn-row"><button class="small-btn gold" id="vbUp">⬆ '+fmt(up)+' DP</button>'+
    '<button class="small-btn danger" id="vbSell">Sell +'+fmt(Math.round(def.bcost*0.5))+'</button></div>';
  box.style.display='block';positionTowerDetail(b);
  $('vbUp').onclick=()=>{if(vUpgradeBarracks(b)){villainBarracksDetail(b);refreshVillainDock();}};
  $('vbSell').onclick=()=>{vSellBarracks(b);hideTowerDetail();UIS.selBarr=null;refreshVillainDock();};
  $('btnTdClose').onclick=()=>{hideTowerDetail();UIS.selBarr=null;};
}
function showBossSelect(){
  const ov=$('overlay');
  let html='<div class="panel-box start-box"><h1>💀 Choose Your Champion</h1><h2>Wave '+G.wave+' — Boss Fortress</h2>'+
    '<p class="lore">Unleash one boss upon the Citadel this wave.</p><div class="map-row">';
  const avail=VBOSSES.filter(x=>x.unlock<=G.wave);
  for(const b of avail){
    html+='<div class="map-card"><div class="map-name">'+vName(b)+'</div>'+
      '<div class="map-diff" style="color:'+V_TIER_COL[b.tier]+'">✦ '+b.tier+'</div>'+
      '<div class="map-desc">❤ '+fmt(b.hp)+' · ⚔ '+fmt(b.dmg)+(b.fly?' · ✈ flies':'')+(b.regen?' · ♻ regen':'')+(b.summons?' · 👹 summons':'')+'</div>'+
      '<div class="btn-row"><button class="small-btn gold" data-boss="'+b.id+'">💀 Unleash</button></div></div>';
  }
  html+='</div><p class="hint-line">Bigger bosses hit the Citadel far harder — but the fortress is tougher on boss waves.</p></div>';
  ov.innerHTML=html;ov.style.display='flex';
  ov.querySelectorAll('[data-boss]').forEach(btn=>btn.onclick=()=>{ov.style.display='none';vSelectBoss(btn.dataset.boss);});
}
function onVillainWave(){if(G&&G.bossPending)showBossSelect();refreshVillainDock();}
function onVillainOver(){
  const ov=$('overlay');
  ov.innerHTML='<div class="panel-box start-box"><h1>🛡 The Citadel Held</h1>'+
    '<p class="lore">Your siege of '+MAP.def.name+' was broken at <b>Wave '+G.wave+'</b>.</p>'+
    '<p class="stats-line">💀 Dread Score: '+fmt(G.score)+'</p>'+
    '<div class="btn-row"><button class="big-btn" id="btnVRetry">⟲ Besiege Again</button>'+
    '<button class="big-btn alt" id="btnVMaps">🗺 Menu</button></div></div>';
  ov.style.display='flex';
  $('btnVRetry').onclick=()=>beginVillain(G.mapId,false);
  $('btnVMaps').onclick=showMapSelect;
}
function onGameOver(){
  const ov=$('overlay');
  ov.innerHTML=
    '<div class="panel-box start-box">'+
    '<h1>'+((typeof THEME!=='undefined'&&THEME.txt)?THEME.txt.fallen:'☠ The Castle Has Fallen')+'</h1>'+
    '<p class="lore">'+MAP.def.name+' — you held until <b>Wave '+G.wave+'</b>.</p>'+
    '<p class="stats-line">⚔ '+fmt(G.kills)+' slain • 👑 '+G.bossKills+' bosses • 🪙 '+fmt(G.goldEarned)+' earned</p>'+
    '<div class="btn-row">'+
    '<button class="big-btn" id="btnRetry">⟲ Rise Again</button>'+
    '<button class="big-btn alt" id="btnMaps">🗺 Battlefields</button>'+
    '</div></div>';
  ov.style.display='flex';
  $('btnRetry').onclick=()=>beginRun(G.mapId,false);
  $('btnMaps').onclick=showMapSelect;
}
function toggleHelp(){
  const h=$('helpOverlay');
  h.style.display=h.style.display==='flex'?'none':'flex';
}

/* ================= HUD ================= */
function bindHud(){
  $('btnPause').onclick=()=>{if(!G)return;G.paused=!G.paused;};
  for(const s of [1,2,3])$('spd'+s).onclick=()=>{if(G){G.speed=s;}};
  $('spdCycle').onclick=()=>{if(G){G.speed=G.speed>=3?1:G.speed+1;SFXp('ui_click');}};
  $('btnSfx').onclick=()=>{
    if(typeof SFX2!=='undefined')SFX2.setEnabled(!SFX2.enabled);
    try{localStorage.setItem('rs2_sfx',(typeof SFX2!=='undefined'&&SFX2.enabled)?'1':'0');}catch(err){}
    refreshAudioBtns();
  };
  $('btnMusic').onclick=()=>{
    try{if(typeof Music!=='undefined'){Music.init();Music.setEnabled(!Music.enabled);}}catch(err){}
    try{localStorage.setItem('rs2_music',(typeof Music!=='undefined'&&Music.enabled)?'1':'0');}catch(err){}
    refreshAudioBtns();
  };
  $('btnHelp').onclick=toggleHelp;
  $('btnMenu').onclick=()=>{if(G&&!G.over){if(G.villain)vSaveGame();else saveGame();}showMapSelect();};
  $('helpOverlay').onclick=e=>{if(e.target.id==='helpOverlay')toggleHelp();};
  $('btnCloseHelp').onclick=toggleHelp;
  $('btnWave').onclick=()=>{
    if(G&&!G.waveActive){
      const bonus=G.autoWave?Math.max(0,Math.round(G.intermission*5)):15;
      startWave(bonus);
    }
  };
  $('btnAuto').onclick=()=>{if(G)G.autoWave=!G.autoWave;};
  for(const t of ['towers','premium','army','heroes','relics']){
    const tb=$('tab-'+t);if(tb)tb.onclick=()=>{setDock(true);switchTab(t);};
  }
  bindMobilePanel();
  $('btnDock').onclick=()=>setDock($('dockbody').style.display==='none');
  $('btnRally').onclick=()=>{UIS.mode='rally';UIS.selTower=null;if(G)G.targetMode=null;setCursorHint('Click near a road to set that road’s rally point');};
  const rt=$('railTog'),spt=$('spellTog');
  if(rt)rt.onclick=()=>{const b=document.body;b.classList.remove('spells-open');b.classList.toggle('rail-open');SFXp('ui_click');};
  if(spt)spt.onclick=()=>{const b=document.body;b.classList.remove('rail-open');b.classList.toggle('spells-open');SFXp('ui_click');};
  const mn=$('btnMines');
  if(mn)mn.onclick=()=>{if(G&&!G.over&&!G.villain){autoBuildMines();refreshCards();}};
  const bz=$('btnBlitz');
  if(bz)bz.onclick=()=>{
    if(!G||G.over)return;
    if(G.blitz>0){G.blitz=0;setBanner('⏩ Blitz cancelled');}
    else{G.blitz=10;G.paused=false;setBanner('⏩ BLITZ! Auto-fighting the next 10 waves at hyper speed…',true);}
    SFXp('ui_click');
  };
  const ub=$('btnUndo');
  if(ub)ub.onclick=()=>{
    if(!G||G.over)return;
    if(undoLast()){refreshCards();hideTowerDetail();UIS.selTower=null;SFXp('sell');}
    else setBanner('Nothing to undo');
  };
  for(const bk of [['bulk-towers','towers'],['bulk-troops','troops'],['bulk-heroes','heroes']]){
    const b=$(bk[0]);
    if(b)b.onclick=()=>{
      if(!G||G.over)return;
      if(!bulkUpgrade(bk[1]))setBanner('Nothing affordable to upgrade');
      refreshCards();
      if(UIS.selTower&&$('towerDetail').style.display==='block')showTowerDetail(UIS.selTower);
    };
  }
}
function switchTab(t){
  UIS.tab=t;
  for(const x of ['towers','premium','army','heroes','relics']){
    const tb=$('tab-'+x);
    if(tb)tb.classList.toggle('active',x===t);
    $('pane-'+x).style.display=x===t?'flex':'none';
  }
  document.querySelectorAll('.mp-tab').forEach(b=>b.classList.toggle('active',b.dataset.mp===t));
  SFXp('ui_tab');
}

/* ================= mobile management panel ================= */
let mpWasPaused=false;
function bindMobilePanel(){
  document.querySelectorAll('.mp-tab').forEach(b=>{b.onclick=()=>switchTab(b.dataset.mp);});
  $('mpClose').onclick=closeMobilePanel;
}
function openMobilePanel(tab){
  const mp=$('mobilePanel');
  if(mp.style.display!=='flex'){
    $('mpBody').appendChild($('dockbody'));
    $('dockbody').style.display='block';
    mp.style.display='flex';
    if(G){mpWasPaused=G.paused;G.paused=true;}
    SFXp('ui_open');
  }
  switchTab(tab);
  refreshCards();
}
function closeMobilePanel(){
  const mp=$('mobilePanel');
  if(mp.style.display!=='flex')return;
  mp.style.display='none';
  $('dock').appendChild($('dockbody'));
  if(G)G.paused=mpWasPaused;
  SFXp('ui_close');
}
function setDock(open,silent){
  $('dockbody').style.display=open?'block':'none';
  $('btnDock').textContent=open?'▼':'▲';
  try{localStorage.setItem('rs2_dock',open?'1':'0');}catch(err){}
  if(!silent)SFXp(open?'ui_open':'ui_close');
}
function refreshAudioBtns(){
  $('btnSfx').classList.toggle('off',!(typeof SFX2!=='undefined'&&SFX2.enabled));
  $('btnMusic').classList.toggle('off',!(typeof Music!=='undefined'&&Music.enabled));
}
function setCursorHint(txt){
  $('cursorHint').textContent=txt||'';
  $('cursorHint').style.display=txt?'block':'none';
}
function refreshHud(){
  $('stGold').textContent=fmt(G.gold);
  $('stLives').textContent=G.lives+'/'+maxLives();
  $('stWave').textContent=G.wave+(G.streak>1?' 🔥'+G.streak:'');
  const skel=G.troops.length-popCount();
  $('stPop').textContent=popCount()+'/'+popCap(G.wave)+(skel>0?' +'+skel+'💀':'');
  const bstat=$('stBuildWrap');
  if(bstat){bstat.style.display=G.builderSeen?'inline-flex':'none';$('stBuild').textContent=G.builders||0;}
  const btn=$('btnWave');
  if(G.waveActive){
    btn.textContent='⚔ '+(G.spawnQueue.length+G.enemies.length)+' foes';
    btn.disabled=true;
  }else{
    btn.disabled=false;
    if(G.autoWave)btn.textContent='Wave '+G.wave+' in '+Math.ceil(G.intermission)+'s (+'+Math.max(0,Math.round(G.intermission*5))+'g)';
    else btn.textContent='▶ Wave '+G.wave+' (+15g)';
  }
  for(const s of [1,2,3])$('spd'+s).classList.toggle('active',G.speed===s);
  $('spdCycle').textContent=G.speed+'×';
  $('spdCycle').classList.toggle('active',G.speed>1);
  $('btnAuto').classList.toggle('active',G.autoWave);
  $('btnAuto').textContent='AUTO'+(G.autoWave?' ✓':'');
  $('btnPause').textContent=G.paused?'▶':'⏸';
  const bz2=$('btnBlitz');
  if(bz2){bz2.classList.toggle('active',G.blitz>0);bz2.textContent=G.blitz>0?'⏩'+G.blitz:'⏩';}
  refreshSpellBar();
}

/* ================= tower cards ================= */
function buildTowerCards(){
  const box=$('towerCards');
  box.innerHTML='';
  for(const def of TOWERS){
    const d=document.createElement('div');
    d.className='card';
    d.id='tc-'+def.id;
    d.title=def.desc;
    const chip=def.wall?'🧱 blocks road':def.spawnTroop?'🏕 garrison':def.targets?(def.targets==='both'?'⛰＋✈ air':'⛰ ground'):(def.id==='mint'?'🪙 income':'✨ support');
    d.innerHTML='<div class="card-icon" id="ti-'+def.id+'"></div>'+
      '<div class="card-name">'+def.name+'</div>'+
      '<div class="tgt-chip">'+chip+'</div>'+
      '<div class="card-cost">'+def.cost+'g</div>';
    d.onclick=()=>selectBuildType(def);
    box.appendChild(d);
  }
  setTimeout(()=>{
    for(const def of TOWERS)iconHtmlInto($('ti-'+def.id),'tower',def.id,36,'🏰');
  },0);
}
function buildPremiumCards(){
  const box=$('premiumCards');
  if(!box)return;
  box.innerHTML='';
  const tierCol={legendary:'#ffb454',supreme:'#ff5a8a',divine:'#8ad4ff'};
  for(const def of PREM_TOWERS){
    const d=document.createElement('div');
    d.className='card prem-card prem-'+def.prem;
    d.id='pc-'+def.id;
    d.title=def.desc;
    d.innerHTML='<div class="card-icon" id="pi-'+def.id+'"></div>'+
      '<div class="card-name">'+def.name+'</div>'+
      '<div class="tgt-chip" style="color:'+tierCol[def.prem]+'">✦ '+def.tierName+'</div>'+
      '<div class="prem-build">🔨 '+def.buildWaves+' waves</div>'+
      '<div class="card-cost">'+fmt(def.cost)+'g</div>';
    d.onclick=()=>{
      if(!G)return;
      if(G.builders<1){setBanner('You need a free 🔨 Master Builder to raise a Premium Tower.');SFXp('ui_click');return;}
      if(G.gold<def.cost){setBanner('Need '+fmt(def.cost)+'g to raise the '+def.name+' (premium!)');SFXp('ui_click');return;}
      selectBuildType(def);
    };
    box.appendChild(d);
  }
  setTimeout(()=>{for(const def of PREM_TOWERS)iconHtmlInto($('pi-'+def.id),'tower',def.id,36,'✦');},0);
}
function refreshPremiumCards(){
  if(!G)return;
  const tab=$('tab-premium');
  if(tab)tab.style.display=G.builderSeen?'':'none';
  const mtab=$('mpPremTab');
  if(mtab)mtab.style.display=G.builderSeen?'':'none';
  const bstat=$('stBuildWrap');
  if(bstat){bstat.style.display=G.builderSeen?'inline-flex':'none';const bn=$('stBuild');if(bn)bn.textContent=G.builders||0;}
  const box=$('premiumCards');
  if(!box)return;
  const free=G.builders||0;
  for(const def of PREM_TOWERS){
    const el=$('pc-'+def.id);
    if(!el)continue;
    el.classList.toggle('cant',free<1||G.gold<def.cost);
  }
}
function selectBuildType(def){
  if(UIS.mode==='build'&&UIS.buildType===def.id){cancelMode();return;}
  UIS.mode='build';UIS.buildType=def.id;UIS.selTower=null;UIS.tapArmed=false;
  UIS.pendC=-1;UIS.pendR=-1;
  if(G)G.targetMode=null;
  syncBuildSelection();
  setCursorHint(IS_TOUCH?'Tap twice to build':'Double-click to build');
  hideTowerDetail();
  SFXp('ui_click');
}
function syncBuildSelection(){
  const on=UIS.mode==='build';
  document.querySelectorAll('#towerCards .card').forEach(x=>x.classList.toggle('selected',on&&x.id==='tc-'+UIS.buildType));
  document.querySelectorAll('#sideL .side-card').forEach(x=>x.classList.toggle('selected',on&&x.dataset.tid===UIS.buildType));
  document.querySelectorAll('#premiumCards .card').forEach(x=>x.classList.toggle('selected',on&&x.id==='pc-'+UIS.buildType));
}

/* ================= letterbox side strips (phones) ================= */
function villainIconInto(ic,def){
  const cv=document.createElement('canvas');cv.width=34;cv.height=36;
  const g=cv.getContext('2d');g.translate(17,22);
  const e={def:{kind:def.kind,col:def.col,fly:def.fly,armor:def.armor},x:0,y:0,
    size:Math.min(11,def.size),anim:1.2,rarity:def.tier==='legendary'?'champ':null,boss:false,slowP:0,flash:0,poison:[]};
  try{drawEnemy(g,e);}catch(err){}
  ic.innerHTML='';ic.appendChild(cv);
}
function buildSideBars(){
  const L=$('sideL');
  L.innerHTML='';
  if(typeof G!=='undefined'&&G&&G.villain){
    for(const def of VTROOPS){
      const d=document.createElement('div');
      d.className='side-card';d.dataset.vid=def.id;d.title=vName(def)+' — '+def.bcost+' DP';
      const ic=document.createElement('div');ic.className='card-icon';ic.style.width='32px';ic.style.height='32px';
      d.appendChild(ic);
      const c=document.createElement('div');c.className='sc-cost';c.textContent=def.bcost;d.appendChild(c);
      const lk=document.createElement('div');lk.className='sc-lock';lk.id='vsl-'+def.id;lk.textContent='🔒W'+def.unlock;d.appendChild(lk);
      d.onclick=()=>villainSelectBuild(def);
      L.appendChild(d);
      villainIconInto(ic,def);
    }
    return;
  }
  for(const def of TOWERS){
    const d=document.createElement('div');
    d.className='side-card';d.dataset.tid=def.id;d.title=def.name+' — '+def.cost+'g';
    const ic=document.createElement('div');
    ic.className='card-icon';ic.style.width='32px';ic.style.height='32px';
    d.appendChild(ic);
    const c=document.createElement('div');
    c.className='sc-cost';c.textContent=def.cost;
    d.appendChild(c);
    d.onclick=()=>selectBuildType(def);
    L.appendChild(d);
    iconHtmlInto(ic,'tower',def.id,30,'🏰');
  }
}
function refreshSideBars(){
  if(!G)return;
  if(G.villain){refreshVillainSideBars();return;}
  document.querySelectorAll('#sideL .side-card').forEach(x=>{
    const def=TOWER_BY[x.dataset.tid];
    if(def)x.classList.toggle('cant',G.gold<def.cost);
  });
  const R=$('sideR');
  const hs=G.heroes.filter(h=>h.recruited);
  const sig='m,'+hs.map(h=>h.id).join(',');
  if(R.dataset.sig!==sig){
    R.dataset.sig=sig;
    R.innerHTML='';
    /* management buttons: the phone's replacement for the bottom dock */
    const mgmt=[['⚔️','army','Army'],['🦸','heroes','Heroes'],['💎','relics','Relics']];
    for(const [ico,tab,ttl] of mgmt){
      const b=document.createElement('div');
      b.className='side-card mgmt';b.textContent=ico;b.title=ttl;
      b.onclick=()=>openMobilePanel(tab);
      R.appendChild(b);
    }
    const rb=document.createElement('div');
    rb.className='side-card mgmt';rb.textContent='🚩';rb.title='Set rally point';
    rb.onclick=()=>{UIS.mode='rally';if(G)G.targetMode=null;setCursorHint('Tap near a road to set that road’s rally point');SFXp('ui_click');};
    R.appendChild(rb);
    for(const h of hs){
      const d=document.createElement('div');
      d.className='side-card hero';d.dataset.hid=h.id;d.title=h.hdef.name+' — tap, then tap the map to move';
      const ic=document.createElement('div');
      ic.className='card-icon';ic.style.width='34px';ic.style.height='34px';
      d.appendChild(ic);
      d.onclick=()=>{
        const hh=G.heroes.find(x2=>x2.id===h.id);
        if(!hh||hh.dead)return;
        G.selHero=hh;UIS.mode='hero';G.targetMode=null;
        setCursorHint('Tap the map to post '+hh.hdef.name+' there');
        SFXp('ui_click');
      };
      R.appendChild(d);
      iconHtmlInto(ic,'hero',h.id,32,'🦸');
    }
  }
  R.querySelectorAll('.side-card').forEach(x=>{
    const hh=G.heroes.find(h2=>h2.id===x.dataset.hid);
    x.classList.toggle('dead',!!(hh&&hh.dead));
  });
}
function refreshVillainSideBars(){
  document.querySelectorAll('#sideL .side-card').forEach(x=>{
    const def=VTROOP_BY[x.dataset.vid];if(!def)return;
    const locked=def.unlock>G.wave;
    x.classList.toggle('cant',locked||G.dp<def.bcost);
    x.classList.toggle('selected',UIS.mode==='vbuild'&&UIS.buildType===def.id);
    const lk=$('vsl-'+def.id);if(lk)lk.style.display=locked?'flex':'none';
  });
  const R=$('sideR');
  const sig='v,'+(G.bossPending?'b':'');
  if(R.dataset.sig!==sig){
    R.dataset.sig=sig;R.innerHTML='';
    for(const u of V_UPGR){
      const b=document.createElement('div');
      b.className='side-card mgmt';b.dataset.vup=u.id;b.title=u.name+' — '+u.desc;
      b.innerHTML=u.ico+'<div class="sc-cost" id="vusr-'+u.id+'"></div>';
      b.onclick=()=>{if(vBuyUpgrade(u.id)){refreshSideBars();if(typeof refreshVillainDock==='function')refreshVillainDock();}};
      R.appendChild(b);
    }
    if(G.bossPending){
      const bb=document.createElement('div');bb.className='side-card mgmt';bb.textContent='💀';bb.title='Choose a boss';
      bb.onclick=()=>showBossSelect();R.appendChild(bb);
    }
  }
  R.querySelectorAll('[data-vup]').forEach(x=>{
    const id=x.dataset.vup;
    x.classList.toggle('cant',G.dp<vUpCost(id));
    const s=$('vusr-'+id);if(s)s.textContent='L'+(G.up[id]||0);
  });
}
function updateSidebarsVisible(){
  if(!started||!IS_TOUCH){document.body.classList.remove('sidebars','rail-open','spells-open');return;}
  const r=canvas.getBoundingClientRect();
  const scale=Math.min(r.width/CFG.W,r.height/CFG.H);
  const band=(r.width-CFG.W*scale)/2;
  document.body.classList.toggle('sidebars',band>=58);
}
function cancelMode(){
  UIS.mode='none';UIS.buildType=null;UIS.tapArmed=false;
  UIS.pendC=-1;UIS.pendR=-1;UIS.dragPlace=false;
  const cb=$('confirmBar');if(cb)cb.style.display='none';
  if(G)G.targetMode=null;
  syncBuildSelection();
  setCursorHint('');
}
function showTowerDetail(t){
  UIS.selTower=t;
  const def=TOWER_BY[t.id];
  if(t.building){
    const box=$('towerDetail');
    const done=t.buildTotal-t.buildLeft;
    box.innerHTML='<div class="td-head">🔨 '+def.name+' <span class="lvl-badge">building</span>'+
      '<button class="x-btn" id="btnTdClose">✕</button></div>'+
      '<div class="td-stats"><span>'+done+' / '+t.buildTotal+' waves raised</span><span>'+t.buildLeft+' to go</span></div>'+
      '<div class="btn-row"><button class="small-btn danger" id="btnScrap">Scrap (refund builder + '+fmt(Math.round(def.cost*0.5))+'g)</button></div>';
    box.style.display='block';
    $('btnScrap').onclick=()=>{G.gold+=Math.round(def.cost*0.5);G.builders++;G.towers=G.towers.filter(x=>x!==t);hideTowerDetail();UIS.selTower=null;refreshCards();SFXp('sell');};
    $('btnTdClose').onclick=()=>{hideTowerDetail();UIS.selTower=null;};
    positionTowerDetail(t);
    return;
  }
  const st=towerStat(def,t.lvl);
  const box=$('towerDetail');
  let stats='';
  const dmul=t.auraMul*(1+relicVal('engineering'));
  if(def.targets)stats+='<span>'+(def.targets==='both'?'⛰＋✈ hits air':'⛰ ground only')+'</span>';
  if(st.dmg)stats+='<span>⚔ '+fmt(st.dmg*dmul)+(st.rate?' × '+st.rate.toFixed(1)+'/s':'')+'</span>';
  if(st.range)stats+='<span>◎ '+Math.round(st.range)+'</span>';
  if(st.splash)stats+='<span>💥 '+Math.round(st.splash)+'</span>';
  if(st.slow)stats+='<span>❄ '+Math.round(st.slow*100)+'%</span>';
  if(st.burn)stats+='<span>🔥 '+fmt(st.burn)+'/s</span>';
  if(st.poison)stats+='<span>☠ '+fmt(st.poison)+'/s ×6</span>';
  if(st.chain)stats+='<span>⚡ ×'+st.chain+'</span>';
  if(st.pierce)stats+='<span>➤ '+st.pierce+'</span>';
  if(st.income)stats+='<span>🪙 +'+st.income+'g/5s</span>';
  if(st.aura)stats+='<span>✨ +'+Math.round(st.aura*100)+'%</span>';
  if(def.prem){stats+='<span style="color:#ffb454">✦ '+def.tierName+'</span>';}
  if(t.id==='pHeal')stats+='<span>💚 '+fmt(premHealAmt(t))+'/0.55s aura</span>';
  if(t.id==='pStorm')stats+='<span>🌩 random calamities</span>';
  if(t.id==='pGod'){const gm=GOD_BY[t.godMode];stats+='<span>🎲 this wave: '+(gm?gm.ico+' '+gm.name:'—')+'</span>';}
  const stars=towerRank(t);
  if(stars>0)stats+='<span>★'.repeat(1)+stars+' veteran +'+(stars*3)+'% ⚔ ('+(t.kills||0)+' kills)</span>';
  else if(t.kills)stats+='<span>'+t.kills+' kills</span>';
  const maxed=t.lvl>=CFG.MAX_TOWER_LVL;
  const upCost=maxed?0:towerUpCost(def,t.lvl);
  const tierTag=(t.tier||1)>1?(t.tier===2?' <span class="lvl-badge" style="color:#c8ccd8">⟡ SILVER</span>':' <span class="lvl-badge">★ GOLD</span>'):'';
  box.innerHTML='<div class="td-head">'+def.name+' <span class="lvl-badge">Lv '+t.lvl+(maxed?' MAX':'')+'</span>'+tierTag+
    '<button class="x-btn" id="btnTdClose">✕</button></div>'+
    '<div class="td-stats">'+stats+'</div>'+
    '<div class="btn-row">'+
    (maxed?'':'<button class="small-btn gold" id="btnUp">⬆ '+fmt(upCost)+'g</button>'+
      '<button class="small-btn gold" id="btnUpMax" title="Max THIS tower">⏫ Max</button>'+
      '<button class="small-btn gold" id="btnUpAll" title="Upgrade EVERY tower & wall to max, cheapest first, until gold runs out">⏫ All</button>')+
    (maxed&&(t.tier||1)<3?'<button class="small-btn gold" id="btnPromo" title="Permanent tier promotion: +40% damage and +8% range per tier">'+((t.tier||1)===1?'⟡ Silver ':'★ Gold ')+fmt(towerPromoCost(def,t.tier||1))+'g</button>':'')+
    '<button class="small-btn danger" id="btnSell">Sell +'+fmt(Math.round(towerInvested(def,t.lvl)*0.7))+'g</button>'+
    '</div>';
  box.style.display='block';
  if(!maxed)$('btnUp').onclick=()=>{if(upgradeTower(t)){showTowerDetail(t);positionTowerDetail(t);}};
  if(!maxed)$('btnUpMax').onclick=()=>{if(upgradeTowerMax(t)>0){showTowerDetail(t);positionTowerDetail(t);refreshCards();}};
  if(!maxed){const ba=$('btnUpAll');if(ba)ba.onclick=()=>{bulkUpgrade('towers');if(G.towers.includes(t))showTowerDetail(t);else{hideTowerDetail();UIS.selTower=null;}refreshCards();};}
  const pb2=$('btnPromo');
  if(pb2)pb2.onclick=()=>{if(promoteTower(t)){showTowerDetail(t);positionTowerDetail(t);refreshCards();}};
  $('btnSell').onclick=()=>{sellTower(t);hideTowerDetail();UIS.selTower=null;};
  $('btnTdClose').onclick=()=>{hideTowerDetail();UIS.selTower=null;};
}
function hideTowerDetail(){$('towerDetail').style.display='none';}
function showWallDetail(w){
  UIS.selWall=w;UIS.selTower=null;
  const box=$('towerDetail');
  const upC=wallUpCost(w.lvl);
  const repC=Math.round(TOWER_BY.wall.cost*0.4*(1-w.hp/w.maxHp)*Math.pow(1.4,w.lvl-1))+10;
  box.innerHTML='<div class="td-head">'+TOWER_BY.wall.name+' <span class="lvl-badge">Lv '+w.lvl+'</span>'+
    '<button class="x-btn" id="btnTdClose">✕</button></div>'+
    '<div class="td-stats"><span>🛡 '+fmt(Math.round(w.hp))+' / '+fmt(w.maxHp)+'</span><span>blocks its road while it stands</span></div>'+
    '<div class="btn-row">'+
    '<button class="small-btn gold" id="btnWUp">⬆ Reinforce '+fmt(upC)+'g</button>'+
    '<button class="small-btn gold" id="btnWAll" title="Upgrade EVERY tower & wall to max, cheapest first, until gold runs out">⏫ All</button>'+
    (w.hp<w.maxHp?'<button class="small-btn" id="btnWRep">🔧 Repair '+fmt(repC)+'g</button>':'')+
    '<button class="small-btn danger" id="btnWSell">Sell +'+fmt(Math.round(TOWER_BY.wall.cost*0.5))+'g</button>'+
    '</div>';
  box.style.display='block';
  $('btnWUp').onclick=()=>{if(upgradeWall(w)){showWallDetail(w);positionTowerDetail(w);}};
  {const ba=$('btnWAll');if(ba)ba.onclick=()=>{bulkUpgrade('towers');if(G.walls.includes(w))showWallDetail(w);else{hideTowerDetail();UIS.selWall=null;}refreshCards();};}
  const rp=$('btnWRep');
  if(rp)rp.onclick=()=>{if(repairWall(w)){showWallDetail(w);positionTowerDetail(w);}};
  $('btnWSell').onclick=()=>{sellWall(w);hideTowerDetail();UIS.selWall=null;};
  $('btnTdClose').onclick=()=>{hideTowerDetail();UIS.selWall=null;};
  positionTowerDetail(w);
}
function positionTowerDetail(t){
  const box=$('towerDetail'),stage=$('stage');
  const r=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();
  const scale=Math.min(r.width/CFG.W,r.height/CFG.H);
  const ox=(r.width-CFG.W*scale)/2+(r.left-sr.left);
  const oy=(r.height-CFG.H*scale)/2+(r.top-sr.top);
  const bw=box.offsetWidth||250,bh=box.offsetHeight||120;
  let left=ox+t.x*scale-bw/2;
  let top=oy+(t.y-70)*scale-bh; // prefer above the tower
  if(top<6)top=oy+(t.y+30)*scale; // flip below
  left=clamp(left,6,sr.width-bw-6);
  top=clamp(top,6,sr.height-bh-6);
  box.style.left=left+'px';
  box.style.top=top+'px';
  box.style.bottom='auto';
}

/* ================= spell bar ================= */
function curSpellList(){return (typeof G!=='undefined'&&G&&G.villain)?V_SPELLS:SPELLS;}
function buildSpellBar(){
  const bar=$('spellbar');
  bar.innerHTML='';
  const villain=(typeof G!=='undefined'&&G&&G.villain);
  const list=curSpellList();
  for(const def of list){
    const ult=def.id==='ragnarok'||def.id==='apocalypse';
    const b=document.createElement('button');
    b.className='spell-btn'+(ult?' ult':'')+(villain?' evil':'');
    b.id='sp-'+def.id;
    b.title=def.name+' — '+def.desc;
    b.innerHTML='<div class="spell-ico" id="spi-'+def.id+'"></div>'+
      '<div class="spell-cd" id="spc-'+def.id+'"></div>'+
      '<div class="spell-cdtxt" id="spt-'+def.id+'"></div>';
    b.onclick=()=>{
      if(!G||G.over)return;
      if(G.villain){
        if(G.targetMode==='vspell:'+def.id){G.targetMode=null;setCursorHint('');return;}
        if(vCastSpell(def.id)){
          if(def.target)setCursorHint(IS_TOUCH?'Tap the defenses to curse them':'Click the defenses to curse them');
        }else if((G.vspells[def.id]||0)>0){
          setCursorHint(def.name+' recharges in '+Math.ceil(G.vspells[def.id])+'s');
          setTimeout(()=>{if($('cursorHint').textContent.indexOf('recharges')>=0)setCursorHint('');},1500);
        }
        SFXp('ui_click');return;
      }
      if(G.targetMode==='spell:'+def.id){G.targetMode=null;setCursorHint('');return;}
      if(castSpell(def.id)){
        if(def.target)setCursorHint(def.id==='blessing'
          ?(IS_TOUCH?'Tap where to sanctify the ground':'Click where to sanctify the ground')
          :(IS_TOUCH?'Tap where the fire should fall':'Click where the fire should fall'));
        refreshCards();
      }else if(G.spells[def.id]>0){
        setCursorHint(def.name+' recharges in '+Math.ceil(G.spells[def.id])+'s');
        setTimeout(()=>{if($('cursorHint').textContent.indexOf('recharges')>=0)setCursorHint('');},1500);
      }
      SFXp('ui_click');
    };
    bar.appendChild(b);
  }
  setTimeout(()=>{
    for(const def of list)iconHtmlInto($('spi-'+def.id),'misc',def.icon,IS_TOUCH?40:34,'✦');
  },0);
}
function refreshSpellBar(){
  if(!G)return;
  const villain=G.villain;
  const list=curSpellList();
  const cds=villain?G.vspells:G.spells;
  const pre=villain?'vspell:':'spell:';
  for(const def of list){
    const cd=cds[def.id],ready=cd<=0;
    const btn=$('sp-'+def.id);
    if(!btn)continue;
    btn.classList.toggle('ready',ready);
    btn.classList.toggle('targeting',G.targetMode===pre+def.id);
    const pct=ready?0:clamp(cd/def.cd,0,1)*100;
    $('spc-'+def.id).style.height=pct+'%';
    $('spt-'+def.id).textContent=ready?'':(cd>=60?Math.ceil(cd/60)+'m':Math.ceil(cd)+'s');
  }
}

/* ================= army cards ================= */
function buildArmyCards(){
  const box=$('armyCards');
  box.innerHTML='';
  for(const def of TROOPS){
    if(def.summon)continue;
    const d=document.createElement('div');
    d.className='card troop-card';
    d.id='ac-'+def.id;
    d.title=def.desc;
    const tchip=def.heal?'💚 support':(def.melee?'⚔ melee':'🏹 ranged • hits ✈');
    d.innerHTML=
      '<div class="card-icon" id="ai-'+def.id+'"></div>'+
      '<div class="card-name">'+def.name+' <span class="lvl-badge" id="al-'+def.id+'"></span></div>'+
      '<div class="tgt-chip">'+tchip+'</div>'+
      '<div class="troop-stats" id="as-'+def.id+'"></div>'+
      '<div class="stepper"><button class="step-btn" id="dec-'+def.id+'">−</button>'+
      '<span class="step-val" id="cnt-'+def.id+'">0</span>'+
      '<button class="step-btn" id="inc-'+def.id+'">+</button></div>'+
      '<div class="btn-row tight">'+
      '<button class="small-btn" id="sum-'+def.id+'">+1</button>'+
      '<button class="small-btn gold" id="upt-'+def.id+'">⬆</button>'+
      '<button class="small-btn gold" id="mxt-'+def.id+'" title="Upgrade this troop to max level">⏫</button>'+
      '</div>'+
      '<div class="lock-cover" id="lk-'+def.id+'">🔒 W'+def.unlock+'</div>';
    box.appendChild(d);
    $('inc-'+def.id).onclick=()=>{G.desired[def.id]=Math.min(24,G.desired[def.id]+1);refreshCards();SFXp('ui_click');};
    $('dec-'+def.id).onclick=()=>{G.desired[def.id]=Math.max(0,G.desired[def.id]-1);refreshCards();SFXp('ui_click');};
    $('sum-'+def.id).onclick=()=>{summonTroop(def.id,false);refreshCards();};
    $('upt-'+def.id).onclick=()=>{
      if(G.troopLvl[def.id]>=CFG.MAX_TROOP_LVL)promoteTroop(def.id);
      else upgradeTroopType(def.id);
      refreshCards();
    };
    $('mxt-'+def.id).onclick=()=>{
      let g=0;while(G.troopLvl[def.id]<CFG.MAX_TROOP_LVL&&upgradeTroopType(def.id))g++;
      if(!g&&G.troopLvl[def.id]>=CFG.MAX_TROOP_LVL)promoteTroop(def.id);
      refreshCards();
    };
  }
  setTimeout(()=>{
    for(const def of TROOPS)if(!def.summon)iconHtmlInto($('ai-'+def.id),'troop',def.id,36,'⚔️');
  },0);
}

/* ================= hero cards ================= */
function buildHeroCards(){
  const box=$('heroCards');
  box.innerHTML='';
  for(const def of HEROES){
    const d=document.createElement('div');
    d.className='card hero-card'+(def.legendary?' legendary':'');
    d.id='hc-'+def.id;
    d.innerHTML=
      '<div class="card-icon big" id="hi-'+def.id+'"></div>'+
      '<div class="card-name">'+def.name+' <span class="lvl-badge" id="hl-'+def.id+'"></span></div>'+
      '<div class="hero-title">'+def.title+'</div>'+
      '<div class="hero-hp"><div class="hero-hp-fill" id="hhp-'+def.id+'"></div></div>'+
      '<div class="troop-stats" id="hs-'+def.id+'"></div>'+
      '<div class="skill-line" id="hsk-'+def.id+'" title="'+def.skill.desc+'"></div>'+
      '<div class="btn-row tight" id="hb-'+def.id+'"></div>'+
      '<div class="lock-cover" id="hlk-'+def.id+'"></div>';
    box.appendChild(d);
  }
  setTimeout(()=>{
    for(const def of HEROES)iconHtmlInto($('hi-'+def.id),'hero',def.id,44,'🦸');
  },0);
}
function refreshHeroCards(){
  for(const h of G.heroes){
    const def=h.hdef;
    const lock=$('hlk-'+def.id);
    const unlocked=heroUnlocked(h);
    const uw=heroEffUnlock(def);
    if(!unlocked){
      lock.style.display='flex';
      if(def.legendary)lock.innerHTML='<div class="mystery">🔮 ??? <span>'+(((typeof THEME!=='undefined')&&THEME.txt)?THEME.txt.mystery:'A legendary champion.<br>Shadow Wardens hold them captive — slay one to set them free, forever.')+'</span></div>';
      else lock.textContent='🔒 Wave '+uw;
      continue;
    }
    lock.style.display='none';
    $('hl-'+def.id).textContent='Lv '+h.lvl+(h.divine?' 🔥':h.asc?' ✨':'');
    const card=$('hc-'+def.id);
    if(card&&h.asc&&!card.dataset.asc){
      card.dataset.asc='1';
      card.classList.add('legendary');
      const ht=card.querySelector('.hero-title');
      if(ht)ht.textContent='✨ Ascended — '+def.title;
    }
    if(card){
      card.classList.toggle('divine',!!h.divine);
      if(h.divine&&!card.dataset.dv){
        card.dataset.dv='1';
        const ht2=card.querySelector('.hero-title');
        if(ht2)ht2.textContent='🔥 DIVINE — '+def.title;
      }
    }
    const st=heroLiveStat(h);
    $('hs-'+def.id).textContent='⚔ '+fmt(st.dmg)+' • ❤ '+fmt(st.hp)
      +(h.gw?' • 🗡'+['','I','II','III'][h.gw]:'')+(h.ga?' • 🛡'+['','I','II','III'][h.ga]:'');
    const hpF=$('hhp-'+def.id);
    hpF.style.width=(h.recruited?clamp(h.hp/h.maxHp,0,1)*100:0)+'%';
    hpF.style.background=def.col;
    const sk=$('hsk-'+def.id);
    if(h.lvl>=def.skill.unlockLvl)sk.innerHTML='✦ '+def.skill.name+(h.recruited&&!h.dead&&h.skillCd>0?' <span class="cd">'+Math.ceil(h.skillCd)+'s</span>':'');
    else sk.innerHTML='<span class="locked-skill">✦ '+def.skill.name+' at Lv '+def.skill.unlockLvl+'</span>';
    const bb=$('hb-'+def.id);
    /* only rebuild the buttons row when its structure changes, so 300ms
       refreshes never swap a button out from under a click */
    const sig=h.recruited+':'+(h.dead?'d':'a')+':'+h.lvl;
    if(!h.recruited){
      if(bb.dataset.sig!==sig){
        bb.dataset.sig=sig;
        bb.innerHTML='<button class="small-btn gold" data-rec="'+def.id+'">'+(def.legendary?'⭐ Summon (free)':'Recruit '+fmt(def.cost)+'g')+'</button>';
        bb.querySelector('button').onclick=()=>{const hh=G.heroes.find(x=>x.id===def.id);if(recruitHero(hh))refreshCards();};
      }
      bb.querySelector('button').disabled=G.gold<def.cost;
    }else if(h.dead){
      bb.dataset.sig=sig;
      bb.innerHTML='<span class="dead-note">☠ '+Math.ceil(h.respawnT)+'s</span>';
    }else{
      const c=heroUpCost(def,h.lvl);
      if(bb.dataset.sig!==sig){
        bb.dataset.sig=sig;
        bb.innerHTML='<button class="small-btn gold" data-tr="'+def.id+'">⬆ '+fmt(c)+'g</button>'+
          '<button class="small-btn gold" data-mx="'+def.id+'" title="Train to max level">⏫</button>'+
          '<button class="small-btn" data-mv="'+def.id+'">🚶 Move</button>';
        bb.querySelector('[data-tr]').onclick=()=>{const hh=G.heroes.find(x=>x.id===def.id);if(upgradeHeroU(hh))refreshCards();};
        bb.querySelector('[data-mx]').onclick=()=>{const hh=G.heroes.find(x=>x.id===def.id);let g=0;while(hh.lvl<CFG.MAX_HERO_LVL&&upgradeHeroU(hh))g++;if(g)refreshCards();};
        bb.querySelector('[data-mv]').onclick=()=>{
          G.selHero=h;UIS.mode='hero';G.targetMode=null;
          setCursorHint('Click the map to post '+def.name+' there');
        };
      }
      bb.querySelector('[data-tr]').disabled=G.gold<c;
    }
  }
}

/* ================= relic cards ================= */
function buildRelicCards(){
  const box=$('relicCards');
  box.innerHTML='';
  for(const def of RELICS){
    const d=document.createElement('div');
    d.className='card relic-card';
    d.id='rc-'+def.id;
    d.title=def.desc;
    d.innerHTML=
      '<div class="card-icon" id="ri-'+def.id+'"></div>'+
      '<div class="card-name">'+def.name+'</div>'+
      '<div class="tier-pips" id="rp-'+def.id+'"></div>'+
      '<div class="troop-stats rdesc">'+def.desc+'</div>'+
      '<button class="small-btn gold" id="rb-'+def.id+'"></button>';
    box.appendChild(d);
    $('rb-'+def.id).onclick=()=>{if(buyRelic(def.id))refreshCards();};
  }
  /* 🗺 frontier expansion */
  const fr=document.createElement('div');
  fr.className='card relic-card';fr.id='rc-frontier';
  fr.innerHTML='<div class="card-icon">🗺</div>'+
    '<div class="card-name">Frontier</div>'+
    '<div class="tier-pips" id="rp-frontier"></div>'+
    '<div class="troop-stats rdesc">Buy new lands between waves: the world zooms out, roads lengthen, build room grows.</div>'+
    '<button class="small-btn gold" id="rb-frontier"></button>';
  box.appendChild(fr);
  $('rb-frontier').onclick=()=>{if(expandMap())refreshCards();};
  /* ☄️ calamity artifacts */
  for(const a of ARTIFACTS){
    const d2=document.createElement('div');
    d2.className='card relic-card art-card';
    d2.id='art-'+a.id;
    d2.title=a.desc;
    d2.innerHTML='<div class="card-icon">'+a.icon+'</div>'+
      '<div class="card-name">'+a.name+'</div>'+
      '<div class="tier-pips" id="ap-'+a.id+'"></div>'+
      '<div class="troop-stats rdesc">'+a.desc+'</div>'+
      '<div class="art-note" id="an-'+a.id+'"></div>';
    box.appendChild(d2);
  }
  const note=document.createElement('div');
  note.className='card relic-card spell-note';
  note.innerHTML='<div class="card-icon">⚡</div>'+
    '<div class="card-name">Battle Spells</div>'+
    '<div class="troop-stats rdesc">Firestorm, Sanctified Ground and RAGNAROK now live on the spell buttons over the battlefield — free to cast, recharging on their own.</div>';
  box.appendChild(note);
  setTimeout(()=>{
    for(const def of RELICS)iconHtmlInto($('ri-'+def.id),'relic',def.id,36,'✦');
  },0);
}
function refreshRelicCards(){
  for(const def of RELICS){
    const tier=G.relics[def.id];
    const pips=$('rp-'+def.id);
    let s='';
    for(let i=0;i<def.max;i++)s+='<span class="pip'+(i<tier?' on':'')+'"></span>';
    pips.innerHTML=s;
    const b=$('rb-'+def.id);
    if(tier>=def.max){b.textContent='MAX';b.disabled=true;}
    else{
      const c=relicCost(def,tier);
      b.textContent='Buy '+fmt(c)+'g';
      b.disabled=G.gold<c;
    }
  }
  const fb=$('rb-frontier');
  if(fb){
    const lvl2=G.expLvl||0;
    const pips2=$('rp-frontier');
    if(pips2){let s2='';for(let i=0;i<EXPANSIONS.length;i++)s2+='<span class="pip'+(i<lvl2?' on':'')+'"></span>';pips2.innerHTML=s2;}
    if(lvl2>=EXPANSIONS.length){fb.textContent='MAX SIZE';fb.disabled=true;}
    else{
      fb.textContent='Expand '+fmt(EXPANSIONS[lvl2].cost)+'g';
      fb.disabled=G.gold<EXPANSIONS[lvl2].cost||G.waveActive;
      fb.title=G.waveActive?'Only between waves':'Zoom the world out with longer roads and more build room';
    }
  }
  for(const a of ARTIFACTS){
    const tier2=(G.artifacts&&G.artifacts[a.id])||0;
    const ap=$('ap-'+a.id);
    if(!ap)continue;
    let s3='';for(let i=0;i<a.max;i++)s3+='<span class="pip'+(i<tier2?' on':'')+'"></span>';
    ap.innerHTML=s3;
    const an=$('an-'+a.id);
    if(an)an.textContent=tier2>0?'Tier '+['','I','II','III'][tier2]+' — trophy of '+a.name:'☄️ Slay its Calamity bearer to claim it';
    const el2=$('art-'+a.id);
    if(el2)el2.classList.toggle('owned',tier2>0);
  }
}

function refreshCards(){
  if(!G)return;
  for(const def of TOWERS){
    const el=$('tc-'+def.id);
    if(el)el.classList.toggle('cant',G.gold<def.cost);
  }
  for(const def of TROOPS){
    if(def.summon)continue;
    const locked=def.unlock>G.wave;
    const lk=$('lk-'+def.id);
    if(!lk)continue;
    lk.style.display=locked?'flex':'none';
    if(locked)continue;
    const lvl=G.troopLvl[def.id],st=troopStat(def.id,lvl);
    $('al-'+def.id).textContent='Lv '+(lvl+1);
    $('cnt-'+def.id).textContent=troopsAlive(def.id)+'/'+G.desired[def.id];
    $('as-'+def.id).textContent=(def.heal?('💚 '+fmt(st.heal)+'/s'):('⚔ '+fmt(st.dmg)+' ❤ '+fmt(st.hp)))+' • '+st.cost+'g';
    $('sum-'+def.id).disabled=G.gold<st.cost||popCount()>=popCap(G.wave);
    const maxed=lvl>=CFG.MAX_TROOP_LVL;
    const tier=G.troopTier[def.id]||0;
    const uc=maxed?0:troopUpCost(def.id,lvl);
    const upB=$('upt-'+def.id);
    if(maxed&&tier<2){
      const pc=troopPromoCost(def.id,tier+1);
      upB.textContent=(tier===0?'⟡':'★')+fmt(pc);
      upB.title='Promote to '+TIER_NAMES[tier+1].trim()+' rank — permanent +55% stats';
      upB.disabled=G.gold<pc;
    }else{
      upB.textContent=maxed?'MAX':'⬆'+fmt(uc);
      upB.title='';
      upB.disabled=maxed||G.gold<uc;
    }
    const cardT=$('ac-'+def.id);
    if(cardT){
      cardT.classList.toggle('tier-silver',tier===1);
      cardT.classList.toggle('tier-gold',tier===2);
      const nameEl=cardT.querySelector('.card-name');
      if(nameEl&&nameEl.childNodes.length&&nameEl.childNodes[0].nodeType===3)
        nameEl.childNodes[0].nodeValue=TIER_NAMES[tier]+def.name+' ';
    }
  }
  refreshHeroCards();
  refreshRelicCards();
  refreshPremiumCards();
  refreshSideBars();
  updateSidebarsVisible();
  if(UIS.selWall&&!G.walls.includes(UIS.selWall)){UIS.selWall=null;hideTowerDetail();}
  if(UIS.selTower&&G.towers.includes(UIS.selTower)&&$('towerDetail').style.display==='block'){
    const up=$('btnUp');
    if(up)up.disabled=G.gold<towerUpCost(TOWER_BY[UIS.selTower.id],UIS.selTower.lvl);
  }
}
function onWaveEnd(){refreshCards();if(G&&G.blessingPending){G.blessingPending=false;setTimeout(()=>showWheel(DIVINE_SLICES,'✨ Blessing of the Gods','The gods pour their favor upon you — claim a boon!'),400);}}

/* ================= wheel of fortune ================= */
let WHEEL=null; // active slice set
const DIVINE_SLICES=[
 {label:'Towers +1',col:'#c9a227',w:16,apply(){let n=0;for(const t of G.towers){if(!t.building&&t.lvl<CFG.MAX_TOWER_LVL){t.lvl++;n++;}}return n?'All '+n+' towers +1 level!':'+800 gold!'+(G.gold+=800,'');}},
 {label:'Grand Troop',col:'#7a5ac0',w:14,apply(){const cand=TROOPS.filter(t=>!t.summon&&t.unlock<=G.wave);if(!cand.length){G.gold+=600;return '+600 gold!';}const t=pick(cand);let g=0;while(G.troopLvl[t.id]<CFG.MAX_TROOP_LVL&&upgradeTroopType(t.id))g++;if(G.troopLvl[t.id]>=CFG.MAX_TROOP_LVL&&(G.troopTier[t.id]||0)<2)promoteTroop(t.id);return t.name+'s empowered!';}},
 {label:'Hero +5',col:'#8a63d8',w:13,apply(){const hs=G.heroes.filter(h=>h.recruited);if(!hs.length){G.gold+=700;return '+700 gold!';}const h=pick(hs);h.lvl=Math.min(CFG.MAX_HERO_LVL,h.lvl+5);const st=heroLiveStat(h);h.maxHp=st.hp;h.hp=st.hp;return h.hdef.name+' +5 levels!';}},
 {label:'🔨 Builder',col:'#b0623c',w:11,apply(){G.builders++;G.builderSeen=true;return 'A Master Builder joins you!';}},
 {label:'Full Muster',col:'#3a9a7a',w:12,apply(){for(const tr of G.troops)tr.hp=tr.maxHp;for(const h of activeHeroes())h.hp=h.maxHp;for(const s of SPELLS)G.spells[s.id]=0;G.lives=maxLives();return 'Army healed, spells ready, lives restored!';}},
 {label:'Relic +1',col:'#b06a3a',w:10,apply(){const cand=RELICS.filter(r=>G.relics[r.id]<r.max);if(!cand.length){G.gold+=800;return '+800 gold!';}const r=pick(cand);G.relics[r.id]++;if(r.id==='walls')G.lives=Math.min(maxLives(),G.lives+r.per);return r.name+' tier '+G.relics[r.id]+'!';}},
 {label:'Complete Tower',col:'#5ad4c0',w:8,apply(){const b=G.towers.find(t=>t.building);if(b){b.building=false;b.buildLeft=0;G.builders++;if(b.id==='pGod')rollGod(b);return TOWER_BY[b.id].name+' finished instantly!';}G.builders++;G.builderSeen=true;return 'No tower building — a Builder joins instead!';}},
 {label:'DIVINE',col:'#ff5a4e',w:5,apply(){const hs=G.heroes.filter(h=>h.recruited&&!h.divine);if(hs.length){const cand=hs.filter(h=>h.hdef.legendary||h.asc);const h=cand.length?pick(cand):pick(hs);if(h.hdef.legendary||h.asc){h.divine=true;}else{h.asc=true;}const st=heroLiveStat(h);h.maxHp=st.hp;h.hp=st.hp;return h.hdef.name+((h.divine)?' is now DIVINE!':' has ASCENDED!');}G.gold+=1500;return '+1500 gold!';}},
];
const WHEEL_SLICES=[
 {label:'150g',col:'#41639a',w:20,apply(){G.gold+=150;return '+150 gold!';}},
 {label:'Troop +1',col:'#7a5ac0',w:13,apply(){
   const cand=TROOPS.filter(t=>t.unlock<=G.wave&&G.troopLvl[t.id]<CFG.MAX_TROOP_LVL);
   const t=cand.length?pick(cand):null;
   if(!t){G.gold+=200;return '+200 gold!';}
   G.troopLvl[t.id]++;return t.name+'s +1 level!';}},
 {label:'250g',col:'#3a7a44',w:16,apply(){G.gold+=250;return '+250 gold!';}},
 {label:'Hero +2',col:'#8a63d8',w:11,apply(){
   const hs=G.heroes.filter(h=>h.recruited);
   const h=hs.length?hs[0]:null;
   if(!h){G.gold+=250;return '+250 gold!';}
   h.lvl=Math.min(CFG.MAX_HERO_LVL,h.lvl+2);
   const st=heroLiveStat(h);h.maxHp=st.hp;h.hp=st.hp;
   return h.hdef.name+' +2 levels!';}},
 {label:'400g',col:'#41639a',w:12,apply(){G.gold+=400;return '+400 gold!';}},
 {label:'Relic +1',col:'#b06a3a',w:9,apply(){
   const cand=RELICS.filter(r=>G.relics[r.id]<r.max);
   const r=cand.length?pick(cand):null;
   if(!r){G.gold+=300;return '+300 gold!';}
   G.relics[r.id]++;
   if(r.id==='walls')G.lives=Math.min(maxLives(),G.lives+r.per);
   return r.name+' tier '+G.relics[r.id]+'!';}},
 {label:'600g',col:'#3a7a44',w:9,apply(){G.gold+=600;return '+600 gold!';}},
 {label:'JACKPOT',col:'#c9a227',w:3,apply(){
   G.gold+=1000;
   TROOPS.forEach(t=>{if(G.troopLvl[t.id]<CFG.MAX_TROOP_LVL)G.troopLvl[t.id]++;});
   for(const h of G.heroes)if(h.recruited){
     h.lvl=Math.min(CFG.MAX_HERO_LVL,h.lvl+1);
     const st=heroLiveStat(h);h.maxHp=st.hp;h.hp=st.hp;
   }
   RELICS.forEach(r=>{if(G.relics[r.id]<r.max)G.relics[r.id]++;});
   G.lives=maxLives();
   return '🌟 JACKPOT! +1000g and +1 to EVERYTHING! 🌟';}},
];
function drawWheel(cv,rot){
  const c=cv.getContext('2d');
  const SL=WHEEL||WHEEL_SLICES;
  const R=cv.width/2,cx=R,cy=R;
  c.clearRect(0,0,cv.width,cv.height);
  const total=SL.reduce((s,x)=>s+x.w,0);
  let a=rot;
  for(const sl of SL){
    const span=sl.w/total*Math.PI*2;
    c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,R-8,a,a+span);c.closePath();
    c.fillStyle=sl.col;c.fill();
    c.strokeStyle='rgba(18,13,26,0.8)';c.lineWidth=2;c.stroke();
    if(sl.label==='JACKPOT'||sl.label==='DIVINE'){
      c.save();c.clip();
      c.fillStyle='rgba(255,255,255,0.25)';
      c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,R-8,a,a+span*0.5);c.closePath();c.fill();
      c.restore();
    }
    c.save();
    c.translate(cx,cy);c.rotate(a+span/2);
    c.textAlign='right';c.textBaseline='middle';
    c.font=((sl.label==='JACKPOT'||sl.label==='DIVINE')?'bold 12px':'bold 11px')+' Georgia, serif';
    c.fillStyle=(sl.label==='JACKPOT'||sl.label==='DIVINE')?'#fff2c0':'#f0e8d0';
    c.strokeStyle='rgba(0,0,0,0.55)';c.lineWidth=3;
    c.strokeText(sl.label,R-18,0);
    c.fillText(sl.label,R-18,0);
    c.restore();
    a+=span;
  }
  /* rim + hub */
  c.beginPath();c.arc(cx,cy,R-6,0,7);
  c.strokeStyle='#b89c44';c.lineWidth=5;c.stroke();
  c.beginPath();c.arc(cx,cy,16,0,7);
  c.fillStyle='#2b2442';c.fill();
  c.strokeStyle='#b89c44';c.lineWidth=3;c.stroke();
  /* pointer (fixed, top) */
  c.beginPath();c.moveTo(cx-13,4);c.lineTo(cx+13,4);c.lineTo(cx,30);c.closePath();
  c.fillStyle='#d83a3a';c.fill();
  c.strokeStyle='rgba(18,13,26,0.9)';c.lineWidth=2;c.stroke();
}
function showWheel(slices,title,sub){
  const ov=$('wheelOverlay'),cv=$('wheelCv');
  WHEEL=slices||WHEEL_SLICES;
  const blessing=!!slices;
  const hEl=ov.querySelector('.wheel-box h1'),sEl=ov.querySelector('.wheel-box .wsub');
  if(hEl)hEl.textContent=title||'🎡 Wheel of Fortune';
  if(sEl)sEl.textContent=sub||'One free spin per battle. Fortune favors the bold…';
  ov.style.display='flex';
  $('wheelResult').textContent='';
  $('btnSpin').disabled=false;
  if(G)G.paused=true;
  drawWheel(cv,0);
  $('btnSpin').onclick=()=>{
    $('btnSpin').disabled=true;
    if(!blessing)G.spun=true;
    /* pick weighted outcome, then animate the wheel to land on it */
    const SL=WHEEL;
    const total=SL.reduce((s,x)=>s+x.w,0);
    let roll=Math.random()*total,idx=0;
    for(let i=0;i<SL.length;i++){roll-=SL[i].w;if(roll<=0){idx=i;break;}}
    let startA=0;
    for(let i=0;i<idx;i++)startA+=SL[i].w/total*Math.PI*2;
    const span=SL[idx].w/total*Math.PI*2;
    const center=startA+span*rnd(0.25,0.75);
    const pointer=-Math.PI/2;
    const target=pointer-center+Math.PI*2*5; // 5 extra revolutions
    const dur=3600;
    const t0=performance.now();
    let lastIdx=-1;
    (function anim(now){
      const u=Math.min(1,(now-t0)/dur);
      const e2=1-Math.pow(1-u,3);
      const rot=target*e2;
      drawWheel(cv,rot);
      /* tick when the slice under the pointer changes */
      const under=(((pointer-rot)%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      let acc=0,ci=0;
      for(let i=0;i<SL.length;i++){const s2=SL[i].w/total*Math.PI*2;if(under>=acc&&under<acc+s2){ci=i;break;}acc+=s2;}
      if(ci!==lastIdx){lastIdx=ci;SFXp('ui_click');}
      if(u<1){requestAnimationFrame(anim);return;}
      const msg=SL[idx].apply();
      $('wheelResult').textContent=msg;
      const big=SL[idx].label==='JACKPOT'||SL[idx].label==='DIVINE';
      setBanner((blessing?'✨ ':'🎡 ')+msg,big);
      SFXp(big?'horn_victory':'chest');
      saveGame();
      refreshCards();
      setTimeout(()=>{ov.style.display='none';if(G)G.paused=false;},2200);
    })(t0);
  };
}

/* ================= placement confirm bar ================= */
function stagePos(wx,wy){
  const stage=$('stage');
  const r=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();
  const scale=Math.min(r.width/CFG.W,r.height/CFG.H);
  const ox=(r.width-CFG.W*scale)/2+(r.left-sr.left);
  const oy=(r.height-CFG.H*scale)/2+(r.top-sr.top);
  return {x:ox+wx*scale,y:oy+wy*scale,scale};
}
function setPending(cc,rr2){
  if(UIS.mode!=='build')return;
  UIS.pendC=cc;UIS.pendR=rr2;
  UIS.hoverC=cc;UIS.hoverR=rr2;
}
function clearPending(){
  UIS.pendC=-1;UIS.pendR=-1;
  const cb=$('confirmBar');if(cb)cb.style.display='none';
}
/* (confirm bar removed — placement is now double-click / double-tap) */

/* ================= canvas input ================= */
function canvasPos(ev){
  const r=canvas.getBoundingClientRect();
  const scale=Math.min(r.width/CFG.W,r.height/CFG.H);
  const ox=(r.width-CFG.W*scale)/2,oy=(r.height-CFG.H*scale)/2;
  return {x:(ev.clientX-r.left-ox)/scale,y:(ev.clientY-r.top-oy)/scale};
}
function bindCanvas(){
  canvas.addEventListener('mousemove',ev=>{
    const p=canvasPos(ev);
    UIS.hoverX=p.x;UIS.hoverY=p.y;
    UIS.hoverC=Math.floor(p.x/CFG.CELL);
    UIS.hoverR=Math.floor(p.y/CFG.CELL);
  });
  canvas.addEventListener('mouseleave',()=>{UIS.hoverC=-1;UIS.hoverR=-1;UIS.hoverX=-1;UIS.hoverY=-1;});
  canvas.addEventListener('click',ev=>{
    if(!started||!G||G.over)return;
    const p=canvasPos(ev);
    if(p.x<0||p.y<0||p.x>CFG.W||p.y>CFG.H)return;
    const c=Math.floor(p.x/CFG.CELL),r=Math.floor(p.y/CFG.CELL);
    if(G.villain){villainCanvasClick(p,c,r);return;}
    if(G.targetMode&&G.targetMode.indexOf('spell:')===0){
      spellAt(G.targetMode.slice(6),p.x,p.y);
      setCursorHint('');refreshCards();return;
    }
    if(G.chest&&collectChest(p.x,p.y)){refreshCards();return;}
    if(UIS.mode==='build'){
      /* first click/tap positions the ghost; same tile again builds it */
      if(UIS.justPlacedGhost){UIS.justPlacedGhost=false;return;}
      if(UIS.pendC===c&&UIS.pendR===r){
        if(placeTower(UIS.buildType,c,r)){
          clearPending();
          setCursorHint('');
          if(G.gold<TOWER_BY[UIS.buildType].cost)cancelMode();
        }else{
          const bd=TOWER_BY[UIS.buildType];
          let msg;
          if(bd&&bd.prem&&G.builders<1)msg='Need a free 🔨 Master Builder';
          else if(bd&&G.gold<bd.cost)msg='Need '+fmt(bd.cost)+'g'+(bd.prem?' — premium tower!':'');
          else if(UIS.buildType==='wall')msg='Walls go ON a road — clear of the gate, spawn and other walls';
          else msg='Blocked tile — pick an open one';
          setCursorHint(msg);
        }
      }else{
        setPending(c,r);
        const ok2=UIS.buildType==='wall'?canPlaceWall(c*CFG.CELL+20,r*CFG.CELL+20):canPlace(c,r);
        setCursorHint(ok2?(IS_TOUCH?'Tap again to build':'Click again to build'):(UIS.buildType==='wall'?'Move it onto a road':'Blocked tile'));
      }
      return;
    }
    if(UIS.mode==='hero'&&G.selHero){moveHeroTo(G.selHero,p.x,p.y);UIS.mode='none';setCursorHint('');return;}
    if(UIS.mode==='rally'){
      const np=nearestPathPoint(p.x,p.y);
      G.rally[np.pi]=clamp(np.d,40,MAP.P[np.pi].total-60);
      addFx({kind:'flag',x:p.x,y:p.y,life:1,col:'#5aa8e0'});
      UIS.mode='none';setCursorHint('');return;
    }
    /* click a hero unit? */
    for(const h of activeHeroes()){
      if(dist2(h.x,h.y,p.x,p.y)<20*20){
        G.selHero=h;UIS.mode='hero';
        setCursorHint('Click the map to post '+h.hdef.name+' there');
        return;
      }
    }
    const t=G.towers.find(t=>t.c===c&&t.r===r);
    if(t){UIS.selTower=t;UIS.selWall=null;showTowerDetail(t);positionTowerDetail(t);SFXp('ui_click');return;}
    const wclk=G.walls.find(w=>dist2(w.x,w.y,p.x,p.y)<30*30);
    if(wclk){showWallDetail(wclk);SFXp('ui_click');}
    else{UIS.selTower=null;UIS.selWall=null;hideTowerDetail();}
  });
  /* touch: drag the ghost around, release, then ✓ */
  canvas.addEventListener('pointerdown',ev=>{
    if(!IS_TOUCH||!started||!G||G.over)return;
    if(UIS.mode!=='build')return;
    const p=canvasPos(ev);
    if(p.x<0||p.y<0||p.x>CFG.W||p.y>CFG.H)return;
    const c=clamp(Math.floor(p.x/CFG.CELL),0,CFG.COLS-1),r=clamp(Math.floor(p.y/CFG.CELL),0,CFG.ROWS-1);
    UIS.dragPlace=true;
    if(UIS.pendC!==c||UIS.pendR!==r){setPending(c,r);UIS.justPlacedGhost=true;}
  },{passive:true});
  canvas.addEventListener('pointermove',ev=>{
    if(!UIS.dragPlace)return;
    const p=canvasPos(ev);
    const c=clamp(Math.floor(p.x/CFG.CELL),0,CFG.COLS-1),r=clamp(Math.floor(p.y/CFG.CELL),0,CFG.ROWS-1);
    if(c!==UIS.pendC||r!==UIS.pendR){setPending(c,r);UIS.justPlacedGhost=true;}
  },{passive:true});
  window.addEventListener('pointerup',()=>{
    if(UIS.dragPlace)UIS.dragPlace=false;
  },{passive:true});
  canvas.addEventListener('contextmenu',ev=>{
    ev.preventDefault();
    cancelMode();
    UIS.mode='none';UIS.selTower=null;UIS.selWall=null;hideTowerDetail();setCursorHint('');
  });
}
function bindKeys(){
  window.addEventListener('keydown',ev=>{
    if(!started||!G)return;
    if(G.villain){
      if(ev.key==='Escape'){villainCancelBuild();hideTowerDetail();UIS.selBarr=null;}
      else if(ev.key===' '){ev.preventDefault();G.paused=!G.paused;}
      else if(ev.key==='f'||ev.key==='F'){G.speed=G.speed>=3?1:G.speed+1;}
      return;
    }
    if(ev.key==='Escape'){cancelMode();UIS.mode='none';UIS.selTower=null;UIS.selWall=null;hideTowerDetail();setCursorHint('');closeMobilePanel();return;}
    if(G.over)return;
    else if(ev.key===' '){ev.preventDefault();G.paused=!G.paused;}
    else if(ev.key==='f'||ev.key==='F'){G.speed=G.speed>=3?1:G.speed+1;}
    else if(ev.key==='r'||ev.key==='R'){UIS.mode='rally';G.targetMode=null;setCursorHint('Click near a road to set that road’s rally point');}
    else if(ev.key==='h'||ev.key==='H'){
      const hs=activeHeroes();
      if(hs.length){
        const i=(hs.indexOf(G.selHero)+1)%hs.length;
        G.selHero=hs[i];UIS.mode='hero';G.targetMode=null;
        setCursorHint('Click the map to post '+G.selHero.hdef.name+' there');
      }
    }
    else if(ev.key>='1'&&ev.key<='9'){
      const def=TOWERS[+ev.key-1];
      if(def)selectBuildType(def);
    }
  });
}
