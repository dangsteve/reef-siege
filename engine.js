/* ============================================================
   engine.js — game state & simulation (v2: multi-path, heroes,
   relics, consumables, difficulty maps)
   ============================================================ */
'use strict';

let G=null;

function newGame(mapId){
  const mdef=MAP_BY[mapId]||MAPS[0];
  CFG.COLS=CFG.BASE_COLS;CFG.ROWS=CFG.BASE_ROWS;
  CFG.W=CFG.COLS*CFG.CELL;CFG.H=CFG.ROWS*CFG.CELL;
  try{if(typeof canvas!=='undefined'&&canvas&&canvas.width!==CFG.W){canvas.width=CFG.W;canvas.height=CFG.H;}}catch(err){}
  try{if(typeof clearRenderCaches==='function')clearRenderCaches();}catch(err){}
  initMapRuntime(mdef);
  G={
    mapId:mdef.id,
    gold:mdef.mods.startGold||CFG.START_GOLD, lives:CFG.START_LIVES, wave:1, time:0,
    over:false, paused:false, speed:1, autoWave:true,
    towers:[], walls:[], enemies:[], troops:[], projs:[], parts:[], texts:[], fx:[],
    undo:[], chest:null,
    troopLvl:{}, desired:{}, troopTier:{},
    artifacts:{}, expLvl:0, blitz:0,
    heroes:[], selHero:null,
    relics:{},
    spells:{firestorm:8,blessing:8,ragnarok:240},
    zones:[], ragnarokT:0,
    rally:MAP.P.map(p=>p.total*0.5),
    waveActive:false, spawnQueue:[], spawnT:0, intermission:12,
    waveBanner:null, bannerT:0, shieldT:0, spun:false,
    kills:0, bossKills:0, goldEarned:0, shake:0, streak:0, waveStartLives:CFG.START_LIVES,
    maintainT:0, auraT:0, targetMode:null,
  };
  TROOPS.forEach(t=>{G.troopLvl[t.id]=0;G.desired[t.id]=0;G.troopTier[t.id]=0;});
  RELICS.forEach(r=>G.relics[r.id]=0);
  G.desired.militia=2;
  initHeroes();
  setBanner('Build towers & prepare! Wave 1 incoming…');
}

function setBanner(txt,big){G.waveBanner=txt;G.bannerT=big?4:3;}

/* ================= HEROES ================= */
function freshHeroState(def){
  const spot=posAt(0,MAP.P[0].total*0.55);
  const idx=HEROES.indexOf(def);
  const st={id:def.id,hdef:def,isHero:true,lvl:1,recruited:def.cost===0&&!def.legendary,
    x:spot.x+idx*24-40,y:spot.y-52,homeX:spot.x+idx*24-40,homeY:spot.y-52,
    hp:def.hp,maxHp:def.hp,dead:false,respawnT:0,atkCd:0,skillCd:4,
    gw:0,ga:0,bulwarkT:0,
    face:1,anim:0,swing:0,flash:0};
  return st;
}
function initHeroes(){G.heroes=HEROES.map(freshHeroState);}
function heroUnlocked(h){
  if(h.hdef.legendary)return h.recruited||vaultHas(h.id);
  return G.wave>=heroEffUnlock(h.hdef);
}
function activeHeroes(){return G.heroes.filter(h=>h.recruited&&!h.dead);}
/* live stats: base × ascension × divine × gear × artifacts */
function heroLiveStat(h){
  const st=heroStat(h.hdef,h.lvl,h.asc,h.divine);
  const gw=GEAR_W[h.gw||0],ga=GEAR_A[h.ga||0];
  st.dmg*=(1+(gw?gw.mul:0))*(1+ARTIFACT_BY.sigil.per*artVal('sigil'));
  st.hp*=(1+(ga?ga.mul:0));
  return st;
}
function recruitHero(h){
  if(h.recruited||!heroUnlocked(h))return false;
  if(G.gold<h.hdef.cost)return false;
  G.gold-=h.hdef.cost;
  h.recruited=true;
  const st=heroLiveStat(h);
  h.hp=st.hp;h.maxHp=st.hp;h.dead=false;
  const spot=posAt(0,MAP.P[0].total*0.55);
  h.x=spot.x+rnd(-40,40);h.y=spot.y-52;h.homeX=h.x;h.homeY=h.y;
  burst(h.x,h.y,20,h.hdef.col);
  addFx({kind:'ring',x:h.x,y:h.y,r:8,maxR:70,life:0.6,col:h.hdef.col});
  SFXp('recruit');
  return true;
}
function upgradeHeroU(h){
  if(h.lvl>=CFG.MAX_HERO_LVL)return false;
  const c=heroUpCost(h.hdef,h.lvl);
  if(G.gold<c)return false;
  G.gold-=c;h.lvl++;
  pushUndo({t:'hero',id:h.id,to:h.lvl,cost:c});
  /* ✨ ASCENSION: rare chance for a mortal hero to reach legendary power */
  if(!h.hdef.legendary&&!h.asc&&Math.random()<ASC_CHANCE){
    h.asc=true;
    G.undo.length=0; // ascension is fate — not undoable
    setBanner('✨✨ '+h.hdef.name+' has ASCENDED to legendary power! ✨✨',true);
    addFx({kind:'ring',x:h.x,y:h.y,r:10,maxR:160,life:0.9,col:'#ffd75e'});
    burst(h.x,h.y,40,'#ffe27a');
    G.shake=10;
    SFXp('horn_victory');
  }
  /* 🔥 DIVINE: the tier above legendary — for legends and the ascended only */
  if((h.hdef.legendary||h.asc)&&!h.divine&&Math.random()<DIV_CHANCE){
    h.divine=true;
    G.undo.length=0; // divinity is fate — not undoable
    setBanner('🔥🔥 '+h.hdef.name+' has transcended mortality — DIVINE! 🔥🔥',true);
    addFx({kind:'ring',x:h.x,y:h.y,r:10,maxR:190,life:1.0,col:'#ff5a4e'});
    burst(h.x,h.y,50,'#ff7a5e');
    G.shake=12;
    SFXp('boss_roar');
  }
  const st=heroLiveStat(h);
  if(!h.dead){
    const pct=h.hp/h.maxHp;
    h.maxHp=st.hp;h.hp=st.hp*Math.max(pct,0.6);
    burst(h.x,h.y,14,'#ffd75e');
  }
  if(h.lvl===h.hdef.skill.unlockLvl)setBanner('✦ '+h.hdef.name+' learned '+h.hdef.skill.name+'! ✦',true);
  if(h.hdef.passive&&h.lvl===h.hdef.passive.lvl)setBanner('✦ '+h.hdef.name+' gained '+h.hdef.passive.name+'! ✦',true);
  SFXp('upgrade');
  return true;
}
function moveHeroTo(h,x,y){
  if(!h||h.dead||!h.recruited)return;
  h.homeX=x;h.homeY=y;
  addFx({kind:'flag',x,y,life:1,col:h.hdef.col});
}

/* ================= UNDO ================= */
function pushUndo(a){G.undo.push(a);if(G.undo.length>12)G.undo.shift();}
function undoLast(){
  const a=G.undo.pop();
  if(!a)return false;
  if(a.t==='place'){
    const t=G.towers.find(x=>x===a.tower);
    if(t&&t.lvl===1&&!(t.kills>0)){G.towers=G.towers.filter(x=>x!==t);G.gold+=a.cost;}
    else return undoLast();
  }else if(a.t==='up'){
    const t=G.towers.find(x=>x===a.tower);
    if(t&&t.lvl===a.to){t.lvl--;G.gold+=a.cost;}
    else return undoLast();
  }else if(a.t==='troop'){
    if(G.troopLvl[a.id]===a.to){G.troopLvl[a.id]--;G.gold+=a.cost;}
    else return undoLast();
  }else if(a.t==='hero'){
    const h=G.heroes.find(x=>x.id===a.id);
    if(h&&h.lvl===a.to){h.lvl--;const st=heroStat(h.hdef,h.lvl,h.asc);h.maxHp=st.hp;h.hp=Math.min(h.hp,st.hp);G.gold+=a.cost;}
    else return undoLast();
  }else if(a.t==='relic'){
    if(G.relics[a.id]===a.to){G.relics[a.id]--;G.gold+=a.cost;if(a.id==='walls')G.lives=Math.min(G.lives,maxLives());}
    else return undoLast();
  }else if(a.t==='wallplace'){
    const w=G.walls.find(x=>x===a.wall);
    if(w&&w.lvl===1){G.walls=G.walls.filter(x=>x!==w);G.gold+=a.cost;}
    else return undoLast();
  }else if(a.t==='wallup'){
    const w=G.walls.find(x=>x===a.wall);
    if(w&&w.lvl===a.to){w.lvl--;w.maxHp=wallHpAt(a.wave,w.lvl);w.hp=Math.min(w.hp,w.maxHp);G.gold+=a.cost;}
    else return undoLast();
  }
  SFXp('sell');
  return true;
}

/* ================= TOWERS ================= */
function canPlace(c,r){
  if(c<0||r<0||c>=CFG.COLS||r>=CFG.ROWS)return false;
  if(MAP.blocked.has(c+','+r))return false;
  return !G.towers.some(t=>t.c===c&&t.r===r);
}
function canPlaceWall(x,y){
  if(distToPaths(x,y)>26)return false;
  const np=nearestPathPoint(x,y);
  if(np.d>MAP.P[np.pi].total-160||np.d<60)return false; // not at the gate or spawn
  return !G.walls.some(w=>w.pi===np.pi&&Math.abs(w.d-np.d)<44);
}
function placeTower(id,c,r){
  const def=TOWER_BY[id];
  if(!def||G.gold<def.cost)return false;
  if(def.wall){
    const x=c*CFG.CELL+20,y=r*CFG.CELL+20;
    if(!canPlaceWall(x,y))return false;
    G.gold-=def.cost;
    const np=nearestPathPoint(x,y);
    const p=posAt(np.pi,np.d);
    const hp=wallHpAt(G.wave,1);
    const w={isWall:true,pi:np.pi,d:np.d,x:p.x,y:p.y,ang:p.a,lvl:1,hp,maxHp:hp,flash:0};
    G.walls.push(w);
    pushUndo({t:'wallplace',wall:w,cost:def.cost});
    burst(p.x,p.y,12,'#b8b2c0');
    SFXp('build');
    return true;
  }
  if(!canPlace(c,r))return false;
  G.gold-=def.cost;
  const t={id,c,r,x:c*CFG.CELL+20,y:r*CFG.CELL+20,lvl:1,cd:0,ang:-Math.PI/2,auraMul:1,heat:0,tick:0,kills:0};
  G.towers.push(t);
  pushUndo({t:'place',tower:t,cost:def.cost});
  burst(c*CFG.CELL+20,r*CFG.CELL+20,10,'#d8c9a0');
  SFXp('build');
  return true;
}
function upgradeWall(w){
  const c=wallUpCost(w.lvl);
  if(G.gold<c)return false;
  G.gold-=c;w.lvl++;
  w.maxHp=wallHpAt(G.wave,w.lvl);w.hp=w.maxHp;
  pushUndo({t:'wallup',wall:w,to:w.lvl,cost:c,wave:G.wave});
  burst(w.x,w.y,12,'#ffd75e');
  SFXp('upgrade');
  return true;
}
function repairWall(w){
  const c=Math.round(TOWER_BY.wall.cost*0.4*(1-w.hp/w.maxHp)*Math.pow(1.4,w.lvl-1))+10;
  if(G.gold<c||w.hp>=w.maxHp)return false;
  G.gold-=c;w.hp=w.maxHp;
  burst(w.x,w.y,8,'#7ee08a');
  SFXp('build');
  return true;
}
function sellWall(w){
  G.gold+=Math.round(TOWER_BY.wall.cost*0.5);
  G.walls=G.walls.filter(x=>x!==w);
  SFXp('sell');
}
function upgradeTower(t){
  if(t.lvl>=CFG.MAX_TOWER_LVL)return false;
  const c=towerUpCost(TOWER_BY[t.id],t.lvl);
  if(G.gold<c)return false;
  G.gold-=c;t.lvl++;
  pushUndo({t:'up',tower:t,to:t.lvl,cost:c});
  burst(t.x,t.y,16,'#ffd75e');
  addFx({kind:'ring',x:t.x,y:t.y,r:6,maxR:44,life:0.4,col:'#ffd75e'});
  SFXp('upgrade');
  return true;
}
function sellTower(t){
  const refund=Math.round(towerInvested(TOWER_BY[t.id],t.lvl)*0.7);
  G.gold+=refund;
  G.towers=G.towers.filter(x=>x!==t);
  addText(t.x,t.y,'+'+refund+'g','#ffd75e');
  SFXp('sell');
  return refund;
}

/* ================= TROOPS ================= */
function troopsAlive(id){return G.troops.filter(t=>t.id===id).length;}
function popCount(){return G.troops.filter(t=>!TROOP_BY[t.id].summon).length;}
function pickTroopPath(){
  let best=0,bs=-1e9;
  for(let pi=0;pi<MAP.P.length;pi++){
    const foes=G.enemies.reduce((s,e)=>s+(e.pi===pi?1+(e.boss?4:0):0),0);
    const allies=G.troops.reduce((s,t)=>s+(t.pi===pi?1:0),0);
    const score=foes*2-allies;
    if(score>bs){bs=score;best=pi;}
  }
  return best;
}
function summonTroop(id,silent,discount){
  const def=TROOP_BY[id];
  if(def.unlock>G.wave)return false;
  if(popCount()>=popCap(G.wave))return false;
  const st=troopStat(id,G.troopLvl[id]);
  const cost=discount?Math.round(st.cost*0.6):st.cost; // auto-reinforcements are cheaper
  if(G.gold<cost)return false;
  G.gold-=cost;
  const pi=pickTroopPath();
  const d=MAP.P[pi].total-40;
  const p=posAt(pi,d);
  G.troops.push({id,lvl:G.troopLvl[id],pi,d,lane:rnd(-15,15),x:p.x,y:p.y,
    hp:st.hp,maxHp:st.hp,atkCd:rnd(0,0.4),foe:null,state:'walk',anim:rnd(0,6),face:-1,
    healCd:0,swing:0,flash:0});
  burst(p.x,p.y,8,'#9ecbff');
  if(!silent)SFXp('summon');
  return true;
}
function upgradeTroopType(id){
  if(G.troopLvl[id]>=CFG.MAX_TROOP_LVL)return false;
  const c=troopUpCost(id,G.troopLvl[id]);
  if(G.gold<c)return false;
  G.gold-=c;G.troopLvl[id]++;
  pushUndo({t:'troop',id,to:G.troopLvl[id],cost:c});
  SFXp('upgrade');
  return true;
}
function maintainArmy(dt){
  G.maintainT-=dt;
  if(G.maintainT>0)return;
  G.maintainT=0.75/(1+relicVal('drums'));
  for(const def of TROOPS){
    if(def.unlock>G.wave)continue;
    if(troopsAlive(def.id)<G.desired[def.id]){
      if(summonTroop(def.id,true,true))return;
    }
  }
}

/* ================= BULK UPGRADES ================= */
function upgradeTowerMax(t){let n=0;while(t.lvl<CFG.MAX_TOWER_LVL&&upgradeTower(t))n++;return n;}
function promoteTower(t){
  const def=TOWER_BY[t.id];
  if(t.lvl<CFG.MAX_TOWER_LVL||(t.tier||1)>=3)return false;
  const c=towerPromoCost(def,t.tier||1);
  if(G.gold<c)return false;
  G.gold-=c;t.tier=(t.tier||1)+1;
  setBanner((t.tier===2?'⟡ ':'★ ')+def.name+' promoted to '+(t.tier===2?'SILVER':'GOLD')+' tier!',true);
  burst(t.x,t.y,26,t.tier===2?'#c8ccd8':'#ffd75e');
  addFx({kind:'ring',x:t.x,y:t.y,r:8,maxR:70,life:0.6,col:t.tier===2?'#c8ccd8':'#ffd75e'});
  SFXp('horn_victory');
  return true;
}
function promoteTroop(id){
  const tier=G.troopTier[id]||0;
  if(tier>=2||G.troopLvl[id]<CFG.MAX_TROOP_LVL)return false;
  const c=troopPromoCost(id,tier+1);
  if(G.gold<c)return false;
  G.gold-=c;G.troopTier[id]=tier+1;
  for(const tr of G.troops)if(tr.id===id){const st=troopStat(id,tr.lvl);tr.maxHp=st.hp;tr.hp=st.hp;}
  setBanner((tier===0?'⟡ ':'★ ')+'Your '+TROOP_BY[id].name+'s reached '+TIER_NAMES[tier+1].trim()+' rank!',true);
  SFXp('horn_victory');
  return true;
}
function bulkUpgrade(kind){
  let spent=0,guard=0;
  while(guard++<400){
    let best=null,bc=Infinity,act=null;
    if(kind==='towers'){
      for(const t of G.towers){
        if(t.lvl>=CFG.MAX_TOWER_LVL)continue;
        const c=towerUpCost(TOWER_BY[t.id],t.lvl);
        if(c<bc){bc=c;best=t;act='tower';}
      }
      for(const w of G.walls){
        const c=wallUpCost(w.lvl);
        if(c<bc){bc=c;best=w;act='wall';}
      }
    }else if(kind==='troops'){
      for(const d of TROOPS){
        if(d.summon||d.unlock>G.wave||G.troopLvl[d.id]>=CFG.MAX_TROOP_LVL)continue;
        const c=troopUpCost(d.id,G.troopLvl[d.id]);
        if(c<bc){bc=c;best=d.id;act='troop';}
      }
    }else if(kind==='heroes'){
      for(const h of G.heroes){
        if(!h.recruited)continue;
        const c=heroUpCost(h.hdef,h.lvl);
        if(c<bc){bc=c;best=h;act='hero';}
      }
    }
    if(!best||G.gold<bc)break;
    if(act==='tower')upgradeTower(best);
    else if(act==='wall')upgradeWall(best);
    else if(act==='troop')upgradeTroopType(best);
    else if(act==='hero')upgradeHeroU(best);
    spent+=bc;
  }
  if(spent>0){setBanner('⏫ Bulk upgrade: spent '+fmt(spent)+'g');SFXp('upgrade');}
  return spent;
}

/* ================= RELICS & CONSUMABLES ================= */
function buyRelic(id){
  const def=RELIC_BY[id],tier=G.relics[id];
  if(tier>=def.max)return false;
  const c=relicCost(def,tier);
  if(G.gold<c)return false;
  G.gold-=c;G.relics[id]++;
  pushUndo({t:'relic',id,to:G.relics[id],cost:c});
  if(id==='walls')G.lives=Math.min(maxLives(),G.lives+def.per);
  setBanner('✦ '+def.name+' — tier '+G.relics[id]+' ✦');
  SFXp('relic_buy');
  return true;
}
/* ================= SPELLS ================= */
function castSpell(id){
  const def=SPELL_BY[id];
  if(!def||G.spells[id]>0||G.over)return false;
  if(def.target){G.targetMode='spell:'+id;return true;}
  /* RAGNAROK — the last-minute clutch */
  G.spells.ragnarok=def.cd;
  G.shake=16;
  addFx({kind:'ragnarok',life:1.6,t:0});
  for(const e of G.enemies){
    if(e.dead)continue;
    damageEnemy(e,e.maxHp*(e.boss?0.22:0.4)+180,'magic');
    if(!e.dead){e.slowT=Math.max(e.slowT,e.boss?1.2:3);e.slowP=1;}
  }
  for(const t of G.troops)t.hp=t.maxHp;
  for(const h of activeHeroes())h.hp=h.maxHp;
  for(const tdef of TROOPS){
    if(tdef.unlock>G.wave)continue;
    let guard=0;
    while(troopsAlive(tdef.id)<G.desired[tdef.id]&&popCount()<popCap(G.wave)&&guard++<30){
      const st=troopStat(tdef.id,G.troopLvl[tdef.id]);
      const pi=pickTroopPath();
      const d=MAP.P[pi].total-40;
      const p=posAt(pi,d);
      G.troops.push({id:tdef.id,lvl:G.troopLvl[tdef.id],pi,d,lane:rnd(-15,15),x:p.x,y:p.y,
        hp:st.hp,maxHp:st.hp,atkCd:rnd(0,0.4),foe:null,state:'walk',anim:rnd(0,6),face:-1,healCd:0,swing:0,flash:0});
      burst(p.x,p.y,10,'#8ad0ff');
    }
  }
  G.ragnarokT=15;
  setBanner(THEME.txt.ragnarok,true);
  SFXp(def.snd);
  return true;
}
function spellAt(id,x,y){
  const def=SPELL_BY[id];
  if(!def||G.spells[id]>0)return false;
  G.targetMode=null;
  G.spells[id]=def.cd;
  if(id==='firestorm'){
    addFx({kind:'firestorm',x,y,r:def.radius,life:1.1,t:0});
    G.shake=Math.max(G.shake,10);
    for(const e of G.enemies){
      if(e.dead)continue;
      if(dist2(e.x,e.y,x,y)<def.radius*def.radius){
        e.burnT=4;e.burnDps=Math.max(e.burnDps,e.maxHp*0.045);
        damageEnemy(e,e.maxHp*0.4+180,'magic');
      }
    }
    burst(x,y,36,'#ff9a3a');
  }else if(id==='blessing'){
    G.zones.push({kind:'bless',x,y,r:def.radius,t:def.dur,max:def.dur});
    addFx({kind:'ring',x,y,r:16,maxR:def.radius,life:0.6,col:'#7ee08a'});
  }
  SFXp(def.snd);
  return true;
}

/* ================= RANDOM EVENTS ================= */
function injectEvents(){
  const w=G.wave,q=G.spawnQueue;
  /* ☄️ calamity: vanishingly rare, can strike ANY wave — even boss waves */
  if(w>=CALAMITY_MIN_WAVE&&Math.random()<CALAMITY_CHANCE){
    const cal=pick(CALAMITIES);
    const at=Math.floor(q.length*rnd(0.3,0.7));
    q.splice(at,0,{calamityId:cal.id,delay:1.2,rarity:null,pi:Math.floor(Math.random()*MAP.P.length)});
  }
  if(w%10===0)return; // boss waves stay pure (calamities excepted)
  if(w>=EVENT_CFG.boarMinWave&&Math.random()<EVENT_CFG.boarChance){
    const at=Math.floor(q.length*rnd(0.15,0.6));
    q.splice(at,0,{eventId:'boar',delay:0.4,rarity:null,pi:Math.floor(Math.random()*MAP.P.length)});
  }
  const unvaulted=LEGENDARIES.filter(l=>!vaultHas(l.id)&&!G.heroes.some(h=>h.id===l.id&&h.recruited));
  if(w>=EVENT_CFG.wardenMinWave&&unvaulted.length){
    const v=vaultData();
    if(Math.random()<EVENT_CFG.wardenChance(w,v.wardenPity||0)){
      const cap=pick(unvaulted);
      const at=Math.floor(q.length*rnd(0.2,0.5));
      q.splice(at,0,{eventId:'warden',captive:cap.id,delay:0.6,rarity:null,pi:Math.floor(Math.random()*MAP.P.length)});
      v.wardenPity=0;vaultSave();
    }else{v.wardenPity=(v.wardenPity||0)+1;vaultSave();}
  }
}
function eventReward(e){
  if(e.def.event==='calamity'){
    const art=ARTIFACT_BY[e.def.art];
    const cur=G.artifacts[art.id]||0;
    if(cur<art.max){
      G.artifacts[art.id]=cur+1;
      if(art.id==='aegis')G.lives=Math.min(maxLives(),G.lives+ARTIFACT_BY.aegis.per);
      if(art.id==='sigil')for(const h of G.heroes)if(h.recruited){const st=heroLiveStat(h);h.maxHp=st.hp;}
      setBanner('🏆 '+art.name+' '+['','I','II','III'][cur+1]+' claimed! '+art.desc,true);
    }else{
      for(const s of SPELLS)G.spells[s.id]=Math.min(G.spells[s.id],1);
      const g2=Math.round(600*goldMul(G.wave));
      G.gold+=g2;G.goldEarned+=g2;
      setBanner('🏆 '+e.def.name+' slain again — spells recharged, +'+g2+'g!',true);
    }
    G.bossKills++;
    addFx({kind:'ring',x:e.x,y:e.y,r:12,maxR:140,life:0.8,col:'#ff5a4e'});
    SFXp('horn_victory');
    return;
  }
  if(e.def.event==='boar'){
    const roll=Math.random();
    if(roll<0.5){
      const g=Math.round((130+26*G.wave)*(1+relicVal('treasury')));
      G.gold+=g;G.goldEarned+=g;
      setBanner(THEME.txt.boarGold(g));
      for(let i=0;i<3;i++)addFx({kind:'coinfly',x:e.x+rnd(-12,12),y:e.y+rnd(-12,12),life:0.7,t:0});
      SFXp('chest');
    }else if(roll<0.75){
      const cand=G.towers.filter(t=>t.lvl<CFG.MAX_TOWER_LVL);
      if(cand.length){
        const t=pick(cand);t.lvl++;
        burst(t.x,t.y,16,'#ffd75e');
        addFx({kind:'ring',x:t.x,y:t.y,r:6,maxR:44,life:0.4,col:'#ffd75e'});
        setBanner('✨ Blessing: '+TOWER_BY[t.id].name+' upgraded for free! ✨');
      }else{G.gold+=250;setBanner('✨ +250 gold ✨');}
      SFXp('upgrade');
    }else if(roll<0.92){
      const cand=TROOPS.filter(td=>td.unlock<=G.wave&&G.troopLvl[td.id]<CFG.MAX_TROOP_LVL);
      if(cand.length){
        const td=pick(cand);G.troopLvl[td.id]++;
        setBanner('✨ Blessing: your '+td.name+'s trained a level for free! ✨');
      }else{G.gold+=250;setBanner('✨ +250 gold ✨');}
      SFXp('upgrade');
    }else{
      for(const s of SPELLS)G.spells[s.id]=Math.min(G.spells[s.id],2);
      setBanner('✨ Blessing: arcane surge — spell cooldowns reset! ✨');
      SFXp('relic_buy');
    }
  }else if(e.def.event==='warden'){
    const id=e.captive;
    vaultAddLegend(id);
    const h=G.heroes.find(x=>x.id===id);
    if(h&&!h.recruited){
      h.recruited=true;
      const st=heroStat(h.hdef,h.lvl);
      h.hp=st.hp;h.maxHp=st.hp;h.dead=false;
      h.x=e.x;h.y=e.y;h.homeX=e.x;h.homeY=e.y;
      addFx({kind:'ring',x:e.x,y:e.y,r:12,maxR:130,life:0.9,col:h.hdef.col});
      burst(e.x,e.y,30,h.hdef.col);
    }
    G.shake=12;
    setBanner('🌟 LEGENDARY FREED: '+HERO_BY[id].name+' joins you — forever! 🌟',true);
    SFXp('horn_victory');
    saveGame();
    if(typeof onWaveEnd==='function')onWaveEnd();
  }
}

function collectChest(x,y){
  if(!G.chest||dist2(x,y,G.chest.x,G.chest.y)>34*34)return false;
  const c=G.chest;G.chest=null;
  const roll=Math.random();
  if(roll<0.6){
    const g=Math.round((90+22*G.wave)*(1+relicVal('treasury')));
    G.gold+=g;G.goldEarned+=g;
    addText(c.x,c.y-16,'+'+g+'g!','#ffd75e',1.4);
    for(let i=0;i<3;i++)addFx({kind:'coinfly',x:c.x+rnd(-10,10),y:c.y+rnd(-10,10),life:0.7,t:0});
  }else if(roll<0.85){
    for(const s of SPELLS)G.spells[s.id]=Math.min(G.spells[s.id],1);
    addText(c.x,c.y-16,'Spells recharged!','#8ad0ff',1.4);
  }else{
    for(const t of G.troops)t.hp=t.maxHp;
    for(const h of activeHeroes())h.hp=h.maxHp;
    addText(c.x,c.y-16,'Army restored!','#7ee08a',1.4);
  }
  burst(c.x,c.y,16,'#ffd75e');
  SFXp('chest');
  return true;
}

/* ================= PEAK BUILD (vault restart) ================= */
function startPeakRun(mapId){
  const pk=vaultPeak(mapId);
  newGame(mapId);
  if(!pk)return;
  Object.assign(G.troopLvl,pk.troopLvl||{});
  Object.assign(G.troopTier,pk.troopTier||{});
  Object.assign(G.relics,pk.relics||{});
  Object.assign(G.desired,pk.desired||{});
  G.lives=maxLives();
  G.gold=Math.max(G.gold,pk.budget||0);
  for(const hs of pk.heroes||[]){
    const h=G.heroes.find(x=>x.id===hs.id);
    if(!h)continue;
    if(h.hdef.legendary&&!vaultHas(h.id))continue;
    h.recruited=true;h.lvl=hs.lvl||1;h.asc=!!hs.asc;
    h.divine=!!hs.dv;h.gw=hs.gw||0;h.ga=hs.ga||0;
    const st=heroLiveStat(h);
    h.hp=st.hp;h.maxHp=st.hp;
  }
  setBanner('⭐ Peak build restored — Wave '+pk.wave+' strength, from wave 1! ⭐',true);
  saveGame();
}

/* ================= FRONTIER EXPANSION ================= */
function expandedPaths(mdef,lvl){
  let paths=mdef.paths.map(p=>p.map(c=>c.slice()));
  let rows=CFG.BASE_ROWS;
  for(let L=0;L<lvl;L++){
    const ex=EXPANSIONS[L];
    rows+=ex.dy;
    paths=paths.map((cells,pi)=>{
      const shifted=cells.map(cell=>[cell[0]+ex.dx,cell[1]+ex.dy]);
      const y0=shifted[0][1];
      let rA=clamp(y0+((pi%2===0)?-(4+2*L):(4+2*L)),1,rows-2);
      if(Math.abs(rA-y0)<2)rA=clamp(y0+3,1,rows-2);
      const k=2+((pi*3+L*2)%(ex.dx-3));
      return [[-1,rA],[k,rA],[k,y0]].concat(shifted);
    });
  }
  return paths;
}
function applyExpansion(lvl,shiftEntities){
  const ex=EXPANSIONS[lvl-1];
  if(!ex)return;
  const oldTotals=MAP.P.map(p=>p.total);
  const px=ex.dx*CFG.CELL, py=ex.dy*CFG.CELL;
  CFG.COLS+=ex.dx;CFG.ROWS+=ex.dy;
  CFG.W=CFG.COLS*CFG.CELL;CFG.H=CFG.ROWS*CFG.CELL;
  G.expLvl=lvl;
  initMapRuntime(MAP.def,expandedPaths(MAP.def,lvl));
  if(shiftEntities){
    for(const t of G.towers){t.c+=ex.dx;t.r+=ex.dy;t.x+=px;t.y+=py;}
    const delta=MAP.P.map((p,i)=>p.total-(oldTotals[i]||0));
    for(const w of G.walls){
      w.d+=delta[w.pi]||0;
      const p=posAt(w.pi,w.d);w.x=p.x;w.y=p.y;w.ang=p.a;
    }
    G.rally=MAP.P.map((p,i)=>clamp((G.rally[i]!==undefined?G.rally[i]:p.total*0.5)+(delta[i]||0),40,p.total-60));
    for(const tr of G.troops){
      tr.d=clamp(tr.d+(delta[tr.pi]||0),10,MAP.P[tr.pi].total-14);
      if(tr.holdD!==undefined)tr.holdD=clamp(tr.holdD+(delta[tr.pi]||0),20,MAP.P[tr.pi].total-40);
      const p=posAt(tr.pi,tr.d);tr.x=p.x;tr.y=p.y;
      tr.foe=null;
    }
    for(const h of G.heroes){h.x+=px;h.y+=py;h.homeX+=px;h.homeY+=py;}
    for(const z of G.zones){z.x+=px;z.y+=py;}
    if(G.chest){G.chest.x+=px;G.chest.y+=py;}
    G.projs.length=0;G.fx.length=0;G.parts.length=0;G.texts.length=0;
    G.enemies.length=0;G.spawnQueue.length=0;
  }
  try{if(typeof canvas!=='undefined'&&canvas){canvas.width=CFG.W;canvas.height=CFG.H;}}catch(err){}
  try{if(typeof clearRenderCaches==='function')clearRenderCaches();}catch(err){}
}
function expandMap(){
  const lvl=G.expLvl||0;
  if(lvl>=EXPANSIONS.length||G.waveActive||G.over)return false;
  const ex=EXPANSIONS[lvl];
  if(G.gold<ex.cost)return false;
  G.gold-=ex.cost;
  applyExpansion(lvl+1,true);
  setBanner('🗺 THE FRONTIER EXPANDS — new lands, longer roads, more room to build!',true);
  SFXp('horn_victory');
  saveGame();
  return true;
}

/* ================= WAVES ================= */
function buildWaveSchedule(w){
  const q=[];
  const nP=MAP.P.length;
  const rndPi=()=>Math.floor(Math.random()*nP);
  if(w%10===0){
    const cycle=Math.floor((w/10-1)%BOSSES.length);
    const tier=Math.floor((w-10)/(BOSSES.length*10))+1;
    const b=BOSSES[cycle];
    q.push({boss:b,tier,delay:2.5,rarity:null,pi:rndPi()});
    const avail=ENEMIES.filter(e=>e.unlock<=w);
    const esc=avail.slice(-3);
    const n=(4+Math.floor(w/5))*nP;
    for(let i=0;i<n;i++)q.push({type:pick(esc).id,delay:1.4/nP,rarity:null,pi:rndPi()});
    setBanner('⚔ WAVE '+w+' — BOSS: '+b.name+(tier>1?' '+(['','II','III','IV','V'][tier]||('x'+tier)):'')+' ⚔',true);
    SFXp('boss_roar');
    return q;
  }
  const avail=ENEMIES.filter(e=>e.unlock<=w);
  const pathFac=1+(nP-1)*0.26*Math.min(1,w/8); // multi-path pressure ramps in over 8 waves
  let budget=(8+w*4+Math.pow(w,1.6)*0.5)*pathFac;
  let interval=Math.max(0.3,1.05-w*0.013)/(0.7+0.3*nP);
  let theme='';
  const roll=Math.random();
  const flyers=avail.filter(e=>e.fly);
  if(w>=13&&flyers.length&&roll<0.14){theme='AIR RAID';budget*=0.85;}
  else if(w>=12&&roll<0.28){theme='SWARM';budget*=1.3;interval*=0.55;}
  else if(w>=11&&roll<0.40){theme='ELITE';budget*=0.75;}
  else if(w>=10&&roll<0.52){theme='ARMORED';}
  let pool=avail;
  if(theme==='AIR RAID')pool=flyers;
  if(theme==='SWARM')pool=avail.filter(e=>e.w<=2.5&&!e.fly);
  if(theme==='ARMORED')pool=avail.filter(e=>e.armor>=0.15);
  if(!pool.length)pool=avail;
  const sorted=[...pool].sort((a,b)=>b.unlock-a.unlock);
  const nTypes=Math.min(sorted.length,2+Math.floor(Math.random()*3));
  const chosen=[];
  for(let i=0;i<nTypes;i++){
    const idx=Math.min(sorted.length-1,Math.floor(Math.pow(Math.random(),1.6)*sorted.length));
    chosen.push(sorted[idx]);
  }
  if(!chosen.length)chosen.push(pick(avail));
  while(budget>0){
    const e=pick(chosen);
    let rarity=null;
    if(theme==='ELITE')rarity='elite';
    else{
      const r=Math.random();
      if(r<champChance(w))rarity='champ';
      else if(r<champChance(w)+eliteChance(w))rarity='elite';
    }
    q.push({type:e.id,delay:interval*rnd(0.7,1.3),rarity,pi:rndPi()});
    budget-=e.w;
  }
  setBanner('Wave '+w+(theme?' — '+theme+'!':''));
  return q;
}
function startWave(bonus){
  if(G.waveActive||G.over)return;
  if(bonus>0){G.gold+=bonus;addText(CFG.W/2,90,'+'+bonus+'g early bonus!','#ffd75e');}
  G.waveActive=true;
  G.waveStartLives=G.lives;
  if(!G.chest&&Math.random()<0.14){
    let tries=0;
    while(tries++<40){
      const c=Math.floor(rnd(1,CFG.COLS-1)),r=Math.floor(rnd(1,CFG.ROWS-1));
      if(!MAP.blocked.has(c+','+r)&&!G.towers.some(t=>t.c===c&&t.r===r)){
        G.chest={x:c*CFG.CELL+20,y:r*CFG.CELL+20,t:12,max:12};
        setBanner(THEME.txt.chest);
        SFXp('chest');
        break;
      }
    }
  }
  G.spawnQueue=buildWaveSchedule(G.wave);
  injectEvents();
  G.spawnT=1.0;
  SFXp('horn_wave');
}
function endWave(){
  if(G.over)return;
  G.waveActive=false;
  if(G.blitz>0){G.blitz--;if(G.blitz===0)setBanner('⏩ Blitz complete — back to real time!',true);}
  const reward=waveReward(G.wave);
  G.gold+=reward;G.goldEarned+=reward;
  addText(CFG.W/2,120,'Wave '+G.wave+' cleared!  +'+reward+'g','#ffd75e');
  /* perfect-wave streak: chain flawless waves for stacking bonus gold */
  if(G.lives>=G.waveStartLives){
    G.streak++;
    const sb=Math.round(reward*0.1*Math.min(5,G.streak));
    G.gold+=sb;G.goldEarned+=sb;
    addText(CFG.W/2,152,'🔥 PERFECT WAVE ×'+G.streak+'!  +'+sb+'g','#ffa94e',1.6);
    if(G.streak>=2)SFXp('chest');
  }else G.streak=0;
  if(G.wave%5===0&&G.wave%10!==0){
    const chest=Math.round((40+10*G.wave)*(1+relicVal('treasury')));
    G.gold+=chest;G.goldEarned+=chest;
    addText(CFG.W/2,152,'🎁 Milestone chest: +'+chest+'g','#ffe8a0',1.6);
    SFXp('chest');
  }
  /* hero unlock announcements */
  for(const h of G.heroes){
    const uw=heroEffUnlock(h.hdef);
    if(uw>0&&G.wave+1>=uw&&G.wave<uw){/*noop*/}
  }
  G.wave++;
  for(const h of G.heroes){
    if(!h.recruited&&heroEffUnlock(h.hdef)===G.wave)
      setBanner('✦ A new hero seeks your banner: '+h.hdef.name+'! ✦',true);
  }
  G.intermission=CFG.INTERMISSION;
  for(const h of activeHeroes())h.hp=Math.min(h.maxHp,h.hp+h.maxHp*0.25);
  /* vault: record peak build for the ⭐ Peak Start button */
  try{
    const v=vaultData();
    const cleared=G.wave-1;
    const prev=v.peaks[G.mapId];
    if(!prev||cleared>prev.wave){
      const invested=G.towers.reduce((s,t)=>s+towerInvested(TOWER_BY[t.id],t.lvl),0);
      v.peaks[G.mapId]={
        wave:cleared,
        budget:Math.max(MAP.def.mods.startGold||CFG.START_GOLD,Math.round(invested*0.6+G.gold*0.4)),
        heroes:G.heroes.filter(h=>h.recruited).map(h=>({id:h.id,lvl:h.lvl,asc:!!h.asc,dv:!!h.divine,gw:h.gw||0,ga:h.ga||0})),
        troopLvl:Object.assign({},G.troopLvl),
        troopTier:Object.assign({},G.troopTier),
        relics:Object.assign({},G.relics),
        desired:Object.assign({},G.desired),
      };
      vaultSave();
    }
  }catch(err){}
  saveGame();
  SFXp('horn_victory');
  if(typeof onWaveEnd==='function')onWaveEnd();
}

function spawnEnemy(entry){
  const w=G.wave;
  let def,tier=1,boss=false;
  if(entry.boss){def=entry.boss;tier=entry.tier;boss=true;}
  else if(entry.calamityId)def=CALAMITY_BY[entry.calamityId];
  else if(entry.eventId)def=EVENT_DEFS[entry.eventId];
  else def=ENEMY_BY[entry.type];
  const hm=hpMul(w)*(boss?Math.pow(2.1,tier-1)*(w===10?0.85:1):1)*(def.event==='boar'?3.2:1)*(def.event==='warden'?0.9:1)*(def.event==='calamity'?(2.2+w*0.03):1);
  let hp=def.hp*hm, gold=Math.round(def.gold*goldMul(w)), size=def.size, leak=def.leak, rarity=entry.rarity;
  let spd=def.speed*speedMul(w)*rnd(0.92,1.08);
  if(rarity==='elite'){hp*=2.6;gold=Math.round(gold*3);size*=1.18;spd*=1.05;}
  if(rarity==='champ'){hp*=6;gold=Math.round(gold*8);size*=1.4;leak*=2;}
  const pi=entry.pi||0;
  G.enemies.push({
    def,boss,tier,rarity,hp,maxHp:hp,gold,leak,size,pi,
    d:rnd(0,10),lane:boss?0:rnd(-15,15),x:MAP.P[pi].pts[0].x,y:MAP.P[pi].pts[0].y,
    speed:spd,baseSpeed:spd,armor:def.armor,
    slowT:0,slowP:0,burnT:0,burnDps:0,poison:[],flash:0,
    blk:null,atkCd:rnd(0.2,0.8),abCd:def.abCd||0,anim:rnd(0,6),dead:false,
    captive:entry.captive||null,
  });
  if(boss)G.shake=Math.max(G.shake,8);
  if(def.event==='calamity'){setBanner(THEME.txt.calamitySpawn(def.name),true);SFXp('boss_roar');G.shake=Math.max(G.shake,10);}
  if(def.event==='boar'){setBanner(THEME.txt.boarSpawn);SFXp('chest');}
  if(def.event==='warden'){setBanner(THEME.txt.wardenSpawn(HERO_BY[entry.captive].name),true);SFXp('boss_roar');}
}

/* ================= DAMAGE ================= */
function damageEnemy(e,dmg,dtype,opts){
  if(e.dead)return;
  let final=dmg;
  if(dtype==='phys'){
    let armor=e.armor;
    if(opts&&opts.pierceArmor)armor*=(1-opts.pierceArmor);
    final*=(1-armor);
  }
  e.hp-=final;
  e.flash=0.1;
  if(e.hp<=0&&!e.dead&&opts&&opts.srcT)opts.srcT.kills=(opts.srcT.kills||0)+1;
  if(final>=1&&G.texts.length<(LOW_FX?30:60)&&Math.random()<(LOW_FX?0.25:0.55))
    addText(e.x+rnd(-8,8),e.y-e.size-8,fmt(final),dtype==='magic'?'#9ad4ff':'#fff',0.8);
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  if(e.dead)return;
  e.dead=true;
  G.gold+=e.gold;G.goldEarned+=e.gold;G.kills++;
  addText(e.x,e.y-e.size-14,'+'+e.gold,'#ffd75e',1);
  burst(e.x,e.y,e.boss?40:10,e.def.col);
  addFx({kind:'die',x:e.x,y:e.y,life:0.5,col:e.def.col,size:e.size});
  addFx({kind:'coinfly',x:e.x,y:e.y,life:0.7,t:0});
  if(e.def.event){eventReward(e);}
  /* 🗡 ultra-rare gear finds from elites & champions */
  if(e.rarity&&!e.def.event&&Math.random()<GEAR_CHANCE*(e.rarity==='champ'?2:1)){
    const hs2=G.heroes.filter(h=>h.recruited);
    if(hs2.length){
      const h2=pick(hs2);
      const slot=Math.random()<0.5?'gw':'ga';
      const arr=slot==='gw'?GEAR_W:GEAR_A;
      const cur=h2[slot]||0;
      if(cur<arr.length-1){
        h2[slot]=cur+1;
        const gr=arr[cur+1];
        setBanner((slot==='gw'?'⚔ ':'🛡 ')+h2.hdef.name+' found '+gr.name+'! (+'+Math.round(gr.mul*100)+'% '+(slot==='gw'?'damage':'health')+')',true);
        const st2=heroLiveStat(h2);h2.maxHp=st2.hp;if(!h2.dead)h2.hp=Math.min(st2.hp,h2.hp+st2.hp*0.2);
        SFXp('chest');
      }
    }
  }
  /* the Lich harvests souls */
  if(!e.boss&&!e.def.event){
    const lich=G.heroes.find(h=>h.id==='lich'&&h.recruited&&!h.dead);
    if(lich&&dist2(lich.x,lich.y,e.x,e.y)<260*260){
      const ch=lich.lvl>=(lich.hdef.passive?lich.hdef.passive.lvl:99)?0.14:0.09;
      if(Math.random()<ch)spawnSkeletonAt(e.pi,e.d);
    }
  }
  if(e.boss){
    G.bossKills++;G.shake=14;
    addFx({kind:'ring',x:e.x,y:e.y,r:10,maxR:130,life:0.7,col:'#ffd75e'});
    setBanner('☠ '+e.def.name+' defeated! ☠');
    SFXp('boss_die');
  }else if(e.rarity){
    addFx({kind:'ring',x:e.x,y:e.y,r:6,maxR:50,life:0.4,col:e.rarity==='champ'?'#ffd75e':'#c88bff'});
    SFXp('elite_die');
  }else SFXp(pick(['enemy_die1','enemy_die2','enemy_die3']));
}
function leakEnemy(e){
  e.dead=true;
  if(e.def.event&&e.def.event!=='calamity'){
    setBanner(e.def.event==='warden'
      ?THEME.txt.wardenEscape(e.captive&&HERO_BY[e.captive]?HERO_BY[e.captive].name:'its captive')
      :THEME.txt.boarEscape);
    return;
  }
  if(e.def.event==='calamity')setBanner('☄️ '+e.def.name+' rampaged through your gate! −'+e.leak+' ❤',true);
  G.lives-=e.leak;
  G.shake=Math.max(G.shake,e.leak>=3?10:4);
  addFx({kind:'ring',x:e.x,y:e.y,r:8,maxR:60,life:0.5,col:'#ff5a5a'});
  addText(CFG.W-140,80,'-'+e.leak+' ❤','#ff6a6a',1.4);
  SFXp('leak');
  if(G.lives<=0){
    G.lives=0;G.over=true;
    try{
      const k='rs2_best_'+G.mapId;
      const b=+localStorage.getItem(k)||0;
      if(G.wave>b)localStorage.setItem(k,G.wave);
    }catch(err){}
    clearSave();
    SFXp('game_over');
    if(typeof onGameOver==='function')onGameOver();
  }
}
function damageAlly(t,dmg){
  if(t.isWall){
    t.hp-=dmg;t.flash=0.1;
    if(t.hp<=0){
      burst(t.x,t.y,16,'#8d8798');
      addFx({kind:'ring',x:t.x,y:t.y,r:8,maxR:40,life:0.4,col:'#b8b2c0'});
      SFXp('boom');
    }
    return;
  }
  if(t.isHero){
    if(t.bulwarkT>0)dmg*=0.35;
    if(t.hdef.passive&&t.lvl>=t.hdef.passive.lvl){
      if(t.hdef.id==='bjorn')dmg*=0.7;
      if(t.hdef.id==='garrick')dmg*=0.6;
      if(t.hdef.id==='nyx'&&Math.random()<0.25){addText(t.x,t.y-20,'dodge','#c88bff',0.7);return;}
    }
  }else{
    const armor=TROOP_BY[t.id].armor||0;
    dmg*=(1-armor);
  }
  if(G.shieldT>0)dmg*=0.6;
  t.hp-=dmg;
  t.flash=0.1;
  if(t.hp<=0){
    if(t.isHero){
      t.dead=true;t.respawnT=heroStat(t.hdef,t.lvl).respawn;
      burst(t.x,t.y,20,t.hdef.col);
      addFx({kind:'die',x:t.x,y:t.y,life:0.6,col:t.hdef.col,size:13});
      setBanner(t.hdef.name+' has fallen! Respawning…');
      SFXp('hero_die');
    }else{
      t.deadFlag=true;
      burst(t.x,t.y,8,'#aab6c8');
      addFx({kind:'die',x:t.x,y:t.y,life:0.45,col:'#8a96a8',size:10});
    }
  }
}

function spawnSkeletonAt(pi,d){
  const w=G.wave;
  const hp=Math.round(90*Math.sqrt(hpMul(w))*2.2);
  const dmg=8*Math.sqrt(hpMul(w));
  const p=posAt(pi,d);
  G.troops.push({id:'skeleton',lvl:0,pi,d,lane:rnd(-15,15),x:p.x,y:p.y,
    hp,maxHp:hp,skelDmg:dmg,atkCd:rnd(0,0.4),foe:null,state:'walk',anim:rnd(0,6),face:-1,
    healCd:0,swing:0,flash:0,decay:26});
  burst(p.x,p.y,10,'#9ae05e');
  addFx({kind:'ring',x:p.x,y:p.y,r:4,maxR:26,life:0.35,col:'#9ae05e'});
}

/* ================= FX helpers ================= */
function burst(x,y,n,col){
  if(LOW_FX)n=Math.ceil(n/2);
  const cap=LOW_FX?220:520;
  for(let i=0;i<n;i++){
    if(G.parts.length>cap)return;
    const a=Math.random()*Math.PI*2,s=rnd(20,110);
    G.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,life:rnd(0.3,0.8),maxLife:0.8,col,sz:rnd(1.5,3.5)});
  }
}
function addText(x,y,txt,col,life){
  if(G.texts.length>70)return;
  G.texts.push({x,y,txt,col,life:life||1,maxLife:life||1,pop:0.15});
}
function addFx(f){if(G.fx.length<90)G.fx.push(f);}

/* ================= TOWER FIRE ================= */
function towerFire(t,st,def){
  const inRange=G.enemies.filter(e=>!e.dead&&!(e.def.fly&&def.targets!=='both')&&dist2(t.x,t.y,e.x,e.y)<st.range*st.range);
  if(!inRange.length)return false;
  let tgt;
  if(def.id==='arbalest'){
    const fly=inRange.filter(e=>e.def.fly);
    const pool=fly.length?fly:inRange;
    tgt=pool.reduce((a,b)=>a.hp>b.hp?a:b);
  }
  else if(def.id==='ballista')tgt=inRange.reduce((a,b)=>a.hp>b.hp?a:b);
  else tgt=inRange.reduce((a,b)=>(MAP.P[a.pi].total-a.d)<(MAP.P[b.pi].total-b.d)?a:b); // closest to the gate

  t.ang=Math.atan2(tgt.y-t.y,tgt.x-t.x);
  const dmg=st.dmg*t.auraMul*(1+relicVal('engineering'))*(1+towerRank(t)*0.03)*towerTierMul(t)*(1+ARTIFACT_BY.crown.per*artVal('crown'));
  switch(def.id){
    case 'archer':
      for(let i=0;i<st.multishot;i++){
        const tg=i===0?tgt:(inRange[Math.floor(Math.random()*inRange.length)]);
        G.projs.push({kind:'arrow',x:t.x,y:t.y-30,tgt:tg,lx:tg.x,ly:tg.y,spd:430,dmg,dtype:'phys',srcT:t});
      }
      if(!LOW_FX)addFx({kind:'muzzle',x:t.x,y:t.y-30,ang:t.ang,life:0.08,col:'#e8dcb0'});
      SFXp('arrow');break;
    case 'frost':
      G.projs.push({kind:'shard',x:t.x,y:t.y-32,tgt,lx:tgt.x,ly:tgt.y,spd:360,dmg,dtype:'magic',slow:st.slow,slowDur:st.slowDur,srcT:t});
      SFXp('frost');break;
    case 'cannon':{
      const tt=Math.hypot(tgt.x-t.x,tgt.y-t.y)/260;
      const px=tgt.x+Math.cos(posAt(tgt.pi,tgt.d).a)*tgt.baseSpeed*tt*0.6,py=tgt.y;
      G.projs.push({kind:'ball',x0:t.x,y0:t.y-28,x1:px,y1:py,x:t.x,y:t.y-28,t:0,dur:tt,dmg,dtype:'phys',splash:st.splash,srcT:t});
      addFx({kind:'muzzle',x:t.x+Math.cos(t.ang)*16,y:t.y-24+Math.sin(t.ang)*16,ang:t.ang,life:0.12,col:'#ffb02a'});
      G.shake=Math.max(G.shake,1.5);
      SFXp('cannon');break;}
    case 'poison':{
      const tt=Math.hypot(tgt.x-t.x,tgt.y-t.y)/240;
      G.projs.push({kind:'glob',x0:t.x,y0:t.y-24,x1:tgt.x,y1:tgt.y,x:t.x,y:t.y-24,t:0,dur:tt,dmg,dtype:'magic',splash:st.splash,poison:st.poison,poisonDur:st.poisonDur,srcT:t});
      SFXp('poison');break;}
    case 'arbalest':
    case 'ballista':{
      const a=t.ang;
      G.projs.push({kind:'bolt',x:t.x+Math.cos(a)*16,y:t.y-24+Math.sin(a)*16,vx:Math.cos(a)*540,vy:Math.sin(a)*540,
        dist:st.range+40,dmg,dtype:'phys',pierce:st.pierce,hit:new Set(),srcT:t});
      SFXp('ballista');break;}
    case 'storm':{
      const pts=[{x:t.x,y:t.y-40}];
      let cur=tgt,d=dmg;
      const hitSet=new Set();
      for(let i=0;i<st.chain&&cur;i++){
        hitSet.add(cur);
        damageEnemy(cur,d,'magic',{srcT:t});
        pts.push({x:cur.x,y:cur.y});
        d*=0.75;
        let next=null,bd=90*90;
        for(const e of G.enemies){
          if(e.dead||hitSet.has(e))continue;
          const q=dist2(cur.x,cur.y,e.x,e.y);
          if(q<bd){bd=q;next=e;}
        }
        cur=next;
      }
      addFx({kind:'zap',pts,life:0.18});
      SFXp('zap');break;}
    case 'flame':{
      damageEnemy(tgt,dmg,'magic',{srcT:t});
      tgt.burnT=st.burnDur;tgt.burnDps=Math.max(tgt.burnDps,st.burn*t.auraMul*(1+relicVal('engineering')));
      for(let i=0;i<(LOW_FX?1:2);i++){
        if(G.parts.length<(LOW_FX?220:520)){
          const a=t.ang+rnd(-0.25,0.25),s=rnd(120,200);
          G.parts.push({x:t.x+Math.cos(t.ang)*14,y:t.y-24+Math.sin(t.ang)*14,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(0.2,0.45),maxLife:0.45,col:pick(['#ffb02a','#ff7a2a','#ffd75e']),sz:rnd(2,4),glow:true});
        }
      }
      if(t.heat<=0){SFXp('flame');t.heat=0.5;}
      break;}
  }
  return true;
}

/* ================= HERO SKILLS ================= */
function castHeroSkill(h){
  const def=h.hdef,st=heroLiveStat(h);
  const sk=def.skill;
  switch(sk.id){
    case 'slam':{
      let n=0;
      for(const e of G.enemies)if(!e.dead&&dist2(h.x,h.y,e.x,e.y)<100*100)n++;
      if(n<2)return false;
      addFx({kind:'ring',x:h.x,y:h.y,r:10,maxR:100,life:0.45,col:def.col});
      G.shake=Math.max(G.shake,5);
      for(const e of G.enemies){
        if(e.dead)continue;
        if(dist2(h.x,h.y,e.x,e.y)<100*100){
          damageEnemy(e,st.dmg*2.4,'magic');
          if(!e.boss){e.slowT=Math.max(e.slowT,0.8);e.slowP=Math.max(e.slowP,0.9);}
        }
      }
      break;}
    case 'arrowstorm':{
      const tgt=densestCluster(h.x,h.y,280);
      if(!tgt||tgt.n<4)return false;
      for(let i=0;i<12;i++){
        const cand=G.enemies.filter(e=>!e.dead&&dist2(e.x,e.y,tgt.x,tgt.y)<120*120);
        if(!cand.length)break;
        const e=pick(cand);
        damageEnemy(e,st.dmg*1.2,'phys');
        addFx({kind:'rainarrow',x:e.x+rnd(-10,10),y:e.y,life:0.35,t:0});
      }
      break;}
    case 'meteor':{
      const tgt=densestCluster(h.x,h.y,320);
      if(!tgt||tgt.n<4)return false;
      addFx({kind:'meteor',x:tgt.x,y:tgt.y,life:0.8,t:0});
      G.shake=Math.max(G.shake,9);
      for(const e of G.enemies){
        if(e.dead)continue;
        if(dist2(e.x,e.y,tgt.x,tgt.y)<110*110){
          damageEnemy(e,st.dmg*6,'magic');
          if(!e.dead){e.burnT=3;e.burnDps=Math.max(e.burnDps,st.dmg*0.6);}
        }
      }
      burst(tgt.x,tgt.y,30,'#ff9a3a');
      break;}
    case 'sanctuary':{
      let hurt=0,total=0;
      for(const t of G.troops){total++;if(t.hp<t.maxHp*0.7)hurt++;}
      for(const ah of activeHeroes()){total++;if(ah.hp<ah.maxHp*0.7)hurt++;}
      if(total===0||hurt<Math.max(1,total*0.3))return false;
      for(const t of G.troops){t.hp=Math.min(t.maxHp,t.hp+t.maxHp*0.45);addFx({kind:'heal',x:t.x,y:t.y,life:0.6});}
      for(const ah of activeHeroes()){ah.hp=Math.min(ah.maxHp,ah.hp+ah.maxHp*0.45);}
      G.shieldT=4;
      addFx({kind:'ring',x:h.x,y:h.y,r:20,maxR:260,life:0.8,col:'#ffe8a8'});
      break;}
    case 'warcry':{
      let n=0;
      for(const e of G.enemies)if(!e.dead&&dist2(h.x,h.y,e.x,e.y)<150*150)n++;
      if(n<3)return false;
      for(const e of G.enemies){
        if(e.dead)continue;
        if(dist2(h.x,h.y,e.x,e.y)<150*150){
          e.slowT=Math.max(e.slowT,e.boss?0.7:2);e.slowP=1;
        }
      }
      h.hp=Math.min(h.maxHp,h.hp+h.maxHp*0.2);
      addFx({kind:'ring',x:h.x,y:h.y,r:14,maxR:150,life:0.5,col:def.col});
      G.shake=Math.max(G.shake,6);
      break;}
    case 'skysweep':{
      const flyers=G.enemies.filter(e=>!e.dead&&e.def.fly);
      if(flyers.length<2)return false;
      for(const e of flyers){
        damageEnemy(e,st.dmg*4,'magic');
        addFx({kind:'slash',x:e.x,y:e.y-14,life:0.25,col:def.col});
        if(!e.dead)burst(e.x,e.y,5,def.col);
      }
      const tgt2=densestCluster(h.x,h.y,320);
      if(tgt2){
        addFx({kind:'firestorm',x:tgt2.x,y:tgt2.y,r:80,life:0.7,t:0});
        for(const e of G.enemies){
          if(e.dead||e.def.fly)continue;
          if(dist2(e.x,e.y,tgt2.x,tgt2.y)<80*80)damageEnemy(e,st.dmg*1.5,'magic');
        }
      }
      G.shake=Math.max(G.shake,5);
      break;}
    case 'massraise':{
      let n=0;
      for(const e of G.enemies)if(!e.dead&&dist2(h.x,h.y,e.x,e.y)<300*300)n++;
      if(n<2)return false;
      const np=nearestPathPoint(h.x,h.y);
      for(let i=0;i<5;i++)spawnSkeletonAt(np.pi,clamp(np.d+rnd(-60,60),20,MAP.P[np.pi].total-30));
      G.shake=Math.max(G.shake,4);
      break;}
    case 'tempest':{
      const cand=G.enemies.filter(e=>!e.dead&&dist2(h.x,h.y,e.x,e.y)<340*340)
        .sort((a,b)=>b.hp-a.hp).slice(0,12);
      if(cand.length<3)return false;
      let prev={x:h.x,y:h.y-20};
      for(const e of cand){
        damageEnemy(e,st.dmg*2.4,'magic');
        addFx({kind:'zap',pts:[{x:prev.x,y:prev.y},{x:e.x,y:e.y}],life:0.22});
        if(!e.dead){e.slowT=Math.max(e.slowT,1);e.slowP=Math.max(e.slowP,0.3);}
        prev=e;
      }
      G.shake=Math.max(G.shake,6);
      break;}
    case 'bulwark':{
      let n=0;
      for(const e of G.enemies)if(!e.dead&&!e.def.fly&&dist2(h.x,h.y,e.x,e.y)<170*170)n++;
      if(n<2)return false;
      h.bulwarkT=5;
      h.hp=Math.min(h.maxHp,h.hp+h.maxHp*0.35);
      for(const e of G.enemies){
        if(e.dead||e.def.fly)continue;
        if(dist2(h.x,h.y,e.x,e.y)<170*170&&!e.blk)e.blk=h;
      }
      addFx({kind:'ring',x:h.x,y:h.y,r:12,maxR:170,life:0.6,col:'#d8b45a'});
      G.shake=Math.max(G.shake,5);
      break;}
    case 'shadowflurry':{
      const cand=G.enemies.filter(e=>!e.dead&&dist2(h.x,h.y,e.x,e.y)<220*220)
        .sort((a,b)=>b.hp-a.hp).slice(0,6);
      if(cand.length<3)return false;
      for(const e of cand){
        damageEnemy(e,st.dmg*3,'phys');
        addFx({kind:'slash',x:e.x,y:e.y,life:0.2,col:def.col});
        burst(e.x,e.y,4,def.col);
      }
      const last=cand[cand.length-1];
      h.x=last.x+rnd(-20,20);h.y=last.y+rnd(-20,20);
      break;}
    case 'dawnburst':{
      let n=0;
      for(const e of G.enemies)if(!e.dead&&dist2(h.x,h.y,e.x,e.y)<130*130)n++;
      if(n<2)return false;
      addFx({kind:'ring',x:h.x,y:h.y,r:14,maxR:130,life:0.6,col:'#ffe9a0'});
      G.shake=Math.max(G.shake,6);
      for(const e of G.enemies){
        if(e.dead)continue;
        if(dist2(h.x,h.y,e.x,e.y)<130*130)damageEnemy(e,st.dmg*3,'magic');
      }
      for(const t of G.troops)if(dist2(t.x,t.y,h.x,h.y)<150*150){t.hp=Math.min(t.maxHp,t.hp+t.maxHp*0.3);addFx({kind:'heal',x:t.x,y:t.y,life:0.5});}
      for(const ah of activeHeroes())if(dist2(ah.x,ah.y,h.x,h.y)<150*150)ah.hp=Math.min(ah.maxHp,ah.hp+ah.maxHp*0.3);
      break;}
    case 'dragonfire':{
      const tgt=densestCluster(h.x,h.y,300);
      if(!tgt||tgt.n<3)return false;
      addFx({kind:'firestorm',x:tgt.x,y:tgt.y,r:100,life:0.9,t:0});
      G.shake=Math.max(G.shake,5);
      for(const e of G.enemies){
        if(e.dead)continue;
        if(dist2(e.x,e.y,tgt.x,tgt.y)<100*100){
          damageEnemy(e,st.dmg*3.5,'magic');
          if(!e.dead){e.burnT=3.5;e.burnDps=Math.max(e.burnDps,st.dmg*0.7);}
        }
      }
      break;}
    case 'ravenstorm':{
      const cand=G.enemies.filter(e=>!e.dead&&dist2(h.x,h.y,e.x,e.y)<300*300)
        .sort((a,b)=>b.hp-a.hp).slice(0,10);
      if(cand.length<3)return false;
      for(const e of cand){
        damageEnemy(e,st.dmg*2.2,'magic');
        if(!e.dead&&!e.boss){e.slowT=Math.max(e.slowT,1.5);e.slowP=Math.max(e.slowP,0.5);}
        addFx({kind:'slash',x:e.x,y:e.y,life:0.25,col:'#c88bff'});
        burst(e.x,e.y,3,'#221c30');
      }
      break;}
  }
  addText(h.x,h.y-26,sk.name+'!',def.col,1.1);
  SFXp(sk.snd);
  return true;
}
function densestCluster(x,y,maxR){
  let best=null,bn=0;
  for(const e of G.enemies){
    if(e.dead||dist2(x,y,e.x,e.y)>maxR*maxR)continue;
    let n=0;
    for(const o of G.enemies)if(!o.dead&&dist2(e.x,e.y,o.x,o.y)<110*110)n++;
    if(n>bn){bn=n;best=e;}
  }
  return best?{x:best.x,y:best.y,n:bn}:null;
}

/* ================= UPDATE ================= */
function stepSim(dt){
  if(!G||G.over||G.paused)return;
  const step=1/30;
  let rem=dt*G.speed;
  while(rem>0&&!G.over){
    const h=Math.min(step,rem);
    subStep(h);
    rem-=h;
  }
}
function subStep(dt){
  G.time+=dt;
  if(G.bannerT>0)G.bannerT-=dt;
  if(G.shake>0)G.shake=Math.max(0,G.shake-dt*30);
  if(G.shieldT>0)G.shieldT-=dt;
  if(G.ragnarokT>0)G.ragnarokT-=dt;
  for(const s of SPELLS)if(G.spells[s.id]>0)G.spells[s.id]-=dt;
  for(const z of G.zones){
    z.t-=dt;
    if(z.kind==='bless'){
      for(const t of G.troops)if(dist2(t.x,t.y,z.x,z.y)<z.r*z.r)t.hp=Math.min(t.maxHp,t.hp+t.maxHp*0.12*dt);
      for(const h of activeHeroes())if(dist2(h.x,h.y,z.x,z.y)<z.r*z.r)h.hp=Math.min(h.maxHp,h.hp+h.maxHp*0.12*dt);
    }
  }
  G.zones=G.zones.filter(z=>z.t>0);

  if(!G.waveActive){
    if(G.autoWave){
      G.intermission-=dt;
      if(G.intermission<=0)startWave(0);
    }
  }else{
    if(G.spawnQueue.length){
      G.spawnT-=dt;
      if(G.spawnT<=0){
        const entry=G.spawnQueue.shift();
        spawnEnemy(entry);
        G.spawnT=entry.delay;
      }
    }else if(!G.enemies.length){
      endWave();
    }
  }

  maintainArmy(dt);
  for(const w of G.walls){
    if(w.flash>0)w.flash-=dt;
    if(w.hp<w.maxHp&&artVal('aegis')>0)w.hp=Math.min(w.maxHp,w.hp+w.maxHp*0.008*artVal('aegis')*dt);
  }
  G.walls=G.walls.filter(w=>w.hp>0);
  if(G.chest){
    G.chest.t-=dt;
    if(G.chest.t<=0)G.chest=null;
  }

  /* aura */
  G.auraT-=dt;
  if(G.auraT<=0){
    G.auraT=0.5;
    for(const t of G.towers)t.auraMul=1;
    for(const b of G.towers){
      if(b.id!=='beacon')continue;
      const st=towerStat(TOWER_BY.beacon,b.lvl);
      for(const t of G.towers){
        if(t===b||t.id==='beacon'||t.id==='mint')continue;
        if(dist2(b.x,b.y,t.x,t.y)<st.range*st.range)t.auraMul+=st.aura;
      }
    }
  }

  /* towers */
  for(const t of G.towers){
    const def=TOWER_BY[t.id];
    if(t.heat>0)t.heat-=dt;
    if(def.spawnTroop){
      t.tick+=dt;
      if(t.tick>=def.spawnCd/(1+0.1*(t.lvl-1))){
        t.tick=0;
        const cap=def.spawnN+((t.tier||1)-1);
        const alive=G.troops.filter(u=>u.srcT===t).length;
        if(alive<cap){
          const np=nearestPathPoint(t.x,t.y);
          const d=clamp(np.d+rnd(-30,30),20,MAP.P[np.pi].total-40);
          const lvl=(t.lvl-1)*2+((t.tier||1)-1)*3;
          const st=troopStat(def.spawnTroop,lvl);
          G.troops.push({id:def.spawnTroop,lvl,pi:np.pi,d,lane:rnd(-15,15),x:t.x,y:t.y,
            hp:st.hp,maxHp:st.hp,atkCd:rnd(0,0.4),foe:null,state:'walk',anim:rnd(0,6),face:-1,
            healCd:0,swing:0,flash:0,decay:30,holdD:d,srcT:t});
          burst(t.x,t.y-10,8,def.hue);
          SFXp('recruit');
        }
      }
      continue;
    }
    if(def.id==='mint'){
      t.tick+=dt;
      if(t.tick>=5){
        t.tick=0;
        const st=towerStat(def,t.lvl);
        const inc=Math.round(st.income*(1+relicVal('treasury'))*towerTierMul(t));
        G.gold+=inc;G.goldEarned+=inc;
        addText(t.x,t.y-30,'+'+inc+'g','#ffd75e',1);
        burst(t.x,t.y-20,4,'#ffd75e');
        SFXp('mint_coin');
      }
      continue;
    }
    if(def.id==='beacon')continue;
    t.cd-=dt;
    if(t.cd<=0){
      const st=towerStat(def,t.lvl);
      st.range*=1+0.08*((t.tier||1)-1);
      if(towerFire(t,st,def))t.cd=1/st.rate;
      else t.cd=0.08;
    }
  }

  /* projectiles */
  for(const p of G.projs){
    if(p.kind==='arrow'||p.kind==='shard'){
      const tx=p.tgt&&!p.tgt.dead?p.tgt.x:p.lx, ty=p.tgt&&!p.tgt.dead?p.tgt.y:p.ly;
      p.lx=tx;p.ly=ty;
      const dx=tx-p.x,dy=ty-p.y,L=Math.hypot(dx,dy);
      if(L<10){
        p.done=true;
        if(p.tgt&&!p.tgt.dead){
          damageEnemy(p.tgt,p.dmg,p.dtype,{srcT:p.srcT});
          if(p.slow){p.tgt.slowT=Math.max(p.tgt.slowT,p.slowDur);p.tgt.slowP=Math.max(p.tgt.slowP,p.tgt.boss?p.slow*0.4:p.slow);burst(p.tgt.x,p.tgt.y,3,'#aee6ff');}
        }
      }else{p.x+=dx/L*p.spd*dt;p.y+=dy/L*p.spd*dt;p.ang=Math.atan2(dy,dx);}
    }else if(p.kind==='ball'||p.kind==='glob'){
      p.t+=dt;
      const u=Math.min(1,p.t/p.dur);
      p.x=lerp(p.x0,p.x1,u);p.y=lerp(p.y0,p.y1,u)-Math.sin(u*Math.PI)*60;
      if(u>=1){
        p.done=true;
        const col=p.kind==='glob'?'#8ee05a':'#ffb02a';
        addFx({kind:'ring',x:p.x1,y:p.y1,r:4,maxR:p.splash,life:0.3,col});
        burst(p.x1,p.y1,p.kind==='glob'?8:12,col);
        if(p.kind==='ball')G.shake=Math.max(G.shake,2);
        for(const e of G.enemies){
          if(e.dead||e.def.fly)continue; // ground bursts can't reach flyers
          if(dist2(e.x,e.y,p.x1,p.y1)<p.splash*p.splash){
            damageEnemy(e,p.dmg,p.dtype,{srcT:p.srcT});
            if(p.poison&&!e.dead){
              if(e.poison.length<6)e.poison.push({t:p.poisonDur,dps:p.poison});
              else e.poison[0]={t:p.poisonDur,dps:p.poison};
            }
          }
        }
      }
    }else if(p.kind==='bolt'){
      const mv=Math.hypot(p.vx,p.vy)*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.dist-=mv;
      for(const e of G.enemies){
        if(e.dead||p.hit.has(e))continue;
        if(dist2(e.x,e.y,p.x,p.y)<(e.size+7)*(e.size+7)){
          p.hit.add(e);
          damageEnemy(e,p.dmg,'phys',{srcT:p.srcT});
          burst(e.x,e.y,4,'#d8c9a0');
          if(p.hit.size>=p.pierce){p.done=true;break;}
        }
      }
      if(p.dist<=0||p.x<-40||p.x>CFG.W+40||p.y<-40||p.y>CFG.H+40)p.done=true;
    }else if(p.kind==='tproj'||p.kind==='hproj'){
      const tx=p.tgt&&!p.tgt.dead?p.tgt.x:p.lx, ty=p.tgt&&!p.tgt.dead?p.tgt.y:p.ly;
      p.lx=tx;p.ly=ty;
      const dx=tx-p.x,dy=ty-p.y,L=Math.hypot(dx,dy);
      if(L<10){
        p.done=true;
        if(p.splash){
          addFx({kind:'ring',x:tx,y:ty,r:4,maxR:p.splash,life:0.25,col:p.col||'#c88bff'});
          for(const e of G.enemies){
            if(e.dead)continue;
            if(dist2(e.x,e.y,tx,ty)<p.splash*p.splash){
              damageEnemy(e,p.dmg,'magic');
              if(p.burn&&!e.dead){e.burnT=2.5;e.burnDps=Math.max(e.burnDps,p.burn);}
            }
          }
        }else if(p.tgt&&!p.tgt.dead){
          damageEnemy(p.tgt,p.dmg,p.dtype,{pierceArmor:p.pierceArmor});
          if(p.burn&&!p.tgt.dead){p.tgt.burnT=2.5;p.tgt.burnDps=Math.max(p.tgt.burnDps,p.burn);}
          if(p.slowHit&&!p.tgt.dead&&!p.tgt.boss){p.tgt.slowT=Math.max(p.tgt.slowT,1.5);p.tgt.slowP=Math.max(p.tgt.slowP,p.slowHit);}
          if(p.arc){
            let nb=null,bd2=1e9;
            for(const e of G.enemies){
              if(e.dead||e===p.tgt)continue;
              const q2=dist2(p.tgt.x,p.tgt.y,e.x,e.y);
              if(q2<140*140&&q2<bd2){bd2=q2;nb=e;}
            }
            if(nb){
              damageEnemy(nb,p.dmg*0.6,'magic');
              addFx({kind:'zap',pts:[{x:p.tgt.x,y:p.tgt.y},{x:nb.x,y:nb.y}],life:0.18});
            }
          }
        }
      }else{p.x+=dx/L*p.spd*dt;p.y+=dy/L*p.spd*dt;p.ang=Math.atan2(dy,dx);}
    }
  }
  G.projs=G.projs.filter(p=>!p.done);

  /* enemies */
  for(const e of G.enemies){
    if(e.dead)continue;
    e.anim+=dt*(e.speed/30);
    if(e.flash>0)e.flash-=dt;
    if(e.burnT>0){e.burnT-=dt;e.hp-=e.burnDps*dt;if(e.hp<=0){killEnemy(e);continue;}}
    if(e.poison.length){
      let pd=0;
      for(const ps of e.poison){ps.t-=dt;pd+=ps.dps;}
      e.poison=e.poison.filter(ps=>ps.t>0);
      e.hp-=pd*dt;
      if(e.hp<=0){killEnemy(e);continue;}
    }
    if(e.slowT>0){e.slowT-=dt;if(e.slowT<=0)e.slowP=0;}
    if(e.def.regen)e.hp=Math.min(e.maxHp,e.hp+e.maxHp*e.def.regen*dt);
    if(e.def.healer){
      e.abCd=(e.abCd||2)-dt;
      if(e.abCd<=0){
        e.abCd=2;
        for(const o of G.enemies){
          if(o.dead||o===e)continue;
          if(dist2(e.x,e.y,o.x,o.y)<75*75&&o.hp<o.maxHp){
            o.hp=Math.min(o.maxHp,o.hp+o.maxHp*0.04+8);
            addFx({kind:'heal',x:o.x,y:o.y,life:0.5});
          }
        }
      }
    }
    if(e.boss){
      e.abCd-=dt;
      const ab=e.def.ability;
      const allies=[...G.troops,...activeHeroes()];
      if(ab==='regen'){if(e.abCd<=0){e.abCd=1;e.hp=Math.min(e.maxHp,e.hp+e.maxHp*0.012);}}
      else if(ab==='burn'){
        if(e.abCd<=0){
          e.abCd=1;
          for(const t of allies)if(dist2(t.x,t.y,e.x,e.y)<120*120)damageAlly(t,10*e.tier);
          addFx({kind:'ring',x:e.x,y:e.y,r:20,maxR:120,life:0.4,col:'#ff7a2a'});
        }
      }else if(ab==='stomp'){
        if(e.abCd<=0){
          let any=false;
          for(const t of allies)if(dist2(t.x,t.y,e.x,e.y)<110*110){any=true;break;}
          if(any){
            e.abCd=e.def.abCd;
            G.shake=Math.max(G.shake,8);
            addFx({kind:'ring',x:e.x,y:e.y,r:14,maxR:110,life:0.5,col:'#e0b060'});
            for(const t of allies)if(dist2(t.x,t.y,e.x,e.y)<110*110)damageAlly(t,55*e.tier);
            SFXp('giant_smash');
          }
        }
      }else if(ab==='summon'){
        if(e.abCd<=0){
          e.abCd=e.def.abCd;
          for(let i=0;i<3+e.tier;i++){
            const hm=hpMul(G.wave);
            const sd=ENEMY_BY.skel;
            G.enemies.push({def:sd,boss:false,tier:1,rarity:null,hp:sd.hp*hm,maxHp:sd.hp*hm,
              gold:Math.round(sd.gold*goldMul(G.wave)*0.5),leak:1,size:sd.size,pi:e.pi,
              d:Math.max(0,e.d-rnd(5,40)),lane:rnd(-16,16),x:e.x,y:e.y,
              speed:sd.speed,baseSpeed:sd.speed,armor:0,slowT:0,slowP:0,burnT:0,burnDps:0,
              poison:[],flash:0,blk:null,atkCd:0.5,abCd:0,anim:rnd(0,6),dead:false});
          }
          burst(e.x,e.y,14,'#d8d4c4');
          SFXp('summon');
        }
      }
    }
    if(e.blk){
      const b=e.blk;
      const gone=b.isHero?b.dead:(b.deadFlag||b.hp<=0);
      if(gone||dist2(e.x,e.y,b.x,b.y)>55*55)e.blk=null;
    }
    if(!e.blk&&!e.def.fly){
      for(const w of G.walls){
        if(w.pi!==e.pi)continue;
        const gap=w.d-e.d;
        if(gap>-6&&gap<30){e.blk=w;break;}
      }
    }
    if(e.blk){
      e.atkCd-=dt;
      if(e.atkCd<=0){
        e.atkCd=1.0;
        const dmg=(5+e.def.hp*0.05)*Math.sqrt(hpMul(G.wave)/(MAP.def.mods.hp||1))*(e.boss?2.2:1)*(e.rarity==='champ'?1.6:1);
        damageAlly(e.blk,dmg);
        addFx({kind:'slash',x:e.blk.x,y:e.blk.y,life:0.15,col:'#ff8a6a'});
      }
    }else{
      e.d+=e.speed*(1-e.slowP)*dt;
      if(e.d>=MAP.P[e.pi].total-8){leakEnemy(e);continue;}
    }
    const p=posAt(e.pi,e.d);
    const nx=Math.cos(p.a+Math.PI/2),ny=Math.sin(p.a+Math.PI/2);
    e.x=p.x+nx*e.lane;e.y=p.y+ny*e.lane;
  }
  G.enemies=G.enemies.filter(e=>!e.dead);

  /* troops */
  const banner=G.heroes.find(h=>h.id==='aldric'&&h.recruited&&!h.dead&&h.lvl>=(h.hdef.passive?h.hdef.passive.lvl:99));
  for(const tr of G.troops){
    const def=TROOP_BY[tr.id],st=troopStat(tr.id,tr.lvl);
    if(tr.skelDmg)st.dmg=tr.skelDmg;
    if(tr.decay!==undefined){
      tr.decay-=dt;
      if(tr.decay<=0){tr.deadFlag=true;burst(tr.x,tr.y,6,'#9ae05e');continue;}
    }
    tr.anim+=dt*2.2;
    if(tr.flash>0)tr.flash-=dt;
    if(tr.swing>0)tr.swing-=dt;
    if(def.selfHeal)tr.hp=Math.min(tr.maxHp,tr.hp+tr.maxHp*def.selfHeal*dt);
    if(def.heal){
      tr.healCd-=dt;
      if(tr.healCd<=0){
        tr.healCd=1;
        let best=null,bp=1;
        for(const o of G.troops){
          if(o===tr||o.deadFlag)continue;
          if(dist2(tr.x,tr.y,o.x,o.y)>def.healRange*def.healRange)continue;
          const pct=o.hp/o.maxHp;
          if(pct<bp){bp=pct;best=o;}
        }
        for(const ah of activeHeroes()){
          if(dist2(tr.x,tr.y,ah.x,ah.y)<def.healRange*def.healRange&&ah.hp/ah.maxHp<bp){bp=ah.hp/ah.maxHp;best=ah;}
        }
        if(best){
          best.hp=Math.min(best.maxHp,best.hp+st.heal);
          addFx({kind:'heal',x:best.x,y:best.y,life:0.5});
          SFXp('holy_heal');
        }
      }
    }
    if(tr.foe&&tr.foe.dead)tr.foe=null;
    if(!tr.foe&&(def.melee||def.range)){
      let best=null,bd=1e12;
      const seek=def.melee?CFG.AGGRO_R:st.range;
      for(const e of G.enemies){
        if(e.dead||e.pi!==tr.pi)continue;
        if(e.def.fly&&def.melee)continue; // melee can't reach the sky
        const q=dist2(tr.x,tr.y,e.x,e.y);
        if(q<seek*seek&&q<bd){bd=q;best=e;}
      }
      tr.foe=best;
    }
    if(tr.foe){
      const q=Math.sqrt(dist2(tr.x,tr.y,tr.foe.x,tr.foe.y));
      const reach=def.melee?CFG.ENGAGE_R:st.range;
      if(q<=reach){
        tr.state='fight';
        if(def.melee&&!tr.foe.blk&&!tr.foe.def.fly)tr.foe.blk=tr;
        tr.atkCd-=dt;
        if(tr.atkCd<=0&&def.dmg>0){
          tr.atkCd=def.rate;
          tr.swing=0.18;
          let dmg=st.dmg*(1+relicVal('steel'))*(G.ragnarokT>0?1.5:1);
          if(banner&&dist2(tr.x,tr.y,banner.x,banner.y)<130*130)dmg*=1.15;
          if(def.bonusFast&&tr.foe.baseSpeed>=80)dmg*=def.bonusFast;
          if(def.id==='berserker'){const hpp=tr.hp/tr.maxHp;tr.atkCd=def.rate*(0.45+0.55*hpp);}
          if(def.melee){
            damageEnemy(tr.foe,dmg,'phys');
            SFXp(def.snd);
            if(def.cleave){
              for(const e of G.enemies){
                if(e.dead||e===tr.foe)continue;
                if(dist2(tr.x,tr.y,e.x,e.y)<def.cleave*def.cleave)damageEnemy(e,dmg*0.5,'phys');
              }
            }
          }else{
            G.projs.push({kind:'tproj',x:tr.x,y:tr.y-12,tgt:tr.foe,lx:tr.foe.x,ly:tr.foe.y,spd:330,
              dmg,dtype:def.splash?'magic':'phys',splash:def.splash?def.splash:0,pierceArmor:def.pierceArmor||0,
              col:def.id==='mage'?'#c88bff':'#e8dcb0'});
            SFXp(def.snd);
          }
        }
      }else{
        tr.state='walk';
        const dir=tr.foe.d>tr.d?1:-1;
        tr.d+=dir*st.speed*dt;
        tr.face=dir>0?1:-1;
      }
    }else{
      const target=tr.holdD!==undefined?tr.holdD:G.rally[tr.pi];
      const diff=target-tr.d;
      if(Math.abs(diff)>8){
        tr.state='walk';
        const dir=diff>0?1:-1;
        tr.d+=dir*st.speed*dt;
        tr.face=dir>0?1:-1;
      }else tr.state='idle';
    }
    tr.d=clamp(tr.d,10,MAP.P[tr.pi].total-14);
    const p=posAt(tr.pi,tr.d);
    const nx=Math.cos(p.a+Math.PI/2),ny=Math.sin(p.a+Math.PI/2);
    tr.x=p.x+nx*tr.lane;tr.y=p.y+ny*tr.lane;
  }
  G.troops=G.troops.filter(t=>!t.deadFlag&&t.hp>0);

  /* heroes */
  for(const h of G.heroes){
    if(!h.recruited)continue;
    const def=h.hdef;
    if(h.dead){
      h.respawnT-=dt;
      if(h.respawnT<=0){
        const st=heroLiveStat(h);
        h.dead=false;h.hp=st.hp;h.maxHp=st.hp;
        h.x=h.homeX;h.y=h.homeY;
        burst(h.x,h.y,16,def.col);
        SFXp('summon');
      }
      continue;
    }
    const st=heroLiveStat(h);
    h.maxHp=st.hp;
    h.anim+=dt*2.2;
    if(h.flash>0)h.flash-=dt;
    if(h.bulwarkT>0)h.bulwarkT-=dt;
    if(h.swing>0)h.swing-=dt;
    h.atkCd-=dt;h.skillCd-=dt;
    /* celeste passive-ish base heal + lvl8 aura */
    if(def.id==='celeste'){
      const aura=h.lvl>=(def.passive?def.passive.lvl:99);
      for(const t of G.troops){
        if(dist2(t.x,t.y,h.x,h.y)<140*140)
          t.hp=Math.min(t.maxHp,t.hp+t.maxHp*(aura?0.012:0.005)*dt);
      }
    }
    /* auto skill */
    if(h.lvl>=def.skill.unlockLvl&&h.skillCd<=0){
      if(castHeroSkill(h))h.skillCd=def.skill.cd;
      else h.skillCd=1.2;
    }
    /* target */
    let foe=null,bd=1e12;
    for(const e of G.enemies){
      if(e.dead)continue;
      if(e.def.fly&&def.melee)continue; // melee heroes can't reach flyers
      if(dist2(h.homeX,h.homeY,e.x,e.y)>190*190)continue;
      const q=dist2(h.x,h.y,e.x,e.y);
      if(q<bd){bd=q;foe=e;}
    }
    const reach=def.melee?CFG.ENGAGE_R+6:st.range||150;
    let tx=h.homeX,ty=h.homeY;
    if(foe){
      const q=Math.sqrt(dist2(h.x,h.y,foe.x,foe.y));
      if(q<=reach){
        if(def.melee&&!foe.blk&&!foe.def.fly)foe.blk=h;
        if(h.atkCd<=0){
          h.atkCd=def.rate;h.swing=0.2;
          let dmg=st.dmg*(G.ragnarokT>0?1.5:1);
          const hasPassive=def.passive&&h.lvl>=def.passive.lvl;
          if(def.airBonus&&foe.def.fly)dmg*=hasPassive?2:1.5;
          if(def.id==='lyra'&&hasPassive&&Math.random()<0.15){dmg*=2;addText(h.x,h.y-24,'CRIT','#ffd75e',0.7);}
          if(def.melee){
            damageEnemy(foe,dmg,'phys');
            if(def.id==='karrgoth'&&hasPassive&&!foe.dead){foe.burnT=2.5;foe.burnDps=Math.max(foe.burnDps,dmg*0.5);}
            if(def.cleave){
              for(const e of G.enemies){
                if(e.dead||e===foe)continue;
                if(dist2(h.x,h.y,e.x,e.y)<def.cleave*def.cleave)damageEnemy(e,dmg*0.5,'phys');
              }
            }
          }else{
            G.projs.push({kind:'hproj',x:h.x,y:h.y-14,tgt:foe,lx:foe.x,ly:foe.y,spd:380,
              dmg,dtype:def.dtype==='magic'?'magic':'phys',splash:def.splash||0,
              burn:(def.id==='magnus'&&hasPassive)?dmg*0.4:0,
              slowHit:(def.id==='morrigan'&&hasPassive)?0.25:0,
              arc:(def.id==='seraphine'&&hasPassive)?1:0,
              col:def.col});
          }
          SFXp(def.snd);
        }
        continue;
      }
      tx=foe.x;ty=foe.y;
    }
    const q=Math.hypot(tx-h.x,ty-h.y);
    if(q>4){
      h.x+=(tx-h.x)/q*st.speed*dt;
      h.y+=(ty-h.y)/q*st.speed*dt;
      h.face=(tx-h.x)>=0?1:-1;
    }
  }

  /* particles / texts / fx */
  for(const p of G.parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;}
  G.parts=G.parts.filter(p=>p.life>0);
  for(const t of G.texts){t.life-=dt;t.y-=28*dt;if(t.pop>0)t.pop-=dt;}
  G.texts=G.texts.filter(t=>t.life>0);
  for(const f of G.fx){f.life-=dt;if(f.t!==undefined)f.t+=dt;}
  G.fx=G.fx.filter(f=>f.life>0);
}

/* ================= SAVE / LOAD ================= */
function saveKey(){return 'rs2_save_'+G.mapId;}
function saveGame(){
  try{
    const s={v:4,mapId:G.mapId,gold:G.gold,lives:G.lives,wave:G.wave,
      towers:G.towers.map(t=>({id:t.id,c:t.c,r:t.r,lvl:t.lvl,k:t.kills||0,ti:t.tier||1})),
      walls:G.walls.map(w=>({pi:w.pi,d:Math.round(w.d),lvl:w.lvl})),
      streak:G.streak,expLvl:G.expLvl||0,
      troopLvl:G.troopLvl,desired:G.desired,rally:G.rally,
      troopTier:G.troopTier,artifacts:G.artifacts,
      heroes:G.heroes.map(h=>({id:h.id,lvl:h.lvl,recruited:h.recruited,asc:!!h.asc,dv:!!h.divine,gw:h.gw||0,ga:h.ga||0})),
      relics:G.relics,spun:G.spun,
      kills:G.kills,bossKills:G.bossKills,goldEarned:G.goldEarned,
      autoWave:G.autoWave,speed:G.speed};
    localStorage.setItem(saveKey(),JSON.stringify(s));
  }catch(err){}
}
function hasSave(mapId){try{return !!localStorage.getItem('rs2_save_'+mapId);}catch(err){return false;}}
function bestWave(mapId){try{return +localStorage.getItem('rs2_best_'+mapId)||0;}catch(err){return 0;}}
function clearSave(){try{localStorage.removeItem(saveKey());}catch(err){}}
function loadGame(mapId){
  try{
    const s=JSON.parse(localStorage.getItem('rs2_save_'+mapId));
    if(!s||(s.v!==2&&s.v!==3&&s.v!==4)||!(s.lives>0))return false;
    newGame(mapId);
    for(let L=1;L<=(s.expLvl||0);L++)applyExpansion(L,false);
    G.gold=s.gold;G.lives=s.lives;G.wave=s.wave;
    G.kills=s.kills||0;G.bossKills=s.bossKills||0;G.goldEarned=s.goldEarned||0;
    G.autoWave=s.autoWave!==false;G.speed=s.speed||1;G.spun=!!s.spun;G.streak=s.streak||0;
    if(Array.isArray(s.rally))G.rally=MAP.P.map((p,i)=>clamp(s.rally[i]||p.total*0.5,40,p.total-60));
    Object.assign(G.troopLvl,s.troopLvl||{});
    Object.assign(G.desired,s.desired||{});
    Object.assign(G.relics,s.relics||{});
    Object.assign(G.troopTier,s.troopTier||{});
    Object.assign(G.artifacts,s.artifacts||{});
    if(s.v===2&&s.consum){ // old consumables converted to gold
      let refund=0;
      for(const id in s.consum){const d=CONSUM_BY[id];if(d)refund+=d.cost*(s.consum[id]||0);}
      if(refund>0){G.gold+=refund;setBanner('Your old consumables were refunded: +'+refund+'g');}
    }
    G.towers=[];
    for(const t of s.towers||[]){
      if(!TOWER_BY[t.id])continue;
      G.towers.push({id:t.id,c:t.c,r:t.r,x:t.c*CFG.CELL+20,y:t.r*CFG.CELL+20,lvl:t.lvl,cd:0,ang:-Math.PI/2,auraMul:1,heat:0,tick:0,kills:t.k||0,tier:t.ti||1});
    }
    for(const hs of s.heroes||[]){
      const h=G.heroes.find(x=>x.id===hs.id);
      if(!h)continue;
      h.lvl=hs.lvl||1;h.recruited=!!hs.recruited;h.asc=!!hs.asc;
      h.divine=!!hs.dv;h.gw=hs.gw||0;h.ga=hs.ga||0;
      if(h.recruited&&h.hdef.legendary)vaultAddLegend(h.id); // heal the vault
      const st=heroLiveStat(h);
      h.hp=st.hp;h.maxHp=st.hp;
    }
    for(const ws of s.walls||[]){
      if(ws.pi>=MAP.P.length)continue;
      const p=posAt(ws.pi,ws.d);
      const hp=wallHpAt(s.wave,ws.lvl);
      G.walls.push({isWall:true,pi:ws.pi,d:ws.d,x:p.x,y:p.y,ang:p.a,lvl:ws.lvl,hp,maxHp:hp,flash:0});
    }
    G.intermission=CFG.INTERMISSION;
    setBanner(THEME.txt.welcome(G.wave));
    return true;
  }catch(err){return false;}
}
