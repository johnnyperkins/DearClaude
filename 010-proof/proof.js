/* proof: a small interactive story set in a bakery between two and seven in the morning.
   The engine and the world are both in this file. It runs in the page (window.Proof)
   and in node (module.exports), so the same game can be played from a terminal. */
(function (root) {
'use strict';

const START = 120;          // 2:00 a.m., in minutes after midnight
const OPEN = 420;           // 7:00
const MAXPTS = 10;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function clock(t) { const h = Math.floor(t / 60), m = t % 60; return h + ':' + String(m).padStart(2, '0'); }
function sky(t) {
  if (t < 345) return 'black';
  if (t < 380) return 'a very dark blue';
  if (t < 405) return 'blue-grey';
  return 'grey, going pale';
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ rooms */

const ROOMS = {
  boxroom: {
    name: 'Box room', exits: { east: 'landing', out: 'landing' },
    desc: s => `The box room. There's just space for a single bed and a chest of drawers, and the window over the bed is ${sky(s.time)}. The landing is through the door to the east.`,
  },
  landing: {
    name: 'Landing', exits: { west: 'boxroom', east: 'winroom', down: 'bakehouse' },
    desc: s => `A narrow landing with a framed photo on the wall. The airing cupboard ${s.open.airing ? 'stands open, breathing warm air' : 'hums to itself'}. The box room is to the west. To the east Win's door stands ajar, ` +
      (s.time >= 320 && s.time < 333 ? 'and a radio is murmuring in there.' : "and her snoring comes through it at a steady, impressive pace.") +
      ' The stairs go down to the bakehouse.',
  },
  winroom: {
    name: "Win's room", exits: { west: 'landing', out: 'landing' },
    desc: s => "Win's room, dim, with streetlight coming round the edges of the curtains. " +
      (s.win.awake > 0 ? 'Win is lying on her back, one eye open, watching you. ' : 'Win is asleep on her back, ') +
      (s.win.awake > 0 ? 'Her right arm is in a sling on a pillow of its own, like something important.' : 'her right arm in a sling on a pillow of its own, like something important.') +
      (s.where.apron === 'on:chair' ? ' Her apron hangs on a chair.' : '') + ` On the bedside table there's a radio${s.time >= 320 && s.time < 333 ? ' murmuring the shipping forecast' : ''}, a glass of water and a box of painkillers. The landing is back to the west.`,
  },
  bakehouse: {
    name: 'Bakehouse', exits: { up: 'landing', down: 'cellar', north: 'shop', east: 'yard', out: 'yard' },
    desc: s => 'The bakehouse runs the length of the building under strip lights that hum. A long wooden bench stands down the middle, pale with years of flour. ' +
      `Against the back wall is the oven, a steel deck oven with a glass door, ${ovenMood(s)}. Beside it is the mixer, like a small tractor with its bowl in its lap. ` +
      "There's a walk-in fridge with a heavy door, a sink, a flour bin, a drawer under the bench, a little pedal bin, a cooling rack on wheels, and shelves. A recipe card is pinned to the wall by the hooks, and a clock above the door says " + clock(s.time) + '. ' +
      `High up, a small window is ${sky(s.time)}. ` +
      'The stairs go up, and the cellar door is under them. A door leads north into the shop, and the back door goes east to the yard.',
    short: s => `The bakehouse: bench, oven (${ovenShort(s)}), mixer, fridge, sink, shelves. Up the stairs, down to the cellar, north to the shop, east to the yard.`,
  },
  shop: {
    name: 'Shop', exits: { south: 'bakehouse', back: 'bakehouse' },
    desc: s => (s.shutter ? 'The shutter is up and grey daylight fills the shop. ' : (s.time >= 390 ? 'The shop is dim, with grey light coming through the slats of the shutter. ' : 'The shop is dark apart from the streetlight that comes through the slats of the shutter. ')) +
      "Behind the glass counter, baskets wait on the shelves. There's the till, with a jar beside it, and a blackboard on the wall. Gold letters are painted on the inside of the window. " +
      (s.shutter ? '' : 'The shutter is down and locked. ') + 'The bakehouse is back to the south.',
  },
  yard: {
    name: 'Yard', exits: { west: 'bakehouse', in: 'bakehouse', north: 'store' },
    desc: s => `A small concrete yard, cold, with the sky ${sky(s.time)} above it like a lid. Two wheelie bins. To the north is the flour store, a brick outhouse with a bolt on its door. ` +
      (s.cat.inside ? '' : 'A cat is sitting on the wall, watching you. ') + 'The back door to the bakehouse is to the west.',
  },
  store: {
    name: 'Flour store', exits: { south: 'yard', out: 'yard' },
    desc: () => 'The flour store smells of dust and cold and, faintly, of biscuits. Sacks of flour are stacked on pallets, sixteen kilos each. A stepladder lies on its side where it came down with Win on it two days ago. Nobody has wanted to pick it up. The yard is back to the south.',
  },
  cellar: {
    name: 'Cellar', exits: { up: 'bakehouse', out: 'bakehouse' },
    desc: () => "The cellar is low and brick, and colder than outside. The torch finds old shelves crowded with things nobody has needed since about 1985, a mangle, and on the wall by the steps, the fuse box. A pull cord hangs from a bulb that doesn't work. The steps go back up.",
  },
};

function ovenMood(s) {
  if (s.ovenTemp < 40) return 'cold';
  if (heating(s)) return 'ticking as it warms';
  return 'breathing out heat';
}
function ovenShort(s) { return Math.round(s.ovenTemp) + '°' + (heating(s) ? ', heating' : ''); }
const powered = s => s.breaker && s.ovenOn;
const heating = s => powered(s) && s.ovenTemp < s.dial - 2;

const PLACES = [
  [/^(box ?room|bedroom|my room|spare room|small room|bed)$/, 'boxroom'],
  [/^(landing|upstairs|top of stairs|airing cupboard)$/, 'landing'],
  [/^(wins? room|win|aunts? room|aunt wins? room|her room|winifreds? room)$/, 'winroom'],
  [/^(bakehouse|bakery|kitchen|downstairs|bake house|oven|bench)$/, 'bakehouse'],
  [/^(shop|front|shop front|counter|till)$/, 'shop'],
  [/^(yard|outside|back yard|backyard|garden)$/, 'yard'],
  [/^(store|flour store|shed|outhouse|storeroom|store room)$/, 'store'],
  [/^(cellar|basement|fuse box|fusebox)$/, 'cellar'],
];

/* ---------------------------------------------------------------- objects
   loc: a room id, 'inv', 'in:<id>' or 'on:<id>', or null for nowhere.
   w: the words that can name it. cont/surf: it holds things in or on it. */

const OBJ = {
  // box room
  alarm: { name: 'alarm clock', w: 'alarm clock beeping wind-up windup', loc: 'on:drawers',
    d: s => `A wind-up alarm clock with two bells on top, ${s.alarm ? 'going off like a fire drill' : 'quiet now'}. It says ${clock(s.time)}.` },
  bed: { name: 'bed', w: 'bed single pillow duvet', loc: 'boxroom', fixed: true,
    d: () => "A single bed, still warm on one side. It would be very easy to lie back down. Just for five minutes." },
  drawers: { name: 'chest of drawers', w: 'chest drawers', loc: 'boxroom', fixed: true, surf: true,
    d: () => "An old chest of drawers. The drawers are full of Win's spare jumpers, which smell of flour and lavender." },
  bag: { name: 'bag', w: 'bag holdall rucksack', loc: 'on:drawers', cont: true,
    d: () => "Your bag, with the clothes you brought for a week. Your phone is in the side pocket." },
  phone: { name: 'phone', w: 'phone mobile', loc: 'in:bag',
    d: () => "Your phone. It's flat. The charger is on your own kitchen table, about a hundred miles away, exactly where you left it." },
  boxwindow: { name: 'window', w: 'window', loc: 'boxroom', fixed: true,
    d: s => `The window is ${sky(s.time)}. Across the road the newsagent's is shut and the street is empty.` },

  // landing
  photo: { name: 'photo', w: 'photo photograph picture frame framed', loc: 'landing', fixed: true,
    d: () => 'A man in baker\'s whites stands outside the shop, holding a jar up to the camera like a trophy. He has Win\'s chin. Written on the mount in pencil: DAD & GERALD, 1979.' },
  airing: { name: 'airing cupboard', w: 'airing cupboard cupboard', loc: 'landing', fixed: true, cont: true, closable: true, temp: 28,
    d: s => "The airing cupboard, where the boiler lives. It's the warmest place in the house." + (s.open.airing ? '' : ' The door is shut.') },
  boiler: { name: 'boiler', w: 'boiler tank', loc: 'in:airing', fixed: true, d: () => 'The boiler, wrapped in a red jacket like a lifeboat crew. It ticks and sighs.' },
  towels: { name: 'towels', w: 'towels towel', loc: 'in:airing', fixed: true, plural: true, d: () => 'Folded towels, warm through.',
    fixedMsg: "You don't need a towel. You need bread." },
  stairs: { name: 'stairs', w: 'stairs staircase steps', rooms: ['landing', 'bakehouse'], fixed: true, plural: true,
    d: s => s.loc === 'landing' ? 'Narrow stairs going down to the bakehouse. They creak on the fourth step.' : 'Narrow stairs going up to the landing, with the cellar door underneath.' },
  windoor: { name: "Win's door", w: 'door wins', loc: 'landing', fixed: true, d: () => "Win's door, ajar. Her snoring is coming through it." },

  // Win's room
  win: { name: 'Win', w: 'win aunt auntie winifred woman', loc: 'winroom', fixed: true, person: true, proper: true,
    d: s => s.win.awake > 0 ? 'Win, one eye open, propped on her pillows. She looks like someone who has been woken up and is deciding whether to mind.'
      : 'Your aunt Win, asleep. Her right arm is in a sling, and her mouth is slightly open. She snores like an outboard motor. She has flour in her eyebrows, somehow, even now.',
    fixedMsg: "She's a grown woman with a broken wrist. Leave her where she is." },
  sling: { name: 'sling', w: 'sling wrist arm cast', loc: 'winroom', fixed: true, d: () => 'Her right wrist, in plaster and a sling. Two days ago she was up the stepladder in the flour store. Then she wasn\'t.' },
  chair: { name: 'chair', w: 'chair', loc: 'winroom', fixed: true, surf: true, d: s => 'A hard wooden chair' + (s.where.apron === 'on:chair' ? ' with her apron over the back.' : '.') },
  apron: { name: 'apron', w: 'apron pocket pockets', loc: 'on:chair', cont: true,
    d: s => "Win's work apron, white gone cream, stiff with flour at the front where she leans on the bench." + (s.where.lame === 'in:apron' ? " There's something in the front pocket." : '') },
  lame: { name: 'lame', w: 'lame blade razor stick', loc: 'in:apron',
    d: () => "A baker's lame: a razor blade curved onto the end of a little metal stick, with a cork on it for safety. This is what you score the loaves with. Win wore her apron yesterday afternoon while she bossed you through the shaping, and she must have pocketed it." },
  bedside: { name: 'bedside table', w: 'bedside table nightstand', loc: 'winroom', fixed: true, surf: true, d: () => 'A small table with a radio, a glass of water and a box of painkillers on it.' },
  radio: { name: 'radio', w: 'radio', loc: 'on:bedside', fixed: true,
    d: s => s.time >= 320 && s.time < 333 ? 'A little radio, on very low. The shipping forecast: "Viking, North Utsire, South Utsire. Westerly, four or five. Fair. Good."' : "A little radio with an alarm on it. It's set for twenty past five, which Win says is so the shipping forecast can tuck her back in.",
    fixedMsg: 'Leave it. It knows what it\'s doing.' },
  pills: { name: 'box of painkillers', w: 'painkillers pills box tablets', loc: 'on:bedside', fixed: true,
    d: () => 'TWO TABLETS EVERY FOUR TO SIX HOURS. MAY CAUSE DROWSINESS. You don\'t say.', fixedMsg: "They're Win's. Leave them." },
  glass: { name: 'glass of water', w: 'glass water', loc: 'on:bedside', fixed: true, d: () => 'Half a glass of water.', fixedMsg: "It's Win's." },

  // bakehouse
  bench: { name: 'bench', w: 'bench table worktop', loc: 'bakehouse', fixed: true, surf: true,
    d: () => "The bench. Oak, twelve feet long, scrubbed so often the grain stands up like corduroy. Win's dad made it, and his dad worked on it." },
  note: { name: 'note', w: 'note list paper wins', loc: 'on:bench', prio: 5,
    d: () => "Win's note, written left-handed, which shows. The capitals lean on each other for support:\n\n" +
      "LOVE,\nIF I'M NOT UP DON'T WAKE ME. (WAKE ME IF YOU HAVE TO.)\n" +
      "1. OVEN ON FIRST. BIG SWITCH ON THE SIDE. IT WANTS AN HOUR TO GET TO 250. THE LIGHT GOES OFF WHEN IT'S THERE. GIVE IT ANOTHER QUARTER OF AN HOUR AFTER THAT IF YOU CAN.\n" +
      "2. FEED GERALD. WHATEVER ELSE YOU DO.\n" +
      "3. ROLLS. THE CARD'S ON THE WALL. YOU'RE GOOD AT SUMS.\n" +
      "4. THE SOURDOUGH'S IN THE BIG FRIDGE. STRAIGHT FROM THE FRIDGE INTO THE HOT OVEN. TURN OUT, SCORE (LAME'S IN THE JAR BY THE TILL), STEAM, 40 MINS. KNOCK ON THE BOTTOM. IT SHOULD SOUND HOLLOW.\n" +
      "5. DON'T PRESS THE STEAM BUTTON.\n" +
      "6. OPEN AT 7. THEY'LL BE THERE AT 7.\n" +
      "YOU'LL BE FINE.\nW x" },
  pin: { name: 'rolling pin', w: 'rolling pin', loc: 'on:bench', d: () => 'A heavy wooden rolling pin. It was holding the note down. It is the sort people keep by the bed for burglars.' },
  oven: { name: 'oven', w: 'oven deck door glass', loc: 'bakehouse', fixed: true, cont: true, surf: true, see: true, prio: 2, d: ovenDesc },
  ovenswitch: { name: 'big switch', w: 'big switch side lever', loc: 'bakehouse', fixed: true,
    d: s => `A big red switch on the side of the oven, ${s.ovenOn ? 'up, at ON' : 'down, at OFF'}.` },
  dial: { name: 'dial', w: 'dial thermostat knob temperature', loc: 'bakehouse', fixed: true,
    d: s => `The thermostat dial, set to ${s.dial}. To change it, SET THE DIAL TO a number.` },
  gauge: { name: 'gauge', w: 'gauge thermometer needle', loc: 'bakehouse', fixed: true,
    d: s => `The gauge reads ${Math.round(s.ovenTemp)}°. Its needle has a little wobble, like it's thinking.` },
  ovenlight: { name: 'orange light', w: 'orange light heating lamp indicator', loc: 'bakehouse', fixed: true,
    d: s => heating(s) ? "The orange light is on. It means the oven is still heating." : "The orange light is off. It comes on while the oven is heating and goes off when it's up to temperature." },
  steambtn: { name: 'steam button', w: 'steam button', loc: 'bakehouse', fixed: true,
    d: () => 'A fat chrome button marked STEAM. A note is taped across it in Win\'s writing: DON\'T. SEE DAVE.' },
  steamnote: { name: 'note on the steam button', w: 'dave note button steam', loc: 'bakehouse', fixed: true, prio: -1, d: () => "DON'T. SEE DAVE." },
  mixer: { name: 'mixer', w: 'mixer bowl hook machine', loc: 'bakehouse', fixed: true, cont: true, d: mixerDesc },
  fridge: { name: 'fridge', w: 'fridge walk-in walkin walk cold room refrigerator fridge door', loc: 'bakehouse', fixed: true, cont: true, closable: true, temp: 4, prio: 1,
    d: s => 'A walk-in fridge, steel, with a door like a ship\'s. ' + (s.open.fridge ? 'It stands open, and cold rolls out over the floor.' : 'It hums.') },
  loaves: { name: 'loaves', w: 'loaves loaf sourdough bread bannetons banneton proving trolley', loc: 'in:fridge', plural: true, prio: 3, d: loavesDesc },
  yeast: { name: 'block of fresh yeast', w: 'yeast block fresh', loc: 'in:fridge',
    d: s => `A block of fresh yeast in waxed paper, putty-coloured, smelling of beer. About ${s.yeastLeft} grams left.` },
  batteries: { name: 'batteries', w: 'batteries battery packet aa butter dish', loc: 'in:fridge', plural: true,
    d: () => 'Two AA batteries in a butter dish in the fridge. Win says it makes them last. It doesn\'t.' },
  butter: { name: 'butter', w: 'butter milk eggs', loc: 'in:fridge', fixed: true, d: () => 'Butter, milk, a tray of eggs. None of it is in anything you\'re making today.', fixedMsg: "You don't need it." },
  jug: { name: 'jug', w: 'jug measuring', loc: 'on:shelves', d: s => 'A plastic measuring jug that goes up to a litre.' + (s.jug ? ' It\'s full of water.' : '') },
  sink: { name: 'sink', w: 'sink tap taps', loc: 'bakehouse', fixed: true, d: () => 'A deep white sink with a swan-neck tap.' },
  water: { name: 'water', w: 'water tap', loc: 'bakehouse', fixed: true, prio: -2, d: s => s.jug ? 'Tap water, and a jug full of it.' : 'Water comes out of the tap. That\'s about all there is to say.', fixedMsg: 'You\'ll want the jug for that.' },
  flour: { name: 'flour', w: 'flour', rooms: ['bakehouse'], fixed: true, prio: -2, d: flourDesc, fixedMsg: 'You can ADD flour to the mixer, or feed Gerald with it. Otherwise it\'s just flour everywhere.' },
  bin: { name: 'flour bin', w: 'flour bin', loc: 'bakehouse', fixed: true, cont: true, prio: 1, d: flourDesc },
  pedal: { name: 'pedal bin', w: 'pedal bin rubbish waste', loc: 'bakehouse', fixed: true, cont: true, d: () => 'A little pedal bin for scraps.' },
  drawer: { name: 'drawer', w: 'drawer', loc: 'bakehouse', fixed: true, cont: true, closable: true, d: s => 'A deep drawer under the bench. ' + (s.open.drawer ? "It's open." : "It's shut.") },
  torch: { name: 'torch', w: 'torch flashlight', loc: 'in:drawer', d: s => 'A big rubber torch. ' + (s.torchBatt ? (s.torchOn ? "It's on." : "It's off.") : "It feels light. You unscrew the end: no batteries, just a scrap of paper rolled up inside. It says FRIDGE.") },
  knife: { name: 'bread knife', w: 'bread knife', loc: 'in:drawer', d: () => 'A long serrated bread knife.' },
  shelves: { name: 'shelves', w: 'shelves shelf', loc: 'bakehouse', fixed: true, surf: true, plural: true, d: () => 'Steel shelves, everything on them dusted with flour.' },
  gerald: { name: 'Gerald', w: 'gerald jar starter kilner leaven levain sourdough starter', loc: 'on:shelves', proper: true, prio: 2, d: geraldDesc },
  salt: { name: 'tub of salt', w: 'salt tub', loc: 'on:shelves', d: () => 'A big tub of fine salt with a scoop in it.' },
  scale: { name: 'scale', w: 'scale scales', loc: 'on:shelves', d: () => 'Digital scales that go up to five kilos. You\'ll use them for anything you ADD.' },
  timer: { name: 'kitchen timer', w: 'kitchen timer hen', loc: 'on:shelves',
    d: s => 'A wind-up timer shaped like a hen. ' + (s.timer > s.time ? `It's ticking, set to go off at ${clock(s.timer)}.` : 'You can SET THE TIMER FOR some number of minutes.') },
  tub: { name: 'dough tub', w: 'tub bucket', loc: 'on:shelves', cont: true, prio: 1, d: s => 'A big square plastic tub for dough to rise in.' + (s.where.dough === 'in:tub' ? '' : ' It\'s empty.') },
  trays: { name: 'baking trays', w: 'baking trays tray trays', loc: 'on:shelves', surf: true, plural: true,
    d: s => 'Two big baking trays, black with use.' + (s.rolls ? '' : ' Empty.') },
  card: { name: 'recipe card', w: 'recipe card wall', loc: 'bakehouse', fixed: true,
    d: () => 'A recipe card, brown at the edges, pinned to the wall. It\'s in neat old-fashioned capitals:\n\n' +
      'MORNING ROLLS (MAKES 40)\nSTRONG WHITE FLOUR 100%\nWATER 65%\nFRESH YEAST 2.5%\nSALT 2%\n\n' +
      'WATER BLOOD WARM. MIX 8 MIN. BULK TILL DOUBLED, SOMEWHERE WARM. AN HOUR IF IT\'S WARM. DIVIDE, ROLL, TRAY. PROVE 45 MIN, WARM. BAKE 220, 15 MIN, TILL THEY\'RE THE COLOUR OF A GOOD BISCUIT.\nF.A.\n\n' +
      'Under it, newer, in biro: TODAY 2KG FLOUR.\n' +
      'And under that, in pencil, in Win\'s left hand: PERCENT OF THE FLOUR, NOT THE DOUGH. FLOUR IS ALWAYS 100. DON\'T ASK ME WHY, ASK YOUR GRANDAD.' },
  hooks: { name: 'hooks', w: 'hooks hook', loc: 'bakehouse', fixed: true, surf: true, plural: true, d: () => 'A row of iron hooks on the wall.' },
  peel: { name: 'peel', w: 'peel paddle board', loc: 'on:hooks', surf: true,
    d: s => 'A long wooden peel for getting bread in and out of the oven, the handle black with hands. F.A. is burnt into it.' + '' },
  key: { name: 'shop key', w: 'key shop fob', loc: 'on:hooks', d: () => 'A key on a leather fob stamped SHOP.' },
  rack: { name: 'cooling rack', w: 'cooling rack racks wire', loc: 'bakehouse', fixed: true, surf: true, d: () => 'A tall wire rack on wheels for bread to cool on.' },
  bclock: { name: 'clock', w: 'clock wall', loc: 'bakehouse', fixed: true, d: s => `An electric clock. It says ${clock(s.time)}.` },
  backdoor: { name: 'back door', w: 'back door', loc: 'bakehouse', fixed: true, d: () => 'The back door to the yard. Taped to it at cat height is a note: PEMBERTON HAS BEEN FED. WHATEVER HE SAYS.' },
  catnote: { name: 'note on the back door', w: 'note pemberton cat back door', loc: 'bakehouse', fixed: true, prio: -1, d: () => 'PEMBERTON HAS BEEN FED. WHATEVER HE SAYS.' },
  cellardoor: { name: 'cellar door', w: 'cellar door', loc: 'bakehouse', fixed: true, d: () => 'A low door under the stairs. CELLAR, it says, in case anyone had doubts.' },
  shopdoor: { name: 'shop door', w: 'shop door', loc: 'bakehouse', fixed: true, prio: -1, d: () => 'The door through to the shop, propped open with a sack of nothing.' },
  bhwindow: { name: 'window', w: 'window', loc: 'bakehouse', fixed: true, d: s => `A small window up near the ceiling. It's ${sky(s.time)}.` },
  lights: { name: 'lights', w: 'lights light strip lamps', loc: 'bakehouse', fixed: true, plural: true, prio: -1, d: () => 'Strip lights, humming.' },
  dough: { name: 'dough', w: 'dough', loc: null, prio: 2, d: doughDesc },
  rolls: { name: 'rolls', w: 'rolls roll buns bread', loc: null, plural: true, prio: 2, d: rollsDesc },

  // shop
  counter: { name: 'counter', w: 'counter glass', loc: 'shop', fixed: true, surf: true, d: () => 'A glass counter, polished, with the till on it.' },
  till: { name: 'till', w: 'till register cash', loc: 'shop', fixed: true, d: () => 'An old till with keys that need a good thump. A Post-it on it: FLOAT IN THE TIN UNDER. DON\'T PANIC.' },
  jar: { name: 'jar by the till', w: 'jar pens till', loc: 'on:counter', cont: true,
    d: () => 'A jam jar by the till. Three biros, an elastic band, a button, a lolly still in its wrapper. No lame. You tip it out to be sure. No lame. Win had her apron on yesterday afternoon, though, when she was bossing you through the shaping.' },
  baskets: { name: 'baskets', w: 'baskets basket shelves display', loc: 'shop', fixed: true, cont: true, plural: true,
    d: s => 'Wicker baskets on the shelves behind the counter, where the bread goes.' + (basketsEmpty(s) ? ' Empty, for now.' : '') },
  shutter: { name: 'shutter', w: 'shutter shutters front door door', loc: 'shop', fixed: true,
    d: s => s.shutter ? 'The shutter is rolled up out of the way.' : 'A steel roller shutter over the shop front, locked at the bottom. The key will be on the hook in the bakehouse.' },
  sign: { name: 'sign', w: 'sign open closed', loc: 'shop', fixed: true, d: s => `A card sign hanging in the door. It says ${s.sign ? 'OPEN' : 'CLOSED'}.` },
  blackboard: { name: 'blackboard', w: 'blackboard board chalk', loc: 'shop', fixed: true,
    d: () => 'In Win\'s left-handed chalk: WRIST BROKEN. SPIRIT NOT. BEAR WITH US.' },
  shopwindow: { name: 'window', w: 'window letters gold sign', loc: 'shop', fixed: true, prio: -1,
    d: () => 'Gold letters painted on the inside of the glass, backwards from in here: ASHBY & DAUGHTER. The DAUGHTER is newer paint than the rest. If you look, you can still see where it used to say SON.' },

  // yard and store
  cat: { name: 'Mister Pemberton', w: 'cat mister mr pemberton tabby', loc: 'yard', proper: true, person: true, prio: 1, d: catDesc },
  wbins: { name: 'wheelie bins', w: 'wheelie bins bin', loc: 'yard', fixed: true, cont: true, plural: true, d: () => 'Two wheelie bins, black and green.' },
  wall: { name: 'wall', w: 'wall', loc: 'yard', fixed: true, d: s => 'A brick wall, about shoulder height.' + (s.cat.inside ? '' : ' There\'s a cat on it.') },
  storedoor: { name: 'flour store door', w: 'store door bolt outhouse', loc: 'yard', fixed: true, d: () => 'A wooden door with a heavy bolt.' },
  sacks: { name: 'sacks', w: 'sacks sack flour pallets pallet', loc: 'store', fixed: true, plural: true,
    d: () => 'Paper sacks of strong white flour, sixteen kilos each, stacked on pallets. You could carry one if you didn\'t mind your back.' },
  sack: { name: 'sack of flour', w: 'sack flour', loc: null, prio: 1, d: () => 'A sixteen-kilo paper sack of strong white flour.' },
  ladder: { name: 'stepladder', w: 'stepladder ladder steps', loc: 'store', fixed: true,
    d: () => 'An aluminium stepladder, on its side. One foot is bent. You\'d stand it up, but it feels like evidence.', fixedMsg: "It's done enough damage." },

  // cellar
  fusebox: { name: 'fuse box', w: 'fuse box fusebox consumer unit', loc: 'cellar', fixed: true, cont: true, d: fuseDesc },
  breaker: { name: 'oven breaker', w: 'breaker switch oven trip fuse switches', loc: 'in:fusebox', fixed: true, prio: 1,
    d: s => s.breaker ? 'The OVEN switch is up, like the others.' : 'The switch marked OVEN is down. All the others are up.' },
  cshelves: { name: 'old shelves', w: 'old shelves shelf junk jam jars paint bottles crate', loc: 'cellar', fixed: true, surf: true,
    d: () => 'Paint tins, a box of jam jars, bread tins nobody uses, a crate of empty milk bottles, a cardboard box marked DAD - DON\'T THROW. And, at the front, a roasting tin.' },
  dadbox: { name: 'box marked DAD', w: 'box dad cardboard marked', loc: 'cellar', fixed: true,
    d: () => 'You lift the lid. Old baker\'s whites, folded. A notebook of recipes in the same capitals as the card upstairs. A photo of a much younger Win on someone\'s shoulders outside the shop. You put the lid back on.' },
  tin: { name: 'roasting tin', w: 'roasting tin stones stone pebbles grandads', loc: 'on:cshelves', cont: true,
    d: s => 'A battered roasting tin full of smooth grey river stones. On masking tape on the side, in capitals: STEAM. F.A.' + (s.where.tin === 'in:oven' ? ` It's in the bottom of the oven${s.tinTemp > 180 ? ', and the stones are hot' : ''}.` : '') },
  mangle: { name: 'mangle', w: 'mangle', loc: 'cellar', fixed: true, d: () => 'A cast-iron mangle. You have no idea what to do with it, and neither, you suspect, does anyone.' },
  cord: { name: 'pull cord', w: 'pull cord bulb light', loc: 'cellar', fixed: true, d: () => 'A pull cord for the cellar light. The bulb is gone.' },
};

/* -------------------------------------------------------- descriptions */

function ovenDesc(s) {
  let t = `The oven is a big steel deck oven, older than you, with a glass door. There's a thermostat dial (set to ${s.dial}), a gauge that reads ${Math.round(s.ovenTemp)}°, an orange light and a big switch on the side, which is ${s.ovenOn ? 'on' : 'off'}. A button marked STEAM has a note taped over it.`;
  if (s.ovenOn && !s.breaker) t += ' The switch is on, but nothing is happening. No hum, no orange light.';
  else if (heating(s)) t += ' The orange light is on and it\'s ticking as it warms.';
  else if (powered(s)) t += ' The orange light is off. It\'s up to heat.';
  const inside = contentsOf(s, 'oven', 'in');
  if (inside.length) t += ' Through the glass you can see ' + listNames(s, inside) + '.';
  if (s.where.loaves === 'in:oven') t += ' ' + bakeLook(s.loaves.bake, 'loaves');
  if (s.where.trays === 'in:oven' && s.rolls) t += ' ' + bakeLook(s.rolls.bake * 250 / 220 * 40 / 15, 'rolls');
  const ontop = contentsOf(s, 'oven', 'on');
  if (ontop.length) t += ' On top of the oven, where it\'s warm: ' + listNames(s, ontop) + '.';
  return t;
}
function bakeLook(b, what) {
  if (what === 'rolls') {
    if (b < 12) return 'The rolls are still pale.';
    if (b < 30) return 'The rolls are starting to colour.';
    if (b < 38) return 'The rolls are pale gold. Nearly.';
    if (b < 47) return 'The rolls are the colour of a good biscuit. They look done.';
    if (b < 55) return 'The rolls are getting very dark.';
    return 'The rolls are burning.';
  }
  if (b < 12) return `The ${what} are still pale.`;
  if (b < 30) return `The ${what} are colouring, gold at the edges.`;
  if (b < 38) return `The ${what} are golden, getting there.`;
  if (b < 47) return `The ${what} are a deep brown. They look done.`;
  if (b < 55) return `The ${what} are very dark now.`;
  return `The ${what} are burning.`;
}
function ovenShortTemp(s) { return Math.round(s.ovenTemp); }

function mixerDesc(s) {
  let t = 'A big old dough mixer with a hook. ';
  if (s.where.dough === 'in:mixer') return t + 'The dough is sitting in the bowl.';
  const m = s.mix, parts = [];
  if (m.flour) parts.push(grams(m.flour) + ' of flour');
  if (m.water) parts.push(m.water + ' ml of water');
  if (m.yeast) parts.push(m.yeast + ' g of yeast');
  if (m.salt) parts.push(m.salt + ' g of salt');
  if (!parts.length) return t + 'The bowl is empty. You ADD things to it, for example ADD 500 G FLOUR, then turn it on.';
  return t + 'In the bowl so far: ' + joinAnd(parts) + '.';
}
function grams(g) { return g >= 1000 ? (g / 1000).toFixed(g % 1000 ? 2 : 0).replace(/0$/, '').replace(/\.$/, '') + ' kg' : g + ' g'; }

function flourDesc(s) {
  if (s.binFlour > 1000) return 'The flour bin is full of strong white flour.';
  return "The flour bin is nearly empty. There's enough in the bottom to dust the bench and feed Gerald, but not to make anything. The sacks are in the flour store across the yard.";
}

function geraldDesc(s) {
  const top = 'A big Kilner jar with GERALD on masking tape on the lid. Under it, older tape, older handwriting: GERALD 1979. Inside is a beige, bubbly batter.';
  if (!s.gerald.fed) return top + ' There\'s a layer of grey liquid on top, and when you open the lid it smells sharply of nail varnish remover. Even you can tell he\'s hungry.';
  const r = s.gerald.rise;
  if (r < 0.3) return top + ' Freshly fed and stirred. He smells of flour and, faintly, of yogurt.';
  if (r < 0.7) return top + ' He\'s full of small bubbles and creeping up the jar. He smells of yogurt and green apples.';
  return top + ' He has risen almost to the lid, full of big bubbles, smelling of yogurt and apples and something like beer. He looks pleased with himself.';
}

function loavesDesc(s) {
  const L = s.loaves;
  if (L.stage === 'cold') return 'Eight loaves in round wicker proving baskets on a trolley, cold from the fridge. You shaped them yesterday afternoon while Win told you exactly what was wrong with each one. They are, she said, the ugliest loaves she has ever put in a fridge. They\'re ready to go straight into a hot oven.';
  if (L.stage === 'out') return 'Eight loaves turned out of their baskets onto the floured bench, cold and wobbling, each with the spiral of its basket printed on top in flour. One of them, for reasons you can\'t explain, looks offended. ' +
    (L.scored ? 'Each has a neat slash along the top.' : 'They haven\'t been scored yet.');
  if (L.stage === 'baking') return bakeLook(L.bake, 'loaves');
  return 'Eight loaves. ' + loafVerdict(s, false);
}

function doughDesc(s) {
  const D = s.dough;
  if (!D) return 'There\'s no dough.';
  const r = D.rise;
  let t = D.texture + ' ';
  if (D.factor === 0) return t + 'It hasn\'t risen at all. It feels as if nothing\'s alive in it.';
  if (r < 0.3) t += 'It hasn\'t risen much yet.';
  else if (r < 0.75) t += 'It\'s puffing up, but it\'s nowhere near doubled.';
  else if (r < 0.95) t += 'It\'s nearly doubled.';
  else if (r <= 1.5) t += 'It has doubled, domed and wobbly. Poke it and the dent comes back slowly. Ready to shape.';
  else if (r <= 1.8) t += 'It has more than doubled and is pressing at the lid. It wants shaping now.';
  else t += 'It rose too far and has sunk back on itself, and smells of beer.';
  return t;
}

function rollsDesc(s) {
  const R = s.rolls;
  if (!R) return '';
  if (R.stage === 'raw') {
    const r = R.rise;
    let t = 'Forty rolls in rows on the two trays. ';
    if (r < 0.4) t += 'They\'re still small and tight.';
    else if (r < 0.75) t += 'They\'re puffing up, but they spring straight back when you press one.';
    else if (r <= 1.5) t += 'They\'ve risen, soft and pillowy, touching their neighbours. Press one and the dent comes back slowly. Ready for the oven.';
    else t += 'They\'ve risen too far and slumped into each other.';
    return t;
  }
  if (R.stage === 'baking') return bakeLook(R.bake * 40 / 15, 'rolls');
  return 'Forty rolls. ' + rollVerdict(s);
}

function catDesc(s) {
  let t = 'A large tabby with a torn ear and a collar with a brass tag: MR PEMBERTON. He looks at you as if you\'re late.';
  if (s.cat.inside) t += ' ' + catPlace(s);
  return t;
}
function catPlace(s) {
  if (s.ovenTemp > 90) {
    if (s.where.tub === 'on:oven') return 'He is sitting on the lid of the dough tub on top of the oven, which is warm, and does not intend to move.';
    return 'He is lying on top of the oven, where it\'s warm, in the shape of a loaf.';
  }
  return 'He is sitting under the bench with his paws tucked in.';
}

function fuseDesc(s) {
  return 'A grey fuse box with a cover that went missing years ago. A row of black switches, labelled underneath in faded capitals: LIGHTS. SOCKETS. SHOP. MIXER. OVEN. ' +
    (s.breaker ? 'They\'re all up.' : 'They\'re all up except OVEN, which is down.');
}

/* ---------------------------------------------------------------- state */

function fresh() {
  const s = {
    v: 1, time: START, loc: 'boxroom', seen: {}, moved: {}, moves: 0,
    where: {}, open: {}, pts: {},
    alarm: true, breaker: false, ovenOn: false, dial: 250, ovenTemp: 14, heat: 14, ovenWasReady: false,
    tinTemp: 11, lastSteam: -99,
    torchBatt: false, torchOn: false, jug: false,
    gerald: { fed: false, rise: 0 },
    mix: { flour: 0, water: 0, salt: 0, yeast: 0 },
    dough: null, rolls: null,
    loaves: { stage: 'cold', scored: false, steamed: false, bake: 0, loadTemp: 0, warm: 0, loadedAt: -1, outBy: null },
    win: { awake: 0, woken: 0, mumble: 0 },
    cat: { inside: false },
    timer: -1, shutter: false, sign: false,
    binFlour: 150, yeastLeft: 500,
    flags: {}, ended: false, how: null, lastNoun: null,
  };
  for (const id in OBJ) s.where[id] = OBJ[id].rooms ? 'multi' : (OBJ[id].loc ?? null);
  for (const id in OBJ) if (OBJ[id].closable) s.open[id] = false;
  return s;
}

/* ------------------------------------------------------- world queries */

function parentOf(loc) { const m = /^(in|on):(.+)$/.exec(loc || ''); return m ? { prep: m[1], id: m[2] } : null; }
function roomOf(s, id) {
  if (OBJ[id] && OBJ[id].rooms) return OBJ[id].rooms.includes(s.loc) ? s.loc : null;
  let l = s.where[id], n = 0;
  while (l && n++ < 12) {
    if (l === 'inv') return s.loc;
    const p = parentOf(l);
    if (!p) return l;
    l = s.where[p.id];
  }
  return null;
}
function isOpen(s, id) { return OBJ[id].closable ? !!s.open[id] : true; }
function dark(s) { return s.loc === 'cellar' && !(s.torchOn && roomOf(s, 'torch') === 'cellar'); }
function held(s, id) {
  let l = s.where[id], n = 0;
  while (l && n++ < 12) { if (l === 'inv') return true; const p = parentOf(l); if (!p) return false; l = s.where[p.id]; }
  return false;
}
function visible(s, id) {
  const o = OBJ[id];
  if (o.rooms) return o.rooms.includes(s.loc) && !dark(s);
  if (s.where[id] == null) return false;
  if (dark(s)) return held(s, id);
  if (id === 'cat' && s.cat.inside && s.loc === 'bakehouse') return true;
  let l = s.where[id], n = 0;
  while (l && n++ < 12) {
    if (l === 'inv' || l === s.loc) return true;
    const p = parentOf(l);
    if (!p) return false;
    if (p.prep === 'in' && !isOpen(s, p.id) && !OBJ[p.id].see) return false;
    l = s.where[p.id];
  }
  return false;
}
function contentsOf(s, id, prep) {
  return Object.keys(OBJ).filter(k => s.where[k] === prep + ':' + id);
}
function basketsEmpty(s) { return contentsOf(s, 'baskets', 'in').length === 0; }

function tempAt(s, id) {
  let l = s.where[id], n = 0;
  while (l && n++ < 12) {
    if (l === 'inv') return roomTemp(s, s.loc);
    const p = parentOf(l);
    if (!p) return roomTemp(s, l);
    if (p.id === 'oven') return p.prep === 'in' ? s.ovenTemp : s.heat + (s.ovenTemp - 14) * 0.035;
    if (OBJ[p.id].temp != null && p.prep === 'in') return OBJ[p.id].temp;
    l = s.where[p.id];
  }
  return 12;
}
function roomTemp(s, r) {
  return { boxroom: 19, landing: 19, winroom: 18, bakehouse: s.heat, shop: 13, yard: 6, store: 7, cellar: 11 }[r] ?? 12;
}

function the(id) { const o = OBJ[id]; return o.proper ? o.name : 'the ' + o.name; }
function an(s, id) {
  const o = OBJ[id];
  if (o.proper) return o.name;
  if (id === 'loaves') return s.loaves.stage === 'cold' ? 'eight loaves in proving baskets' : 'eight loaves';
  if (id === 'rolls') return 'forty rolls';
  if (id === 'dough') return 'the dough';
  if (o.plural) return o.name === 'batteries' ? 'two batteries' : 'some ' + o.name;
  return (/^[aeiou]/.test(o.name) ? 'an ' : 'a ') + o.name;
}
function listNames(s, ids) { return joinAnd(ids.map(i => an(s, i))); }
function joinAnd(a) { return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

/* ----------------------------------------------------------- scoring */

function award(s, key, msg) {
  if (s.pts[key]) return '';
  s.pts[key] = true;
  return `\n\n[${msg} You have ${points(s)} of ${MAXPTS} points.]`;
}
const points = s => Object.keys(s.pts).length;

/* --------------------------------------------------------- the clock */

function ev(s, where, text, interrupt) {
  // where: list of rooms where it's heard, or an object {room: text, '*': text}
  let msg = null;
  if (Array.isArray(where)) { if (where.includes(s.loc)) msg = text; }
  else { msg = where[s.loc] ?? where['*'] ?? null; interrupt = text; }
  if (msg) { s._ev.push(msg); if (interrupt) s._int = true; }
}
const DOWN = ['bakehouse', 'shop', 'cellar'];
const NEAR = ['bakehouse', 'shop', 'cellar', 'landing', 'yard'];

function tick(s) {
  s.time++;
  const t = s.time;

  // the oven
  const target = powered(s) ? s.dial : 14;
  if (s.ovenTemp < target) {
    s.ovenTemp = Math.min(target, s.ovenTemp + 4);
    if (!s.ovenWasReady && s.ovenTemp >= s.dial - 2) {
      s.ovenWasReady = true; s.readyAt = t;
      ev(s, { bakehouse: `The orange light on the oven clicks off. The gauge says ${Math.round(s.ovenTemp)}°: it's up to heat.` }, true);
    }
  } else if (s.ovenTemp > target) {
    s.ovenTemp = Math.max(target, s.ovenTemp - (powered(s) ? 2 : 1));
  }
  if (s.ovenTemp < s.dial - 15) s.ovenWasReady = false;
  const warmth = 14 + 10 * clamp((s.ovenTemp - 14) / 236, 0, 1);
  s.heat += (warmth - s.heat) / 30;
  s.tinTemp += (tempAt(s, 'tin') - s.tinTemp) / 12;

  // the dough rises at a rate set by where it is
  const D = s.dough;
  if (D && D.factor > 0) {
    const before = D.rise;
    D.rise += Math.max(0, tempAt(s, 'dough') - 4) / 1380 * D.factor;
    const here = roomOf(s, 'dough') === s.loc;
    if (before < 1 && D.rise >= 1 && here) ev(s, [s.loc], 'The dough has doubled. It\'s ready to shape.', true);
    if (before < 1.8 && D.rise >= 1.8 && here) ev(s, [s.loc], 'The dough has risen too far and sagged back on itself with a faint sigh. It smells of beer.', true);
  }
  const R = s.rolls;
  if (R && R.stage === 'raw' && R.factor > 0) {
    const before = R.rise;
    R.rise += Math.max(0, tempAt(s, 'rolls') - 4) / 1035 * R.factor;
    if (before < 0.95 && R.rise >= 0.95 && roomOf(s, 'rolls') === s.loc) ev(s, [s.loc], 'The rolls have puffed up and are touching their neighbours. They\'re ready for the oven.', true);
    if (s.cat.inside && s.where.trays === 'on:oven' && s.ovenTemp > 90 && !s.flags.paw && !s.flags.covered) {
      s.flags.catNear = (s.flags.catNear || 0) + 1;
      if (s.flags.catNear === 12) { s.flags.paw = true; ev(s, ['bakehouse'], 'Mister Pemberton gets up, turns round, and steps delicately across the rolls to a warmer bit of the oven. One roll now has a paw print in it.'); }
    }
  }
  if (R && R.stage === 'baking') {
    const before = R.bake;
    R.bake += s.ovenTemp > 100 ? s.ovenTemp / 220 : 0;
    if (before < 12 && R.bake >= 12) ev(s, { bakehouse: 'The rolls are turning gold, and the bakehouse smells of toast and summer. They must be nearly done.', '*': NEAR.includes(s.loc) ? 'A smell of fresh rolls drifts through from the bakehouse. They must be nearly done.' : null }, true);
    if (before < 18 && R.bake >= 18) ev(s, { bakehouse: 'The rolls are getting very dark.', '*': NEAR.includes(s.loc) ? 'The smell from the bakehouse has a darker edge to it now.' : null }, true);
    if (before < 22 && R.bake >= 22) ev(s, { '*': 'A smell of burning comes from the oven.' }, true);
  }

  // the loaves
  const L = s.loaves;
  if (L.stage === 'out') L.warm++;
  if (L.stage === 'baking') {
    const before = L.bake;
    L.bake += s.ovenTemp > 100 ? s.ovenTemp / 250 : 0;
    if (before < 20 && L.bake >= 20) ev(s, { bakehouse: 'The smell of baking bread fills the bakehouse.', '*': NEAR.includes(s.loc) ? 'The smell of baking bread comes through from the bakehouse.' : null });
    if (before < 39 && L.bake >= 39) ev(s, { bakehouse: 'The smell of the bread has deepened and gone nutty. It might be time to look.', '*': NEAR.includes(s.loc) || s.loc === 'winroom' ? 'The smell of the bread has changed, deeper and nuttier. It might be time to look.' : null }, true);
    if (before < 49 && L.bake >= 49) ev(s, { '*': 'The smell of the loaves has gone very dark and toasty.' }, true);
    if (before < 56 && L.bake >= 56) ev(s, { '*': 'There is a smell of burning bread.' }, true);
  }

  if (s.open.fridge) {
    s.fridgeOpen = (s.fridgeOpen || 0) + 1;
    if (s.fridgeOpen === 8 || s.fridgeOpen === 40) ev(s, ['bakehouse'], 'The walk-in fridge starts beeping at you, slowly and with great disappointment. Its door is open.');
  } else s.fridgeOpen = 0;
  if (s.gerald.fed) s.gerald.rise = Math.min(1.2, s.gerald.rise + 1 / 200);

  // the alarm
  if (s.alarm) {
    if (t === 126) ev(s, ['boxroom', 'landing'], '"TURN. IT. OFF," says Win, through the wall. Then she goes back to snoring.');
    if (t >= 135) { s.alarm = false; ev(s, ['boxroom', 'landing'], 'The alarm clock runs down and stops.'); }
  }
  if (s.timer === t) {
    s.timer = -1;
    ev(s, { bakehouse: 'The hen timer goes off on the shelf, rattling as if it\'s laying something.', '*': NEAR.includes(s.loc) ? 'From the bakehouse, the hen timer goes off, rattling.' : null }, true);
  }

  // the village wakes up
  if (t === 240) ev(s, ['boxroom', 'winroom', 'shop', 'landing'], 'Outside, a car goes by slowly, and its lights slide across the ceiling and away.');
  if (t === 320) ev(s, { winroom: 'Win\'s radio comes on by itself, very low. It\'s the shipping forecast: "Dogger, Fisher, German Bight. Southwest five or six. Rain later. Moderate or good." Win stops snoring to listen, without waking up.', landing: 'From Win\'s room a radio comes on, very low. The shipping forecast.' });
  if (t === 333) ev(s, ['winroom', 'landing'], 'Win\'s radio says "...and that completes the shipping forecast," and goes off. Win starts snoring again.');
  if (t === 340) ev(s, { yard: 'A robin starts up from somewhere on the wall, in the dark, practising.', store: 'Outside, a robin has started singing.', boxroom: 'Outside, a single bird starts singing in the dark.', bakehouse: 'Through the high window, faintly: a bird singing.' });
  if (t === 375) ev(s, ['shop', 'bakehouse', 'boxroom', 'winroom', 'landing'], 'Across the road, a van pulls up at the newsagent\'s and a bundle of papers hits the pavement.');
  if (t === 390) ev(s, ['boxroom', 'bakehouse', 'yard', 'store', 'shop'], 'The sky is beginning to lighten.');
  if (t === 410) ev(s, { shop: 'Voices outside the shutter. Somebody laughs. Somebody tries the door, which is pointless, and they know it.', bakehouse: 'Voices out in the street, by the shop.', '*': null }, true);
  if (t === OPEN && !s.shutter) ev(s, { '*': DOWN.includes(s.loc) || s.loc === 'yard' ? 'Someone knocks on the shutter: three knocks, polite but firm. It\'s seven o\'clock.' : 'From downstairs comes a knock on the shop shutter. It\'s seven o\'clock.' }, true);
}

function advance(s, n, interruptible) {
  let i = 0;
  for (; i < n && !s.ended; i++) {
    tick(s);
    if (s.time >= OPEN && s.shutter) { finish(s, 'opened'); break; }
    if (s.time >= OPEN + 15 && !s.shutter) { finish(s, 'win'); break; }
    if (interruptible && s._int) { i++; break; }
  }
  return i;
}

/* --------------------------------------------------------------- parser */

const NUMWORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100 };
const DIRS = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down', north: 'north', south: 'south', east: 'east', west: 'west', up: 'up', down: 'down',
  upstairs: 'up', downstairs: 'down', in: 'in', inside: 'in', out: 'out', outside: 'out', exit: 'out', leave: 'out', back: 'back' };

function clean(raw) {
  let c = raw.toLowerCase().replace(/[‘’]/g, "'").replace(/['"]/g, '').replace(/[^a-z0-9:.\- ]/g, ' ');
  c = c.replace(/\b(the|a|an|some|my|please|carefully|quickly|gently|just)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return c;
}
function sing(t) { return t.endsWith('ies') ? t.slice(0, -3) + 'y' : t.endsWith('es') && t.length > 4 ? t.slice(0, -1) : t.endsWith('s') ? t.slice(0, -1) : t; }
const WORDS = {};
for (const id in OBJ) { const set = new Set(); for (const w of OBJ[id].w.split(' ')) { set.add(w); set.add(sing(w)); } WORDS[id] = set; }

function resolve(s, phrase) {
  phrase = (phrase || '').trim().replace(/^(of|to|at|with) /, '');
  if (!phrase) return { err: 'What do you mean?' };
  if (/^(it|them|that|this)$/.test(phrase)) {
    if (s.lastNoun && visible(s, s.lastNoun)) return { id: s.lastNoun };
    return { err: "I'm not sure what you mean by \"" + phrase + '".' };
  }
  if (/^(all|everything)$/.test(phrase)) return { err: "One thing at a time. You've only got two hands, which is two more than Win has today." };
  phrase = phrase.replace(/\bdough tub\b/, 'tub');
  const toks = phrase.split(' ').filter(t => t && !/^(on|of|in|by|from|with|to|at|next|for|inside|beside|near|top|bottom|side)$/.test(t));
  if (!toks.length) return { err: 'What do you mean?' };
  const cands = Object.keys(OBJ).filter(id => toks.every(t => WORDS[id].has(t) || WORDS[id].has(sing(t))));
  let vis = cands.filter(id => visible(s, id));
  if (!vis.length && !dark(s)) {
    // something in a shut cupboard in this room: open it on the player's behalf
    for (const id of cands) {
      const p = parentOf(s.where[id]);
      if (p && OBJ[p.id].closable && !s.open[p.id] && roomOf(s, p.id) === s.loc) {
        s.open[p.id] = true;
        if (visible(s, id)) { s._pre = (s._pre || '') + `(first opening ${the(p.id)}) `; vis = [id]; break; }
        s.open[p.id] = false;
      }
    }
  }
  if (!vis.length) {
    if (dark(s)) return { err: 'It\'s too dark to see anything.' };
    if (cands.some(id => s.where[id] != null && OBJ[id].loc !== undefined)) return { err: `You can't see any ${phrase} here.` };
    return { err: `You can't see any ${phrase} here.` };
  }
  if (vis.length === 1) return { id: vis[0] };
  const exact = vis.filter(id => OBJ[id].name === phrase);
  const pool = exact.length ? exact : vis;
  pool.sort((a, b) => (held(s, b) - held(s, a)) || ((OBJ[b].prio || 0) - (OBJ[a].prio || 0)));
  if (pool.length > 1 && (OBJ[pool[0]].prio || 0) === (OBJ[pool[1]].prio || 0) && held(s, pool[0]) === held(s, pool[1]))
    return { err: 'Which do you mean: ' + joinOr(pool.slice(0, 4).map(the)) + '?' };
  return { id: pool[0] };
}
function joinOr(a) { return a.length < 2 ? a[0] : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]; }

function fail(s, msg) { s._cost = 0; return msg; }
function need(s, phrase) {
  const r = resolve(s, phrase);
  if (r.err) { s._cost = 0; return r; }
  s.lastNoun = r.id;
  return r;
}

/* ---------------------------------------------------------- the verbs */

function look(s, full = true) {
  if (dark(s)) return `${ROOMS.cellar.name}\nIt's absolutely dark. The air is cold and smells of brick and old apples. You won't find anything down here without a light. The steps go back up behind you.`;
  const R = ROOMS[s.loc];
  let t = R.name + '\n' + ((!full && R.short) ? R.short(s) : R.desc(s));
  const extra = [];
  if (s.loc === 'bakehouse' && s.cat.inside) extra.push('Mister Pemberton is here. ' + catPlace(s));
  for (const id of Object.keys(OBJ)) {
    if (OBJ[id].fixed || OBJ[id].person || s.where[id] !== s.loc) continue;
    extra.push(cap(an(s, id)) + (OBJ[id].plural || id === 'loaves' || id === 'rolls' ? ' are' : ' is') + ' here.');
  }
  for (const sid of Object.keys(OBJ)) {
    const o = OBJ[sid];
    if (!(o.surf || o.cont) || roomOf(s, sid) !== s.loc || s.where[sid] === 'inv' || held(s, sid)) continue;
    if (['airing', 'bag', 'apron', 'tin', 'fusebox', 'jar', 'tub'].includes(sid)) continue;
    for (const prep of ['on', 'in']) {
      if (prep === 'in' && !isOpen(s, sid) && !o.see) continue;
      let items = contentsOf(s, sid, prep).filter(i => !OBJ[i].fixed && !(sid === 'trays' && i === 'rolls') && true);
      if (sid === 'oven' && prep === 'in') items = items.filter(i => i !== 'loaves' && i !== 'trays').concat(contentsOf(s, 'oven', 'in').filter(i => i === 'loaves' || i === 'trays'));
      if (!items.length) continue;
      const where = prep === 'on' ? (sid === 'oven' ? 'On top of the oven' : 'On ' + the(sid)) : (sid === 'oven' ? 'In the oven' : 'In ' + the(sid));
      extra.push(`${where}: ${listNames(s, items.map(i => i === 'trays' && s.where.rolls === 'on:trays' ? 'rolls' : i))}.`);
    }
  }
  if (extra.length) t += '\n\n' + extra.join(' ');
  return t;
}

function examine(s, phrase) {
  s._cost = 0;
  if (/^(clock|time|watch)$/.test(phrase) && s.loc !== 'bakehouse' && s.loc !== 'boxroom') return `It's ${clock(s.time)}.`;
  if (/^(me|myself|self|yourself)$/.test(phrase)) return 'You slept in your clothes, and it shows. Nobody has ever left you in charge of anything this important, and the bakehouse knows it.';
  if (/^(room|around|here)$/.test(phrase)) return look(s);
  const r = need(s, phrase);
  if (r.err && /^(floor|ceiling|walls?)$/.test(phrase)) return 'Nothing special. Flour, mostly.';
  if (r.err) return r.err;
  const o = OBJ[r.id];
  let t = typeof o.d === 'function' ? o.d(s) : (o.d || `It's just ${the(r.id)}.`);
  if ((o.cont || o.surf) && !['oven', 'mixer', 'fusebox'].includes(r.id)) {
    for (const prep of ['in', 'on']) {
      if (prep === 'in' && (!o.cont || (!isOpen(s, r.id) && !o.see))) continue;
      if (prep === 'on' && !o.surf) continue;
      const items = contentsOf(s, r.id, prep).filter(i => !(r.id === 'airing' && OBJ[i].fixed) && true && !(r.id === 'trays' && i === 'rolls'));
      if (['bag', 'apron', 'cshelves', 'oven', 'chair'].includes(r.id)) continue;
      if (items.length) t += ` ${prep === 'in' ? 'In' : 'On'} ${o.plural ? 'them' : 'it'}: ${listNames(s, items)}.`;
      else if (r.id === 'tub' || r.id === 'jar' || r.id === 'trays' || r.id === 'peel' || r.id === 'airing' || r.id === 'fusebox' || r.id === 'apron' || r.id === 'bag' || r.id === 'baskets') continue;
    }
  }
  return t;
}

function inventory(s) {
  s._cost = 0;
  const items = Object.keys(OBJ).filter(id => s.where[id] === 'inv');
  if (!items.length) return 'You\'re empty-handed.';
  let t = 'You\'re carrying ' + listNames(s, items) + '.';
  for (const id of items) {
    const inside = contentsOf(s, id, 'in').concat(contentsOf(s, id, 'on'));
    if (inside.length && id !== 'bag') t += ` (${cap(id === 'peel' || id === 'trays' ? 'on' : 'in')} ${the(id)}: ${listNames(s, inside)}.)`;
  }
  if (s.where.torch === 'inv' && s.torchOn) t += ' The torch is on.';
  if (s.jug) t += ' The jug is full of water.';
  return t;
}

function move(s, dir) {
  if (dark(s) && dir !== 'up' && dir !== 'out') return fail(s, 'You stand very still in the dark. That seems best. The steps are behind you, going up.');
  let to = ROOMS[s.loc].exits[dir];
  const upstairs = ['boxroom', 'landing', 'winroom'].includes(s.loc);
  if (!to && dir === 'down' && upstairs) return goPlace(s, 'bakehouse');
  if (!to && dir === 'up' && !upstairs) return goPlace(s, 'landing');
  if (!to && dir === 'out' && s.loc !== 'yard' && s.loc !== 'store') return goPlace(s, 'yard');
  if (!to) {
    if (s.loc === 'shop' && /north|out/.test(dir)) return fail(s, s.shutter ? 'You stay behind the counter. That\'s where the baker goes.' : 'The shutter is down and locked.');
    if (s.loc === 'landing' && dir === 'up') return fail(s, 'There\'s no further up. There\'s a loft hatch, but nobody has been up there since 1997 and you\'re not starting now.');
    return fail(s, cantGo(s));
  }
  return goTo(s, to);
}
function cantGo(s) {
  const ex = Object.keys(ROOMS[s.loc].exits).filter(d => !['out', 'in', 'back'].includes(d));
  return `You can't go that way. From here you can go ${joinOr(ex)}.`;
}
function goTo(s, to) {
  const from = s.loc, notes = [];
  if (to === 'yard' && from === 'bakehouse') { if (!s.flags.backdoor) { s.flags.backdoor = true; notes.push('You turn the key in the back door and step out. The cold takes your breath.'); } }
  if (to === 'store' && !s.flags.bolt) { s.flags.bolt = true; notes.push('The bolt sticks, then gives.'); }
  if (to === 'cellar' && !s.flags.cellar) { s.flags.cellar = true; notes.push('You open the cellar door. The light switch at the top of the steps clicks and does nothing. Cold air comes up out of the dark.'); }
  if (s.where.sack === 'inv' && (to === 'landing' || to === 'cellar')) return fail(s, 'Not with a sixteen-kilo sack of flour on your shoulder. Put it down first.');
  s.loc = to;
  s._cost = 0;
  advance(s, 1);
  if (to === 'bakehouse' && from === 'yard' && !s.cat.inside) {
    s.cat.inside = true; s.where.cat = 'bakehouse';
    notes.push('Something pours off the wall behind you and past your ankles, and by the time you\'ve shut the door, the cat is inside, as if he always was.');
  }
  const firstTime = !s.seen[to];
  s.seen[to] = true;
  return (notes.length ? notes.join(' ') + '\n\n' : '') + look(s, firstTime);
}
function goPlace(s, phrase) {
  phrase = phrase.replace(/^(down|up|over|out|back|through|across|round|along)( to| into| in to)? /, '').replace(/^(the|to|into|in to) /, '').trim();
  let target = null;
  for (const [re, r] of PLACES) if (re.test(phrase)) target = r;
  if (!target) { const d = DIRS[phrase]; if (d) return move(s, d); return fail(s, `I don't know where "${phrase}" is. The places are the box room, the landing, Win's room, the bakehouse, the shop, the yard, the flour store and the cellar.`); }
  if (target === s.loc) return fail(s, 'You\'re already here.');
  if (dark(s) && target !== 'bakehouse') return fail(s, 'In the dark you can\'t find anything but the steps up.');
  const path = route(s.loc, target);
  if (!path) return fail(s, 'You can\'t see how to get there from here.');
  let out = '';
  for (let i = 0; i < path.length; i++) {
    const before = s.loc;
    out = goTo(s, path[i]);
    if (s.loc === before || s.ended) return out;
  }
  return out;
}
function route(a, b) {
  const prev = { [a]: null }, q = [a];
  while (q.length) {
    const r = q.shift();
    if (r === b) { const p = []; let x = b; while (x !== a) { p.unshift(x); x = prev[x]; } return p; }
    for (const to of Object.values(ROOMS[r].exits)) if (!(to in prev)) { prev[to] = r; q.push(to); }
  }
  return null;
}

function take(s, phrase) {
  const r = need(s, phrase); if (r.err) return r.err;
  const id = r.id, o = OBJ[id];
  if (id === 'sacks' || (id === 'sack' && s.where.sack == null)) {
    if (s.where.sack != null) return fail(s, 'One sack will do. It\'s sixteen kilos.');
    s.where.sack = 'inv'; s.moved.sack = true;
    return 'You squat, get your arms round a sack and heave it up onto your shoulder. It\'s like carrying a sleeping dog.';
  }
  if (id === 'dough') return takeDough(s);
  if (id === 'loaves') {
    if (s.loaves.stage === 'cold') return turnOut(s);
    if (s.loaves.stage === 'out') return fail(s, 'They\'re turned out on the bench. They go into the oven next, two at a time on the peel.');
    if (s.loaves.stage === 'baking') return unload(s, 'loaves');
  }
  if (id === 'rolls' && s.rolls && s.rolls.stage === 'baked' && s.where.rolls === 'in:baskets') return taste(s, 'rolls');
  if (id === 'rolls' && s.rolls) {
    if (s.rolls.stage === 'baking') return unload(s, 'rolls');
    return take(s, 'trays');
  }
  if (id === 'trays' && s.rolls && s.rolls.stage === 'baking') return unload(s, 'rolls');
  if (s.where[id] === 'inv') return fail(s, 'You\'ve already got ' + (o.plural ? 'them.' : 'it.'));
  if (o.person) {
    if (id === 'cat') return 'You pick up Mister Pemberton. He goes boneless and pours back out of your arms onto the floor, and walks away as if that was his idea.';
    return fail(s, o.fixedMsg || 'No.');
  }
  if (o.fixed) return fail(s, o.fixedMsg || (o.plural ? 'They\'re' : 'That\'s') + ' not going anywhere.');
  const p = parentOf(s.where[id]);
  let pre = '';
  if (p && OBJ[p.id].closable && !s.open[p.id]) { s.open[p.id] = true; pre = `(first opening ${the(p.id)}) `; }
  s.where[id] = 'inv'; s.moved[id] = true;
  if (id === 'lame') return pre + 'You slide the lame out of the apron pocket, carefully, because it\'s a razor blade.' + (s.loc !== 'winroom' ? '' : s.win.awake > 0 ? ' "Mind your fingers," says Win.' : ' Win shifts in her sleep and says "Mm."');
  if (id === 'gerald') return pre + 'You lift Gerald down. He\'s heavier than he looks, and older than you.';
  if (id === 'tin') return pre + 'You lift the roasting tin of stones. It weighs a ton.';
  if (id === 'yeast') return pre + 'Taken. It\'s cold and smells like a brewery.';
  return pre + 'Taken.';
}

function drop(s, phrase) {
  const r = need(s, phrase); if (r.err) return r.err;
  if (!held(s, r.id)) return fail(s, 'You aren\'t holding ' + (OBJ[r.id].plural ? 'them.' : 'that.'));
  if (r.id === 'dough' || r.id === 'rolls') return drop(s, r.id === 'dough' ? 'tub' : 'trays');
  if (dark(s)) { s.where[r.id] = 'cellar'; return 'You put it down somewhere in the dark.'; }
  if (s.loc === 'bakehouse' && r.id !== 'sack' && r.id !== 'cat') { s.where[r.id] = 'on:bench'; return `You put ${the(r.id)} on the bench.`; }
  s.where[r.id] = s.loc;
  if (r.id === 'sack') return 'You let the sack down off your shoulder with a whump and a small cloud of flour.';
  return 'Dropped.';
}

function putIn(s, xp, prep, yp) {
  if (/^(water|tap water)$/.test(xp)) {
    if (/jug/.test(yp)) return fill(s, 'jug');
    return pour(s, 'water', yp);
  }
  if (/^(jug)$/.test(xp)) return pour(s, 'jug', yp);
  if (/basket|display|shop|shelves in shop/.test(yp) && /loa|bread|sourdough|roll|bun|tray/.test(xp) && (s.loc === 'bakehouse' || s.loc === 'shop')) return display(s, /roll|bun|tray/.test(xp) ? 'rolls' : 'loaves');
  const ry = need(s, yp); if (ry.err) return ry.err;
  const y = ry.id;
  if (/^(flour|salt|yeast)$/.test(xp) && y === 'gerald') return feed(s, 'gerald');
  if (/^(flour|salt|yeast|water)$/.test(xp) && y === 'mixer') return fail(s, `How much? Weigh it out with something like ADD ${xp === 'flour' ? '500 G FLOUR' : xp === 'water' ? '300 ML WATER' : '20 G ' + xp.toUpperCase()}.`);
  if (/^(sack|sack of flour|flour)$/.test(xp) && y === 'mixer') return fail(s, 'You don\'t want sixteen kilos. Weigh out what you need, with something like ADD 500 G FLOUR.');
  const rx = need(s, xp); if (rx.err) return rx.err;
  const x = rx.id;
  s.lastNoun = x;
  if (x === y) return fail(s, 'That would take some doing.');
  if (y === 'oven' && (prep === 'in' || x === 'tin')) return loadOven(s, x);
  if (x === 'sack' && (y === 'bin' || y === 'flour')) return fillBin(s);
  if (x === 'batteries' && y === 'torch') return loadTorch(s);
  if (x === 'dough' && y === 'tub') return takeDough(s);
  if (x === 'dough' && y === 'trays') return shape(s);
  if (x === 'dough' && ['pedal', 'wbins', 'bin'].includes(y)) return binDough(s);
  if (x === 'loaves' && y === 'peel' && s.loaves.stage === 'cold') return turnOut(s);
  if (x === 'loaves' && y === 'oven') return loadOven(s, x);
  if ((x === 'loaves' || x === 'rolls') && y === 'baskets') return display(s, x);
  if (x === 'cat') return 'Mister Pemberton declines.';
  if (y === 'gerald') return fail(s, 'Gerald eats flour and water. Nothing else.');
  if (y === 'mixer') return fail(s, 'That\'s not in the recipe. You ADD flour, water, yeast and salt to the mixer.');
  if (OBJ[x].person) return fail(s, 'No.');
  let movingId = x;
  if (x === 'dough') movingId = 'tub';
  if (x === 'rolls') movingId = 'trays';
  if (x === 'loaves') {
    if (s.loaves.stage === 'cold') return fail(s, 'The loaves are in their baskets in the fridge. They stay there until the oven\'s hot.');
    if (s.loaves.stage === 'baking') return fail(s, 'They\'re in the oven.');
    if (s.loaves.stage === 'out' && !(y === 'oven' && prep === 'in')) return fail(s, 'Leave them on the bench till they go in the oven. They\'re wobbly enough already.');
  }
  const mo = OBJ[movingId];
  if (mo.fixed) return fail(s, mo.fixedMsg || 'That\'s not going anywhere.');
  if (OBJ[y].cont && !OBJ[y].surf && prep === 'on') prep = 'in';
  if (OBJ[y].surf && !OBJ[y].cont && prep === 'in') prep = 'on';
  if (!(prep === 'in' ? OBJ[y].cont : OBJ[y].surf)) return fail(s, `You can't put things ${prep} ${the(y)}.`);
  if (y === 'airing' && movingId === 'trays') return fail(s, 'Two big baking trays won\'t fit in the airing cupboard, and Win would want to know why you tried.');
  if (y === 'airing' && movingId === 'peel') return fail(s, 'The peel is longer than the cupboard.');
  if (movingId === 'sack' && y !== 'bench') { s.where.sack = s.loc; return 'You let the sack down on the floor.'; }
  if (['tin', 'jar', 'bag', 'apron', 'trays', 'peel', 'pedal', 'wbins', 'baskets', 'tub'].includes(y) && !['pedal', 'wbins'].includes(y) && !(y === 'baskets')) {
    if (y === 'tub' && x !== 'dough') return fail(s, 'The tub is for dough.');
    if (y !== 'tub') return fail(s, `There's no point putting that ${prep} ${the(y)}.`);
  }
  if (['pedal', 'wbins'].includes(y)) return fail(s, 'You\'d better not throw away anything of Win\'s.');
  if (y === 'baskets') return fail(s, 'The baskets are for bread.');
  if (y === 'fridge' && movingId === 'tub' && s.dough) { /* allowed: it just stops rising */ }
  // need to be holding it, or able to reach it
  if (roomOf(s, movingId) !== s.loc) return fail(s, `You haven't got ${the(movingId)}.`);
  if (roomOf(s, y) !== s.loc) return fail(s, `You can't reach ${the(y)}.`);
  let pre = '';
  if (prep === 'in' && OBJ[y].closable && !s.open[y]) { s.open[y] = true; pre = `(first opening ${the(y)}) `; }
  s.where[movingId] = prep + ':' + y; s.moved[movingId] = true;
  let t = pre + `You put ${the(movingId)} ${prep === 'on' && y === 'oven' ? 'on top of' : prep} ${the(y)}.`;
  if (y === 'airing' && movingId === 'tub') t += s.dough ? ' The dough settles in among the towels, next to the boiler. It\'s the warmest place in the house.' : '';
  if (y === 'oven' && prep === 'on' && s.ovenTemp > 90) t += ' It\'s warm up there.';
  if (y === 'fridge' && (movingId === 'tub' || movingId === 'trays')) t += ' It\'ll barely rise in there.';
  return t;
}

function display(s, x) {
  const st = x === 'loaves' ? s.loaves.stage : s.rolls && s.rolls.stage;
  if (st !== 'baked') return fail(s, 'They\'re not baked yet.');
  if (s.where[x] === 'in:baskets') return fail(s, 'They\'re in the baskets already.');
  const from = roomOf(s, x);
  if (from !== 'bakehouse' && from !== 'shop') return fail(s, 'You haven\'t got them with you.');
  if (s.loc !== 'shop') {
    if (s.loc !== 'bakehouse') return fail(s, 'The baskets are in the shop.');
    advance(s, 1); s.loc = 'shop';
  }
  s.where[x] = 'in:baskets';
  if (x === 'rolls') s.where.trays = 'on:rack';
  return `You carry the ${x} through and pile them into the baskets behind the counter. ` + (x === 'loaves' ? 'Even the offended one.' : 'The shop starts to smell like a shop.');
}

function open(s, phrase) {
  if (/^(door|doors)$/.test(phrase)) {
    if (s.loc === 'bakehouse') return fail(s, 'Which door? The back door, the cellar door, the fridge or the oven? (You can just walk through doors. GO EAST, for instance.)');
    if (s.loc === 'shop') phrase = 'shutter';
    if (s.loc === 'yard') return goTo(s, 'store');
  }
  const r = need(s, phrase); if (r.err) return r.err;
  const id = r.id;
  if (id === 'shutter') return openShutter(s);
  if (id === 'oven' && s.loaves.stage === 'baking' && s.loaves.steamed && !s.flags.vented && s.time - s.loaves.loadedAt >= 12) { s.flags.vented = true; s.ovenTemp -= 4; return 'You crack the oven door and let the last of the steam roll out, so the crust can dry and crackle. Then you shut it again.'; }
  if (id === 'oven') { s.ovenTemp = Math.max(14, s.ovenTemp - 4); return s.ovenTemp > 150 ? 'You open the oven door. A wall of heat comes out to meet you. You shut it again quickly. (To put things in, just PUT them IN THE OVEN.)' : 'You open the oven door and look in at the empty deck, then shut it again.'; }
  if (id === 'backdoor') { if (s.flags.backdoor) return fail(s, 'It\'s unlocked. Go east to go out.'); s.flags.backdoor = true; return 'You turn the key in the back door and open it. The cold comes in round your ankles. The yard is to the east.'; }
  if (id === 'cellardoor') { if (s.flags.cellar) return fail(s, 'It\'s open. The cellar is down the steps.'); s.flags.cellar = true; return 'You open the cellar door. The light switch at the top of the steps clicks and does nothing. Cold air comes up out of the dark.'; }
  if (id === 'storedoor') { if (s.flags.bolt) return fail(s, 'It\'s unbolted.'); s.flags.bolt = true; return 'The bolt sticks, then gives.'; }
  if (id === 'windoor') return fail(s, 'It\'s ajar already. Win\'s room is to the east.');
  if (id === 'till') return fail(s, 'The till drawer is locked, and there\'s nothing to sell till seven.');
  if (id === 'pedal' || id === 'wbins') return fail(s, 'You lift the lid. Nothing you need in there. You put it down again.');
  if (id === 'dadbox') return OBJ.dadbox.d(s);
  if (id === 'bin' || id === 'flour') { s._cost = 0; return flourDesc(s); }
  if (id === 'torch') return 'You unscrew the end of the torch. ' + (s.torchBatt ? 'Two batteries. You screw it back up.' : 'No batteries, just a scrap of paper rolled up inside. It says FRIDGE.');
  if (id === 'sack') return fail(s, 'It\'s easier to pour it straight into the flour bin. POUR THE SACK INTO THE BIN.');
  if (id === 'gerald') return 'You open the lid. ' + (s.gerald.fed ? 'He smells of yogurt and apples. You close it again.' : 'A sharp smell of nail varnish remover. He needs feeding. You close it again.');
  if (id === 'fusebox') return fail(s, 'The cover is long gone. The switches are right there.');
  if (!OBJ[id].closable) return fail(s, 'That doesn\'t open.');
  if (s.open[id]) return fail(s, 'It\'s already open.');
  s.open[id] = true;
  let t = `You open ${the(id)}.`;
  if (id === 'fridge') t = 'You haul on the handle. The heavy door unsticks with a sigh and cold rolls out over your feet.';
  if (id === 'airing') t = 'You open the airing cupboard. Warm air comes out, smelling of clean towels.';
  const inside = contentsOf(s, id, 'in').filter(i => !OBJ[i].fixed || id === 'fridge');
  if (inside.length) t += ' Inside: ' + listNames(s, inside.filter(i => i !== 'butter')) + (id === 'fridge' ? ', and butter, milk and eggs' : '') + '.';
  return t;
}
function close(s, phrase) {
  const r = need(s, phrase); if (r.err) return r.err;
  const id = r.id;
  if (id === 'shutter') return fail(s, s.shutter ? 'Not now. They\'re here.' : 'It\'s already down.');
  if (id === 'oven') return fail(s, 'The oven door is shut.');
  if (!OBJ[id].closable) return fail(s, 'That doesn\'t close.');
  if (!s.open[id]) return fail(s, 'It\'s already shut.');
  s.open[id] = false;
  return `You close ${the(id)}.`;
}

function openShop(s) {
  if (s.loc !== 'shop' && s.loc !== 'bakehouse') return fail(s, 'The shop is downstairs, through the bakehouse.');
  let pre = '';
  if (!held(s, 'key') && s.where.key === 'on:hooks') {
    if (s.time < 405) return fail(s, `It's ${clock(s.time)}. Win said seven. They'll be there at seven.`);
    s.where.key = 'inv'; pre = s.loc === 'shop' ? '(first fetching the shop key from the hook in the bakehouse) ' : '(first taking the shop key) ';
    if (s.loc === 'shop') advance(s, 2);
  }
  if (s.loc === 'bakehouse') { if (s.time < 405) return fail(s, pre + `It's ${clock(s.time)}. Win said seven. They'll be there at seven.`); s.loc = 'shop'; advance(s, 1); pre += '(going through to the shop) '; }
  return pre + openShutter(s);
}
function openShutter(s) {
  if (s.loc !== 'shop') return fail(s, 'The shutter is in the shop.');
  if (s.shutter) return fail(s, 'It\'s already up.');
  if (!held(s, 'key')) return fail(s, 'It\'s locked at the bottom. The key will be on the hooks in the bakehouse.');
  if (s.time < 405) return fail(s, `You could, but it's ${clock(s.time)} and the street is asleep. Win said seven. They'll be there at seven.`);
  s.shutter = true; s.sign = true;
  let t = 'You crouch, turn the key, and haul the shutter up. It goes with a noise like a goods train, and you flip the sign to OPEN.';
  t += award(s, 'open', 'You opened the shop.');
  if (s.time < OPEN) s.flags.openedEarly = true;
  if (s.time < OPEN) t += '\n\nThe street is grey and empty, but at the end of it two people are walking this way, pretending they aren\'t hurrying.';
  else { finish(s, 'opened'); }
  return t;
}

function turnOn(s, phrase) {
  if (/apron/.test(phrase)) return wear(s, phrase);
  if (/^(light|lights|lamp)$/.test(phrase) && s.loc !== 'cellar') return fail(s, {
    shop: 'You leave the shop lights off. Lights on in the shop and someone will think you\'re open.',
    winroom: 'And wake Win? Not unless you have to.', yard: 'There\'s no light out here except what comes from the bakehouse.',
    store: 'There isn\'t one. You can see well enough by the yard.', boxroom: 'The bedside lamp is on already.',
  }[s.loc] || 'The lights are on.');
  const r = need(s, phrase); if (r.err) return r.err;
  const id = r.id;
  if (['oven', 'ovenswitch', 'ovenlight'].includes(id)) {
    if (s.ovenOn) return fail(s, 'It\'s already on.' + (s.breaker ? '' : ' But nothing is happening.'));
    s.ovenOn = true;
    if (!s.breaker) return 'You push the big switch up to ON. It goes with a good solid clunk. Nothing else happens. No hum, no orange light, nothing on the gauge. Something somewhere must have tripped. In a building this old, the fuse box will be somewhere awkward.';
    return 'You push the big switch up to ON. The orange light comes on, and somewhere inside, the elements start to tick.';
  }
  if (id === 'breaker' || id === 'fusebox') return resetBreaker(s);
  if (id === 'torch') {
    if (!s.torchBatt) return fail(s, 'You click the switch. Nothing. It feels very light, as if it\'s empty inside.');
    if (s.torchOn) return fail(s, 'It\'s already on.');
    s.torchOn = true;
    return 'You click the torch on. A good strong beam.' + (s.loc === 'cellar' ? '\n\n' + look(s) : '');
  }
  if (id === 'mixer') return mix(s);
  if (id === 'alarm') return fail(s, 'It\'s ' + (s.alarm ? 'very much on already.' : 'done its job.'));
  if (id === 'sink' || id === 'water') return 'You run the tap for a moment. Lovely water. You turn it off.';
  if (id === 'radio') return fail(s, 'Leave it. It knows what it\'s doing.');
  if (id === 'cord') return fail(s, 'The pull cord clicks. Nothing. The bulb\'s gone.');
  if (id === 'steambtn') return pressSteam(s);
  if (id === 'timer') return fail(s, 'SET THE TIMER FOR some number of minutes.');
  if (id === 'phone') return fail(s, OBJ.phone.d(s));
  return fail(s, 'That doesn\'t turn on.');
}
function turnOff(s, phrase) {
  const r = need(s, phrase); if (r.err) return r.err;
  const id = r.id;
  if (id === 'alarm') {
    if (!s.alarm) return fail(s, 'It\'s already quiet.');
    s.alarm = false;
    return 'You find the button on the back of the alarm clock. The silence is enormous. Through the wall, Win\'s snoring carries on without a hitch.';
  }
  if (['oven', 'ovenswitch', 'ovenlight'].includes(id)) {
    if (!s.ovenOn) return fail(s, 'It\'s already off.');
    s.ovenOn = false;
    return 'You push the big switch down to OFF. The oven will start to cool.';
  }
  if (id === 'torch') { if (!s.torchOn) return fail(s, 'It\'s already off.'); s.torchOn = false; return 'You click the torch off.' + (s.loc === 'cellar' ? ' The dark comes back at once.' : ''); }
  if (id === 'breaker') return fail(s, 'You leave it alone. You\'ve only just got it on.');
  if (id === 'mixer') return fail(s, 'It isn\'t running.');
  return fail(s, 'That isn\'t on.');
}

function resetBreaker(s) {
  if (dark(s)) return fail(s, 'You feel along the wall in the dark. Brick, damp, something soft you would rather not think about. You can\'t find anything.');
  if (s.loc !== 'cellar') return fail(s, 'The fuse box is in the cellar.');
  if (s.breaker) return fail(s, 'It\'s already up.');
  s.breaker = true;
  let t = 'You push the OVEN switch up. It clicks and stays.';
  t += s.ovenOn ? ' Through the ceiling you hear a hum start up in the bakehouse: the oven, waking.' : ' Nothing happens down here, but the oven should have power now.';
  return t + award(s, 'power', 'You got the power back on.');
}

function pressSteam(s) {
  if (s.loc !== 'bakehouse') return fail(s, 'The steam button is on the oven.');
  if (!powered(s)) return 'You press the steam button. Nothing happens, which, judging by the note, is the best result you could have hoped for.';
  s.breaker = false;
  s.flags.pressedSteam = true;
  return 'You press the steam button. There\'s a hiss, a smell like a hairdryer full of fluff, and a CLUNK from somewhere under your feet. The oven\'s hum dies and the orange light goes out. So that\'s what Dave is for.';
}

function push(s, phrase) {
  if (/^(button|steam|steam button)$/.test(phrase) && s.loc === 'bakehouse') return pressSteam(s);
  const r = need(s, phrase); if (r.err) return r.err;
  const id = r.id;
  if (id === 'breaker' || id === 'fusebox') return resetBreaker(s);
  if (id === 'steambtn' || id === 'steamnote') return pressSteam(s);
  if (id === 'alarm') return turnOff(s, 'alarm');
  if (['oven', 'ovenswitch'].includes(id)) return s.ovenOn ? turnOff(s, 'oven') : turnOn(s, 'oven');
  if (id === 'cord') return fail(s, 'Click. Nothing. The bulb\'s gone.');
  if (id === 'dough' || id === 'rolls' || id === 'loaves') return poke(s, phrase);
  if (id === 'pedal') return 'The lid of the pedal bin pops up and shuts again.';
  return fail(s, 'Nothing happens.');
}

function setTo(s, phrase, n) {
  if (/timer|hen/.test(phrase)) return setTimer(s, n);
  if (/dial|oven|thermostat|temperature|temp|knob/.test(phrase)) {
    if (s.loc !== 'bakehouse') return fail(s, 'The oven is in the bakehouse.');
    if (n < 100 || n > 300) return fail(s, 'The dial goes from 100 to 300.');
    s.dial = n;
    return `You turn the dial to ${n}.` + (powered(s) ? (s.ovenTemp > n + 5 ? ' The oven will cool down to it.' : s.ovenTemp < n - 5 ? ' The orange light comes on.' : '') : '');
  }
  return fail(s, 'You can set the dial (SET THE DIAL TO 220) or the timer (SET THE TIMER FOR 40).');
}
function setTimer(s, n) {
  if (!visible(s, 'timer')) return fail(s, 'The timer is on the shelves in the bakehouse.');
  if (!(n > 0 && n <= 120)) return fail(s, 'It only goes up to two hours.');
  s.timer = s.time + n;
  return `You wind the hen round to ${n} minutes. It starts ticking. It will go off at ${clock(s.timer)}.`;
}

/* -------- the rolls */

function srcFlour(s) { return roomOf(s, 'sack') === 'bakehouse' ? 16000 : s.binFlour; }
function add(s, amt, unit, what, target) {
  what = what.replace(/^(of )/, '').trim();
  const kinds = { flour: /^(strong )?(white )?(bread )?flour$|^sack$|^sack of flour$/, water: /^(tap |warm |lukewarm |blood warm |hot |cold )?water$|^jug$/, salt: /^salt$/, yeast: /^(fresh )?yeast$|^(block of )?yeast$/ };
  let kind = null;
  if (/spoon|cup|pinch|handful|dash|splash|scoop|bit/.test(unit + ' ' + what)) return fail(s, 'Win\'s card goes by weight. Weigh it on the scale in grams, like ADD 10 G SALT.');
  for (const k in kinds) if (kinds[k].test(what)) kind = k;
  if (!kind) {
    if (/butter|milk|egg|sugar|oil/.test(what)) return fail(s, 'Not in these rolls. The card says flour, water, yeast and salt.');
    return fail(s, 'The card only asks for flour, water, yeast and salt.');
  }
  if (target && /gerald|jar|starter/.test(target)) return feed(s, 'gerald');
  if (target && !/mixer|bowl/.test(target)) return fail(s, 'You weigh things into the mixer bowl.');
  if (s.loc !== 'bakehouse') return fail(s, 'The mixer is in the bakehouse.');
  if (s.dough || (s.rolls && !s.flags.binned)) return fail(s, s.where.dough === 'in:mixer' ? 'The dough is already mixed.' : 'You\'ve already made the dough for the rolls.');
  let g = amt;
  if (/^(kg|kgs|kilos?|kilograms?|l|litres?|liters?)$/.test(unit || '')) g = amt * 1000;
  if (/^cl$/.test(unit || '')) g = amt * 10;
  g = Math.round(g);
  if (!unit && amt < 10 && (kind === 'flour' || kind === 'water')) return fail(s, `${amt} gram${amt === 1 ? '' : 's'}? Did you mean ${amt} ${kind === 'flour' ? 'kilos' : 'litres'}? Say ADD ${amt} KG ${kind.toUpperCase()}, or give it in grams.`);
  if (g <= 0) return fail(s, 'That\'s not very much.');
  if (kind === 'flour') {
    const have = srcFlour(s);
    if (s.mix.flour + g > have) return fail(s, have < 1000 ? 'The flour bin is nearly empty: enough to dust the bench, not to make forty rolls. The sacks are in the flour store across the yard.' : 'That\'s more flour than the bowl will take.');
    if (s.mix.flour + g > 5000) return fail(s, 'That\'s more than the bowl will take.');
    s.mix.flour += g;
    s._cost = 2;
    return `You weigh out ${grams(g)} of flour on the scale and tip it into the mixer bowl.` + tally(s);
  }
  if (kind === 'water') {
    if (s.mix.water + g > 4000) return fail(s, 'That would be soup.');
    s.mix.water += g;
    s._cost = 2;
    return `You run the tap till it's blood warm and measure ${g} ml${g > 1000 ? ', in more than one jugful,' : ''} into the bowl.` + tally(s);
  }
  if (kind === 'yeast') {
    if (!visible(s, 'yeast')) return fail(s, 'You\'ll need the yeast. It\'s in the fridge.');
    if (g > s.yeastLeft) return fail(s, 'There isn\'t that much yeast.');
    s.yeastLeft -= g; s.mix.yeast += g;
    s._cost = 1;
    return `You crumble ${g} g of yeast into the bowl.` + tally(s);
  }
  if (!visible(s, 'salt')) return fail(s, 'You\'ll need the salt. It\'s on the shelves in the bakehouse.');
  if (g > 500) return fail(s, 'That\'s a frightening amount of salt.');
  s.mix.salt += g;
  s._cost = 1;
  return `You weigh out ${g} g of salt and add it.` + tally(s);
}
function tally(s) {
  const m = s.mix, p = [];
  if (m.flour) p.push(grams(m.flour) + ' flour');
  if (m.water) p.push(m.water + ' ml water');
  if (m.yeast) p.push(m.yeast + ' g yeast');
  if (m.salt) p.push(m.salt + ' g salt');
  return ' (In the bowl: ' + p.join(', ') + '.)';
}
function addNoAmount(s, what, target) {
  if (target && /gerald|jar|starter/.test(target)) return feed(s, 'gerald');
  if (/gerald/.test(what)) return fail(s, 'Gerald isn\'t an ingredient in the rolls. He\'s a family member.');
  return fail(s, `How much? Weigh it out with something like ADD ${/water/.test(what) ? '300 ML WATER' : /salt|yeast/.test(what) ? '20 G ' + what.toUpperCase() : '500 G FLOUR'}.`);
}

function mix(s) {
  if (s.loc !== 'bakehouse') return fail(s, 'The mixer is in the bakehouse.');
  if (s.dough) return fail(s, s.where.dough === 'in:mixer' ? 'It\'s mixed. Get the dough into the tub to rise.' : 'You\'ve already made the dough.');
  if (s.rolls) return fail(s, 'You\'ve already made the rolls.');
  const m = s.mix;
  if (!m.flour) return fail(s, m.water ? 'The hook stirs the water round like a spoon in tea. You turn it off. It needs flour.' : 'The bowl is empty. ADD the ingredients first: the recipe card is on the wall.');
  const hyd = m.water / m.flour, salt = m.salt / m.flour, yeast = m.yeast / m.flour;
  let texture;
  if (hyd < 0.4) texture = 'It\'s a crumbly, shaggy mess that never comes together.';
  else if (hyd < 0.58) texture = 'The dough is stiff and tight, like plasticine.';
  else if (hyd < 0.62) texture = 'The dough is a little firm.';
  else if (hyd <= 0.68) texture = 'The dough is smooth and soft and comes cleanly away from the bowl.';
  else if (hyd <= 0.75) texture = 'The dough is sticky and slack.';
  else texture = 'It\'s more of a batter than a dough.';
  let factor = clamp(yeast / 0.025, 0, 2.2);
  if (salt < 0.01) factor *= 1.3; else if (salt > 0.03) factor *= 0.6;
  const ok = m.flour >= 1800 && m.flour <= 2200 && hyd >= 0.62 && hyd <= 0.68 && salt >= 0.017 && salt <= 0.023 && yeast >= 0.021 && yeast <= 0.029;
  const feel = hyd < 0.4 ? 'It\'s a crumbly mess.' : hyd < 0.58 ? 'It\'s stiff and tight.' : hyd < 0.62 ? 'It\'s a little firm.' : hyd <= 0.68 ? 'It\'s smooth and soft.' : hyd <= 0.75 ? 'It\'s sticky and slack.' : 'It\'s more batter than dough.';
  s.dough = { rise: 0, factor, texture: feel, hyd, salt, yeast, flour: m.flour, ok };
  s.where.dough = 'in:mixer';
  s._cost = 8;
  let t = 'You switch the mixer on. It grinds, then settles into a thump, thump, thump that shakes the floor. For eight minutes the dough goes from rubble to rags to something that slaps against the sides of the bowl. Then you switch it off.\n\n' + texture;
  if (factor === 0) t += ' You realise you never added any yeast.';
  if (salt < 0.01) t += ' You pinch off a bit and taste it. It tastes of nothing at all.';
  else if (salt > 0.03) t += ' You pinch off a bit and taste it. It\'s like a mouthful of the sea.';
  if (ok) t += award(s, 'mix', 'The dough is right.');
  t += '\n\nIt wants to go into the dough tub to rise.';
  return t;
}

function takeDough(s) {
  if (!s.dough) return fail(s, 'There isn\'t any dough.');
  if (s.where.dough === 'in:tub') return take(s, 'tub');
  if (!visible(s, 'tub')) return fail(s, 'You\'ll want the dough tub for that. It\'s on the shelves.');
  s.where.dough = 'in:tub';
  if (s.where.tub !== 'inv') { s.where.tub = 'inv'; s.moved.tub = true; }
  return 'You scrape the dough out of the bowl into the tub and put the lid on. It\'s heavy, and it feels alive. You\'re holding the tub. Now somewhere warm, the card says.';
}
function binDough(s) {
  if (!s.dough) return fail(s, 'There isn\'t any dough.');
  s.dough = null; s.where.dough = null; s.mix = { flour: 0, water: 0, salt: 0, yeast: 0 };
  s.flags.binned = true;
  return 'You scrape the dough into the pedal bin. It\'s a waste, and you feel it. But you can start again: the bowl is clean and empty.';
}

function shape(s) {
  if (!s.dough) return fail(s, s.rolls ? 'You\'ve already shaped the rolls.' : 'There isn\'t any dough yet. The recipe card is on the wall.');
  if (s.loc !== 'bakehouse') return fail(s, 'You need the bench in the bakehouse for that.');
  if (roomOf(s, 'dough') !== 'bakehouse') return fail(s, 'The dough is somewhere else.');
  if (!visible(s, 'trays')) return fail(s, 'You\'ll need the baking trays.');
  const D = s.dough;
  if (D.rise < 0.75 && D.factor > 0 && !s.flags.shapeWarn) {
    s.flags.shapeWarn = true; s.confirm = 'shape';
    return fail(s, 'The card says to let it double first, somewhere warm, and it\'s nowhere near. Shape it anyway?');
  }
  s._cost = 20;
  let feel;
  if (D.rise < 0.5) feel = 'It\'s dense and sulky and hardly risen.';
  else if (D.rise < 0.75) feel = 'It\'s only half risen, and still tight.';
  else if (D.rise <= 1.6) feel = 'It\'s soft and full of air, and it sighs when you tip it out.';
  else feel = 'It\'s slack and over-risen and smells of beer.';
  s.rolls = { stage: 'raw', rise: -0.35, bake: 0, factor: D.factor * (D.rise > 1.8 ? 0.7 : 1), bulk: D.rise, mixOk: D.ok, hyd: D.hyd, salt: D.salt };
  s.dough = null; s.where.dough = null;
  s.where.rolls = 'on:trays';
  s.where.trays = 'on:bench'; s.moved.trays = true;
  if (s.where.tub === 'inv') s.where.tub = 'on:bench';
  let t = 'You tip the dough out onto the floured bench. ' + feel + ' You cut it into pieces with the scraper and weigh each one on the scale, eighty grams or near enough, and roll them under a cupped hand the way Win showed you with the loaves, until each one tightens into a ball. Forty rolls in rows of five on the two trays. It takes twenty minutes, and your shoulders know about it.';
  if (D.rise >= 0.8 && D.rise <= 1.6) t += award(s, 'bulk', 'The dough was well risen.');
  t += '\n\nNow they need to prove again, somewhere warm, until they\'re puffy.';
  return t;
}

/* -------- the loaves */

function turnOut(s) {
  const L = s.loaves;
  if (L.stage !== 'cold') return fail(s, L.stage === 'out' ? 'They\'re already turned out, on the bench.' : 'That\'s long done.');
  if (s.loc !== 'bakehouse') return fail(s, 'The loaves are in the fridge in the bakehouse.');
  if (s.ovenTemp < 200 && !s.flags.turnWarn) {
    s.flags.turnWarn = true; s.confirm = 'turn';
    return fail(s, `The oven's at ${Math.round(s.ovenTemp)}°. Win's note says straight from the fridge into a hot oven, and if you turn them out now they'll sit on the bench and spread. Turn them out anyway?`);
  }
  let pre = '';
  if (!s.open.fridge) { s.open.fridge = true; pre = '(first opening the fridge) '; }
  L.stage = 'out';
  s.where.loaves = 'on:bench';
  return pre + 'You dust the end of the bench with flour and wheel the trolley out of the fridge. One by one you turn the baskets over and lift them off. Eight loaves, cold and wobbling, each with the spiral of its basket printed on top in flour. They are, as Win said, ugly. One of them, for reasons you can\'t explain, looks offended.\n\nNext: score them, then into the oven.';
}

function scoreLoaves(s, withp) {
  const L = s.loaves;
  if (withp && /knife|bread knife/.test(withp)) return fail(s, 'You try the corner of one with the bread knife. It drags and snags. Not with this. Win\'s note says the lame.');
  if (L.stage === 'cold') return fail(s, 'They\'re still in their baskets. Turn them out first.');
  if (L.stage !== 'out') return fail(s, 'It\'s too late for that.');
  if (L.scored) return fail(s, 'They\'re scored.');
  if (roomOf(s, 'loaves') !== s.loc) return fail(s, 'The loaves aren\'t here.');
  if (!held(s, 'lame')) {
    if (visible(s, 'knife') || held(s, 'knife')) return fail(s, 'You try one with the bread knife. It drags and snags. Win\'s note says the lame. The lame is what you need.');
    return fail(s, 'With what? Win\'s note says the lame is in the jar by the till.');
  }
  L.scored = true;
  s._cost = 2;
  return 'One quick slash along each loaf, at a shallow angle, the way Win said: confident, not deep. The first one is a mess. By the fourth you\'ve got it. By the eighth you\'re showing off to nobody.' + award(s, 'scored', 'You scored the loaves.');
}

function loadOven(s, x) {
  if (s.loc !== 'bakehouse') return fail(s, 'The oven is in the bakehouse.');
  if (x === 'peel') x = s.loaves.stage === 'out' ? 'loaves' : x;
  if (x === 'torch' || x === 'batteries') return loadTorch(s);
  if (x === 'trays' || x === 'rolls') x = 'rolls';
  if (x === 'tin') {
    if (!held(s, 'tin') && roomOf(s, 'tin') !== s.loc) return fail(s, 'You haven\'t got it.');
    if (s.where.tin === 'in:oven') return fail(s, 'It\'s already in there.');
    s.where.tin = 'in:oven'; s.moved.tin = true;
    s.ovenTemp = Math.max(14, s.ovenTemp - 5);
    return 'You open the oven door, slide the tin of stones onto the bottom of the deck, at the side, and shut it.' + (s.ovenTemp > 150 ? ' The stones will need a while to get hot.' : ' The stones will heat up with the oven.');
  }
  if (x === 'dough' || x === 'tub') return fail(s, 'You\'d be baking it in a plastic tub. Win would never speak to you again.');
  if (x === 'gerald') return fail(s, 'You will not bake Gerald.');
  if (x === 'cat') return fail(s, 'No.');
  if (x === 'loaves') {
    const L = s.loaves;
    if (L.stage === 'cold') return fail(s, 'They\'re still in their proving baskets. TURN OUT THE LOAVES first.');
    if (L.stage === 'baking') return fail(s, 'They\'re in.');
    if (L.stage === 'baked') {
      if (L.bake >= 36) return fail(s, 'They\'re baked.');
      if (s.ovenTemp < 180) return fail(s, 'The oven isn\'t hot enough.');
      L.stage = 'baking'; s.where.loaves = 'in:oven';
      return 'You slide them back in for a bit longer.';
    }
    if (s.where.trays === 'in:oven') return fail(s, 'The rolls are in the oven. It\'s one batch at a time.');
    if (s.ovenTemp < 200) return fail(s, `The gauge says ${Math.round(s.ovenTemp)}°. Not yet. The note says the light goes off when it's up to heat.`);
    L.stage = 'baking'; L.loadTemp = s.ovenTemp; L.loadedAt = s.time;
    s.where.loaves = 'in:oven'; if (s.where.peel !== 'inv') s.where.peel = 'on:hooks';
    s.ovenTemp -= 15;
    s._cost = 2;
    L.soaked = s.readyAt != null && s.time - s.readyAt >= 10;
    let t = 'You open the door into the heat and load them two at a time: slide the peel under, carry them to the back of the deck, and snatch the peel out from under them the way Win showed you yesterday on a cold oven. Four trips. The loaves stay where they\'re put. Mostly.';
    if (s.time - s.lastSteam <= 2 && s.tinTemp > 180) { L.steamed = true; t += ' You shut the door on an oven still full of steam.' + award(s, 'steam', 'The loaves got their steam.'); }
    else if (s.where.tin === 'in:oven' && s.tinTemp > 180 && s.jug) {
      s.jug = false; s.lastSteam = s.time; s.tinTemp -= 60; L.steamed = true;
      t += ' Then, before you shut the door, you throw the jug of water onto the hot stones. The oven roars like a train going into a tunnel, steam boils out at you, and you slam the door on it.' + award(s, 'steam', 'The loaves got their steam.');
    }
    else if (s.where.tin === 'in:oven' && s.tinTemp > 180) t += ' You shut the door. The stones are hot. Now the steam, quickly.';
    else t += ' You shut the door.';
    if (!L.scored) t += ' You didn\'t score them.';
    return t;
  }
  if (x === 'rolls') {
    const R = s.rolls;
    if (!R) return fail(s, 'There aren\'t any rolls yet.');
    if (R.stage === 'baking') return fail(s, 'They\'re in.');
    if (R.stage === 'baked') return fail(s, 'They\'re baked.');
    if (s.where.loaves === 'in:oven') return fail(s, 'The loaves are in the oven. It\'s one batch at a time.');
    if (s.ovenTemp < 180) return fail(s, `The gauge says ${Math.round(s.ovenTemp)}°. That's not hot enough for rolls.`);
    R.stage = 'baking'; R.proof = R.rise; R.loadTemp = s.ovenTemp;
    s.where.trays = 'in:oven';
    s.ovenTemp -= 10;
    s._cost = 1;
    let t = 'You slide the two trays onto the deck and shut the door.';
    if (s.dial > 235) t += ' (The card says 220 for rolls, and the dial\'s at ' + s.dial + '.)';
    if (R.rise >= 0.75 && R.rise <= 1.5) t += award(s, 'proof', 'The rolls were well proved.');
    return t;
  }
  return fail(s, 'That doesn\'t need baking.');
}

function pour(s, xp, yp) {
  // water, the jug or the sack onto/into something
  if (/^sack|flour$/.test(xp) && /bin/.test(yp || 'bin')) return fillBin(s);
  if (/^(water|jug|jug of water)$/.test(xp)) {
    const target = yp || '';
    if (!visible(s, 'jug') && s.loc !== 'bakehouse') return fail(s, 'You haven\'t got any water.');
    if (/stone|tin|oven|deck/.test(target)) return steam(s);
    if (/gerald|jar|starter/.test(target)) return feed(s, 'gerald');
    if (/mixer|bowl/.test(target)) return fail(s, 'How much? ADD 300 ML WATER, for example.');
    if (/sink|drain/.test(target) || !target) { if (s.jug) { s.jug = false; return 'You pour the water away.'; } return fail(s, 'It\'s empty.'); }
    return fail(s, 'Better not.');
  }
  return fail(s, 'You can\'t pour that.');
}
function fill(s, phrase) {
  if (!/jug/.test(phrase)) return fail(s, 'You can fill the jug.');
  if (s.loc !== 'bakehouse') return fail(s, 'The sink is in the bakehouse.');
  if (s.jug) return fail(s, 'It\'s full.');
  s.jug = true; s.where.jug = s.where.jug || 'inv';
  return 'You fill the jug at the tap.';
}
function steam(s) {
  if (s.loc !== 'bakehouse') return fail(s, 'The oven is in the bakehouse.');
  let pre = '';
  if (!s.jug) { s.jug = true; pre = 'You fill the jug at the tap. '; }
  if (s.where.tin !== 'in:oven') {
    if (held(s, 'tin') || visible(s, 'tin')) return fail(s, pre + 'Pour water on cold stones and you get wet stones. The tin needs to be in the oven, and hot.');
    return fail(s, pre + 'You hold the jug and look at the oven. Throw water on the bare deck? That\'s how you crack a deck. You need something hot in there to throw it onto.');
  }
  s.jug = false;
  if (s.tinTemp < 150) { s.tinTemp -= 20; return pre + 'You open the door and pour the water onto the stones. It fizzes a bit and lies there in a puddle. They aren\'t hot enough yet.'; }
  s.lastSteam = s.time; s.tinTemp -= 60;
  let t = pre + 'You open the door and throw the jug of water onto the stones. The oven roars like a train going into a tunnel, a cloud of steam boils out round the door, and you slam it shut.';
  const L = s.loaves;
  if (L.stage === 'baking' && s.time - L.loadedAt <= 2) {
    if (!L.steamed) { L.steamed = true; t += ' Through the glass, the loaves are lost in fog.' + award(s, 'steam', 'The loaves got their steam.'); }
    else t += ' They\'ve had plenty already.';
  } else if (L.stage === 'baking') t += ' It\'s too late to do the loaves much good now. Their crust has already set.';
  else if (L.stage === 'out') t += ' The steam won\'t last. If the loaves are going in, they need to go in now.';
  else t += ' It fades away to nothing in a minute or two.';
  return t;
}
function fillBin(s) {
  if (roomOf(s, 'sack') !== s.loc || s.where.sack == null) return fail(s, 'You haven\'t got a sack.');
  if (s.loc !== 'bakehouse') return fail(s, 'The flour bin is in the bakehouse.');
  s.where.sack = null; s.binFlour += 16000;
  s._cost = 2;
  return 'You slit the sack and pour it into the flour bin in a long white rush. A cloud rises and settles on everything, including you. The bin is full.';
}

function unload(s, what) {
  if (s.loc !== 'bakehouse') return fail(s, 'The oven is in the bakehouse.');
  if (!what) what = s.where.loaves === 'in:oven' ? 'loaves' : s.where.trays === 'in:oven' ? 'rolls' : null;
  if (!what) {
    if (s.where.tin === 'in:oven') { s.where.tin = 'on:bench'; return 'You hook the hot tin of stones out with a cloth and put it on the bench.'; }
    return fail(s, 'There\'s nothing in the oven.');
  }
  if (what === 'loaves') {
    const L = s.loaves;
    if (L.stage !== 'baking') return fail(s, 'The loaves aren\'t in the oven.');
    L.stage = 'baked'; s.where.loaves = 'on:rack';
    s.ovenTemp -= 10; s._cost = 2;
    let t = 'You open the door to a wall of heat and the smell of bread, and peel the loaves out two at a time onto the cooling rack. ' + loafVerdict(s, true);
    if (L.bake >= 36 && L.bake <= 55) t += award(s, 'loaves', 'The loaves are baked.');
    else if (L.bake < 36) t += ' (They can go back in: PUT THE LOAVES IN THE OVEN.)';
    return t;
  }
  const R = s.rolls;
  if (!R || R.stage !== 'baking') return fail(s, 'The rolls aren\'t in the oven.');
  R.stage = 'baked'; s.where.trays = 'on:rack';
  s.ovenTemp -= 8; s._cost = 1;
  let t = 'You slide the trays out onto the rack. ' + rollVerdict(s);
  if (R.bake >= 11 && R.bake <= 19) t += award(s, 'rolls', 'The rolls are baked.');
  return t;
}

function loafQuality(L) {
  const b = L.bake;
  return b < 20 ? 'raw' : b < 36 ? 'pale' : b <= 47 ? 'good' : b <= 55 ? 'dark' : 'burnt';
}
function loafVerdict(s, fresh) {
  const L = s.loaves, q = loafQuality(L);
  let t = {
    raw: 'They\'re pale and soft-sided, and when you knock on the bottom of one it thuds. Far too soon.',
    pale: 'They\'re pale gold, and when you knock on the bottom of one it sounds dull. Not quite there.',
    good: 'They\'re a deep conker brown, crackling quietly as they cool, and when you knock on the bottom of one it sounds hollow. Proper bread.',
    dark: 'They\'re very dark, nearly black along the edges of the cuts. Well fired, a baker would call it. Some people like that.',
    burnt: 'They\'re burnt. Not charcoal, but the kind of burnt that no amount of scraping fixes.',
  }[q];
  if (q === 'raw' || q === 'burnt') return t;
  const flaws = [];
  if (!L.scored) flaws.push('they\'ve burst out along their sides wherever they liked');
  if (!L.steamed) flaws.push('the crust is dull and they didn\'t rise much in the oven');
  if (L.loadTemp && L.loadTemp < 230) flaws.push('they went into a cool oven and spread');
  else if (L.soaked === false) flaws.push('their bottoms are a little pale, because the deck wasn\'t hot through yet');
  if (L.warm > 75) flaws.push('they sat out too long before baking and slumped');
  if (flaws.length) t += ' ' + cap(joinAnd(flaws)) + '.';
  else if (q === 'good' || q === 'dark') t += ' The cuts have opened up into proper ears. They\'re beautiful. They\'re still ugly, but they\'re beautiful.';
  return t;
}
function rollQuality(R) {
  if (R.bake > 22) return 'burnt';
  if (R.bake < 8) return 'raw';
  if (R.factor === 0 || R.bulk < 0.6 || (R.proof != null && R.proof < 0.5) || R.hyd < 0.58) return 'dense';
  if (R.bulk > 1.8 || (R.proof != null && R.proof > 1.6) || R.hyd > 0.75) return 'flat';
  if (R.bake < 11) return 'pale';
  if (R.bake > 19) return 'dark';
  if (R.salt < 0.01) return 'bland';
  if (R.salt > 0.03) return 'salty';
  return 'good';
}
function rollVerdict(s) {
  return {
    raw: 'They\'re still pale and doughy.',
    burnt: 'They\'re black on the bottom and dark on top. Burnt.',
    dense: 'They\'re small and hard, like golden pebbles. They didn\'t rise properly.',
    flat: 'They\'ve spread out flat and pale-sided, and run into each other.',
    pale: 'They\'re pale and soft. A little underdone.',
    dark: 'They\'re dark brown, nearly too far.',
    bland: 'They look perfect. You pull one apart and taste it. It tastes of nothing. The salt.',
    salty: 'They look perfect. You pull one apart and taste it, and your eyes water. The salt.',
    good: 'They\'re the colour of a good biscuit, risen and squashed together where they touched, and when you pull one apart it steams. They\'re perfect. You eat one. You have to.',
  }[rollQuality(s.rolls)];
}

/* -------- Gerald, Win, the cat */

function feed(s, phrase) {
  const r = need(s, phrase); if (r.err) return r.err;
  if (r.id === 'cat') return fail(s, 'You look for cat food. There isn\'t any, which is probably the note\'s doing: PEMBERTON HAS BEEN FED. WHATEVER HE SAYS. Mister Pemberton says otherwise, at length.');
  if (r.id === 'win') return fail(s, 'She\'s asleep.');
  if (r.id === 'dough' || r.id === 'loaves' || r.id === 'rolls') return fail(s, 'It doesn\'t need feeding. Gerald does.');
  if (r.id !== 'gerald') return fail(s, 'That doesn\'t eat.');
  if (s.gerald.fed) return fail(s, 'You fed him already. Gerald is a sourdough starter, not a Labrador.');
  if (s.loc !== 'bakehouse') return fail(s, 'You\'ll need flour and water, and the bakehouse has both.');
  s.gerald.fed = true;
  s._cost = 2;
  return 'You pour off the grey liquid and spoon most of him into the pedal bin, keeping a cupful, the way Win does. Then you stir in a scoop of flour from the bin and the same again of water until he\'s like thick batter, and put the lid back on loose. Gerald takes it with a sort of sigh.' + award(s, 'gerald', 'You fed Gerald.');
}

const doneAll = s => s.loaves.stage === 'baked' && s.rolls && s.rolls.stage === 'baked';
const WIN_TOPICS = [
  ['done', /done|finished|baked|ready|out of the oven|all done|made it|did it/, s => doneAll(s) ? '"All of it?" The eye opens properly. "Loaves and rolls?" You nod. "Show-off," she says, and smiles, and is asleep again before the smile has finished.'
    : s.loaves.stage === 'baked' ? '"Loaves out?" You nod. "Knocked on the bottom?" You nod. "Good. Now the rolls."' : '"Not yet, it isn\'t," she says. "I can\'t smell it."'],
  ['photo', /photo|picture|1979|old days/, () => '"Dad. And Gerald." She smiles with her eyes shut. "Forty-seven years, that jar. Longer than the van, longer than Mum\'s hip."'],
  ['oven', /oven|switch|power|electric|breaker|fuse|trip|hum|heat|hot/, s => s.flags.pressedSteam && !s.breaker ? '"You pressed the button," she says. It isn\'t a question. "Cellar. Push it back up. Don\'t do it again."'
    : powered(s) ? (s.ovenTemp >= s.dial - 2 ? '"Is the light off? Then it\'s hot. Give it a quarter of an hour more if you can, so the deck\'s hot through."' : '"Hour to get hot," she mumbles. "Light goes off. Then it\'s ready."')
    : s.ovenOn || s.flags.cellar ? '"It\'ll have tripped," she says into the pillow. "Fuse box. Cellar. Torch is in the drawer." A pause. "Batteries are in the fridge." Another pause. "Don\'t say anything."'
    : '"Big switch on the side," she says. "Oven first, always. It wants an hour."'],
  ['torch', /torch|batter|light|dark|cellar/, s => s.torchBatt ? '"You\'ve got a torch, haven\'t you? Cellar\'s under the stairs. Mind the mangle."' : '"Torch in the drawer. Batteries in the fridge." She opens the other eye to make sure you aren\'t laughing.'],
  ['gerald', /gerald|starter|jar|feed|discard/, s => s.gerald.fed ? '"You fed him? Good." A pause. "Did you keep the lid loose? He likes to breathe."' : '"Keep a cupful, bin the rest," she says. "Then flour and water, same again of each. Stir him. He\'s not fussy." Her eyes close. "He\'s older than you."'],
  ['salt', /salt/, () => '"Two percent. Of the flour, love. Not the dough. The flour."'],
  ['water', /water/, () => '"Sixty-five. Of the flour. Blood warm, mind. It\'s cold in that bakehouse."'],
  ['yeast', /yeast/, () => '"Two and a half. Of the flour. Crumble it in, it\'s not a stock cube."'],
  ['rolls', /roll|dough|recipe|card|sum|percent|math|flour|mix|weigh|shape|divide/, s => s.rolls ? (s.rolls.stage === 'baked' ? '"Rolls done? Then sit down for five minutes. You\'ve earned it."' : '"Prove them till they\'re puffy and the dent comes back slow. Then 220. Fifteen minutes."')
    : s.dough ? '"Somewhere warm till it\'s doubled," she says. "Then divide it. Eighty grams. Roll them tight."'
    : '"It\'s all of the flour, love. Flour\'s a hundred. Two kilos is a hundred. Work it out from there." Then, as you\'re going: "Sacks are in the store."'],
  ['prove', /prove|proof|rise|warm|cold|airing|double/, () => '"Airing cupboard," she says. "Don\'t tell environmental health."'],
  ['steam', /steam|button|dave/, s => s.loaves.steamed ? '"Did it roar? Then it\'s done. Leave it."' : '"Don\'t press it. Dave\'s coming Tuesday." She thinks. "Dad\'s stones. Cellar. In the oven while it heats. Water on them the second the bread\'s in. Quick."'],
  ['stones', /stone|tin|grandad|dad|frank|father/, () => '"Dad did that. Stones in a tin. Steam like a train." She\'s quiet a moment. "Put it in while the oven heats, so it\'s hot through."'],
  ['lame', /lame|blade|razor|score|cut|slash|till/, s => held(s, 'lame') ? '"Shallow," she says. "Like you mean it. Don\'t saw."' : '"Jar by the till." Then, after a while: "No. Pocket. Apron." Her good hand flaps toward the chair.'],
  ['loaves', /loa|sourdough|bread|fridge|bake|knock|turn out/, s => s.loaves.stage === 'baked' ? '"Out already? Did they sound hollow?" You say they did. "Then they\'re done. Leave them be."'
    : s.loaves.stage === 'baking' ? '"Forty minutes. Don\'t keep opening the door."' : '"Straight from the fridge. Hot oven. Score, steam, forty minutes. Knock on the bottom." A sigh. "You shaped them, so they\'ll be ugly. They\'ll eat."'],
  ['shop', /shop|shutter|key|open|seven|customer|dobson/, () => '"Key\'s on the hook. Seven. Not before. They\'ll stand there."'],
  ['cat', /cat|pemberton/, () => '"He\'s been fed," says Win. "Whatever he tells you. And he\'s not allowed in the bakehouse." A pause. "He knows that."'],
  ['wrist', /wrist|arm|ladder|sling|hurt|pain/, () => '"Ladder," she says darkly, as if it might be listening.'],
  ['time', /time|late|clock|hurry/, s => `"What time is it?" You tell her: ${clock(s.time)}. ` + (s.time < 300 ? '"Mm. Plenty."' : s.time < 390 ? '"Mm. You\'re all right."' : '"Then what are you doing up here?"')],
  ['next', /what to do|what now|what next|what should|what do i|next|help|stuck|where do i start/, s => nextStep(s)],
  ['you', /me|you|worried|scared|nervous|fine|okay|ok|awake/, () => '"You\'ll be fine," she says, with her eyes shut. "I wouldn\'t have let you otherwise."'],
];
const WIN_DREAMS = ['"Not in the good bowl," she says, quite clearly, and goes on snoring.', '"Tell Dave," she murmurs. "Tell Dave I know."', '"Forty minutes," she says. "Forty."', '"The swans can wait," says Win, asleep.', 'She smiles in her sleep and says, "Gerald."', '"Who moved the sea," she mutters, and turns over as far as the sling allows.'];

function wake(s) {
  if (s.loc !== 'winroom') return fail(s, 'Win is in her room across the landing.');
  if (s.win.awake > 0) return fail(s, 'She\'s awake. Sort of. ASK WIN ABOUT whatever it is.');
  s.win.woken++;
  s.win.awake = 4;
  const burning = (s.loaves.stage === 'baking' && s.loaves.bake > 54) || (s.rolls && s.rolls.stage === 'baking' && s.rolls.bake > 21);
  if (s.win.woken === 1) return '"Win," you say. Then, "Win." Then you touch her good shoulder.\n\nShe opens one eye. "What\'s burning?" ' + (burning ? 'Something is, actually.' : 'Nothing\'s burning. "Good." The eye considers you. "What, then?"') + '\n\n(You can ASK WIN ABOUT something.)';
  if (s.win.woken < 4) return 'You touch her shoulder. One eye opens. "Mm. What now, love?"';
  return 'You touch her shoulder. One eye opens. "Love," she says, "I\'m going to start charging."';
}
function ask(s, who, topic) {
  const r = need(s, who); if (r.err) return r.err;
  if (r.id === 'cat') return 'Mister Pemberton listens to the question with his eyes half closed, and decides it\'s beneath him.';
  if (r.id === 'gerald') return 'Gerald bubbles, once.';
  if (r.id !== 'win') return fail(s, 'There\'s no answer.');
  if (s.win.awake <= 0) {
    const d = WIN_DREAMS[s.win.mumble++ % WIN_DREAMS.length];
    return d + ' (She\'s asleep. You could WAKE her.)';
  }
  s.win.awake = 4;
  s.win.asked = s.win.asked || {};
  for (const [key, re, f] of WIN_TOPICS) if (re.test(topic)) {
    const said = f(s), again = s.win.asked[key] === said;
    s.win.asked[key] = said;
    return again ? 'She sighs without opening her eyes. "I told you, love." And then she tells you again, slower: ' + said : said;
  }
  return '"Mm?" she says. "Ask me about the bread, love."';
}

function poke(s, phrase) {
  const r = need(s, phrase); if (r.err) return r.err;
  if (r.id === 'dough' || r.id === 'tub') {
    if (!s.dough) return fail(s, 'There\'s no dough.');
    const x = s.dough.rise;
    s._cost = 0;
    if (x < 0.75) return 'You press a floured finger into the dough. The dent springs straight back. It needs longer.';
    if (x <= 1.6) return 'You press a floured finger into the dough. The dent comes back slowly and doesn\'t quite fill. That\'s the sign: it\'s ready.';
    return 'You press a finger in and the whole thing sighs and sinks. Over-risen.';
  }
  if (r.id === 'rolls' || r.id === 'trays') {
    if (!s.rolls) return fail(s, 'There are no rolls.');
    if (s.rolls.stage !== 'raw') return 'Warm and crusty.';
    const x = s.rolls.rise; s._cost = 0;
    if (x < 0.75) return 'You press a roll gently. It springs straight back. They need longer.';
    if (x <= 1.5) return 'You press a roll gently. The dent comes back slowly. They\'re ready for the oven.';
    return 'You press a roll and it collapses a little. They\'ve gone too far.';
  }
  if (r.id === 'loaves') return knock(s, 'loaves');
  if (r.id === 'cat') return stroke(s, 'cat');
  if (r.id === 'win') return wake(s);
  if (r.id === 'oven' && s.ovenTemp > 60) return fail(s, 'It\'s hot. You know it\'s hot. That\'s why you didn\'t.');
  s._cost = 0;
  return 'Nothing special.';
}
function knock(s, phrase) {
  if (/door|shutter/.test(phrase)) return s.loc === 'landing' ? 'You knock softly on Win\'s door. The snoring carries on, unbothered.' : 'Knock knock. Nobody\'s there.';
  const r = need(s, phrase); if (r.err) return r.err;
  if (r.id === 'loaves') {
    const L = s.loaves;
    if (L.stage === 'baking') return fail(s, 'They\'re in the oven. TAKE THE LOAVES OUT first.');
    if (L.stage !== 'baked') return fail(s, 'They\'re not baked yet.');
    const q = loafQuality(L);
    return { raw: 'A dull thud. Not done.', pale: 'A dull sort of knock. Not quite done.', good: 'You turn one over and knock on the bottom. It sounds hollow, like knocking on a door. Done.', dark: 'Very hollow. Very done.', burnt: 'It sounds like knocking on a log.' }[q];
  }
  if (r.id === 'rolls') return s.rolls && s.rolls.stage === 'baked' ? 'They\'re rolls. They sound like rolls.' : fail(s, 'They\'re not baked yet.');
  if (r.id === 'win') return wake(s);
  return 'Knock knock.';
}
function stroke(s, phrase) {
  const r = need(s, phrase); if (r.err) return r.err;
  if (r.id === 'cat') return 'You stroke Mister Pemberton. He allows it. He even purrs, briefly, then remembers who he is and stops.';
  if (r.id === 'win') return 'You smooth her hair back. "Mm," she says. "Gerald."';
  if (r.id === 'gerald') return 'You pat the jar. It seems like the right thing to do.';
  return 'Nothing happens.';
}

function smell(s, phrase) {
  s._cost = 0;
  if (!phrase) {
    if (s.loaves.stage === 'baking' && s.loaves.bake > 55) return 'Burning.';
    if (s.loc === 'bakehouse') return s.loaves.stage === 'baking' ? 'Bread. The best smell in the world, and you made it, sort of.' : (s.ovenTemp > 150 ? 'Hot steel and flour' : 'Flour, cold steel') + (s.loaves.stage === 'baked' || (s.rolls && s.rolls.stage === 'baked') ? ', and fresh bread, which is the best smell there is.' : ', and a sour, beery note from Gerald\'s jar.');
    return { boxroom: 'Lavender and flour.', landing: 'Warm towels.', winroom: 'Sleep and Germolene.', shop: 'Old bread, polish and the street.', yard: 'Cold and bins.', store: 'Flour and dust.', cellar: 'Damp brick and old apples.' }[s.loc];
  }
  const r = need(s, phrase); if (r.err) return r.err;
  if (r.id === 'gerald') return s.gerald.fed ? 'Yogurt and green apples, and something beery underneath.' : 'Nail varnish remover. He\'s hungry.';
  if (r.id === 'yeast') return 'Beer and putty.';
  if (r.id === 'loaves') return s.loaves.stage === 'cold' ? 'Faintly sour, cold, like yogurt.' : s.loaves.stage === 'baked' ? 'Warm crust and something nutty. You could cry.' : 'Like dough.';
  if (r.id === 'cat') return 'Cat.';
  if (r.id === 'dough') return 'Yeasty.';
  return 'Nothing much.';
}
function listen(s) {
  s._cost = 0;
  if (s.alarm && (s.loc === 'boxroom' || s.loc === 'landing')) return 'The alarm clock, mostly.';
  if (s.loc === 'winroom' || s.loc === 'landing') return s.time >= 320 && s.time < 333 ? 'The shipping forecast, very low.' : 'Win, snoring.';
  if (s.loc === 'bakehouse') return powered(s) ? 'The strip lights, and the oven ticking.' : 'The strip lights humming, and the fridge.';
  if (s.loc === 'yard') return s.time >= 340 ? 'A robin, somewhere on the wall.' : 'A long way off, a lorry on the bypass.';
  return 'Nothing much.';
}
function taste(s, phrase) {
  const r = need(s, phrase); if (r.err) return r.err;
  if (r.id === 'rolls' && s.rolls && s.rolls.stage === 'baked') return rollQuality(s.rolls) === 'bland' ? 'It tastes of nothing. You forgot the salt.' : 'You eat a roll. It\'s still warm. It\'s the best thing you have ever eaten, and you\'re not even exaggerating much.';
  if (r.id === 'loaves' && s.loaves.stage === 'baked') return 'You don\'t cut one. You want to. You don\'t. That\'s for Win.';
  if (r.id === 'gerald') return 'You dip a finger in. Sour, sharp, like apples and yogurt. You make a face.';
  if (r.id === 'yeast') return 'You nibble a crumb of yeast. Don\'t.';
  if (r.id === 'dough') return 'Raw dough. You know better, but you do it anyway.';
  return fail(s, 'You\'d better not.');
}

/* -------- waiting and the end */

function wait(s, n, untilT) {
  s._cost = 0;
  if (s.ended) return '';
  if (untilT != null) n = untilT - s.time;
  if (n <= 0) return fail(s, `It's already ${clock(s.time)}.`);
  if (n > 300) n = 300;
  const start = s.time;
  const done = advance(s, n, true);
  const mins = s.time - start;
  if (s.ended) return '';
  return mins === n ? `Time passes. It's ${clock(s.time)}.` : `You wait ${mins} minute${mins === 1 ? '' : 's'}. It's ${clock(s.time)}.`;
}
function waitFor(s, what) {
  if (/oven|heat|light/.test(what)) {
    if (!powered(s)) return fail(s, 'You could wait for ever. The oven isn\'t heating.');
    if (s.ovenTemp >= s.dial - 2) return fail(s, 'It\'s up to heat.');
    const n = Math.ceil((s.dial - 2 - s.ovenTemp) / 4) + 1;
    return wait(s, n);
  }
  if (/dough|rise|double/.test(what) && s.dough) return wait(s, 240);
  if (/rolls|prove/.test(what) && s.rolls && s.rolls.stage === 'raw') return wait(s, 240);
  if (/loaves|bread|bake|rolls/.test(what)) return wait(s, 60);
  if (/timer/.test(what) && s.timer > s.time) return wait(s, s.timer - s.time);
  if (/seven|7|open|customers|morning|dawn/.test(what)) return wait(s, null, OPEN);
  if (/win/.test(what)) return wait(s, null, OPEN + 15);
  return wait(s, 5);
}

function sleep(s) {
  if (s.loc !== 'boxroom') return fail(s, 'Not here. And not now.');
  s._cost = 0;
  s.slept = true;
  while (!s.ended) { tick(s); s._ev = []; if (s.time >= OPEN + 20) finish(s, 'slept'); }
  return 'You lie back down on top of the duvet. Just for five minutes. Just to rest your eyes.';
}

function finish(s, how) {
  if (s.ended) return;
  s.ended = true; s.how = how;
  s._ev.push(ending(s, how));
}

function ending(s, how) {
  const L = s.loaves, R = s.rolls;
  if (L.stage === 'baking') L.stage = 'baked';
  if (R && R.stage === 'baking') R.stage = 'baked';
  const lq = L.stage === 'baked' ? loafQuality(L) : 'none';
  const rq = R && R.stage === 'baked' ? rollQuality(R) : 'none';
  const hasLoaves = lq !== 'none' && lq !== 'burnt' && lq !== 'raw';
  const hasRolls = rq !== 'none' && rq !== 'burnt' && rq !== 'raw';
  const P = [];
  if (how === 'slept') {
    P.push('You wake to Win standing over you in her dressing gown with her arm in its sling. The window is full of grey daylight. It\'s twenty past seven.\n\n"Love," she says.\n\nDownstairs, someone is knocking on the shutter, politely, for the third time.');
    P.push('She doesn\'t say anything else. She goes down, one-handed, and you hear the shutter go up, and her voice, and other voices. Later you will help her bake a few loaves, and she will tell you that the first time she was left in charge she slept through it too. You won\'t know whether to believe her.');
    P.push(scoreLine(s));
    return '* * *\n\n' + P.join('\n\n');
  }
  if (how === 'opened' && !s.flags.openedEarly) P.push('There are already six of them on the pavement, and they come in out of the cold rubbing their hands. These are the people who buy bread here at seven o\'clock, and have done for longer than you\'ve been alive.');
  else if (how === 'opened') P.push('The two people at the end of the street have become six, and they come in out of the cold rubbing their hands. These are the people who buy bread here at seven o\'clock, and have done for longer than you\'ve been alive.');
  else P.push('At a quarter past seven the bakehouse door opens and Win comes through in her dressing gown with her arm in its sling. She looks at the shutter, and at you, and takes the key off the hook with her good hand and goes and lets them in. They come in out of the cold rubbing their hands: the people who buy bread here at seven o\'clock, and have done for longer than you\'ve been alive.');

  if (L.stage === 'baked' && s.where.loaves !== 'in:baskets' || (R && R.stage === 'baked' && s.where.rolls !== 'in:baskets')) {
    if (hasLoaves || hasRolls) P.push('You run the bread through from the cooling rack in armfuls and pile it into the baskets while they watch.');
  }

  const D = { none: 'Mrs Dobson is first, as she has been every morning since decimalisation. She looks at the empty baskets where the sourdough should be, then at you. "Win\'s wrist, is it," she says.',
    raw: 'Mrs Dobson is first, as she has been every morning since decimalisation. She picks up a loaf, squeezes it, and puts it down again. "That wants another twenty minutes," she says, and she\'s right.',
    pale: 'Mrs Dobson is first, as she has been every morning since decimalisation. She picks up a loaf, knocks on the bottom, and holds it up to the light like a suspicious banknote. "Pale," she says. She buys it anyway.',
    good: 'Mrs Dobson is first, as she has been every morning since decimalisation. She picks up a loaf, turns it over, and knocks on the bottom herself. Then she looks at you properly for the first time. "That\'ll do," she says, which from Mrs Dobson is a medal.',
    dark: 'Mrs Dobson is first, as she has been every morning since decimalisation. "Well fired!" she says, holding one up to the light, delighted. "Forty years I\'ve been asking Win for one like this." She buys two.',
    burnt: 'Mrs Dobson is first, as she has been every morning since decimalisation. She picks up the least black of the loaves and taps it with a fingernail. "For the birds," she says kindly, and buys it anyway.' }[lq];
  let d = D;
  if (hasLoaves && !L.scored) d += ' She runs a thumb along the split in its side. "Forgot to score them," she says, not unkindly.';
  else if (hasLoaves && !L.steamed) d += ' "Bit dull on top," she adds. "Still."';
  P.push(d);

  const V = { none: hasLoaves ? 'Dev from the garage wants a dozen rolls for the lads. There aren\'t any. He takes a loaf and a promise.' : 'Dev from the garage wants a dozen rolls for the lads. There aren\'t any. He takes the promise.',
    raw: 'Dev from the garage takes a dozen rolls, squeezes one, and says "Doughy," as if it\'s a compliment.',
    good: 'Dev from the garage wants a dozen rolls for the lads, and eats one before he\'s out of the door. He comes back for two more.',
    dense: 'Dev from the garage takes a dozen rolls for the lads, weighs the bag in his hand, and says they look "very filling", which is a kindness.',
    flat: '"Bit flat," says Dev from the garage, taking a dozen rolls for the lads. "Lads won\'t mind. Lads won\'t notice."',
    pale: '"Bit pale," says Dev from the garage. "Like me in February." He takes a dozen anyway.',
    dark: '"Proper toasted," says Dev from the garage, approving, and takes a dozen.',
    salty: '"Bit salty," says Dev from the garage, eyes watering, after his first bite. "Lads like salt." He takes a dozen.',
    bland: 'Dev from the garage eats a roll on the spot, chews, and looks thoughtful. "Is there salt in these?" There isn\'t.',
    burnt: 'Dev from the garage looks at the rolls, then at you, and buys a loaf instead.' };
  P.push(V[rq] + (s.flags.paw && hasRolls ? ' One of his has a paw print in it. He doesn\'t notice.' : ''));

  P.push(hasLoaves || hasRolls ? 'Jan the postie, at the end of her round, says she could smell it from the corner. They always say that, Win told you. It\'s still nice.' : 'Jan the postie says she\'ll come back tomorrow, and you believe her.');

  let w = '';
  if (how === 'opened') w += 'At ten past seven Win comes down in her dressing gown, with her arm in its sling, and stands in the bakehouse doorway taking it all in. ';
  else w += 'When they\'ve gone, Win stands in the bakehouse taking it all in. ';
  if (s.cat.inside) w += (s.ovenTemp > 90 ? 'Mister Pemberton watches her from the top of the oven' : 'Mister Pemberton watches her from under the bench') + ' with the air of someone who did most of the work, until she picks him up with her good arm and puts him out of the back door without a word. ';
  if (s.gerald.fed) w += 'She goes to the shelf first and lifts the lid on Gerald, who has risen nearly to the top of his jar, and sniffs, and nods. ';
  else w += 'She goes to the shelf first and lifts the lid on Gerald, and sniffs, and gives you a look that has three generations in it. Then she feeds him herself, one-handed, flour everywhere, without a word, which is worse. ';
  if (s.open.fridge) w += 'On her way back she shuts the fridge door with her hip. ';
  if (hasLoaves) w += 'Then she pulls the end off one of the loaves, the heel, the baker\'s bit, and eats it standing up with her eyes shut.\n\n"Ugly," she says. "Good."';
  else if (lq === 'burnt' || rq === 'burnt') w += 'Then she picks up something black off the rack, knocks on it, and laughs so hard she has to hold her sling.';
  else if (hasRolls) w += 'Then she pulls a roll in half and eats it standing up.\n\n"Good," she says, with her mouth full.';
  else w += 'Then she looks at the empty racks, and at you, and puts the kettle on.\n\n"First morning I did on my own," she says, "I set fire to a tea towel and Dad sold crumpets out of a packet. Tomorrow, then."';
  P.push(w);
  P.push('"He\'ll want feeding again tonight," she says, putting Gerald back on the shelf. "And every night. That\'s all he is, really. Flour and water and somebody turning up."');
  P.push(scoreLine(s));
  return '* * *\n\n' + P.join('\n\n');
}
function scoreLine(s) {
  const p = points(s);
  const rank = p >= 10 ? 'Baker' : p >= 8 ? 'Journeyman' : p >= 5 ? 'Apprentice' : p >= 2 ? 'Washer-up' : 'Customer';
  return `THE END\n\nYou scored ${p} out of ${MAXPTS}, which earns you the rank of ${rank}.` + (p < MAXPTS ? ' Type RESTART to try again, or UNDO to go back a move.' : ' Type RESTART to play again.');
}

/* ---------------------------------------------------------- dispatch */

const HELP = 'You play this story by typing what you want to do, in short plain commands. Some that work:\n\n' +
  'LOOK (or L) to look around the room. EXAMINE THE OVEN (or X OVEN) to look at one thing closely.\n' +
  'NORTH, SOUTH, EAST, WEST, UP and DOWN to move, or just N, S, E, W, U, D. GO TO THE CELLAR works too.\n' +
  'TAKE, DROP, OPEN, CLOSE, PUT THE TORCH IN THE DRAWER, TURN ON, TURN OFF, READ, SMELL, POKE.\n' +
  'INVENTORY (or I) shows what you\'re carrying.\n' +
  'WAIT passes five minutes. Also WAIT 20, WAIT UNTIL 4:30, WAIT FOR THE OVEN.\n' +
  'ASK WIN ABOUT something, if she\'s awake.\n' +
  'SCORE shows your points. UNDO takes back a move. RESTART starts again.\n\n' +
  'Looking and examining don\'t take any time. Everything else does. The shop opens at seven.';

const RX = [
  [/^(l|look|look around|where am i)$/, s => { s._cost = 0; return look(s); }],
  [/^(i|inv|inventory|invent|take inventory|what am i (carrying|holding))$/, s => inventory(s)],
  [/^(score|points|full score)$/, s => { s._cost = 0; return `You have ${points(s)} of ${MAXPTS} points, and it's ${clock(s.time)}.`; }],
  [/^(help|about|info|commands|how do i play|instructions|\?)$/, s => { s._cost = 0; return HELP; }],
  [/^(hint|hints|clue|help me|what now|what do i do|stuck)$/, s => { s._cost = 0; return 'Win\'s note on the bench is the plan. When you\'re stuck, Win is across the landing. She did say to wake her if you had to. (WAKE WIN, then ASK WIN ABOUT whatever it is.)'; }],
  [/^(time|what time is it|check time|check clock|look at clock)$/, s => { s._cost = 0; return `It's ${clock(s.time)}.`; }],
  [/^(?:shoo|chase|evict) (?:out )?(.+?)(?: out| away| outside)?$/, (s, m) => catOut(s, m[1])],
  [/^(?:put|take|throw|carry|let|send|chuck) (cat|pemberton|mister pemberton|mr pemberton|him) (?:out|outside|into yard|in yard|out of bakehouse|out of back door|out back)$/, (s, m) => catOut(s, m[1])],
  [/^(?:cover|drape) (.+?)(?: with .+)?$/, (s, m) => cover(s, m[1])],
  [/^(?:wear|put on|don|tie on) (.+)$/, (s, m) => wear(s, m[1])],
  [/^put (.+) on$/, (s, m) => /apron/.test(m[1]) ? wear(s, m[1]) : turnOn(s, m[1])],
  [/^(?:drink|have) (?:some |a glass of |glass of )?water$/, s => s.loc === 'bakehouse' ? 'You drink a glass of water at the sink. Better.' : fail(s, 'The sink is in the bakehouse.')],
  [/^(?:dust|flour) (bench|table|worktop|surface)$/, s => s.loc === 'bakehouse' ? 'You throw a handful of flour across the bench the way Win does, in one flick. It lands in a fan. Very professional.' : fail(s, 'The bench is in the bakehouse.')],
  [/^(?:flip|turn|change) (?:sign|closed sign|open sign)(?: round| around| over| to open)?$/, s => s.loc !== 'shop' ? fail(s, 'The sign is in the shop.') : s.sign ? fail(s, 'It says OPEN.') : fail(s, 'Not till seven. It turns when the shutter goes up.')],
  [/^(?:wash|wash hands|wash my hands|wash up)$/, s => s.loc === 'bakehouse' ? 'You wash your hands at the sink, properly, the way the sign above it says.' : fail(s, 'The sink is in the bakehouse.')],
  [/^what(?:s| is) in (.+)$/, (s, m) => lookIn(s, m[1])],
  [/^(?:empty|tip out|clear|reset|clean) (?:mixer|bowl|mixer bowl)$/, s => emptyBowl(s)],
  [/^(?:throw|chuck|tip|put) (.+?) (?:away|in bin|in pedal bin|in rubbish)$|^(?:throw|chuck) (.+?) out$/, (s, m) => /dough/.test(m[1] || m[2]) ? binDough(s) : /bowl|mixer/.test(m[1] || m[2]) ? emptyBowl(s) : fail(s, 'Better not throw away anything of Win\'s.')],
  [/^(?:remove|take out|take away) (?:some )?(flour|water|salt|yeast)(?: from .+)?$/, s => fail(s, 'You can\'t fish it back out. If the bowl\'s wrong, EMPTY THE BOWL and start again.')],
  [/^(?:win|aunt win|auntie win|auntie) (.+)$/, (s, m) => s.loc !== 'winroom' ? fail(s, 'Win is upstairs in bed.') : s.win.awake > 0 ? ask(s, 'win', m[1]) : wake(s)],
  [/^tell (win|aunt win|auntie) (?:that )?(.+)$/, (s, m) => ask(s, 'win', m[2])],
  [/^(?:ask|question) (win|aunt win|auntie|her) (what to do|what now|what next|what i should do|for help|to help|for advice|what should i do)$/, (s, m) => ask(s, 'win', 'what to do')],
  [/^what(?:s| is| are) (?:a |an )?(lame|banneton|bannetons|peel|proving|proof|prove|bulk|starter|levain|deck oven|deck|scoring|hooch|bakers percentage|percentage)$/, (s, m) => gloss(s, m[1])],
  [/^(?:take|carry|bring|move|push|wheel) (.+?) (?:into|to|through to|in to|through into) (?:the )?shop$/, (s, m) => toShop(s, m[1])],
  [/^(?:open|open up) (?:the )?(shop|front|shop front|front door|up shop|up)$/, s => openShop(s)],
  [/^(z|wait|rest|pause)$/, s => wait(s, 5)],
  [/^wait (?:for )?(\d+)(?: ?(?:m|min|mins|minutes?))?$/, (s, m) => wait(s, +m[1])],
  [/^wait (?:(?:until|till|til|to|for) )?(\d{1,2})(?:[:.](\d{2}))? ?(am|pm|a\.m\.|p\.m\.)?$/, (s, m) => { let h = +m[1]; const mm = +(m[2] || 0); if (h === 12) h = 0; if (h > 12 || !m[2] && !m[3] && h > 7) return fail(s, 'WAIT UNTIL 4:30, or WAIT 20 for twenty minutes.'); return wait(s, null, h * 60 + mm); }],
  [/^wait (?:for|until|till) (.+)$/, (s, m) => waitFor(s, m[1])],
  [/^(sleep|go to sleep|go back to bed|lie down|nap|go to bed|get in bed|get into bed|lie on bed)$/, s => sleep(s)],
  [/^(get up|stand up|stand)$/, s => fail(s, 'You\'re up. More or less.')],
  [/^(?:go |walk |run |head |climb )?(n|s|e|w|u|d|north|south|east|west|up|down|upstairs|downstairs|in|inside|out|outside|exit|leave|back)(?: stairs)?$/, (s, m) => move(s, DIRS[m[1]])],
  [/^(?:go|walk|run|head|climb) (?:up|down) (?:the )?(?:stairs|steps)$/, (s, m, c) => move(s, /up/.test(c) ? 'up' : 'down')],
  [/^(?:climb )?(?:stairs|steps)$/, s => move(s, s.loc === 'landing' ? 'down' : 'up')],
  [/^(?:go|walk|run|head|return|go back|enter|visit|walk back) (?:to |into |in to |back to )?(.+)$/, (s, m) => goPlace(s, m[1])],
  [/^(?:look|peer|check|search|rummage|feel) (?:in|inside|into|through) (.+)$/, (s, m) => lookIn(s, m[1])],
  [/^(?:look|search|check) (?:under|behind) (.+)$/, (s, m) => { s._cost = 0; return /bench/.test(m[1]) && s.cat.inside && s.loc === 'bakehouse' && s.ovenTemp <= 90 ? 'Mister Pemberton, looking back at you.' : 'Nothing there but flour.'; }],
  [/^(?:x|examine|look at|look|inspect|check|read|l at|study|watch|view|describe|look closely at|search for) (.+)$/, (s, m) => examine(s, m[1])],
  [/^(?:search|rummage in|frisk) (.+)$/, (s, m) => lookIn(s, m[1])],
  [/^(?:take|get|pull|lift) (.+?) out(?: of (?:the )?oven)?$/, (s, m) => takeOut(s, m[1])],
  [/^(?:unload|empty) oven$/, s => unload(s, null)],
  [/^(?:take|get|grab|remove|pull) (.+?) (?:from|out of|off|from inside|from in|from out of) (.+)$/, (s, m) => takeFrom(s, m[1], m[2])],
  [/^(?:take|get|grab|pick up|carry|lift|hold|collect|fetch) (.+?)(?: up)?$/, (s, m) => / and |, /.test(m[1]) ? several(s, take, m[1]) : take(s, m[1])],
  [/^pick (.+) up$/, (s, m) => take(s, m[1])],
  [/^(?:drop|put down|set down|leave|discard) (.+)$/, (s, m) => / and |, /.test(m[1]) ? several(s, drop, m[1]) : drop(s, m[1])],
  [/^(?:put|set) (.+) down$/, (s, m) => drop(s, m[1])],
  [/^(?:throw away|bin|throw out|chuck|scrap|dump) (.+)$/, (s, m) => /dough/.test(m[1]) ? binDough(s) : fail(s, 'Better not throw away anything of Win\'s.')],
  [/^(?:turn|tip|knock) (?:out )?(loaves|loaf|bread|sourdough|bannetons|baskets)(?: out)?(?: onto (?:the )?(?:peel|bench))?$/, s => turnOut(s)],
  [/^(?:unmould|unmold|invert|turn out|tip out) (.+)$/, (s, m) => /loa|bread|sourdough|banneton|basket/.test(m[1]) ? turnOut(s) : /dough/.test(m[1]) ? shape(s) : fail(s, 'That doesn\'t need turning out.')],
  [/^(?:score|slash|slit|cut|scar|mark) (.+?)(?: with (.+))?$/, (s, m) => /loa|bread|sourdough/.test(m[1]) ? scoreLoaves(s, m[2]) : /dough|roll/.test(m[1]) ? shape(s) : fail(s, 'You don\'t want to cut that.')],
  [/^(?:add|weigh|weigh out|measure|measure out|put|pour|tip|scoop|use) (\d+(?:\.\d+)?)\s*(g|gs|grams?|grammes?|kg|kgs|kilos?|kilograms?|ml|mls|millilitres?|milliliters?|l|litres?|liters?|cl)?\s+(?:of\s+)?(.+?)(?:\s+(?:in|into|to|in to|onto|on|on to)\s+(.+))?$/, (s, m) => add(s, +m[1], m[2], m[3], m[4])],
  [/^(?:add|weigh|weigh out|measure|measure out) (.+?)(?:\s+(?:in|into|to|in to|onto|on)\s+(.+))?$/, (s, m) => addNoAmount(s, m[1], m[2])],
  [/^(?:fill) (.+?)(?: (?:with|at|from|in|under) .+)?$/, (s, m) => fill(s, m[1])],
  [/^(?:pour|throw|splash|tip|empty|chuck) (.+?) (?:on|onto|over|into|in|on to|in to) (.+)$/, (s, m) => /^(water|jug|jug of water|sack|sack of flour|flour)$/.test(m[1]) ? pour(s, m[1], m[2]) : putIn(s, m[1], 'in', m[2])],
  [/^(?:pour|empty|tip) (.+)$/, (s, m) => pour(s, m[1], null)],
  [/^(?:steam|make steam|steam oven|steam loaves|steam bread|create steam)$/, s => steam(s)],
  [/^(?:put|place|set|stand|move|slide|stick|pop|load|insert|hang|lay|transfer|scrape) (.+?) (in|into|inside|in to|on|onto|on top of|on to|under|back on|back in|back into) (.+)$/, (s, m) => putIn(s, m[1], /on|top/.test(m[2]) ? 'on' : 'in', m[3])],
  [/^(?:bake|load) (.+)$/, (s, m) => loadOven(s, (resolve(s, m[1]).id) || m[1])],
  [/^(?:open|unlock|unbolt|raise|lift up|haul up|roll up|pull up) (.+)$/, (s, m) => open(s, m[1])],
  [/^(?:close|shut|lock|bolt|lower|pull down) (.+)$/, (s, m) => close(s, m[1])],
  [/^(?:turn|switch|flip|flick|put|push|click) on (.+)$/, (s, m) => turnOn(s, m[1])],
  [/^(?:turn|switch|flip|flick|put|push|click) (.+) on$/, (s, m) => turnOn(s, m[1])],
  [/^(?:turn|switch|flip|flick|put|click) off (.+)$/, (s, m) => turnOff(s, m[1])],
  [/^(?:turn|switch|flip|flick|put|click) (.+) off$/, (s, m) => turnOff(s, m[1])],
  [/^(?:start|run|use) (mixer|machine)$/, s => mix(s)],
  [/^(?:mix|knead|make dough|mix dough|knead dough|make rolls dough|mix ingredients|mix it|stir)$/, s => mix(s)],
  [/^(?:shape|divide|roll|make|form|portion|ball) (?:the )?(?:dough|rolls|buns|it)(?: into rolls)?$/, s => shape(s)],
  [/^(?:shape|divide)$/, s => shape(s)],
  [/^(?:make rolls|shape rolls)$/, s => shape(s)],
  [/^(?:set|turn|adjust|twist|change|put) (.+?) (?:to|at|for|on) (\d+)(?: ?(?:c|degrees|deg|minutes|mins|min|m))?$/, (s, m) => setTo(s, m[1], +m[2])],
  [/^(?:set|wind) (timer|hen|kitchen timer)$/, s => fail(s, 'For how long? SET THE TIMER FOR 40, for example.')],
  [/^(?:set|turn|adjust|twist) (?:dial|thermostat|oven)(?: down| up)?$/, s => fail(s, 'To what? SET THE DIAL TO 220, for example.')],
  [/^(?:push|press|hit|reset|flip|pull|raise|lift|throw|flick|click|slap|ring|tug) (.+?)(?: up| down| back up)?$/, (s, m) => push(s, m[1])],
  [/^(?:feed) (.+?)(?: with .+)?$/, (s, m) => feed(s, m[1])],
  [/^(?:give) (.+?) (?:to) (.+)$/, (s, m) => /gerald/.test(m[2]) ? feed(s, 'gerald') : /cat|pemberton/.test(m[2]) ? feed(s, 'cat') : fail(s, 'They don\'t want it.')],
  [/^(?:unload|take out|get out) (.+)$/, (s, m) => takeOut(s, m[1])],
  [/^(?:knock|tap|thump|rap)(?: on)? (.+)$/, (s, m) => knock(s, m[1])],
  [/^(?:poke|prod|press|touch|feel|squeeze) (.+)$/, (s, m) => poke(s, m[1])],
  [/^(?:smell|sniff)(?: (.+))?$/, (s, m) => smell(s, m[1])],
  [/^(?:listen)(?: to (.+))?$/, s => listen(s)],
  [/^(?:taste|eat|lick|bite|try) (.+)$/, (s, m) => taste(s, m[1])],
  [/^(?:wake|wake up|shake|rouse|nudge|disturb) (.+?)(?: up)?$/, (s, m) => /win|aunt/.test(m[1]) ? wake(s) : fail(s, 'That\'s awake enough.')],
  [/^(?:ask|tell|question|quiz) (.+?) (?:about|for|re|regarding|how to|how do i|where) (.+)$/, (s, m) => ask(s, m[1], m[2])],
  [/^(?:talk|speak|chat) (?:to|with) (.+)$/, (s, m) => ask(s, m[1], 'you')],
  [/^(?:say|shout|whisper|call|yell) (.+)$/, s => s.loc === 'winroom' ? wake(s) : 'Nobody answers. Upstairs, Win snores on.'],
  [/^(?:hello|hi|hey|morning|good morning)$/, s => s.loc === 'winroom' ? ask(s, 'win', 'you') : s.cat.inside && s.loc === 'bakehouse' || s.loc === 'yard' ? 'Mister Pemberton looks at you without blinking.' : 'Nobody answers.'],
  [/^(?:stroke|pet|pat|cuddle|tickle|scratch) (.+)$/, (s, m) => stroke(s, m[1])],
  [/^(?:kiss|hug) (.+)$/, (s, m) => /win|aunt/.test(m[1]) && s.loc === 'winroom' ? 'You kiss her forehead. She smells of Germolene. "Mm," she says, without waking. "Gerald."' : stroke(s, m[1])],
  [/^(?:prove|proof|rise)(?: .+)?$/, s => fail(s, 'You can\'t make dough rise by telling it to. Put it somewhere warm and wait.')],
  [/^(?:write|draw) .*$/, s => fail(s, 'The blackboard already says what needs saying.')],
  [/^(?:sell|serve) .*$/, s => fail(s, 'Not till seven.')],
  [/^(?:sing|hum|whistle|dance)$/, () => 'You sing a little, quietly, to the dough. Nobody will ever know.'],
  [/^(?:cry|swear|scream|panic)$/, () => 'You give it a moment. It helps, a bit. Then you get on.'],
  [/^(?:jump|yawn|stretch)$/, () => 'You stretch until your back clicks. It\'s very early.'],
  [/^(?:xyzzy|plugh|plover)$/, s => { s._cost = 0; return 'Nothing happens. Somewhere upstairs, Win says "Don\'t."'; }],
  [/^(?:yes|y|yeah|yep|ok|okay|sure|go on|do it|anyway)$/, s => s._confirm === 'shape' ? shape(s) : s._confirm === 'turn' ? turnOut(s) : fail(s, 'Right.')],
  [/^(?:no|n o|nope|not yet|wait no)$/, s => fail(s, s._confirm ? 'Fair enough.' : 'Right.')],
  [/^(?:sit|sit down|lie|rest)$/, s => fail(s, 'If you sit down now you won\'t get up.')],
];

function nextStep(s) {
  const L = s.loaves;
  if (!powered(s)) return s.ovenOn ? (s.breaker ? '"Switch the oven on, love."' : '"It\'s tripped, hasn\'t it. Fuse box is in the cellar. Torch in the drawer, batteries in the fridge."') : '"Oven on first," she says. "Big switch on the side. Everything waits for the oven."';
  if (!s.gerald.fed) return '"Feed Gerald," she says. "Before you forget. You will forget."';
  if (!s.dough && !s.rolls) return '"Rolls while the oven heats. Card on the wall. Sacks in the store."';
  if (s.dough && s.where.dough === 'in:mixer') return '"Get that dough in the tub. Somewhere warm."';
  if (s.dough && s.dough.rise < 0.95) return '"Let the dough rise. While you wait, think about the loaves. Hot oven, score, steam. Lame\'s in my pocket." She nods at the apron. "Dad\'s stones are in the cellar."';
  if (s.dough) return '"Is it doubled? Then shape it. Eighty grams."';
  if (L.stage !== 'baked') return L.stage === 'baking' ? '"Forty minutes for the loaves. Then the rolls."' : '"Loaves in when the oven\'s hot. Score them, steam them."';
  if (s.rolls && s.rolls.stage !== 'baked') return s.rolls.stage === 'baking' ? '"Fifteen minutes. Watch them."' : '"Prove them till they\'re puffy. Then 220."';
  return '"Put it all in the baskets in the shop, and open at seven," she says. "Then put the kettle on."';
}
function gloss(s, w) {
  s._cost = 0;
  if (/lame/.test(w)) return 'A lame (you say it "lahm") is a baker\'s blade: a razor on a little handle, for scoring loaves.';
  if (/banneton/.test(w)) return 'A banneton is a round wicker basket that a loaf proves in, upside down. It leaves a spiral of flour on the crust.';
  if (/peel/.test(w)) return 'A peel is the long flat wooden paddle you slide bread into the oven with.';
  if (/prov|proof|bulk/.test(w)) return 'Proving is letting dough rise. It needs time and warmth. Bulk is the first rise, all in one lump; then you shape it and it proves again.';
  if (/starter|levain|hooch/.test(w)) return 'A sourdough starter is flour and water full of wild yeast, kept alive by feeding it. Gerald is one. The grey liquid on top when he\'s hungry is called hooch.';
  if (/deck/.test(w)) return 'A deck oven bakes bread straight on a hot stone floor, the deck.';
  if (/scor/.test(w)) return 'Scoring is slashing the top of a loaf just before it goes in, so it opens where you choose instead of bursting at the side.';
  return 'Bakers count everything as a percentage of the flour. Flour is always 100. So 65% water, with 2 kg of flour, means 65% of 2 kg.';
}
function toShop(s, what) {
  const both = /bread|rack|everything|it all|all/.test(what);
  const want = both ? ['loaves', 'rolls'] : /roll|bun|tray/.test(what) ? ['rolls'] : /loa|sourdough/.test(what) ? ['loaves'] : [];
  if (!want.length) return fail(s, 'Only the bread goes in the shop.');
  const ready = want.filter(x => (x === 'loaves' ? s.loaves.stage : s.rolls && s.rolls.stage) === 'baked' && s.where[x] !== 'in:baskets');
  if (!ready.length) return fail(s, 'There\'s nothing baked to take through yet.');
  if (ready.length === 1) return display(s, ready[0]);
  display(s, 'loaves'); display(s, 'rolls'); s._cost = 3;
  return 'You wheel the cooling rack through to the shop and pile the baskets behind the counter: eight loaves, even the offended one, and forty rolls. The shop starts to smell like a shop.';
}
function several(s, verb, list) {
  const out = [];
  let cost = 0;
  for (const part of list.split(/,? and |, /).map(x => x.trim()).filter(Boolean)) {
    s._cost = 1;
    const r = verb(s, part);
    cost = Math.max(cost, s._cost);
    out.push(cap(part) + ': ' + r);
  }
  s._cost = cost;
  return out.join('\n');
}
function catOut(s, phrase) {
  if (!/cat|pemberton|him/.test(phrase)) return fail(s, 'It can stay where it is.');
  if (!s.cat.inside || s.loc !== 'bakehouse') return fail(s, s.loc === 'yard' ? 'He\'s outside already, on the wall, and plainly thinks you\'re the one who should leave.' : 'Mister Pemberton isn\'t here.');
  s.cat.inside = false; s.where.cat = 'yard';
  return 'You pick Mister Pemberton up, which he permits in the way a duke permits a doorman, and put him out of the back door. He sits on the step and looks at the door. You know you haven\'t heard the last of it.';
}
function cover(s, phrase) {
  if (/roll|tray|bun/.test(phrase) && s.rolls && s.rolls.stage === 'raw' && roomOf(s, 'rolls') === s.loc) { s.flags.covered = true; return 'You drape a clean tea towel over the trays, so the rolls don\'t skin over while they prove.'; }
  if (/dough|tub/.test(phrase) && s.dough) return fail(s, 'The tub has a lid. It\'s on.');
  return fail(s, 'It doesn\'t need covering.');
}
function wear(s, phrase) {
  if (!/apron/.test(phrase)) return fail(s, 'You\'re dressed. More or less.');
  if (!visible(s, 'apron')) return fail(s, 'Win\'s apron is on the chair in her room.');
  if (s.flags.apron) return fail(s, 'You\'re wearing it.');
  s.where.apron = 'inv'; s.moved.apron = true; s.flags.apron = true;
  return 'You put on Win\'s apron. It goes round you nearly twice and smells of her. You feel about ten per cent more like a baker.' + (s.where.lame === 'in:apron' ? ' There\'s something in the front pocket.' : '');
}
function emptyBowl(s) {
  if (s.loc !== 'bakehouse') return fail(s, 'The mixer is in the bakehouse.');
  if (s.dough && s.where.dough === 'in:mixer') return binDough(s);
  if (!s.mix.flour && !s.mix.water && !s.mix.salt && !s.mix.yeast) return fail(s, 'It\'s empty.');
  s.mix = { flour: 0, water: 0, salt: 0, yeast: 0 };
  return 'You tip the bowl out into the pedal bin and wipe it round. Clean start.';
}
function lookIn(s, phrase) {
  s._cost = 0;
  const r = need(s, phrase); if (r.err) return r.err;
  const id = r.id, o = OBJ[id];
  if (id === 'oven') return ovenDesc(s);
  if (id === 'mixer') return mixerDesc(s);
  if (id === 'torch') return open(s, 'torch');
  if (id === 'gerald') return geraldDesc(s);
  if (id === 'tub') return s.where.dough === 'in:tub' ? doughDesc(s) : 'It\'s empty.';
  if (!o.cont) return fail(s, 'There\'s nothing inside it.');
  let pre = '';
  if (o.closable && !s.open[id]) { s.open[id] = true; s._cost = 1; pre = `You open ${the(id)}. `; }
  const items = contentsOf(s, id, 'in');
  if (id === 'jar') return OBJ.jar.d(s);
  if (id === 'apron') return items.length ? 'In the front pocket: ' + listNames(s, items) + '.' : 'The pockets are empty except for flour.';
  if (id === 'bin' || id === 'flour') return flourDesc(s);
  if (id === 'fridge') return pre + (items.filter(i => i !== 'butter').length ? 'In the fridge: ' + listNames(s, items.filter(i => i !== 'butter')) + ', and butter, milk and eggs.' : 'Butter, milk and eggs.');
  return pre + (items.length ? `In ${the(id)}: ${listNames(s, items.filter(i => !OBJ[i].fixed || id === 'airing'))}.` : `${cap(the(id))} ${o.plural ? 'are' : 'is'} empty.`);
}
function takeFrom(s, xp, yp) {
  if (/oven/.test(yp)) return takeOut(s, xp);
  if (/mixer|bowl/.test(yp) && /dough/.test(xp)) return takeDough(s);
  if (/fridge/.test(yp) && /loa|bread|sourdough|banneton|basket|trolley/.test(xp)) return turnOut(s);
  return take(s, xp);
}
function takeOut(s, phrase) {
  if (/loa|bread|sourdough/.test(phrase)) return s.where.loaves === 'in:oven' ? unload(s, 'loaves') : take(s, phrase);
  if (/roll|tray|bun/.test(phrase)) return s.where.trays === 'in:oven' ? unload(s, 'rolls') : take(s, phrase);
  if (/tin|stone/.test(phrase) && s.where.tin === 'in:oven') { if (s.loc !== 'bakehouse') return fail(s, 'The oven is in the bakehouse.'); s.where.tin = 'on:bench'; return 'You hook the tin of stones out with a cloth and put it on the bench.'; }
  if (/batter/.test(phrase) && s.torchBatt) { s.torchBatt = false; s.torchOn = false; s.where.batteries = 'inv'; return 'You take the batteries out of the torch.'; }
  if (/^(it|them|everything)$/.test(phrase)) return unload(s, null);
  return take(s, phrase);
}
function loadTorch(s) {
  if (s.torchBatt) return fail(s, 'It has batteries already.');
  if (!held(s, 'batteries') && !visible(s, 'batteries')) return fail(s, 'You haven\'t got any batteries.');
  if (!visible(s, 'torch')) return fail(s, 'You haven\'t got the torch.');
  s.torchBatt = true; s.where.batteries = null;
  let pre = '';
  if (s.where.torch !== 'inv') { s.where.torch = 'inv'; s.moved.torch = true; pre = '(first taking the torch) '; }
  return pre + 'You unscrew the end of the torch, take out the scrap of paper that says FRIDGE, put the batteries in, and screw it back up.';
}

const CHAIN = /\s*(?:;|\bthen\b|(?<![0-9])\.(?![0-9])|,\s*and\b|\band\s+(?=(?:turn|switch|put|open|close|go|take|drop|read|look|x|examine|wait|add|feed|pour|get|shut|press|push|unlock|walk|eat|knock|score|load|bake|shape|mix|ask|wake|fill|set|head)\b))\s*/i;
function command(s, raw) {
  const parts = String(raw).split(CHAIN).filter(p => p && p.trim());
  if (parts.length < 2) return one(s, raw);
  const out = [];
  for (const p of parts) { out.push(one(s, p)); if (s.ended) break; }
  return out.filter(Boolean).join('\n\n');
}
function one(s, raw) {
  s._ev = []; s._int = false; s._cost = 1; s._pre = '';
  s._confirm = s.confirm; s.confirm = null;
  if (s.ended) return 'The story is over. Type RESTART to play again, or UNDO to go back a move.';
  let c = clean(raw);
  c = c.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fifty|sixty|hundred)\b/g, w => String(NUMWORDS[w]));
  if (!c) return fail(s, 'Say something. Type HELP if you\'re not sure what.');
  c = c.replace(/^(i want to|i would like to|lets|let us|try to|i will|ill) /, '');
  let text = null;
  for (const [re, f] of RX) {
    const m = re.exec(c);
    if (m) { text = f(s, m, c); break; }
  }
  if (text == null) { s._cost = 0; text = UNKNOWN[(s.moves++) % UNKNOWN.length]; }
  else s.moves++;
  const parts = [(s._pre || '') + text];
  s._pre = '';
  if (s._cost > 0 && !s.ended) advance(s, s._cost, false);
  if (s.alarm && s.loc === 'boxroom' && !s.ended && !/alarm/.test(c)) s._ev.push('The alarm clock is still going.');
  if (s.win.awake > 0 && !/^(ask|tell|talk|wake|hello|hi|say|question)/.test(c)) {
    s.win.awake--;
    if (s.win.awake === 0 && s.loc === 'winroom') s._ev.push('Win\'s eye closes. In a moment she\'s snoring again.');
  }
  if (s.loc !== 'winroom') s.win.awake = 0;
  const evs = s._ev.filter(Boolean);
  if (evs.length) parts.push(evs.join('\n\n'));
  return parts.filter(p => p !== '').join('\n\n');
}
const UNKNOWN = [
  'I don\'t know how to do that. (Type HELP for the kinds of thing that work.)',
  'That\'s not something this story understands. Try putting it more simply.',
  'I didn\'t follow that. Short commands work best: TAKE THE NOTE, GO DOWN, PUT THE PIN ON THE BENCH.',
];

const INTRO = 'Somewhere very close, something is beeping.\n\n' +
  'It\'s an alarm clock, on the chest of drawers, set for two in the morning. It\'s dark. You\'re in the box room above the bakery on Mill Lane, and you slept in your clothes.\n\n' +
  'Two days ago your aunt Win fell off a stepladder in the flour store and broke her right wrist. Yesterday afternoon she stood over you while you shaped this morning\'s sourdough and told you exactly what was wrong with every loaf. Then she took two of the big painkillers and went to bed, saying she\'d be up at two to talk you through the rest.\n\n' +
  'She is not up. You can hear her snoring through the wall.\n\n' +
  'The shop opens at seven.';

function status(s) {
  return { room: dark(s) ? 'Cellar (dark)' : ROOMS[s.loc].name, time: clock(s.time), minutes: s.time, points: points(s), max: MAXPTS, ended: s.ended };
}

const api = { fresh, command, look: s => { s.seen[s.loc] = true; return look(s); }, status, INTRO, HELP, clock, OPEN, START };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Proof = api;
})(typeof window !== 'undefined' ? window : globalThis);
