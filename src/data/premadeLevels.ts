import { LevelConfig, CatBoxData, CellData } from '../types';
import { exposeBottomCells, recalculateAllExposures } from '../engine/exposure';

/**
 * Utility to generate a balanced set of box queues for any grid layout.
 * It counts the required cells per color, splits them into boxes of given size (e.g. 10),
 * distributes them across N queues (default 3), and marks back boxes as mystery '?'.
 */
export function generateBalancedQueues(
  cells: (CellData | null)[][],
  queueCount: number = 3,
  boxSize: number = 10
): CatBoxData[][] {
  const colorCounts: Record<string, number> = {};
  for (const row of cells) {
    for (const cell of row) {
      if (cell) {
        colorCounts[cell.color] = (colorCounts[cell.color] || 0) + 1;
      }
    }
  }

  // Create list of boxes
  const allBoxes: CatBoxData[] = [];
  let boxIdCounter = 1;

  for (const [color, count] of Object.entries(colorCounts)) {
    let remaining = count;
    while (remaining > 0) {
      const thisBoxCount = Math.min(remaining, boxSize);
      allBoxes.push({
        id: `box-${boxIdCounter++}`,
        color,
        count: thisBoxCount,
        isMystery: false
      });
      remaining -= thisBoxCount;
    }
  }

  // Shuffle boxes slightly for fun gameplay while keeping colors mixed
  for (let i = allBoxes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allBoxes[i], allBoxes[j]] = [allBoxes[j], allBoxes[i]];
  }

  // Distribute into exactly N queues round-robin
  const queues: CatBoxData[][] = Array.from({ length: queueCount }, () => []);
  allBoxes.forEach((box, idx) => {
    const qIndex = idx % queueCount;
    const isFront = queues[qIndex].length === 0;
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
  "BBYYGGGR",
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
// 10 cols x 10 rows: 60 cells (10 Indigo, 10 Cyan, 10 Lavender, 10 Lime, 10 Yellow, 10 Red)
// 2 Queues of 3 boxes of 10
// Left: Red 10, Lavender 10, Cyan 10
// Right: Yellow 10, Lime 10, Indigo 10
// ==========================================
const LVL2_ASCII = [
  "          ",
  "          ",
  "          ",
  "          ",
  "IIIIICCCCC",
  "IIIIICCCCC",
  "LLLLLGGGGG",
  "LLLLLGGGGG",
  "YYYYYRRRRR",
  "YYYYYRRRRR"
];
const lvl2Grid = parseAsciiLevel(LVL2_ASCII, {
  I: 'indigo',
  C: 'cyan',
  L: 'lavender',
  G: 'lime',
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
// White/Red horns, Yellow face, White/Indigo eyes, Red smile, bottom exposed Indigo row
// 2 Queues
// ==========================================
const LVL4_ASCII = [
  "WRIIIIIIIRW",
  "WRYYYYYYRW ",
  "IIYYYYYYII ",
  "IYWWYYWWIY ",
  "IYWIYYIWIY ",
  "IYYYYYYYYI ",
  "IYRYYYYRYI ",
  "IYRRRRRRYI ",
  "IIYYYYYYII ",
  "IIIIIIIIII "
];
// Normalize to 10 cols
const LVL4_ASCII_NORM = [
  "WRIIIIIIIR",
  "WRYYYYYYRW",
  "IIYYYYYYII",
  "IYWWYYWWIY",
  "IYWIYYIWIY",
  "IYYYYYYYYI",
  "IYRYYYYRYI",
  "IYRRRRRRYI",
  "IIYYYYYYII",
  "IIIIIIIIII"
];
const lvl4Grid = parseAsciiLevel(LVL4_ASCII_NORM, {
  W: 'white',
  R: 'red',
  I: 'indigo',
  Y: 'yellow'
});

// Level 5: Sweet Strawberry (2 Queues)
const LVL5_ASCII = [
  "   GG GG   ",
  "  GGGGGGG  ",
  "  RRRRRRR  ",
  " RRYRRRYRR ",
  " RRRRRRRRR ",
  " RRRRYRRRR ",
  "  RRRRRRR  ",
  "   RRRRR   ",
  "     R     "
];
const lvl5Grid = parseAsciiLevel(LVL5_ASCII, { G: 'green', R: 'red', Y: 'yellow' });

// Level 6: Rubber Ducky (3 Queues)
const LVL6_ASCII = [
  "     YYYY    ",
  "    YYXPYY   ",
  "   OYYYYYY   ",
  "  OOOOYYYY   ",
  "   YYYYYYYY  ",
  "  YYYYYYYYYY ",
  "  YYYYYYYYYY ",
  "   YYYYYYYY  ",
  "BBBBBBBBBBBBB",
  " CCCCCCCCCCC "
];
const lvl6Grid = parseAsciiLevel(LVL6_ASCII, { Y: 'yellow', O: 'orange', X: 'gray', P: 'pink', B: 'blue', C: 'cyan' });

// Level 7: Rainbow Butterfly (3 Queues)
const LVL7_ASCII = [
  " C         C ",
  "  C  DDD  C  ",
  " BBBBDDDDBBB ",
  "BBBYYYYYYYBBB",
  "BLLYYYYYYYLLB",
  " LLLLGGGGLLLL",
  "  LLGDDDGGLL ",
  "  PPGDDDGGPP ",
  "  PPPP  PPPP "
];
const lvl7Grid = parseAsciiLevel(LVL7_ASCII, { C: 'cyan', D: 'dark_brown', B: 'blue', Y: 'yellow', L: 'lime', G: 'green', P: 'pink' });

// Level 8: Retro Gamepad (3 Queues)
const LVL8_ASCII = [
  "  XXXXXXXXXXX  ",
  " XXXXXXXXXXXXX ",
  "XX  X     X  XX",
  "XX XXX   R   XX",
  "XX  X   Y B  XX",
  "XXXXX    G   XX",
  "XXXXX       XXX",
  "XXXXX  DDD  XXX",
  " XXXX       XXX",
  "  XXXXXXXXXXX  ",
  "   XX     XX   "
];
const lvl8Grid = parseAsciiLevel(LVL8_ASCII, { X: 'gray', R: 'red', Y: 'yellow', B: 'blue', G: 'green', D: 'dark_brown' });

// Level 9: Sunflower Blossom (4 Queues)
const LVL9_ASCII = [
  "     YYYY     ",
  "   YYYYYYYY   ",
  "  YYYRRRRYYY  ",
  " YYYRRDDDDRYY ",
  " YYYRDDDDDRYY ",
  " YYYRDDDDDRYY ",
  " YYYRRDDDDRYY ",
  "  YYYRRRRYYY  ",
  "   YYYYYYYY   ",
  "     YYYY     ",
  "      GG      ",
  "    LLGGLL    ",
  "   LLLLGGLLLL ",
  "      GG      "
];
const lvl9Grid = parseAsciiLevel(LVL9_ASCII, { Y: 'yellow', R: 'orange', D: 'brown', G: 'green', L: 'lime' });

// Level 10: Snail Garden (Original screenshot masterpiece Lv10!)
const SNAIL_ASCII = [
  "   PPPPPPPPP   ", // 0
  "  PPPPPPPPPPP  ", // 1
  " LLPPPPPPPPPPP ", // 2
  " LLPPPPBBBBBP  ", // 3
  "PLXLPBBBBBBBBBP", // 4
  "PLXLPBBBYYYYYBP", // 5
  "PLLLPBBYYYYYYBP", // 6
  "PLLLPBYYYYYYYBP", // 7
  "PLLLPBYYBBBYYBP", // 8
  "PLLLPBYYBYYYYBP", // 9
  "PLLLPBYYBYYYYBP", // 10
  "PLLLPBYYYYYYYBP", // 11
  "PLLLPBYYYYYYYBP", // 12
  "PLLLPBBBBBBBGBP", // 13
  "PLLLPBBBBBBBGBP", // 14
  " RLLGGGGGGGGGBR", // 15
  " RLLGGGGGGGGGBR", // 16
  "DDRLLLLGGGGDDDD"  // 17
];
const snailGrid = parseAsciiLevel(SNAIL_ASCII, {
  P: 'pink',
  B: 'blue',
  Y: 'yellow',
  G: 'green',
  L: 'lime',
  R: 'brown',
  D: 'dark_brown',
  X: 'gray'
});

export const PREMADE_LEVELS: LevelConfig[] = [
  // ============================================================
  // Level 1 (Screenshot media_1788432161736.jpg)
  // ============================================================
  {
    id: 'lvl-1-blocks',
    name: 'Level 1',
    difficulty: 'Easy',
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
    name: 'Level 2',
    difficulty: 'Easy',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL2_ASCII.length,
      cols: LVL2_ASCII[0].length,
      cells: lvl2Grid
    },
    queues: [
      // Left Queue: Red 10, Lavender 10, Cyan 10
      [
        { id: 'b-2-1', color: 'red', count: 10 },
        { id: 'b-2-2', color: 'lavender', count: 10 },
        { id: 'b-2-3', color: 'cyan', count: 10 }
      ],
      // Right Queue: Yellow 10, Lime 10, Indigo 10
      [
        { id: 'b-2-4', color: 'yellow', count: 10 },
        { id: 'b-2-5', color: 'lime', count: 10 },
        { id: 'b-2-6', color: 'indigo', count: 10 }
      ]
    ]
  },

  // ============================================================
  // Level 3 (Screenshot media_1788432161741.jpg)
  // ==========================================
  {
    id: 'lvl-3-mandala',
    name: 'Level 3',
    difficulty: 'Easy',
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
    name: 'Level 4',
    difficulty: 'Medium',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL4_ASCII_NORM.length,
      cols: LVL4_ASCII_NORM[0].length,
      cells: lvl4Grid
    },
    queues: (() => {
      const q = generateBalancedQueues(lvl4Grid, 2, 10);
      // Front boxes match screenshot (Indigo 10 on both queues)
      for (let i = 0; i < 2; i++) {
        const idx = q[i].findIndex(b => b.color === 'indigo');
        if (idx > 0) {
          [q[i][0], q[i][idx]] = [q[i][idx], q[i][0]];
        }
        if (q[i].length > 0) q[i][0].isMystery = false;
      }
      return q;
    })()
  },

  // Level 5: Sweet Strawberry (2 Queues)
  {
    id: 'lvl-5-strawberry',
    name: 'Sweet Strawberry',
    difficulty: 'Medium',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL5_ASCII.length,
      cols: LVL5_ASCII[0].length,
      cells: lvl5Grid
    },
    queues: generateBalancedQueues(lvl5Grid, 2, 10)
  },

  // Level 6: Rubber Ducky (3 Queues)
  {
    id: 'lvl-6-ducky-pond',
    name: 'Rubber Ducky Pond',
    difficulty: 'Medium',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL6_ASCII.length,
      cols: LVL6_ASCII[0].length,
      cells: lvl6Grid
    },
    queues: generateBalancedQueues(lvl6Grid, 3, 10)
  },

  // Level 7: Rainbow Butterfly (3 Queues)
  {
    id: 'lvl-7-butterfly',
    name: 'Rainbow Butterfly',
    difficulty: 'Medium',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL7_ASCII.length,
      cols: LVL7_ASCII[0].length,
      cells: lvl7Grid
    },
    queues: generateBalancedQueues(lvl7Grid, 3, 10)
  },

  // Level 8: Retro Gamepad (3 Queues)
  {
    id: 'lvl-8-gamepad',
    name: 'Retro Gamepad',
    difficulty: 'Hard',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL8_ASCII.length,
      cols: LVL8_ASCII[0].length,
      cells: lvl8Grid
    },
    queues: generateBalancedQueues(lvl8Grid, 3, 10)
  },

  // Level 9: Sunflower Blossom (4 Queues)
  {
    id: 'lvl-9-sunflower',
    name: 'Sunflower Blossom',
    difficulty: 'Hard',
    parkingSlotsCount: 5,
    grid: {
      rows: LVL9_ASCII.length,
      cols: LVL9_ASCII[0].length,
      cells: lvl9Grid
    },
    queues: generateBalancedQueues(lvl9Grid, 4, 10)
  },

  // Level 10: Snail Garden (Screenshot Lv10 Masterpiece - 3 Queues)
  {
    id: 'lvl-10-snail',
    name: 'Snail Garden',
    difficulty: 'Expert',
    parkingSlotsCount: 5,
    grid: {
      rows: SNAIL_ASCII.length,
      cols: SNAIL_ASCII[0].length,
      cells: snailGrid
    },
    queues: (() => {
      const q = generateBalancedQueues(snailGrid, 3, 10);
      // Front boxes match screenshot: Yellow 10, Green 10, Lime 10
      const findAndSwapFront = (queueIdx: number, color: string) => {
        const queue = q[queueIdx];
        const boxIdx = queue.findIndex(b => b.color === color && b.count === 10);
        if (boxIdx > 0) {
          [queue[0], queue[boxIdx]] = [queue[boxIdx], queue[0]];
        }
        queue[0].isMystery = false;
      };
      findAndSwapFront(0, 'yellow');
      findAndSwapFront(1, 'green');
      findAndSwapFront(2, 'lime');
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
