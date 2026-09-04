import React, { useState, useEffect } from 'react';
import { LevelConfig } from './types';
import { PREMADE_LEVELS } from './data/premadeLevels';
import {
  loadLevelList,
  saveLevelList,
  overrideLevel,
  saveAsNewLevel,
  deleteLevel,
  resetToDefaultLevels,
  sanitizeLevel,
  ACTIVE_LEVEL_ID_KEY
} from './data/levelStorage';
import { LevelEditor } from './editor/LevelEditor';
import { PlayTest } from './components/PlayTest';
import { LevelSelector } from './components/LevelSelector';
import { LevelListModal } from './components/LevelListModal';
import { JsonModal } from './components/JsonModal';
import { Paintbrush, Play, Plus, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'kitty_cat_level_builder_state_v16';

export const App: React.FC = () => {
  // Load persistent level list (initialized with 10 premade levels)
  const [levelList, setLevelList] = useState<LevelConfig[]>(() => loadLevelList());

  // Current level state
  const [currentLevel, setCurrentLevel] = useState<LevelConfig>(() => {
    const list = loadLevelList();
    try {
      const activeId = localStorage.getItem(ACTIVE_LEVEL_ID_KEY);
      if (activeId) {
        const found = list.find(l => l.id === activeId);
        if (found) return JSON.parse(JSON.stringify(found));
      }
    } catch {
      // Fallback
    }
    return JSON.parse(JSON.stringify(list[0] || PREMADE_LEVELS[0]));
  });

  const [mode, setMode] = useState<'editor' | 'playtest'>('editor');
  const [isLevelListModalOpen, setIsLevelListModalOpen] = useState(false);
  const [jsonModalState, setJsonModalState] = useState<{
    isOpen: boolean;
    mode: 'export' | 'import';
  }>({
    isOpen: false,
    mode: 'export'
  });

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Save active level ID to localStorage whenever currentLevel changes
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_LEVEL_ID_KEY, currentLevel.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentLevel));
    } catch {
      // ignore
    }
  }, [currentLevel]);

  // Select level
  const handleSelectLevel = (lvl: LevelConfig) => {
    const cloned: LevelConfig = JSON.parse(JSON.stringify(lvl));
    setCurrentLevel(sanitizeLevel(cloned));
  };

  // Override current level in the level list
  const handleOverrideLevel = () => {
    const updated = overrideLevel(levelList, currentLevel);
    setLevelList(updated);
    showToast(`Level "${currentLevel.id}" overridden & saved!`, 'success');
  };

  // Save current design as a new level
  const handleSaveAsNew = (source?: LevelConfig, customId?: string) => {
    const target = source || currentLevel;
    let chosenId = customId;

    if (!chosenId) {
      const promptRes = window.prompt(
        'Enter ID for the new level:',
        `${target.id}-copy`
      );
      if (promptRes === null) return; // Cancelled
      chosenId = promptRes.trim() || `${target.id}-copy`;
    }

    const { updatedLevels, newLevel } = saveAsNewLevel(levelList, target, chosenId);
    setLevelList(updatedLevels);
    setCurrentLevel(newLevel);
    setMode('editor');
    showToast(`New level "${newLevel.id}" created & saved!`, 'success');
  };

  // Delete level
  const handleDeleteLevel = (targetId?: string) => {
    const idToDelete = targetId || currentLevel.id;
    const target = levelList.find(l => l.id === idToDelete);
    if (!target) return;

    if (levelList.length <= 1) {
      showToast('Cannot delete the last remaining level.', 'error');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete "${target.id}"?`);
    if (!confirmed) return;

    const { updatedLevels, nextLevel } = deleteLevel(levelList, idToDelete);
    setLevelList(updatedLevels);
    if (currentLevel.id === idToDelete) {
      setCurrentLevel(nextLevel);
    }
    showToast(`Level "${target.id}" deleted.`, 'info');
  };

  // Reset to default 10 premade levels
  const handleResetToDefaults = () => {
    const defaults = resetToDefaultLevels();
    setLevelList(defaults);
    setCurrentLevel(JSON.parse(JSON.stringify(defaults[0])));
    showToast('Restored original 10 premade levels.', 'info');
  };

  // Create brand new blank level
  const handleNewBlankLevel = () => {
    const emptyRows = 14;
    const emptyCols = 14;
    const newId = `lvl-custom-${Date.now()}`;
    const blank: LevelConfig = {
      id: newId,
      parkingSlotsCount: 5,
      grid: {
        rows: emptyRows,
        cols: emptyCols,
        cells: Array.from({ length: emptyRows }, () => Array(emptyCols).fill(null))
      },
      queues: [[], [], []]
    };
    const { updatedLevels, newLevel } = saveAsNewLevel(levelList, blank, newId);
    setLevelList(updatedLevels);
    setCurrentLevel(newLevel);
    setMode('editor');
    showToast(`Created blank level "${newLevel.id}"!`, 'success');
  };

  // Next level in Play Test
  const handleNextLevel = () => {
    const currentIdx = levelList.findIndex(l => l.id === currentLevel.id);
    const nextIdx = (currentIdx + 1) % levelList.length;
    handleSelectLevel(levelList[nextIdx]);
  };

  return (
    <div className="min-h-screen bg-[#f7eedd] flex flex-col">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-2xl shadow-xl border backdrop-blur-md text-xs font-black animate-in fade-in slide-in-from-top-2 duration-200 bg-white/95 text-slate-800 border-amber-900/20">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          ) : (
            <Layers className="w-4 h-4 text-blue-600 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Global Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#eeddc3]/90 backdrop-blur-md border-b border-amber-900/15 shadow-sm px-4 py-2.5 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-300 shadow-md flex items-center justify-center text-xl shadow-amber-900/20">
            🐱
          </div>
          <div>
            <h1 className="text-base font-black text-amber-950 leading-tight">
              Kitty Cat Level Builder
            </h1>
            <p className="text-[11px] font-bold text-amber-900/70">
              Puzzle Level Editor & Play Test Engine
            </p>
          </div>
        </div>

        {/* Level Preset Dropdown & New Level */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LevelSelector
            levels={levelList}
            currentLevelId={currentLevel.id}
            onSelectLevel={handleSelectLevel}
            onOpenLevelList={() => setIsLevelListModalOpen(true)}
          />
          <button
            onClick={handleNewBlankLevel}
            title="Create a new blank level and add to level list"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-800 font-bold text-xs border border-amber-900/15 shadow-sm transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Level</span>
          </button>
        </div>

        {/* Mode Switcher Buttons */}
        <div className="flex items-center bg-amber-900/10 p-1 rounded-2xl border border-amber-900/15">
          <button
            onClick={() => setMode('editor')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-extrabold text-xs transition ${
              mode === 'editor'
                ? 'bg-white text-amber-950 shadow-sm'
                : 'text-amber-900/70 hover:text-amber-950'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Design Mode</span>
            <span className="sm:hidden">Design</span>
          </button>
          <button
            onClick={() => setMode('playtest')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-extrabold text-xs transition ${
              mode === 'playtest'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-amber-900/70 hover:text-amber-950'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Play Test</span>
            <span className="sm:hidden">Play</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1">
        {mode === 'editor' ? (
          <LevelEditor
            level={currentLevel}
            levels={levelList}
            onChange={setCurrentLevel}
            onPlayTest={() => setMode('playtest')}
            onExport={() => setJsonModalState({ isOpen: true, mode: 'export' })}
            onImport={() => setJsonModalState({ isOpen: true, mode: 'import' })}
            onSelectLevel={handleSelectLevel}
            onOverrideLevel={handleOverrideLevel}
            onSaveAsNewLevel={handleSaveAsNew}
            onDeleteLevel={handleDeleteLevel}
            onResetToDefaults={handleResetToDefaults}
            canDelete={levelList.length > 1}
          />
        ) : (
          <PlayTest
            level={currentLevel}
            onBackToEditor={() => setMode('editor')}
            onNextLevel={handleNextLevel}
          />
        )}
      </main>

      {/* Level Data List Manager Modal */}
      <LevelListModal
        isOpen={isLevelListModalOpen}
        levels={levelList}
        currentLevelId={currentLevel.id}
        onClose={() => setIsLevelListModalOpen(false)}
        onSelectLevel={handleSelectLevel}
        onSaveAsNew={(lvl, customName) => handleSaveAsNew(lvl, customName)}
        onOverrideCurrent={handleOverrideLevel}
        onDeleteLevel={handleDeleteLevel}
        onResetToDefaults={handleResetToDefaults}
      />

      {/* JSON Export / Import Modal */}
      <JsonModal
        isOpen={jsonModalState.isOpen}
        mode={jsonModalState.mode}
        currentLevel={currentLevel}
        onClose={() => setJsonModalState(prev => ({ ...prev, isOpen: false }))}
        onImport={imported => {
          const sanitized = sanitizeLevel(imported);
          setCurrentLevel(sanitized);
          // Also offer to save imported level to the list
          const { updatedLevels } = saveAsNewLevel(levelList, sanitized, sanitized.id);
          setLevelList(updatedLevels);
          setMode('editor');
          showToast(`Imported & added "${sanitized.id}" to level list!`, 'success');
        }}
      />
    </div>
  );
};

export default App;
