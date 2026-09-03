import React from 'react';
import { LevelConfig } from '../types';
import { Layers, ListFilter } from 'lucide-react';

interface LevelSelectorProps {
  levels: LevelConfig[];
  currentLevelId: string;
  onSelectLevel: (level: LevelConfig) => void;
  onOpenLevelList?: () => void;
}

export const LevelSelector: React.FC<LevelSelectorProps> = ({
  levels,
  currentLevelId,
  onSelectLevel,
  onOpenLevelList
}) => {
  return (
    <div className="relative inline-flex items-center gap-1.5">
      {onOpenLevelList && (
        <button
          onClick={onOpenLevelList}
          title="Open Level Data List Manager"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/90 hover:bg-white text-amber-950 font-black text-xs border border-amber-900/20 shadow-sm transition active:scale-95"
        >
          <Layers className="w-4 h-4 text-amber-800 flex-shrink-0" />
          <span className="hidden sm:inline">Levels</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black">
            {levels.length}
          </span>
        </button>
      )}

      <select
        value={currentLevelId}
        onChange={e => {
          const selected = levels.find(lvl => lvl.id === e.target.value);
          if (selected) onSelectLevel(selected);
        }}
        className="bg-white/90 hover:bg-white text-slate-800 font-extrabold text-xs rounded-xl px-3 py-1.5 border border-amber-900/20 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 max-w-[200px] sm:max-w-[260px] truncate"
      >
        {levels.map((lvl, idx) => (
          <option key={lvl.id} value={lvl.id}>
            #{idx + 1}: {lvl.name} ({lvl.difficulty || 'Normal'})
          </option>
        ))}
      </select>
    </div>
  );
};
