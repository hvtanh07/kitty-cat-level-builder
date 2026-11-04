/**
 * Re-arranges the box queues of a level (never the grid) so the bots'
 * win rates land in the target band for its difficulty tag.
 *   npx tsx scripts/tuneLevels.ts --levels 9,12 --iters 300 --out bot-report/tuned
 *
 * Moves: swap the (color, count) of two box slots, anywhere in the queues.
 * Each slot keeps its id and its mystery flag, so the queue shapes and
 * the number of mystery boxes stay exactly as designed.
 */
import fs from 'fs';
import path from 'path';
import { LevelConfig } from '../src/types';
import { BOTS, mulberry32 } from '../src/bot/bots';
import { solve } from '../src/bot/solver';
import { initState, step, endReason } from '../src/bot/simulator';
import levelsJson from '../src/data/levels/sheetLevels.json';

const LEVELS = levelsJson as unknown as LevelConfig[];
const args = process.argv.slice(2);
const arg = (k: string, d: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const ids = arg('--levels', '').split(',').filter(Boolean);
const iters = Number(arg('--iters', '300'));
const outDir = arg('--out', 'bot-report/tuned');
const inDir = arg('--in', '');
const noviceRuns = Number(arg('--novice-runs', '80'));
fs.mkdirSync(outDir, { recursive: true });

const bot = (id: string) => BOTS.find(b => b.id === id)!;

export function winRate(level: LevelConfig, botId: string, runs: number, seed = 1): number {
  const b = bot(botId);
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const rng = mulberry32(seed * 7919 + i);
    let s = initState(level);
    let guard = 0;
    while (!endReason(s) && guard++ < 500) s = step(s, b.choose(s, rng))!;
    if (endReason(s) === 'won') wins++;
  }
  return wins / runs;
}

type Box = { color: string; count: number };

function withContents(level: LevelConfig, contents: Box[]): LevelConfig {
  let k = 0;
  return {
    ...level,
    queues: level.queues.map(q => q.map(b => ({ ...b, color: contents[k].color, count: contents[k++].count })))
  };
}

interface Eval {
  score: number; // lower is better, 0 = in band
  novice: number;
  greedy: number;
  planner?: number;
  novice2?: number;
  master?: number;
  solvable?: boolean;
}

function evaluate(level: LevelConfig, hard: boolean): Eval {
  const novice = winRate(level, 'novice', hard ? 80 : noviceRuns);
  const greedy = winRate(level, 'greedy', 16);
  let score: number;
  if (hard) {
    // aim for the middle of the band so the final check has margin
    score = Math.abs(novice - 0.4) + Math.max(0, greedy - 0.8);
  } else {
    score = Math.max(0, 0.9 - novice) + Math.max(0, 0.95 - greedy);
  }
  return { score, novice, greedy };
}

/** Expensive checks, only on candidates that look good. */
function validate(level: LevelConfig, hard: boolean, e: Eval): Eval {
  const sv = solve(initState(level), 8000);
  e.solvable = sv.result === 'solvable';
  if (!e.solvable) e.score += 5;
  if (!e.solvable) return e;
  // Re-check with fresh seeds so the search cannot overfit one set of games
  const novice2 = winRate(level, 'novice', 150, 2);
  if (hard) {
    e.planner = winRate(level, 'planner', 6);
    e.score += Math.max(0, 0.8 - e.planner) * 2;
    e.score += Math.max(0, novice2 - 0.55) + Math.max(0, 0.25 - novice2);
    if (e.score === 0) {
      e.master = winRate(level, 'master', 6, 2);
      e.score += Math.max(0, 0.83 - e.master) * 2;
    }
  } else {
    e.score += Math.max(0, 0.85 - novice2) * 2;
  }
  e.novice2 = novice2;
  return e;
}

for (const id of ids) {
  const src: LevelConfig = inDir && fs.existsSync(path.join(inDir, `${id}.json`))
    ? JSON.parse(fs.readFileSync(path.join(inDir, `${id}.json`), 'utf8'))
    : LEVELS.find(l => l.id === id)!;
  const hard = src.difficulty === 'hard';
  const rng = mulberry32(Number(id) * 31 + 5);
  let cur: Box[] = src.queues.flat().map(b => ({ color: b.color, count: b.count }));
  let curEval = validate(withContents(src, cur), hard, evaluate(withContents(src, cur), hard));
  let best = { contents: cur, e: curEval };
  const t0 = Date.now();
  console.log(`L${id} ${hard ? 'hard' : 'normal'} start`, JSON.stringify(curEval));
  for (let it = 0; it < iters && best.e.score > 0; it++) {
    const cand = cur.map(b => ({ ...b }));
    const swaps = 1 + Math.floor(rng() * 2);
    for (let s = 0; s < swaps; s++) {
      const a = Math.floor(rng() * cand.length);
      const b = Math.floor(rng() * cand.length);
      [cand[a], cand[b]] = [cand[b], cand[a]];
    }
    const lvl = withContents(src, cand);
    let e = evaluate(lvl, hard);
    const temp = 0.05 * (1 - it / iters);
    if (e.score <= curEval.score + 0.02 || rng() < Math.exp(-(e.score - curEval.score) / Math.max(temp, 1e-6))) {
      if (e.score < best.e.score + 0.05) e = validate(lvl, hard, e);
      if (e.score <= curEval.score || rng() < 0.1) {
        cur = cand;
        curEval = e;
      }
      if (e.solvable !== undefined && e.score < best.e.score) {
        best = { contents: cand, e };
        console.log(`L${id} it${it} best`, JSON.stringify(e));
      }
    }
  }
  const out = withContents(src, best.contents);
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(out));
  console.log(`L${id} done in ${(Date.now() - t0) / 1000}s`, JSON.stringify(best.e));
}
