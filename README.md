# 🐱 Kitty Cat Level Builder & Play Test Engine

A visual level builder and play-testing simulator inspired by the casual mobile puzzle game where colorful cats swarm from carrier boxes to matching exposed slots on a grid.

![Gameplay Reference](C:/Users/DGVN-TUANANH/.gemini/antigravity/brain/2a960ef5-e739-41b2-9a07-609b7cbe2109/.user_uploaded/media_1788421848928.png)

## ✨ Key Features

- **Full Equipment Level Editor**:
  - Pixel art canvas with Brush, Flood Fill (Bucket), Eraser, Eyedropper, Rectangle fill, and Symmetry Mirroring (Horizontal & Vertical).
  - 12 vibrant game colors matching the authentic toy aesthetic.
  - Image to Level converter: upload any image to automatically convert it into colored grid blocks!
  - Grid resizing (5x5 to 25x25), shifting (Up/Down/Left/Right), and clear/invert tools.
  - 1-Click "Expose Bottom Row" button.
- **Visual Cat Box Queue Designer**:
  - Configure 2 to 6 queues of boxes with custom cat counts and mystery (`?`) box toggles.
  - Live **Color Balance Validator**: checks required cells vs. queued cats per color.
  - 1-Click **"Auto-Generate Balanced Queues"** button to automatically guarantee level solvability!
- **Play Test Mode**:
  - Faithful mobile viewport with 3D wooden tray and plastic toy boxes.
  - Complete game mechanics: tap to park, reject shake on full (5 slots), swarm cat dispatch along parabolic trajectories, lid-closing paw stamp seal, adjacent lid exposure triggers, full-row clearing, and Win/Lose detection.
  - In-game boosters: Undo Move, Shuffle Front Boxes, Broom Clear.
  - Variable simulation speeds: 1x, 1.5x, 2x.
  - Synthesized sound effects (Web Audio API) with mute toggle.
- **Export / Import**:
  - Export level to `.json` file and 1-click "Copy to Clipboard".
  - Import level from file upload or paste JSON text.
  - LocalStorage auto-save: preserves edits across browser reloads.
- **40 Built-in Levels** from the Tank Top level data sheet (`src/data/levels/sheetLevels.json`).
- **Square Play Test Board**: the board is always `cols × cols` (8x8, 10x10, 15x15, ...); rows above it shift down as bottom rows clear, and cats only fly into cells currently on the board.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
# Open http://localhost:3000

# Build for production
npm run build
```

## 📖 Cross-PC Continuity & AI Agent Documentation

For detailed technical specifications, game logic state machine rules, JSON contracts, and instructions for future AI agents to continue developing on another PC, please read **[`guide.md`](./guide.md)**.

## 🤖 Bot Play Test

Headless bots play every level with the same engine as Play Test (`src/engine/`), so you can see how hard each level is for different kinds of players.

```bash
npm run playtest:bots                       # all 40 levels, full run count (~30-40 min)
npm run playtest:bots -- --levels 10-20     # a range
npm run playtest:bots -- --scale 0.2        # fewer games per bot (quick check)
npm run playtest:bots -- --bots greedy,master
```

Results go to `bot-report/results.json` (per level × bot) and `bot-report/games.csv` (one line per game).

| Bot | Play style |
| --- | --- |
| T1 Random | Taps a random queue, ignores colors |
| T2 Lazy one-lane | Always taps the first queue that still has boxes |
| T3 Novice | 70% taps the box that releases the most cats now, 30% random |
| T4 Greedy | Always taps the box that releases the most cats now |
| T5 Planner (2-step) | Looks 2 taps ahead using only visible boxes, scores the board |
| T6 Deep planner (3-step) | Same, 3 taps ahead |
| T7 Master | Monte Carlo: guesses mystery box colors from the cells still missing, plays each option to the end, picks the most winning one |
| Solver | Searches every tap order and peeks at mystery boxes: answers "can this level be won at all?" |

Bots wait for all cats to land after each tap (no tapping while cats are flying) and use no boosters. Bots T1–T7 never see the color of a mystery box before it reaches the front.
