/* =====================================================================
   EDIT HERE
   Everything you are likely to change lives in this file: wording,
   timing, colours, camera moves and the app glimpses. The engine that
   plays it is in main.js.
   ===================================================================== */

export const CONFIG = {
  brand: ['Procurement Tech', 'Vertex AI'],
  particles: 7000,        // expense records in the stream
  flow: 0.115,            // stream speed, in stages per second
  transition: 2.0,        // default camera travel time between scenes (s)
  loop: false,            // restart automatically after the last scene
  gain: 0.62,             // overall brightness of the records
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.22 },
  /* App screenshots. Files in shots/ named after a scene id play during that
     scene: acquire1.png, acquire2.png ... (see shots/README.md). from / to are
     the part of the scene they share, as fractions of its duration; every
     shot gets an equal slice. fill is the share of the screen they cover. */
  shots: { from: 0.40, to: 0.95, fill: 0.8 },
  /* Team org chart (the 'team' scene). Rows reveal one after another from
     reveal seconds into the scene, row seconds apart; the motto appears at
     motto seconds. perRow caps how many people share one row. */
  team: { reveal: 0.9, row: 0.7, motto: 6.5, perRow: 9 },
};

export const COLORS = {
  abyss: '#050b1f', trench: '#0e2a66',
  signal: '#5ee6f0', ledger: '#3f7bff', raw: '#7fa6ff', unified: '#a9d4ff',
  normal: '#3fc4c8', flag: '#ffb020',
  clear: '#58e6a0', ice: '#bfe3ff', caught: '#ff6b4a',
};

/* The eight stages. Positions are world units; the stream runs along +x. */
export const STAGES = [
  { name: 'Acquire',     at: [  0, 0.0,  0], color: 'signal' },
  { name: 'Unify',       at: [ 15, 1.5, -3], color: 'signal' },
  { name: 'Featurize',   at: [ 30, 0.0,  2], color: 'signal' },
  { name: 'Train',       at: [ 45, 6.0, -3], color: 'ledger' },
  { name: 'Score',       at: [ 60, 3.0,  3], color: 'signal' },
  { name: 'Decide',      at: [ 75, 7.0, -2], color: 'signal' },
  { name: 'Investigate', at: [ 90, 4.5,  4], color: 'flag'   },
  { name: 'Resolve',     at: [105, 2.0,  0], color: 'clear'  },
];

/* Names of the source streams that converge on Acquire. */
export const SOURCES = ['Reports', 'Expenses', 'Attendees', 'Receipts', 'Identity'];

/* Legends reused by several scenes: [colour key, label]. */
export const KEY = {
  time:    [['ledger', 'History'], ['signal', 'Present']],
  score:   [['normal', 'Looks normal'], ['flag', 'Flagged']],
  route:   [['normal', 'Passes, no action'], ['flag', 'Flagged, sent for review']],
  outcome: [['clear', 'Cleared'], ['ice', 'Corrected'], ['caught', 'Caught']],
};

/* Scenes play in order. dur is seconds; the film is their sum.
   cam.a is the camera at the start of a scene and cam.b at the end, so
   every shot drifts. A key is either { p:[x,y,z], l:[x,y,z] } in world
   units, or { s, off, ls, loff }: s is the position along the stream
   (1 = Acquire ... 8 = Resolve), off the camera offset from that point,
   ls / loff the same for the point the camera looks at.
   big: enlarges the stage nodes for far shots.
   Screenshots are not listed here: drop them in shots/ named after the
   scene id (acquire1.png, acquire2.png ...). A scene with several shots
   splits its screenshot time between them; raise its dur to give each
   one longer on screen.                                               */
export const SCENES = [
  { id: 'why', dur: 9,
    kicker: 'The business case', title: 'Why Vertex?',
    sub: 'Our in-house expense audit platform, replacing Oversight. Faster investigations, full audit trail.',
    accent: 'signal',
    cam: { a: { s: 1, off: [7, 6.5, 19], ls: 0.25, loff: [0, 1, 0] },
           b: { s: 1, off: [3, 5, 16.5], ls: 0.4, loff: [0, .8, 0] }, fov: 42, fog: [18, 95] } },

  { id: 'overview', dur: 11, long: true,
    kicker: 'From data to decision', title: 'Expense Intelligence',
    sub: 'Automated, explainable, end to end.',
    accent: 'signal', big: 1.7,
    cam: { a: { p: [26, 36, 106], l: [47, 3, 0] },
           b: { p: [42, 28, 99], l: [49, 3, 0] }, fov: 42, fog: [130, 380], center: [.5, .34] } },

  { id: 'acquire', dur: 11, stage: 1, tr: 3.2,
    kicker: 'Every source', title: 'Acquire',
    sub: 'Every expense, every source, pulled into one place.',
    module: 'Data Acquisition', sources: true,
    cam: { a: { s: 1, off: [7, 1.4, 12], ls: 0.84, loff: [0, .5, 0] },
           b: { s: 1, off: [4, .7, 10.5], ls: 0.9, loff: [0, .4, 0] }, fov: 38 } },

  { id: 'unify', dur: 11, stage: 2,
    kicker: 'Trusted foundation', title: 'Unify',
    sub: 'Scattered data, unified into one trusted foundation.',
    cam: { a: { s: 2, off: [-6, 3.2, 15], ls: 1.82 },
           b: { s: 2, off: [0, 2.4, 12.5], ls: 1.98 }, fov: 38 } },

  { id: 'featurize', dur: 11, stage: 3,
    kicker: 'Raw records to signals', title: 'Featurize',
    sub: 'We turn raw records into signals, and separate the past from the present.',
    legend: 'time',
    cam: { a: { s: 3, off: [-3, 2.2, 14.5], ls: 3.05 },
           b: { s: 3.1, off: [4, 1.2, 12.5], ls: 3.22 }, fov: 38 } },

  { id: 'train', dur: 11, stage: 4,
    kicker: 'Learn normal', title: 'Train',
    sub: 'History teaches the models what normal, and not normal, looks like.',
    module: 'ML Models', legend: 'time', accent: 'ledger',
    cam: { a: { s: 4, off: [-8, -1.2, 14.5], ls: 3.93, loff: [0, .2, 0] },
           b: { s: 4, off: [-3, -.2, 12], ls: 3.98, loff: [0, .1, 0] }, fov: 38 } },

  { id: 'score', dur: 11, stage: 5,
    kicker: 'ML + policy', title: 'Score',
    sub: 'Every new expense is scored, by machine learning and by policy.',
    module: 'Scoring and Exceptions', legend: 'score',
    cam: { a: { s: 5, off: [10, 2.6, 8.5], ls: 4.96 },
           b: { s: 5, off: [8.5, 1.8, 7], ls: 4.99 }, fov: 38 } },

  { id: 'decide', dur: 11, stage: 6,
    kicker: 'Route with confidence', title: 'Decide',
    sub: 'Signals combine into decisions. Your rules, your thresholds.',
    module: 'Actions', legend: 'route',
    cam: { a: { s: 6, off: [-6, 1.5, 18], ls: 6.22, loff: [0, 1.6, 0] },
           b: { s: 6.1, off: [1, 2.6, 20], ls: 6.38, loff: [0, 2.2, 0] }, fov: 40 } },

  { id: 'investigate', dur: 11, stage: 7,
    kicker: 'Evidence in context', title: 'Investigate',
    sub: 'Flagged cases reach the right reviewer, with AI assist and a full evidence trail.',
    module: 'Investigations and Worklist', accent: 'flag',
    cam: { a: { s: 7, off: [-5.5, 2.4, 13], ls: 6.98 },
           b: { s: 7, off: [1, 1.6, 11], ls: 7.02 }, fov: 38 } },

  { id: 'resolve', dur: 11, stage: 8,
    kicker: 'Close the loop', title: 'Resolve',
    sub: 'Cleared, corrected, or caught. Every case closed with confidence.',
    module: 'Executive Dashboard', legend: 'outcome', accent: 'clear',
    cam: { a: { s: 8, off: [-9, 5, 15.5], ls: 7.93 },
           b: { s: 8, off: [-3.5, 6.6, 14], ls: 7.99 }, fov: 38 } },

  { id: 'outro', dur: 7, tr: 3.4,
    kicker: 'Built in-house by Procurement Tech', title: 'Vertex AI',
    sub: 'Your expense auditor. From raw data to a closed case, on one platform.',
    accent: 'signal',
    cam: { a: { p: [113, 9, 24], l: [100, 2.5, 0] },
           b: { p: [114, 32, 86], l: [66, 2, 0] }, fov: 42, fog: [120, 360], center: [.5, .36] } },

  /* The team: an org chart built from the photos in team/ (see
     team/README.md). kicker and title head the chart, sub is the closing
     motto. With no photos it plays as an ordinary title card.          */
  { id: 'team', dur: 13, team: true,
    kicker: 'The people behind Vertex', title: 'Procurement Tech',
    sub: 'Solving problems and enabling the business, one app at a time.',
    accent: 'signal',
    cam: { a: { p: [114, 32, 86], l: [66, 2, 0] },
           b: { p: [96, 44, 118], l: [58, 2, 0] }, fov: 42, fog: [130, 400], center: [.5, .4] } },
];
