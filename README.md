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
- **10 Premade Levels Built-in**:
  1. **Level 1 - Snail Garden**: Exact Lv10 snail art from the screenshot.
  2. **Level 2 - Playful Kitty**: Cat face with ears and collar.
  3. **Level 3 - Pixel Heart**: Shaded red heart mosaic.
  4. **Level 4 - Rainbow Butterfly**: Symmetrical winged butterfly.
  5. **Level 5 - Rubber Ducky**: Yellow duck floating on water ripples.
  6. **Level 6 - Retro Gamepad**: Classic gaming controller with D-pad.
  7. **Level 7 - Sweet Strawberry**: Red strawberry with seed dots.
  8. **Level 8 - Gentleman Penguin**: Penguin with bow tie.
  9. **Level 9 - Sunflower Blossom**: Floral mosaic.
  10. **Level 10 - Cosmic Rocket**: Space shuttle blasting off.

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
