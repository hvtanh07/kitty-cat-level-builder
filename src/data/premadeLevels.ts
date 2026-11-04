import { LevelConfig, CatBoxData, CellData } from '../types';
import { exposeBottomCells, recalculateAllExposures } from '../engine/exposure';
import SHEET_LEVELS from './levels/sheetLevels.json';

/**
 * Utility to generate an order-aware balanced set of box queues for any grid layout.
 *
 * Algorithm:
 * 1. Simulates board clearance layer-by-layer starting from the bottom exposed cells upwards.
 * 2. Unrevealed hidden cells and locked cells are uncovered only when their prerequisites are met
 *    (neighbor seal for hidden groups, seal countdown for locked cells).
 * 3. Each cell is assigned an accessibility wave / clearance step based on when it can be solved.
 * 4. Cells of each color are chunked into boxes of up to boxSize (default 10).
 * 5. Boxes are sorted by their required appearance order (earliest accessible colors first).
 *    For example, if Yellow cells are at the bottom of the level, Yellow boxes are generated first
 *    and placed at the top (front) of the queues list.
 * 6. Boxes are distributed across the N queues round-robin so the player has immediate access
 *    to opening moves and never gets stuck with blocked parking slots.
 */
export function generateBalancedQueues(
  cells: (CellData | null)[][],
  queueCount: number = 3,
  boxSize: number = 10
): CatBoxData[][] {
  const rows = cells.length;
  const cols = cells[0]?.length || 0;

  // Count total cells per color
  const colorCounts: Record<string, number> = {};
  let totalCells = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r]?.[c];
      if (cell) {
        colorCounts[cell.color] = (colorCounts[cell.color] || 0) + 1;
        totalCells++;
      }
    }
  }

  if (totalCells === 0) {
    return Array.from({ length: queueCount }, () => []);
  }

  // --- Step 1: Simulate bottom-up exposure and clearance order ---
  // Clone cells for simulation
  const simGrid: (CellData | null)[][] = cells.map(row =>
    row.map(cell => (cell ? { ...cell, state: cell.state || 'closed' } : null))
  );

  const revealedGroups = new Set<number>();
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  // Discover pre-revealed hidden groups
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (simGrid[r][c]?.state === 'sealed') {
        for (const [dr, dc] of directions) {
          const nr = r + dr;
          const nc = c + dc;
          const neighbor = simGrid[nr]?.[nc];
          if (neighbor?.hiddenGroup) {
            revealedGroups.add(neighbor.hiddenGroup);
          }
        }
      }
    }
  }

  // Ensure bottom-most cell in each column is exposed if closed
  for (let c = 0; c < cols; c++) {
    for (let r = rows - 1; r >= 0; r--) {
      const cell = simGrid[r][c];
      if (cell) {
        const isLocked = !!(cell.lockCount && cell.lockCount > 0);
        const isHidden = !!(cell.hiddenGroup && !revealedGroups.has(cell.hiddenGroup));
        if (!isLocked && !isHidden && cell.state !== 'sealed') {
          cell.state = 'exposed';
        }
        break; // Only bottom-most in column
      }
    }
  }

  // Record clearance sequence for each cell
  const clearedCells: { r: number; c: number; color: string; wave: number }[] = [];
  const sealedSet = new Set<string>();

  let wave = 0;
  let totalSealed = 0;

  while (clearedCells.length < totalCells) {
    // Find all exposed, unsealed cells
    const exposed: { r: number; c: number; color: string }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}-${c}`;
        const cell = simGrid[r][c];
        if (cell && !sealedSet.has(key) && cell.state === 'exposed') {
          exposed.push({ r, c, color: cell.color });
        }
      }
    }

    if (exposed.length > 0) {
      // Sort exposed cells: bottom-most row first (b.r - a.r), then left to right (a.c - b.c)
      exposed.sort((a, b) => (b.r !== a.r ? b.r - a.r : a.c - b.c));

      // Seal exposed cells in this wave
      for (const item of exposed) {
        const key = `${item.r}-${item.c}`;
        if (sealedSet.has(key)) continue;
        sealedSet.add(key);
        clearedCells.push({ ...item, wave });
        totalSealed++;

        simGrid[item.r][item.c]!.state = 'sealed';

        // Check if newly sealed cell reveals any hidden groups
        for (const [dr, dc] of directions) {
          const nr = item.r + dr;
          const nc = item.c + dc;
          const neighbor = simGrid[nr]?.[nc];
          if (neighbor?.hiddenGroup && !revealedGroups.has(neighbor.hiddenGroup)) {
            revealedGroups.add(neighbor.hiddenGroup);
          }
        }
      }

      // Check locked cells countdown
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = simGrid[r][c];
          if (cell && cell.lockCount && cell.lockCount > 0) {
            if (cell.lockCount <= totalSealed) {
              delete cell.lockCount;
            }
          }
        }
      }

      // Recalculate exposures for unsealed cells:
      // A cell becomes exposed if at least one orthogonal neighbor is sealed
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const key = `${r}-${c}`;
          const cell = simGrid[r][c];
          if (cell && !sealedSet.has(key)) {
            const isLocked = !!(cell.lockCount && cell.lockCount > 0);
            const isHidden = !!(cell.hiddenGroup && !revealedGroups.has(cell.hiddenGroup));
            if (!isLocked && !isHidden) {
              let hasSealedNeighbor = false;
              for (const [dr, dc] of directions) {
                const nr = r + dr;
                const nc = c + dc;
                const n = simGrid[nr]?.[nc];
                if (n && n.state === 'sealed') {
                  hasSealedNeighbor = true;
                  break;
                }
              }
              if (hasSealedNeighbor) {
                cell.state = 'exposed';
              }
            }
          }
        }
      }

      wave++;
    } else {
      // Fallback: If no cells are currently exposed (e.g. enclosed or unreachable),
      // pick the lowest unsealed cell (bottom-up) and force-expose it to continue
      let lowestUnsealed: { r: number; c: number } | null = null;
      for (let r = rows - 1; r >= 0; r--) {
        for (let c = 0; c < cols; c++) {
          const key = `${r}-${c}`;
          if (simGrid[r]?.[c] && !sealedSet.has(key)) {
            lowestUnsealed = { r, c };
            break;
          }
        }
        if (lowestUnsealed) break;
      }

      if (!lowestUnsealed) break;

      const cell = simGrid[lowestUnsealed.r][lowestUnsealed.c]!;
      if (cell.lockCount) delete cell.lockCount;
      if (cell.hiddenGroup) revealedGroups.add(cell.hiddenGroup);
      cell.state = 'exposed';
    }
  }

  // --- Step 2: Group cells into Cat Boxes by required order ---
  // For each color, gather cells in clearance order
  const colorToCells: Record<string, { r: number; c: number; wave: number }[]> = {};
  for (const item of clearedCells) {
    if (!colorToCells[item.color]) colorToCells[item.color] = [];
    colorToCells[item.color].push({ r: item.r, c: item.c, wave: item.wave });
  }

  interface BoxWithOrder {
    box: CatBoxData;
    minWave: number;
    avgWave: number;
  }

  const generatedBoxes: BoxWithOrder[] = [];
  let boxIdCounter = 1;

  for (const [color, cellList] of Object.entries(colorToCells)) {
    let offset = 0;
    while (offset < cellList.length) {
      const chunk = cellList.slice(offset, offset + boxSize);
      const minWave = chunk[0].wave;
      const avgWave = chunk.reduce((sum, c) => sum + c.wave, 0) / chunk.length;

      generatedBoxes.push({
        box: {
          id: `box-${boxIdCounter++}`,
          color,
          count: chunk.length,
          isMystery: false
        },
        minWave,
        avgWave
      });

      offset += boxSize;
    }
  }

  // Sort boxes primarily by minWave (earliest required wave first),
  // then by avgWave
  generatedBoxes.sort((a, b) => {
    if (a.minWave !== b.minWave) return a.minWave - b.minWave;
    return a.avgWave - b.avgWave;
  });

  // --- Step 3: Distribute into N queues round-robin ---
  // Box 0 is at index 0 of queue 0 (top of queue 1)
  // Box 1 is at index 0 of queue 1 (top of queue 2)
  // Box 2 is at index 0 of queue 2 (top of queue 3)
  // Subsequent boxes are placed in the next rows of each queue
  const queues: CatBoxData[][] = Array.from({ length: queueCount }, () => []);

  generatedBoxes.forEach(({ box }, idx) => {
    const qIndex = idx % queueCount;
    const isFront = queues[qIndex].length === 0;
    // Front boxes are never mystery so player sees their opening moves
    const isMystery = !isFront && (idx % 2 === 1);

    queues[qIndex].push({
      ...box,
      isMystery
    });
  });

  return queues;
}

// Helper to convert character matrix to grid cells
export function parseAsciiLevel(
  matrix: string[],
  charMap: Record<string, string>
): (CellData | null)[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const grid: (CellData | null)[][] = [];

  for (let r = 0; r < rows; r++) {
    const rowCells: (CellData | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const char = matrix[r][c] || ' ';
      if (char === ' ' || char === '.') {
        rowCells.push(null);
      } else {
        const color = charMap[char] || 'pink';
        rowCells.push({ color, state: 'closed' });
      }
    }
    grid.push(rowCells);
  }

  return grid;
}

// ==========================================
// Built-in levels, imported from the "Level Data" tab of the Tank Top level data sheet
// (one level JSON per row, ids "1".."40"). To refresh, re-export the sheet's Level column
// into src/data/levels/sheetLevels.json (one JSON array of LevelConfig objects).
// ==========================================

export const PREMADE_LEVELS: LevelConfig[] = SHEET_LEVELS as unknown as LevelConfig[];
