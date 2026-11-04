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
  cols: number,
  revealedGroups?: Set<number>
): boolean {
  const currentCell = grid[r]?.[c];
  if (!currentCell) return false;
  if (currentCell.state === 'sealed') return false; // Already sealed

  // Rule: Locked cell will not become exposed like normal cell until unlocked
  if (currentCell.lockCount && currentCell.lockCount > 0) {
    return false;
  }

  // Rule: Hidden cell true color and exposure only reviewed when revealed
  if (currentCell.hiddenGroup && (!revealedGroups || !revealedGroups.has(currentCell.hiddenGroup))) {
    return false;
  }

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
 * Skips cells that are locked or unrevealed hidden.
 */
export function exposeBottomCells(
  grid: (CellData | null)[][],
  rows: number,
  cols: number,
  revealedGroups?: Set<number>
): (CellData | null)[][] {
  const nextGrid: (CellData | null)[][] = grid.map(row =>
    row.map(cell => (cell ? { ...cell } : null))
  );

  for (let c = 0; c < cols; c++) {
    for (let r = rows - 1; r >= 0; r--) {
      const cell = nextGrid[r][c];
      if (cell !== null) {
        const isLocked = !!(cell.lockCount && cell.lockCount > 0);
        const isHidden = !!(cell.hiddenGroup && (!revealedGroups || !revealedGroups.has(cell.hiddenGroup)));
        if (!isLocked && !isHidden) {
          cell.state = 'exposed';
        }
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
 * Respects locked cells and unrevealed hidden groups.
 * Returns a new grid copy with updated states.
 */
export function recalculateAllExposures(
  grid: (CellData | null)[][],
  rows: number,
  cols: number,
  preserveExposed: boolean = true,
  revealedGroups?: Set<number>
): (CellData | null)[][] {
  const nextGrid: (CellData | null)[][] = grid.map(row =>
    row.map(cell => (cell ? { ...cell } : null))
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = nextGrid[r][c];
      if (cell && cell.state !== 'sealed') {
        const isLocked = !!(cell.lockCount && cell.lockCount > 0);
        const isHidden = !!(cell.hiddenGroup && (!revealedGroups || !revealedGroups.has(cell.hiddenGroup)));

        if (isLocked || isHidden) {
          cell.state = 'closed';
          continue;
        }

        if (preserveExposed && cell.state === 'exposed') {
          // Already exposed: keep exposed!
          continue;
        }
        const exposed = shouldCellBeExposed(nextGrid, r, c, rows, cols, revealedGroups);
        cell.state = exposed ? 'exposed' : 'closed';
      }
    }
  }

  return nextGrid;
}

/**
 * The part of the board the player can see during play.
 *
 * Rule (Tank Top GDD): the visible board is always a square of `cols x cols`
 * (e.g. 8x8, 10x10, 15x15). Rows flow bottom-up: the window is anchored on the
 * lowest row that still has cells, so when a bottom row clears, the rows above it
 * shift down into view. Rows above the window are not on the board yet.
 *
 * `top` can be negative when the remaining picture is shorter than the window;
 * those rows are rendered as empty space above the picture.
 */
export interface VisibleWindow {
  top: number;    // first visible row index (inclusive, may be < 0)
  bottom: number; // last visible row index (inclusive)
  size: number;   // side length of the square board
}

export function getVisibleWindow(
  grid: (CellData | null)[][],
  rows: number,
  cols: number
): VisibleWindow {
  const size = Math.max(1, cols);
  let bottom = rows - 1;
  for (let r = rows - 1; r >= 0; r--) {
    if (grid[r]?.some(cell => cell !== null)) {
      bottom = r;
      break;
    }
  }
  return { top: bottom - size + 1, bottom, size };
}

export function isRowVisible(window: VisibleWindow, r: number): boolean {
  return r >= window.top && r <= window.bottom;
}

/**
 * Finds all exposed cells on the grid that match a given color.
 * Rule: Scans from the bottom row first, then continues on the next row above it.
 * When `window` is given, only cells currently visible on the board qualify:
 * cats cannot fly into cells that have not been pushed down into view yet.
 */
export function findQualifyingSlots(
  grid: (CellData | null)[][],
  color: string,
  rows: number,
  cols: number,
  window?: VisibleWindow
): { r: number; c: number }[] {
  const matches: { r: number; c: number }[] = [];
  const startRow = window ? Math.min(rows - 1, window.bottom) : rows - 1;
  const endRow = window ? Math.max(0, window.top) : 0;
  for (let r = startRow; r >= endRow; r--) {
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
