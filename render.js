/* ============================================================
   render.js — frame composition (v2)
   Terrain & towers come from SpriteLib (sprites.js) with vector
   fallbacks; units are runtime vector art with outlines/shading.
   ============================================================ */
'use strict';

const OUT='rgba(24,18,32,0.85)';
const bgCache={};
const towerSprCache={};
const REEFY=()=>(typeof SpriteLib!=='undefined'&&SpriteLib.flavor==='reef');
function clearRenderCaches(){
  for(const k in bgCache)delete bgCache[k];
  for(const k in towerSprCache)delete towerSprCache[k];
}

function oShape(c,fill,draw){
  c.beginPath();draw(c);
  c.fillStyle=fill;c.fill();
  c.lineWidth=2;c.strokeStyle=OUT;c.stroke();
}
function shade(hex,amt){
  if(hex[0]!=='#')return hex;
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
  return 'rgb('+clamp(r,0,255)+','+clamp(g,0,255)+','+clamp(b,0,255)+')';
}

/* ---------- terrain ---------- */
function terrainDescriptor(){
  return {theme:MAP.def.theme,
    pathsPx:MAP.P.map(p=>p.pts),
    decor:MAP.decor.map(d=>({x:d.x,y:d.y,kind:d.kind,s:d.s})),
    castle:MAP.castle||{x:1235,y:340},
    w:CFG.W,h:CFG.H,
    spawns:MAP.spawns};
}
function getBG(){
  const key=MAP.def.id+':'+(typeof SpriteLib!=='undefined'?SpriteLib.flavor:'')+':'+CFG.W+'x'+CFG.H;
  if(bgCache[key])return bgCache[key];
  let cv=null;
  try{
    if(typeof SpriteLib!=='undefined')cv=SpriteLib.terrain(terrainDescriptor());
  }catch(err){console.warn('terrain sprite failed',err);}
  if(!cv)cv=fallbackTerrain();
  bgCache[key]=cv;
  return cv;
}
function fallbackTerrain(){
  const cv=document.createElement('canvas');
  cv.width=CFG.W;cv.height=CFG.H;
  const c=cv.getContext('2d');
  const cols={meadow:['#4e8c42','#3a6d34'],autumn:['#a8823c','#7a5c2a'],ashen:['#4a4550','#2e2a36']}[MAP.def.theme];
  const g=c.createLinearGradient(0,0,0,CFG.H);
  g.addColorStop(0,cols[0]);g.addColorStop(1,cols[1]);
  c.fillStyle=g;c.fillRect(0,0,CFG.W,CFG.H);
  c.lineCap='round';c.lineJoin='round';
  for(const P of MAP.P){
    c.strokeStyle='#5d4a2e';c.lineWidth=50;strokePath(c,P);
    c.strokeStyle='#a08252';c.lineWidth=38;strokePath(c,P);
  }
  const cs=MAP.castle||{x:1235,y:340};
  c.fillStyle='#8d8798';c.fillRect(cs.x-70,cs.y-70,140,140);
  return cv;
}
function strokePath(c,P){
  c.beginPath();
  c.moveTo(P.pts[0].x,P.pts[0].y);
  for(let i=1;i<P.pts.length;i++)c.lineTo(P.pts[i].x,P.pts[i].y);
  c.stroke();
}
function drawCastleFlags(c,time){
  const cx=MAP.castle?MAP.castle.x:1235,cy=MAP.castle?MAP.castle.y:340;
  for(const [fx,fy] of [[cx-72,cy-88],[cx+72,cy-88],[cx,cy-118]]){
    c.strokeStyle='#5a4020';c.lineWidth=2.5;
    c.beginPath();c.moveTo(fx,fy);c.lineTo(fx,fy-22);c.stroke();
    const wav=Math.sin(time*4+fx)*3;
    c.fillStyle='#c23a3a';
    c.beginPath();c.moveTo(fx,fy-22);c.lineTo(fx+17,fy-17+wav);c.lineTo(fx,fy-11);c.closePath();c.fill();
    c.lineWidth=1.5;c.strokeStyle='rgba(24,18,32,0.6)';c.stroke();
  }
}

/* ---------- towers ---------- */
function towerSprite(id,lvl){
  const key=id+lvl+':'+(typeof SpriteLib!=='undefined'?SpriteLib.flavor:'');
  if(key in towerSprCache)return towerSprCache[key];
  let s=null;
  try{
    if(typeof SpriteLib!=='undefined')s=SpriteLib.tower(id,lvl);
  }catch(err){console.warn('tower sprite failed',id,lvl,err);}
  towerSprCache[key]=s;
  return s;
}
function drawTower(c,t){
  const def=TOWER_BY[t.id],lvl=t.lvl;
  const spr=towerSprite(t.id,lvl);
  c.fillStyle='rgba(0,0,0,0.28)';
  c.beginPath();c.ellipse(t.x,t.y+9,17,7,0,0,7);c.fill();
  if(t.building){drawBuilding(c,t,def);return;}
  if(spr&&spr.base){
    const SC=0.8; // fit the tile: neighbors no longer overlap
    c.drawImage(spr.base,t.x-spr.ax*SC,t.y-spr.ay*SC,spr.base.width*SC,spr.base.height*SC);
    if(spr.turret){
      c.save();c.translate(t.x,t.y-(spr.mountH||24)*SC);c.rotate(t.ang);
      c.drawImage(spr.turret,-spr.tpx*SC,-spr.tpy*SC,spr.turret.width*SC,spr.turret.height*SC);
      c.restore();
    }
  }else{
    drawTowerFallback(c,t,def,lvl);
  }
  /* live embellishments */
  if(t.id==='flame'){
    const fl=Math.sin(G.time*9+t.x)*2;
    c.fillStyle='rgba(255,158,60,0.85)';
    c.beginPath();c.ellipse(t.x,t.y-28,5,8+fl,0,0,7);c.fill();
    c.fillStyle='#ffe8a0';c.beginPath();c.ellipse(t.x,t.y-27,2.5,4+fl*0.6,0,0,7);c.fill();
  }
  if(t.id==='storm'){
    const pu=0.4+Math.sin(G.time*6+t.x)*0.2;
    c.fillStyle='rgba(180,140,232,'+pu*0.5+')';
    c.beginPath();c.arc(t.x,t.y-36,9,0,7);c.fill();
  }
  if(t.id==='beacon'){
    const pu=0.25+Math.sin(G.time*3+t.x)*0.12;
    c.fillStyle='rgba(255,244,200,'+pu+')';
    c.beginPath();c.arc(t.x,t.y-34,10,0,7);c.fill();
  }
  if(lvl>=5){
    const pu=0.35+Math.sin(G.time*4+t.x)*0.15;
    c.strokeStyle='rgba(255,215,94,'+pu+')';c.lineWidth=2;
    c.beginPath();c.ellipse(t.x,t.y+6,20,8,0,0,7);c.stroke();
  }
  /* level pips */
  c.fillStyle='#ffd75e';c.strokeStyle=OUT;c.lineWidth=1;
  for(let i=0;i<lvl;i++){
    c.beginPath();c.arc(t.x-10+i*5,t.y+15,1.9,0,7);c.fill();c.stroke();
  }
  /* veterancy stars (kill ranks: +3% dmg each) */
  const stars=towerRank(t);
  if(stars>0){
    c.fillStyle='#ffe98a';c.strokeStyle=OUT;c.lineWidth=1;
    for(let i=0;i<stars;i++){
      const sx2=t.x-(stars-1)*3+i*6,sy2=t.y+22;
      c.beginPath();
      c.moveTo(sx2,sy2-2.6);c.lineTo(sx2+1.1,sy2-0.8);c.lineTo(sx2+2.6,sy2-0.6);
      c.lineTo(sx2+1.4,sy2+0.7);c.lineTo(sx2+1.7,sy2+2.4);c.lineTo(sx2,sy2+1.5);
      c.lineTo(sx2-1.7,sy2+2.4);c.lineTo(sx2-1.4,sy2+0.7);c.lineTo(sx2-2.6,sy2-0.6);
      c.lineTo(sx2-1.1,sy2-0.8);c.closePath();c.fill();c.stroke();
    }
  }
  /* promotion tier trim: silver / gold */
  if((t.tier||1)>1){
    const tc=t.tier===2?'#c8ccd8':'#ffd75e';
    c.strokeStyle=tc;c.lineWidth=2;
    c.beginPath();c.ellipse(t.x,t.y+7,22,9,0,0,7);c.stroke();
    c.font='bold 9px Georgia, serif';c.textAlign='center';
    c.strokeStyle=OUT;c.lineWidth=2.6;
    c.strokeText(t.tier===2?'II':'III',t.x+16,t.y-2);
    c.fillStyle=tc;
    c.fillText(t.tier===2?'II':'III',t.x+16,t.y-2);
  }
  if(def.prem)drawPremiumFx(c,t,def);
}
function hexToRgb(h){if(h[0]!=='#')return '190,150,255';const n=parseInt(h.slice(1),16);return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255);}
function drawBuilding(c,t,def){
  const frac=1-(t.buildLeft/(t.buildTotal||1));
  c.save();c.translate(t.x,t.y);
  /* ghost of the tower to come */
  const spr=towerSprite(t.id,1);
  c.globalAlpha=0.28;
  if(spr&&spr.base){const SC=0.8;c.drawImage(spr.base,-spr.ax*SC,-spr.ay*SC,spr.base.width*SC,spr.base.height*SC);}
  c.globalAlpha=1;
  /* scaffolding poles */
  c.strokeStyle='#8a6a3a';c.lineWidth=3;
  for(const sx of [-14,14]){c.beginPath();c.moveTo(sx,10);c.lineTo(sx,-40);c.stroke();}
  c.strokeStyle='#a8824a';c.lineWidth=2;
  for(const yy of [-4,-20,-34]){c.beginPath();c.moveTo(-14,yy);c.lineTo(14,yy);c.stroke();}
  c.strokeStyle='rgba(168,130,74,0.7)';c.lineWidth=1.6;
  c.beginPath();c.moveTo(-14,10);c.lineTo(14,-34);c.moveTo(14,10);c.lineTo(-14,-34);c.stroke();
  /* progress ring */
  c.beginPath();c.arc(0,-14,20,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);
  c.strokeStyle=def.hue;c.lineWidth=3.5;c.stroke();
  c.restore();
  /* remaining-waves label */
  c.font='bold 11px Georgia, serif';c.textAlign='center';
  c.strokeStyle='rgba(0,0,0,0.7)';c.lineWidth=3;
  const lbl='🔨 '+t.buildLeft+'w';
  c.strokeText(lbl,t.x,t.y-40);
  c.fillStyle=def.hue;c.fillText(lbl,t.x,t.y-40);
}
function drawPremiumFx(c,t,def){
  const glowP=0.3+Math.sin(G.time*3+t.x)*0.14;
  c.save();c.globalCompositeOperation='lighter';
  c.fillStyle='rgba('+hexToRgb(def.hue)+','+(glowP*0.28)+')';
  c.beginPath();c.arc(t.x,t.y-16,26,0,7);c.fill();
  c.globalCompositeOperation='source-over';c.restore();
  /* a robed mage stands atop the legendary support towers */
  if(t.id==='pHeal'||t.id==='pStorm'){
    const bob=Math.sin(G.time*2.5+t.x)*1.5;
    c.save();c.translate(t.x,t.y-42+bob);
    c.fillStyle=t.id==='pHeal'?'#3a8a5a':'#5a2a8a';
    c.beginPath();c.moveTo(-6,8);c.quadraticCurveTo(-7,-6,0,-9);c.quadraticCurveTo(7,-6,6,8);c.closePath();c.fill();c.strokeStyle=OUT;c.lineWidth=1.6;c.stroke();
    c.fillStyle=t.id==='pHeal'?'#e8c8a0':'#d8c0f0';
    c.beginPath();c.arc(0,-11,3.2,0,7);c.fill();c.stroke();
    /* pointed hat */
    c.fillStyle=t.id==='pHeal'?'#2a6a44':'#3a1a6a';
    c.beginPath();c.moveTo(-4,-12);c.lineTo(4,-12);c.lineTo(0,-22);c.closePath();c.fill();c.stroke();
    /* channeling orb */
    const oc=t.id==='pHeal'?'#7ee0a0':'#c060ff';
    c.globalCompositeOperation='lighter';
    c.fillStyle=oc;c.beginPath();c.arc(6,-6,3+Math.sin(G.time*6)*1,0,7);c.fill();
    c.globalCompositeOperation='source-over';
    c.restore();
  }
  if(t.id==='pShadow'){
    c.strokeStyle='rgba(140,60,220,'+(0.4+Math.sin(G.time*4)*0.2)+')';c.lineWidth=2;
    for(let k=0;k<3;k++){const a=G.time*1.5+k*2.1;c.beginPath();c.moveTo(t.x,t.y-34);c.quadraticCurveTo(t.x+Math.cos(a)*22,t.y-46,t.x+Math.cos(a)*30,t.y-30);c.stroke();}
  }
  if(t.id==='pGod'){
    const modes=(typeof GOD_BY!=='undefined'&&t.godMode&&GOD_BY[t.godMode])?GOD_BY[t.godMode]:null;
    for(let k=0;k<5;k++){const a=G.time*1.1+k*(Math.PI*2/5);const rx=t.x+Math.cos(a)*18,ry=t.y-30+Math.sin(a)*7;c.fillStyle='rgba(255,215,94,'+(0.5+Math.sin(G.time*3+k)*0.3)+')';c.fillRect(rx-1.5,ry-1.5,3,3);}
    if(modes){c.font='bold 10px Georgia, serif';c.textAlign='center';c.strokeStyle='rgba(0,0,0,0.7)';c.lineWidth=3;c.strokeText(modes.ico+' '+modes.name,t.x,t.y-44);c.fillStyle=modes.col;c.fillText(modes.ico+' '+modes.name,t.x,t.y-44);}
  }
}
function drawTowerFallback(c,t,def,lvl){
  const s=1+0.07*(lvl-1);
  c.save();c.translate(t.x,t.y);c.scale(s,s);
  oShape(c,lvl<=2?'#93805c':'#a6a0b4',cc=>{cc.rect(-13,-12,26,22);});
  oShape(c,def.hue,cc=>{cc.arc(0,-22,8,0,7);});
  c.restore();
}

/* ---------- enemies ---------- */
function drawEnemy(c,e){
  const x=e.x,y=e.y,s=e.size,def=e.def;
  const bob=Math.sin(e.anim*6)*(e.def.fly?3:1.5);
  c.save();c.translate(x,y);
  if(e.def.fly){c.fillStyle='rgba(0,0,0,0.16)';c.beginPath();c.ellipse(0,s*0.55,s*0.6,s*0.2,0,0,7);c.fill();}
  else{c.fillStyle='rgba(0,0,0,0.28)';c.beginPath();c.ellipse(0,s*0.55,s*0.9,s*0.32,0,0,7);c.fill();}
  if(e.rarity){
    const col=e.rarity==='champ'?'255,215,94':'200,139,255';
    const pu=0.35+Math.sin(G.time*5)*0.12;
    c.fillStyle='rgba('+col+','+pu+')';
    c.beginPath();c.ellipse(0,s*0.5,s*1.2,s*0.45,0,0,7);c.fill();
  }
  if(e.boss){
    const pu=0.3+Math.sin(G.time*4)*0.1;
    c.strokeStyle='rgba(255,90,90,'+pu+')';c.lineWidth=3;
    c.beginPath();c.ellipse(0,s*0.55,s*1.35,s*0.5,0,0,7);c.stroke();
  }
  if(def.event==='calamity'){
    const pu2=0.4+Math.sin(G.time*6)*0.2;
    c.strokeStyle='rgba(255,60,40,'+pu2+')';c.lineWidth=4;
    c.beginPath();c.ellipse(0,s*0.55,s*1.65,s*0.62,0,0,7);c.stroke();
    c.globalCompositeOperation='lighter';
    c.fillStyle='rgba(255,80,50,'+(pu2*0.22)+')';
    c.beginPath();c.ellipse(0,0,s*1.5,s*1.6,0,0,7);c.fill();
    c.globalCompositeOperation='source-over';
  }
  if(e.def.event==='boar'){
    const pu=0.4+Math.sin(G.time*6)*0.15;
    c.fillStyle='rgba(255,215,94,'+pu+')';
    c.beginPath();c.ellipse(0,s*0.5,s*1.25,s*0.5,0,0,7);c.fill();
  }
  if(e.def.event==='warden'){
    const pu=0.35+Math.sin(G.time*3)*0.12;
    c.strokeStyle='rgba(150,90,220,'+pu+')';c.lineWidth=3;
    c.beginPath();c.ellipse(0,s*0.55,s*1.35,s*0.5,0,0,7);c.stroke();
  }
  c.translate(0,bob+(def.fly?-18:0));
  const frozen=e.slowP>=0.95;
  if(def.kind==='flyer'){
    const w=Math.sin(e.anim*12)*s*0.55;
    for(const sd of [-1,1]){
      oShape(c,shade(def.col,-16),cc=>{
        cc.moveTo(sd*s*0.3,-s*0.25);
        cc.quadraticCurveTo(sd*s*1.5,-s*0.9-w,sd*s*1.35,-s*0.05+w*0.4);
        cc.quadraticCurveTo(sd*s*0.9,-s*0.05,sd*s*0.3,s*0.1);
        cc.closePath();
      });
      c.strokeStyle=shade(def.col,-48);c.lineWidth=1.5;
      c.beginPath();c.moveTo(sd*s*0.4,-s*0.2);c.quadraticCurveTo(sd*s*0.95,-s*0.5-w*0.6,sd*s*1.2,-s*0.35-w*0.8);c.stroke();
    }
    oShape(c,def.col,cc=>{cc.ellipse(0,0,s*0.55,s*0.42,0,0,7);});
    c.fillStyle=shade(def.col,-24);
    c.beginPath();c.ellipse(0,s*0.12,s*0.48,s*0.2,0,0,Math.PI);c.fill();
    oShape(c,shade(def.col,14),cc=>{cc.arc(s*0.45,-s*0.25,s*0.3,0,7);});
    if(def.armor>=0.3){
      c.fillStyle='rgba(200,205,220,0.55)';
      c.beginPath();c.ellipse(0,-s*0.05,s*0.45,s*0.3,0,0,7);c.fill();
    }
    c.fillStyle='#ffd75e';
    c.beginPath();c.arc(s*0.55,-s*0.3,1.8,0,7);c.fill();
    for(const sd of [-1,1]){
      c.fillStyle=shade(def.col,-30);
      c.beginPath();c.moveTo(sd*s*0.2,-s*0.5);c.lineTo(sd*s*0.32,-s*0.85);c.lineTo(sd*s*0.42,-s*0.5);c.closePath();c.fill();
    }
  }else if(def.kind==='beast'){
    const leg=frozen?0:Math.sin(e.anim*8)*3;
    c.strokeStyle=OUT;c.lineWidth=3.5;
    c.beginPath();c.moveTo(-s*0.5,0);c.lineTo(-s*0.5+leg,s*0.7);c.moveTo(s*0.4,0);c.lineTo(s*0.4-leg,s*0.7);c.stroke();
    c.strokeStyle='#5a5f68';c.lineWidth=2;
    c.beginPath();c.moveTo(-s*0.5,0);c.lineTo(-s*0.5+leg,s*0.7);c.moveTo(s*0.4,0);c.lineTo(s*0.4-leg,s*0.7);c.stroke();
    oShape(c,def.col,cc=>{cc.ellipse(0,0,s,s*0.5,0,0,7);});
    c.fillStyle=shade(def.col,-24);
    c.beginPath();c.ellipse(0,s*0.16,s*0.92,s*0.3,0,0,Math.PI);c.fill();
    oShape(c,def.col,cc=>{cc.arc(s*0.9,-s*0.2,s*0.42,0,7);});
    oShape(c,'#6a6f78',cc=>{cc.moveTo(s*0.8,-s*0.55);cc.lineTo(s*0.95,-s*0.9);cc.lineTo(s*1.05,-s*0.5);cc.closePath();});
    c.fillStyle='#ff5a5a';c.beginPath();c.arc(s*1.05,-s*0.25,1.6,0,7);c.fill();
    c.strokeStyle=OUT;c.lineWidth=4;
    c.beginPath();c.moveTo(-s,0);c.quadraticCurveTo(-s*1.4,-s*0.4,-s*1.5,-s*0.1);c.stroke();
    c.strokeStyle=def.col;c.lineWidth=2.5;
    c.beginPath();c.moveTo(-s,0);c.quadraticCurveTo(-s*1.4,-s*0.4,-s*1.5,-s*0.1);c.stroke();
  }else if(def.kind==='ghost'){
    const fl=Math.sin(e.anim*4)*2;
    c.globalAlpha=0.85;
    oShape(c,def.col,cc=>{
      cc.arc(0,-s*0.5+fl,s*0.7,Math.PI,0);
      cc.lineTo(s*0.7,s*0.3+fl);
      for(let i=2;i>=-2;i--)cc.lineTo(i*s*0.35,s*0.3+fl+((i%2)?-3:3));
      cc.closePath();
    });
    c.fillStyle='rgba(255,255,255,0.25)';
    c.beginPath();c.ellipse(-s*0.25,-s*0.65+fl,s*0.22,s*0.3,0,0,7);c.fill();
    c.fillStyle='#1a1826';
    c.beginPath();c.arc(-s*0.25,-s*0.5+fl,2.2,0,7);c.fill();
    c.beginPath();c.arc(s*0.25,-s*0.5+fl,2.2,0,7);c.fill();
    if(def.id==='harpy'){
      c.globalAlpha=1;
      const w=Math.sin(e.anim*10)*s*0.5;
      oShape(c,'#b05a6a',cc=>{cc.moveTo(-s*0.4,-s*0.4);cc.quadraticCurveTo(-s*1.4,-s*0.8-w,-s*1.2,-s*0.1);cc.closePath();});
      oShape(c,'#b05a6a',cc=>{cc.moveTo(s*0.4,-s*0.4);cc.quadraticCurveTo(s*1.4,-s*0.8-w,s*1.2,-s*0.1);cc.closePath();});
    }
    c.globalAlpha=1;
  }else if(def.kind==='drake'){
    const w=Math.sin(e.anim*7)*s*0.4;
    oShape(c,'#8a2a1a',cc=>{cc.moveTo(-s*0.3,-s*0.5);cc.quadraticCurveTo(-s*1.6,-s*1.1-w,-s*1.3,0);cc.closePath();});
    oShape(c,'#8a2a1a',cc=>{cc.moveTo(s*0.3,-s*0.5);cc.quadraticCurveTo(s*1.6,-s*1.1-w,s*1.3,0);cc.closePath();});
    oShape(c,def.col,cc=>{cc.ellipse(0,0,s*0.85,s*0.6,0,0,7);});
    c.fillStyle=shade(def.col,-26);
    c.beginPath();c.ellipse(0,s*0.2,s*0.78,s*0.34,0,0,Math.PI);c.fill();
    oShape(c,def.col,cc=>{cc.arc(s*0.7,-s*0.5,s*0.4,0,7);});
    c.fillStyle='#ffd75e';c.beginPath();c.arc(s*0.82,-s*0.55,2.5,0,7);c.fill();
    c.strokeStyle=OUT;c.lineWidth=5.5;
    c.beginPath();c.moveTo(-s*0.8,0);c.quadraticCurveTo(-s*1.5,s*0.3,-s*1.7,-s*0.2);c.stroke();
    c.strokeStyle=def.col;c.lineWidth=3.5;c.stroke();
    const fl2=Math.sin(e.anim*9);
    c.fillStyle='rgba(255,122,42,'+(0.5+fl2*0.2)+')';
    c.beginPath();c.arc(s*1.05,-s*0.45,3+fl2,0,7);c.fill();
  }else{
    const leg=frozen?0:Math.sin(e.anim*8)*(def.kind==='big'?2:3);
    c.strokeStyle=OUT;c.lineWidth=def.kind==='big'?5:3.5;
    c.beginPath();c.moveTo(-s*0.25,s*0.2);c.lineTo(-s*0.25-leg,s*0.85);
    c.moveTo(s*0.25,s*0.2);c.lineTo(s*0.25+leg,s*0.85);c.stroke();
    c.strokeStyle=shade(def.col,-40);c.lineWidth=def.kind==='big'?3:2;
    c.beginPath();c.moveTo(-s*0.25,s*0.2);c.lineTo(-s*0.25-leg,s*0.85);
    c.moveTo(s*0.25,s*0.2);c.lineTo(s*0.25+leg,s*0.85);c.stroke();
    oShape(c,def.col,cc=>{cc.ellipse(0,-s*0.1,s*0.62,s*0.72,0,0,7);});
    c.fillStyle=shade(def.col,-24);
    c.beginPath();c.ellipse(0,s*0.18,s*0.55,s*0.38,0,0,Math.PI);c.fill();
    c.fillStyle='rgba(255,255,255,0.18)';
    c.beginPath();c.ellipse(-s*0.2,-s*0.4,s*0.22,s*0.28,0,0,7);c.fill();
    const hcol=def.id==='skel'||def.id==='armskel'?'#e8e4d4':shade(def.col,18);
    oShape(c,hcol,cc=>{cc.arc(0,-s*0.95,s*0.4,0,7);});
    c.fillStyle=def.id==='skel'||def.id==='armskel'?'#2a2733':(e.boss?'#ffd75e':'#1a1826');
    c.beginPath();c.arc(-s*0.14,-s*0.98,s*0.08,0,7);c.fill();
    c.beginPath();c.arc(s*0.14,-s*0.98,s*0.08,0,7);c.fill();
    if(def.armor>=0.4){
      oShape(c,'rgba(200,205,220,0.9)',cc=>{cc.ellipse(0,-s*0.2,s*0.55,s*0.5,0,0,7);});
      oShape(c,'rgba(130,135,155,0.95)',cc=>{cc.arc(0,-s*0.95,s*0.42,Math.PI*0.95,Math.PI*2.05);});
    }
    const sw=e.blk?Math.sin(G.time*10)*0.5:0.2;
    c.save();c.translate(s*0.55,-s*0.3);c.rotate(0.6+sw);
    if(def.kind==='big'){
      oShape(c,'#6b4a2a',cc=>{cc.rect(-2,-s*1.1,5,s*1.2);});
      oShape(c,'#8a8578',cc=>{cc.arc(0.5,-s*1.1,s*0.28,0,7);});
    }else{
      c.strokeStyle=OUT;c.lineWidth=4;
      c.beginPath();c.moveTo(0,2);c.lineTo(0,-s*0.9);c.stroke();
      c.strokeStyle='#c8ccd8';c.lineWidth=2.2;c.stroke();
      c.strokeStyle='#6b4a2a';c.lineWidth=3;
      c.beginPath();c.moveTo(-3,0);c.lineTo(3,0);c.stroke();
    }
    c.restore();
    if(def.healer){
      const pu=0.4+Math.sin(G.time*6)*0.2;
      c.fillStyle='rgba(200,139,224,'+pu+')';
      c.beginPath();c.arc(0,-s*1.5,3,0,7);c.fill();
    }
  }
  /* hit flash */
  if(e.flash>0){
    c.globalAlpha=Math.min(1,e.flash*7);
    c.fillStyle='#fff';
    c.beginPath();c.ellipse(0,-s*0.2,s*0.75,s*0.85,0,0,7);c.fill();
    c.globalAlpha=1;
  }
  if(frozen){
    c.globalAlpha=0.4;c.fillStyle='#aee6ff';
    c.beginPath();c.ellipse(0,-s*0.2,s*0.75,s*0.9,0,0,7);c.fill();
    c.globalAlpha=1;
  }
  c.restore();
  /* event flair (world coords) */
  if(e.def.event==='warden'&&e.captive){
    const hcol=HERO_BY[e.captive]?HERO_BY[e.captive].col:'#ffd75e';
    const a=G.time*2.4;
    const ox=x+Math.cos(a)*s*1.3,oy=y-s-12+Math.sin(a*1.7)*4;
    c.globalCompositeOperation='lighter';
    c.fillStyle=hcol;c.globalAlpha=0.4;
    c.beginPath();c.arc(ox,oy,8,0,7);c.fill();
    c.globalAlpha=0.9;
    c.beginPath();c.arc(ox,oy,4,0,7);c.fill();
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }
  if(e.def.event==='boar'&&Math.random()<0.3){
    const sx2=x+rnd(-s,s),sy2=y-rnd(0,s*1.5);
    c.fillStyle='rgba(255,240,170,0.9)';
    c.beginPath();
    c.moveTo(sx2,sy2-3);c.lineTo(sx2+2,sy2);c.lineTo(sx2,sy2+3);c.lineTo(sx2-2,sy2);
    c.closePath();c.fill();
  }
  /* status */
  if(e.slowT>0&&!frozen){c.fillStyle='#aee6ff';c.font='9px sans-serif';c.textAlign='center';c.fillText('❄',x-10,y-s-8);}
  if(e.burnT>0){c.fillStyle='#ff9a3a';c.font='9px sans-serif';c.textAlign='center';c.fillText('🔥',x+10,y-s-8);}
  if(e.poison.length){c.fillStyle='#8ee05a';c.beginPath();c.arc(x,y-s-10,2.5,0,7);c.fill();}
  if(e.hp<e.maxHp){
    const w=Math.max(18,s*2),pct=e.hp/e.maxHp;
    c.fillStyle='rgba(0,0,0,0.55)';c.fillRect(x-w/2-1,y-s-17,w+2,6);
    c.fillStyle=pct>0.5?'#6ad06a':pct>0.25?'#e8c93a':'#e05a5a';
    c.fillRect(x-w/2,y-s-16,w*pct,4);
  }
}

/* ---------- troops ---------- */
const TROOP_COLS={militia:'#8a9aa8',archer:'#5d8a4a',sword:'#6a7ca8',spear:'#8a7ca0',xbow:'#4a7a6a',
  berserker:'#b06a3a',knight:'#9aa4c0',mage:'#7a5ac0',cleric:'#e8e0c8',cavalry:'#a8845a',paladin:'#e0d090',giant:'#7a8a90',
  templar:'#e8ce6a',stormcaller:'#7ab8e8',footman:'#a08a6a',ranger:'#4a8a5a',wargolem:'#8a9098',skeleton:'#cfd8c8',
  thrall:'#7ec244',aeonchamp:'#ffcf9a'};
function drawTroop(c,tr){
  const def=TROOP_BY[tr.id],col=TROOP_COLS[tr.id]||'#8aa';
  const s=def.id==='giant'?16:def.id==='wargolem'?15:10;
  const x=tr.x,y=tr.y;
  const walk=tr.state==='walk'?Math.sin(tr.anim*8)*3:0;
  c.save();c.translate(x,y);
  c.fillStyle='rgba(0,0,0,0.28)';c.beginPath();c.ellipse(0,s*0.55,s*0.8,s*0.3,0,0,7);c.fill();
  if(G.shieldT>0){
    c.strokeStyle='rgba(255,225,150,0.5)';c.lineWidth=2;
    c.beginPath();c.ellipse(0,s*0.5,s*0.95,s*0.38,0,0,7);c.stroke();
  }
  if(def.id==='cavalry'){
    const leg=Math.sin(tr.anim*10)*4;
    c.strokeStyle=OUT;c.lineWidth=3.8;
    c.beginPath();c.moveTo(-6,2);c.lineTo(-6+leg,10);c.moveTo(6,2);c.lineTo(6-leg,10);c.stroke();
    c.strokeStyle='#7a5a3a';c.lineWidth=2.2;c.stroke();
    oShape(c,'#8a6a44',cc=>{cc.ellipse(0,0,11,5.5,0,0,7);});
    oShape(c,'#8a6a44',cc=>{cc.arc(10*tr.face,-4,4,0,7);});
    oShape(c,col,cc=>{cc.arc(0,-9,4.5,0,7);});
    oShape(c,'#d8ccb0',cc=>{cc.arc(0,-14,3,0,7);});
    c.strokeStyle=OUT;c.lineWidth=3.4;
    c.beginPath();c.moveTo(4*tr.face,-8);c.lineTo(10*tr.face,-14-(tr.swing>0?4:0));c.stroke();
    c.strokeStyle='#c8ccd8';c.lineWidth=1.8;c.stroke();
  }else{
    c.strokeStyle=OUT;c.lineWidth=s<12?3.4:5;
    c.beginPath();c.moveTo(-s*0.22,s*0.15);c.lineTo(-s*0.22-walk,s*0.8);
    c.moveTo(s*0.22,s*0.15);c.lineTo(s*0.22+walk,s*0.8);c.stroke();
    c.strokeStyle=shade(col,-45);c.lineWidth=s<12?1.8:3;c.stroke();
    oShape(c,col,cc=>{cc.ellipse(0,-s*0.15,s*0.55,s*0.65,0,0,7);});
    c.fillStyle=shade(col,-24);
    c.beginPath();c.ellipse(0,s*0.1,s*0.48,s*0.32,0,0,Math.PI);c.fill();
    c.fillStyle='rgba(255,255,255,0.2)';
    c.beginPath();c.ellipse(-s*0.16,-s*0.38,s*0.18,s*0.24,0,0,7);c.fill();
    oShape(c,'#d8ccb0',cc=>{cc.arc(0,-s*0.95,s*0.36,0,7);});
    if(def.armor){
      oShape(c,'#c0c6d8',cc=>{cc.arc(0,-s*0.98,s*0.38,Math.PI*0.9,Math.PI*2.1);});
      c.fillStyle='#c0c6d8';c.fillRect(-s*0.38,-s*0.98,s*0.76,s*0.14);
    }
    const sw=tr.swing>0?-0.9:0.3;
    c.save();c.translate(s*0.5*tr.face,-s*0.35);c.rotate((0.5+sw)*tr.face);
    if(def.melee){
      if(def.id==='giant'){
        oShape(c,'#6b4a2a',cc=>{cc.rect(-2.5,-s*1.2,6,s*1.3);});
        oShape(c,'#8a8578',cc=>{cc.arc(0.5,-s*1.2,s*0.3,0,7);});
      }else if(def.id==='spear'){
        c.strokeStyle=OUT;c.lineWidth=3.4;
        c.beginPath();c.moveTo(0,4);c.lineTo(0,-s*1.4);c.stroke();
        c.strokeStyle='#8a6f45';c.lineWidth=1.8;c.stroke();
        oShape(c,'#c8ccd8',cc=>{cc.moveTo(-2.5,-s*1.4);cc.lineTo(2.5,-s*1.4);cc.lineTo(0,-s*1.75);cc.closePath();});
      }else{
        c.strokeStyle=OUT;c.lineWidth=3.6;
        c.beginPath();c.moveTo(0,2);c.lineTo(0,-s*0.95);c.stroke();
        c.strokeStyle='#dde2ee';c.lineWidth=2;c.stroke();
        c.strokeStyle='#6b4a2a';c.lineWidth=2.6;
        c.beginPath();c.moveTo(-3,0);c.lineTo(3,0);c.stroke();
      }
    }else if(def.id==='mage'){
      c.strokeStyle=OUT;c.lineWidth=3.2;
      c.beginPath();c.moveTo(0,4);c.lineTo(0,-s*1.2);c.stroke();
      c.strokeStyle='#6b4a2a';c.lineWidth=1.8;c.stroke();
      oShape(c,'#c88bff',cc=>{cc.arc(0,-s*1.25,3,0,7);});
    }else if(def.id==='cleric'){
      c.strokeStyle=OUT;c.lineWidth=3.8;
      c.beginPath();c.moveTo(0,2);c.lineTo(0,-s*1.0);c.moveTo(-3,-s*0.75);c.lineTo(3,-s*0.75);c.stroke();
      c.strokeStyle='#e8c93a';c.lineWidth=2.2;c.stroke();
    }else{
      c.strokeStyle=OUT;c.lineWidth=3.2;
      c.beginPath();c.arc(2,-s*0.5,s*0.5,-1.2,1.2);c.stroke();
      c.strokeStyle='#8a6f45';c.lineWidth=1.8;c.stroke();
    }
    c.restore();
    if(def.armor){
      oShape(c,'#7a84a8',cc=>{cc.ellipse(-s*0.5*tr.face,-s*0.25,s*0.25,s*0.4,0,0,7);});
    }
  }
  if(tr.flash>0){
    c.globalAlpha=Math.min(1,tr.flash*7);
    c.fillStyle='#fff';
    c.beginPath();c.ellipse(0,-s*0.2,s*0.7,s*0.8,0,0,7);c.fill();
    c.globalAlpha=1;
  }
  c.restore();
  if(tr.hp<tr.maxHp){
    const w=20,pct=clamp(tr.hp/tr.maxHp,0,1);
    c.fillStyle='rgba(0,0,0,0.55)';c.fillRect(x-w/2-1,y-s-15,w+2,5);
    c.fillStyle='#5aa8e0';c.fillRect(x-w/2,y-s-14,w*pct,3);
  }
}

/* ---------- heroes ---------- */
function drawHeroU(c,h){
  if(h.dead||!h.recruited)return;
  const def=h.hdef;
  const tier=Math.min(4,Math.floor((h.lvl-1)/5));
  const armorCol=tier>=2?shade(def.col,20+tier*8):def.col;
  const s=def.id==='karrgoth'?16:def.id==='drake'?15:def.id==='bjorn'?15:def.id==='garrick'?15:def.id==='aurelia'?14:def.id==='lich'?14:def.id==='nyx'?11:13;
  const x=h.x,y=h.y;
  const moving=Math.abs(h.x-h.homeX)+Math.abs(h.y-h.homeY)>6;
  const walk=moving?Math.sin(h.anim*8)*3:0;
  c.save();c.translate(x,y);
  c.fillStyle='rgba(0,0,0,0.3)';c.beginPath();c.ellipse(0,s*0.55,s*0.85,s*0.32,0,0,7);c.fill();
  const pu=0.25+Math.sin(G.time*4)*0.1;
  c.strokeStyle=def.col;c.globalAlpha=pu;c.lineWidth=2;
  c.beginPath();c.ellipse(0,s*0.5,s*1.1,s*0.4,0,0,7);c.stroke();
  c.globalAlpha=1;
  if(def.legendary||h.asc){
    const p2=0.3+Math.sin(G.time*3.2)*0.15;
    c.strokeStyle='rgba(255,215,94,'+p2+')';c.lineWidth=2;
    c.beginPath();c.ellipse(0,s*0.5,s*1.4,s*0.52,0,0,7);c.stroke();
    c.beginPath();c.ellipse(0,s*0.5,s*1.75,s*0.64,0,0,7);c.stroke();
  }
  if(h.divine){
    const p4=0.35+Math.sin(G.time*4.2)*0.18;
    c.strokeStyle='rgba(255,80,60,'+p4+')';c.lineWidth=2.5;
    c.beginPath();c.ellipse(0,s*0.5,s*2.0,s*0.72,0,0,7);c.stroke();
    c.globalCompositeOperation='lighter';
    c.fillStyle='rgba(255,90,60,'+(p4*0.16)+')';
    c.beginPath();c.ellipse(0,-s*0.3,s*1.5,s*1.7,0,0,7);c.fill();
    c.globalCompositeOperation='source-over';
  }
  /* cape */
  oShape(c,def.cape,cc=>{
    cc.moveTo(-s*0.3*h.face,-s*0.7);
    cc.quadraticCurveTo(-s*1.1*h.face,-s*0.1+Math.sin(h.anim*6)*2,-s*0.7*h.face,s*0.6);
    cc.lineTo(-s*0.1*h.face,-s*0.1);cc.closePath();
  });
  /* legs */
  c.strokeStyle=OUT;c.lineWidth=4.4;
  c.beginPath();c.moveTo(-s*0.2,s*0.1);c.lineTo(-s*0.2-walk,s*0.8);
  c.moveTo(s*0.2,s*0.1);c.lineTo(s*0.2+walk,s*0.8);c.stroke();
  c.strokeStyle='#3a4050';c.lineWidth=2.6;c.stroke();
  /* body */
  oShape(c,armorCol,cc=>{cc.ellipse(0,-s*0.2,s*0.55,s*0.68,0,0,7);});
  c.fillStyle=shade(armorCol,-28);
  c.beginPath();c.ellipse(0,s*0.05,s*0.48,s*0.34,0,0,Math.PI);c.fill();
  c.fillStyle='rgba(255,255,255,0.3)';
  c.beginPath();c.ellipse(-s*0.15,-s*0.4,s*0.2,s*0.3,0,0,7);c.fill();
  /* head per class */
  if(def.id==='aldric'){
    if(REEFY()){
      /* Porous Pete: rounded porous sponge head with a grin */
      oShape(c,'#f2d94e',cc=>{
        const r=s*0.52;
        cc.moveTo(-r+3,-s*1.4);
        cc.arcTo(r,-s*1.4,r,-s*0.5,3);cc.arcTo(r,-s*0.5,-r,-s*0.5,3);
        cc.arcTo(-r,-s*0.5,-r,-s*1.4,3);cc.arcTo(-r,-s*1.4,r,-s*1.4,3);
        cc.closePath();
      });
      c.fillStyle='rgba(180,150,30,0.7)';
      c.beginPath();c.arc(-s*0.3,-s*1.22,s*0.09,0,7);c.fill();
      c.beginPath();c.arc(s*0.33,-s*0.72,s*0.08,0,7);c.fill();
      c.fillStyle='#fff';
      c.beginPath();c.arc(-s*0.16,-s*1.02,s*0.13,0,7);c.arc(s*0.16,-s*1.02,s*0.13,0,7);c.fill();
      c.fillStyle='#2a5a8a';
      c.beginPath();c.arc(-s*0.13,-s*1.0,s*0.06,0,7);c.arc(s*0.19,-s*1.0,s*0.06,0,7);c.fill();
      c.strokeStyle=OUT;c.lineWidth=1.4;
      c.beginPath();c.arc(0,-s*0.85,s*0.22,0.3,Math.PI-0.3);c.stroke();
    }else{
      oShape(c,shade(armorCol,-20),cc=>{cc.arc(0,-s*0.98,s*0.4,0,7);});
      c.fillStyle='#1a1826';c.fillRect(-s*0.28,-s*1.08,s*0.56,s*0.16);
      oShape(c,def.cape,cc=>{cc.ellipse(0,-s*1.45,s*0.12,s*0.3,0,0,7);});
    }
  }else if(def.id==='lyra'){
    oShape(c,'#3a7a44',cc=>{cc.arc(0,-s*0.98,s*0.42,Math.PI*0.85,Math.PI*2.15);cc.closePath();});
    oShape(c,'#e8c8a0',cc=>{cc.arc(0,-s*0.92,s*0.3,0,7);});
    c.strokeStyle='#c9a227';c.lineWidth=2;
    c.beginPath();c.moveTo(s*0.25,-s*0.8);c.quadraticCurveTo(s*0.5,-s*0.4,s*0.35,-s*0.1);c.stroke();
  }else if(def.id==='magnus'){
    oShape(c,'#8a2a1a',cc=>{cc.moveTo(-s*0.5,-s*1.05);cc.lineTo(s*0.5,-s*1.05);cc.lineTo(s*0.05,-s*1.85);cc.closePath();});
    oShape(c,'#e8c8a0',cc=>{cc.arc(0,-s*0.9,s*0.3,0,7);});
    c.fillStyle='#e8e4d4';
    c.beginPath();c.moveTo(-s*0.2,-s*0.75);c.quadraticCurveTo(0,-s*0.2,s*0.2,-s*0.75);c.closePath();c.fill();
    c.fillStyle='#ffd75e';c.beginPath();c.arc(-s*0.12,-s*0.95,1.5,0,7);c.fill();c.beginPath();c.arc(s*0.12,-s*0.95,1.5,0,7);c.fill();
  }else if(def.id==='celeste'){
    oShape(c,'#e8c8a0',cc=>{cc.arc(0,-s*0.95,s*0.34,0,7);});
    c.strokeStyle='rgba(255,232,168,0.9)';c.lineWidth=2.5;
    c.beginPath();c.ellipse(0,-s*1.35,s*0.3,s*0.12,0,0,7);c.stroke();
    oShape(c,'#e8c93a',cc=>{cc.arc(0,-s*1.12,s*0.1,0,7);});
  }else if(def.id==='bjorn'){
    oShape(c,'#8a8090',cc=>{cc.arc(0,-s*0.95,s*0.4,0,7);});
    oShape(c,'#e8e4d4',cc=>{cc.moveTo(-s*0.35,-s*1.1);cc.quadraticCurveTo(-s*0.75,-s*1.5,-s*0.5,-s*1.7);cc.lineTo(-s*0.3,-s*1.25);cc.closePath();});
    oShape(c,'#e8e4d4',cc=>{cc.moveTo(s*0.35,-s*1.1);cc.quadraticCurveTo(s*0.75,-s*1.5,s*0.5,-s*1.7);cc.lineTo(s*0.3,-s*1.25);cc.closePath();});
    c.fillStyle='#b0623c';
    c.beginPath();c.ellipse(0,-s*0.68,s*0.3,s*0.18,0,0,7);c.fill();
  }else if(def.id==='nyx'){
    oShape(c,'#2a2440',cc=>{cc.arc(0,-s*0.98,s*0.4,Math.PI*0.8,Math.PI*2.2);cc.closePath();});
    c.fillStyle='#c88bff';
    c.beginPath();c.arc(-s*0.14,-s*0.95,s*0.09,0,7);c.fill();
    c.beginPath();c.arc(s*0.14,-s*0.95,s*0.09,0,7);c.fill();
  }else if(def.id==='aurelia'){
    oShape(c,'#f4f0e4',cc=>{cc.arc(0,-s*0.95,s*0.38,0,7);});
    for(const sd of [-1,1]){
      oShape(c,'#ffd75e',cc=>{
        cc.moveTo(sd*s*0.3,-s*1.15);
        cc.quadraticCurveTo(sd*s*0.75,-s*1.5,sd*s*0.7,-s*1.85);
        cc.quadraticCurveTo(sd*s*0.45,-s*1.5,sd*s*0.22,-s*1.28);
        cc.closePath();
      });
    }
    c.strokeStyle='#c9a227';c.lineWidth=2;
    c.beginPath();c.moveTo(-s*0.3,-s*1.05);c.quadraticCurveTo(0,-s*1.2,s*0.3,-s*1.05);c.stroke();
    c.fillStyle='#1a1826';
    c.beginPath();c.arc(-s*0.13,-s*0.95,s*0.07,0,7);c.fill();
    c.beginPath();c.arc(s*0.13,-s*0.95,s*0.07,0,7);c.fill();
  }else if(def.id==='karrgoth'){
    oShape(c,'#d8ccb8',cc=>{cc.arc(0,-s*0.95,s*0.42,0,7);});
    for(const sd of [-1,1]){
      oShape(c,'#b04a2a',cc=>{
        cc.moveTo(sd*s*0.35,-s*1.1);
        cc.quadraticCurveTo(sd*s*0.9,-s*1.4,sd*s*0.85,-s*1.8);
        cc.quadraticCurveTo(sd*s*0.55,-s*1.45,sd*s*0.28,-s*1.22);
        cc.closePath();
      });
    }
    c.fillStyle='#181428';
    c.beginPath();c.ellipse(-s*0.15,-s*0.95,s*0.11,s*0.13,0,0,7);c.fill();
    c.beginPath();c.ellipse(s*0.15,-s*0.95,s*0.11,s*0.13,0,0,7);c.fill();
    c.fillStyle='#ffd08a';
    c.beginPath();c.arc(-s*0.15,-s*0.95,s*0.05,0,7);c.fill();
    c.beginPath();c.arc(s*0.15,-s*0.95,s*0.05,0,7);c.fill();
  }else if(def.id==='morrigan'){
    oShape(c,'#221c30',cc=>{cc.arc(0,-s*0.98,s*0.4,Math.PI*0.85,Math.PI*2.15);cc.closePath();});
    oShape(c,'#e8dce8',cc=>{cc.arc(0,-s*0.9,s*0.28,0,7);});
    for(const [fx2,fh] of [[-0.3,0.5],[-0.12,0.72],[0.06,0.8],[0.24,0.62]]){
      c.strokeStyle=OUT;c.lineWidth=2.6;
      c.beginPath();c.moveTo(fx2*s,-s*1.25);c.lineTo(fx2*s+s*0.05,-s*(1.25+fh));c.stroke();
      c.strokeStyle='#3a3050';c.lineWidth=1.4;c.stroke();
    }
    c.fillStyle='#e0b8ff';
    c.beginPath();c.arc(-s*0.12,-s*0.92,s*0.07,0,7);c.fill();
    c.beginPath();c.arc(s*0.12,-s*0.92,s*0.07,0,7);c.fill();
  }else if(def.id==='drake'){
    /* wings */
    for(const sd of [-1,1]){
      oShape(c,shade(def.col,-25),cc=>{
        cc.moveTo(sd*s*0.3,-s*0.55);
        cc.quadraticCurveTo(sd*s*1.5,-s*1.3+Math.sin(h.anim*7)*3,sd*s*1.7,-s*0.4);
        cc.quadraticCurveTo(sd*s*1.0,-s*0.55,sd*s*0.35,-s*0.15);
        cc.closePath();
      });
    }
    /* horned head + snout */
    oShape(c,def.col,cc=>{cc.arc(0,-s*0.95,s*0.4,0,7);});
    oShape(c,shade(def.col,25),cc=>{cc.moveTo(s*0.1*h.face,-s*0.95);cc.lineTo(s*0.75*h.face,-s*0.8);cc.lineTo(s*0.1*h.face,-s*0.68);cc.closePath();});
    for(const sd of [-1,1]){
      oShape(c,'#e8e4d4',cc=>{cc.moveTo(sd*s*0.22,-s*1.22);cc.lineTo(sd*s*0.5,-s*1.75);cc.lineTo(sd*s*0.05,-s*1.3);cc.closePath();});
    }
    c.fillStyle='#ffd75e';
    c.beginPath();c.arc(-s*0.14,-s*1.0,s*0.07,0,7);c.fill();
    c.beginPath();c.arc(s*0.14,-s*1.0,s*0.07,0,7);c.fill();
  }else if(def.id==='lich'){
    /* hooded skull with soul-fire eyes and a crown */
    oShape(c,'#0e1420',cc=>{cc.arc(0,-s*0.98,s*0.42,Math.PI*0.8,Math.PI*2.2);cc.closePath();});
    oShape(c,'#dfe6d2',cc=>{cc.arc(0,-s*0.92,s*0.3,0,7);});
    c.fillStyle='#0e1420';
    c.beginPath();c.ellipse(-s*0.12,-s*0.94,s*0.08,s*0.1,0,0,7);c.fill();
    c.beginPath();c.ellipse(s*0.12,-s*0.94,s*0.08,s*0.1,0,0,7);c.fill();
    c.fillStyle='#9fffb0';
    c.beginPath();c.arc(-s*0.12,-s*0.94,s*0.045,0,7);c.fill();
    c.beginPath();c.arc(s*0.12,-s*0.94,s*0.045,0,7);c.fill();
    c.strokeStyle='#c9a227';c.lineWidth=2;
    c.beginPath();c.moveTo(-s*0.3,-s*1.14);c.lineTo(-s*0.3,-s*1.34);c.moveTo(0,-s*1.2);c.lineTo(0,-s*1.46);c.moveTo(s*0.3,-s*1.14);c.lineTo(s*0.3,-s*1.34);c.stroke();
  }else if(def.id==='seraphine'){
    oShape(c,'#2a4a7a',cc=>{cc.arc(0,-s*0.98,s*0.42,Math.PI*0.85,Math.PI*2.15);cc.closePath();});
    oShape(c,'#e8d8c8',cc=>{cc.arc(0,-s*0.92,s*0.29,0,7);});
    c.strokeStyle='#8ad4ff';c.lineWidth=2;
    c.beginPath();c.moveTo(-s*0.3,-s*1.2);c.lineTo(-s*0.1,-s*1.32);c.lineTo(-s*0.18,-s*1.14);c.stroke();
    c.fillStyle='#8ad4ff';
    c.beginPath();c.arc(-s*0.11,-s*0.94,s*0.06,0,7);c.fill();
    c.beginPath();c.arc(s*0.11,-s*0.94,s*0.06,0,7);c.fill();
  }else if(def.id==='garrick'){
    oShape(c,'#b8bfcf',cc=>{cc.arc(0,-s*0.95,s*0.42,0,7);});
    c.fillStyle='#1a1826';c.fillRect(-s*0.3,-s*1.02,s*0.6,s*0.14);
    oShape(c,'#d8b45a',cc=>{cc.moveTo(-s*0.1,-s*1.34);cc.lineTo(s*0.34,-s*1.2);cc.lineTo(-s*0.1,-s*1.06);cc.closePath();});
    oShape(c,'#4a3f68',cc=>{cc.ellipse(-s*0.72*h.face,-s*0.25,s*0.3,s*0.5,0,0,7);});
    c.strokeStyle='#d8b45a';c.lineWidth=1.6;
    c.beginPath();c.ellipse(-s*0.72*h.face,-s*0.25,s*0.18,s*0.34,0,0,7);c.stroke();
  }
  /* weapon */
  const sw=h.swing>0?-1.4:0.4;
  c.save();c.translate(s*0.55*h.face,-s*0.35);c.rotate((0.5+sw)*h.face);
  if(def.id==='lyra'){
    c.strokeStyle=OUT;c.lineWidth=3.6;
    c.beginPath();c.arc(2,-s*0.4,s*0.6,-1.3,1.3);c.stroke();
    c.strokeStyle='#8a6f45';c.lineWidth=2;c.stroke();
    c.strokeStyle='#e8dcb0';c.lineWidth=1;
    c.beginPath();c.moveTo(2+Math.cos(-1.3)*s*0.6,-s*0.4+Math.sin(-1.3)*s*0.6);c.lineTo(2+Math.cos(1.3)*s*0.6,-s*0.4+Math.sin(1.3)*s*0.6);c.stroke();
  }else if(def.id==='magnus'||def.id==='celeste'||def.id==='morrigan'||def.id==='lich'||def.id==='seraphine'){
    c.strokeStyle=OUT;c.lineWidth=3.6;
    c.beginPath();c.moveTo(0,4);c.lineTo(0,-s*1.3);c.stroke();
    c.strokeStyle='#6b4a2a';c.lineWidth=2;c.stroke();
    const oc=def.id==='magnus'?'#ff9a5e':(def.id==='morrigan'?'#c88bff':def.id==='lich'?'#9fffb0':def.id==='seraphine'?'#8ad4ff':'#ffe8a8');
    c.fillStyle=oc;c.beginPath();c.arc(0,-s*1.35,3.5,0,7);c.fill();
    c.strokeStyle=OUT;c.lineWidth=1.5;c.stroke();
    c.fillStyle='rgba(255,255,255,0.6)';c.beginPath();c.arc(-1,-s*1.4,1.2,0,7);c.fill();
  }else if(def.id==='bjorn'||def.id==='karrgoth'){
    c.strokeStyle=OUT;c.lineWidth=4;
    c.beginPath();c.moveTo(0,4);c.lineTo(0,-s*1.1);c.stroke();
    c.strokeStyle='#6b4a2a';c.lineWidth=2.4;c.stroke();
    oShape(c,def.id==='karrgoth'?'#e07a3a':'#c8ccd8',cc=>{cc.moveTo(0,-s*1.1);cc.quadraticCurveTo(s*0.55,-s*1.15,s*0.5,-s*0.7);cc.quadraticCurveTo(s*0.2,-s*0.85,0,-s*0.8);cc.closePath();});
    if(def.id==='karrgoth'){
      c.strokeStyle='rgba(255,150,60,0.55)';c.lineWidth=5;
      c.beginPath();c.moveTo(0,-2);c.lineTo(0,-s*1.05);c.stroke();
    }
  }else if(def.id==='drake'){
    if(h.swing>0){
      c.fillStyle='rgba(255,150,60,0.75)';
      c.beginPath();c.arc(s*0.5,-s*0.5,s*0.32,0,7);c.fill();
      c.fillStyle='rgba(255,220,120,0.85)';
      c.beginPath();c.arc(s*0.62,-s*0.55,s*0.16,0,7);c.fill();
    }
  }else if(def.id==='nyx'){
    for(const off of [0,-s*0.35]){
      c.strokeStyle=OUT;c.lineWidth=3;
      c.beginPath();c.moveTo(off,2);c.lineTo(off,-s*0.75);c.stroke();
      c.strokeStyle='#d8c8f0';c.lineWidth=1.6;c.stroke();
    }
  }else if(REEFY()&&def.id==='aldric'){
    /* golden spatula */
    c.strokeStyle=OUT;c.lineWidth=4.2;
    c.beginPath();c.moveTo(0,2);c.lineTo(0,-s*0.85);c.stroke();
    c.strokeStyle='#6b4a2a';c.lineWidth=2.4;c.stroke();
    oShape(c,'#e8c34a',cc=>{
      cc.moveTo(-s*0.28,-s*0.85);cc.lineTo(s*0.28,-s*0.85);
      cc.lineTo(s*0.24,-s*1.45);cc.lineTo(-s*0.24,-s*1.45);
      cc.closePath();
    });
    if(tier>=2||def.legendary||h.asc){c.strokeStyle='rgba(255,215,94,0.6)';c.lineWidth=5;c.beginPath();c.moveTo(0,-s*0.9);c.lineTo(0,-s*1.4);c.stroke();}
    c.strokeStyle='rgba(20,14,26,0.5)';c.lineWidth=1.2;
    c.beginPath();c.moveTo(-s*0.09,-s*0.9);c.lineTo(-s*0.09,-s*1.4);c.moveTo(s*0.09,-s*0.9);c.lineTo(s*0.09,-s*1.4);c.stroke();
  }else{
    c.strokeStyle=OUT;c.lineWidth=4.4;
    c.beginPath();c.moveTo(0,2);c.lineTo(0,-s*1.3);c.stroke();
    c.strokeStyle='#f0f4ff';c.lineWidth=2.6;c.stroke();
    if(tier>=2||def.legendary||h.asc){c.strokeStyle='rgba(255,215,94,0.6)';c.lineWidth=6;c.beginPath();c.moveTo(0,-2);c.lineTo(0,-s*1.3);c.stroke();}
    c.strokeStyle='#c9a227';c.lineWidth=3;
    c.beginPath();c.moveTo(-4,0);c.lineTo(4,0);c.stroke();
  }
  c.restore();
  if(h.bulwarkT>0){
    const bw2=0.5+Math.sin(G.time*8)*0.15;
    c.strokeStyle='rgba(216,180,90,'+bw2+')';c.lineWidth=3;
    c.beginPath();c.arc(0,-s*0.3,s*1.25,0,7);c.stroke();
  }
  if(h.flash>0){
    c.globalAlpha=Math.min(1,h.flash*7);
    c.fillStyle='#fff';
    c.beginPath();c.ellipse(0,-s*0.2,s*0.7,s*0.8,0,0,7);c.fill();
    c.globalAlpha=1;
  }
  c.restore();
  const w=26,pct=clamp(h.hp/h.maxHp,0,1);
  c.fillStyle='rgba(0,0,0,0.55)';c.fillRect(x-w/2-1,y-s-17,w+2,6);
  c.fillStyle=def.col;c.fillRect(x-w/2,y-s-16,w*pct,4);
  /* skill-ready glint (also shown while re-checking for targets) */
  if(h.lvl>=def.skill.unlockLvl&&h.skillCd<=1.3){
    c.fillStyle='#ffd75e';c.font='bold 10px Georgia';c.textAlign='center';
    c.fillText('✦',x+w/2+6,y-s-11);
  }
}

/* ---------- projectiles & fx ---------- */
function drawProj(c,p){
  if(p.kind==='arrow'){
    c.save();c.translate(p.x,p.y);c.rotate(p.ang||0);
    c.strokeStyle=OUT;c.lineWidth=3.5;
    c.beginPath();c.moveTo(-6,0);c.lineTo(6,0);c.stroke();
    c.strokeStyle='#e8dcb0';c.lineWidth=1.8;c.stroke();
    c.fillStyle='#c8ccd8';c.beginPath();c.moveTo(7,0);c.lineTo(2,-2.5);c.lineTo(2,2.5);c.closePath();c.fill();
    c.restore();
  }else if(p.kind==='shard'){
    c.save();c.translate(p.x,p.y);c.rotate(p.ang||0);
    oShape(c,'#bfe9f7',cc=>{cc.moveTo(7,0);cc.lineTo(-5,-3);cc.lineTo(-5,3);cc.closePath();});
    c.restore();
  }else if(p.kind==='ball'){
    oShape(c,'#2f333d',cc=>{cc.arc(p.x,p.y,5,0,7);});
    c.fillStyle='rgba(255,176,42,0.7)';c.beginPath();c.arc(p.x-2,p.y-2,1.6,0,7);c.fill();
  }else if(p.kind==='glob'){
    oShape(c,'#8ee05a',cc=>{cc.arc(p.x,p.y,4.5,0,7);});
    c.fillStyle='#c8f0a0';c.beginPath();c.arc(p.x-1,p.y-1,1.6,0,7);c.fill();
  }else if(p.kind==='bolt'){
    c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(p.vy,p.vx));
    c.strokeStyle=OUT;c.lineWidth=5;
    c.beginPath();c.moveTo(-10,0);c.lineTo(8,0);c.stroke();
    c.strokeStyle='#a8743a';c.lineWidth=3;c.stroke();
    c.fillStyle='#e8e4d4';c.beginPath();c.moveTo(10,0);c.lineTo(4,-3);c.lineTo(4,3);c.closePath();c.fill();
    c.restore();
  }else if(p.kind==='tproj'||p.kind==='hproj'){
    c.fillStyle=p.col||'#e8dcb0';
    c.beginPath();c.arc(p.x,p.y,p.splash?4:2.5,0,7);c.fill();
    c.strokeStyle=OUT;c.lineWidth=1.4;c.stroke();
    if(p.splash){
      c.globalCompositeOperation='lighter';
      c.fillStyle='rgba(200,139,255,0.35)';c.beginPath();c.arc(p.x,p.y,8,0,7);c.fill();
      c.globalCompositeOperation='source-over';
    }
  }
}
function drawWall(c,w){
  const reef=REEFY();
  const len=46+w.lvl*3;
  c.save();c.translate(w.x,w.y);
  c.fillStyle='rgba(0,0,0,0.28)';
  c.beginPath();c.ellipse(0,5,len*0.55,8,0,0,7);c.fill();
  c.rotate(w.ang+Math.PI/2);
  const body=reef?'#b86a98':'#8d8798',edge=reef?'#7a3e64':'#4e4858',lite=reef?'#e0a0c8':'#c2bccc';
  c.fillStyle=body;c.strokeStyle=OUT;c.lineWidth=2;
  roundRect(c,-len/2,-9,len,18,4);c.fill();c.stroke();
  c.fillStyle=lite;
  roundRect(c,-len/2+2,-9,len-4,5,3);c.fill();
  c.strokeStyle='rgba(24,18,32,0.35)';c.lineWidth=1.2;
  for(let i=1;i<4;i++){const xx=-len/2+i*len/4;c.beginPath();c.moveTo(xx,-8);c.lineTo(xx,8);c.stroke();}
  /* battlements scale with level */
  c.fillStyle=edge;
  const teeth=2+Math.min(3,w.lvl);
  for(let i=0;i<teeth;i++){
    const xx=-len/2+4+i*(len-14)/(teeth-1);
    c.fillRect(xx,-14,6,6);
  }
  /* level pips */
  c.fillStyle='#ffd75e';
  for(let i=0;i<Math.min(5,w.lvl);i++)c.fillRect(-len/2+3+i*6,10,4,3);
  c.restore();
  if(w.flash>0){
    c.globalAlpha=Math.min(1,w.flash*7);c.fillStyle='#fff';
    c.beginPath();c.ellipse(w.x,w.y,len*0.5,12,0,0,7);c.fill();c.globalAlpha=1;
  }
  if(w.hp<w.maxHp){
    const bw=36,pct=clamp(w.hp/w.maxHp,0,1);
    c.fillStyle='rgba(10,8,18,0.75)';c.fillRect(w.x-bw/2,w.y-24,bw,5);
    c.fillStyle=pct>0.4?'#7ee08a':'#e05a5a';c.fillRect(w.x-bw/2+0.5,w.y-23.2,(bw-1)*pct,3.6);
  }
}
function drawChest(c,ch){
  const bob=Math.sin(G.time*3)*1.5;
  c.save();c.translate(ch.x,ch.y+bob);
  c.fillStyle='rgba(0,0,0,0.3)';c.beginPath();c.ellipse(0,10-bob,16,6,0,0,7);c.fill();
  c.globalCompositeOperation='lighter';
  c.fillStyle='rgba(255,215,94,'+(0.16+Math.sin(G.time*5)*0.07)+')';
  c.beginPath();c.arc(0,-2,22,0,7);c.fill();
  c.globalCompositeOperation='source-over';
  roundRect(c,-14,-6,28,14,3);c.fillStyle='#7a5230';c.fill();c.strokeStyle=OUT;c.lineWidth=2;c.stroke();
  roundRect(c,-15,-14,30,10,4);c.fillStyle='#8d6238';c.fill();c.stroke();
  c.fillStyle='#e8c34a';c.fillRect(-3,-14,6,22);
  c.strokeStyle='rgba(24,18,32,0.6)';c.lineWidth=1;c.strokeRect(-3,-14,6,22);
  c.fillStyle='#ffd75e';c.beginPath();c.arc(0,-3,3,0,7);c.fill();
  const frac=clamp(ch.t/ch.max,0,1);
  c.strokeStyle='rgba(255,215,94,0.85)';c.lineWidth=2.5;
  c.beginPath();c.arc(0,-2,20,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);c.stroke();
  for(let i=0;i<3;i++){
    const a=G.time*2.2+i*2.1;
    const sx=Math.cos(a)*15,sy=-8+Math.sin(a*1.3)*8;
    c.fillStyle='rgba(255,240,180,0.9)';
    c.fillRect(sx-1,sy-3,2,6);c.fillRect(sx-3,sy-1,6,2);
  }
  c.restore();
}
function drawFx(c,f){
  if(f.kind==='ring'){
    c.strokeStyle=f.col;c.globalAlpha=Math.max(0,f.life*2);c.lineWidth=3;
    if(f.curR===undefined)f.curR=f.r;
    f.curR=Math.min(f.maxR,f.curR+(f.maxR-f.r)*0.12);
    c.beginPath();c.arc(f.x,f.y,f.curR,0,7);c.stroke();
    c.globalAlpha=1;
  }else if(f.kind==='zap'){
    c.globalCompositeOperation='lighter';
    const zc=f.dark?'120,60,200':(f.col?hexToRgb(f.col):'190,150,255');
    c.strokeStyle='rgba('+zc+','+Math.max(0,f.life*5)+')';c.lineWidth=3;
    c.beginPath();
    for(let i=0;i<f.pts.length-1;i++){
      const a=f.pts[i],b=f.pts[i+1];
      c.moveTo(a.x,a.y);
      const mx=(a.x+b.x)/2+rnd(-6,6),my=(a.y+b.y)/2+rnd(-6,6);
      c.lineTo(mx,my);c.lineTo(b.x,b.y);
    }
    c.stroke();
    c.strokeStyle='rgba(255,255,255,'+Math.max(0,f.life*4)+')';c.lineWidth=1.2;
    c.stroke();
    c.globalCompositeOperation='source-over';
  }else if(f.kind==='heal'){
    c.fillStyle='rgba(120,230,140,'+Math.max(0,f.life*1.6)+')';
    c.font='12px sans-serif';c.textAlign='center';
    c.fillText('+',f.x,f.y-14-(0.5-Math.min(0.5,f.life))*24);
  }else if(f.kind==='slash'){
    c.strokeStyle=f.col||'rgba(255,138,106,0.9)';c.globalAlpha=Math.max(0,f.life*5);c.lineWidth=2.5;
    c.beginPath();c.moveTo(f.x-8,f.y-8);c.lineTo(f.x+8,f.y+8);
    c.moveTo(f.x+6,f.y-8);c.lineTo(f.x-6,f.y+8);c.stroke();
    c.globalAlpha=1;
  }else if(f.kind==='flag'){
    c.globalAlpha=Math.max(0,f.life);
    c.strokeStyle=f.col;c.lineWidth=2;
    c.beginPath();c.arc(f.x,f.y,14*(1-f.life)+6,0,7);c.stroke();
    c.globalAlpha=1;
  }else if(f.kind==='muzzle'){
    c.globalCompositeOperation='lighter';
    c.globalAlpha=Math.max(0,f.life*10);
    c.fillStyle=f.col;
    c.save();c.translate(f.x,f.y);c.rotate(f.ang);
    c.beginPath();c.moveTo(0,-3);c.lineTo(12,0);c.lineTo(0,3);c.closePath();c.fill();
    c.restore();
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }else if(f.kind==='meteor'){
    const t=f.t||0;
    if(t<0.22){
      const u=t/0.22;
      const mx=f.x+140*(1-u),my=f.y-260*(1-u);
      c.globalCompositeOperation='lighter';
      c.fillStyle='rgba(255,150,60,0.8)';
      c.beginPath();c.arc(mx,my,9,0,7);c.fill();
      c.fillStyle='rgba(255,220,120,0.9)';
      c.beginPath();c.arc(mx,my,5,0,7);c.fill();
      c.strokeStyle='rgba(255,150,60,0.4)';c.lineWidth=7;
      c.beginPath();c.moveTo(mx+30,my-56);c.lineTo(mx,my);c.stroke();
      c.globalCompositeOperation='source-over';
    }else{
      c.globalCompositeOperation='lighter';
      c.globalAlpha=Math.max(0,f.life);
      c.fillStyle='rgba(255,140,50,0.5)';
      c.beginPath();c.arc(f.x,f.y,40+(0.8-f.life)*90,0,7);c.fill();
      c.globalAlpha=1;c.globalCompositeOperation='source-over';
    }
  }else if(f.kind==='rainarrow'){
    const t=f.t||0,u=Math.min(1,t/0.25);
    const ay=f.y-90*(1-u);
    c.strokeStyle=OUT;c.lineWidth=3;
    c.save();c.translate(f.x,ay);c.rotate(Math.PI/2.3);
    c.beginPath();c.moveTo(-5,0);c.lineTo(5,0);c.stroke();
    c.strokeStyle='#e8dcb0';c.lineWidth=1.5;c.stroke();
    c.restore();
  }else if(f.kind==='die'){
    const u=1-f.life/0.6;
    c.globalAlpha=Math.max(0,f.life*1.5);
    c.fillStyle=f.col;
    c.beginPath();c.ellipse(f.x,f.y,f.size*(0.6+u*0.9),f.size*0.3*(1-u*0.5),0,0,7);c.fill();
    c.fillStyle='rgba(255,255,255,0.5)';
    c.beginPath();c.arc(f.x,f.y-u*26,3*(1-u),0,7);c.fill();
    c.globalAlpha=1;
  }else if(f.kind==='firestorm'){
    const t=f.t||0;
    c.globalCompositeOperation='lighter';
    if(t<0.7){
      for(let i=0;i<7;i++){
        const seed=(i*97+Math.floor(t*18)*13)%997;
        const rx=f.x+((seed*37)%(2*f.r))-f.r;
        const u=((t*2+i*0.13)%0.5)/0.5;
        const ry=f.y-170*(1-u);
        c.strokeStyle='rgba(255,150,60,'+(0.75*(1-u))+')';c.lineWidth=3;
        c.beginPath();c.moveTo(rx+12,ry-30);c.lineTo(rx,ry);c.stroke();
        c.fillStyle='rgba(255,220,120,'+(0.8*(1-u))+')';
        c.beginPath();c.arc(rx,ry,3,0,7);c.fill();
      }
    }
    c.globalAlpha=Math.max(0,f.life*0.55);
    c.fillStyle='rgba(255,120,40,0.55)';
    c.beginPath();c.ellipse(f.x,f.y,f.r,f.r*0.45,0,0,7);c.fill();
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }else if(f.kind==='ragnarok'){
    const t=f.t||0;
    c.globalCompositeOperation='lighter';
    c.fillStyle=(REEFY()?'rgba(180,240,235,':'rgba(200,225,255,')+Math.max(0,(f.life-0.5)*0.5)+')';
    c.fillRect(0,0,CFG.W,CFG.H);
    for(let i=0;i<6;i++){
      const bx=(i*263+Math.floor(t*22)*97)%CFG.W;
      c.strokeStyle=(REEFY()?'rgba(140,235,225,':'rgba(180,215,255,')+Math.max(0,f.life*0.55)+')';c.lineWidth=3;
      c.beginPath();
      let yy=0,xx=bx;
      c.moveTo(xx,0);
      while(yy<CFG.H-60){yy+=rnd(40,90);xx+=rnd(-45,45);c.lineTo(xx,yy);}
      c.stroke();
    }
    c.globalCompositeOperation='source-over';
  }else if(f.kind==='coinfly'){
    const u=Math.min(1,(f.t||0)/0.7);
    const e2=u*u;
    const cx=lerp(f.x,26,e2),cy=lerp(f.y,18,e2);
    c.fillStyle='#ffd75e';
    c.beginPath();c.arc(cx,cy,3.4,0,7);c.fill();
    c.strokeStyle='#c9a227';c.lineWidth=1;c.stroke();
    c.fillStyle='rgba(255,255,255,0.7)';
    c.beginPath();c.arc(cx-1,cy-1,1,0,7);c.fill();
  }
}

/* ---------- main frame ---------- */
function drawFrame(c,UIS){
  c.save();
  if(G.shake>0)c.translate(rnd(-G.shake,G.shake)*0.5,rnd(-G.shake,G.shake)*0.5);
  c.drawImage(getBG(),0,0);
  if(REEFY()){
    /* --- underwater ambience --- */
    c.fillStyle='rgba(18,80,120,0.16)';
    c.fillRect(0,0,CFG.W,CFG.H);
    for(let i=0;i<3;i++){ // drifting light rays
      const rx=200+i*420+Math.sin(G.time*0.22+i*2.1)*90;
      const grad=c.createLinearGradient(rx,0,rx+140,CFG.H);
      grad.addColorStop(0,'rgba(210,245,255,0.10)');
      grad.addColorStop(1,'rgba(210,245,255,0)');
      c.fillStyle=grad;
      c.beginPath();
      c.moveTo(rx,0);c.lineTo(rx+110,0);c.lineTo(rx+320,CFG.H);c.lineTo(rx+130,CFG.H);
      c.closePath();c.fill();
    }
    for(let i=0;i<(LOW_FX?7:14);i++){ // rising bubbles (procedural, stateless)
      const bx=((i*173+Math.floor(i/2)*89)%CFG.W)+Math.sin(G.time*0.8+i)*14;
      const by=CFG.H-((G.time*(16+(i%5)*7)+i*137)%(CFG.H+40))+20;
      const br=1.5+(i%3);
      c.strokeStyle='rgba(210,240,255,0.30)';c.lineWidth=1.2;
      c.beginPath();c.arc(bx,by,br,0,7);c.stroke();
      c.fillStyle='rgba(255,255,255,0.16)';
      c.beginPath();c.arc(bx-br*0.35,by-br*0.35,br*0.32,0,7);c.fill();
    }
  }
  drawCastleFlags(c,G.time);

  /* rally flags per path */
  for(let pi=0;pi<MAP.P.length;pi++){
    const p=posAt(pi,G.rally[pi]);
    c.strokeStyle='#5a4020';c.lineWidth=2;
    c.beginPath();c.moveTo(p.x,p.y-2);c.lineTo(p.x,p.y-22);c.stroke();
    const wav=Math.sin(G.time*5+pi)*2;
    c.fillStyle='#5aa8e0';
    c.beginPath();c.moveTo(p.x,p.y-22);c.lineTo(p.x+13,p.y-18+wav);c.lineTo(p.x,p.y-13);c.closePath();c.fill();
    c.strokeStyle='rgba(24,18,32,0.6)';c.lineWidth=1.2;c.stroke();
  }
  /* blessed ground zones */
  for(const z of G.zones){
    const pu=0.14+Math.sin(G.time*5)*0.05+0.08*Math.min(1,z.t);
    c.fillStyle='rgba(126,224,138,'+pu+')';
    c.beginPath();c.ellipse(z.x,z.y,z.r,z.r*0.45,0,0,7);c.fill();
    c.strokeStyle='rgba(126,224,138,0.55)';c.lineWidth=2;
    c.beginPath();c.ellipse(z.x,z.y,z.r,z.r*0.45,0,0,7);c.stroke();
    for(let i=0;i<3;i++){
      const a=G.time*1.3+i*2.1;
      const px2=z.x+Math.cos(a)*z.r*0.6,py2=z.y+Math.sin(a)*z.r*0.25-((G.time*22+i*30)%34);
      c.fillStyle='rgba(160,240,170,0.7)';
      c.fillRect(px2-1.2,py2-4,2.4,8);c.fillRect(px2-4,py2-1.2,8,2.4);
    }
  }
  /* selected hero home marker */
  if(G.selHero&&G.selHero.recruited&&!G.selHero.dead){
    c.strokeStyle=G.selHero.hdef.col;c.globalAlpha=0.5;c.lineWidth=1.5;
    c.beginPath();c.arc(G.selHero.homeX,G.selHero.homeY,9,0,7);c.stroke();
    c.globalAlpha=1;
  }

  /* treasure chest event */
  if(G.chest)drawChest(c,G.chest);

  /* build preview */
  const pvC=UIS.pendC>=0?UIS.pendC:UIS.hoverC;
  const pvR=UIS.pendC>=0?UIS.pendR:UIS.hoverR;
  if(UIS.mode==='build'&&UIS.buildType==='wall'){
    /* wall mode: highlight the road corridor instead of the grid */
    c.save();c.lineCap='round';c.lineJoin='round';
    c.strokeStyle='rgba(140,230,180,0.10)';c.lineWidth=48;
    for(const P of MAP.P)strokePath(c,P);
    c.restore();
  }else if(UIS.mode==='build'){
    /* grid overlay: show every open tile */
    const occ=new Set(G.towers.map(t=>t.c+','+t.r));
    c.lineWidth=1;
    for(let gr=0;gr<CFG.ROWS;gr++)for(let gc=0;gc<CFG.COLS;gc++){
      const key=gc+','+gr;
      if(MAP.blocked.has(key))continue;
      const gx=gc*CFG.CELL,gy=gr*CFG.CELL;
      if(occ.has(key)){
        c.strokeStyle='rgba(230,120,90,0.25)';
        c.strokeRect(gx+13,gy+13,CFG.CELL-26,CFG.CELL-26);
      }else{
        c.fillStyle='rgba(140,230,180,0.05)';
        c.fillRect(gx+2,gy+2,CFG.CELL-4,CFG.CELL-4);
        c.strokeStyle='rgba(140,230,180,0.16)';
        c.strokeRect(gx+2.5,gy+2.5,CFG.CELL-5,CFG.CELL-5);
      }
    }
  }
  if(UIS.mode==='build'&&pvC>=0&&UIS.buildType==='wall'){
    const wx=pvC*CFG.CELL+20,wy=pvR*CFG.CELL+20;
    const ok=canPlaceWall(wx,wy)&&G.gold>=TOWER_BY.wall.cost;
    const np=nearestPathPoint(wx,wy);
    const pp=posAt(np.pi,Math.max(0,Math.min(np.d,MAP.P[np.pi].total-1)));
    c.save();c.translate(pp.x,pp.y);c.rotate(pp.a+Math.PI/2);
    c.globalAlpha=ok?0.85:0.45;
    c.fillStyle=ok?'rgba(120,230,140,0.35)':'rgba(230,90,90,0.35)';
    c.strokeStyle=ok?'rgba(120,230,140,0.95)':'rgba(230,90,90,0.95)';
    c.lineWidth=2;c.setLineDash([6,4]);
    roundRect(c,-24,-9,48,18,4);c.fill();c.stroke();
    c.setLineDash([]);c.globalAlpha=1;
    c.restore();
  }else if(UIS.mode==='build'&&pvC>=0){
    const ok=canPlace(pvC,pvR)&&G.gold>=TOWER_BY[UIS.buildType].cost;
    const x=pvC*CFG.CELL,y=pvR*CFG.CELL;
    /* soft fill + corner ticks — never obscures what's on or near the tile */
    c.fillStyle=ok?'rgba(120,230,140,0.14)':'rgba(230,90,90,0.14)';
    c.fillRect(x,y,CFG.CELL,CFG.CELL);
    c.strokeStyle=ok?'rgba(120,230,140,0.95)':'rgba(230,90,90,0.95)';
    c.lineWidth=2.5;
    const k=9;
    c.beginPath();
    c.moveTo(x+2,y+2+k);c.lineTo(x+2,y+2);c.lineTo(x+2+k,y+2);
    c.moveTo(x+CFG.CELL-2-k,y+2);c.lineTo(x+CFG.CELL-2,y+2);c.lineTo(x+CFG.CELL-2,y+2+k);
    c.moveTo(x+CFG.CELL-2,y+CFG.CELL-2-k);c.lineTo(x+CFG.CELL-2,y+CFG.CELL-2);c.lineTo(x+CFG.CELL-2-k,y+CFG.CELL-2);
    c.moveTo(x+2+k,y+CFG.CELL-2);c.lineTo(x+2,y+CFG.CELL-2);c.lineTo(x+2,y+CFG.CELL-2-k);
    c.stroke();
    const def=TOWER_BY[UIS.buildType];
    if(def.range){
      const st=towerStat(def,1);
      c.fillStyle='rgba(255,255,255,0.08)';
      c.beginPath();c.arc(x+20,y+20,st.range,0,7);c.fill();
      c.strokeStyle='rgba(255,255,255,0.35)';c.lineWidth=1.5;
      c.beginPath();c.arc(x+20,y+20,st.range,0,7);c.stroke();
    }
    /* ghost of the tower being placed */
    const gspr=towerSprite(UIS.buildType,1);
    if(gspr&&gspr.base){
      c.globalAlpha=ok?0.7:0.35;
      const SC=0.8;
      c.drawImage(gspr.base,x+20-gspr.ax*SC,y+20-gspr.ay*SC,gspr.base.width*SC,gspr.base.height*SC);
      if(gspr.turret){
        c.save();c.translate(x+20,y+20-(gspr.mountH||24)*SC);c.rotate(-Math.PI/2);
        c.drawImage(gspr.turret,-gspr.tpx*SC,-gspr.tpy*SC,gspr.turret.width*SC,gspr.turret.height*SC);
        c.restore();
      }
      c.globalAlpha=1;
    }
  }
  /* selected tower range */
  if(UIS.selTower&&G.towers.includes(UIS.selTower)){
    const t=UIS.selTower,def=TOWER_BY[t.id];
    if(def.range){
      const st=towerStat(def,t.lvl);
      c.fillStyle=def.id==='beacon'?'rgba(240,230,180,0.1)':'rgba(255,255,255,0.07)';
      c.beginPath();c.arc(t.x,t.y,st.range,0,7);c.fill();
      c.strokeStyle='rgba(255,255,255,0.4)';c.lineWidth=1.5;
      c.beginPath();c.arc(t.x,t.y,st.range,0,7);c.stroke();
    }
    c.strokeStyle='#ffd75e';c.lineWidth=2;
    c.strokeRect(t.c*CFG.CELL+2,t.r*CFG.CELL+2,CFG.CELL-4,CFG.CELL-4);
  }
  /* selected wall */
  if(UIS.selWall&&G.walls.includes(UIS.selWall)){
    const sw2=UIS.selWall;
    c.strokeStyle='#ffd75e';c.lineWidth=2;c.setLineDash([6,4]);
    c.beginPath();c.arc(sw2.x,sw2.y,30,0,7);c.stroke();c.setLineDash([]);
  }

  /* y-sorted entities */
  const ents=[];
  for(const t of G.towers)ents.push({y:t.y,k:'t',o:t});
  for(const w of G.walls)ents.push({y:w.y,k:'w',o:w});
  for(const e of G.enemies)ents.push({y:e.y,k:'e',o:e});
  for(const tr of G.troops)ents.push({y:tr.y,k:'r',o:tr});
  for(const h of G.heroes)if(h.recruited&&!h.dead)ents.push({y:h.y,k:'h',o:h});
  ents.sort((a,b)=>a.y-b.y);
  for(const en of ents){
    if(en.k==='t')drawTower(c,en.o);
    else if(en.k==='e')drawEnemy(c,en.o);
    else if(en.k==='r')drawTroop(c,en.o);
    else if(en.k==='w')drawWall(c,en.o);
    else drawHeroU(c,en.o);
  }

  for(const p of G.projs)drawProj(c,p);
  for(const f of G.fx)drawFx(c,f);
  for(const p of G.parts){
    if(p.glow)c.globalCompositeOperation='lighter';
    c.globalAlpha=Math.max(0,p.life/p.maxLife);
    c.fillStyle=p.col;
    c.fillRect(p.x-p.sz/2,p.y-p.sz/2,p.sz,p.sz);
    if(p.glow)c.globalCompositeOperation='source-over';
  }
  c.globalAlpha=1;
  c.textAlign='center';
  for(const t of G.texts){
    c.globalAlpha=Math.max(0,Math.min(1,t.life/t.maxLife*1.6));
    const popS=t.pop>0?1+t.pop*2.2:1;
    c.font='bold '+Math.round(13*popS)+'px Georgia, serif';
    c.strokeStyle='rgba(0,0,0,0.7)';c.lineWidth=3;
    c.strokeText(t.txt,t.x,t.y);
    c.fillStyle=t.col;
    c.fillText(t.txt,t.x,t.y);
  }
  c.globalAlpha=1;

  /* spell target reticle */
  if(G.targetMode&&G.targetMode.indexOf('spell:')===0&&UIS.hoverX>=0){
    const sd=SPELL_BY[G.targetMode.slice(6)];
    const rr2=sd&&sd.radius?sd.radius:110;
    const col=sd&&sd.id==='blessing'?'126,224,138':'255,120,60';
    c.strokeStyle='rgba('+col+',0.85)';c.lineWidth=2;
    c.setLineDash([8,6]);
    c.beginPath();c.arc(UIS.hoverX,UIS.hoverY,rr2,0,7);c.stroke();
    c.setLineDash([]);
    c.fillStyle='rgba('+col+',0.12)';
    c.beginPath();c.arc(UIS.hoverX,UIS.hoverY,rr2,0,7);c.fill();
  }

  /* boss hp bar */
  const boss=G.enemies.find(e=>e.boss&&!e.dead);
  if(boss){
    const w=Math.min(420,CFG.W*0.4),x=(CFG.W-w)/2,y=14;
    c.fillStyle='rgba(10,8,18,0.7)';
    roundRect(c,x-10,y-6,w+20,32,9);c.fill();
    c.strokeStyle='rgba(255,215,94,0.5)';c.lineWidth=1.5;
    roundRect(c,x-10,y-6,w+20,32,9);c.stroke();
    c.fillStyle='#3a2020';c.fillRect(x,y+10,w,9);
    c.fillStyle='#e05a5a';c.fillRect(x,y+10,w*clamp(boss.hp/boss.maxHp,0,1),9);
    c.strokeStyle='#ffd75e';c.lineWidth=1.5;c.strokeRect(x,y+10,w,9);
    c.fillStyle='#ffd75e';c.font='bold 12px Georgia, serif';c.textAlign='center';
    c.fillText('☠ '+boss.def.name+(boss.tier>1?' '+(['','II','III','IV','V'][boss.tier]||('x'+boss.tier)):'')+' ☠',CFG.W/2,y+4);
  }

  /* banner */
  if(G.bannerT>0&&G.waveBanner){
    const a=Math.min(1,G.bannerT);
    c.globalAlpha=a;
    c.font='bold 30px Georgia, serif';c.textAlign='center';
    c.strokeStyle='rgba(0,0,0,0.8)';c.lineWidth=6;
    c.strokeText(G.waveBanner,CFG.W/2,boss?96:70);
    c.fillStyle='#ffd75e';
    c.fillText(G.waveBanner,CFG.W/2,boss?96:70);
    c.globalAlpha=1;
  }
  c.restore();
}
function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
