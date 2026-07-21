/* ============================================================
   themes.js — one game, two worlds. Display names, palettes and
   flavor text per theme; IDs and mechanics identical.
   ============================================================ */
'use strict';

let CUR_THEME='castle';
let THEME=null; // set by applyTheme

const THEME_PACKS={
/* ================= CASTLE (medieval) ================= */
castle:{
 flavor:'castle', underwater:false,
 maps:{
  meadow:{name:'Greenvale Meadow',desc:'A single winding road through peaceful farmland. Learn the trade of war.'},
  crossroads:{name:'Amberfield Crossroads',desc:'Two war-roads converge on your gate through the harvest fields. Split your defenses wisely.'},
  ashen:{name:'Ashen Pass',desc:'Three scorched warpaths meet in a killzone before your walls. Only veterans survive here.'},
 },
 towers:{
  archer:{name:'Archer Tower',desc:'Fast single-target arrows. Lv5 fires twin shots.'},
  cannon:{name:'Cannon Tower',desc:'Lobbed cannonballs with splash damage.'},
  frost:{name:'Frost Spire',desc:'Chills enemies, slowing their march.'},
  flame:{name:'Flame Brazier',desc:'Torrent of fire that leaves foes burning.'},
  ballista:{name:'Ballista',desc:'Huge bolts that skewer several enemies.'},
  poison:{name:'Alchemy Lab',desc:'Toxic flasks; poison stacks up to 6 times.'},
  storm:{name:'Storm Spire',desc:'Lightning that chains between enemies.'},
  mint:{name:'Gold Mint',desc:'Mints gold every 5s. Perfect while you multitask.'},
  beacon:{name:'Holy Beacon',desc:'+damage aura for towers in range. Stacks.'},
  arbalest:{name:'Great Arbalest',desc:'Slow-loading siege crossbow. Colossal bolts at extreme range; aims at flyers first.'},
  barracks:{name:'Barracks',desc:'Garrisons footmen onto the nearest road. They fight until slain or spent.'},
  lodge:{name:'Ranger Lodge',desc:'Fields rangers who pepper the road — and the sky — with arrows.'},
  siegecamp:{name:'Siege Workshop',desc:'Assembles a lumbering war golem that cleaves whole packs.'},
  wall:{name:'Barricade',desc:'Blocks the road — enemies must batter it down. Build ON the path.'},
  pHeal:{name:'Grove Sanctuary',desc:'A cleric-mage channels a constant healing aura over your troops and heroes.'},
  pStorm:{name:'Wrath Spire',desc:'A mage hurls random calamities — thunder, quake, flood or fire. Pure chance.'},
  pGat:{name:'Repeater Ballista',desc:'A medieval machine-gun of bolts that shreds packs and melts bosses.'},
  pShadow:{name:'Umbral Chain',desc:'Tendrils of darkness leap between EVERY enemy on the field at once.'},
  pGod:{name:'Aeon Monolith',desc:'The tower of ten fates — a new random power every wave.'},
 },
 troops:{
  militia:{name:'Militia',desc:'Cheap fodder. Holds the line.'},
  archer:{name:'Archer',desc:'Shoots from a distance.'},
  sword:{name:'Swordsman',desc:'Solid frontline fighter.'},
  spear:{name:'Spearman',desc:'+50% damage vs fast enemies.'},
  xbow:{name:'Crossbowman',desc:'Bolts punch through 50% armor.'},
  berserker:{name:'Berserker',desc:'Attacks faster as he bleeds.'},
  knight:{name:'Knight',desc:'Heavy armor. Great blocker.'},
  mage:{name:'Battle Mage',desc:'Explosive magic bolts (splash).'},
  cleric:{name:'Cleric',desc:'Heals your troops and heroes.'},
  cavalry:{name:'Cavalry',desc:'Fast riders that rush the front.'},
  paladin:{name:'Paladin',desc:'Armored, self-healing champion.'},
  giant:{name:'Giant',desc:'Colossal smasher. Cleaves groups.'},
  templar:{name:'Templar',desc:'Holy bulwark. Heavy armor, mends his own wounds.'},
  stormcaller:{name:'Stormcaller',desc:'Storm bolts crack over whole packs. Hits air.'},
  skeleton:{name:'Risen Skeleton',desc:'Raised from fallen foes. Fights until it crumbles.'},
  thrall:{name:'Thrall',desc:'An enemy bent to your will by the Aeon Monolith.'},
  aeonchamp:{name:'Aeon Champion',desc:'A legend called from beyond by the Aeon Monolith.'},
  footman:{name:'Footman',desc:'Garrison soldier from your Barracks.'},
  ranger:{name:'Ranger',desc:'Garrison archer from your Ranger Lodge.'},
  wargolem:{name:'War Golem',desc:'Siege construct from your Workshop.'},
 },
 heroes:{
  aldric:{name:'Sir Aldric',title:'Knight-Commander',col:'#7cc4ff',cape:'#c23a3a',
   skillName:'Valor Slam',skillDesc:'Shockwave slam: heavy AoE damage + brief stun.',
   passiveName:'War Banner',passiveDesc:'Troops near Aldric deal +15% damage.'},
  lyra:{name:'Lyra Swiftwind',title:'Warden of the Glade',col:'#7ede8a',cape:'#3a7a44',
   skillName:'Arrow Storm',skillDesc:'Rains a volley of 12 arrows on the thickest pack.',
   passiveName:'Eagle Eye',passiveDesc:'+20% range, 15% chance to crit for double.'},
  magnus:{name:'Magnus Emberforge',title:'Archmage of Cinders',col:'#ff9a5e',cape:'#8a2a1a',
   skillName:'Meteor',skillDesc:'Calls a meteor onto the largest cluster: massive burn damage.',
   passiveName:'Cinder Touch',passiveDesc:'His attacks set enemies ablaze.'},
  celeste:{name:'Sister Celeste',title:'Voice of the Dawn',col:'#ffe8a8',cape:'#e8c93a',
   skillName:'Sanctuary',skillDesc:'Heals your whole army 45% and shields it for 4s.',
   passiveName:'Dawn Aura',passiveDesc:'Allies near Celeste regenerate.'},
  bjorn:{name:'Bjorn Ironhide',title:'Jarl of the North',col:'#e0b060',cape:'#6a4a8a',
   skillName:'War Cry',skillDesc:'Terrifying roar: stuns nearby enemies, mends his wounds.',
   passiveName:'Iron Hide',passiveDesc:'Takes 30% less damage.'},
  nyx:{name:'Nyx Shadowblade',title:'Whisper of Midnight',col:'#c88bff',cape:'#2a2440',
   skillName:'Shadow Flurry',skillDesc:'Blinks between the 6 strongest foes, striking each hard.',
   passiveName:'Shadowstep',passiveDesc:'25% chance to dodge any blow.'},
  drake:{name:'Cindervane',title:'the Sky Drake',col:'#ff7a4e',cape:'#8a2a1a',
   skillName:'Sky Sweep',skillDesc:'Scours the heavens: massive damage to every flyer, embers rain below.',
   passiveName:'Windlord',passiveDesc:'Double damage against flying enemies.'},
  seraphine:{name:'Seraphine Stormcrown',title:'Oracle of Tempests',col:'#8ad4ff',cape:'#2a4a7a',
   skillName:'Tempest',skillDesc:'Calls a rolling thunderhead: chained lightning racks up to 12 foes.',
   passiveName:'Static Veil',passiveDesc:'Her bolts arc to a second nearby target.'},
  garrick:{name:'Garrick the Unbroken',title:'Shield of the Realm',col:'#d8b45a',cape:'#4a3f68',
   skillName:'Bulwark',skillDesc:'Plants his shield: taunts nearby foes onto himself, heals and hardens for 5s.',
   passiveName:'Living Fortress',passiveDesc:'Takes 40% less damage.'},
  aurelia:{name:'Aurelia the Dawnblade',title:'Legend of the First Light',col:'#ffe27a',cape:'#f4f0e4',
   skillName:'Dawnburst',skillDesc:'Radiant nova: heavy holy damage and heals nearby allies.',
   passiveName:'Undying Light',passiveDesc:'Returns from death almost instantly.'},
  karrgoth:{name:'Karrgoth the Wyrmborn',title:'Last of the Dragon Guard',col:'#ff9a5e',cape:'#8a2a1a',
   skillName:'Dragonfire',skillDesc:'Breathes a torrent of flame over the thickest pack.',
   passiveName:'Wyrm Blood',passiveDesc:'His blows set enemies ablaze.'},
  morrigan:{name:'Morrigan, Queen of Ravens',title:'Sovereign of the Twilight Court',col:'#c88bff',cape:'#221c30',
   skillName:'Ravenstorm',skillDesc:'A murder of shadow-ravens tears into up to 10 foes.',
   passiveName:'Chill of the Court',passiveDesc:'Her magic slows everything it touches.'},
  lich:{name:'Vex the Deathless',title:'First of the Grave',col:'#9ae05e',cape:'#1c2418',
   skillName:'Mass Grave',skillDesc:'Tears open the earth: raises 5 skeletal warriors at once.',
   passiveName:'Harvest of Souls',passiveDesc:'Enemies slain near Vex may rise as your skeletons.'},
 },
 enemies:{
  goblin:'Goblin',wolf:'Dire Wolf',bandit:'Bandit',skel:'Skeleton',orc:'Orc',hobgob:'Hobgoblin',
  shaman:'Gnoll Shaman',armskel:'Bone Guard',fellbat:'Fell Bat',wraith:'Wraith',troll:'Cave Troll',
  dknight:'Dark Knight',gargoyle:'Gargoyle',ogre:'Ogre',harpy:'Harpy',golem:'Stone Golem',wyvern:'Storm Wyvern',
 },
 bosses:{
  warlord:{name:'Ogre Warlord',desc:'Stomps your troops flat!'},
  colossus:{name:'Bone Colossus',desc:'Raises skeletons as it marches.'},
  behemoth:{name:'Swamp Behemoth',desc:'Regenerates. Burst it down!'},
  drake:{name:'Infernal Drake',desc:'Scorches nearby defenders.'},
 },
 events:{boar:'Gilded Boar',warden:'Shadow Warden'},
 calamities:{
  colossus2:{name:'The Ashen Colossus'},voidmaw:{name:'Voidmaw'},palerider:{name:'The Pale Rider'},
 },
 artifacts:{
  crown:{name:'Crown of Embers',desc:'All towers +10% damage per tier.'},
  sigil:{name:'Worldbreaker Sigil',desc:'All heroes +12% damage per tier.'},
  aegis:{name:'Aegis of Dawn',desc:'+3 max lives per tier; walls slowly rebuild themselves.'},
 },
 relics:{
  steel:{name:'Sharpened Steel'},engineering:{name:'Siege Engineering'},banners:{name:'War Banners'},
  treasury:{name:'Royal Treasury'},walls:{name:'Bastion Walls'},grimoire:{name:"Hero's Grimoire"},drums:{name:'Drums of War'},
 },
 spells:{
  firestorm:{name:'Firestorm',desc:'Click a spot: rain fire on it — heavy damage plus burn.'},
  blessing:{name:'Sanctified Ground',desc:'Click a spot: hallow the ground — heals your army there for 5s.'},
  frostnova:{name:'Frost Nova',desc:'Flash-freezes every enemy on the field and cracks them for heavy damage.'},
  chainbolt:{name:'Chain Lightning',desc:'Click a foe: a bolt forks through up to 10 enemies.'},
  warcry:{name:'War Cry',desc:'Rallies your army: +60% damage and a full heal for 8 seconds.'},
  ragnarok:{name:'RAGNAROK',desc:'The sky falls. Devastates every enemy, stuns the horde, resummons your entire army free, and empowers it.'},
 },
 txt:{
  title:'🏰 Castle Siege — Endless Defense',
  h1:'Castle Siege',h2:'Endless Defense',
  lore:'Choose your battlefield, commander.',
  fallen:'☠ The Castle Has Fallen',
  mystery:'A legendary champion.<br>Shadow Wardens hold them captive — slay one to set them free, forever.',
  boarSpawn:'✨ A Gilded Boar dashes for the gate — kill it for treasure! ✨',
  boarGold:g=>'✨ The Gilded Boar bursts into '+g+' gold! ✨',
  boarEscape:'The Gilded Boar got away…',
  wardenSpawn:n=>'🔮 A Shadow Warden drags '+n+' in chains — SLAY IT! 🔮',
  wardenEscape:n=>'The Shadow Warden escaped with '+n+'…',
  ragnarok:'⚡ R A G N A R O K ⚡',
  welcome:w=>'Welcome back! Wave '+w+' approaches…',
  chest:'A supply cache appeared — click it before it vanishes!',
  calamitySpawn:n=>'☄️ CALAMITY! '+n+' has come — slay it for a relic of power! ☄️',
  themeBtn:'🪸 Switch to Reef theme',
 },
},
/* ================= REEF (undersea) ================= */
reef:{
 flavor:'reef', underwater:true,
 maps:{
  meadow:{name:'Lagoon Shallows',desc:'A single sandy road through the sunlit lagoon. Learn the trade of reef war.'},
  crossroads:{name:'Kelp Crossing',desc:'Two currents converge on your reef through the golden kelp fields. Split your defenses wisely.'},
  ashen:{name:'The Abyssal Trench',desc:'Three black warpaths meet in a killzone before your reef. Only legends survive here.'},
 },
 towers:{
  archer:{name:'Harpoon Post',desc:'Fast single-target harpoons. Lv5 fires twin shots.'},
  cannon:{name:'Anchor Mortar',desc:'Lobbed anchors with splash damage.'},
  frost:{name:'Ice Coral',desc:'Chills enemies, slowing their drift.'},
  flame:{name:'Thermal Vent',desc:'Scalding torrent that leaves foes boiling.'},
  ballista:{name:'Great Harpoon',desc:'Huge harpoons that skewer several enemies.'},
  poison:{name:'Urchin Lab',desc:'Toxic spines; venom stacks up to 6 times.'},
  storm:{name:'Eel Spire',desc:'Electric arcs that chain between enemies.'},
  mint:{name:'Treasure Chest',desc:'Mints gold every 5s. Perfect while you multitask.'},
  beacon:{name:'Pearl Beacon',desc:'+damage aura for towers in range. Stacks.'},
  arbalest:{name:'Abyssal Arbalest',desc:'Slow-loading great harpoon-gun. Colossal shots at extreme range; aims at swimmers first.'},
  barracks:{name:'Anemone Bunker',desc:'Garrisons crab guards onto the nearest current. They fight until slain or spent.'},
  lodge:{name:'Archerfish School',desc:'Fields archerfish who pepper the current — and the waters above — with jets.'},
  siegecamp:{name:'Whalebone Forge',desc:'Assembles a lumbering reef colossus that cleaves whole packs.'},
  wall:{name:'Coral Barricade',desc:'Blocks the current — enemies must batter it down. Build ON the path.'},
  pHeal:{name:'Anemone Grotto',desc:'A tide-priest channels a constant healing current over your troops and heroes.'},
  pStorm:{name:'Maelstrom Spire',desc:'A sea-mage hurls random calamities — thunder, quake, flood or fire. Pure chance.'},
  pGat:{name:'Repeater Harpoon',desc:'A deep-sea machine-gun of harpoons that shreds shoals and melts bosses.'},
  pShadow:{name:'Abyssal Chain',desc:'Tendrils of the deep leap between EVERY enemy on the field at once.'},
  pGod:{name:'Leviathan Monolith',desc:'The tower of ten fates — a new random power every wave.'},
 },
 troops:{
  militia:{name:'Jellyfish',desc:'Cheap stingers. Hold the line.'},
  archer:{name:'Pistol Shrimp',desc:'Snaps from a distance.'},
  sword:{name:'Crab Guard',desc:'Solid frontline pincher.'},
  spear:{name:'Swordfish',desc:'+50% damage vs fast enemies.'},
  xbow:{name:'Pufferfish Darter',desc:'Darts punch through 50% armor.'},
  berserker:{name:'Mantis Shrimp',desc:'Punches faster as it bleeds.'},
  knight:{name:'Snail Shellguard',desc:'Heavy shell. Great blocker.'},
  mage:{name:'Cuttle Mage',desc:'Explosive magic bolts (splash).'},
  cleric:{name:'Angelfish Healer',desc:'Heals your shoal and heroes.'},
  cavalry:{name:'Seahorse Rider',desc:'Swift riders that rush the front.'},
  paladin:{name:'Turtle Paladin',desc:'Shelled, self-healing champion.'},
  giant:{name:'Colossal Crab',desc:'Titanic claws. Cleaves groups.'},
  templar:{name:'Seahorse Lancer',desc:'Holy bulwark of the reef. Heavy armor, mends his own wounds.'},
  stormcaller:{name:'Octomancer',desc:'Ink-storm bolts crack over whole packs. Hits swimmers above.'},
  skeleton:{name:'Drowned Bones',desc:'Raised from fallen foes. Fights until it crumbles.'},
  thrall:{name:'Thrall',desc:'An enemy bent to your will by the Leviathan Monolith.'},
  aeonchamp:{name:'Leviathan Champion',desc:'A legend called from the deep by the Leviathan Monolith.'},
  footman:{name:'Crab Guard',desc:'Garrison soldier from your Anemone Bunker.'},
  ranger:{name:'Archerfish',desc:'Garrison sharpshooter from your School.'},
  wargolem:{name:'Reef Colossus',desc:'Living siege construct from your Forge.'},
 },
 heroes:{
  aldric:{name:'Porous Pete',title:'Fry-Cook of the Reef',col:'#f2d94e',cape:'#e86a3a',
   skillName:'Spatula Slam',skillDesc:'Shockwave spatula-flip: heavy AoE damage + brief stun.',
   passiveName:'Order Up!',passiveDesc:'Troops near Pete deal +15% damage.'},
  lyra:{name:'Coralie Swiftfin',title:'Warden of the Kelp',col:'#7ede8a',cape:'#3a7a44',
   skillName:'Shell Storm',skillDesc:'Rains a volley of 12 shells on the thickest pack.',
   passiveName:'Eagle Eye',passiveDesc:'+20% range, 15% chance to crit for double.'},
  magnus:{name:'Inkwell',title:'Deep Sage of the Ink',col:'#ff9a5e',cape:'#8a2a1a',
   skillName:'Scalding Comet',skillDesc:'Calls a scalding comet onto the largest cluster: massive boil damage.',
   passiveName:'Boiling Touch',passiveDesc:'His attacks set enemies boiling.'},
  celeste:{name:'Sister Marina',title:'Voice of the Tides',col:'#ffe8a8',cape:'#e8c93a',
   skillName:'Healing Tide',skillDesc:'Heals your whole army 45% and shields it for 4s.',
   passiveName:'Tide Aura',passiveDesc:'Allies near Marina regenerate.'},
  bjorn:{name:'Crushclaw',title:'Crab Jarl of the Trench',col:'#e0b060',cape:'#6a4a8a',
   skillName:'War Snap',skillDesc:'Terrifying claw-clash: stuns nearby enemies, mends his shell.',
   passiveName:'Iron Shell',passiveDesc:'Takes 30% less damage.'},
  nyx:{name:'Moray',title:'Shadow Eel of the Deep',col:'#c88bff',cape:'#2a2440',
   skillName:'Eel Flurry',skillDesc:'Blinks between the 6 strongest foes, striking each hard.',
   passiveName:'Slipstream',passiveDesc:'25% chance to dodge any blow.'},
  drake:{name:'Tidewing',title:'the Storm Drake',col:'#4ecbe8',cape:'#1a4a5a',
   skillName:'Sky Sweep',skillDesc:'Scours the open water: massive damage to every swimmer above, scald rains below.',
   passiveName:'Currentlord',passiveDesc:'Double damage against free-swimmers.'},
  seraphine:{name:'Maris Stormcrown',title:'Oracle of Currents',col:'#8ad4ff',cape:'#2a4a7a',
   skillName:'Riptide Tempest',skillDesc:'Calls a rolling maelstrom: chained lightning racks up to 12 foes.',
   passiveName:'Static Veil',passiveDesc:'Her bolts arc to a second nearby target.'},
  garrick:{name:'Old Shellback',title:'Shield of the Reef',col:'#d8b45a',cape:'#4a3f68',
   skillName:'Shell Wall',skillDesc:'Plants his great shell: taunts nearby foes onto himself, heals and hardens for 5s.',
   passiveName:'Living Fortress',passiveDesc:'Takes 40% less damage.'},
  aurelia:{name:'King Neptune',title:'God-King of the Seven Seas',col:'#ffe27a',cape:'#f4f0e4',
   skillName:'Trident Radiance',skillDesc:'Trident nova: heavy divine damage and heals nearby allies.',
   passiveName:'Immortal Tide',passiveDesc:'Returns from death almost instantly.'},
  karrgoth:{name:'The Flying Dutchman',title:'Scourge of the Ghost Seas',col:'#7de8b8',cape:'#1a3a2e',
   skillName:'Ghostfire Broadside',skillDesc:'Unleashes a broadside of ghostfire over the thickest pack.',
   passiveName:'Ghostfire',passiveDesc:'His blows set enemies alight with ghostfire.'},
  morrigan:{name:'Davy Jones',title:'Keeper of the Locker',col:'#4ad0c8',cape:'#12262a',
   skillName:'Souls of the Locker',skillDesc:'A swarm of drowned souls tears into up to 10 foes.',
   passiveName:'Chill of the Locker',passiveDesc:'His magic slows everything it touches.'},
  lich:{name:'The Drowned Lich',title:'Keeper of Sunken Graves',col:'#9ae05e',cape:'#1c2418',
   skillName:'Mass Grave',skillDesc:'Tears open the seabed: raises 5 drowned warriors at once.',
   passiveName:'Harvest of Souls',passiveDesc:'Enemies slain near the Lich may rise as your bones.'},
 },
 enemies:{
  goblin:'Barnacle Imp',wolf:'Barracuda',bandit:'Sea Slug Bandit',skel:'Bonefish',orc:'Trench Brute',
  hobgob:'Tidepool Raider',shaman:'Sea Witch',armskel:'Crusted Bone Guard',fellbat:'Sting Jelly',
  wraith:'Drowned Wraith',troll:'Trench Troll',dknight:'Black Tide Knight',gargoyle:'Reef Gargoyle',
  ogre:'Depth Ogre',harpy:'Sting Ray',golem:'Coral Golem',wyvern:'Sea Serpent',
 },
 bosses:{
  warlord:{name:'Tidepool Tyrant',desc:'Stomps your shoal flat!'},
  colossus:{name:'Ghost Pirate Captain',desc:'Raises bonefish as it marches.'},
  behemoth:{name:'Trench Behemoth',desc:'Regenerates. Burst it down!'},
  drake:{name:'Magma Eel',desc:'Scalds nearby defenders.'},
 },
 events:{boar:'Golden Sea Turtle',warden:'Locker Warden'},
 calamities:{
  colossus2:{name:'The Kraken'},voidmaw:{name:'Abyss Leviathan'},palerider:{name:'The Drowned Admiral'},
 },
 artifacts:{
  crown:{name:'Crown of Pearls',desc:'All towers +10% damage per tier.'},
  sigil:{name:'Leviathan Sigil',desc:'All heroes +12% damage per tier.'},
  aegis:{name:'Aegis of Tides',desc:'+3 max lives per tier; barricades slowly regrow themselves.'},
 },
 relics:{
  steel:{name:'Sharpened Claws'},engineering:{name:'Reef Engineering'},banners:{name:'Kelp Banners'},
  treasury:{name:'Sunken Treasury'},walls:{name:'Coral Walls'},grimoire:{name:"Mariner's Grimoire"},drums:{name:'Drums of the Deep'},
 },
 spells:{
  firestorm:{name:'Boiling Geyser',desc:'Click a spot: a scalding geyser erupts — heavy damage plus boil.'},
  blessing:{name:'Healing Current',desc:'Click a spot: a warm current — heals your army there for 5s.'},
  frostnova:{name:'Deep Freeze',desc:'Flash-freezes every enemy on the field and cracks them for heavy damage.'},
  chainbolt:{name:'Eel Bolt',desc:'Click a foe: a bolt forks through up to 10 enemies.'},
  warcry:{name:'Sea Rally',desc:'Rallies your shoal: +60% damage and a full heal for 8 seconds.'},
  ragnarok:{name:'MAELSTROM',desc:'The sea itself rebels. Devastates every enemy, stuns the horde, resummons your entire army free, and empowers it.'},
 },
 txt:{
  title:'🪸 Reef Siege — Deep-Sea Defense',
  h1:'Reef Siege',h2:'Deep-Sea Defense',
  lore:'Choose your reef, commander.',
  fallen:'☠ The Reef Has Fallen',
  mystery:'A legend of the deep.<br>Locker Wardens hold them captive — slay one to set them free, forever.',
  boarSpawn:'✨ A Golden Sea Turtle glides for the gate — catch it for treasure! ✨',
  boarGold:g=>'✨ The Golden Sea Turtle bursts into '+g+' gold! ✨',
  boarEscape:'The Golden Sea Turtle got away…',
  wardenSpawn:n=>'🔮 A Locker Warden drags '+n+' in chains — SLAY IT! 🔮',
  wardenEscape:n=>'The Locker Warden escaped with '+n+'…',
  ragnarok:'🌀 M A E L S T R O M 🌀',
  welcome:w=>'Welcome back to the reef! Wave '+w+' approaches…',
  chest:'A treasure chest washed up — click it before it sinks!',
  calamitySpawn:n=>'☄️ CALAMITY! '+n+' rises from the deep — slay it for a relic of power! ☄️',
  themeBtn:'🏰 Switch to Castle theme',
 },
},
};

function applyTheme(id){
  CUR_THEME=THEME_PACKS[id]?id:'castle';
  const P=THEME_PACKS[CUR_THEME];
  THEME=P;
  for(const t of TOWERS){const o=P.towers[t.id];if(o){t.name=o.name;t.desc=o.desc;}}
  if(typeof PREM_TOWERS!=='undefined')for(const t of PREM_TOWERS){const o=P.towers[t.id];if(o){t.name=o.name;t.desc=o.desc;}}
  for(const t of TROOPS){const o=P.troops[t.id];if(o){t.name=o.name;t.desc=o.desc;}}
  for(const h of HEROES){
    const o=P.heroes[h.id];if(!o)continue;
    h.name=o.name;h.title=o.title;h.col=o.col;h.cape=o.cape;
    h.skill.name=o.skillName;h.skill.desc=o.skillDesc;
    if(h.passive){h.passive.name=o.passiveName;h.passive.desc=o.passiveDesc;}
  }
  for(const e of ENEMIES){const n=P.enemies[e.id];if(n)e.name=n;}
  for(const b of BOSSES){const o=P.bosses[b.id];if(o){b.name=o.name;b.desc=o.desc;}}
  for(const k in EVENT_DEFS){const n=P.events[k];if(n)EVENT_DEFS[k].name=n;}
  if(P.calamities)for(const c of CALAMITIES){const o=P.calamities[c.id];if(o)c.name=o.name;}
  if(P.artifacts)for(const a of ARTIFACTS){const o=P.artifacts[a.id];if(o){a.name=o.name;a.desc=o.desc;}}
  for(const r of RELICS){const o=P.relics[r.id];if(o)r.name=o.name;}
  for(const s of SPELLS){const o=P.spells[s.id];if(o){s.name=o.name;s.desc=o.desc;}}
  for(const m of MAPS){const o=P.maps[m.id];if(o){m.name=o.name;m.desc=o.desc;}}
  try{localStorage.setItem('rs2_theme',CUR_THEME);}catch(err){}
  try{document.title=P.txt.title;}catch(err){}
  try{document.body.classList.toggle('reef',P.flavor==='reef');}catch(err){}
  try{if(typeof SpriteLib!=='undefined'&&SpriteLib.setFlavor){SpriteLib.setFlavor(P.flavor);}}catch(err){}
  try{if(typeof clearRenderCaches==='function')clearRenderCaches();}catch(err){}
}
function loadThemePref(){
  let id='castle';
  try{id=localStorage.getItem('rs2_theme')||((typeof DEFAULT_THEME!=='undefined')?DEFAULT_THEME:'castle');}catch(err){}
  applyTheme(id);
}
