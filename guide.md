# Kitty Cat Level Builder & Play Test Engine - Developer & AI Guide

Welcome to the **Kitty Cat Level Builder** codebase. This guide is written specifically so that any developer or AI agent opening this project on another machine can immediately understand the architecture, game mechanics, data contracts, and coding patterns, and continue extending the project with zero friction.

---

## 1. Quickstart & Commands

- **Prerequisites**: Node.js 18+ (tested on Node v20/v24), npm.
- **Install Dependencies**:
  ```bash
  npm install
  ```
- **Start Dev Server**:
  ```bash
  npm run dev
  ```
  Runs Vite dev server with hot module replacement (default: `http://localhost:3000`).
- **Production Build**:
  ```bash
  npm run build
  ```
  Compiles TypeScript and bundles via Vite into `dist/`.
- **Preview Production Build**:
  ```bash
  npm run preview
  ```

---

## 2. Game Overview & Aesthetic

This application is a complete **Level Builder and Play Test Suite** for a casual mobile puzzle game inspired by 3D toy/block mechanics.

- **Visual Aesthetic**:
  - Warm wooden tabletop frame (`#fcedda` to `#ecc9a2` gradients, wooden borders, recessed trays).
  - 3D toy-like carrier boxes with rounded corners, front paw prints, and counter pill badges.
  - 3D cubic cell blocks on a recessed dark board.
  - Three cell states: **Closed Block** (solid plastic lid), **Exposed Slot** (hollow sunken cavity with open rim), and **Sealed Slot** (closed lid with stamped golden paw print).
  - Swarm of animated mini cats scurrying along parabolic arcs into qualifying exposed slots.

---

## 3. Core Mechanics & State Machine Specification

### A. Level Grid & Cell Slot Model
1. The grid is a 2D matrix of dimensions `rows × cols`.
2. A grid cell can be:
   - `null`: empty space / void (not part of the picture).
   - `CellData`: an active cell slot containing:
     - `color`: string identifier from palette (`'pink'`, `'blue'`, `'yellow'`, etc.).
     - `state`: `'closed'` | `'exposed'` | `'sealed'`.
3. **Exposure & In-Game Progression Rule** (`src/engine/exposure.ts`):
   - **Initial State**: At level start, **only the bottom cells** of the active block structure start in the `'exposed'` (open lid) state (via `exposeBottomCells(grid, rows, cols)`). All top cells and outer side cells are solid **closed** blocks.
   - **Dynamic Exposure during Gameplay**: A closed cell turns into `'exposed'` when **an adjacent orthogonal cell (North, South, East, West) turns into a `'sealed'` cell** (once a cat enters that neighbor). This allows cats to enter from the bottom and naturally peel/expose the board upward toward the top.
   - Empty canvas space / void (`null`) outside or above the block layout does **not** expose blocks (avoiding the bug where top cells falsely opened their lids).
   - **Design Mode & Play Test Preservation**: Any cell explicitly set to `'exposed'` in Design Mode (or by "Expose Bottom Cells") is preserved into Play Test mode (`recalculateAllExposures` uses `preserveExposed: true`). Once exposed, a cell never reverts to closed during gameplay.

### B. Cat Box Queues & Parking Slots
1. Cat boxes are lined up into multiple queues (default 3, configurable 2–6).
2. The **Auto-Generate Queues** tool strictly preserves the current number of queues configured by the user, populating balanced boxes across exactly those queues without adding extra queues.
3. Tapping the **front box** of any queue moves it into the first empty parking slot (tray capacity default 5, configurable 3–7).
4. If all parking slots are full, the tap is rejected with a shake animation and sound.
5. When the front box moves, the next box in the queue steps forward. If it was marked `isMystery: true`, it automatically reveals its color and count (`?` becomes visible).
6. **Concurrent Box Sending**: Sending a box to a parking slot and having it extract cats to cells does **not** block the player. You can tap and send the next box to an open parking slot immediately while cats are actively in flight. Multiple boxes can park and dispatch cats concurrently.

### C. Cat Swarm Dispatch & Cascades (`src/engine/gameEngine.ts`)
1. Once a box arrives at a parking slot, it scans the grid for qualifying slots (`findQualifyingSlots`):
   - `slot.state === 'exposed'` (lid is open).
   - `slot.color === box.color` (matching color).
   - **Bottom-Up Scanning Order**: Scanning scans from the **bottom row first** (`rows - 1`), then continues on the next row above it towards row 0. Cats always fill exposed slots in lower rows before filling slots above.
2. The box dispatches `N = Math.min(box.count, qualifyingSlots.length)` cats.
3. Cats travel along parabolic flight trajectories (`FlyingCat`) to the target cells.
4. When a cat lands:
   - The cell lid closes and becomes `'sealed'` (marked with a paw print).
   - Adjacent `'closed'` neighbors of the newly sealed cell re-evaluate exposure and open their lids if eligible.
5. **Row Clear Rule (Bottom-Up Only)**:
   - When all non-empty cell slots in a horizontal row become `'sealed'`, the row is cleared (`null`).
   - **Order Rule**: Lower rows must be cleared before upper rows can clear. A higher row cannot clear first and leave an empty space/gap between rows. Line clears scan from the bottom-most active row upwards and stop as soon as an unsealed row is encountered.
   - Cleared cells become unoccupied space, exposing adjacent cells above!
   - **Square Visible Board** (`getVisibleWindow` in `src/engine/exposure.ts`): in Play Test the board is always a square of `cols × cols` (8x8, 10x10, 15x15, ...). The window is anchored on the lowest row that still has cells, so when a bottom row clears, the rows above shift down into view. Rows above the window are not on the board yet: `findQualifyingSlots` ignores them, so cats only fly into cells currently visible on the board (this also applies to the Lose check).
6. **Cascade Check**:
   - Any parked box with remaining cats (or other parked boxes) can now immediately dispatch cats if newly exposed matching cells opened up!
   - Cascades loop automatically until no more parked boxes can dispatch.
7. **Empty Box Removal**:
   - When a box's counter hits `0`, it is removed from the parking slot, freeing the slot for future moves.

### D. Win & Lose Conditions
- **Win**:
  - All cat boxes in all queues have been sent (`queues.every(q => q.length === 0)`).
  - All parking slots are empty.
  - All flying cats have landed.
  - All cells on the grid are cleared.
- **Lose**:
  - All parking slots are occupied (all 5 slots full).
  - No cats in flight.
  - None of the colors of the parked boxes match any currently exposed slot on the grid.

---

## 4. Level Data Schema (`src/types/index.ts`)

```typescript
export type CellState = 'closed' | 'exposed' | 'sealed';

export interface CellData {
  color: string;       // Color ID: 'pink', 'blue', 'yellow', 'green', 'lime', 'brown', 'dark_brown', 'gray', etc.
  state?: CellState;   // Initial state override if desired
}

export interface CatBoxData {
  id: string;
  color: string;
  count: number;       // Number of cats (e.g. 10)
  isMystery?: boolean; // Displays '?' until reaching the front
}

export interface GridConfig {
  rows: number;
  cols: number;
  cells: (CellData | null)[][];
}

export interface LevelConfig {
  id: string;
  grid: GridConfig;
  parkingSlotsCount: number; // Default 5
  queues: CatBoxData[][];     // Queues of cat boxes (index 0 is front)
  settings?: {
    autoExposeRule?: boolean;
  };
}
```

### Example Level JSON File:
```json
{
  "id": "lvl-custom",
  "parkingSlotsCount": 5,
  "grid": {
    "rows": 3,
    "cols": 3,
    "cells": [
      [{"color": "pink"}, {"color": "blue"}, {"color": "pink"}],
      [{"color": "blue"}, null, {"color": "blue"}],
      [{"color": "pink"}, {"color": "blue"}, {"color": "pink"}]
    ]
  },
  "queues": [
    [
      {"id": "b1", "color": "pink", "count": 4},
      {"id": "b2", "color": "blue", "count": 4, "isMystery": true}
    ]
  ]
}
```

---

## 5. Codebase Architecture & Directory Map

```text
kitty-cat-level-builder/
├── index.html                 # App HTML wrapper with Google Fonts
├── package.json               # React, Vite, Tailwind CSS, Lucide icons, canvas-confetti
├── vite.config.ts             # Vite build configuration
├── tsconfig.json              # TypeScript compiler configuration
├── tailwind.config.js         # Tailwind themes and custom utilities
├── guide.md                   # THIS FILE (developer & AI continuity guide)
└── src/
    ├── main.tsx               # Application bootstrap
    ├── App.tsx                # App state, mode switcher (Design / PlayTest), LocalStorage persistence
    ├── index.css              # Global styling, keyframes (@keyframes shake), scrollbars
    ├── types/
    │   └── index.ts           # All domain types, level schema, and game state interfaces
    ├── engine/
    │   ├── palette.ts         # 8 vibrant game colors (Red, Blue, Green, Yellow, Pink, Orange, Brown, Cyan)
    │   ├── exposure.ts        # Pure functions for 1/4 side exposure rule & line clear detector
    │   └── gameEngine.ts      # Pure simulation engine: moves, cat dispatch, cascades, win/lose
    ├── audio/
    │   └── sound.ts           # Web Audio API synthesizer (pops, slides, meows, clears, fanfare)
    ├── data/
    │   └── premadeLevels.ts   # 10 rich premade levels (including Lv10 Snail Garden) & auto-balancer
    ├── editor/
    │   ├── LevelEditor.tsx    # Full suite: Brush, Bucket, Eraser, Eyedropper, Symmetry, Resizer
    │   ├── ColorBalanceWidget.tsx # Live HUD: cells needed vs cats provided, with 1-click Auto-Generator
    │   └── QueueEditor.tsx    # Visual editor for box queues, mystery toggles, and cat counts
    └── components/
        ├── PlayTest.tsx       # Authentic mobile game viewport, booster buttons, win/lose modals
        ├── CellView.tsx       # 3D block rendering: closed lid, open hollow slot, sealed paw print
        ├── CatBoxView.tsx     # 3D plastic carrier box with pill counter and front paw emblem
        ├── FlyingCat.tsx      # Parabolic animated cat swarm particle component
        ├── LevelSelector.tsx  # Preset dropdown with 10 built-in levels
        └── JsonModal.tsx      # Export to .json file / copy clipboard, Import from .json / paste
```

---

## 6. How to Implement New Features (Extension Guide)

### Adding a New Color to the Game
1. Open `src/engine/palette.ts`.
2. Add an entry to `COLOR_PALETTE` with `id`, `name`, `hex`, `light`, `dark`, and `rim`.
3. The editor palette, cell blocks, cat boxes, and balance validator will automatically adopt the new color without further modifications.

### Adding a New In-Game Booster / Power-up
1. Open `src/engine/gameEngine.ts`.
2. Write a pure state transformer function:
   ```typescript
   export function boosterSuperMeow(state: GameState): GameState { ... }
   ```
3. Open `src/components/PlayTest.tsx`.
4. Add a booster button to the action bar with an icon from `lucide-react`.
5. Call the transformer on click: `setGameState(prev => boosterSuperMeow(prev))`.

### Adding Special Obstacle Blocks (e.g. Ice, Locks, Crates)
1. Extend `CellData` in `src/types/index.ts` (e.g. `obstacle?: 'ice' | 'crate'`).
2. Update `src/components/CellView.tsx` to render an ice overlay or crate texture.
3. In `src/engine/gameEngine.ts`, update `dispatchCats` to decrement obstacle durability before sealing.

### Decoupling & Unit Testing
- The entire engine in `src/engine/` is decoupled from React DOM.
- Any AI agent or developer can write Jest / Vitest unit tests directly against `recalculateAllExposures`, `tapQueueBox`, `dispatchCats`, and `processLineClears` without mocking browser UI.

---

## 7. Built-in Levels Reference
The built-in levels are the 40 levels (ids `"1"`..`"40"`) from the **Level Data** tab of the Tank Top level data sheet, stored as one JSON array in `src/data/levels/sheetLevels.json` and exposed as `PREMADE_LEVELS` from `src/data/premadeLevels.ts`. To refresh them, re-export the sheet's Level column into that file. Levels that introduce a feature carry `unlockFeature` (`HiddenCell` on 5, `HiddenBox` on 10, `LockedCell` on 15).

---

## 8. GitHub Pages Deployment (`/docs` Folder)
The project is configured to build directly into the `/docs` folder with relative paths (`base: './'`) and a `.nojekyll` bypass file.

### How to Build and Host:
1. Run: `npm run build`
2. Push your repository to GitHub.
3. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` (or your active branch) and choose the **/docs** folder from the dropdown.
   - Click **Save**.
4. Your Kitty Cat Level Builder will be live at `https://<username>.github.io/<repo-name>/`!
 
---
 
## 9. Level Data List & Management
All levels are stored locally in the browser's persistent storage under `kitty_cat_level_list_v3`.
 
- **Built-in Levels**: The 40 sheet levels are automatically loaded on first launch.
- **Save / Override**: Updates the currently selected level in the level list with your latest editor canvas changes.
- **Save as New**: Prompts for a level name and saves your current canvas design as a new level.
- **Delete Level**: Removes the level from your list (with a safety prompt and guard against deleting the last remaining level).
- **Levels Modal**: Click the **Levels** button next to the dropdown in the header to view, search, duplicate, load, or delete any level, or click **Restore Defaults** to restore the built-in sheet levels anytime.
