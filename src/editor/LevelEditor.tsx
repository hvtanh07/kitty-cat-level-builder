import React, { useState, useRef, useCallback } from 'react';
import { LevelConfig, CellData, CatBoxData, CellState } from '../types';
import { COLOR_PALETTE, getColorDef } from '../engine/palette';
import { recalculateAllExposures, exposeBottomCells } from '../engine/exposure';
import { CellView } from '../components/CellView';
import { ColorBalanceWidget } from './ColorBalanceWidget';
import { QueueEditor } from './QueueEditor';
import {
  Paintbrush,
  Eraser,
  Pipette,
  PaintBucket,
  Square,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sliders,
  Play,
  Download,
  Upload,
  Image as ImageIcon,
  Columns,
  Trash2,
  Lock,
  Unlock
} from 'lucide-react';

interface LevelEditorProps {
  level: LevelConfig;
  onChange: (level: LevelConfig) => void;
  onPlayTest: () => void;
  onExport: () => void;
  onImport: () => void;
}

type EditorTool = 'brush' | 'bucket' | 'eraser' | 'picker' | 'rect';

export const LevelEditor: React.FC<LevelEditorProps> = ({
  level,
  onChange,
  onPlayTest,
  onExport,
  onImport
}) => {
  const [activeTool, setActiveTool] = useState<EditorTool>('brush');
  const [activeColor, setActiveColor] = useState<string>('pink');
  const [activeState, setActiveState] = useState<CellState>('closed');
  const [symmetryH, setSymmetryH] = useState<boolean>(false);
  const [symmetryV, setSymmetryV] = useState<boolean>(false);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  const [rectStart, setRectStart] = useState<{ r: number; c: number } | null>(null);

  const rows = level.grid.rows;
  const cols = level.grid.cols;

  // History for Undo inside editor
  const [editorHistory, setEditorHistory] = useState<(CellData | null)[][][]>([]);

  const pushHistory = (cells: (CellData | null)[][]) => {
    setEditorHistory(prev => [...prev.slice(-15), cells]);
  };

  const handleUndo = () => {
    if (editorHistory.length === 0) return;
    const prevCells = editorHistory[editorHistory.length - 1];
    setEditorHistory(prev => prev.slice(0, -1));
    onChange({
      ...level,
      grid: {
        ...level.grid,
        cells: prevCells
      }
    });
  };

  // Helper to clone grid
  const cloneGrid = (cells: (CellData | null)[][]): (CellData | null)[][] => {
    return cells.map(row => row.map(cell => (cell ? { ...cell } : null)));
  };

  // Update cell with symmetry support
  const applyPaintToCell = (
    grid: (CellData | null)[][],
    r: number,
    c: number,
    color: string | null,
    state: CellState
  ) => {
    const targets: [number, number][] = [[r, c]];

    if (symmetryH) {
      targets.push([r, cols - 1 - c]);
    }
    if (symmetryV) {
      targets.push([rows - 1 - r, c]);
    }
    if (symmetryH && symmetryV) {
      targets.push([rows - 1 - r, cols - 1 - c]);
    }

    targets.forEach(([tr, tc]) => {
      if (tr >= 0 && tr < rows && tc >= 0 && tc < cols) {
        if (color === null) {
          grid[tr][tc] = null;
        } else {
          grid[tr][tc] = { color, state };
        }
      }
    });
  };

  // Flood fill algorithm
  const floodFill = (startR: number, startC: number, newColor: string) => {
    pushHistory(level.grid.cells);
    const grid = cloneGrid(level.grid.cells);
    const targetCell = grid[startR][startC];
    const targetColor = targetCell ? targetCell.color : null;

    if (targetColor === newColor) return;

    const queue: [number, number][] = [[startR, startC]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [r, c] = queue.pop()!;
      const key = `${r}-${c}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const cell = grid[r][c];
      const currentColor = cell ? cell.color : null;

      if (currentColor === targetColor) {
        grid[r][c] = { color: newColor, state: activeState };

        const neighbors: [number, number][] = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1]
        ];
        for (const [nr, nc] of neighbors) {
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(`${nr}-${nc}`)) {
            queue.push([nr, nc]);
          }
        }
      }
    }

    const updated = recalculateAllExposures(grid, rows, cols);
    onChange({
      ...level,
      grid: { ...level.grid, cells: updated }
    });
  };

  // Handle cell click
  const handleCellClick = (r: number, c: number) => {
    if (activeTool === 'picker') {
      const cell = level.grid.cells[r][c];
      if (cell) {
        setActiveColor(cell.color);
        setActiveTool('brush');
      }
      return;
    }

    if (activeTool === 'bucket') {
      floodFill(r, c, activeColor);
      return;
    }

    if (activeTool === 'rect') {
      if (!rectStart) {
        setRectStart({ r, c });
      } else {
        pushHistory(level.grid.cells);
        const grid = cloneGrid(level.grid.cells);
        const minR = Math.min(rectStart.r, r);
        const maxR = Math.max(rectStart.r, r);
        const minC = Math.min(rectStart.c, c);
        const maxC = Math.max(rectStart.c, c);

        for (let rowIdx = minR; rowIdx <= maxR; rowIdx++) {
          for (let colIdx = minC; colIdx <= maxC; colIdx++) {
            grid[rowIdx][colIdx] = { color: activeColor, state: activeState };
          }
        }

        setRectStart(null);
        const updated = recalculateAllExposures(grid, rows, cols);
        onChange({
          ...level,
          grid: { ...level.grid, cells: updated }
        });
      }
      return;
    }

    // Brush or Eraser
    pushHistory(level.grid.cells);
    const grid = cloneGrid(level.grid.cells);
    const colorToApply = activeTool === 'eraser' ? null : activeColor;
    applyPaintToCell(grid, r, c, colorToApply, activeState);
    const updated = recalculateAllExposures(grid, rows, cols);
    onChange({
      ...level,
      grid: { ...level.grid, cells: updated }
    });
  };

  // Handle cell drag / hover
  const handleCellMouseEnter = (r: number, c: number) => {
    if (!isMouseDown) return;
    if (activeTool !== 'brush' && activeTool !== 'eraser') return;

    const grid = cloneGrid(level.grid.cells);
    const colorToApply = activeTool === 'eraser' ? null : activeColor;
    applyPaintToCell(grid, r, c, colorToApply, activeState);
    const updated = recalculateAllExposures(grid, rows, cols);
    onChange({
      ...level,
      grid: { ...level.grid, cells: updated }
    });
  };

  // Shift grid in 4 directions
  const shiftGrid = (dr: number, dc: number) => {
    pushHistory(level.grid.cells);
    const newGrid: (CellData | null)[][] = Array.from({ length: rows }, () =>
      Array(cols).fill(null)
    );

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          newGrid[nr][nc] = level.grid.cells[r][c];
        }
      }
    }

    const updated = recalculateAllExposures(newGrid, rows, cols);
    onChange({
      ...level,
      grid: { ...level.grid, cells: updated }
    });
  };

  // Resize grid
  const handleResize = (newRows: number, newCols: number) => {
    pushHistory(level.grid.cells);
    const newGrid: (CellData | null)[][] = Array.from({ length: newRows }, (_, r) =>
      Array.from({ length: newCols }, (_, c) => {
        return level.grid.cells[r]?.[c] || null;
      })
    );

    const updated = recalculateAllExposures(newGrid, newRows, newCols);
    onChange({
      ...level,
      grid: {
        rows: newRows,
        cols: newCols,
        cells: updated
      }
    });
  };

  // Clear all grid cells
  const handleClearGrid = () => {
    if (window.confirm('Clear all blocks from the grid?')) {
      pushHistory(level.grid.cells);
      const emptyGrid: (CellData | null)[][] = Array.from({ length: rows }, () =>
        Array(cols).fill(null)
      );
      onChange({
        ...level,
        grid: { ...level.grid, cells: emptyGrid }
      });
    }
  };

  // 1-Click Expose Bottom Row (matches screenshot design pattern)
  const handleExposeBottomRow = () => {
    pushHistory(level.grid.cells);
    const exposedGrid = exposeBottomCells(level.grid.cells, rows, cols);
    const updated = recalculateAllExposures(exposedGrid, rows, cols, true);
    onChange({
      ...level,
      grid: { ...level.grid, cells: updated }
    });
  };

  // Image to Level Importer (Converts uploaded image to grid)
  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, cols, rows);
      const imgData = ctx.getImageData(0, 0, cols, rows).data;

      pushHistory(level.grid.cells);
      const newGrid: (CellData | null)[][] = [];

      for (let r = 0; r < rows; r++) {
        const rowCells: (CellData | null)[] = [];
        for (let c = 0; c < cols; c++) {
          const idx = (r * cols + c) * 4;
          const rVal = imgData[idx];
          const gVal = imgData[idx + 1];
          const bVal = imgData[idx + 2];
          const aVal = imgData[idx + 3];

          if (aVal < 50) {
            rowCells.push(null);
          } else {
            // Find closest color in palette
            let closestColor = COLOR_PALETTE[0].id;
            let minDistance = Infinity;

            for (const colorDef of COLOR_PALETTE) {
              const hex = colorDef.hex.replace('#', '');
              const cr = parseInt(hex.substring(0, 2), 16);
              const cg = parseInt(hex.substring(2, 4), 16);
              const cb = parseInt(hex.substring(4, 6), 16);
              const dist =
                Math.pow(rVal - cr, 2) +
                Math.pow(gVal - cg, 2) +
                Math.pow(bVal - cb, 2);
              if (dist < minDistance) {
                minDistance = dist;
                closestColor = colorDef.id;
              }
            }

            rowCells.push({ color: closestColor, state: 'closed' });
          }
        }
        newGrid.push(rowCells);
      }

      const updated = recalculateAllExposures(newGrid, rows, cols);
      onChange({
        ...level,
        grid: { ...level.grid, cells: updated }
      });
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div
      onMouseDown={() => setIsMouseDown(true)}
      onMouseUp={() => setIsMouseDown(false)}
      className="flex flex-col gap-6 max-w-7xl mx-auto p-4 select-none"
    >
      {/* Top Header & Action Controls */}
      <div className="bg-white/80 backdrop-blur-sm border border-amber-900/20 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Level Name & Settings */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={level.name}
            onChange={e => onChange({ ...level, name: e.target.value })}
            className="text-lg font-black text-slate-800 bg-amber-50/50 border border-amber-900/20 rounded-xl px-3 py-1 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            placeholder="Level Name"
          />
          <select
            value={level.difficulty || 'Medium'}
            onChange={e =>
              onChange({
                ...level,
                difficulty: e.target.value as LevelConfig['difficulty']
              })
            }
            className="text-xs font-bold text-slate-700 bg-amber-50/50 border border-amber-900/20 rounded-xl px-2.5 py-1.5 focus:outline-none"
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
            <option value="Expert">Expert</option>
          </select>
          <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
            <span>Slots:</span>
            <input
              type="number"
              min={3}
              max={7}
              value={level.parkingSlotsCount || 5}
              onChange={e =>
                onChange({
                  ...level,
                  parkingSlotsCount: Math.max(3, Math.min(7, parseInt(e.target.value) || 5))
                })
              }
              className="w-12 px-1.5 py-1 text-center bg-amber-50/50 border border-amber-900/20 rounded-lg"
              title="Parking Slot Capacity"
            />
          </div>
        </div>

        {/* Action Buttons: Play Test, Export, Import */}
        <div className="flex items-center gap-2">
          <button
            onClick={onImport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-sm transition active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs shadow-sm transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          <button
            onClick={onPlayTest}
            className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black text-sm shadow-md transition active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Play Test</span>
          </button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Toolbar & Palette (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Drawing Tools Card */}
          <div className="bg-white/80 backdrop-blur-sm border border-amber-900/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <span className="text-xs font-extrabold text-slate-700">Design Tools</span>
            <div className="grid grid-cols-5 gap-1.5">
              <button
                onClick={() => setActiveTool('brush')}
                title="Brush: Click or drag to paint"
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'brush'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                }`}
              >
                <Paintbrush className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('bucket')}
                title="Paint Bucket: Flood fill region"
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'bucket'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                }`}
              >
                <PaintBucket className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('eraser')}
                title="Eraser: Remove block to void"
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'eraser'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                }`}
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('picker')}
                title="Eyedropper: Pick color from canvas"
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'picker'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                }`}
              >
                <Pipette className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setActiveTool('rect');
                  setRectStart(null);
                }}
                title="Rectangle: Click 2 points to fill box"
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'rect'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                }`}
              >
                <Square className="w-4 h-4" />
              </button>
            </div>

            {/* Symmetry Controls */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="font-bold text-slate-600">Symmetry Mirror:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSymmetryH(!symmetryH)}
                  className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] transition ${
                    symmetryH
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                  }`}
                >
                  Horiz
                </button>
                <button
                  onClick={() => setSymmetryV(!symmetryV)}
                  className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] transition ${
                    symmetryV
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                  }`}
                >
                  Vert
                </button>
              </div>
            </div>

            {/* Cell State Override */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="font-bold text-slate-600">Initial State:</span>
              <div className="flex items-center gap-1">
                {(['closed', 'exposed', 'sealed'] as CellState[]).map(st => (
                  <button
                    key={st}
                    onClick={() => setActiveState(st)}
                    className={`px-2 py-1 rounded-lg capitalize font-bold text-[10px] transition ${
                      activeState === st
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Expose Bottom Row Helper */}
            <button
              onClick={handleExposeBottomRow}
              title="Exposes bottom-most cell of each column (matching screenshot gameplay)"
              className="w-full mt-1 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-800" />
              <span>Expose Bottom Cells</span>
            </button>
          </div>

          {/* Color Palette Card */}
          <div className="bg-white/80 backdrop-blur-sm border border-amber-900/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <span className="text-xs font-extrabold text-slate-700">Color Palette</span>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PALETTE.map(c => {
                const isSelected = activeColor === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveColor(c.id);
                      if (activeTool === 'eraser') setActiveTool('brush');
                    }}
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: isSelected ? `0 0 0 3px white, 0 0 0 5px ${c.dark}` : undefined
                    }}
                    title={c.name}
                    className={`h-9 rounded-xl transition transform active:scale-90 relative ${
                      isSelected ? 'scale-105 z-10' : 'hover:scale-95'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Grid Transformers & Image Import Card */}
          <div className="bg-white/80 backdrop-blur-sm border border-amber-900/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <span className="text-xs font-extrabold text-slate-700">Grid Canvas Options</span>

            {/* Shift Grid */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Shift Canvas:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => shiftGrid(0, -1)}
                  className="p-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => shiftGrid(-1, 0)}
                  className="p-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => shiftGrid(1, 0)}
                  className="p-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => shiftGrid(0, 1)}
                  className="p-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Dimensions (Sliders) */}
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between font-bold text-slate-600">
                <span>Rows: {rows}</span>
                <span>Cols: {cols}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={6}
                  max={24}
                  value={rows}
                  onChange={e => handleResize(parseInt(e.target.value), cols)}
                  className="w-full accent-amber-600"
                />
                <input
                  type="range"
                  min={6}
                  max={24}
                  value={cols}
                  onChange={e => handleResize(rows, parseInt(e.target.value))}
                  className="w-full accent-amber-600"
                />
              </div>
            </div>

            {/* Image / Pixel Art Importer */}
            <label className="flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-900/15 cursor-pointer text-xs font-bold text-amber-950 transition active:scale-95">
              <ImageIcon className="w-3.5 h-3.5 text-amber-800" />
              <span>Convert Image to Grid</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageImport}
                className="hidden"
              />
            </label>

            {/* Clear & Undo Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleUndo}
                disabled={editorHistory.length === 0}
                className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs disabled:opacity-30 transition flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
              <button
                onClick={handleClearGrid}
                className="flex-1 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Grid Workspace (6 cols) */}
        <div className="lg:col-span-6 flex flex-col items-center gap-4">
          <div className="w-full p-4 rounded-3xl bg-[#452818] border-8 border-[#331c0e] shadow-[inset_0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-auto min-h-[460px]">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: '2px'
              }}
              className="justify-center items-center"
            >
              {level.grid.cells.map((row, r) =>
                row.map((cell, c) => {
                  const isSelected = rectStart?.r === r && rectStart?.c === c;
                  return (
                    <CellView
                      key={`editor-cell-${r}-${c}`}
                      cell={cell}
                      r={r}
                      c={c}
                      size={cols > 18 ? 20 : cols > 14 ? 24 : 28}
                      isEditor={true}
                      isSelected={isSelected}
                      onClick={() => handleCellClick(r, c)}
                      onMouseEnter={() => handleCellMouseEnter(r, c)}
                    />
                  );
                })
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 text-center font-medium">
            💡 Tip: Click or drag to draw. Use the paint bucket to flood fill. Hollow blocks represent exposed open lids!
          </div>
        </div>

        {/* Right Panel: Color Balance & Queues (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <ColorBalanceWidget
            level={level}
            onUpdateQueues={queues => onChange({ ...level, queues })}
          />
        </div>
      </div>

      {/* Bottom Queue Manager Panel */}
      <div className="w-full">
        <QueueEditor
          queues={level.queues}
          onChange={queues => onChange({ ...level, queues })}
        />
      </div>
    </div>
  );
};
