import React from 'react';
import { LevelConfig } from '../types';
import { PREMADE_LEVELS } from '../data/premadeLevels';
import { Sparkles, Layers } from 'lucide-react';

interface LevelSelectorProps {
  currentLevelId: string;
  onSelectLevel: (level: LevelConfig) => void;
}

export const LevelSelector: React.FC<LevelSelectorProps> = ({
  currentLevelId,
  onSelectLevel
}) => {
  return (
    <div className="relative inline-flex items-center gap-2">
      <Layers className="w-4 h-4 text-amber-800 flex-shrink-0" />
      <select
        value={currentLevelId}
        onChange={e => {
          const selected = PREMADE_LEVELS.find(lvl => lvl.id === e.target.value);
          if (selected) onSelectLevel(selected);
        }}
        className="bg-white/90 hover:bg-white text-slate-800 font-extrabold text-xs rounded-xl px-3 py-1.5 border border-amber-900/20 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        {PREMADE_LEVELS.map((lvl, idx) => (
          <option key={lvl.id} value={lvl.id}>
            Level {idx + 1}: {lvl.name} ({lvl.difficulty || 'Normal'})
          </option>
        ))}
      </select>
    </div>
  );
};
