/* ============================================================
   villain.js — VILLAIN MODE (reverse siege)
   You are the dark overlord. Build training barracks that pour
   endless creeps down the road at an AI-defended Citadel. Breach
   it before the siege timer runs out. Every 10th wave, choose a
   boss to unleash. Reuses the render layer (drawTower / drawEnemy
   / drawFx) and fx helpers on the shared global G.
   ============================================================ */
'use strict';

/* ---------- roster: 10 attacker troops (common → divine) ---------- */
const VTROOPS=[
 {id:'imp',      name:'Imp Swarmling',  tier:'common',    unlock:1,  kind:'beast',  col:'#7ec244', fly:false, size:8,  hp:52,  dmg:11,  speed:96, armor:0,    bcost:50,  cost:4,  cd:1.05},
 {id:'brute',    name:'Orc Brute',      tier:'common',    unlock:1,  kind:'',       col:'#6a8a4a', fly:false, size:12, hp:150, dmg:24,  speed:66, armor:0.1,  bcost:80,  cost:8,  cd:1.8},
 {id:'bomber',   name:'Powderkeg',      tier:'common',    unlock:3,  kind:'beast',  col:'#c85838', fly:false, size:10, hp:60,  dmg:46,  speed:78, armor:0,    bcost:120, cost:12, cd:2.6, blast:true},
 {id:'bats',     name:'Shriek Swarm',   tier:'rare',      unlock:5,  kind:'flyer',  col:'#6a5a8a', fly:true,  size:9,  hp:52,  dmg:12,  speed:112,armor:0,    bcost:150, cost:9,  cd:1.5},
 {id:'troll',    name:'Regen Troll',    tier:'rare',      unlock:8,  kind:'',       col:'#4a8a5a', fly:false, size:14, hp:340, dmg:30,  speed:52, armor:0.15, bcost:220, cost:16, cd:2.8, regen:0.03},
 {id:'assassin', name:'Shadowstalker',  tier:'rare',      unlock:11, kind:'ghost',  col:'#c88bff', fly:false, size:10, hp:110, dmg:58,  speed:132,armor:0,    bcost:260, cost:18, cd:2.2},
 {id:'golem',    name:'Siege Golem',    tier:'legendary', unlock:16, kind:'big',    col:'#8a8578', fly:false, size:18, hp:1500,dmg:80,  speed:42, armor:0.4,  bcost:600, cost:34, cd:4.2},
 {id:'warlock',  name:'Imp Warlock',    tier:'legendary', unlock:20, kind:'ghost',  col:'#b05adf', fly:false, size:13, hp:520, dmg:44,  speed:66, armor:0.1,  bcost:640, cost:30, cd:3.6, summons:true},
 {id:'wyrmling', name:'Void Wyrmling',  tier:'legendary', unlock:24, kind:'drake',  col:'#4a7a9a', fly:true,  size:16, hp:900, dmg:95,  speed:70, armor:0.25, bcost:720, cost:40, cd:4.4},
 {id:'voidspawn',name:'Voidspawn Titan',tier:'divine',    unlock:32, kind:'big',    col:'#8a2adf', fly:false, size:22, hp:4200,dmg:220, speed:44, armor:0.45, bcost:1400,cost:70, cd:6.5},
];
const VTROOP_BY={};VTROOPS.forEach(t=>VTROOP_BY[t.id]=t);

/* ---------- roster: 10 bosses (sent every 10 waves) ---------- */
const VBOSSES=[
 {id:'warlord',  name:'Ogre Warlord',   tier:'common',    unlock:10, kind:'',      col:'#8a6a3a', fly:false, size:28, hp:9000,  dmg:400, speed:38, armor:0.3},
 {id:'colossus', name:'Bone Colossus',  tier:'common',    unlock:10, kind:'big',   col:'#d8d0c0', fly:false, size:30, hp:12000, dmg:350, speed:32, armor:0.35, summons:true},
 {id:'behemoth', name:'Swamp Behemoth', tier:'common',    unlock:10, kind:'beast', col:'#5a7a3a', fly:false, size:30, hp:14000, dmg:300, speed:34, armor:0.25, regen:0.02},
 {id:'infernal', name:'Infernal Drake', tier:'rare',      unlock:20, kind:'drake', col:'#e05a2a', fly:true,  size:26, hp:11000, dmg:500, speed:52, armor:0.3},
 {id:'frost',    name:'Frost Titan',    tier:'rare',      unlock:20, kind:'big',   col:'#8ad4e8', fly:false, size:30, hp:16000, dmg:420, speed:30, armor:0.4},
 {id:'lich',     name:'The Lich King',  tier:'legendary', unlock:30, kind:'ghost', col:'#9ae05e', fly:false, size:26, hp:20000, dmg:520, speed:44, armor:0.3, summons:true},
 {id:'kraken',   name:'Deep Kraken',    tier:'legendary', unlock:30, kind:'beast', col:'#4ad0c8', fly:false, size:32, hp:24000, dmg:600, speed:36, armor:0.35},
 {id:'demon',    name:'Demon Lord',     tier:'legendary', unlock:40, kind:'',      col:'#c8304a', fly:false, size:28, hp:26000, dmg:720, speed:46, armor:0.4},
 {id:'ashen',    name:'Ashen God',      tier:'divine',    unlock:50, kind:'big',   col:'#ff7a3a', fly:false, size:34, hp:44000, dmg:1000,speed:34, armor:0.5, regen:0.015},
 {id:'nameless', name:'The Nameless',   tier:'divine',    unlock:60, kind:'ghost', col:'#8a2adf', fly:true,  size:32, hp:52000, dmg:1200,speed:50, armor:0.45},
];
const VBOSS_BY={};VBOSSES.forEach(b=>VBOSS_BY[b.id]=b);

/* reef flavor renames */
const V_REEF={
  imp:'Barnacle Imp',brute:'Trench Brute',bomber:'Pufferbomb',bats:'Sting Swarm',troll:'Coral Troll',
  assassin:'Shadow Eel',golem:'Coral Golem',warlock:'Sea Witch',wyrmling:'Void Serpent',voidspawn:'Abyss Titan',
  warlord:'Tidepool Tyrant',colossus:'Ghost Pirate',behemoth:'Trench Behemoth',infernal:'Magma Eel',frost:'Glacier Leviathan',
  lich:'Drowned King',kraken:'The Kraken',demon:'Abyss Lord',ashen:'Molten God',nameless:'The Nameless Deep',
};
function vName(def){
  try{ if(typeof THEME!=='undefined'&&THEME.flavor==='reef'&&V_REEF[def.id])return V_REEF[def.id]; }catch(e){}
  return def.name;
}
const V_TIER_COL={common:'#c8ccd8',rare:'#a06ad8',legendary:'#ffb454',divine:'#ff5a4e'};

/* defender tower pool (reuses real TOWER_BY sprites) */
const V_DEF_TOWERS=['archer','cannon','ballista','frost','storm','poison','arbalest'];

/* upgrade tracks bought with Dread Points */
const V_UPGR=[
 {id:'might', name:'Dark Might', ico:'⚔', desc:'All creeps deal more damage.'},
 {id:'vigor', name:'Unholy Vigor', ico:'❤', desc:'All creeps have more health.'},
 {id:'tribute', name:'Dread Tribute', ico:'💀', desc:'More Dread Points per second.'},
];

/* ---------- EVIL SPELLS (free, cooldown-based) ---------- */
const V_SPELLS=[
 {id:'curse',  name:'Curse of Ruin', icon:'curse', cd:38, target:true, radius:135,
  desc:'Hex the defenses: struck towers fall silent for 6s and the Citadel takes bonus damage.'},
 {id:'zombie', name:'Raise the Dead', icon:'zombie', cd:52, target:false,
  desc:'A horde of rotting zombies claws up at your spawn and marches on the Citadel.'},
 {id:'berserk',name:'Bloodrage', icon:'berserk', cd:44, target:false, dur:8,
  desc:'Your whole horde goes berserk — +80% damage and +60% speed for 8 seconds.'},
 {id:'apocalypse', name:'END OF THE WORLD', icon:'apocalypse', cd:300, target:false,
  desc:'The sky burns: cripples EVERY defender tower for 14s, cracks the Citadel wide open, and raises a legion.'},
];
const V_SPELL_BY={};V_SPELLS.forEach(s=>V_SPELL_BY[s.id]=s);
/* hidden zombie creep — summoned by Raise the Dead / Apocalypse only */
VTROOP_BY.zombie={id:'zombie',name:'Zombie',tier:'rare',kind:'',col:'#6a8a5a',fly:false,size:12,hp:240,dmg:28,speed:56,armor:0.1,cost:0,cd:0,bcost:0,unlock:1};

/* ================= math ================= */
function vScale(w){return Math.pow(1.24,w-1);}          // defence / citadel growth
function vDpRate(){return 11+(G.up.tribute||0)*5+G.wave*0.6;}
function vMight(){return 1+(G.up.might||0)*0.14;}
function vVigor(){return 1+(G.up.vigor||0)*0.16;}
function vUpCost(track){return Math.round(120*Math.pow(1.5,(G.up[track]||0)));}
function vCreepStat(def,blvl){
  const bl=1+(blvl||0)*0.12;
  return {hp:def.hp*vVigor()*bl, dmg:def.dmg*vMight()*bl};
}

/* ================= setup ================= */
function newVillain(mapId){
  const mdef=MAP_BY[mapId]||MAPS[0];
  CFG.COLS=CFG.BASE_COLS;CFG.ROWS=CFG.BASE_ROWS;
  CFG.W=CFG.COLS*CFG.CELL;CFG.H=CFG.ROWS*CFG.CELL;
  try{if(typeof canvas!=='undefined'&&canvas&&canvas.width!==CFG.W){canvas.width=CFG.W;canvas.height=CFG.H;}}catch(e){}
  try{if(typeof clearRenderCaches==='function')clearRenderCaches();}catch(e){}
  initMapRuntime(mdef);
  G={
    villain:true, mapId:mdef.id, time:0, over:false, paused:false, speed:1,
    wave:1, dp:260, lives:20, score:0,
    enemies:[], towers:[], troops:[], heroes:[], walls:[], projs:[], parts:[], texts:[], fx:[], zones:[], chest:null,
    rally:MAP.P.map(p=>p.total*0.5),
    barracks:[], up:{might:0,vigor:0,tribute:0},
    vspells:{curse:6,zombie:8,berserk:6,apocalypse:120}, berserkT:0,
    citadelHp:0, citadelMax:0, siegeT:0, siegeMax:0, hitFlash:0,
    defBuildT:6, surgeT:rnd(8,16), intermission:0, waveActive:false,
    bossPending:false, bossThisWave:null,
    waveBanner:null, bannerT:0, shake:0, autoWave:true, selBarr:null, targetMode:null,
  };
  vBeginWave(true);
  setBanner('😈 The siege begins. Build barracks — break the Citadel!',true);
}

function vCitadelPos(){return MAP.castle||{x:CFG.W-45,y:CFG.H*0.47};}

function vBeginWave(first){
  const w=G.wave;
  const boss=(w%10===0);
  G.citLock=0;
  G.citadelMax=Math.round(260*vScale(w)*(boss?1.9:1));
  G.citadelHp=G.citadelMax;
  G.siegeMax=Math.round(50+w*3+(boss?30:0));
  G.siegeT=G.siegeMax;
  G.waveActive=true;
  G.hitFlash=0;
  /* AI raises its garrison */
  if(first){G.towers=[];}
  const target=Math.min(3+Math.floor(w*0.8),4+Math.floor(CFG.COLS*CFG.ROWS*0.02));
  while(G.towers.length<target)vDefenderBuild(true);
  const defLvl=1+Math.floor(w/4);
  for(const t of G.towers)t.lvl=Math.max(t.lvl,Math.min(CFG.MAX_TOWER_LVL,defLvl));
  /* boss deploy */
  if(boss){
    if(G.bossThisWave)vSpawnBoss(G.bossThisWave);
    G.bossThisWave=null;
  }
}

/* ================= step ================= */
function villainStep(dt){
  if(!G||!G.villain||G.over||G.paused||G.bossPending)return;
  let rem=dt*G.speed;
  let guard=0;
  while(rem>0&&!G.over&&!G.bossPending&&guard++<12){
    const h=Math.min(1/30,rem);
    vSub(h);
    rem-=h;
  }
}
function vSub(dt){
  G.time+=dt;
  if(G.bannerT>0)G.bannerT-=dt;
  if(G.shake>0)G.shake=Math.max(0,G.shake-dt*30);
  if(G.hitFlash>0)G.hitFlash-=dt;
  for(const s of V_SPELLS)if(G.vspells[s.id]>0)G.vspells[s.id]-=dt;
  if(G.berserkT>0)G.berserkT-=dt;
  if(!G.waveActive)return;

  G.dp+=vDpRate()*dt;

  /* barracks pour out creeps */
  for(const b of G.barracks){
    const def=VTROOP_BY[b.id];
    b.tick-=dt;
    if(b.tick<=0){
      const cost=Math.round(def.cost*(1+(def.unlock>15?0.0:0)));
      if(G.dp>=cost){
        G.dp-=cost;
        vSpawnCreep(b.id,b.lvl);
        b.tick=def.cd/(1+b.lvl*0.14);
      }else b.tick=0.4;
    }
  }

  /* RNG dark surge — recruits out of nowhere */
  G.surgeT-=dt;
  if(G.surgeT<=0){
    G.surgeT=rnd(14,34);
    if(Math.random()<0.7)vTriggerSurge();
  }

  vUpdateCreeps(dt);
  vDefenderFire(dt);

  /* defender reinforces + repairs */
  G.defBuildT-=dt;
  if(G.defBuildT<=0){
    G.defBuildT=Math.max(5,11-G.wave*0.15);
    if(Math.random()<0.6)vDefenderBuild(false);
    else{const cand=G.towers.filter(t=>t.lvl<CFG.MAX_TOWER_LVL);if(cand.length)pick(cand).lvl++;}
  }
  if(G.citLock>0)G.citLock-=dt;
  else if(G.citadelHp<G.citadelMax)
    G.citadelHp=Math.min(G.citadelMax,G.citadelHp+G.citadelMax*0.003*dt);

  /* siege timer */
  G.siegeT-=dt;
  if(G.citadelHp<=0){vWaveWon();return;}
  if(G.siegeT<=0){vRepelled();return;}

  /* fx / particle upkeep */
  for(const p of G.parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;}
  G.parts=G.parts.filter(p=>p.life>0);
  for(const t of G.texts){t.life-=dt;t.y-=28*dt;if(t.pop>0)t.pop-=dt;}
  G.texts=G.texts.filter(t=>t.life>0);
  for(const f of G.fx){f.life-=dt;if(f.t!==undefined)f.t+=dt;}
  G.fx=G.fx.filter(f=>f.life>0);
  for(const p of G.projs){p.life-=dt;}
  G.projs=G.projs.filter(p=>p.life>0);
}

function vUpdateCreeps(dt){
  const gate={};
  for(const e of G.enemies){
    if(e.dead)continue;
    e.anim+=dt*(e.speed/26);
    if(e.flash>0)e.flash-=dt;
    if(e.slowT>0){e.slowT-=dt;if(e.slowT<=0)e.slowP=0;}
    if(e.def.regen)e.hp=Math.min(e.maxHp,e.hp+e.maxHp*e.def.regen*dt);
    if(e.burnT>0){e.burnT-=dt;e.hp-=e.burnDps*dt;if(e.hp<=0){vCreepDie(e);continue;}}
    /* summoner creeps spew imps */
    if(e.def.summons){
      e.sumT=(e.sumT||rnd(2,5))-dt;
      if(e.sumT<=0){e.sumT=rnd(3,6);vSpawnCreep('imp',0,{pi:e.pi,d:Math.max(6,e.d-20)});}
    }
    e.d+=e.speed*(1-e.slowP)*(G.berserkT>0?1.6:1)*dt;
    const total=MAP.P[e.pi].total;
    if(e.d>=total-10){vBreach(e);continue;}
    const p=posAt(e.pi,e.d);
    const nx=Math.cos(p.a+Math.PI/2),ny=Math.sin(p.a+Math.PI/2);
    e.x=p.x+nx*e.lane;e.y=p.y+ny*e.lane;
  }
  G.enemies=G.enemies.filter(e=>!e.dead);
}

function vBreach(e){
  e.dead=true;
  const dmg=e.dmg*(e.def.blast?2.2:1)*(G.berserkT>0?1.8:1);
  G.citadelHp-=dmg;
  G.hitFlash=0.25;G.citLock=2.5;
  G.shake=Math.max(G.shake,e.boss?9:e.def.blast?5:2);
  const cp=vCitadelPos();
  burst(cp.x-20,cp.y,e.boss?24:8,e.def.col);
  addText(cp.x,cp.y-30,'-'+fmt(dmg),'#ff5a5a',e.boss?1.4:0.9);
  const baseCost=(VTROOP_BY[e.def.id]&&VTROOP_BY[e.def.id].cost)||10;
  const rew=Math.round(4+baseCost*0.4)*(e.boss?12:1);
  G.dp+=rew;G.score+=Math.round(dmg);
  SFXp(e.boss?'boss_roar':'leak');
}
function vCreepDie(e){
  e.dead=true;
  burst(e.x,e.y,e.boss?26:8,e.def.col);
  addFx({kind:'die',x:e.x,y:e.y,life:0.45,col:e.def.col,size:e.size});
}

function vSpawnCreep(id,blvl,opts){
  const def=VTROOP_BY[id];if(!def)return;
  const st=vCreepStat(def,blvl);
  const pi=(opts&&opts.pi!==undefined)?opts.pi:Math.floor(Math.random()*MAP.P.length);
  const d=(opts&&opts.d!==undefined)?opts.d:rnd(0,12);
  const p=posAt(pi,d);
  const rarity=def.tier==='rare'?'elite':def.tier==='legendary'?'champ':null;
  G.enemies.push({
    def:{id:def.id,kind:def.kind,col:def.col,fly:def.fly,armor:def.armor,regen:def.regen,blast:def.blast,summons:def.summons},
    boss:false, rarity, divine:def.tier==='divine',
    hp:st.hp, maxHp:st.hp, dmg:st.dmg, size:def.size, speed:def.speed*rnd(0.92,1.08),
    baseSpeed:def.speed, armor:def.armor||0, pi, d, lane:def.fly?0:rnd(-14,14),
    x:p.x, y:p.y, anim:rnd(0,6), flash:0, slowT:0, slowP:0, burnT:0, burnDps:0, poison:[], dead:false,
  });
}
function vSpawnBoss(id){
  const def=VBOSS_BY[id];if(!def)return;
  const wf=Math.max(1,vScale(G.wave)*0.45);
  const hp=Math.round(def.hp*wf*vVigor());
  const pi=Math.floor(Math.random()*MAP.P.length);
  const p=posAt(pi,4);
  G.enemies.push({
    def:{id:def.id,kind:def.kind,col:def.col,fly:def.fly,armor:def.armor,regen:def.regen,summons:def.summons},
    boss:true, rarity:null, divine:def.tier==='divine',
    hp, maxHp:hp, dmg:Math.round(def.dmg*vMight()), size:def.size, speed:def.speed,
    baseSpeed:def.speed, armor:def.armor||0, pi, d:4, lane:0,
    x:p.x, y:p.y, anim:0, flash:0, slowT:0, slowP:0, burnT:0, burnDps:0, poison:[], dead:false, tier:1,
  });
  setBanner('💀 '+vName(def)+' marches on the Citadel!',true);
  G.shake=Math.max(G.shake,10);SFXp('boss_roar');
}
function vTriggerSurge(){
  const avail=VTROOPS.filter(t=>t.unlock<=G.wave);
  if(!avail.length)return;
  const def=pick(avail);
  const n=Math.floor(rnd(3,12));
  const mag=rnd(0.8,2.6);
  for(let i=0;i<n;i++){
    vSpawnCreep(def.id,0,{});
    const e=G.enemies[G.enemies.length-1];
    e.hp*=mag;e.maxHp*=mag;e.dmg*=mag;
    if(mag>1.8){e.size=Math.round(e.size*1.15);}
  }
  setBanner('🌑 DARK SURGE! '+n+' '+vName(def)+(mag>1.8?' (empowered!)':'')+' rise from nowhere!',mag>1.8);
  SFXp('chest');
}

/* ---------- defender AI ---------- */
function vDefenderBuild(silent){
  const cap=Math.floor(CFG.COLS*CFG.ROWS*0.06)+3;
  if(G.towers.length>=cap)return;
  for(let tries=0;tries<80;tries++){
    const c=Math.floor(rnd(2,CFG.COLS-2)),r=Math.floor(rnd(1,CFG.ROWS-1));
    if(!canPlace(c,r))continue;
    const x=c*CFG.CELL+20,y=r*CFG.CELL+20;
    if(distToPaths(x,y)>96)continue;
    const id=pick(V_DEF_TOWERS.filter(t=>t!=='arbalest'||G.wave>=8));
    G.towers.push({id,c,r,x,y,lvl:Math.min(CFG.MAX_TOWER_LVL,1+Math.floor(G.wave/4)),cd:rnd(0,0.6),ang:-Math.PI/2,auraMul:1,heat:0,tick:0,kills:0,tier:1});
    if(!silent)burst(x,y,10,'#d8c9a0');
    return;
  }
}
function vDefenderFire(dt){
  const dmgScale=vScale(G.wave)*0.42+0.4;
  for(const t of G.towers){
    const def=TOWER_BY[t.id];
    if(!def||!def.range)continue;
    if(t.silenceT>0){t.silenceT-=dt;continue;}
    t.cd-=dt;
    if(t.cd>0)continue;
    const st=towerStat(def,t.lvl);
    let tgt=null,bd=st.range*st.range;
    for(const e of G.enemies){
      if(e.dead)continue;
      if(e.def.fly&&def.targets!=='both')continue;
      const q=dist2(t.x,t.y,e.x,e.y);
      if(q<bd){bd=q;tgt=e;}
    }
    if(!tgt){t.cd=0.1;continue;}
    t.cd=1/st.rate;
    t.ang=Math.atan2(tgt.y-t.y,tgt.x-t.x);
    const dmg=st.dmg*dmgScale*(1+towerRank(t)*0.03);
    vHitCreep(tgt,dmg,def,st,t);
  }
}
function vHitCreep(e,dmg,def,st,t){
  let final=dmg;
  if(def.dtype==='phys')final*=(1-(e.armor||0));
  e.hp-=final;e.flash=0.1;
  if(st.splash){
    for(const o of G.enemies){if(o===e||o.dead)continue;if(dist2(o.x,o.y,e.x,e.y)<st.splash*st.splash){o.hp-=final*0.5;o.flash=0.1;if(o.hp<=0)vCreepDie(o);}}
  }
  if(st.slow&&!e.boss){e.slowT=Math.max(e.slowT,st.slowDur||1.5);e.slowP=Math.max(e.slowP,st.slow);}
  if(st.burn){e.burnT=st.burnDur||2.5;e.burnDps=Math.max(e.burnDps,st.burn);}
  /* tracer */
  G.fx.push({kind:'vtracer',x0:t.x,y0:t.y-24,x1:e.x,y1:e.y,life:0.08,col:def.hue||'#ffe8a0'});
  if(!e.boss&&Math.random()<0.5)addText(e.x+rnd(-6,6),e.y-e.size-6,fmt(final),def.dtype==='magic'?'#9ad4ff':'#fff',0.7);
  if(t)t.kills=(t.kills||0)+(e.hp<=0?1:0);
  if(def.snd&&Math.random()<0.4)SFXp(def.snd);
  if(e.hp<=0)vCreepDie(e);
}

/* ---------- wave flow ---------- */
function vWaveWon(){
  G.waveActive=false;
  const bonus=Math.round(G.citadelMax*0.5+60*G.wave);
  G.dp+=bonus;G.score+=G.citadelMax;
  setBanner('🏴 CITADEL BREACHED! Wave '+G.wave+' conquered — +'+fmt(bonus)+' DP',true);
  SFXp('horn_victory');
  G.wave++;
  /* clear leftover creeps into next assault */
  if(G.wave%10===0){G.bossPending=true;} // pick a boss before the fortress
  else{ vBeginWave(false); }
  vSaveGame();
  if(typeof onVillainWave==='function')onVillainWave();
}
function vRepelled(){
  G.lives--;
  G.hitFlash=0.3;G.shake=12;
  setBanner('🛡 Assault repelled! The Citadel holds. Overlord Lives: '+G.lives,true);
  SFXp('leak');
  if(G.lives<=0){vGameOver();return;}
  /* refill + reinforce, retry same wave */
  G.citadelHp=G.citadelMax;
  G.siegeT=G.siegeMax;
  vDefenderBuild(false);vDefenderBuild(false);
  vSaveGame();
}
function vGameOver(){
  G.over=true;G.waveActive=false;
  try{const k=vBestKey();const b=+localStorage.getItem(k)||0;if(G.wave>b)localStorage.setItem(k,G.wave);}catch(e){}
  try{localStorage.removeItem(vSaveKey());}catch(e){}
  if(typeof onVillainOver==='function')onVillainOver();
}
function vSelectBoss(id){
  G.bossThisWave=id;
  G.bossPending=false;
  vBeginWave(false);
  setBanner('You unleash '+vName(VBOSS_BY[id])+'!',true);
  vSaveGame();
}

/* ---------- player actions ---------- */
function vCanBuildBarracks(id,c,r){
  const def=VTROOP_BY[id];
  if(!def||def.unlock>G.wave)return false;
  if(G.dp<def.bcost)return false;
  return canPlace(c,r);
}
function vPlaceBarracks(id,c,r){
  const def=VTROOP_BY[id];
  if(!vCanBuildBarracks(id,c,r))return false;
  G.dp-=def.bcost;
  const b={id,c,r,x:c*CFG.CELL+20,y:r*CFG.CELL+20,lvl:1,tick:rnd(0,0.5)};
  G.barracks.push(b);
  burst(b.x,b.y,12,def.col);
  addFx({kind:'ring',x:b.x,y:b.y,r:6,maxR:44,life:0.4,col:def.col});
  SFXp('build');
  return true;
}
function vBarracksUpCost(b){return Math.round(VTROOP_BY[b.id].bcost*0.7*Math.pow(1.6,b.lvl-1));}
function vUpgradeBarracks(b){
  const c=vBarracksUpCost(b);
  if(G.dp<c)return false;
  G.dp-=c;b.lvl++;
  burst(b.x,b.y,10,'#ffd75e');SFXp('upgrade');
  return true;
}
function vSellBarracks(b){
  G.dp+=Math.round(VTROOP_BY[b.id].bcost*0.5);
  G.barracks=G.barracks.filter(x=>x!==b);
  SFXp('sell');
}
function vBuyUpgrade(track){
  const c=vUpCost(track);
  if(G.dp<c)return false;
  G.dp-=c;G.up[track]=(G.up[track]||0)+1;
  SFXp('upgrade');
  return true;
}

/* ---------- evil spells ---------- */
function vCastSpell(id){
  const def=V_SPELL_BY[id];
  if(!def||G.over||G.bossPending||(G.vspells[id]||0)>0)return false;
  if(def.target){G.targetMode='vspell:'+id;return true;}
  G.vspells[id]=def.cd;
  if(id==='zombie'){
    for(let i=0;i<12;i++)vSpawnCreep('zombie',0,{pi:Math.floor(Math.random()*MAP.P.length),d:rnd(0,16)});
    setBanner('🧟 The dead rise! A zombie horde claws forth!',true);
    G.shake=Math.max(G.shake,6);SFXp('boss_roar');
  }else if(id==='berserk'){
    G.berserkT=def.dur;
    for(const e of G.enemies)addFx({kind:'ring',x:e.x,y:e.y,r:4,maxR:e.size*2.4,life:0.35,col:'#ff4a4a'});
    setBanner('🩸 BLOODRAGE! Your whole horde goes berserk!',true);SFXp('skill_warcry');
  }else if(id==='apocalypse'){
    for(const t of G.towers)t.silenceT=Math.max(t.silenceT||0,14);
    G.citadelHp-=G.citadelMax*0.4;G.citLock=2.5;G.hitFlash=0.45;G.shake=18;
    const pool=['brute','troll','golem'].filter(x=>VTROOP_BY[x]);
    for(let i=0;i<16;i++)vSpawnCreep(pick(pool),0,{pi:Math.floor(Math.random()*MAP.P.length),d:rnd(0,22)});
    addFx({kind:'ragnarok',life:1.8,t:0});
    const cp=vCitadelPos();addFx({kind:'firestorm',x:cp.x-10,y:cp.y,r:120,life:1.1,t:0});
    setBanner('☄️ END OF THE WORLD! The heavens fall upon the Citadel!',true);SFXp('boss_die');
  }
  return true;
}
function vSpellAt(id,x,y){
  const def=V_SPELL_BY[id];
  if(!def||(G.vspells[id]||0)>0)return false;
  G.targetMode=null;G.vspells[id]=def.cd;
  if(id==='curse'){
    let n=0;
    for(const t of G.towers){
      if(dist2(t.x,t.y,x,y)<def.radius*def.radius){t.silenceT=Math.max(t.silenceT||0,6);n++;addFx({kind:'ring',x:t.x,y:t.y,r:6,maxR:34,life:0.5,col:'#b05adf'});}
    }
    G.citadelHp-=G.citadelMax*0.05;G.citLock=2.5;G.hitFlash=0.2;
    addFx({kind:'ring',x,y,r:16,maxR:def.radius,life:0.7,col:'#b05adf'});
    burst(x,y,20,'#b05adf');
    setBanner('🟣 Curse of Ruin — '+n+' tower'+(n===1?'':'s')+' silenced!');
    G.shake=Math.max(G.shake,5);SFXp('skill_shadow');
  }
  return true;
}

/* ---------- persistence ---------- */
function vSaveKey(){return 'rs2_vsave_'+G.mapId;}
function vBestKey(){return 'rs2_vbest_'+G.mapId;}
function vHasSave(mapId){try{return !!localStorage.getItem('rs2_vsave_'+mapId);}catch(e){return false;}}
function vBestWave(mapId){try{return +localStorage.getItem('rs2_vbest_'+mapId)||0;}catch(e){return 0;}}
function vSaveGame(){
  try{
    const s={v:1,mapId:G.mapId,wave:G.wave,dp:Math.round(G.dp),lives:G.lives,score:G.score,
      up:G.up,bossPending:G.bossPending,
      barracks:G.barracks.map(b=>({id:b.id,c:b.c,r:b.r,lvl:b.lvl})),
      towers:G.towers.map(t=>({id:t.id,c:t.c,r:t.r,lvl:t.lvl}))};
    localStorage.setItem(vSaveKey(),JSON.stringify(s));
  }catch(e){}
}
function vLoadGame(mapId){
  try{
    const s=JSON.parse(localStorage.getItem('rs2_vsave_'+mapId));
    if(!s||s.v!==1||!(s.lives>0))return false;
    newVillain(mapId);
    G.wave=s.wave;G.dp=s.dp;G.lives=s.lives;G.score=s.score||0;
    Object.assign(G.up,s.up||{});
    G.barracks=[];
    for(const b of s.barracks||[])if(VTROOP_BY[b.id])G.barracks.push({id:b.id,c:b.c,r:b.r,x:b.c*CFG.CELL+20,y:b.r*CFG.CELL+20,lvl:b.lvl||1,tick:rnd(0,0.5)});
    G.towers=[];
    for(const t of s.towers||[])if(TOWER_BY[t.id])G.towers.push({id:t.id,c:t.c,r:t.r,x:t.c*CFG.CELL+20,y:t.r*CFG.CELL+20,lvl:t.lvl||1,cd:0,ang:-Math.PI/2,auraMul:1,heat:0,tick:0,kills:0,tier:1});
    G.bossPending=!!s.bossPending;
    vBeginWave(false);
    setBanner('Welcome back, Overlord — Wave '+G.wave,false);
    return true;
  }catch(e){return false;}
}

/* ================= render ================= */
function drawVillain(c){
  c.save();
  if(G.shake>0)c.translate(rnd(-G.shake,G.shake)*0.5,rnd(-G.shake,G.shake)*0.5);
  c.drawImage(getBG(),0,0);
  /* dark villain wash */
  c.fillStyle='rgba(40,10,30,0.20)';c.fillRect(0,0,CFG.W,CFG.H);

  /* rally-less path spawn markers */
  for(let pi=0;pi<MAP.P.length;pi++){
    const p=posAt(pi,4);
    c.fillStyle='rgba(180,60,220,0.5)';
    c.beginPath();c.arc(p.x,p.y,7+Math.sin(G.time*4+pi)*1.5,0,7);c.fill();
  }

  /* build ghost for barracks */
  if(UIS.mode==='vbuild'&&UIS.pendC>=0){
    const ok=vCanBuildBarracks(UIS.buildType,UIS.pendC,UIS.pendR);
    const x=UIS.pendC*CFG.CELL,y=UIS.pendR*CFG.CELL;
    c.fillStyle=ok?'rgba(120,230,140,0.16)':'rgba(230,90,90,0.16)';
    c.fillRect(x,y,CFG.CELL,CFG.CELL);
    c.strokeStyle=ok?'rgba(120,230,140,0.95)':'rgba(230,90,90,0.95)';c.lineWidth=2.5;
    c.strokeRect(x+2,y+2,CFG.CELL-4,CFG.CELL-4);
  }
  /* evil spell target reticle */
  if(G.targetMode&&G.targetMode.indexOf('vspell:')===0&&UIS.hoverX>=0){
    const sd=V_SPELL_BY[G.targetMode.slice(7)];
    const rr=sd&&sd.radius?sd.radius:120;
    c.strokeStyle='rgba(180,80,220,0.85)';c.lineWidth=2;c.setLineDash([8,6]);
    c.beginPath();c.arc(UIS.hoverX,UIS.hoverY,rr,0,7);c.stroke();c.setLineDash([]);
    c.fillStyle='rgba(180,80,220,0.12)';c.beginPath();c.arc(UIS.hoverX,UIS.hoverY,rr,0,7);c.fill();
  }

  /* y-sorted: towers + barracks + creeps */
  const ents=[];
  for(const t of G.towers)ents.push({y:t.y,k:'t',o:t});
  for(const b of G.barracks)ents.push({y:b.y,k:'b',o:b});
  for(const e of G.enemies)ents.push({y:e.y,k:'e',o:e});
  ents.sort((a,b)=>a.y-b.y);
  for(const en of ents){
    if(en.k==='t')drawTower(c,en.o);
    else if(en.k==='b')drawBarracks(c,en.o);
    else{drawEnemy(c,en.o);if(en.o.divine)vDivineAura(c,en.o);}
  }

  /* fx tracers + reuse drawFx */
  for(const f of G.fx){
    if(f.kind==='vtracer'){
      c.globalCompositeOperation='lighter';
      c.strokeStyle='rgba('+hexToRgb(f.col)+','+Math.max(0,f.life*10)+')';c.lineWidth=2.2;
      c.beginPath();c.moveTo(f.x0,f.y0);c.lineTo(f.x1,f.y1);c.stroke();
      c.globalCompositeOperation='source-over';
    }else{try{drawFx(c,f);}catch(e){}}
  }
  for(const p of G.parts){
    if(p.glow)c.globalCompositeOperation='lighter';
    c.globalAlpha=Math.max(0,p.life/p.maxLife);
    c.fillStyle=p.col;c.fillRect(p.x-p.sz/2,p.y-p.sz/2,p.sz,p.sz);
    if(p.glow)c.globalCompositeOperation='source-over';
  }
  c.globalAlpha=1;c.textAlign='center';
  for(const t of G.texts){
    c.globalAlpha=Math.max(0,Math.min(1,t.life/t.maxLife*1.6));
    const popS=t.pop>0?1+t.pop*2.2:1;
    c.font='bold '+Math.round(13*popS)+'px Georgia, serif';
    c.strokeStyle='rgba(0,0,0,0.7)';c.lineWidth=3;c.strokeText(t.txt,t.x,t.y);
    c.fillStyle=t.col;c.fillText(t.txt,t.x,t.y);
  }
  c.globalAlpha=1;

  vDrawCitadel(c);
  vDrawTopBar(c);
  if(G.bannerT>0&&G.waveBanner){
    const a=Math.min(1,G.bannerT);c.globalAlpha=a;
    c.font='bold 26px Georgia, serif';c.textAlign='center';
    c.strokeStyle='rgba(0,0,0,0.8)';c.lineWidth=6;c.strokeText(G.waveBanner,CFG.W/2,120);
    c.fillStyle='#ff9a5e';c.fillText(G.waveBanner,CFG.W/2,120);
    c.globalAlpha=1;
  }
  c.restore();
}
function drawCreepHp(c,e){
  if(e.hp>=e.maxHp)return;
  const w=e.boss?60:Math.max(16,e.size*1.6),pct=Math.max(0,e.hp/e.maxHp);
  c.fillStyle='rgba(10,8,18,0.7)';c.fillRect(e.x-w/2,e.y-e.size-12,w,e.boss?5:3.2);
  c.fillStyle=e.boss?'#ff5a5a':(pct>0.4?'#b05adf':'#e05a5a');
  c.fillRect(e.x-w/2+0.5,e.y-e.size-11.4,(w-1)*pct,e.boss?3.8:2.2);
}
function vDivineAura(c,e){
  const p=0.35+Math.sin(G.time*4.2+e.x)*0.18;
  c.strokeStyle='rgba(255,80,60,'+p+')';c.lineWidth=2.5;
  c.beginPath();c.ellipse(e.x,e.y+e.size*0.5,e.size*1.7,e.size*0.6,0,0,7);c.stroke();
}
function drawBarracks(c,b){
  const def=VTROOP_BY[b.id];
  c.save();c.translate(b.x,b.y);
  c.fillStyle='rgba(0,0,0,0.28)';c.beginPath();c.ellipse(0,9,15,6,0,0,7);c.fill();
  /* dark spiked tent */
  c.fillStyle='#2a1830';
  c.beginPath();c.moveTo(-15,9);c.lineTo(0,-20);c.lineTo(15,9);c.closePath();c.fill();
  c.strokeStyle=OUT;c.lineWidth=2;c.stroke();
  c.fillStyle=def.col;
  c.beginPath();c.moveTo(-8,9);c.lineTo(0,-9);c.lineTo(8,9);c.closePath();c.fill();
  /* banner pole */
  c.strokeStyle='#5a4020';c.lineWidth=2;c.beginPath();c.moveTo(0,-20);c.lineTo(0,-34);c.stroke();
  c.fillStyle=V_TIER_COL[def.tier]||'#c8ccd8';
  c.beginPath();c.moveTo(0,-34);c.lineTo(12,-30+Math.sin(G.time*5)*2);c.lineTo(0,-26);c.closePath();c.fill();
  /* level pips */
  c.fillStyle='#ffd75e';for(let i=0;i<Math.min(5,b.lvl);i++)c.fillRect(-10+i*5,11,3.5,3);
  c.restore();
  /* mini icon */
  c.font='11px sans-serif';c.textAlign='center';
}
function vDrawCitadel(c){
  const cp=vCitadelPos();
  /* HP shield ring around the castle */
  const pct=Math.max(0,G.citadelHp/G.citadelMax);
  c.save();
  if(G.hitFlash>0){c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,60,60,'+(G.hitFlash*0.6)+')';c.beginPath();c.arc(cp.x-10,cp.y,86,0,7);c.fill();c.globalCompositeOperation='source-over';}
  c.strokeStyle='rgba(120,200,255,0.25)';c.lineWidth=6;
  c.beginPath();c.arc(cp.x-10,cp.y,82,0,7);c.stroke();
  c.strokeStyle=pct>0.4?'#6ad0ff':'#ff6a6a';c.lineWidth=5;
  c.beginPath();c.arc(cp.x-10,cp.y,82,-Math.PI/2,-Math.PI/2+pct*Math.PI*2);c.stroke();
  c.restore();
  /* HP text */
  c.font='bold 13px Georgia, serif';c.textAlign='center';
  c.fillStyle='#dfe8ff';c.strokeStyle='rgba(0,0,0,0.7)';c.lineWidth=3;
  const txt='🏰 '+fmt(Math.max(0,G.citadelHp))+' / '+fmt(G.citadelMax);
  c.strokeText(txt,cp.x-10,cp.y+108);c.fillText(txt,cp.x-10,cp.y+108);
}
function vDrawTopBar(c){
  /* siege timer bar across the top */
  const w=Math.min(460,CFG.W*0.44),x=(CFG.W-w)/2,y=16;
  const pct=Math.max(0,G.siegeT/G.siegeMax);
  c.fillStyle='rgba(10,8,18,0.72)';roundRect(c,x-10,y-6,w+20,30,9);c.fill();
  c.strokeStyle='rgba(255,120,80,0.5)';c.lineWidth=1.5;roundRect(c,x-10,y-6,w+20,30,9);c.stroke();
  c.fillStyle='#3a2020';c.fillRect(x,y+9,w,8);
  c.fillStyle=pct<0.25?'#ff5a5a':'#ff9a4e';c.fillRect(x,y+9,w*pct,8);
  c.strokeStyle='#ffb07a';c.lineWidth=1.4;c.strokeRect(x,y+9,w,8);
  c.fillStyle='#ffca8a';c.font='bold 12px Georgia, serif';c.textAlign='center';
  c.fillText('⏳ Siege — '+Math.ceil(G.siegeT)+'s to breach',CFG.W/2,y+3);
}

/* expose for the ui layer */
try{window.VILLAIN_READY=true;}catch(e){}
