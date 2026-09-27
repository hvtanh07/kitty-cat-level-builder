import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LevelConfig, CellData, CatBoxData, CellState } from '../types';
import { COLOR_PALETTE, getColorDef } from '../engine/palette';
import { recalculateAllExposures, exposeBottomCells } from '../engine/exposure';
import { CellView } from '../components/CellView';
import { ColorBalanceWidget } from './ColorBalanceWidget';
import { QueueEditor } from './QueueEditor';
import { LevelListSidebar } from './LevelListSidebar';
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
  Unlock,
  Save,
  Copy,
  HelpCircle,
  Plus,
  Minus
} from 'lucide-react';

interface LevelEditorProps {
  level: LevelConfig;
  levels?: LevelConfig[];
  onChange: (level: LevelConfig) => void;
  onPlayTest: () => void;
  onExport: () => void;
  onImport: () => void;
  onSelectLevel?: (level: LevelConfig) => void;
  onOverrideLevel?: () => void;
  onSaveAsNewLevel?: (source?: LevelConfig) => void;
  onDeleteLevel?: (levelId?: string) => void;
  onResetToDefaults?: () => void;
  canDelete?: boolean;
}

type EditorTool = 'brush' | 'bucket' | 'eraser' | 'picker' | 'rect';
type PaintMode = 'color' | 'hidden' | 'lock';

export const LevelEditor: React.FC<LevelEditorProps> = ({
  level,
  levels,
  onChange,
  onPlayTest,
  onExport,
  onImport,
  onSelectLevel,
  onOverrideLevel,
  onSaveAsNewLevel,
  onDeleteLevel,
  onResetToDefaults,
  canDelete = true
}) => {
  const [activeTool, setActiveTool] = useState<EditorTool>('brush');
  const [paintMode, setPaintMode] = useState<PaintMode>('color');
  const [activeHiddenGroup, setActiveHiddenGroup] = useState<number>(1);
  const [activeLockCount, setActiveLockCount] = useState<number>(5);
  const [activeColor, setActiveColor] = useState<string>('pink');
  const [activeState, setActiveState] = useState<CellState>('closed');
  const [symmetryH, setSymmetryH] = useState<boolean>(false);
  const [symmetryV, setSymmetryV] = useState<boolean>(false);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  const [rectStart, setRectStart] = useState<{ r: number; c: number } | null>(null);

  const rows = level.grid.rows;
  const cols = level.grid.cols;

  const [rowInput, setRowInput] = useState<string>(String(rows));
  const [colInput, setColInput] = useState<string>(String(cols));

  useEffect(() => {
    setRowInput(String(rows));
  }, [rows]);

  useEffect(() => {
    setColInput(String(cols));
  }, [cols]);

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

  // Update cell with symmetry support and paint mode
  const applyPaintToCell = (
    grid: (CellData | null)[][],
    r: number,
    c: number
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
        if (paintMode === 'color') {
          if (activeTool === 'eraser') {
            grid[tr][tc] = null;
          } else {
            const existing = grid[tr][tc];
            grid[tr][tc] = {
              color: activeColor,
              state: activeState,
              hiddenGroup: existing?.hiddenGroup,
              lockCount: existing?.lockCount
            };
          }
        } else if (paintMode === 'hidden') {
          const existing = grid[tr][tc];
          if (activeTool === 'eraser') {
            if (existing) {
              const next = { ...existing };
              delete next.hiddenGroup;
              grid[tr][tc] = next;
            }
          } else {
            grid[tr][tc] = {
              ...(existing || { color: activeColor, state: activeState }),
              hiddenGroup: activeHiddenGroup
            };
          }
        } else if (paintMode === 'lock') {
          const existing = grid[tr][tc];
          if (activeTool === 'eraser') {
            if (existing) {
              const next = { ...existing };
              delete next.lockCount;
              grid[tr][tc] = next;
            }
          } else {
            grid[tr][tc] = {
              ...(existing || { color: activeColor, state: activeState }),
              lockCount: activeLockCount
            };
          }
        }
      }
    });
  };

  // Flood fill algorithm with support for colors, hidden groups, and locks
  const floodFill = (startR: number, startC: number) => {
    pushHistory(level.grid.cells);
    const grid = cloneGrid(level.grid.cells);
    const targetCell = grid[startR][startC];

    if (paintMode === 'color') {
      const targetColor = targetCell ? targetCell.color : null;
      if (targetColor === activeColor) return;

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
          const existing = grid[r][c];
          grid[r][c] = {
            color: activeColor,
            state: activeState,
            hiddenGroup: existing?.hiddenGroup,
            lockCount: existing?.lockCount
          };

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
    } else if (paintMode === 'hidden') {
      const targetGroup = targetCell?.hiddenGroup || 0;
      const newGroup = activeTool === 'eraser' ? 0 : activeHiddenGroup;
      if (targetGroup === newGroup) return;

      const queue: [number, number][] = [[startR, startC]];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const [r, c] = queue.pop()!;
        const key = `${r}-${c}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const cell = grid[r][c];
        if (!cell) continue;

        const currentGroup = cell.hiddenGroup || 0;
        if (currentGroup === targetGroup) {
          if (newGroup === 0) {
            delete cell.hiddenGroup;
          } else {
            cell.hiddenGroup = newGroup;
          }

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
    } else if (paintMode === 'lock') {
      const targetLock = targetCell?.lockCount || 0;
      const newLock = activeTool === 'eraser' ? 0 : activeLockCount;
      if (targetLock === newLock) return;

      const queue: [number, number][] = [[startR, startC]];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const [r, c] = queue.pop()!;
        const key = `${r}-${c}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const cell = grid[r][c];
        if (!cell) continue;

        const currentLock = cell.lockCount || 0;
        if (currentLock === targetLock) {
          if (newLock === 0) {
            delete cell.lockCount;
          } else {
            cell.lockCount = newLock;
          }

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
        if (paintMode === 'color') {
          setActiveColor(cell.color);
        } else if (paintMode === 'hidden') {
          if (cell.hiddenGroup) setActiveHiddenGroup(cell.hiddenGroup);
        } else if (paintMode === 'lock') {
          if (cell.lockCount) setActiveLockCount(cell.lockCount);
        }
        setActiveTool('brush');
      }
      return;
    }

    if (activeTool === 'bucket') {
      floodFill(r, c);
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
            if (paintMode === 'color') {
              const existing = grid[rowIdx][colIdx];
              grid[rowIdx][colIdx] = {
                color: activeColor,
                state: activeState,
                hiddenGroup: existing?.hiddenGroup,
                lockCount: existing?.lockCount
              };
            } else if (paintMode === 'hidden') {
              const existing = grid[rowIdx][colIdx];
              grid[rowIdx][colIdx] = {
                ...(existing || { color: activeColor, state: activeState }),
                hiddenGroup: activeHiddenGroup
              };
            } else if (paintMode === 'lock') {
              const existing = grid[rowIdx][colIdx];
              grid[rowIdx][colIdx] = {
                ...(existing || { color: activeColor, state: activeState }),
                lockCount: activeLockCount
              };
            }
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
    applyPaintToCell(grid, r, c);
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
    applyPaintToCell(grid, r, c);
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

  // Resize grid: add/remove rows from the top (anchoring existing blocks at the bottom)
  const handleResize = (newRows: number, newCols: number) => {
    const clampedRows = Math.max(1, Math.min(100, newRows));
    const clampedCols = Math.max(1, Math.min(100, newCols));
    if (clampedRows === rows && clampedCols === cols) return;

    pushHistory(level.grid.cells);
    const rowOffset = clampedRows - rows; // e.g. +2 when adding 2 rows, -2 when removing 2 rows

    const newGrid: (CellData | null)[][] = Array.from({ length: clampedRows }, (_, r) =>
      Array.from({ length: clampedCols }, (_, c) => {
        // Rows added/removed from top: existing rows are shifted by rowOffset
        const oldR = r - rowOffset;
        if (oldR >= 0 && oldR < rows && c < cols) {
          return level.grid.cells[oldR]?.[c] || null;
        }
        return null;
      })
    );

    const updated = recalculateAllExposures(newGrid, clampedRows, clampedCols);
    onChange({
      ...level,
      grid: {
        rows: clampedRows,
        cols: clampedCols,
        cells: updated
      }
    });
  };

  const handleRowInputChange = (valStr: string) => {
    setRowInput(valStr);
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val >= 1 && val <= 100 && val !== rows) {
      handleResize(val, cols);
    }
  };

  const handleRowInputBlur = () => {
    const val = parseInt(rowInput, 10);
    if (isNaN(val) || val < 1) {
      setRowInput(String(Math.max(1, rows)));
      if (rows < 1) handleResize(1, cols);
    } else if (val > 100) {
      setRowInput('100');
      if (rows !== 100) handleResize(100, cols);
    } else if (val !== rows) {
      handleResize(val, cols);
    }
  };

  const handleColInputChange = (valStr: string) => {
    setColInput(valStr);
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val >= 1 && val <= 100 && val !== cols) {
      handleResize(rows, val);
    }
  };

  const handleColInputBlur = () => {
    const val = parseInt(colInput, 10);
    if (isNaN(val) || val < 1) {
      setColInput(String(Math.max(1, cols)));
      if (cols < 1) handleResize(rows, 1);
    } else if (val > 100) {
      setColInput('100');
      if (cols !== 100) handleResize(rows, 100);
    } else if (val !== cols) {
      handleResize(rows, val);
    }
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
        {/* Level ID & Settings */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-amber-50/50 border border-amber-900/20 rounded-xl px-3 py-1.5 shadow-xs">
            <span className="text-[11px] font-black text-amber-900/60 uppercase tracking-wider">Level ID:</span>
            <input
              type="text"
              value={level.id}
              onChange={e => onChange({ ...level, id: e.target.value })}
              className="text-sm font-mono font-black text-slate-800 bg-transparent focus:outline-none min-w-[140px]"
              placeholder="level-id"
            />
          </div>
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

        {/* Action Buttons: Override, Save as New, Delete, Import, Export, Play Test */}
        <div className="flex flex-wrap items-center gap-2">
          {onOverrideLevel && (
            <button
              onClick={onOverrideLevel}
              title="Override and save current edits to this level"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm transition active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Override</span>
            </button>
          )}

          {onSaveAsNewLevel && (
            <button
              onClick={() => onSaveAsNewLevel()}
              title="Save current canvas as a brand new level"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs border border-amber-900/15 shadow-sm transition active:scale-95"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Save as New</span>
            </button>
          )}

          {onDeleteLevel && (
            <button
              onClick={() => onDeleteLevel()}
              disabled={!canDelete}
              title={!canDelete ? 'Cannot delete the last remaining level' : 'Delete this level'}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 shadow-sm transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}

          <div className="h-5 w-px bg-amber-900/20 mx-0.5 hidden sm:block" />

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
        {/* Left Column (3 cols): Level Data List Management & Color Balance Validator */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Level Data List Management (shows the whole list of levels) */}
          {levels && levels.length > 0 && onSelectLevel && onOverrideLevel && onDeleteLevel && (
            <LevelListSidebar
              levels={levels}
              currentLevelId={level.id}
              onSelectLevel={onSelectLevel}
              onSaveAsNew={onSaveAsNewLevel || (() => {})}
              onOverrideCurrent={onOverrideLevel}
              onDeleteLevel={onDeleteLevel}
              onResetToDefaults={onResetToDefaults || (() => {})}
            />
          )}

          {/* Color Balance Validator (placed at previous Level Data List position) */}
          <ColorBalanceWidget
            level={level}
            onUpdateQueues={queues => onChange({ ...level, queues })}
          />
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
                      size={Math.max(10, Math.min(28, Math.floor(520 / Math.max(cols, rows))))}
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

        {/* Right Column (3 cols): Grid Canvas Options (ON TOP) & Design Tools + Color Palette (BELOW) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* 1. Grid Canvas Options (PLACED ON TOP) */}
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

            {/* Dimensions (Text Boxes with Steppers) */}
            <div className="flex flex-col gap-2 text-xs">
              <span className="font-extrabold text-slate-700">Grid Dimensions:</span>
              <div className="grid grid-cols-2 gap-2">
                {/* Rows Input */}
                <div className="flex flex-col gap-1 bg-amber-50/70 p-2 rounded-xl border border-amber-900/15">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-amber-950 uppercase">Rows</span>
                    <span className="text-[10px] text-slate-400 font-semibold">(1-100)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleResize(Math.max(1, rows - 1), cols)}
                      title="Decrease Rows (removes row from top)"
                      className="p-1 rounded bg-white hover:bg-amber-100 text-amber-950 border border-amber-900/20 active:scale-95 transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={rowInput}
                      onChange={e => handleRowInputChange(e.target.value)}
                      onBlur={handleRowInputBlur}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRowInputBlur();
                      }}
                      className="w-full py-1 text-center font-black text-xs text-amber-950 bg-white border border-amber-900/20 rounded-lg shadow-inner focus:outline-amber-600"
                    />
                    <button
                      onClick={() => handleResize(Math.min(100, rows + 1), cols)}
                      title="Increase Rows (adds row to top)"
                      className="p-1 rounded bg-white hover:bg-amber-100 text-amber-950 border border-amber-900/20 active:scale-95 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cols Input */}
                <div className="flex flex-col gap-1 bg-amber-50/70 p-2 rounded-xl border border-amber-900/15">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-amber-950 uppercase">Cols</span>
                    <span className="text-[10px] text-slate-400 font-semibold">(1-100)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleResize(rows, Math.max(1, cols - 1))}
                      title="Decrease Columns"
                      className="p-1 rounded bg-white hover:bg-amber-100 text-amber-950 border border-amber-900/20 active:scale-95 transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={colInput}
                      onChange={e => handleColInputChange(e.target.value)}
                      onBlur={handleColInputBlur}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleColInputBlur();
                      }}
                      className="w-full py-1 text-center font-black text-xs text-amber-950 bg-white border border-amber-900/20 rounded-lg shadow-inner focus:outline-amber-600"
                    />
                    <button
                      onClick={() => handleResize(rows, Math.min(100, cols + 1))}
                      title="Increase Columns"
                      className="p-1 rounded bg-white hover:bg-amber-100 text-amber-950 border border-amber-900/20 active:scale-95 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
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

          {/* 2. Design Tools Combined with Mode Options & Palette */}
          <div className="bg-white/80 backdrop-blur-sm border border-amber-900/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            {/* Mode Switcher Tabs */}
            <div className="flex rounded-xl bg-amber-950/10 p-1 gap-1">
              <button
                onClick={() => setPaintMode('color')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 transition ${
                  paintMode === 'color'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-950 hover:bg-white/60'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>Color</span>
              </button>
              <button
                onClick={() => setPaintMode('hidden')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 transition ${
                  paintMode === 'hidden'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'text-purple-950 hover:bg-white/60'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Hidden</span>
              </button>
              <button
                onClick={() => setPaintMode('lock')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 transition ${
                  paintMode === 'lock'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-800 hover:bg-white/60'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Locked</span>
              </button>
            </div>

            {/* Common Tools: Brush, Bucket, Eraser, Eyedropper, Rect */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700">
                {paintMode === 'color'
                  ? 'Drawing Tools'
                  : paintMode === 'hidden'
                  ? 'Hidden Cell Painter'
                  : 'Lock Painter'}
              </span>
              <span className="text-[10px] font-bold text-slate-400 capitalize">
                Tool: {activeTool}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              <button
                onClick={() => setActiveTool('brush')}
                title={
                  paintMode === 'color'
                    ? 'Brush: Paint color'
                    : paintMode === 'hidden'
                    ? `Brush: Tag with Hidden Group ${activeHiddenGroup}`
                    : `Brush: Tag with Lock Count ${activeLockCount}`
                }
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'brush'
                    ? paintMode === 'color'
                      ? 'bg-amber-600 text-white shadow'
                      : paintMode === 'hidden'
                      ? 'bg-purple-700 text-white shadow'
                      : 'bg-slate-800 text-white shadow'
                    : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                }`}
              >
                <Paintbrush className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('bucket')}
                title={
                  paintMode === 'color'
                    ? 'Paint Bucket: Flood fill color'
                    : paintMode === 'hidden'
                    ? `Paint Bucket: Flood fill Hidden Group ${activeHiddenGroup}`
                    : `Paint Bucket: Flood fill Lock Count ${activeLockCount}`
                }
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'bucket'
                    ? paintMode === 'color'
                      ? 'bg-amber-600 text-white shadow'
                      : paintMode === 'hidden'
                      ? 'bg-purple-700 text-white shadow'
                      : 'bg-slate-800 text-white shadow'
                    : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                }`}
              >
                <PaintBucket className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('eraser')}
                title={
                  paintMode === 'color'
                    ? 'Eraser: Remove block to empty'
                    : paintMode === 'hidden'
                    ? 'Eraser: Remove hidden group tag'
                    : 'Eraser: Remove lock from block'
                }
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'eraser'
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-amber-50 text-slate-700 hover:bg-amber-100'
                }`}
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('picker')}
                title={
                  paintMode === 'color'
                    ? 'Eyedropper: Pick color from canvas'
                    : paintMode === 'hidden'
                    ? 'Eyedropper: Pick hidden group from canvas'
                    : 'Eyedropper: Pick lock count from canvas'
                }
                className={`p-2.5 rounded-xl flex items-center justify-center transition ${
                  activeTool === 'picker'
                    ? paintMode === 'color'
                      ? 'bg-amber-600 text-white shadow'
                      : paintMode === 'hidden'
                      ? 'bg-purple-700 text-white shadow'
                      : 'bg-slate-800 text-white shadow'
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
                    ? paintMode === 'color'
                      ? 'bg-amber-600 text-white shadow'
                      : paintMode === 'hidden'
                      ? 'bg-purple-700 text-white shadow'
                      : 'bg-slate-800 text-white shadow'
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

            {/* Mode-Specific Sub-Panel */}
            {paintMode === 'color' && (
              <>
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

                {/* Combined Color Palette */}
                <div className="pt-2 border-t border-amber-900/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                      Active Color:
                    </span>
                    <span className="text-xs font-black text-amber-950 capitalize">
                      {getColorDef(activeColor).name}
                    </span>
                  </div>
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
                            boxShadow: isSelected
                              ? `0 0 0 3px white, 0 0 0 5px ${c.dark}`
                              : undefined
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
              </>
            )}

            {paintMode === 'hidden' && (
              <div className="pt-2 border-t border-purple-900/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-purple-950 uppercase tracking-wider">
                    Hidden Group ID:
                  </span>
                  <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                    Group {activeHiddenGroup}
                  </span>
                </div>

                {/* Group Selector Quick Buttons */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map(grp => (
                    <button
                      key={grp}
                      onClick={() => {
                        setActiveHiddenGroup(grp);
                        if (activeTool === 'eraser') setActiveTool('brush');
                      }}
                      className={`py-1.5 rounded-lg font-black text-xs transition ${
                        activeHiddenGroup === grp && activeTool !== 'eraser'
                          ? 'bg-purple-700 text-white shadow'
                          : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
                      }`}
                    >
                      G{grp}
                    </button>
                  ))}
                </div>

                {/* Number Stepper */}
                <div className="flex items-center justify-between bg-purple-50/70 p-2 rounded-xl border border-purple-200">
                  <span className="text-xs font-bold text-purple-900">Custom Group #:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setActiveHiddenGroup(prev => Math.max(1, prev - 1))
                      }
                      className="p-1 rounded bg-white hover:bg-purple-100 text-purple-900 border border-purple-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={activeHiddenGroup}
                      onChange={e =>
                        setActiveHiddenGroup(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-12 py-0.5 text-center font-black text-xs text-purple-900 bg-white border border-purple-200 rounded"
                    />
                    <button
                      onClick={() => setActiveHiddenGroup(prev => prev + 1)}
                      className="p-1 rounded bg-white hover:bg-purple-100 text-purple-900 border border-purple-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Clear Hidden Group Tag Button */}
                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`w-full py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                    activeTool === 'eraser'
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-purple-100/70 hover:bg-purple-200 text-purple-950'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Remove Hidden Tag (Eraser)</span>
                </button>

                {/* Mechanics Info */}
                <div className="bg-purple-50 border border-purple-200/80 rounded-xl p-2.5 text-[11px] text-purple-950 flex flex-col gap-1 leading-snug">
                  <div className="font-extrabold flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
                    <span>Hidden Group Logic:</span>
                  </div>
                  <p className="text-purple-900/80">
                    • In Play Test, hidden cells conceal their color.
                  </p>
                  <p className="text-purple-900/80">
                    • When <b>any cell</b> in a group touches a <b>sealed cell</b>, the entire group reveals together!
                  </p>
                </div>
              </div>
            )}

            {paintMode === 'lock' && (
              <div className="pt-2 border-t border-slate-900/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                    Required Seals:
                  </span>
                  <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-600" />
                    {activeLockCount} Seals
                  </span>
                </div>

                {/* Presets */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[3, 5, 8, 10, 15].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => {
                        setActiveLockCount(cnt);
                        if (activeTool === 'eraser') setActiveTool('brush');
                      }}
                      className={`py-1.5 rounded-lg font-black text-xs transition ${
                        activeLockCount === cnt && activeTool !== 'eraser'
                          ? 'bg-slate-800 text-white shadow'
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>

                {/* Number Stepper */}
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">Seals Count:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setActiveLockCount(prev => Math.max(1, prev - 1))
                      }
                      className="p-1 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={activeLockCount}
                      onChange={e =>
                        setActiveLockCount(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-12 py-0.5 text-center font-black text-xs text-slate-900 bg-white border border-slate-200 rounded"
                    />
                    <button
                      onClick={() => setActiveLockCount(prev => prev + 1)}
                      className="p-1 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Clear Lock Button */}
                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`w-full py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                    activeTool === 'eraser'
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Remove Lock (Eraser)</span>
                </button>

                {/* Mechanics Info */}
                <div className="bg-slate-100 border border-slate-200/80 rounded-xl p-2.5 text-[11px] text-slate-800 flex flex-col gap-1 leading-snug">
                  <div className="font-extrabold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Locked Cell Logic:</span>
                  </div>
                  <p className="text-slate-700">
                    • Locked cells will not open or become exposed.
                  </p>
                  <p className="text-slate-700">
                    • Every sealed cell decrements the countdown.
                  </p>
                  <p className="text-slate-700">
                    • When count reaches 0, the lock breaks open!
                  </p>
                </div>
              </div>
            )}
          </div>
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
