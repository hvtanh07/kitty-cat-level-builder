import React, { useState, useEffect } from 'react';
import { LevelConfig } from './types';
import { PREMADE_LEVELS } from './data/premadeLevels';
import { LevelEditor } from './editor/LevelEditor';
import { PlayTest } from './components/PlayTest';
import { LevelSelector } from './components/LevelSelector';
import { JsonModal } from './components/JsonModal';
import { Paintbrush, Play, Plus, Sparkles, BookOpen } from 'lucide-react';

const STORAGE_KEY = 'kitty_cat_level_builder_state_v5';

export const App: React.FC = () => {
  const [currentLevel, setCurrentLevel] = useState<LevelConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return PREMADE_LEVELS[0]; // Default to Snail Garden
  });

  const [mode, setMode] = useState<'editor' | 'playtest'>('editor');
  const [jsonModalState, setJsonModalState] = useState<{
    isOpen: boolean;
    mode: 'export' | 'import';
  }>({
    isOpen: false,
    mode: 'export'
  });

  // Save to LocalStorage whenever level changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentLevel));
    } catch {
      // ignore
    }
  }, [currentLevel]);

  const handleSelectLevel = (lvl: LevelConfig) => {
    // Deep clone to avoid mutating preset reference
    const cloned: LevelConfig = JSON.parse(JSON.stringify(lvl));
    setCurrentLevel(cloned);
  };

  const handleNewLevel = () => {
    const emptyRows = 14;
    const emptyCols = 14;
    const newLevel: LevelConfig = {
      id: `custom-lvl-${Date.now()}`,
      name: 'My New Level',
      difficulty: 'Medium',
      parkingSlotsCount: 5,
      grid: {
        rows: emptyRows,
        cols: emptyCols,
        cells: Array.from({ length: emptyRows }, () => Array(emptyCols).fill(null))
      },
      queues: [[], [], []]
    };
    setCurrentLevel(newLevel);
    setMode('editor');
  };

  const handleNextLevel = () => {
    const currentIdx = PREMADE_LEVELS.findIndex(l => l.id === currentLevel.id);
    const nextIdx = (currentIdx + 1) % PREMADE_LEVELS.length;
    handleSelectLevel(PREMADE_LEVELS[nextIdx]);
  };

  return (
    <div className="min-h-screen bg-[#f7eedd] flex flex-col">
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
        <div className="flex items-center gap-3">
          <LevelSelector
            currentLevelId={currentLevel.id}
            onSelectLevel={handleSelectLevel}
          />
          <button
            onClick={handleNewLevel}
            title="Create a new blank level"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-800 font-bold text-xs border border-amber-900/15 shadow-sm transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Level</span>
          </button>
        </div>

        {/* Mode Switcher Buttons */}
        <div className="flex items-center bg-amber-900/10 p-1 rounded-2xl border border-amber-900/15">
          <button
            onClick={() => setMode('editor')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-extrabold text-xs transition ${
              mode === 'editor'
                ? 'bg-white text-amber-950 shadow-sm'
                : 'text-amber-900/70 hover:text-amber-950'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Design Mode</span>
          </button>
          <button
            onClick={() => setMode('playtest')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-extrabold text-xs transition ${
              mode === 'playtest'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-amber-900/70 hover:text-amber-950'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play Test</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1">
        {mode === 'editor' ? (
          <LevelEditor
            level={currentLevel}
            onChange={setCurrentLevel}
            onPlayTest={() => setMode('playtest')}
            onExport={() => setJsonModalState({ isOpen: true, mode: 'export' })}
            onImport={() => setJsonModalState({ isOpen: true, mode: 'import' })}
          />
        ) : (
          <PlayTest
            level={currentLevel}
            onBackToEditor={() => setMode('editor')}
            onNextLevel={handleNextLevel}
          />
        )}
      </main>

      {/* JSON Export / Import Modal */}
      <JsonModal
        isOpen={jsonModalState.isOpen}
        mode={jsonModalState.mode}
        currentLevel={currentLevel}
        onClose={() => setJsonModalState(prev => ({ ...prev, isOpen: false }))}
        onImport={imported => {
          setCurrentLevel(imported);
          setMode('editor');
        }}
      />
    </div>
  );
};

export default App;
