import React, { useState } from 'react';
import { LevelConfig } from '../types';
import { getColorDef } from '../engine/palette';
import {
  Layers,
  Search,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Save
} from 'lucide-react';

interface LevelListSidebarProps {
  levels: LevelConfig[];
  currentLevelId: string;
  onSelectLevel: (level: LevelConfig) => void;
  onSaveAsNew: (source?: LevelConfig) => void;
  onOverrideCurrent: () => void;
  onDeleteLevel: (levelId: string) => void;
  onResetToDefaults: () => void;
}

export const LevelListSidebar: React.FC<LevelListSidebarProps> = ({
  levels,
  currentLevelId,
  onSelectLevel,
  onSaveAsNew,
  onOverrideCurrent,
  onDeleteLevel,
  onResetToDefaults
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const filteredLevels = levels.filter(
    lvl =>
      lvl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lvl.difficulty && lvl.difficulty.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="bg-white/85 backdrop-blur-sm border border-amber-900/20 rounded-2xl p-3.5 shadow-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-amber-800" />
          <span className="text-xs font-black text-amber-950">Level Data List</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black">
            {levels.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onSaveAsNew()}
            title="Save current canvas as a new level"
            className="p-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-bold transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            title="Restore original 10 premade levels"
            className="p-1 rounded-lg text-amber-900/60 hover:text-amber-950 hover:bg-amber-100 transition active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Reset Confirmation Banner */}
      {showResetConfirm && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex flex-col gap-1.5 text-[11px]">
          <span className="font-bold text-rose-900 leading-tight">
            Reset to default 10 levels?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onResetToDefaults();
                setShowResetConfirm(false);
              }}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10px]"
            >
              Reset
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold text-[10px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-900/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter levels..."
          className="w-full pl-8 pr-2.5 py-1 rounded-xl bg-amber-50/50 border border-amber-900/15 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Scrollable Levels List */}
      <div className="flex flex-col gap-1.5 max-h-[290px] overflow-y-auto pr-1">
        {filteredLevels.map((lvl, idx) => {
          const isCurrent = lvl.id === currentLevelId;
          const isDeleting = deletingId === lvl.id;

          // Palette dots
          const colorsPresent = new Set<string>();
          lvl.grid.cells.forEach(r => r.forEach(c => c && colorsPresent.add(c.color)));

          return (
            <div
              key={lvl.id}
              onClick={() => onSelectLevel(lvl)}
              className={`group p-2 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                isCurrent
                  ? 'bg-amber-100/70 border-amber-500 shadow-xs ring-1 ring-amber-400/50'
                  : 'bg-white border-amber-900/10 hover:border-amber-900/25 hover:bg-amber-50/40'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-amber-900/70">
                    #{idx + 1}
                  </span>
                  <span className="text-xs font-black text-slate-800 truncate" title={lvl.name}>
                    {lvl.name}
                  </span>
                  {isCurrent && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  )}
                </div>

                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                  <span>{lvl.grid.cols}x{lvl.grid.rows}</span>
                  <span>•</span>
                  <span>{lvl.queues.length}Q</span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    {Array.from(colorsPresent).slice(0, 5).map(cId => (
                      <div
                        key={cId}
                        style={{ backgroundColor: getColorDef(cId).hex }}
                        className="w-2 h-2 rounded-full border border-black/15"
                      />
                    ))}
                    {colorsPresent.size > 5 && (
                      <span className="text-[8px] text-slate-400">+{colorsPresent.size - 5}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Row Action Buttons */}
              <div
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100"
              >
                <button
                  onClick={() => onSaveAsNew(lvl)}
                  title="Duplicate level"
                  className="p-1 rounded text-slate-400 hover:text-amber-900 hover:bg-amber-100 transition"
                >
                  <Copy className="w-3 h-3" />
                </button>

                {isDeleting ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onDeleteLevel(lvl.id);
                        setDeletingId(null);
                      }}
                      className="px-1.5 py-0.5 bg-rose-600 text-white rounded font-bold text-[9px]"
                    >
                      Del
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[9px]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(lvl.id)}
                    disabled={levels.length <= 1}
                    title="Delete level"
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Override Quick Action Button */}
      <button
        onClick={onOverrideCurrent}
        title="Override active level in list with current editor canvas"
        className="w-full py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
      >
        <Save className="w-3.5 h-3.5" />
        <span>Override Current Level</span>
      </button>
    </div>
  );
};
