/**
 * Bot play test runner.
 *   npm run playtest:bots -- [--levels 1-40] [--scale 1] [--out bot-report]
 * Writes <out>/results.json (per level x bot aggregates) and <out>/games.csv.
 */
import fs from 'fs';
import path from 'path';
import { LevelConfig } from '../src/types';
import { GameState } from '../src/engine/gameEngine';
import { BOTS, mulberry32 } from '../src/bot/bots';
import { solve } from '../src/bot/solver';
import { initState, step, endReason, remainingCells, exposedByColor, EndReason } from '../src/bot/simulator';
import levelsJson from '../src/data/levels/sheetLevels.json';

const LEVELS = levelsJson as unknown as LevelConfig[];

const args = process.argv.slice(2);
const arg = (k: string, d: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const [lo, hi] = arg('--levels', '1-40').split('-').map(Number);
const scale = Number(arg('--scale', '1'));
const outDir = arg('--out', 'bot-report');
const solverBudget = Number(arg('--solver-budget', '30000'));
const only = arg('--bots', '');

interface Game {
  won: boolean;
  reason: EndReason;
  taps: number;
  totalBoxes: number;
  filledPct: number;
  lines: number;
  peakParked: number;
  stuckColors: string[]; // colors of parked boxes that had nowhere to go at loss
  exposedAtLoss: string[];
}

function playGame(level: LevelConfig, choose: (s: GameState, r: () => number) => number, seed: number): Game {
  const rng = mulberry32(seed);
  let s = initState(level);
  const totalBoxes = s.queues.reduce((a, q) => a + q.length, 0);
  let taps = 0;
  let peak = 0;
  let reason = endReason(s);
  while (!reason && taps < 500) {
    const q = choose(s, rng);
    const n = step(s, q);
    if (!n) break;
    s = n;
    taps++;
    peak = Math.max(peak, s.parkingSlots.filter(Boolean).length);
    reason = endReason(s);
  }
  const ex = exposedByColor(s);
  return {
    won: reason === 'won',
    reason: reason || 'move_cap',
    taps,
    totalBoxes,
    filledPct: 100 * (1 - remainingCells(s) / s.initialCellCount),
    lines: s.stats.linesCleared,
    peakParked: peak,
    stuckColors: reason === 'won' ? [] : s.parkingSlots.filter(b => b && !ex.get(b.color)).map(b => b!.color),
    exposedAtLoss: reason === 'won' ? [] : [...ex.keys()]
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function levelFacts(level: LevelConfig) {
  const cells = level.grid.cells.flat().filter(Boolean) as NonNullable<LevelConfig['grid']['cells'][0][0]>[];
  const need: Record<string, number> = {};
  const have: Record<string, number> = {};
  cells.forEach(c => (need[c.color] = (need[c.color] || 0) + 1));
  level.queues.flat().forEach(b => (have[b.color] = (have[b.color] || 0) + b.count));
  const mismatch = Object.keys({ ...need, ...have })
    .filter(k => (need[k] || 0) !== (have[k] || 0))
    .map(k => ({ color: k, cells: need[k] || 0, cats: have[k] || 0 }));
  const s0 = initState(level);
  const startExposed = [...exposedByColor(s0).values()].reduce((a, b) => a + b, 0);
  return {
    size: `${level.grid.rows}x${level.grid.cols}`,
    cells: cells.length,
    colors: Object.keys(need).length,
    queues: level.queues.length,
    boxes: level.queues.flat().length,
    mystery: level.queues.flat().filter(b => b.isMystery).length,
    hidden: cells.filter(c => c.hiddenGroup).length,
    locked: cells.filter(c => c.lockCount).length,
    difficultyTag: level.difficulty || 'normal',
    unlockFeature: level.unlockFeature || null,
    startExposed,
    mismatch
  };
}

const results: any[] = [];
const csv: string[] = ['level,bot,run,won,reason,taps,totalBoxes,filledPct,lines,peakParked,stuckColors'];
fs.mkdirSync(outDir, { recursive: true });

for (const level of LEVELS.filter(l => +l.id >= lo && +l.id <= hi)) {
  const t0 = Date.now();
  const facts = levelFacts(level);
  const row: any = { level: +level.id, facts, bots: {} };
  for (const bot of BOTS) {
    if (only && !only.split(',').includes(bot.id)) continue;
    const runs = Math.max(1, Math.round(bot.runs * scale));
    const games: Game[] = [];
    for (let i = 0; i < runs; i++) {
      const g = playGame(level, bot.choose, 1000 * +level.id + i + 7);
      games.push(g);
      csv.push(
        [level.id, bot.id, i, g.won ? 1 : 0, g.reason, g.taps, g.totalBoxes, g.filledPct.toFixed(1), g.lines, g.peakParked, g.stuckColors.join('|')].join(',')
      );
    }
    const losses = games.filter(g => !g.won);
    const reasons: Record<string, number> = {};
    losses.forEach(g => (reasons[g.reason] = (reasons[g.reason] || 0) + 1));
    const stuck: Record<string, number> = {};
    losses.forEach(g => g.stuckColors.forEach(c => (stuck[c] = (stuck[c] || 0) + 1)));
    row.bots[bot.id] = {
      runs,
      winRate: games.filter(g => g.won).length / runs,
      avgTapsWin: mean(games.filter(g => g.won).map(g => g.taps)),
      medianTapsLoss: median(losses.map(g => g.taps)),
      medianFilledPctLoss: median(losses.map(g => g.filledPct)),
      avgFilledPct: mean(games.map(g => g.filledPct)),
      avgPeakParked: mean(games.map(g => g.peakParked)),
      lossReasons: reasons,
      stuckColors: Object.entries(stuck).sort((a, b) => b[1] - a[1]).slice(0, 3)
    };
  }
  if (!only || only.split(',').includes('solver')) {
    const sv = solve(initState(level), solverBudget);
    row.solver = {
      result: sv.result,
      nodes: sv.nodes,
      bestFilledPct: (100 * sv.bestProgress) / facts.cells,
      path: sv.path
    };
  }
  row.seconds = (Date.now() - t0) / 1000;
  results.push(row);
  const summary = Object.entries(row.bots)
    .map(([k, v]: any) => `${k}:${Math.round(v.winRate * 100)}%`)
    .join(' ');
  console.log(`L${level.id} ${summary} solver:${row.solver?.result ?? '-'} (${row.seconds}s)`);
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 1));
}
fs.writeFileSync(path.join(outDir, 'games.csv'), csv.join('\n'));
