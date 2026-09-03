import { CellData } from '../types';

/**
 * Checks if a specific cell slot at (r, c) should be exposed according to the game logic:
 * "Normally the cell slot will be in close state, it will turn into expose state
 * if at least 1/4 side of that cell turn into sealed cell or having no other slot occupied (except of the grid edge)"
 */
export function shouldCellBeExposed(
  grid: (CellData | null)[][],
  r: number,
  c: number,
  rows: number,
  cols: number
): boolean {
  const currentCell = grid[r]?.[c];
  if (!currentCell) return false;
  if (currentCell.state === 'sealed') return false; // Already sealed

  const directions = [
    [-1, 0], // North
    [1, 0],  // South
    [0, -1], // West
    [0, 1]   // East
  ];

  for (const [dr, dc] of directions) {
    const nr = r + dr;
    const nc = c + dc;

    // Check if neighbor is outside grid edge
    // Rule: "except of the grid edge" - outer grid boundary does not count as unoccupied slot
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
      continue;
    }

    const neighbor = grid[nr][nc];

    // Neighbor turned into a sealed cell (cat has entered and closed the lid)
    if (neighbor && neighbor.state === 'sealed') {
      return true;
    }
  }

  return false;
}

/**
 * Exposes the bottom-most non-null cell in every column of the grid.
 * In casual block puzzle games, bottom cells are open and accessible at level start.
 */
export function exposeBottomCells(
  grid: (CellData | null)[][],
  rows: number,
  cols: number
): (CellData | null)[][] {
  const nextGrid: (CellData | null)[][] = grid.map(row =>
    row.map(cell => (cell ? { ...cell } : null))
  );

  for (let c = 0; c < cols; c++) {
    for (let r = rows - 1; r >= 0; r--) {
      if (nextGrid[r][c] !== null) {
        nextGrid[r][c]!.state = 'exposed';
        break; // Bottom-most cell in this column
      }
    }
  }

  return nextGrid;
}

/**
 * Recalculates exposure for cells across the entire grid.
 * If preserveExposed is true (default), any cell that is already 'exposed' remains exposed,
 * and any closed cell that now qualifies turns 'exposed'.
 * Returns a new grid copy with updated states.
 */
export function recalculateAllExposures(
  grid: (CellData | null)[][],
  rows: number,
  cols: number,
  preserveExposed: boolean = true
): (CellData | null)[][] {
  const nextGrid: (CellData | null)[][] = grid.map(row =>
    row.map(cell => (cell ? { ...cell } : null))
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = nextGrid[r][c];
      if (cell && cell.state !== 'sealed') {
        if (preserveExposed && cell.state === 'exposed') {
          // Already exposed: keep exposed!
          continue;
        }
        const exposed = shouldCellBeExposed(nextGrid, r, c, rows, cols);
        cell.state = exposed ? 'exposed' : 'closed';
      }
    }
  }

  return nextGrid;
}

/**
 * Finds all exposed cells on the grid that match a given color.
 * Rule: Scans from the bottom row first, then continues on the next row above it.
 */
export function findQualifyingSlots(
  grid: (CellData | null)[][],
  color: string,
  rows: number,
  cols: number
): { r: number; c: number }[] {
  const matches: { r: number; c: number }[] = [];
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell && cell.state === 'exposed' && cell.color === color) {
        matches.push({ r, c });
      }
    }
  }
  return matches;
}

/**
 * Checks for horizontal rows where all cell slots are sealed, from the bottom row upward.
 * Rule: "The lower row must be cleared before the upper row can be clear,
 * the higher row can not be clear first then leave an empty space between the 2 rows."
 *
 * Scans from the lowest row (rows - 1) upwards:
 * - If a row has slots and is fully sealed, it clears.
 * - If a row has slots and is NOT fully sealed, we STOP immediately,
 *   preventing any higher rows from clearing ahead of it.
 * - Completely empty rows (already cleared) are skipped.
 */
export function findClearedLines(
  grid: (CellData | null)[][],
  rows: number,
  cols: number
): number[] {
  const clearedRows: number[] = [];

  for (let r = rows - 1; r >= 0; r--) {
    let hasSlots = false;
    let allSealed = true;

    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell !== null) {
        hasSlots = true;
        if (cell.state !== 'sealed') {
          allSealed = false;
          break;
        }
      }
    }

    if (!hasSlots) {
      // Empty row (already cleared or empty canvas below); continue checking upwards
      continue;
    }

    if (allSealed) {
      // Bottom-most active row is fully sealed: it clears!
      clearedRows.push(r);
    } else {
      // Lower row still has unsealed slots. Stop scanning upwards to prevent
      // higher rows from clearing first and leaving a gap.
      break;
    }
  }

  return clearedRows;
}
