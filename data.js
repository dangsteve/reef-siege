/* ============================================================
   CASTLE SIEGE — Endless Medieval Tower Defense (v2)
   data.js — constants, definitions, maps, math helpers
   ============================================================ */
'use strict';

const CFG = {
  W: 1280, H: 720, CELL: 40, COLS: 32, ROWS: 18,
  START_GOLD: 240, START_LIVES: 20,
  ENGAGE_R: 30, ENEMY_ATK_R: 36, AGGRO_R: 115,
  INTERMISSION: 9, MAX_TOWER_LVL: 5, MAX_TROOP_LVL: 9, MAX_HERO_LVL: 40,
};

let LOW_FX=false; // set true on touch devices: fewer particles & flashes

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
function fmt(n){
  n=Math.round(n);
  if(n<1000)return ''+n;
  if(n<1e6)return (n/1e3).toFixed(n<1e4?1:0)+'K';
  if(n<1e9)return (n/1e6).toFixed(n<1e7?1:0)+'M';
  return (n/1e9).toFixed(1)+'B';
}

/* ============================================================
   MAPS — 3 battlefields / difficulties
   ============================================================ */
const MAPS=[
 {id:'meadow', name:'Lagoon Shallows', diff:'Easy', theme:'meadow',
  desc:'A single sandy road through the sunlit lagoon. Learn the trade of reef war.',
  mods:{hp:1, gold:1, spd:1, elite:1, heroWaveMul:1, startGold:240},
  paths:[
    [[-1,4],[6,4],[6,13],[13,13],[13,5],[20,5],[20,13],[27,13],[27,8],[30.6,8]],
  ]},
 {id:'crossroads', name:'Kelp Crossing', diff:'Medium', theme:'autumn',
  desc:'Two currents converge on your reef through the golden kelp fields. Split your defenses wisely.',
  mods:{hp:1.18, gold:1.3, spd:1, elite:1.25, heroWaveMul:0.85, startGold:360},
  paths:[
    [[-1,2],[8,2],[8,6],[16,6],[16,2],[23,2],[23,8],[30.6,8]],
    [[-1,15],[7,15],[7,10],[14,10],[14,15],[21,15],[21,11],[27,11],[27,8],[30.6,8]],
  ]},
 {id:'ashen', name:'The Abyssal Trench', diff:'Hard', theme:'ashen',
  desc:'Three black warpaths meet in a killzone before your reef. Only legends survive here.',
  mods:{hp:1.42, gold:1.62, spd:1.06, elite:1.6, heroWaveMul:0.72, startGold:480},
  paths:[
    [[-1,2],[9,2],[9,5],[17,5],[17,2],[23,2],[23,8],[26,8],[30.6,8]],
    [[-1,9],[7,9],[7,12],[14,12],[14,8],[26,8],[30.6,8]],
    [[-1,16],[10,16],[10,13],[17,13],[17,16],[24,16],[24,8],[26,8],[30.6,8]],
  ]},
];
const MAP_BY={};MAPS.forEach(m=>MAP_BY[m.id]=m);

/* runtime-processed current map */
let MAP=null;

function buildPath(cells){
  const pts=cells.map(([c,r])=>({x:c*CFG.CELL+20,y:r*CFG.CELL+20}));
  const P={pts,seg:[],total:0};
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];
    const L=Math.hypot(b.x-a.x,b.y-a.y);
    P.seg.push({a,b,len:L,start:P.total,ang:Math.atan2(b.y-a.y,b.x-a.x)});
    P.total+=L;
  }
  return P;
}
function posAt(pi,d){
  const P=MAP.P[pi];
  d=clamp(d,0,P.total);
  for(const s of P.seg){
    if(d<=s.start+s.len){
      const t=(d-s.start)/s.len;
      return {x:lerp(s.a.x,s.b.x,t),y:lerp(s.a.y,s.b.y,t),a:s.ang};
    }
  }
  const s=P.seg[P.seg.length-1];
  return {x:s.b.x,y:s.b.y,a:s.ang};
}
function distToPaths(x,y){
  let best=1e9;
  for(const P of MAP.P){
    for(const s of P.seg){
      const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;
      const t=clamp(((x-s.a.x)*dx+(y-s.a.y)*dy)/(s.len*s.len),0,1);
      best=Math.min(best,dist2(x,y,s.a.x+dx*t,s.a.y+dy*t));
    }
  }
  return Math.sqrt(best);
}
function nearestPathPoint(x,y){
  let best=1e9,bp=0,bd=0;
  for(let pi=0;pi<MAP.P.length;pi++){
    const P=MAP.P[pi];
    for(let d=0;d<=P.total;d+=14){
      const p=posAt(pi,d),q=dist2(x,y,p.x,p.y);
      if(q<best){best=q;bp=pi;bd=d;}
    }
  }
  return {pi:bp,d:bd};
}

const THEME_DECOR={
  meadow:['tree','tree','tree','pine','rock','bush','flowers','flowers'],
  autumn:['tree','tree','stump','pine','rock','bush','flowers','tree'],
  ashen:['rock','rock','stump','crystal','stump','rock','crystal','bush'],
};
function initMapRuntime(def){
  const P=def.paths.map(buildPath);
  MAP={def,P,blocked:new Set(),decor:[],spawns:P.map(p=>({x:p.pts[0].x,y:p.pts[0].y}))};
  for(let r=0;r<CFG.ROWS;r++)for(let c=0;c<CFG.COLS;c++){
    const x=c*CFG.CELL+20,y=r*CFG.CELL+20;
    if(distToPaths(x,y)<38)MAP.blocked.add(c+','+r);
  }
  for(let r=5;r<=11;r++)for(let c=28;c<=31;c++)MAP.blocked.add(c+','+r);
  const rng=mulberry32(def.id.length*7919+def.paths.length*104729+11840);
  const kinds=THEME_DECOR[def.theme];
  let tries=0;
  const want=def.paths.length===1?26:(def.paths.length===2?20:16);
  while(MAP.decor.length<want&&tries<800){
    tries++;
    const c=Math.floor(rng()*CFG.COLS),r=Math.floor(rng()*CFG.ROWS);
    if(MAP.blocked.has(c+','+r))continue;
    if(MAP.decor.some(d=>d.c===c&&d.r===r))continue;
    MAP.decor.push({c,r,x:c*CFG.CELL+20+(rng()-0.5)*14,y:r*CFG.CELL+20+(rng()-0.5)*14,
      kind:kinds[Math.floor(rng()*kinds.length)],s:0.8+rng()*0.5});
    MAP.blocked.add(c+','+r);
  }
}

/* ============================================================
   TOWERS — 9 types, 5 levels each
   ============================================================ */
const TOWERS=[
 {id:'archer', name:'Harpoon Post',  cost:70,  dmg:8,   rate:1.5,  range:150, dtype:'phys',  proj:'arrow', snd:'arrow', targets:'both',
  desc:'Fast single-target harpoons. Lv5 fires twin shots.', hue:'#c9a227'},
 {id:'cannon', name:'Anchor Mortar',  cost:120, dmg:27,  rate:0.55, range:140, dtype:'phys',  proj:'ball', splash:55, snd:'cannon', targets:'ground',
  desc:'Lobbed anchors with splash damage.', hue:'#7a7f8a'},
 {id:'frost',  name:'Ice Coral',   cost:100, dmg:6,   rate:1.0,  range:135, dtype:'magic', proj:'shard', slow:0.35, slowDur:2.0, snd:'frost', targets:'both',
  desc:'Chills enemies, slowing their drift.', hue:'#69c8e8'},
 {id:'flame',  name:'Thermal Vent', cost:110, dmg:3.6, rate:6,    range:100, dtype:'magic', proj:'flame', burn:6, burnDur:2.5, snd:'flame', targets:'ground',
  desc:'Scalding torrent that leaves foes boiling.', hue:'#e8712a'},
 {id:'ballista',name:'Great Harpoon',     cost:160, dmg:48,  rate:0.4,  range:235, dtype:'phys',  proj:'bolt', pierce:3, snd:'ballista', targets:'both',
  desc:'Huge harpoons that skewer several enemies.', hue:'#a8743a'},
 {id:'poison', name:'Urchin Lab',   cost:130, dmg:6,   rate:0.6,  range:150, dtype:'magic', proj:'glob', splash:42, poison:5, poisonDur:4, snd:'poison', targets:'ground',
  desc:'Toxic spines; venom stacks up to 6 times.', hue:'#7ec244'},
 {id:'storm',  name:'Eel Spire',   cost:180, dmg:14,  rate:0.85, range:165, dtype:'magic', proj:'zap', chain:4, snd:'zap', targets:'both',
  desc:'Electric arcs that chain between enemies.', hue:'#b48ce8'},
 {id:'mint',   name:'Treasure Chest',     cost:150, income:9, rate:0, range:0, dtype:'none', proj:'none', snd:'mint_coin',
  desc:'Mints gold every 5s. Perfect while you multitask.', hue:'#e8c93a'},
 {id:'beacon', name:'Pearl Beacon',   cost:140, aura:0.12, rate:0, range:135, dtype:'none', proj:'none', snd:'coin',
  desc:'+damage aura for towers in range. Stacks.', hue:'#f0e6b4'},
];
const TOWER_BY={};TOWERS.forEach(t=>TOWER_BY[t.id]=t);

function towerStat(def,lvl){
  const m=Math.pow(1.55,lvl-1);
  return {
    dmg:def.dmg?def.dmg*m:0,
    rate:def.rate?def.rate*(1+0.08*(lvl-1)):0,
    range:def.range?def.range*(1+0.055*(lvl-1)):0,
    splash:def.splash?def.splash*(1+0.08*(lvl-1)):0,
    slow:def.slow?Math.min(0.7,def.slow+0.07*(lvl-1)):0,
    slowDur:def.slowDur?def.slowDur+0.25*(lvl-1):0,
    burn:def.burn?def.burn*m:0,
    burnDur:def.burnDur||0,
    poison:def.poison?def.poison*m:0,
    poisonDur:def.poisonDur||0,
    pierce:def.pierce?def.pierce+(lvl>=3?1:0)+(lvl>=5?1:0):0,
    chain:def.chain?def.chain+(lvl-1):0,
    income:def.income?Math.round(def.income*Math.pow(1.6,lvl-1)):0,
    aura:def.aura?def.aura+0.09*(lvl-1):0,
    multishot:def.id==='archer'&&lvl>=5?2:1,
  };
}
const towerUpCost=(def,lvl)=>Math.round(def.cost*0.85*Math.pow(lvl,1.55));
function towerInvested(def,lvl){let s=def.cost;for(let l=1;l<lvl;l++)s+=towerUpCost(def,l);return s;}

/* ============================================================
   TROOPS — 12 summonable types
   ============================================================ */
const TROOPS=[
 {id:'militia',  name:'Jellyfish',     cost:15,  hp:52,  dmg:5,  rate:1.0, speed:70,  melee:true,  unlock:1,  snd:'melee_hit1', desc:'Cheap stingers. Hold the line.'},
 {id:'archer',   name:'Pistol Shrimp',      cost:25,  hp:32,  dmg:7,  rate:0.9, speed:70,  melee:false, range:145, unlock:1,  snd:'arrow', desc:'Snaps from a distance.'},
 {id:'sword',    name:'Crab Guard',   cost:35,  hp:95,  dmg:9,  rate:0.85,speed:66,  melee:true,  unlock:2,  snd:'melee_hit2', desc:'Solid frontline pincher.'},
 {id:'spear',    name:'Swordfish',    cost:45,  hp:78,  dmg:12, rate:1.0, speed:66,  melee:true,  unlock:4,  bonusFast:1.5, snd:'melee_hit3', desc:'+50% damage vs fast enemies.'},
 {id:'xbow',     name:'Pufferfish Darter', cost:55,  hp:42,  dmg:17, rate:1.3, speed:62,  melee:false, range:175, pierceArmor:0.5, unlock:6, snd:'crossbow', desc:'Darts punch through 50% armor.'},
 {id:'berserker',name:'Mantis Shrimp',   cost:70,  hp:75,  dmg:26, rate:0.9, speed:78,  melee:true,  unlock:8,  snd:'melee_hit2', desc:'Punches faster as it bleeds.'},
 {id:'knight',   name:'Snail Shellguard',      cost:90,  hp:270, dmg:10, rate:1.0, speed:56,  melee:true,  armor:0.3, unlock:10, snd:'melee_hit1', desc:'Heavy shell. Great blocker.'},
 {id:'mage',     name:'Cuttle Mage', cost:110, hp:58,  dmg:21, rate:1.6, speed:60,  melee:false, range:155, splash:45, unlock:12, snd:'mage_bolt', desc:'Explosive magic bolts (splash).'},
 {id:'cleric',   name:'Angelfish Healer',      cost:100, hp:75,  dmg:0,  rate:0,   speed:62,  melee:false, heal:14, healRange:100, unlock:14, snd:'holy_heal', desc:'Heals your shoal and heroes.'},
 {id:'cavalry',  name:'Seahorse Rider',     cost:120, hp:160, dmg:19, rate:0.8, speed:118, melee:true,  unlock:16, snd:'melee_hit2', desc:'Swift riders that rush the front.'},
 {id:'paladin',  name:'Turtle Paladin',     cost:160, hp:350, dmg:17, rate:0.95,speed:54,  melee:true,  armor:0.35, selfHeal:0.015, unlock:18, snd:'melee_hit3', desc:'Shelled, self-healing champion.'},
 {id:'giant',    name:'Colossal Crab',       cost:250, hp:950, dmg:48, rate:1.7, speed:44,  melee:true,  cleave:45, unlock:20, snd:'giant_smash', desc:'Titanic claws. Cleaves groups.'},
];
const TROOP_BY={};TROOPS.forEach(t=>TROOP_BY[t.id]=t);
const ALL_TROOPS_WAVE=Math.max(...TROOPS.map(t=>t.unlock)); // 20

function troopStat(id,lvl){
  const d=TROOP_BY[id],m=Math.pow(1.32,lvl);
  return {hp:d.hp*m,dmg:d.dmg*m,heal:(d.heal||0)*m,rate:d.rate,speed:d.speed,
    range:d.range||0,armor:d.armor||0,cost:Math.round(d.cost*(1+0.1*lvl))};
}
const troopUpCost=(id,lvl)=>Math.round(TROOP_BY[id].cost*2.4*Math.pow(1.55,lvl));

/* ============================================================
   HEROES — 6 recruitable champions
   ============================================================ */
const HEROES=[
 {id:'aldric', name:'Porous Pete', title:'Fry-Cook of the Reef', unlockWave:0, cost:0,
  hp:420, dmg:34, rate:0.7, speed:95, melee:true, cleave:48, col:'#f2d94e', cape:'#e86a3a', snd:'hero_aldric_atk',
  skill:{id:'slam', name:'Spatula Slam', unlockLvl:3, cd:9, snd:'skill_slam',
    desc:'Shockwave spatula-flip: heavy AoE damage + brief stun.'},
  passive:{lvl:8, name:'Order Up!', desc:'Troops near Pete deal +15% damage.'}},
 {id:'lyra', name:'Coralie Swiftfin', title:'Warden of the Kelp', unlockWave:20, cost:600,
  hp:300, dmg:26, rate:0.45, speed:105, melee:false, range:180, col:'#7ede8a', cape:'#3a7a44', snd:'hero_lyra_atk',
  skill:{id:'arrowstorm', name:'Shell Storm', unlockLvl:3, cd:12, snd:'skill_arrowstorm',
    desc:'Rains a volley of 12 shells on the thickest pack.'},
  passive:{lvl:8, name:'Eagle Eye', desc:'+20% range, 15% chance to crit for double.'}},
 {id:'magnus', name:'Inkwell', title:'Deep Sage of the Ink', unlockWave:30, cost:1200,
  hp:280, dmg:38, rate:1.4, speed:85, melee:false, range:165, splash:50, dtype:'magic', col:'#ff9a5e', cape:'#8a2a1a', snd:'hero_magnus_atk',
  skill:{id:'meteor', name:'Scalding Comet', unlockLvl:3, cd:14, snd:'skill_meteor',
    desc:'Calls a scalding comet onto the largest cluster: massive boil damage.'},
  passive:{lvl:8, name:'Boiling Touch', desc:'His attacks set enemies boiling.'}},
 {id:'celeste', name:'Sister Marina', title:'Voice of the Tides', unlockWave:40, cost:2000,
  hp:340, dmg:20, rate:1.0, speed:88, melee:false, range:150, dtype:'magic', col:'#ffe8a8', cape:'#e8c93a', snd:'hero_celeste_atk',
  skill:{id:'sanctuary', name:'Healing Tide', unlockLvl:3, cd:16, snd:'skill_sanctuary',
    desc:'Heals your whole army 45% and shields it for 4s.'},
  passive:{lvl:8, name:'Tide Aura', desc:'Allies near Marina regenerate.'}},
 {id:'bjorn', name:'Crushclaw', title:'Crab Jarl of the Trench', unlockWave:50, cost:3200,
  hp:780, dmg:42, rate:0.95, speed:80, melee:true, col:'#e0b060', cape:'#6a4a8a', snd:'hero_bjorn_atk',
  skill:{id:'warcry', name:'War Snap', unlockLvl:3, cd:13, snd:'skill_warcry',
    desc:'Terrifying claw-clash: stuns nearby enemies, mends his shell.'},
  passive:{lvl:8, name:'Iron Shell', desc:'Takes 30% less damage.'}},
 {id:'nyx', name:'Moray', title:'Shadow Eel of the Deep', unlockWave:60, cost:5000,
  hp:330, dmg:55, rate:0.55, speed:125, melee:true, col:'#c88bff', cape:'#2a2440', snd:'hero_nyx_atk',
  skill:{id:'shadowflurry', name:'Eel Flurry', unlockLvl:3, cd:11, snd:'skill_shadow',
    desc:'Blinks between the 6 strongest foes, striking each hard.'},
  passive:{lvl:8, name:'Slipstream', desc:'25% chance to dodge any blow.'}},
 /* ---- LEGENDARIES: rescued from Shadow Wardens (rare events), kept forever in the Vault ---- */
 {id:'aurelia', name:'King Neptune', title:'God-King of the Seven Seas', legendary:true, unlockWave:-1, cost:0,
  hp:1100, dmg:95, rate:0.6, speed:105, melee:true, cleave:62, col:'#ffe27a', cape:'#f4f0e4', snd:'hero_celeste_atk',
  skill:{id:'dawnburst', name:'Trident Radiance', unlockLvl:1, cd:10, snd:'skill_sanctuary',
    desc:'Trident nova: heavy divine damage and heals nearby allies.'},
  passive:{lvl:5, name:'Immortal Tide', desc:'Returns from death almost instantly.'}},
 {id:'karrgoth', name:'The Flying Dutchman', title:'Scourge of the Ghost Seas', legendary:true, unlockWave:-1, cost:0,
  hp:1600, dmg:120, rate:0.85, speed:88, melee:true, cleave:70, col:'#7de8b8', cape:'#1a3a2e', snd:'hero_bjorn_atk',
  skill:{id:'dragonfire', name:'Ghostfire Broadside', unlockLvl:1, cd:12, snd:'skill_meteor',
    desc:'Unleashes a broadside of ghostfire over the thickest pack.'},
  passive:{lvl:5, name:'Ghostfire', desc:'His blows set enemies alight with ghostfire.'}},
 {id:'morrigan', name:'Davy Jones', title:'Keeper of the Locker', legendary:true, unlockWave:-1, cost:0,
  hp:850, dmg:110, rate:1.1, speed:95, melee:false, range:200, dtype:'magic', col:'#4ad0c8', cape:'#12262a', snd:'hero_nyx_atk',
  skill:{id:'ravenstorm', name:'Souls of the Locker', unlockLvl:1, cd:11, snd:'skill_shadow',
    desc:'A swarm of drowned souls tears into up to 10 foes.'},
  passive:{lvl:5, name:'Chill of the Locker', desc:'His magic slows everything it touches.'}},
];
const HERO_BY={};HEROES.forEach(h=>HERO_BY[h.id]=h);
const LEGENDARIES=HEROES.filter(h=>h.legendary);

function heroEffUnlock(def){
  if(def.legendary)return -1; // event-only
  if(def.unlockWave===0)return 0;
  return Math.max(12,Math.round(def.unlockWave*MAP.def.mods.heroWaveMul));
}
function heroStat(def,lvl){
  const m=Math.pow(1.22,lvl-1)*(1+relicVal('grimoire'));
  let respawn=Math.max(8,15-0.2*(lvl-1));
  if(def.legendary)respawn=def.id==='aurelia'&&lvl>=def.passive.lvl?2:5;
  return {hp:def.hp*m,dmg:def.dmg*m,rate:def.rate,speed:def.speed,
    range:(def.range||0)*(lvl>=(def.passive?def.passive.lvl:99)&&def.id==='lyra'?1.2:1),
    respawn};
}
function heroUpCost(def,lvl){
  const idx=Math.min(HEROES.indexOf(def),5);
  const base=def.legendary?520:(110+idx*55);
  return Math.round(base*Math.pow(1.33,lvl-1));
}

/* ============================================================
   SPELLS — always available, cooldown-based battlefield powers
   ============================================================ */
const SPELLS=[
 {id:'firestorm', name:'Boiling Geyser', icon:'fire', cd:45, radius:115, target:true, snd:'consumable_meteor',
  desc:'Click a spot: a scalding geyser erupts — heavy damage plus boil.'},
 {id:'blessing', name:'Healing Current', icon:'heal', cd:40, radius:125, target:true, dur:5, snd:'consumable_heal',
  desc:'Click a spot: a warm current — heals your army there for 5s.'},
 {id:'ragnarok', name:'MAELSTROM', icon:'ragnarok', cd:300, target:false, snd:'boss_die',
  desc:'The sea itself rebels. Devastates every enemy, stuns the horde, resummons your entire army free, and empowers it. The last-minute clutch.'},
];
const SPELL_BY={};SPELLS.forEach(s=>SPELL_BY[s.id]=s);

/* ============================================================
   RANDOM EVENTS — wandering treasures & legendary rescues
   ============================================================ */
const EVENT_DEFS={
 boar:{id:'boar', name:'Golden Sea Turtle', hp:34, speed:118, armor:0, gold:15, leak:0, kind:'beast', col:'#ffd75e', size:12, event:'boar'},
 warden:{id:'warden', name:'Locker Warden', hp:640, speed:52, armor:0.35, gold:80, leak:0, kind:'big', col:'#5c4a8a', size:20, event:'warden'},
};
const EVENT_CFG={
 boarMinWave:4, boarChance:0.11,
 wardenMinWave:9,
 wardenChance:(w,pity)=>Math.min(0.30,0.02+0.003*w+0.012*pity),
};

/* ============================================================
   THE VAULT — permanent progress that survives every defeat
   ============================================================ */
let VAULT=null;
function vaultData(){
  if(VAULT)return VAULT;
  try{VAULT=JSON.parse(localStorage.getItem('cs2_vault'))||null;}catch(err){VAULT=null;}
  if(!VAULT||VAULT.v!==1)VAULT={v:1,legends:[],peaks:{},wardenPity:0};
  if(!VAULT.peaks)VAULT.peaks={};
  if(!Array.isArray(VAULT.legends))VAULT.legends=[];
  return VAULT;
}
function vaultSave(){try{localStorage.setItem('cs2_vault',JSON.stringify(vaultData()));}catch(err){}}
function vaultHas(id){return vaultData().legends.includes(id);}
function vaultAddLegend(id){
  const v=vaultData();
  if(!v.legends.includes(id)){v.legends.push(id);vaultSave();}
}
function vaultPeak(mapId){return vaultData().peaks[mapId]||null;}

/* ============================================================
   ENEMIES + BOSSES
   ============================================================ */
const ENEMIES=[
 {id:'goblin',  name:'Barnacle Imp',       hp:22,  speed:62,  armor:0,   gold:4,  leak:1, w:1,   unlock:1,  kind:'biped', col:'#5da03c', size:9},
 {id:'wolf',    name:'Barracuda',    hp:17,  speed:96,  armor:0,   gold:4,  leak:1, w:1,   unlock:2,  kind:'beast', col:'#8a8f98', size:9},
 {id:'bandit',  name:'Sea Slug Bandit',       hp:36,  speed:70,  armor:0.1, gold:5,  leak:1, w:1.6, unlock:3,  kind:'biped', col:'#9c6b3f', size:10},
 {id:'skel',    name:'Bonefish',     hp:30,  speed:58,  armor:0,   gold:5,  leak:1, w:1.4, unlock:4,  kind:'biped', col:'#d8d4c4', size:10},
 {id:'orc',     name:'Trench Brute',          hp:72,  speed:52,  armor:0.15,gold:8,  leak:1, w:3,   unlock:5,  kind:'biped', col:'#4c7d3a', size:12},
 {id:'hobgob',  name:'Tidepool Raider',    hp:56,  speed:67,  armor:0.1, gold:7,  leak:1, w:2.4, unlock:7,  kind:'biped', col:'#b0623c', size:11},
 {id:'shaman',  name:'Sea Witch', hp:62,  speed:48,  armor:0,   gold:11, leak:1, w:3,   unlock:8,  kind:'biped', col:'#c48be0', size:11, healer:true},
 {id:'armskel', name:'Crusted Bone Guard',   hp:92,  speed:50,  armor:0.45,gold:10, leak:1, w:4,   unlock:10, kind:'biped', col:'#b8bcc8', size:11},
 {id:'fellbat', name:'Sting Jelly',     hp:42,  speed:102, armor:0,   gold:9,  leak:1, w:2.5, unlock:11, kind:'flyer', col:'#6a5a8a', size:10, fly:true},
 {id:'wraith',  name:'Drowned Wraith',       hp:78,  speed:90,  armor:0.2, gold:12, leak:1, w:3.5, unlock:12, kind:'ghost', col:'#9adcd4', size:11},
 {id:'troll',   name:'Trench Troll',   hp:230, speed:44,  armor:0.2, gold:17, leak:2, w:8,   unlock:14, kind:'big',   col:'#5a8a6a', size:15, regen:0.008},
 {id:'dknight', name:'Black Tide Knight',  hp:270, speed:55,  armor:0.45,gold:19, leak:2, w:9,   unlock:16, kind:'biped', col:'#3c3f52', size:12},
 {id:'gargoyle',name:'Reef Gargoyle',     hp:185, speed:58,  armor:0.4, gold:16, leak:2, w:7,   unlock:17, kind:'flyer', col:'#8a8578', size:13, fly:true},
 {id:'ogre',    name:'Depth Ogre',         hp:430, speed:38,  armor:0.25,gold:23, leak:3, w:14,  unlock:18, kind:'big',   col:'#c2925a', size:17},
 {id:'harpy',   name:'Sting Ray',        hp:95,  speed:106, armor:0,   gold:13, leak:1, w:4,   unlock:20, kind:'ghost', col:'#d8788a', size:11, fly:true},
 {id:'golem',   name:'Coral Golem',  hp:720, speed:30,  armor:0.6, gold:32, leak:3, w:22,  unlock:24, kind:'big',   col:'#8a8578', size:18},
 {id:'wyvern',  name:'Sea Serpent', hp:540, speed:68,  armor:0.25,gold:28, leak:3, w:16,  unlock:26, kind:'drake', col:'#4a7a9a', size:16, fly:true},
];
const ENEMY_BY={};ENEMIES.forEach(e=>ENEMY_BY[e.id]=e);

const BOSSES=[
 {id:'warlord', name:'Tidepool Tyrant',   hp:1400, speed:30, armor:0.3, gold:220, leak:10, kind:'big', col:'#b0703a', size:24, ability:'stomp', abCd:8,  desc:'Stomps your shoal flat!'},
 {id:'colossus',name:'Ghost Pirate Captain',  hp:2000, speed:27, armor:0.45,gold:280, leak:10, kind:'big', col:'#cfd0c2', size:25, ability:'summon',abCd:10, desc:'Raises bonefish as it marches.'},
 {id:'behemoth',name:'Trench Behemoth', hp:2600, speed:25, armor:0.3, gold:340, leak:10, kind:'big', col:'#4f7a52', size:26, ability:'regen', abCd:1,  desc:'Regenerates. Burst it down!'},
 {id:'drake',   name:'Magma Eel', hp:2300, speed:33, armor:0.35,gold:400, leak:10, kind:'drake',col:'#c2402a', size:24, ability:'burn',  abCd:1,  desc:'Scalds nearby defenders.'},
];

/* ============================================================
   RELICS (permanent) + CONSUMABLES (one-shot battlefield powers)
   ============================================================ */
const RELICS=[
 {id:'steel',      name:'Sharpened Claws',  max:5, base:300, mult:1.9,  eff:'troopDmg', per:0.10, desc:'+10% troop damage per tier.'},
 {id:'engineering',name:'Reef Engineering',max:5, base:350, mult:1.9,  eff:'towerDmg', per:0.08, desc:'+8% tower damage per tier.'},
 {id:'banners',    name:'Kelp Banners',      max:5, base:400, mult:1.85, eff:'armyCap',  per:2,    desc:'+2 army capacity per tier.'},
 {id:'treasury',   name:'Sunken Treasury',   max:5, base:500, mult:1.95, eff:'gold',     per:0.10, desc:'+10% gold from all sources per tier.'},
 {id:'walls',      name:'Coral Walls',    max:5, base:450, mult:1.85, eff:'lives',    per:5,    desc:'+5 max reef lives per tier (and repairs 5).'},
 {id:'grimoire',   name:"Mariner's Grimoire",  max:5, base:400, mult:1.9,  eff:'heroPower',per:0.10, desc:'+10% hero damage & health per tier.'},
 {id:'drums',      name:'Drums of the Deep',     max:3, base:600, mult:2.0,  eff:'summon',   per:0.25, desc:'Army resummons 25% faster per tier.'},
];
const RELIC_BY={};RELICS.forEach(r=>RELIC_BY[r.id]=r);
const relicCost=(def,tier)=>Math.round(def.base*Math.pow(def.mult,tier));
/* relicVal reads G.relics at runtime; safe fallback pre-game */
function relicVal(id){
  if(typeof G==='undefined'||!G||!G.relics)return 0;
  return (G.relics[id]||0)*RELIC_BY[id].per;
}

const CONSUMABLES=[
 {id:'meteor',   name:'Meteor Strike',  cost:250, snd:'consumable_meteor', desc:'Click anywhere: obliterates an area (45% max-HP + burn).'},
 {id:'horn',     name:'Horn of Renewal',cost:200, snd:'consumable_heal',   desc:'Instantly restores your whole army and heroes to full.'},
 {id:'frostbomb',name:'Frost Nova',     cost:180, snd:'consumable_freeze', desc:'Freezes every enemy solid for 4s (bosses 1.5s).'},
];
const CONSUM_BY={};CONSUMABLES.forEach(c=>CONSUM_BY[c.id]=c);

/* ---------- wave scaling ---------- */
const hpMul=w=>(1+0.15*w)*Math.pow(1.07,w)*(MAP?MAP.def.mods.hp:1);
const goldMul=w=>(1+0.06*w+0.0008*w*w)*(MAP?MAP.def.mods.gold:1)*(1+relicVal('treasury'));
const waveReward=w=>Math.round((60+14*w+(w%10===0?150+8*w:0))*(1+relicVal('treasury'))*(MAP?0.85+0.15*MAP.P.length:1));
const speedMul=w=>Math.min(1.25,1+0.003*w)*(MAP?MAP.def.mods.spd:1);
const popCap=w=>Math.min(26,8+Math.floor(w/3)+Math.round(relicVal('banners')));
const maxLives=()=>CFG.START_LIVES+Math.round(relicVal('walls'));
const VET_KILLS=[20,60,160,400,1000];
function towerRank(t){let s=0;for(const k of VET_KILLS)if((t.kills||0)>=k)s++;return s;}
const eliteChance=w=>Math.min(0.28,(0.02+0.006*w)*(MAP?MAP.def.mods.elite:1));
const champChance=w=>w<15?0:Math.min(0.13,0.008*(w-12)*(MAP?MAP.def.mods.elite:1));
