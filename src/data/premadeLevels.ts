import { LevelConfig, CatBoxData, CellData } from '../types';
import { exposeBottomCells, recalculateAllExposures } from '../engine/exposure';

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
// Level 1 (Screenshot media_1788432161736.jpg)
// 8 cols x 10 rows: 40 cells (10 Yellow, 10 Green, 10 Blue, 10 Red)
// 1 single Queue: [Red 10, Blue 10, Yellow 10, Green 10]
// ==========================================
const LVL1_ASCII = [
  "        ",
  "        ",
  "        ",
  "        ",
  "        ",
  "YYYYGGGG",
  "YYYYGGGG",
  "BBYYGGRR",
  "BBBBRRRR",
  "BBBBRRRR"
];
const lvl1Grid = parseAsciiLevel(LVL1_ASCII, {
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  R: 'red'
});

// ==========================================
// Level 2 (Screenshot media_1788432161786.jpg)
// 10 cols x 10 rows: 60 cells (10 Orange, 10 Blue, 10 Pink, 10 Green, 10 Yellow, 10 Red)
// 2 Queues of 3 boxes of 10
// Left: Red 10, Pink 10, Orange 10
// Right: Yellow 10, Green 10, Blue 10
// ==========================================
const LVL2_ASCII = [
  "          ",
  "          ",
  "          ",
  "          ",
  "OOOOOBBBBB",
  "OOOOOBBBBB",
  "PPPPPGGGGG",
  "PPPPPGGGGG",
  "YYYYYRRRRR",
  "YYYYYRRRRR"
];
const lvl2Grid = parseAsciiLevel(LVL2_ASCII, {
  O: 'orange',
  B: 'blue',
  P: 'pink',
  G: 'green',
  Y: 'yellow',
  R: 'red'
});

// ==========================================
// Level 3 (Screenshot media_1788432161741.jpg)
// 9 cols x 10 rows: Mandala with center hole
// Red/Pink top, Orange/Green bottom, Yellow cross, Blue border frame
// 1 single Queue
// ==========================================
const LVL3_ASCII = [
  "RRRRYPPPP",
  "RRRRYPPPP",
  "RRRBYBPPP",
  "RRRBYBPPP",
  "RBB...BBP",
  "YYB...BYY",
  "OBB...BBG",
  "OOOBYBGGG",
  "OOOBYBGGG",
  "OOOOYGGGG"
];
const lvl3Grid = parseAsciiLevel(LVL3_ASCII, {
  R: 'red',
  P: 'pink',
  Y: 'yellow',
  B: 'blue',
  O: 'orange',
  G: 'green'
});

// ==========================================
// Level 4 (Screenshot media_1788432161738.jpg)
// 10 cols x 10 rows: Devil Smiley Face with horns
// Red horns, Yellow face, Blue eyes, Red smile, bottom exposed Blue row
// 2 Queues
// ==========================================
const LVL4_ASCII_NORM = [
  "RRBBBBBBRR",
  "RRYYYYYYRR",
  "BBYYYYYYBB",
  "BYBYYYYBYB",
  "BYBYYYYBYB",
  "BYYYYYYYYB",
  "BYRYYYYRYB",
  "BYRRRRRRYB",
  "BBYYYYYYBB",
  "BBBBBBBBBB"
];
const lvl4Grid = parseAsciiLevel(LVL4_ASCII_NORM, {
  R: 'red',
  B: 'blue',
  Y: 'yellow'
});

// ==========================================
// Level 5 (Screenshot media_1788451058313.jpg)
// 10 cols x 10 rows: 100 cells (Geometric Harmony)
// 2 Queues of 5 boxes of 10 cats
// ==========================================
const LVL5_ASCII = [
  "PPPPOOOOPP", // 0
  "PPPPOOOOPP", // 1
  "YYPPBBGGYY", // 2
  "YYPPBBGGYY", // 3
  "YYPPOOGGYY", // 4
  "CCYYYYYYCC", // 5
  "BBOOPPOOYY", // 6
  "BBOOCCCCCC", // 7
  "BBOOOOCCCC", // 8
  "GGCCCCCCGG"  // 9
];
const lvl5Grid = parseAsciiLevel(LVL5_ASCII, {
  P: 'pink',
  O: 'orange',
  Y: 'yellow',
  C: 'cyan',
  B: 'blue',
  G: 'green'
});

// ==========================================
// Level 6 (Screenshot media_1788455832239.png)
// 15 cols x 15 rows: 225 cells (Mighty Oak Tree with Apples)
// Multi-layer foliage, lime canopy, 10 red apples, detailed trunk & roots, clouds & night sky
// 3 Queues: Green 50, Brown 20, Red 10, Yellow 50, Cyan 40, Blue 55 = 225 cats
// Front boxes: Green 10, Brown 10, Green 10
// ==========================================
const LVL6_ASCII = [
  "BBBBBCCCCCBBBBB", // 0
  "BBBBCCGGGCCBBBB", // 1
  "BBBCCGYYYYGCCBB", // 2
  "BBCCGRYYYRYGCCB", // 3
  "BCGGYYYYYYYYGGB", // 4
  "CGGYYRYRYRYYGGC", // 5
  "CGGYYYYYYYYYYGC", // 6
  "CGGYYRYRYRYYGGC", // 7
  "BCGGYYYYYYYYGGB", // 8
  "BBCCGRYYYRYGCCB", // 9
  "BBBCCGDDDDGCCBB", // 10
  "BBBBCCDDDCCBBBB", // 11
  "BBBBBCDDDCCBBBB", // 12
  "GGGGGDDDDDGGGGG", // 13
  "GGGGGDDDDDGGGGG"  // 14
];
const lvl6Grid = parseAsciiLevel(LVL6_ASCII, {
  B: 'blue',
  C: 'cyan',
  G: 'green',
  Y: 'yellow',
  R: 'red',
  D: 'brown'
});

// ==========================================
// Level 7 (Screenshot media_1788451058311.jpg)
// 10 cols x 10 rows: 100 cells (Retro Rocket)
// 2 Queues: Red 30, Pink 30, Orange 20, Cyan 20
// Front boxes: Cyan 10, Red 10
// ==========================================
const LVL7_ASCII = [
  "PCCPRRPCCP", // 0
  "POOPRROOPP", // 1
  "POOPRROOPP", // 2
  "POOPRRRROO", // 3
  "PRRRRRRRRP", // 4
  "PRRRPRRRPP", // 5
  "PPPPRRPPPP", // 6
  "POOOOOOOOP", // 7
  "CCCCRRCCCC", // 8
  "CCCCRRCCCC"  // 9
];
const lvl7Grid = parseAsciiLevel(LVL7_ASCII, {
  P: 'pink',
  C: 'cyan',
  R: 'red',
  O: 'orange'
});

// ==========================================
// Level 8 (Screenshot media_1788451058324.jpg)
// 15 cols x 15 rows: 225 cells (Tuxedo Cat Face)
// Authentic cat: pointy ears with inner pink lining, glowing almond eyes,
// white blaze, puffy cheeks, centered red button nose, white tuxedo bib & red bowtie.
// 3 Queues: Brown 95, Blue 60, Yellow 40, Red 20, Green 10 = 225 cats
// Front boxes: Red 10, Brown 10, Brown 10
// ==========================================
const LVL8_ASCII = [
  "BBBBBBBBBBBBBBB", // 0
  "BBDDYBBBBBYDDBB", // 1
  "BBDYYDBBBDYYDBB", // 2
  "BBDYYDBBBDYYDBB", // 3
  "BDDDDDDDDDDDDDB", // 4
  "BDDDDDDDDDDDDDB", // 5
  "BDDDDGDDDDGDDDB", // 6
  "BDDGGGYDYGGGDDB", // 7
  "BDDDDGYYYGDDDDB", // 8
  "BDDDYYYYYYDDDDB", // 9
  "BDDDYYYRYYYDDDB", // 10
  "BDDDYYYYYYYDDDB", // 11
  "DRRRDDYYYDDRRRD", // 12
  "BRRRDDYYYDDRRRB", // 13
  "BBRRRRDDDDRRRBB"  // 14
];
const lvl8Grid = parseAsciiLevel(LVL8_ASCII, {
  B: 'blue',
  D: 'brown',
  Y: 'yellow',
  G: 'green',
  R: 'red'
});

// ==========================================
// Level 9 (Screenshot media_1788451058306.jpg)
// 10 cols x 10 rows: 100 cells (Elephant Mascot)
// 2 Queues: Blue 30, Cyan 20, Green 20, Pink 10, Orange 10, Yellow 10
// Front boxes: Blue 10, Pink 10
// ==========================================
const LVL9_ASCII = [
  "YYYYYYYYYY", // 0
  "BBBOBBBBOB", // 1
  "BBBBGGGGBB", // 2
  "BCOOGGOOCB", // 3
  "CCOOGGOOCC", // 4
  "CCBBGGCCCC", // 5
  "CCBBGGCCCC", // 6
  "BGGGCCGGGB", // 7
  "GPPBBBBPPG", // 8
  "PPPBPPPBBB"  // 9
];
const lvl9Grid = parseAsciiLevel(LVL9_ASCII, {
  Y: 'yellow',
  B: 'blue',
  O: 'orange',
  G: 'green',
  C: 'cyan',
  P: 'pink'
});

// Level 10: Snail Garden (Original screenshot masterpiece Lv10!)
const SNAIL_ASCII = [
  "   PPPPPPPPP   ", // 0
  "  PPPPPPPPPPP  ", // 1
  " GGPPPPPPPPPPP ", // 2
  " GGPPPPBBBBBP  ", // 3
  "PGDGPBBBBBBBBBP", // 4
  "PGDGPBBBYYYYYBP", // 5
  "PGGGPBBYYYYYYBP", // 6
  "PGGGPBYYYYYYYBP", // 7
  "PGGGPBYYBBBYYBP", // 8
  "PGGGPBYYBYYYYBP", // 9
  "PGGGPBYYBYYYYBP", // 10
  "PGGGPBYYYYYYYBP", // 11
  "PGGGPBYYYYYYYBP", // 12
  "PGGGPBBBBBBBGBP", // 13
  "PGGGPBBBBBBBGBP", // 14
  " DGGGGGGGGGGGBD", // 15
  " DGGGGGGGGGGGBD", // 16
  "DDDGGGGGGGGDDDD"  // 17
];
const snailGrid = parseAsciiLevel(SNAIL_ASCII, {
  P: 'pink',
  B: 'blue',
  Y: 'yellow',
  G: 'green',
  D: 'brown'
});

export const PREMADE_LEVELS: LevelConfig[] = [
  // ============================================================
  // Level 1 (Screenshot media_1788432161736.jpg)
  // ============================================================
  {
    id: 'lvl-1-blocks',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL1_ASCII.length,
      cols: LVL1_ASCII[0].length,
      cells: lvl1Grid
    },
    queues: [
      [
        { id: 'b-1-1', color: 'red', count: 10 },
        { id: 'b-1-2', color: 'blue', count: 10 },
        { id: 'b-1-3', color: 'yellow', count: 10 },
        { id: 'b-1-4', color: 'green', count: 10 }
      ]
    ]
  },

  // ============================================================
  // Level 2 (Screenshot media_1788432161786.jpg)
  // ============================================================
  {
    id: 'lvl-2-quadrants',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL2_ASCII.length,
      cols: LVL2_ASCII[0].length,
      cells: lvl2Grid
    },
    queues: [
      // Left Queue: Red 10, Pink 10, Orange 10
      [
        { id: 'b-2-1', color: 'red', count: 10 },
        { id: 'b-2-2', color: 'pink', count: 10 },
        { id: 'b-2-3', color: 'orange', count: 10 }
      ],
      // Right Queue: Yellow 10, Green 10, Blue 10
      [
        { id: 'b-2-4', color: 'yellow', count: 10 },
        { id: 'b-2-5', color: 'green', count: 10 },
        { id: 'b-2-6', color: 'blue', count: 10 }
      ]
    ]
  },

  // ============================================================
  // Level 3 (Screenshot media_1788432161741.jpg)
  // ============================================================
  {
    id: 'lvl-3-mandala',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL3_ASCII.length,
      cols: LVL3_ASCII[0].length,
      cells: lvl3Grid
    },
    queues: (() => {
      const q = generateBalancedQueues(lvl3Grid, 1, 10);
      // Ensure front box matches screenshot (Yellow 10)
      const yellowIdx = q[0].findIndex(b => b.color === 'yellow' && b.count === 10);
      if (yellowIdx > 0) {
        [q[0][0], q[0][yellowIdx]] = [q[0][yellowIdx], q[0][0]];
      }
      q[0][0].isMystery = false;
      return q;
    })()
  },

  // ============================================================
  // Level 4 (Screenshot media_1788432161738.jpg)
  // ============================================================
  {
    id: 'lvl-4-devil-face',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL4_ASCII_NORM.length,
      cols: LVL4_ASCII_NORM[0].length,
      cells: lvl4Grid
    },
    queues: (() => {
      const q = generateBalancedQueues(lvl4Grid, 2, 10);
      // Front boxes match (Blue 10 on both queues)
      for (let i = 0; i < 2; i++) {
        const idx = q[i].findIndex(b => b.color === 'blue');
        if (idx > 0) {
          [q[i][0], q[i][idx]] = [q[i][idx], q[i][0]];
        }
        if (q[i].length > 0) q[i][0].isMystery = false;
      }
      return q;
    })()
  },

  // Level 5: Geometric Harmony (Screenshot Lv5, 2 Queues)
  {
    id: 'lvl-5-geometric',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL5_ASCII.length,
      cols: LVL5_ASCII[0].length,
      cells: lvl5Grid
    },
    queues: [
      // Left Queue: Cyan 10, Blue 10, Orange 10, Yellow 10, Cyan 10
      [
        { id: 'b-5-1', color: 'cyan', count: 10 },
        { id: 'b-5-2', color: 'blue', count: 10, isMystery: true },
        { id: 'b-5-3', color: 'orange', count: 10, isMystery: true },
        { id: 'b-5-4', color: 'yellow', count: 10, isMystery: true },
        { id: 'b-5-5', color: 'cyan', count: 10, isMystery: true }
      ],
      // Right Queue: Green 10, Yellow 10, Pink 10, Orange 10, Pink 10
      [
        { id: 'b-5-6', color: 'green', count: 10 },
        { id: 'b-5-7', color: 'yellow', count: 10, isMystery: true },
        { id: 'b-5-8', color: 'pink', count: 10, isMystery: true },
        { id: 'b-5-9', color: 'orange', count: 10, isMystery: true },
        { id: 'b-5-10', color: 'pink', count: 10, isMystery: true }
      ]
    ]
  },

  // Level 6: Mighty Oak Tree (Screenshot Lv6, 3 Queues)
  {
    id: 'lvl-6-tree',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL6_ASCII.length,
      cols: LVL6_ASCII[0].length,
      cells: lvl6Grid
    },
    queues: [
      // Queue 1 (7 boxes = 70 cats) - All boxes visible as shown in screenshot
      [
        { id: 'b-6-1', color: 'green', count: 10, isMystery: false },
        { id: 'b-6-2', color: 'brown', count: 10, isMystery: false },
        { id: 'b-6-3', color: 'yellow', count: 10, isMystery: false },
        { id: 'b-6-4', color: 'green', count: 10, isMystery: false },
        { id: 'b-6-5', color: 'yellow', count: 10, isMystery: false },
        { id: 'b-6-6', color: 'cyan', count: 10, isMystery: false },
        { id: 'b-6-7', color: 'blue', count: 15, isMystery: false }
      ],
      // Queue 2 (8 boxes = 85 cats) - All boxes visible as shown in screenshot
      [
        { id: 'b-6-8', color: 'brown', count: 10, isMystery: false },
        { id: 'b-6-9', color: 'green', count: 10, isMystery: false },
        { id: 'b-6-10', color: 'blue', count: 10, isMystery: false },
        { id: 'b-6-11', color: 'red', count: 10, isMystery: false },
        { id: 'b-6-12', color: 'yellow', count: 10, isMystery: false },
        { id: 'b-6-13', color: 'yellow', count: 10, isMystery: false },
        { id: 'b-6-14', color: 'cyan', count: 10, isMystery: false },
        { id: 'b-6-15', color: 'blue', count: 10, isMystery: false }
      ],
      // Queue 3 (7 boxes = 70 cats) - All boxes visible as shown in screenshot
      [
        { id: 'b-6-16', color: 'green', count: 10, isMystery: false },
        { id: 'b-6-17', color: 'cyan', count: 10, isMystery: false },
        { id: 'b-6-18', color: 'green', count: 10, isMystery: false },
        { id: 'b-6-19', color: 'blue', count: 10, isMystery: false },
        { id: 'b-6-20', color: 'yellow', count: 10, isMystery: false },
        { id: 'b-6-21', color: 'cyan', count: 10, isMystery: false },
        { id: 'b-6-22', color: 'blue', count: 10, isMystery: false }
      ]
    ]
  },

  // Level 7: Retro Rocket (Screenshot Lv7, 2 Queues)
  {
    id: 'lvl-7-rocket',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL7_ASCII.length,
      cols: LVL7_ASCII[0].length,
      cells: lvl7Grid
    },
    queues: [
      // Left Queue: Cyan 10, Orange 10, Red 10, Pink 10, Red 10
      [
        { id: 'b-7-1', color: 'cyan', count: 10 },
        { id: 'b-7-2', color: 'orange', count: 10, isMystery: true },
        { id: 'b-7-3', color: 'red', count: 10, isMystery: true },
        { id: 'b-7-4', color: 'pink', count: 10, isMystery: true },
        { id: 'b-7-5', color: 'red', count: 10, isMystery: true }
      ],
      // Right Queue: Red 10, Cyan 10, Pink 10, Orange 10, Pink 10
      [
        { id: 'b-7-6', color: 'red', count: 10 },
        { id: 'b-7-7', color: 'cyan', count: 10, isMystery: true },
        { id: 'b-7-8', color: 'pink', count: 10, isMystery: true },
        { id: 'b-7-9', color: 'orange', count: 10, isMystery: true },
        { id: 'b-7-10', color: 'pink', count: 10, isMystery: true }
      ]
    ]
  },

  // Level 8: Tuxedo Cat (Screenshot Lv8, 3 Queues)
  {
    id: 'lvl-8-cat',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL8_ASCII.length,
      cols: LVL8_ASCII[0].length,
      cells: lvl8Grid
    },
    queues: [
      // Queue 1 (7 boxes = 75 cats)
      [
        { id: 'b-8-1', color: 'red', count: 10 },
        { id: 'b-8-2', color: 'brown', count: 10, isMystery: true },
        { id: 'b-8-3', color: 'yellow', count: 10, isMystery: true },
        { id: 'b-8-4', color: 'brown', count: 10, isMystery: true },
        { id: 'b-8-5', color: 'yellow', count: 10, isMystery: true },
        { id: 'b-8-6', color: 'brown', count: 10, isMystery: true },
        { id: 'b-8-7', color: 'blue', count: 15, isMystery: true }
      ],
      // Queue 2 (7 boxes = 75 cats)
      [
        { id: 'b-8-8', color: 'brown', count: 10 },
        { id: 'b-8-9', color: 'red', count: 10, isMystery: true },
        { id: 'b-8-10', color: 'brown', count: 10, isMystery: true },
        { id: 'b-8-11', color: 'green', count: 10, isMystery: true },
        { id: 'b-8-12', color: 'yellow', count: 10, isMystery: true },
        { id: 'b-8-13', color: 'brown', count: 10, isMystery: true },
        { id: 'b-8-14', color: 'blue', count: 15, isMystery: true }
      ],
      // Queue 3 (7 boxes = 75 cats)
      [
        { id: 'b-8-15', color: 'brown', count: 10 },
        { id: 'b-8-16', color: 'brown', count: 15, isMystery: true },
        { id: 'b-8-17', color: 'yellow', count: 10, isMystery: true },
        { id: 'b-8-18', color: 'brown', count: 10, isMystery: true },
        { id: 'b-8-19', color: 'blue', count: 10, isMystery: true },
        { id: 'b-8-20', color: 'blue', count: 10, isMystery: true },
        { id: 'b-8-21', color: 'blue', count: 10, isMystery: true }
      ]
    ]
  },

  // Level 9: Elephant Mascot (Screenshot Lv9, 2 Queues)
  {
    id: 'lvl-9-elephant',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL9_ASCII.length,
      cols: LVL9_ASCII[0].length,
      cells: lvl9Grid
    },
    queues: [
      // Left Queue: Blue 10, Cyan 10, Green 10, Yellow 10, Blue 10
      [
        { id: 'b-9-1', color: 'blue', count: 10 },
        { id: 'b-9-2', color: 'cyan', count: 10, isMystery: true },
        { id: 'b-9-3', color: 'green', count: 10, isMystery: true },
        { id: 'b-9-4', color: 'yellow', count: 10, isMystery: true },
        { id: 'b-9-5', color: 'blue', count: 10, isMystery: true }
      ],
      // Right Queue: Pink 10, Orange 10, Cyan 10, Green 10, Blue 10
      [
        { id: 'b-9-6', color: 'pink', count: 10 },
        { id: 'b-9-7', color: 'orange', count: 10, isMystery: true },
        { id: 'b-9-8', color: 'cyan', count: 10, isMystery: true },
        { id: 'b-9-9', color: 'green', count: 10, isMystery: true },
        { id: 'b-9-10', color: 'blue', count: 10, isMystery: true }
      ]
    ]
  },

  // Level 10: Snail Garden (Screenshot Lv10 Masterpiece - 3 Queues)
  {
    id: 'lvl-10-snail',
    parkingSlotsCount: 5,
    grid: {
      rows: SNAIL_ASCII.length,
      cols: SNAIL_ASCII[0].length,
      cells: snailGrid
    },
    queues: (() => {
      const q = generateBalancedQueues(snailGrid, 3, 10);
      // Front boxes match: Yellow 10, Green 10, Blue 10
      const findAndSwapFront = (queueIdx: number, color: string) => {
        const queue = q[queueIdx];
        const boxIdx = queue.findIndex(b => b.color === color);
        if (boxIdx > 0) {
          [queue[0], queue[boxIdx]] = [queue[boxIdx], queue[0]];
        }
        if (queue.length > 0) queue[0].isMystery = false;
      };
      findAndSwapFront(0, 'yellow');
      findAndSwapFront(1, 'green');
      findAndSwapFront(2, 'blue');
      return q;
    })()
  }
];

// Ensure all 10 premade levels have their bottom cells exposed and valid exposure rules
PREMADE_LEVELS.forEach(level => {
  level.grid.cells = exposeBottomCells(
    level.grid.cells,
    level.grid.rows,
    level.grid.cols
  );
  level.grid.cells = recalculateAllExposures(
    level.grid.cells,
    level.grid.rows,
    level.grid.cols,
    true
  );
});
