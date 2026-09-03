import {
  LevelConfig,
  CellData,
  CatBoxData,
  ParkedBox,
  FlyingCat,
  GameStats,
  GameStatus
} from '../types';
import {
  recalculateAllExposures,
  findQualifyingSlots,
  findClearedLines
} from './exposure';
import { sounds } from '../audio/sound';

export interface GameState {
  grid: (CellData | null)[][];
  rows: number;
  cols: number;
  parkingSlots: (ParkedBox | null)[];
  parkingSlotsCount: number;
  queues: CatBoxData[][];
  flyingCats: FlyingCat[];
  clearingRows: number[];
  status: GameStatus;
  shakingQueueIndex: number | null;
  shakingParkingIndex: number | null;
  stats: GameStats;
  initialCellCount: number;
}

export function createInitialGameState(level: LevelConfig): GameState {
  const rows = level.grid.rows;
  const cols = level.grid.cols;

  // Deep clone cells, preserving the configured state from design mode
  let grid: (CellData | null)[][] = level.grid.cells.map(row =>
    row.map(cell => (cell ? { ...cell, state: cell.state || 'closed' } : null))
  );

  // Recalculate exposures according to the 1/4 side exposure rule, preserving already exposed cells
  grid = recalculateAllExposures(grid, rows, cols, true);

  // Count total initial cells
  let initialCellCount = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell) initialCellCount++;
    }
  }

  // Deep clone queues
  const queues: CatBoxData[][] = level.queues.map(queue =>
    queue.map(box => ({ ...box }))
  );

  // Ensure front box of each queue is not mystery
  queues.forEach(queue => {
    if (queue.length > 0 && queue[0].isMystery) {
      queue[0].isMystery = false;
    }
  });

  const parkingSlotsCount = level.parkingSlotsCount || 5;
  const parkingSlots: (ParkedBox | null)[] = Array(parkingSlotsCount).fill(null);

  return {
    grid,
    rows,
    cols,
    parkingSlots,
    parkingSlotsCount,
    queues,
    flyingCats: [],
    clearingRows: [],
    status: 'playing',
    shakingQueueIndex: null,
    shakingParkingIndex: null,
    stats: {
      moves: 0,
      catsDispatched: 0,
      linesCleared: 0,
      startTime: Date.now()
    },
    initialCellCount
  };
}

/**
 * Tap front box of queue: moves to first open parking slot.
 */
export function tapQueueBox(
  state: GameState,
  queueIndex: number
): { nextState: GameState; moved: boolean } {
  if (state.status !== 'playing') return { nextState: state, moved: false };

  const queue = state.queues[queueIndex];
  if (!queue || queue.length === 0) return { nextState: state, moved: false };

  // Find first open parking slot
  const emptySlotIdx = state.parkingSlots.findIndex(slot => slot === null);

  if (emptySlotIdx === -1) {
    // All parking slots are occupied! Reject with shake
    sounds.playShake();
    return {
      nextState: {
        ...state,
        shakingQueueIndex: queueIndex
      },
      moved: false
    };
  }

  // Pop front box
  const frontBox = queue[0];
  const remainingQueue = queue.slice(1);

  // Reveal next box in queue if it was mystery
  if (remainingQueue.length > 0 && remainingQueue[0].isMystery) {
    remainingQueue[0] = { ...remainingQueue[0], isMystery: false };
  }

  const nextQueues = [...state.queues];
  nextQueues[queueIndex] = remainingQueue;

  const nextParkingSlots = [...state.parkingSlots];
  nextParkingSlots[emptySlotIdx] = {
    ...frontBox,
    slotIndex: emptySlotIdx,
    isMystery: false
  };

  sounds.playSlide();

  return {
    nextState: {
      ...state,
      queues: nextQueues,
      parkingSlots: nextParkingSlots,
      shakingQueueIndex: null,
      stats: {
        ...state.stats,
        moves: state.stats.moves + 1
      }
    },
    moved: true
  };
}

/**
 * Scan all parked boxes and dispatch cats to qualifying exposed cells.
 * Returns updated state with flying cats dispatched and cells marked.
 */
export function dispatchCats(
  state: GameState,
  getSlotCoords?: (slotIndex: number) => { x: number; y: number },
  getCellCoords?: (r: number, c: number) => { x: number; y: number }
): GameState {
  if (state.status !== 'playing') return state;

  let nextGrid = state.grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
  let nextParking = state.parkingSlots.map(b => (b ? { ...b } : null));
  const newFlyingCats: FlyingCat[] = [...state.flyingCats];
  let dispatchedAny = false;

  for (let slotIdx = 0; slotIdx < nextParking.length; slotIdx++) {
    const box = nextParking[slotIdx];
    if (!box || box.count <= 0) continue;

    // Find exposed cells matching box color
    const qualifying = findQualifyingSlots(nextGrid, box.color, state.rows, state.cols);
    if (qualifying.length === 0) continue;

    const dispatchCount = Math.min(box.count, qualifying.length);
    box.count -= dispatchCount;
    dispatchedAny = true;

    const fromCoords = getSlotCoords ? getSlotCoords(slotIdx) : { x: 200, y: 550 };

    for (let i = 0; i < dispatchCount; i++) {
      const target = qualifying[i];
      // Mark cell as already targeted (sealed) so other cats won't target it
      nextGrid[target.r][target.c] = {
        ...nextGrid[target.r][target.c]!,
        state: 'sealed'
      };

      const toCoords = getCellCoords ? getCellCoords(target.r, target.c) : { x: 200, y: 200 };

      newFlyingCats.push({
        id: `cat-${Date.now()}-${Math.random()}`,
        color: box.color,
        fromX: fromCoords.x,
        fromY: fromCoords.y,
        toX: toCoords.x,
        toY: toCoords.y,
        targetRow: target.r,
        targetCol: target.c,
        progress: 0
      });
    }

    sounds.playCatRun();
  }

  // Remove empty boxes from parking slots
  nextParking = nextParking.map(box => (box && box.count <= 0 ? null : box));

  // Recalculate exposures for remaining unfilled cells
  nextGrid = recalculateAllExposures(nextGrid, state.rows, state.cols);

  const updatedState = {
    ...state,
    grid: nextGrid,
    parkingSlots: nextParking,
    flyingCats: newFlyingCats,
    stats: {
      ...state.stats,
      catsDispatched: state.stats.catsDispatched + (dispatchedAny ? 1 : 0)
    }
  };

  return checkWinLose(updatedState);
}

/**
 * Handle completed line clears and update exposures.
 */
export function processLineClears(state: GameState): GameState {
  const clearedRows = findClearedLines(state.grid, state.rows, state.cols);
  if (clearedRows.length === 0) return state;

  sounds.playLineClear();

  let nextGrid = state.grid.map(row => row.map(cell => (cell ? { ...cell } : null)));

  // Clear slots in cleared rows
  for (const r of clearedRows) {
    for (let c = 0; c < state.cols; c++) {
      nextGrid[r][c] = null;
    }
  }

  // Recalculate exposures because cleared rows are now empty space
  nextGrid = recalculateAllExposures(nextGrid, state.rows, state.cols);

  const updatedState = {
    ...state,
    grid: nextGrid,
    clearingRows: clearedRows,
    stats: {
      ...state.stats,
      linesCleared: state.stats.linesCleared + clearedRows.length
    }
  };

  return checkWinLose(updatedState);
}

/**
 * Evaluates win and lose conditions.
 */
export function checkWinLose(state: GameState): GameState {
  // Count remaining non-null cells
  let remainingCells = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell !== null) remainingCells++;
    }
  }

  const queuesEmpty = state.queues.every(q => q.length === 0);
  const parkingEmpty = state.parkingSlots.every(s => s === null);
  const noCatsInFlight = state.flyingCats.length === 0;

  // Win Condition:
  // All cat boxes sent, all cats entered, all cell slots cleared
  if (remainingCells === 0 && queuesEmpty && parkingEmpty && noCatsInFlight) {
    sounds.playWin();
    return {
      ...state,
      status: 'won',
      stats: {
        ...state.stats,
        endTime: Date.now()
      }
    };
  }

  // Lose Condition:
  // All parking slots are occupied AND no more cats can be released (no exposed slots match parked boxes)
  const parkingFull = state.parkingSlots.every(s => s !== null && s.count > 0);
  if (parkingFull && noCatsInFlight) {
    let canReleaseAny = false;
    for (const box of state.parkingSlots) {
      if (!box) continue;
      const matching = findQualifyingSlots(state.grid, box.color, state.rows, state.cols);
      if (matching.length > 0) {
        canReleaseAny = true;
        break;
      }
    }

    if (!canReleaseAny) {
      sounds.playLose();
      return {
        ...state,
        status: 'lost',
        stats: {
          ...state.stats,
          endTime: Date.now()
        }
      };
    }
  }

  return state;
}

/**
 * Booster: Shuffle all remaining front boxes across queues.
 */
export function boosterShuffleQueues(state: GameState): GameState {
  const frontBoxes: CatBoxData[] = [];
  state.queues.forEach(q => {
    if (q.length > 0) frontBoxes.push(q[0]);
  });

  if (frontBoxes.length <= 1) return state;

  // Fisher-Yates shuffle
  for (let i = frontBoxes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [frontBoxes[i], frontBoxes[j]] = [frontBoxes[j], frontBoxes[i]];
  }

  let idx = 0;
  const nextQueues = state.queues.map(q => {
    if (q.length > 0) {
      const shuffledFront = { ...frontBoxes[idx++], isMystery: false };
      return [shuffledFront, ...q.slice(1)];
    }
    return q;
  });

  sounds.playTap();
  return {
    ...state,
    queues: nextQueues
  };
}

/**
 * Booster: Broom Clear - removes the first parked box to free up a parking slot.
 */
export function boosterBroomClear(state: GameState): GameState {
  const parkedIdx = state.parkingSlots.findIndex(s => s !== null);
  if (parkedIdx === -1) return state;

  const nextParking = [...state.parkingSlots];
  nextParking[parkedIdx] = null;

  sounds.playTap();
  return {
    ...state,
    parkingSlots: nextParking
  };
}
