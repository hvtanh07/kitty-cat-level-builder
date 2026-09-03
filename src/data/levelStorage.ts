import { LevelConfig } from '../types';
import { PREMADE_LEVELS } from './premadeLevels';
import { COLOR_PALETTE, getColorDef } from '../engine/palette';

export const LEVEL_LIST_STORAGE_KEY = 'kitty_cat_level_list_v1';
export const ACTIVE_LEVEL_ID_KEY = 'kitty_cat_active_level_id_v1';

/**
 * Ensures all cells and boxes in a level conform to the active 8-color palette.
 */
export function sanitizeLevel(lvl: LevelConfig): LevelConfig {
  const allowedColors = new Set(COLOR_PALETTE.map(c => c.id));
  const sanitizedCells = lvl.grid.cells.map(row =>
    row.map(cell => {
      if (!cell) return null;
      if (allowedColors.has(cell.color)) return cell;
      const mapped = getColorDef(cell.color).id;
      return { ...cell, color: allowedColors.has(mapped) ? mapped : 'pink' };
    })
  );
  const sanitizedQueues = lvl.queues.map(queue =>
    queue.map(box => {
      if (allowedColors.has(box.color)) return box;
      const mapped = getColorDef(box.color).id;
      return { ...box, color: allowedColors.has(mapped) ? mapped : 'pink' };
    })
  );
  return {
    ...lvl,
    grid: {
      ...lvl.grid,
      cells: sanitizedCells
    },
    queues: sanitizedQueues
  };
}

/**
 * Loads the complete level data list. If none exists in localStorage,
 * initializes with all 10 premade levels.
 */
export function loadLevelList(): LevelConfig[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return JSON.parse(JSON.stringify(PREMADE_LEVELS));
  }

  try {
    const raw = window.localStorage.getItem(LEVEL_LIST_STORAGE_KEY);
    if (raw) {
      const parsed: LevelConfig[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(lvl => sanitizeLevel(lvl));
      }
    }
  } catch (err) {
    console.warn('Failed to load level list from localStorage, falling back to presets', err);
  }

  // Initialize with premade levels
  const defaults: LevelConfig[] = JSON.parse(JSON.stringify(PREMADE_LEVELS));
  saveLevelList(defaults);
  return defaults;
}

/**
 * Persists the level data list to localStorage.
 */
export function saveLevelList(levels: LevelConfig[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LEVEL_LIST_STORAGE_KEY, JSON.stringify(levels));
  } catch (err) {
    console.error('Failed to save level list to localStorage', err);
  }
}

/**
 * Overrides / updates an existing level in the list with current changes.
 * If the level is not found, appends it.
 */
export function overrideLevel(
  levels: LevelConfig[],
  currentLevel: LevelConfig
): LevelConfig[] {
  const sanitized = sanitizeLevel(JSON.parse(JSON.stringify(currentLevel)));
  const index = levels.findIndex(l => l.id === sanitized.id);

  let updated: LevelConfig[];
  if (index >= 0) {
    updated = [...levels];
    updated[index] = sanitized;
  } else {
    updated = [...levels, sanitized];
  }

  saveLevelList(updated);
  return updated;
}

/**
 * Saves the current level design as a new level with a unique ID and custom name.
 */
export function saveAsNewLevel(
  levels: LevelConfig[],
  currentLevel: LevelConfig,
  customName?: string
): { updatedLevels: LevelConfig[]; newLevel: LevelConfig } {
  const newId = `lvl-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const levelName = customName?.trim() || `${currentLevel.name} (Copy)`;

  const newLevel: LevelConfig = {
    ...JSON.parse(JSON.stringify(currentLevel)),
    id: newId,
    name: levelName
  };

  const sanitized = sanitizeLevel(newLevel);
  const updatedLevels = [...levels, sanitized];
  saveLevelList(updatedLevels);

  return { updatedLevels, newLevel: sanitized };
}

/**
 * Deletes a level by ID from the list. If it was the last level,
 * restores a default level so the game always has at least 1 playable level.
 */
export function deleteLevel(
  levels: LevelConfig[],
  levelId: string
): { updatedLevels: LevelConfig[]; nextLevel: LevelConfig } {
  const targetIndex = levels.findIndex(l => l.id === levelId);
  const filtered = levels.filter(l => l.id !== levelId);

  if (filtered.length === 0) {
    const defaults = JSON.parse(JSON.stringify(PREMADE_LEVELS));
    saveLevelList(defaults);
    return { updatedLevels: defaults, nextLevel: defaults[0] };
  }

  // Pick adjacent level (same index or previous)
  const nextIndex = Math.min(Math.max(0, targetIndex), filtered.length - 1);
  const nextLevel = filtered[nextIndex];

  saveLevelList(filtered);
  return { updatedLevels: filtered, nextLevel };
}

/**
 * Resets the level list back to the default 10 premade levels.
 */
export function resetToDefaultLevels(): LevelConfig[] {
  const defaults: LevelConfig[] = JSON.parse(JSON.stringify(PREMADE_LEVELS));
  saveLevelList(defaults);
  return defaults;
}
