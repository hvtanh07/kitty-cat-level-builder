/**
 * Headless simulator for bot play tests.
 *
 * Uses the exact same pure engine functions as the Play Test screen
 * (tapQueueBox, dispatchCats, processLineClears, checkWinLose).
 * The only simplification: after every tap the bot waits until all cats have
 * landed (no tapping while cats are in flight).
 */
import { LevelConfig } from '../types';
import {
  GameState,
  createInitialGameState,
  tapQueueBox,
  dispatchCats,
  processLineClears,
  checkWinLose
} from '../engine/gameEngine';
import { findQualifyingSlots, getVisibleWindow } from '../engine/exposure';

export type EndReason = 'won' | 'parking_full' | 'out_of_boxes' | 'move_cap';

export function initState(level: LevelConfig): GameState {
  // Settle once in case a pre-exposed cell already matches nothing (no-op normally)
  return createInitialGameState(level);
}

/** Lands all flying cats, clears lines, runs cascades until nothing moves. */
export function settle(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.flyingCats.length > 0 && guard++ < 10000) {
    s = processLineClears({ ...s, flyingCats: [] });
    s = dispatchCats(s);
  }
  s = processLineClears(s);
  return checkWinLose(s);
}

/** Tap the front box of queue q and play out the result. Returns null if illegal. */
export function step(state: GameState, q: number): GameState | null {
  const { nextState, moved } = tapQueueBox(state, q);
  if (!moved) return null;
  return settle(dispatchCats(nextState));
}

export function legalMoves(state: GameState): number[] {
  if (state.status !== 'playing') return [];
  if (!state.parkingSlots.some(s => s === null)) return [];
  const moves: number[] = [];
  state.queues.forEach((q, i) => {
    if (q.length > 0) moves.push(i);
  });
  return moves;
}

export function remainingCells(state: GameState): number {
  let n = 0;
  for (const row of state.grid) for (const c of row) if (c && c.state !== 'sealed') n++;
  return n;
}

export function endReason(state: GameState): EndReason | null {
  if (state.status === 'won') return 'won';
  if (state.status === 'lost') return 'parking_full';
  if (legalMoves(state).length === 0) {
    if (state.queues.every(q => q.length === 0)) return 'out_of_boxes';
    return 'parking_full';
  }
  return null;
}

/** Number of exposed, visible cells per color. */
export function exposedByColor(state: GameState): Map<string, number> {
  const win = getVisibleWindow(state.grid, state.rows, state.cols);
  const m = new Map<string, number>();
  const top = Math.max(0, win.top);
  for (let r = top; r <= win.bottom; r++) {
    for (const c of state.grid[r]) {
      if (c && c.state === 'exposed') m.set(c.color, (m.get(c.color) || 0) + 1);
    }
  }
  return m;
}

export function matchCount(state: GameState, color: string): number {
  const win = getVisibleWindow(state.grid, state.rows, state.cols);
  return findQualifyingSlots(state.grid, color, state.rows, state.cols, win).length;
}

/** Compact key of a state, used by the search solver for memoisation. */
export function stateKey(state: GameState): string {
  const q = state.queues.map(x => x.length).join(',');
  const p = state.parkingSlots
    .filter(Boolean)
    .map(b => `${b!.color}${b!.count}`)
    .sort()
    .join(',');
  let g = '';
  for (const row of state.grid) {
    for (const c of row) g += c ? (c.state === 'sealed' ? 's' : c.state === 'exposed' ? 'e' : 'c') : '.';
  }
  return `${q}|${p}|${g}`;
}
