/**
 * T7 Solver: depth-first search over every tap order, with full knowledge of
 * mystery boxes. Answers "is this level winnable at all?".
 */
import { GameState } from '../engine/gameEngine';
import { step, legalMoves, endReason, stateKey, remainingCells } from './simulator';
import { evaluate } from './bots';

export interface SolveResult {
  result: 'solvable' | 'unsolvable' | 'unknown';
  nodes: number;
  path?: number[];
  bestProgress: number; // most cells filled in any explored line
}

export function solve(start: GameState, nodeBudget = 30000): SolveResult {
  const seen = new Set<string>();
  let nodes = 0;
  let exhausted = true;
  let bestProgress = 0;
  const path: number[] = [];

  const dfs = (s: GameState): boolean => {
    const end = endReason(s);
    bestProgress = Math.max(bestProgress, s.initialCellCount - remainingCells(s));
    if (end === 'won') return true;
    if (end) return false;
    const key = stateKey(s);
    if (seen.has(key)) return false;
    seen.add(key);
    const children: { q: number; s: GameState; v: number }[] = [];
    for (const q of legalMoves(s)) {
      if (nodes >= nodeBudget) {
        exhausted = false;
        return false;
      }
      nodes++;
      const n = step(s, q);
      if (n) children.push({ q, s: n, v: evaluate(n) });
    }
    children.sort((a, b) => b.v - a.v);
    for (const c of children) {
      path.push(c.q);
      if (dfs(c.s)) return true;
      path.pop();
      if (nodes >= nodeBudget) {
        exhausted = false;
        return false;
      }
    }
    return false;
  };

  const ok = dfs(start);
  if (ok) return { result: 'solvable', nodes, path: [...path], bestProgress };
  return { result: exhausted ? 'unsolvable' : 'unknown', nodes, bestProgress };
}
