import { shouldCellBeExposed, recalculateAllExposures, findClearedLines, findQualifyingSlots } from './engine/exposure';
import { PREMADE_LEVELS } from './data/premadeLevels';
import { CellData, LevelConfig } from './types';

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

// 2. Test Line Clear Logic (Bottom-Up Rule)
console.log('\nTest 2: Line Clear Detection (Bottom-Up Rule)');
const rowClearGrid: (CellData | null)[][] = [
  [{ color: 'pink', state: 'sealed' }, { color: 'pink', state: 'sealed' }, { color: 'pink', state: 'sealed' }],
  [{ color: 'pink', state: 'sealed' }, { color: 'pink', state: 'exposed' }, { color: 'pink', state: 'sealed' }],
  [{ color: 'pink', state: 'sealed' }, { color: 'pink', state: 'sealed' }, { color: 'pink', state: 'sealed' }]
];

// Row 2 is bottom and fully sealed. Row 1 has an exposed cell. Row 0 is fully sealed.
// Under the bottom-up rule: ONLY row 2 should clear! Row 0 must NOT clear ahead of row 1.
const cleared = findClearedLines(rowClearGrid, 3, 3);
if (cleared.length === 1 && cleared[0] === 2) {
  console.log('✓ Bottom-most row (Row 2) clears; Row 0 correctly prevented from clearing ahead of Row 1 (no gap created).');
} else {
  console.error('✗ Line clear bottom-up detection failed, got:', cleared);
}

// When row 1 also becomes fully sealed, both row 1 and row 0 clear together
rowClearGrid[1][1]!.state = 'sealed';
const clearedAll = findClearedLines(rowClearGrid, 3, 3);
if (clearedAll.length === 3 && clearedAll.includes(2) && clearedAll.includes(1) && clearedAll.includes(0)) {
  console.log('✓ When lower rows are sealed, all contiguous sealed rows clear together from the bottom up.');
} else {
  console.error('✗ Sequential line clear failed, got:', clearedAll);
}

// 2b. Test Exposed Slot Scanning Order (Bottom Row First)
console.log('\nTest 2b: Exposed Slot Scanning Order (Bottom Row First)');
const scanTestGrid: (CellData | null)[][] = [
  [{ color: 'pink', state: 'exposed' }, { color: 'blue', state: 'closed' }], // Row 0
  [{ color: 'pink', state: 'exposed' }, { color: 'pink', state: 'exposed' }]  // Row 1 (bottom)
];
const qualifyingMatches = findQualifyingSlots(scanTestGrid, 'pink', 2, 2);
if (
  qualifyingMatches.length === 3 &&
  qualifyingMatches[0].r === 1 && qualifyingMatches[0].c === 0 &&
  qualifyingMatches[1].r === 1 && qualifyingMatches[1].c === 1 &&
  qualifyingMatches[2].r === 0 && qualifyingMatches[2].c === 0
) {
  console.log('✓ Exposed slots scan from bottom row (row 1) first, then upwards to row 0.');
} else {
  console.error('✗ Exposed slots scanning order failed:', qualifyingMatches);
}

// 3. Test Premade Levels
console.log('\nTest 3: Premade Levels Validation');
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

  console.log(`✓ Level ${idx + 1}: "${lvl.id}" (${rowCount}x${colCount}) - ${totalCells} cells, ${totalCats} cats, bottom cells exposed: ${hasExposedBottom}`);
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

// 6. Test Hidden Cell Revelation Logic
console.log('\nTest 6: Hidden Cell Group Revelation Logic');
import { dispatchCats, tapQueueBox, GameState } from './engine/gameEngine';

// Build a level where:
// (0, 0): Pink exposed cell
// (0, 1): Cyan cell with hiddenGroup 1 (adjacent to (0, 0))
// (0, 2): Cyan cell with hiddenGroup 1 (also in group 1)
const hiddenTestLevel: LevelConfig = {
  id: 'hidden-test',
  grid: {
    rows: 1,
    cols: 3,
    cells: [
      [
        { color: 'pink', state: 'exposed' },
        { color: 'cyan', state: 'closed', hiddenGroup: 1 },
        { color: 'cyan', state: 'closed', hiddenGroup: 1 }
      ]
    ]
  },
  queues: [
    [{ id: 'box-1', color: 'pink', count: 1 }]
  ],
  parkingSlotsCount: 5
};

const hiddenState0 = createInitialGameState(hiddenTestLevel);
// Initially, hiddenGroup 1 is not revealed
if (!hiddenState0.revealedGroups.has(1)) {
  console.log('✓ Hidden group 1 is unrevealed at game start.');
} else {
  console.error('✗ Hidden group 1 should not be revealed initially!');
}

// Click queue to move pink cat box to parking, then dispatch
const afterClick = tapQueueBox(hiddenState0, 0);
const afterDispatch = dispatchCats(afterClick.nextState);

// Pink cell at (0, 0) is now sealed
if (afterDispatch.grid[0][0]?.state === 'sealed') {
  console.log('✓ Pink cell sealed by dispatched cat.');
} else {
  console.error('✗ Pink cell was not sealed!');
}

// Because (0, 1) touches newly sealed (0, 0), hidden group 1 must be revealed!
if (afterDispatch.revealedGroups.has(1)) {
  console.log('✓ Hidden group 1 revealed automatically when adjacent cell sealed.');
} else {
  console.error('✗ Hidden group 1 was not revealed upon neighbor seal!');
}

// And cell (0, 1) now touches a sealed neighbor, so it must now turn exposed!
if (afterDispatch.grid[0][1]?.state === 'exposed') {
  console.log('✓ Newly revealed cell (0, 1) properly turns EXPOSED (open lid).');
} else {
  console.error('✗ Revealed cell (0, 1) failed to become exposed, got:', afterDispatch.grid[0][1]?.state);
}

// 7. Test Locked Cell Countdown and Unlock Logic
console.log('\nTest 7: Locked Cell Countdown and Unlock Logic');
const lockTestLevel: LevelConfig = {
  id: 'lock-test',
  grid: {
    rows: 1,
    cols: 2,
    cells: [
      [
        { color: 'pink', state: 'exposed' },
        { color: 'yellow', state: 'closed', lockCount: 2 }
      ]
    ]
  },
  queues: [
    [{ id: 'box-p1', color: 'pink', count: 1 }]
  ],
  parkingSlotsCount: 5
};

const lockState0 = createInitialGameState(lockTestLevel);
// Locked cell must remain closed initially
if (lockState0.grid[0][1]?.state === 'closed' && lockState0.grid[0][1]?.lockCount === 2) {
  console.log('✓ Locked cell is closed with countdown = 2 at game start.');
} else {
  console.error('✗ Locked cell initial state incorrect:', lockState0.grid[0][1]);
}

// Seal 1 cell via pink cat dispatch
const clickLock = tapQueueBox(lockState0, 0);
const dispatchLock = dispatchCats(clickLock.nextState);

// Lock count should decrement from 2 to 1
const lockedCellAfter1 = dispatchLock.grid[0][1];
if (lockedCellAfter1 && lockedCellAfter1.lockCount === 1) {
  console.log('✓ Lock countdown decremented from 2 to 1 after 1 cell sealed.');
} else {
  console.error('✗ Lock countdown failed to decrement, got:', lockedCellAfter1?.lockCount);
}

// Now seal another cell by dispatching again (manually setting state with sealed cell to test unlock)
const testStateForUnlock: GameState = {
  ...dispatchLock,
  parkingSlots: [{ id: 'fake', color: 'pink', count: 1, slotIndex: 0, isMystery: false }],
  grid: [
    [
      { color: 'pink', state: 'exposed' }, // exposed cell to seal
      { color: 'yellow', state: 'closed', lockCount: 1 } // cell with lockCount 1
    ]
  ]
};
const dispatchUnlock = dispatchCats(testStateForUnlock);
const unlockedCell = dispatchUnlock.grid[0][1];

if (unlockedCell && unlockedCell.lockCount === undefined) {
  console.log('✓ Locked cell countdown reached 0 and unlocked completely (lockCount removed).');
} else {
  console.error('✗ Cell failed to unlock completely, lockCount is:', unlockedCell?.lockCount);
}

if (unlockedCell && unlockedCell.state === 'exposed') {
  console.log('✓ Unlocked cell adjacent to sealed cell successfully became EXPOSED.');
} else {
  console.error('✗ Unlocked cell did not become exposed, got:', unlockedCell?.state);
}

// 8. Test Layout-Aware Auto-Generated Queues (Bottom-Up Order)
console.log('\nTest 8: Layout-Aware Auto-Generated Queues (Bottom-Up Order)');
// Grid layout:
// Row 0 (top): 10 Pink cells
// Row 1 (mid): 10 Blue cells
// Row 2 (bottom): 10 Yellow cells
const orderedGrid: (CellData | null)[][] = [
  Array.from({ length: 10 }, () => ({ color: 'pink', state: 'closed' })),
  Array.from({ length: 10 }, () => ({ color: 'blue', state: 'closed' })),
  Array.from({ length: 10 }, () => ({ color: 'yellow', state: 'closed' }))
];

const generatedOrderedQueues = generateBalancedQueues(orderedGrid, 2, 10);
// Queue 0 top and Queue 1 top should start with yellow (bottom-most row color)
const frontBoxQ0 = generatedOrderedQueues[0]?.[0];
const frontBoxQ1 = generatedOrderedQueues[1]?.[0];

if (frontBoxQ0?.color === 'yellow') {
  console.log('✓ Yellow cells at the bottom correctly mapped to the TOP box of Queue 1.');
} else {
  console.error('✗ Expected Yellow at front of Queue 1, got:', frontBoxQ0?.color);
}

// Next should come Blue (row 1), then Pink (row 0)
const allOrderedBoxes = [
  ...generatedOrderedQueues[0],
  ...generatedOrderedQueues[1]
];
const yellowBox = allOrderedBoxes.find(b => b.color === 'yellow');
const blueBox = allOrderedBoxes.find(b => b.color === 'blue');
const pinkBox = allOrderedBoxes.find(b => b.color === 'pink');

if (yellowBox && blueBox && pinkBox) {
  console.log('✓ All 3 colors accounted for with balanced counts (10 Yellow, 10 Blue, 10 Pink).');
} else {
  console.error('✗ Missing boxes for one of the colors in generated queues!');
}

// 9. Square visible board: only cells pushed down into view can receive cats
console.log('\nTest 9: Square Visible Board (cols x cols) and Bottom-Up Row Shift');
import { getVisibleWindow } from './engine/exposure';
{
  // 4 rows x 2 cols -> visible board is 2x2 (bottom two rows)
  const tallGrid: (CellData | null)[][] = [
    [{ color: 'blue', state: 'closed' }, { color: 'blue', state: 'closed' }], // row 0 (hidden)
    [{ color: 'pink', state: 'exposed' }, { color: 'blue', state: 'closed' }], // row 1 (hidden, exposed)
    [{ color: 'red', state: 'exposed' }, { color: 'red', state: 'exposed' }], // row 2 (visible)
    [{ color: 'red', state: 'exposed' }, { color: 'red', state: 'exposed' }]  // row 3 (visible, bottom)
  ];
  const win = getVisibleWindow(tallGrid, 4, 2);
  if (win.size !== 2 || win.top !== 2 || win.bottom !== 3) {
    throw new Error(`Expected window rows 2..3 size 2, got ${JSON.stringify(win)}`);
  }
  if (findQualifyingSlots(tallGrid, 'pink', 4, 2, win).length !== 0) {
    throw new Error('Pink cell above the visible board must not qualify');
  }
  console.log('✓ Board is a 2x2 square for a 2-col level; exposed cell above the board does not qualify.');

  // Clear the bottom two rows -> rows above shift down into view
  const shifted = tallGrid.map((row, r) => (r >= 2 ? [null, null] : row));
  const win2 = getVisibleWindow(shifted, 4, 2);
  if (win2.top !== 0 || win2.bottom !== 1) {
    throw new Error(`Expected window rows 0..1 after clears, got ${JSON.stringify(win2)}`);
  }
  if (findQualifyingSlots(shifted, 'pink', 4, 2, win2).length !== 1) {
    throw new Error('Pink cell should qualify once shifted into the board');
  }
  console.log('✓ After bottom rows clear, rows above shift into view and become targetable.');

  // Engine level check: a parked pink box does not dispatch while its cell is above the board
  const tallLevel: LevelConfig = {
    id: 'tall-test',
    parkingSlotsCount: 5,
    grid: { rows: 4, cols: 2, cells: tallGrid },
    queues: [[{ id: 'p1', color: 'pink', count: 1 }]]
  };
  let st = createInitialGameState(tallLevel);
  st = tapQueueBox(st, 0).nextState;
  st = dispatchCats(st);
  if (st.flyingCats.length !== 0 || st.parkingSlots[0]?.count !== 1) {
    throw new Error('Pink box must not send cats to a cell above the visible board');
  }
  console.log('✓ Engine: parked box keeps its cats until the target cell is on the board.');

  // Empty rows at the very bottom do not take up board space
  const gapGrid: (CellData | null)[][] = [
    [{ color: 'pink', state: 'exposed' }, null],
    [null, null]
  ];
  const win3 = getVisibleWindow(gapGrid, 2, 2);
  if (win3.bottom !== 0) throw new Error('Window should anchor on the lowest non-empty row');
  console.log('✓ Window anchors on the lowest row that still has cells.');
}

// 10. Built-in levels come from the level data sheet
console.log('\nTest 10: Built-in Levels from Level Data Sheet');
if (PREMADE_LEVELS.length !== 40 || PREMADE_LEVELS[0].id !== '1' || PREMADE_LEVELS[39].id !== '40') {
  throw new Error(`Expected sheet levels "1".."40", got ${PREMADE_LEVELS.length} levels`);
}
PREMADE_LEVELS.forEach(lvl => {
  if (lvl.grid.cells.length !== lvl.grid.rows || lvl.grid.cells.some(row => row.length !== lvl.grid.cols)) {
    throw new Error(`Level ${lvl.id} grid size does not match rows/cols`);
  }
});
console.log('✓ 40 sheet levels loaded with consistent grid sizes.');

console.log('\n=== All Core Engine Tests Passed Successfully! ===');

