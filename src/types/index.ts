export type CellState = 'closed' | 'exposed' | 'sealed';

export interface CellData {
  id?: string;
  color: string; // Color identifier from palette (e.g. 'pink', 'blue', 'yellow', 'green', 'lime', 'brown', 'dark_brown', 'gray', 'orange', 'purple')
  state?: CellState; // Override initial state if needed, otherwise calculated
}

export interface CatBoxData {
  id: string;
  color: string;
  count: number; // Number of cats inside this box
  isMystery?: boolean; // Displays '?' until it becomes the front box
}

export interface GridConfig {
  rows: number;
  cols: number;
  cells: (CellData | null)[][]; // null = empty/void cell
}

export interface LevelConfig {
  id: string;
  author?: string;
  grid: GridConfig;
  parkingSlotsCount: number; // Number of parking slots (default 5)
  queues: CatBoxData[][]; // Array of queues (each queue is a stack/list of CatBoxData, index 0 is front)
  settings?: {
    autoExposeRule?: boolean; // Default true: 1/4 side exposure rule
  };
}

export interface ParkedBox extends CatBoxData {
  slotIndex: number;
  isDispatching?: boolean;
}

export interface FlyingCat {
  id: string;
  color: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  targetRow: number;
  targetCol: number;
  progress: number; // 0 to 1
}

export interface GameStats {
  moves: number;
  catsDispatched: number;
  linesCleared: number;
  startTime: number;
  endTime?: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';
