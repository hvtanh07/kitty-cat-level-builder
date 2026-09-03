import {
  loadLevelList,
  saveLevelList,
  overrideLevel,
  saveAsNewLevel,
  deleteLevel,
  resetToDefaultLevels
} from './data/levelStorage';
import { PREMADE_LEVELS } from './data/premadeLevels';

// Mock localStorage for Node environment
const mockStorage: Record<string, string> = {};
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; }
  }
};

console.log('=== Running Level Storage Unit Tests ===');

// Test 1: Initial Load contains 10 premade levels
let levels = loadLevelList();
if (levels.length === 10) {
  console.log('✓ Initial load initialized exactly 10 premade levels');
} else {
  throw new Error(`Expected 10 levels, got ${levels.length}`);
}

// Test 2: Save as New Level
const baseLevel = levels[0];
const { updatedLevels: afterNew, newLevel } = saveAsNewLevel(levels, baseLevel, 'My Custom Fun Level');
if (afterNew.length === 11 && newLevel.name === 'My Custom Fun Level' && newLevel.id !== baseLevel.id) {
  console.log('✓ Save as New Level correctly appended a new unique level (11 total)');
} else {
  throw new Error(`Failed to save as new level: ${afterNew.length}`);
}

// Test 3: Override Level
const modifiedLevel = {
  ...newLevel,
  name: 'My Custom Fun Level - Overridden!'
};
const afterOverride = overrideLevel(afterNew, modifiedLevel);
const found = afterOverride.find(l => l.id === newLevel.id);
if (afterOverride.length === 11 && found && found.name === 'My Custom Fun Level - Overridden!') {
  console.log('✓ Override Level correctly updated target level properties');
} else {
  throw new Error('Failed to override level');
}

// Test 4: Delete Level
const { updatedLevels: afterDelete, nextLevel } = deleteLevel(afterOverride, newLevel.id);
if (afterDelete.length === 10 && !afterDelete.some(l => l.id === newLevel.id) && nextLevel) {
  console.log('✓ Delete Level successfully removed target level (back to 10 total)');
} else {
  throw new Error(`Failed to delete level: ${afterDelete.length}`);
}

// Test 5: Reset to Default Levels
const resetLevels = resetToDefaultLevels();
if (resetLevels.length === 10 && resetLevels[0].id === PREMADE_LEVELS[0].id) {
  console.log('✓ Reset to Default Levels restored original 10 premade levels');
} else {
  throw new Error('Failed to reset default levels');
}

console.log('=== All Level Storage Tests Passed Successfully! ===');
