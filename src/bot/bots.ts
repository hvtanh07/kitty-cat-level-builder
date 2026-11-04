/**
 * Bot players, from really dumb to really smart.
 * Every bot only sees what a real player sees: front boxes and boxes behind
 * them that are not mystery boxes. Only the Solver is allowed to peek.
 */
import { GameState } from '../engine/gameEngine';
import { step, legalMoves, remainingCells, endReason, matchCount, exposedByColor } from './simulator';

export type Rng = () => number;

const UNKNOWN = '__unknown__';

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Bot {
  id: string;
  name: string;
  style: string;
  runs: number; // games per level
  choose(state: GameState, rng: Rng): number;
}

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

function bestBy(moves: number[], score: (q: number) => number, rng: Rng): number {
  let best = -Infinity;
  let cands: number[] = [];
  for (const q of moves) {
    const s = score(q);
    if (s > best + 1e-9) {
      best = s;
      cands = [q];
    } else if (Math.abs(s - best) <= 1e-9) cands.push(q);
  }
  return pick(cands, rng);
}

/** Cats a box would release right now if tapped (ignores cascades). */
function immediateRelease(state: GameState, q: number): number {
  const box = state.queues[q][0];
  return Math.min(box.count, matchCount(state, box.color));
}

/** Board evaluation used by the lookahead bots. Higher is better. */
export function evaluate(state: GameState): number {
  const end = endReason(state);
  const progress = state.initialCellCount - remainingCells(state);
  if (end === 'won') return 1e9;
  if (end) return -1e9 + progress;

  const exposed = exposedByColor(state);
  let free = 0;
  let dead = 0;
  let parkedCats = 0;
  for (const b of state.parkingSlots) {
    if (!b) {
      free++;
      continue;
    }
    parkedCats += b.count;
    if (!exposed.get(b.color)) dead++;
  }
  // Exposed cells that the visible front boxes can use next
  let frontFit = 0;
  const exposedVals = [...exposed.values()];
  const avgExposed = exposedVals.length ? exposedVals.reduce((a, b) => a + b, 0) / exposedVals.length : 0;
  for (const q of state.queues) {
    if (!q.length) continue;
    // A box whose color the player has not seen yet is worth an average guess
    const fit = q[0].color === UNKNOWN || q[0].isMystery ? avgExposed : exposed.get(q[0].color) || 0;
    frontFit += Math.min(q[0].count, fit);
  }
  // Running out of parking is what loses games, so the last free slots are worth much more
  const slotSafety = -200 / (free + 0.5);
  return progress * 10 + slotSafety - dead * 25 - parkedCats * 0.5 + frontFit * 1.5;
}

/** How many boxes at the front of each queue the player can currently see. */
function visibleDepth(state: GameState): number[] {
  return state.queues.map(q => {
    let n = 0;
    while (n < q.length && (n === 0 || !q[n].isMystery)) n++;
    return n;
  });
}

function lookahead(state: GameState, depth: number, budget: number[], taken: number[]): number {
  const base = evaluate(state);
  if (depth === 0 || endReason(state)) return base;
  let best = -Infinity;
  for (const q of legalMoves(state)) {
    if (taken[q] >= budget[q]) continue; // next box in this queue is still hidden
    const next = step(state, q);
    if (!next) continue;
    taken[q]++;
    const v = lookahead(next, depth - 1, budget, taken);
    taken[q]--;
    if (v > best) best = v;
  }
  // Stopping early is allowed (the player may not need to look further)
  return best === -Infinity ? base : Math.max(best, base - 1);
}

/**
 * What the player knows: mystery boxes keep their count but their color is unknown,
 * so the lookahead can never "peek" at a box by simulating the tap in front of it.
 */
function beliefState(state: GameState): GameState {
  return {
    ...state,
    queues: state.queues.map(q => q.map(b => (b.isMystery ? { ...b, color: UNKNOWN } : b)))
  };
}

function lookaheadBot(depth: number) {
  return (real: GameState, rng: Rng) => {
    const state = beliefState(real);
    const budget = visibleDepth(state);
    const taken = state.queues.map(() => 0);
    return bestBy(
      legalMoves(state),
      q => {
        const next = step(state, q)!;
        taken[q]++;
        const v = lookahead(next, depth - 1, budget, taken);
        taken[q]--;
        return v;
      },
      rng
    );
  };
}

function greedyChoice(state: GameState, rng: Rng): number {
  // Most cats released now; tie-break: fewer cats left sitting in the tray
  return bestBy(
    legalMoves(state),
    q => {
      const rel = immediateRelease(state, q);
      const left = state.queues[q][0].count - rel;
      return rel * 100 - left;
    },
    rng
  );
}

/**
 * Guess the colors of mystery boxes the way a sharp player would: the board
 * shows how many cells of each color are still unfilled, and the visible boxes
 * show how many cats are already on the way, so the rest must be in the
 * mystery boxes. Draw each mystery box's color from what is still missing.
 */
function sampleWorld(state: GameState, rng: Rng): GameState {
  const missing = new Map<string, number>();
  for (const row of state.grid) for (const c of row) if (c && c.state !== 'sealed') missing.set(c.color, (missing.get(c.color) || 0) + 1);
  const known = [...state.parkingSlots.filter(Boolean), ...state.queues.flat().filter(b => !b!.isMystery)];
  for (const b of known) missing.set(b!.color, (missing.get(b!.color) || 0) - b!.count);
  const queues = state.queues.map(q =>
    q.map(b => {
      if (!b.isMystery) return b;
      const pool = [...missing.entries()].filter(([, n]) => n > 0);
      if (!pool.length) return b;
      const total = pool.reduce((a, [, n]) => a + n, 0);
      let x = rng() * total;
      let color = pool[0][0];
      for (const [c, n] of pool) {
        if ((x -= n) < 0) {
          color = c;
          break;
        }
      }
      missing.set(color, (missing.get(color) || 0) - b.count);
      return { ...b, color };
    })
  );
  return { ...state, queues };
}

/** Plays a game out with the greedy policy; returns 1 + fraction filled for a win. */
function rollout(state: GameState, rng: Rng): number {
  let s = state;
  let guard = 0;
  while (!endReason(s) && guard++ < 200) {
    s = step(s, greedyChoice(s, rng))!;
  }
  const filled = 1 - remainingCells(s) / s.initialCellCount;
  return endReason(s) === 'won' ? 2 : filled;
}

function monteCarloBot(rollouts: number) {
  return (real: GameState, rng: Rng) => {
    const moves = legalMoves(real);
    if (moves.length === 1) return moves[0];
    const worlds = Array.from({ length: rollouts }, () => sampleWorld(real, rng));
    return bestBy(
      moves,
      q => {
        let total = 0;
        for (const w of worlds) {
          const n = step(w, q);
          total += n ? rollout(n, rng) : 0;
        }
        return total / rollouts;
      },
      rng
    );
  };
}

export const BOTS: Bot[] = [
  {
    id: 'random',
    name: 'T1 Random',
    style: 'Tap bừa: chọn hàng chờ ngẫu nhiên, không nhìn màu.',
    runs: 200,
    choose: (s, rng) => pick(legalMoves(s), rng)
  },
  {
    id: 'onelane',
    name: 'T2 Lazy one-lane',
    style: 'Thói quen: luôn tap hàng chờ đầu tiên còn hộp (trái sang phải), không nhìn màu.',
    runs: 1,
    choose: s => legalMoves(s)[0]
  },
  {
    id: 'novice',
    name: 'T3 Novice',
    style: 'Có nhìn màu nhưng hay sai: 70% chọn hộp xả được nhiều mèo nhất, 30% tap bừa.',
    runs: 200,
    choose: (s, rng) => (rng() < 0.3 ? pick(legalMoves(s), rng) : greedyChoice(s, rng))
  },
  {
    id: 'greedy',
    name: 'T4 Greedy',
    style: 'Luôn chọn hộp xả được nhiều mèo nhất ngay lúc đó, không tính trước.',
    runs: 50,
    choose: greedyChoice
  },
  {
    id: 'planner',
    name: 'T5 Planner (2-step)',
    style: 'Tính trước 2 lượt tap (chỉ dùng hộp nhìn thấy), chấm điểm bàn: tiến độ, ô đậu trống, hộp kẹt.',
    runs: 20,
    choose: lookaheadBot(2)
  },
  {
    id: 'expert',
    name: 'T6 Deep planner (3-step)',
    style: 'Tính trước 3 lượt tap (chỉ dùng hộp nhìn thấy), cùng hàm chấm điểm.',
    runs: 8,
    choose: lookaheadBot(3)
  },
  {
    id: 'master',
    name: 'T7 Master',
    style: 'Thử từng nước: với mỗi lựa chọn, đoán màu hộp bí ẩn từ số ô còn thiếu rồi chơi thử tới hết ván (Monte Carlo, 12 lần), chọn nước thắng nhiều nhất.',
    runs: 6,
    choose: monteCarloBot(12)
  }
];
