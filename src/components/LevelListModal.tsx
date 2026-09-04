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
  FolderOpen,
  X,
  RotateCcw,
  Save,
  AlertCircle
} from 'lucide-react';

interface LevelListModalProps {
  isOpen: boolean;
  levels: LevelConfig[];
  currentLevelId: string;
  onClose: () => void;
  onSelectLevel: (level: LevelConfig) => void;
  onSaveAsNew: (source?: LevelConfig, customId?: string) => void;
  onOverrideCurrent: () => void;
  onDeleteLevel: (levelId: string) => void;
  onResetToDefaults: () => void;
}

export const LevelListModal: React.FC<LevelListModalProps> = ({
  isOpen,
  levels,
  currentLevelId,
  onClose,
  onSelectLevel,
  onSaveAsNew,
  onOverrideCurrent,
  onDeleteLevel,
  onResetToDefaults
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deletingLevelId, setDeletingLevelId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredLevels = levels.filter(lvl =>
    lvl.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#fbf7f0] border-2 border-amber-900/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#eeddc3] border-b border-amber-900/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-950">Level Data List</h2>
              <p className="text-xs font-semibold text-amber-900/70">
                Manage, load, duplicate, and organize all {levels.length} puzzle levels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetConfirm(true)}
              title="Restore original 10 premade levels"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white text-amber-950 font-bold text-xs border border-amber-900/15 transition active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
              <span>Restore Defaults</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/10 text-amber-950 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reset Confirmation Banner */}
        {showResetConfirm && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2 text-rose-900 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>
                Are you sure you want to restore the original 10 premade levels? All custom levels and modifications will be reset.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onResetToDefaults();
                  setShowResetConfirm(false);
                }}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition"
              >
                Yes, Reset All
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Toolbar: Search & Action Buttons */}
        <div className="px-6 py-3 bg-amber-50/50 border-b border-amber-900/10 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-900/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search levels by ID..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-amber-900/15 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOverrideCurrent}
              title="Save current canvas changes to the active level"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-sm transition active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Override Active</span>
            </button>
            <button
              onClick={() => onSaveAsNew()}
              title="Save current canvas as a brand new level"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-extrabold text-xs border border-amber-900/15 shadow-sm transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Level</span>
            </button>
          </div>
        </div>

        {/* Level Cards Grid */}
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredLevels.map((lvl, index) => {
            const isCurrent = lvl.id === currentLevelId;

            // Count colors present in grid
            const colorsPresent = new Set<string>();
            let cellCount = 0;
            lvl.grid.cells.forEach(row =>
              row.forEach(c => {
                if (c) {
                  colorsPresent.add(c.color);
                  cellCount++;
                }
              })
            );

            // Total cats in queues
            const totalCats = lvl.queues.flat().reduce((sum, b) => sum + b.count, 0);
            const isConfirmingDelete = deletingLevelId === lvl.id;

            return (
              <div
                key={lvl.id}
                className={`relative p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? 'bg-amber-100/60 border-amber-500 shadow-md ring-2 ring-amber-400/40'
                    : 'bg-white border-amber-900/15 hover:border-amber-900/30 hover:shadow-sm'
                }`}
              >
                {/* Level Top Info */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-900/10 text-amber-950 font-black text-[11px]">
                        #{index + 1}
                      </span>
                      <h3 className="font-mono font-black text-sm text-slate-800 truncate max-w-[240px]" title={lvl.id}>
                        {lvl.id}
                      </h3>
                      {isCurrent && (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Specs & Stats */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                    <span>
                      Grid: <strong className="text-slate-800 font-bold">{lvl.grid.cols}x{lvl.grid.rows}</strong> ({cellCount} cells)
                    </span>
                    <span>
                      Queues: <strong className="text-slate-800 font-bold">{lvl.queues.length}</strong> ({totalCats} cats)
                    </span>
                    <span>
                      Slots: <strong className="text-slate-800 font-bold">{lvl.parkingSlotsCount || 5}</strong>
                    </span>
                  </div>

                  {/* Color dots preview */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">Palette:</span>
                    <div className="flex items-center gap-1">
                      {Array.from(colorsPresent).map(cId => {
                        const def = getColorDef(cId);
                        return (
                          <div
                            key={cId}
                            style={{ backgroundColor: def.hex }}
                            title={def.name}
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs"
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Level Action Buttons */}
                <div className="pt-2 border-t border-amber-900/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        onSelectLevel(lvl);
                        onClose();
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 ${
                        isCurrent
                          ? 'bg-amber-700 text-white shadow-xs'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{isCurrent ? 'Current' : 'Load Level'}</span>
                    </button>

                    <button
                      onClick={() => onSaveAsNew(lvl)}
                      title="Duplicate level as a new level"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </button>
                  </div>

                  {/* Delete Button / Confirmation */}
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onDeleteLevel(lvl.id);
                          setDeletingLevelId(null);
                        }}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold rounded-lg transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeletingLevelId(null)}
                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingLevelId(lvl.id)}
                      disabled={levels.length <= 1}
                      title={levels.length <= 1 ? 'Cannot delete the last remaining level' : 'Delete this level'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#eeddc3]/60 border-t border-amber-900/15 flex items-center justify-between text-xs text-amber-950/70 font-semibold">
          <span>💡 All levels and changes are saved locally in your browser storage.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-amber-900/15 hover:bg-amber-900/25 text-amber-950 font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
