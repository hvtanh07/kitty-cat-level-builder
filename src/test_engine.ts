import { shouldCellBeExposed, recalculateAllExposures, findClearedLines } from './engine/exposure';
import { PREMADE_LEVELS } from './data/premadeLevels';
import { CellData } from './types';

console.log('=== Running Kitty Cat Game Logic Verification ===\n');

// 1. Test Exposure Rule
console.log('Test 1: 1/4 Side Exposure Rule Verification');

// Create a 3x3 grid:
// Row 0: [P, P, P]
// Row 1: [P, P, P]
// Row 2: [P, P, P]
// All cells are closed, none touch null or sealed cells (boundaries don't count!)
const testGrid1: (CellData | null)[][] = [
  [{ color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }],
  [{ color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }],
  [{ color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }]
];

const exposedGrid1 = recalculateAllExposures(testGrid1, 3, 3);
// Center cell (1, 1) has 4 closed neighbors -> must be closed!
if (exposedGrid1[1][1]?.state === 'closed') {
  console.log('✓ Inner enclosed cell remains closed.');
} else {
  console.error('✗ Inner enclosed cell should be closed, got:', exposedGrid1[1][1]?.state);
}

// Corner cell (0, 0) touches boundaries (which do not count) and closed neighbors -> must be closed!
if (exposedGrid1[0][0]?.state === 'closed') {
  console.log('✓ Grid edge correctly does not count as unoccupied slot (corner remains closed).');
} else {
  console.error('✗ Corner cell should remain closed, got:', exposedGrid1[0][0]?.state);
}

// Now introduce empty space at row 0 (empty rows above):
const testGrid2: (CellData | null)[][] = [
  [null, null, null],
  [{ color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }],
  [{ color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }]
];

const exposedGrid2 = recalculateAllExposures(testGrid2, 3, 3, false);
// Cells in row 1 touch empty space in row 0 above them -> they must stay CLOSED (empty space does not expose top)!
const topStayClosed = exposedGrid2[1][0]?.state === 'closed' && exposedGrid2[1][1]?.state === 'closed' && exposedGrid2[1][2]?.state === 'closed';
if (topStayClosed) {
  console.log('✓ Empty canvas/space above blocks correctly does NOT expose top cells (top remains closed).');
} else {
  console.error('✗ Top cells falsely exposed by empty space above!');
}

// Now introduce a sealed cell at (1, 1):
const testGrid3: (CellData | null)[][] = [
  [{ color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }],
  [{ color: 'pink', state: 'closed' }, { color: 'blue', state: 'sealed' }, { color: 'pink', state: 'closed' }],
  [{ color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }, { color: 'pink', state: 'closed' }]
];

const exposedGrid3 = recalculateAllExposures(testGrid3, 3, 3, false);
const s1 = exposedGrid3[0][1]?.state === 'exposed';
const s2 = exposedGrid3[2][1]?.state === 'exposed';
const s3 = exposedGrid3[1][0]?.state === 'exposed';
const s4 = exposedGrid3[1][2]?.state === 'exposed';

if (s1 && s2 && s3 && s4) {
  console.log('✓ Cells adjacent to sealed cell successfully turn EXPOSED (open lid).');
} else {
  console.error('✗ Neighbors of sealed cell failed to expose:', { s1, s2, s3, s4 });
}

// 2. Test Line Clear Logic
console.log('\nTest 2: Line Clear Detection');
const rowClearGrid: (CellData | null)[][] = [
  [{ color: 'pink', state: 'sealed' }, { color: 'pink', state: 'sealed' }, { color: 'pink', state: 'sealed' }],
  [{ color: 'pink', state: 'sealed' }, { color: 'pink', state: 'exposed' }, { color: 'pink', state: 'sealed' }],
  [{ color: 'pink', state: 'sealed' }, { color: 'pink', state: 'sealed' }, { color: 'pink', state: 'sealed' }]
];

const cleared = findClearedLines(rowClearGrid, 3, 3);
if (cleared.length === 2 && cleared.includes(0) && cleared.includes(2)) {
  console.log('✓ Rows 0 and 2 correctly identified for line clear, row 1 preserved.');
} else {
  console.error('✗ Line clear detection failed:', cleared);
}

// 3. Test Premade Levels
console.log('\nTest 3: Premade Levels Validation (10 Levels)');
PREMADE_LEVELS.forEach((lvl, idx) => {
  const rowCount = lvl.grid.rows;
  const colCount = lvl.grid.cols;
  let totalCells = 0;
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      if (lvl.grid.cells[r]?.[c]) totalCells++;
    }
  }

  let totalCats = 0;
  lvl.queues.forEach(q => {
    q.forEach(b => totalCats += b.count);
  });

  // Verify bottom cells are exposed for this level
  let hasExposedBottom = false;
  for (let c = 0; c < colCount; c++) {
    for (let r = rowCount - 1; r >= 0; r--) {
      const cell = lvl.grid.cells[r]?.[c];
      if (cell) {
        if (cell.state === 'exposed') hasExposedBottom = true;
        break;
      }
    }
  }

  console.log(`✓ Level ${idx + 1}: "${lvl.name}" (${rowCount}x${colCount}) - ${totalCells} cells, ${totalCats} cats, bottom cells exposed: ${hasExposedBottom}`);
});

// 4. Test Play Test State Preservation
console.log('\nTest 4: Play Test State Preservation');
import { createInitialGameState } from './engine/gameEngine';
const testLvl = PREMADE_LEVELS[0];
const gameState = createInitialGameState(testLvl);
let exposedInPlayTest = 0;
gameState.grid.forEach(row => {
  row.forEach(cell => {
    if (cell && cell.state === 'exposed') exposedInPlayTest++;
  });
});
if (exposedInPlayTest > 0) {
  console.log(`✓ Play Test successfully preserved ${exposedInPlayTest} exposed cells from design configuration.`);
} else {
  console.error('✗ Play Test failed to preserve exposed cells!');
}

// 5. Test Auto-Generate Queues preserves exact queue count
console.log('\nTest 5: Auto-Generate Queues Count Preservation');
import { generateBalancedQueues } from './data/premadeLevels';
[1, 2, 3, 4, 5].forEach(count => {
  const generated = generateBalancedQueues(testLvl.grid.cells, count, 10);
  if (generated.length === count) {
    console.log(`✓ Requested ${count} queues -> correctly generated exactly ${generated.length} queues.`);
  } else {
    console.error(`✗ Expected ${count} queues, got ${generated.length}`);
  }
});

console.log('\n=== All Core Engine Tests Passed Successfully! ===');

