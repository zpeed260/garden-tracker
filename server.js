'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ─── Constants ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/app/data/garden.db';
const SEASON_START = new Date('2026-04-26');

// ─── Week / fertiliser helpers ───────────────────────────────────────────────

function getCurrentWeek() {
  return Math.max(0, Math.floor((Date.now() - SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

function getFertiliserForWeek(week) {
  return week % 2 !== 0 ? "Vasili's Liquid Gold" : "Vasili's Eco Booch";
}

function getCurrentFertiliser() {
  return getFertiliserForWeek(getCurrentWeek());
}

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Stage computation ────────────────────────────────────────────────────────

function computeStage(plantedDate, thresholdsJson) {
  let thresholds;
  try {
    thresholds = JSON.parse(thresholdsJson);
  } catch (_) {
    return 'SEEDED';
  }
  const daysSincePlanted = Math.floor(
    (Date.now() - new Date(plantedDate).getTime()) / 86400000
  );
  const stageOrder = [
    'OVERDUE',
    'HARVEST_READY',
    'HEADING',
    'FLOWERING',
    'GROWING',
    'SEEDLING',
    'GERMINATING',
    'SEEDED',
  ];
  for (const stage of stageOrder) {
    if (thresholds[stage] !== undefined && daysSincePlanted >= thresholds[stage]) {
      return stage;
    }
  }
  return 'SEEDED';
}

// ─── Database initialisation ──────────────────────────────────────────────────

let db;
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
} catch (e) {
  console.error('Failed to initialise database:', e.message);
  process.exit(1);
}
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS beds (
    id TEXT PRIMARY KEY, name TEXT, width_cm INT, height_cm INT, notes TEXT
  );
  CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id TEXT, name TEXT, variety TEXT, grid_col INT, grid_row INT,
    planted_date TEXT, harvest_start_day INT, harvest_end_day INT,
    stage_thresholds TEXT
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_number INT, bed_id TEXT, title TEXT,
    is_complete INT DEFAULT 0, completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS fertiliser_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id TEXT, product TEXT, applied_at TEXT
  );
  CREATE TABLE IF NOT EXISTS analysis_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id TEXT, image_base64 TEXT, result_json TEXT, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id TEXT, content TEXT, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS seed_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    variety TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    stage_thresholds TEXT NOT NULL DEFAULT '{}',
    harvest_start_day INT NOT NULL DEFAULT 60,
    harvest_end_day INT NOT NULL DEFAULT 120,
    spacing_cm INT DEFAULT 20,
    sow_depth_cm REAL DEFAULT 2,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed data ────────────────────────────────────────────────────────────────

const bedCount = db.prepare('SELECT COUNT(*) as cnt FROM beds').get().cnt;

if (bedCount === 0) {
  // ── Beds ──────────────────────────────────────────────────────────────────
  const insertBed = db.prepare(
    'INSERT INTO beds (id, name, width_cm, height_cm) VALUES (?, ?, ?, ?)'
  );
  const beds = [
    ['bed1', 'Bed 1 — Cauliflower & Beetroot', 90, 127],
    ['bed2', 'Bed 2 — Broad Beans', 90, 127],
    ['bed3', 'Bed 3 — Carrots & Lettuce', 90, 127],
    ['bed4', 'Bed 4 — Sugar Snap Peas', 57, 162],
    ['bed5', 'Bed 5 — Winter Greens → Climbing Beans', 57, 162],
  ];
  for (const bed of beds) insertBed.run(...bed);

  // ── Plants ─────────────────────────────────────────────────────────────────
  const insertPlant = db.prepare(
    `INSERT INTO plants
       (bed_id, name, variety, grid_col, grid_row, planted_date, harvest_start_day, harvest_end_day, stage_thresholds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const PLANTED = '2026-04-27';

  const cauli_thresholds = JSON.stringify({
    SEEDLING: 14, GROWING: 60, HEADING: 100,
    HARVEST_READY: 140, OVERDUE: 180,
  });
  const beetroot_thresholds = JSON.stringify({
    GERMINATING: 14, SEEDLING: 28, GROWING: 60,
    HARVEST_READY: 120, OVERDUE: 170,
  });
  const broadbean_thresholds = JSON.stringify({
    GERMINATING: 10, SEEDLING: 25, GROWING: 70, FLOWERING: 100,
    HARVEST_READY: 130, OVERDUE: 165,
  });
  const carrot_thresholds = JSON.stringify({
    GERMINATING: 14, SEEDLING: 30, GROWING: 80, HARVEST_READY: 140, OVERDUE: 200,
  });
  const lettuce_thresholds = JSON.stringify({
    GERMINATING: 7, SEEDLING: 14, GROWING: 30, HARVEST_READY: 55, OVERDUE: 200,
  });
  const sugarpea_thresholds = JSON.stringify({
    GERMINATING: 12, SEEDLING: 20, GROWING: 55, FLOWERING: 75,
    HARVEST_READY: 77, OVERDUE: 120,
  });
  const wintergreens_thresholds = JSON.stringify({
    GERMINATING: 7, SEEDLING: 14, GROWING: 25, HARVEST_READY: 50, OVERDUE: 300,
  });

  // bed1 cauliflower positions
  for (const [col, row] of [[0,0],[2,0],[0,2],[2,2]]) {
    insertPlant.run('bed1', 'Cauliflower', 'Tasty', col, row, PLANTED, 140, 168, cauli_thresholds);
  }
  // bed1 beetroot positions
  for (const [col, row] of [[1,0],[0,1],[1,1],[2,1],[1,2],[0,3],[1,3],[2,3]]) {
    insertPlant.run('bed1', 'Beetroot', 'Detroit', col, row, PLANTED, 119, 170, beetroot_thresholds);
  }

  // bed2 broad beans — 4×5 grid (cols 0-3, rows 0-4)
  for (let col = 0; col <= 3; col++) {
    for (let row = 0; row <= 4; row++) {
      insertPlant.run('bed2', 'Broad Bean', 'Coles Early', col, row, PLANTED, 130, 165, broadbean_thresholds);
    }
  }

  // bed3 carrots — columns 0 and 2, rows 0-4
  for (const col of [0, 2]) {
    for (let row = 0; row <= 4; row++) {
      insertPlant.run('bed3', 'Carrot', 'Every Season', col, row, PLANTED, 147, 182, carrot_thresholds);
    }
  }
  // bed3 lettuce — column 1, rows 0,2,4
  for (const row of [0, 2, 4]) {
    insertPlant.run('bed3', 'Lettuce', 'All Year', 1, row, PLANTED, 56, 9999, lettuce_thresholds);
  }

  // bed4 sugar peas — 2×8 grid (cols 0-1, rows 0-7)
  for (let col = 0; col <= 1; col++) {
    for (let row = 0; row <= 7; row++) {
      insertPlant.run('bed4', 'Sugar Pea', 'Sugar Snap', col, row, PLANTED, 77, 133, sugarpea_thresholds);
    }
  }

  // bed5 winter greens — 2×8 grid (cols 0-1, rows 0-7)
  for (let col = 0; col <= 1; col++) {
    for (let row = 0; row <= 7; row++) {
      insertPlant.run('bed5', 'Spinach/Silverbeet/Kale', 'Mix', col, row, PLANTED, 45, 9999, wintergreens_thresholds);
    }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const insertTask = db.prepare(
    `INSERT INTO tasks (week_number, bed_id, title, is_complete, completed_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  // Week 0
  insertTask.run(0, null, 'Sprayed Liquid Gold + Eco Booch into soil (all beds)', 1, '2026-04-26T00:00:00.000Z');

  // Week 1
  insertTask.run(1, null,  'Add 5–7cm compost to all 5 beds and dig in lightly', 0, null);
  insertTask.run(1, null,  'Add Blood & Bone (handful per bed) and rake in', 0, null);
  insertTask.run(1, 'bed1','Add Dolomite Lime to Bed 1', 0, null);
  insertTask.run(1, 'bed3','Add Dolomite Lime to Bed 3', 0, null);
  insertTask.run(1, 'bed1','Plant 4 cauliflower seedlings at 45cm spacing; sow beetroot in rows 10cm apart', 0, null);
  insertTask.run(1, 'bed2','Sow broad beans in 4 staggered rows, 20cm spacing, 4cm deep', 0, null);
  insertTask.run(1, 'bed3','Sow carrot seeds in rows 15cm apart; transplant lettuce to edges', 0, null);
  insertTask.run(1, 'bed4','Sow sugar snap peas along trellis, 10–15cm spacing, 2 rows', 0, null);
  insertTask.run(1, 'bed5','Sow spinach/silverbeet/kale', 0, null);
  insertTask.run(1, 'bed2','Drive in 1.2m bamboo canes along Bed 2 for broad beans — one per plant pair', 0, null);
  insertTask.run(1, 'bed4','Attach and secure trellis netting to Bed 4', 0, null);
  insertTask.run(1, null,  'Apply iron-based pet-safe snail bait around all beds', 0, null);
  insertTask.run(1, null,  'Check chicken run netting is secure and away from beds', 0, null);

  // Week 2
  insertTask.run(2, null,  'Check all beds for germination', 0, null);
  insertTask.run(2, null,  'Top up snail bait if wet weather occurred', 0, null);
  insertTask.run(2, 'bed1','Firm in any cauliflower seedlings that have loosened', 0, null);
  insertTask.run(2, null,  'Cover with frost cloth if overnight temp forecast below 4°C', 0, null);

  // Week 3
  insertTask.run(3, null,  "Apply Vasili's Liquid Gold diluted to root zone of all beds", 0, null);
  insertTask.run(6, 'bed2','Tie broad bean shoots loosely to canes — plants should be 20–30cm now', 0, null);
  insertTask.run(3, 'bed1','Check germination — resow any bare patches in Bed 1', 0, null);
  insertTask.run(3, 'bed3','Check germination — resow any bare patches in Bed 3', 0, null);
  insertTask.run(3, 'bed3','Thin lettuce seedlings to 20cm apart', 0, null);
  insertTask.run(3, 'bed1','Check cauliflower for aphids — spray diluted soapy water if found', 0, null);

  // Week 4
  insertTask.run(4, null,  "Apply Vasili's Eco Booch diluted to all beds", 0, null);
  insertTask.run(4, 'bed3','Thin carrots to 8cm apart', 0, null);
  insertTask.run(4, 'bed1','Thin beetroot to 10cm apart', 0, null);
  insertTask.run(4, 'bed1','Side-dress cauliflower with handful of Blood & Bone around each plant', 0, null);
  insertTask.run(4, 'bed2','Stake individual broad bean stems if wind picking up', 0, null);
  insertTask.run(4, null,  'Replenish snail bait', 0, null);

  // Week 5
  insertTask.run(5, null,  "Apply Vasili's Liquid Gold to all beds", 0, null);
  insertTask.run(5, null,  'Bed-by-bed visual review — all crops should be visibly establishing', 0, null);
  insertTask.run(5, 'bed4','Check peas are attaching to trellis — tie stragglers', 0, null);
  insertTask.run(5, null,  'Hand-weed gaps (no hoeing near carrots or beetroot)', 0, null);
  insertTask.run(5, 'bed5','Thin winter greens if overcrowded', 0, null);

  // Week 6
  insertTask.run(6, null,  "Apply Vasili's Eco Booch to all beds", 0, null);
  insertTask.run(6, 'bed3','Plant garlic in gaps in Bed 3 — 10cm deep, 15cm apart, pointed end up', 0, null);
  insertTask.run(6, 'bed5','Plant garlic in gaps in Bed 5 — 10cm deep, 15cm apart, pointed end up', 0, null);
  insertTask.run(6, 'bed1','Check cauliflower for green caterpillars — pick off or net bed', 0, null);
  insertTask.run(6, 'bed2','Confirm broad beans are 30–40cm and well staked', 0, null);
  insertTask.run(6, null,  'Prepare frost cloth — June frosts begin in Eltham', 0, null);

  // Week 7
  insertTask.run(7, null,  "Apply Vasili's Liquid Gold to all beds", 0, null);
  insertTask.run(7, 'bed1','Side-dress cauliflower with Blood & Bone', 0, null);
  insertTask.run(7, 'bed3','Check for healthy ferny carrot tops — sign of good root development below', 0, null);
  insertTask.run(7, 'bed4','Watch for first pea flower buds forming', 0, null);
  insertTask.run(7, null,  'Cover beds on nights below 2°C', 0, null);

  // Week 8
  insertTask.run(8, null,  "Apply Vasili's Eco Booch to all beds", 0, null);
  insertTask.run(8, 'bed3','Garlic shoots should be visible in Bed 3 — check', 0, null);
  insertTask.run(8, 'bed5','Garlic shoots should be visible in Bed 5 — check', 0, null);
  insertTask.run(8, 'bed2','Pinch off broad bean shoot tips if black aphid clusters found', 0, null);
  insertTask.run(8, null,  'Replenish snail bait', 0, null);
  insertTask.run(8, 'bed1','Mound soil around cauliflower base if stems look leggy', 0, null);
  insertTask.run(8, 'bed3','Begin harvesting lettuce — outer leaves only, leave plant intact', 0, null);
  insertTask.run(8, 'bed5','Begin harvesting spinach/silverbeet outer leaves', 0, null);

  // Weeks 9–12
  for (let w = 9; w <= 12; w++) {
    insertTask.run(w, null,  'Alternate Liquid Gold / Eco Booch every 2 weeks (fortnightly)', 0, null);
    insertTask.run(w, 'bed2','Stake and tie broad beans as they reach 90–120cm', 0, null);
    insertTask.run(w, 'bed3','Ongoing cut-and-come-again harvest of lettuce', 0, null);
    insertTask.run(w, 'bed5','Ongoing cut-and-come-again harvest of winter greens', 0, null);
    insertTask.run(w, null,  'Check for slugs after rain — reapply bait', 0, null);
  }
  // Monthly cauliflower Blood & Bone at weeks 9 and 13 only (not every week)
  insertTask.run(9,  'bed1','Side-dress cauliflower with Blood & Bone around each plant', 0, null);
  insertTask.run(10, 'bed1','Tie outer leaves over cauliflower curds as heads begin to form — protects from frost and sun discolouration', 0, null);

  insertTask.run(13, 'bed1','Side-dress cauliflower with Blood & Bone around each plant (monthly)', 0, null);

  // Weeks 13–16
  for (let w = 13; w <= 16; w++) {
    insertTask.run(w, null,  'Continue alternating Liquid Gold / Eco Booch fortnightly', 0, null);
    insertTask.run(w, 'bed4','Harvest sugar snap peas daily when pods are plump', 0, null);
    insertTask.run(w, 'bed2','Harvest broad beans when you can feel beans inside the pod', 0, null);
    insertTask.run(w, 'bed1','Pull-test beetroot when shoulder reaches 4–5cm diameter', 0, null);
    insertTask.run(w, 'bed1','Harvest cauliflower when head is tight and firm — before it bolts', 0, null);
    insertTask.run(w, null,  'Plan next crops for beds as they clear', 0, null);
  }

  // Weeks 17–20
  for (let w = 17; w <= 20; w++) {
    if (w % 2 !== 0) {
      insertTask.run(w, null, "Apply Vasili's Liquid Gold to remaining crops", 0, null);
    } else {
      insertTask.run(w, null, "Apply Vasili's Eco Booch to remaining crops", 0, null);
    }
    insertTask.run(w, 'bed3','Harvest carrots with a gentle pull test', 0, null);
    insertTask.run(w, 'bed2','Clear spent bean plants — compost (nitrogen fixers, a bonus)', 0, null);
    insertTask.run(w, 'bed4','Clear spent pea plants — compost (nitrogen fixers, a bonus)', 0, null);
    insertTask.run(w, 'bed5','Prepare for climbing beans — add compost and Blood & Bone', 0, null);
    insertTask.run(w, null,  'Plan tomatoes/zucchini/capsicum for cleared beds if desired', 0, null);
  }

  // Week 21
  insertTask.run(21, null,  'Apply Liquid Gold to all prepped beds before planting', 0, null);
  insertTask.run(24, 'bed5','Sow Climbing Bean Vitalis — mid-October frost risk now past in Eltham', 0, null);
  insertTask.run(21, null,  'Begin fortnightly Eco Booch on all spring crops', 0, null);
}

// ─── Seed types — seeded separately so they survive DB resets ─────────────────

const seedTypesCount = db.prepare('SELECT COUNT(*) as cnt FROM seed_types').get().cnt;

if (seedTypesCount === 0) {
  const initSeedType = db.prepare(`
    INSERT INTO seed_types (name, variety, category, stage_thresholds, harvest_start_day, harvest_end_day, spacing_cm, sow_depth_cm, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  initSeedType.run('Cauliflower', 'Tasty', 'brassica',
    JSON.stringify({ SEEDLING: 14, GROWING: 60, HEADING: 100, HARVEST_READY: 140, OVERDUE: 180 }),
    140, 168, 45, 1,
    'Transplant seedlings at 45cm spacing. Tie outer leaves over curds when head begins forming to protect from frost and sun discolouration.');
  initSeedType.run('Beetroot', 'Detroit', 'root',
    JSON.stringify({ GERMINATING: 14, SEEDLING: 28, GROWING: 60, HARVEST_READY: 120, OVERDUE: 170 }),
    119, 170, 10, 2,
    'Sow direct in rows 10cm apart. Thin to 10cm when seedlings emerge. Harvest when shoulder reaches 4–5cm diameter.');
  initSeedType.run('Broad Bean', 'Coles Early', 'legume',
    JSON.stringify({ GERMINATING: 10, SEEDLING: 25, GROWING: 70, FLOWERING: 100, HARVEST_READY: 130, OVERDUE: 165 }),
    130, 165, 20, 4,
    'Sow direct at 20cm spacing, 4cm deep. Stake with 1.2m bamboo canes. Harvest when you can feel beans inside the pod.');
  initSeedType.run('Carrot', 'Every Season', 'root',
    JSON.stringify({ GERMINATING: 14, SEEDLING: 30, GROWING: 80, HARVEST_READY: 140, OVERDUE: 200 }),
    147, 182, 15, 1,
    'Sow direct in fine rows 15cm apart. Thin to 5cm spacing. Carrots improve in cool soil and hold well past harvest_ready.');
  initSeedType.run('Lettuce', 'All Year', 'leaf',
    JSON.stringify({ GERMINATING: 7, SEEDLING: 14, GROWING: 30, HARVEST_READY: 55, OVERDUE: 200 }),
    56, 9999, 20, 0.5,
    'Transplant or sow direct. Cut-and-come-again. Harvest outer leaves continuously through winter.');
  initSeedType.run('Sugar Pea', 'Sugar Snap', 'legume',
    JSON.stringify({ GERMINATING: 12, SEEDLING: 20, GROWING: 55, FLOWERING: 75, HARVEST_READY: 77, OVERDUE: 120 }),
    77, 133, 12, 2,
    'Sow direct along trellis netting at 10–15cm spacing. Harvest daily when pods are plump and full.');
  initSeedType.run('Spinach/Silverbeet/Kale', 'Mix', 'leaf',
    JSON.stringify({ GERMINATING: 7, SEEDLING: 14, GROWING: 25, HARVEST_READY: 50, OVERDUE: 300 }),
    45, 9999, 20, 1,
    'Sow direct or transplant. Cut-and-come-again throughout the cool season. Overdue threshold is high — these crops continue producing indefinitely.');
}

// ─── Prepared queries ─────────────────────────────────────────────────────────

const getAllBeds = db.prepare('SELECT * FROM beds ORDER BY id');
const getPlantsByBed = db.prepare('SELECT * FROM plants WHERE bed_id = ? ORDER BY id');
const getAllPlants = db.prepare('SELECT * FROM plants ORDER BY id');
const getTasksByWeek = db.prepare('SELECT * FROM tasks WHERE week_number = ? ORDER BY id');
const getIncompleteTasksBefore = db.prepare(
  'SELECT * FROM tasks WHERE week_number < ? AND is_complete = 0 ORDER BY week_number, id'
);
const getTaskById = db.prepare('SELECT * FROM tasks WHERE id = ?');
const updateTaskComplete = db.prepare(
  'UPDATE tasks SET is_complete = ?, completed_at = ? WHERE id = ?'
);
const getLastFertiliserByBed = db.prepare(
  'SELECT product, applied_at FROM fertiliser_log WHERE bed_id = ? ORDER BY id DESC LIMIT 1'
);
const insertFertiliserLog = db.prepare(
  'INSERT INTO fertiliser_log (bed_id, product, applied_at) VALUES (?, ?, ?)'
);
const getNotesByBed = db.prepare(
  'SELECT * FROM notes WHERE bed_id = ? ORDER BY id DESC LIMIT 10'
);
const insertNote = db.prepare(
  'INSERT INTO notes (bed_id, content, created_at) VALUES (?, ?, ?)'
);
const countNotesByBed = db.prepare('SELECT COUNT(*) as cnt FROM notes WHERE bed_id = ?');
const deleteOldestNoteByBed = db.prepare(
  'DELETE FROM notes WHERE id = (SELECT id FROM notes WHERE bed_id = ? ORDER BY id ASC LIMIT 1)'
);
const getNoteById = db.prepare('SELECT * FROM notes WHERE id = ?');
const getAnalysisByBed = db.prepare(
  'SELECT id, bed_id, result_json, created_at FROM analysis_log WHERE bed_id = ? ORDER BY id DESC LIMIT 3'
);
const insertAnalysis = db.prepare(
  'INSERT INTO analysis_log (bed_id, image_base64, result_json, created_at) VALUES (?, ?, ?, ?)'
);
const getBedById = db.prepare('SELECT * FROM beds WHERE id = ?');
const getAllSeedTypes = db.prepare('SELECT * FROM seed_types ORDER BY name, variety');
const getSeedTypeById = db.prepare('SELECT * FROM seed_types WHERE id = ?');
const insertSeedTypeStmt = db.prepare(`
  INSERT INTO seed_types (name, variety, category, stage_thresholds, harvest_start_day, harvest_end_day, spacing_cm, sow_depth_cm, notes, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);
const updateSeedTypeStmt = db.prepare(`
  UPDATE seed_types SET name=?, variety=?, category=?, stage_thresholds=?, harvest_start_day=?, harvest_end_day=?, spacing_cm=?, sow_depth_cm=?, notes=?, updated_at=datetime('now')
  WHERE id=?
`);
const deleteSeedTypeStmt = db.prepare('DELETE FROM seed_types WHERE id = ?');
const getTaskStatsByBed = db.prepare(
  `SELECT bed_id, COUNT(*) as total, SUM(is_complete) as completed
   FROM tasks WHERE bed_id IS NOT NULL GROUP BY bed_id`
);
const getAllTasksForBed = db.prepare(
  'SELECT * FROM tasks WHERE (bed_id = ? OR bed_id IS NULL) ORDER BY week_number, id'
);
const getRecentFertiliserByBed = db.prepare(
  'SELECT product, applied_at FROM fertiliser_log WHERE bed_id = ? ORDER BY id DESC LIMIT 5'
);

// ─── Validation helpers ────────────────────────────────────────────────────────

function isValidBedId(id) {
  return typeof id === 'string' && /^[a-z0-9_-]{1,32}$/.test(id);
}

// Magic-byte image type detection — never trust client-supplied MIME headers
const MAGIC_CHECKS = [
  { mime: 'image/jpeg', check: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { mime: 'image/png',  check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { mime: 'image/gif',  check: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  { mime: 'image/webp', check: (b) => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                                      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  // HEIC/HEIF: ISO base media file — 'ftyp' box at offset 4 with known HEIC brands
  { mime: 'image/heic', check: (b) => b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
                                      ['heic','heix','hevc','hevx','mif1'].includes(b.slice(8, 12).toString('ascii')) },
];

function detectImageMagicType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  for (const { mime, check } of MAGIC_CHECKS) {
    if (check(buffer)) return mime;
  }
  return null;
}

// ─── Bed helper ───────────────────────────────────────────────────────────────

function enrichBed(bed) {
  const plants = getPlantsByBed.all(bed.id).map((p) => {
    const daysSincePlanted = Math.floor(
      (Date.now() - new Date(p.planted_date).getTime()) / 86400000
    );
    const stage = computeStage(p.planted_date, p.stage_thresholds);
    const daysToHarvest = Math.max(0, p.harvest_start_day - daysSincePlanted);
    return {
      id: p.id,
      name: p.name,
      variety: p.variety,
      grid_col: p.grid_col,
      grid_row: p.grid_row,
      planted_date: p.planted_date,
      stage,
      days_since_planted: daysSincePlanted,
      days_to_harvest: daysToHarvest,
      harvest_start_day: p.harvest_start_day,
      harvest_end_day: p.harvest_end_day,
      stage_thresholds: JSON.parse(p.stage_thresholds),
    };
  });
  return { id: bed.id, name: bed.name, width_cm: bed.width_cm, height_cm: bed.height_cm, plants };
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],   // inline JS in index.html
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      scriptSrcAttr: null,            // app uses inline onclick handlers throughout index.html
      upgradeInsecureRequests: null,  // app runs over plain HTTP on LAN — don't upgrade
    },
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Block cross-origin requests — compare Origin against the actual Host to allow
// same-origin fetch() calls (browsers send Origin even for same-origin requests)
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin) {
    const host = req.get('Host');
    if (origin !== `http://${host}` && origin !== `https://${host}`) {
      return res.status(403).json({ error: 'Cross-origin requests not allowed' });
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const analyseLimiter = rateLimit({ windowMs: 60_000, max: 10, message: { error: 'Too many requests — try again in a minute' } });
const apiLimiter = rateLimit({ windowMs: 60_000, max: 200, message: { error: 'Too many requests' } });
app.use('/api/analyse', analyseLimiter);
app.use('/api/', apiLimiter);

// Multer — memory storage, single image field, 10 MB limit, image types only
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type "${file.mimetype}". Allowed: jpeg, png, gif, webp, heic`));
    }
  },
}).single('image');

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// GET /api/state
app.get('/api/state', (req, res) => {
  const currentWeek = getCurrentWeek();
  const currentDate = new Date().toISOString().split('T')[0];
  const fertiliser = getCurrentFertiliser();

  const beds = getAllBeds.all().map(enrichBed);

  const currentTasks = getTasksByWeek.all(currentWeek);
  const overdueTasks = getIncompleteTasksBefore.all(currentWeek);
  const taskStats = getTaskStatsByBed.all();
  const taskSummary = {};
  for (const s of taskStats) {
    taskSummary[s.bed_id] = { total: s.total, completed: s.completed || 0 };
  }

  res.json({
    currentWeek,
    currentDate,
    fertiliser,
    beds,
    tasks: { current: currentTasks, overdue: overdueTasks },
    taskSummary,
  });
});

// GET /api/beds
app.get('/api/beds', (req, res) => {
  const beds = getAllBeds.all().map(enrichBed);
  res.json(beds);
});

// GET /api/tasks/:week
app.get('/api/tasks/:week', (req, res) => {
  const week = parseInt(req.params.week, 10);
  if (isNaN(week)) {
    return res.status(400).json({ error: 'week must be an integer' });
  }
  const tasks = getTasksByWeek.all(week);
  res.json(tasks);
});

// POST /api/tasks/:id/complete
app.post('/api/tasks/:id/complete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'id must be an integer' });
  }
  const task = getTaskById.get(id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const newComplete = task.is_complete === 0 ? 1 : 0;
  const completedAt = newComplete === 1 ? new Date().toISOString() : null;
  updateTaskComplete.run(newComplete, completedAt, id);
  const updated = getTaskById.get(id);
  res.json(updated);
});

// GET /api/fertiliser
app.get('/api/fertiliser', (req, res) => {
  const currentWeek = getCurrentWeek();
  const currentProduct = getFertiliserForWeek(currentWeek);

  const instructions =
    'Apply diluted to root zone — not foliar spray in winter';

  const upcoming = [];
  for (let i = 1; i <= 8; i++) {
    const w = currentWeek + i;
    upcoming.push({ week: w, product: getFertiliserForWeek(w) });
  }

  const beds = getAllBeds.all();
  const bedStatus = beds.map((bed) => {
    const last = getLastFertiliserByBed.get(bed.id);
    const history = getRecentFertiliserByBed.all(bed.id);
    return {
      bed_id: bed.id,
      bed_name: bed.name,
      last_applied: last ? last.applied_at : null,
      last_product: last ? last.product : null,
      history,
    };
  });

  res.json({ currentWeek, currentProduct, instructions, upcoming, bedStatus });
});

// POST /api/fertiliser/apply
app.post('/api/fertiliser/apply', (req, res) => {
  const { bed_id } = req.body;
  if (!bed_id) {
    return res.status(400).json({ error: 'bed_id is required' });
  }
  if (!isValidBedId(bed_id)) {
    return res.status(400).json({ error: 'Invalid bed_id' });
  }
  const bed = getBedById.get(bed_id);
  if (!bed) {
    return res.status(404).json({ error: 'Bed not found' });
  }
  const product = getCurrentFertiliser();
  const applied_at = new Date().toISOString();
  insertFertiliserLog.run(bed_id, product, applied_at);
  res.json({ success: true, product, applied_at });
});

// GET /api/notes/:bed_id
app.get('/api/notes/:bed_id', (req, res) => {
  const { bed_id } = req.params;
  if (!isValidBedId(bed_id)) return res.status(400).json({ error: 'Invalid bed_id' });
  const bed = getBedById.get(bed_id);
  if (!bed) return res.status(404).json({ error: 'Bed not found' });
  const notes = getNotesByBed.all(bed_id);
  res.json(notes);
});

// POST /api/notes/:bed_id
app.post('/api/notes/:bed_id', (req, res) => {
  const { bed_id } = req.params;
  if (!isValidBedId(bed_id)) return res.status(400).json({ error: 'Invalid bed_id' });
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'content is required' });
  }
  if (content.length > 2000) {
    return res.status(400).json({ error: 'content must be 2000 characters or fewer' });
  }
  const bed = getBedById.get(bed_id);
  if (!bed) {
    return res.status(404).json({ error: 'Bed not found' });
  }
  const created_at = new Date().toISOString();
  const result = insertNote.run(bed_id, content.trim(), created_at);
  const saved = getNoteById.get(result.lastInsertRowid);

  // Trim to most recent 10
  const { cnt } = countNotesByBed.get(bed_id);
  if (cnt > 10) {
    deleteOldestNoteByBed.run(bed_id);
  }

  res.json(saved);
});

// GET /api/analysis/:bed_id
app.get('/api/analysis/:bed_id', (req, res) => {
  const { bed_id } = req.params;
  if (!isValidBedId(bed_id)) return res.status(400).json({ error: 'Invalid bed_id' });
  const bed = getBedById.get(bed_id);
  if (!bed) return res.status(404).json({ error: 'Bed not found' });
  const analyses = getAnalysisByBed.all(bed_id);
  res.json(analyses);
});

// POST /api/analyse
app.post('/api/analyse', (req, res) => {
  if (!anthropicClient) {
    return res.status(503).json({ error: 'AI analysis unavailable — set ANTHROPIC_API_KEY to enable' });
  }
  upload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large — 10 MB maximum' });
      }
      if (err && typeof err.message === 'string' && err.message.startsWith('Invalid file type')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: 'Invalid upload' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'image file is required' });
    }

    const bed_id = req.body && req.body.bed_id;
    if (!bed_id) {
      return res.status(400).json({ error: 'bed_id is required' });
    }
    if (!isValidBedId(bed_id)) {
      return res.status(400).json({ error: 'Invalid bed_id' });
    }

    const bed = getBedById.get(bed_id);
    if (!bed) {
      return res.status(404).json({ error: 'Bed not found' });
    }

    const detectedType = detectImageMagicType(req.file.buffer);
    if (!detectedType) {
      return res.status(400).json({ error: 'File content is not a supported image format (JPEG, PNG, GIF, WebP, HEIC)' });
    }

    try {
      const plants = getPlantsByBed.all(bed_id);

      // Build crop list and per-crop expected stages
      const cropList = [...new Set(plants.map((p) => `${p.name} (${p.variety})`))].join(', ');
      const primaryPlant = plants[0] || null;
      const plantedDate = primaryPlant ? primaryPlant.planted_date : 'unknown';
      const currentWeek = getCurrentWeek();

      const stagesByCrop = plants.reduce((acc, p) => {
        const key = `${p.name} (${p.variety})`;
        if (!acc[key]) {
          acc[key] = computeStage(p.planted_date, p.stage_thresholds);
        }
        return acc;
      }, {});
      const expectedStageText = Object.entries(stagesByCrop)
        .map(([crop, stage]) => `${crop}: ${stage}`)
        .join(', ');

      const systemPrompt =
        'You are an expert vegetable gardener assistant specialising in cool-climate home growing in Melbourne, Australia (outer suburbs, Eltham — USDA zone 10a, mild frosts June–July). Analyse this garden bed photo.';

      const userPrompt = `If this image does not show a garden bed or plants, return: {"error": "not a garden image"} and nothing else.

The bed contains: ${cropList}.
Planted on: ${plantedDate}.
Current week: ${currentWeek}.
Expected growth stages: ${expectedStageText}.
Return a JSON object with these exact keys:
{
  "health_score": 1-10,
  "health_summary": "string (1 sentence)",
  "observed_stage": "one of SEEDED|GERMINATING|SEEDLING|GROWING|HEADING|FLOWERING|HARVEST_READY|OVERDUE",
  "stage_matches_expected": true/false,
  "issues_detected": ["string array, empty if none"],
  "harvest_estimate": "string e.g. '3-4 weeks' or 'Ready now' or 'Not applicable'",
  "recommendations": ["max 3 actionable items"],
  "urgent": true/false
}
Return ONLY the JSON object. No preamble, no markdown.`;

      const imageBase64 = req.file.buffer.toString('base64');
      const imageMediaType = detectedType;

      const response = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageMediaType,
                  data: imageBase64,
                },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      });

      const resultText = response.content[0].text;
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (_) {
        return res.status(500).json({ error: 'Model returned non-JSON response', raw: resultText.slice(0, 300) });
      }

      const created_at = new Date().toISOString();
      insertAnalysis.run(bed_id, imageBase64, JSON.stringify(result), created_at);

      res.json(result);
    } catch (analysisErr) {
      console.error('Analysis error:', analysisErr);
      res.status(500).json({ error: 'Analysis failed' });
    }
  });
});

// GET /api/tasks/bed/:bed_id
app.get('/api/tasks/bed/:bed_id', (req, res) => {
  const { bed_id } = req.params;
  if (!isValidBedId(bed_id)) return res.status(400).json({ error: 'Invalid bed_id' });
  const bed = getBedById.get(bed_id);
  if (!bed) return res.status(404).json({ error: 'Bed not found' });
  const tasks = getAllTasksForBed.all(bed_id);
  res.json(tasks);
});

// ─── Seed types CRUD ──────────────────────────────────────────────────────────

function parseSeedTypeBody(body) {
  const name = (body.name || '').trim();
  const variety = (body.variety || '').trim();
  const category = (body.category || '').trim();
  const notes = (body.notes || '').trim();
  const harvest_start_day = parseInt(body.harvest_start_day, 10);
  const harvest_end_day = parseInt(body.harvest_end_day, 10);
  const spacing_cm = parseInt(body.spacing_cm, 10) || 20;
  const sow_depth_cm = parseFloat(body.sow_depth_cm) || 2;

  if (!name) return { error: 'name is required' };
  if (name.length > 80) return { error: 'name must be 80 characters or fewer' };
  if (isNaN(harvest_start_day) || harvest_start_day < 0) return { error: 'harvest_start_day must be a non-negative integer' };
  if (isNaN(harvest_end_day) || harvest_end_day < harvest_start_day) return { error: 'harvest_end_day must be >= harvest_start_day' };

  let stage_thresholds = body.stage_thresholds || '{}';
  if (typeof stage_thresholds === 'string') {
    try { JSON.parse(stage_thresholds); } catch (_) { return { error: 'stage_thresholds must be valid JSON' }; }
  } else {
    stage_thresholds = JSON.stringify(stage_thresholds);
  }

  return { name, variety, category, stage_thresholds, harvest_start_day, harvest_end_day, spacing_cm, sow_depth_cm, notes };
}

// GET /api/seed-types
app.get('/api/seed-types', (_req, res) => {
  res.json(getAllSeedTypes.all());
});

// POST /api/seed-types
app.post('/api/seed-types', (req, res) => {
  const parsed = parseSeedTypeBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, variety, category, stage_thresholds, harvest_start_day, harvest_end_day, spacing_cm, sow_depth_cm, notes } = parsed;
  const result = insertSeedTypeStmt.run(name, variety, category, stage_thresholds, harvest_start_day, harvest_end_day, spacing_cm, sow_depth_cm, notes);
  res.status(201).json(getSeedTypeById.get(result.lastInsertRowid));
});

// PUT /api/seed-types/:id
app.put('/api/seed-types/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'id must be an integer' });
  if (!getSeedTypeById.get(id)) return res.status(404).json({ error: 'Seed type not found' });
  const parsed = parseSeedTypeBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, variety, category, stage_thresholds, harvest_start_day, harvest_end_day, spacing_cm, sow_depth_cm, notes } = parsed;
  updateSeedTypeStmt.run(name, variety, category, stage_thresholds, harvest_start_day, harvest_end_day, spacing_cm, sow_depth_cm, notes, id);
  res.json(getSeedTypeById.get(id));
});

// DELETE /api/seed-types/:id
app.delete('/api/seed-types/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'id must be an integer' });
  if (!getSeedTypeById.get(id)) return res.status(404).json({ error: 'Seed type not found' });
  deleteSeedTypeStmt.run(id);
  res.json({ deleted: true });
});

// POST /api/seed-types/ai-suggest
app.post('/api/seed-types/ai-suggest', async (req, res) => {
  if (!anthropicClient) return res.status(503).json({ error: 'AI unavailable — set ANTHROPIC_API_KEY to enable' });
  const name = (req.body.name || '').trim();
  const variety = (req.body.variety || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const prompt = `You are an expert vegetable gardener for cool-climate Melbourne, Australia (Eltham, zone 10a — mild frosts June–July, cool but not severe winters, season start late April).

Generate planting data for: ${name}${variety ? ` (variety: ${variety})` : ''}.

Return ONLY a JSON object with these exact keys — no preamble, no markdown:
{
  "category": "one of: brassica, root, legume, leaf, fruit, allium, herb, other",
  "stage_thresholds": {
    "GERMINATING": <days from sow to germination, omit if transplant>,
    "SEEDLING": <days>,
    "GROWING": <days>,
    "FLOWERING": <days, omit if plant does not flower before harvest>,
    "HEADING": <days, brassicas that form a head only>,
    "HARVEST_READY": <days>,
    "OVERDUE": <days — when quality degrades or plant bolts>
  },
  "harvest_start_day": <number, same as or slightly before HARVEST_READY>,
  "harvest_end_day": <number, or 9999 for cut-and-come-again crops>,
  "spacing_cm": <number>,
  "sow_depth_cm": <number>,
  "notes": "2–3 sentences on sowing method, support, harvest cues for Eltham cool climate"
}`;

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content[0].text;
    let suggestion;
    try {
      suggestion = JSON.parse(raw);
    } catch (_) {
      return res.status(500).json({ error: 'AI returned non-JSON response', raw: raw.slice(0, 300) });
    }
    res.json(suggestion);
  } catch (err) {
    console.error('AI suggest error:', err);
    res.status(500).json({ error: 'AI suggestion failed' });
  }
});

// ─── Error handling middleware ─────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Garden Tracker running on port ${PORT}`);
});
