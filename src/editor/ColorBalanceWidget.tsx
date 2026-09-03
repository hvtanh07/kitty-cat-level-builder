import React from 'react';
import { LevelConfig, CatBoxData } from '../types';
import { getColorDef } from '../engine/palette';
import { generateBalancedQueues } from '../data/premadeLevels';
import { CheckCircle, AlertTriangle, Wand2 } from 'lucide-react';

interface ColorBalanceWidgetProps {
  level: LevelConfig;
  onUpdateQueues: (queues: CatBoxData[][]) => void;
}

export const ColorBalanceWidget: React.FC<ColorBalanceWidgetProps> = ({
  level,
  onUpdateQueues
}) => {
  // Count grid cells per color
  const cellCounts: Record<string, number> = {};
  for (const row of level.grid.cells) {
    for (const cell of row) {
      if (cell) {
        cellCounts[cell.color] = (cellCounts[cell.color] || 0) + 1;
      }
    }
  }

  // Count box cats per color
  const catCounts: Record<string, number> = {};
  for (const queue of level.queues) {
    for (const box of queue) {
      catCounts[box.color] = (catCounts[box.color] || 0) + box.count;
    }
  }

  // All distinct colors present in grid or queues
  const allColors = Array.from(
    new Set([...Object.keys(cellCounts), ...Object.keys(catCounts)])
  );

  const isBalanced = allColors.every(
    color => (cellCounts[color] || 0) === (catCounts[color] || 0)
  );

  const handleAutoGenerate = () => {
    // Preserve exactly the current number of queues the user configured
    const currentQueueCount = level.queues.length > 0 ? level.queues.length : 3;
    const generated = generateBalancedQueues(level.grid.cells, currentQueueCount, 10);
    onUpdateQueues(generated);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-amber-900/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          )}
          <span className="font-extrabold text-sm text-slate-800">
            Color Balance Validator
          </span>
        </div>
        <button
          onClick={handleAutoGenerate}
          title="Automatically generate balanced cat boxes for this grid"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow transition active:scale-95"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Auto-Generate Queues</span>
        </button>
      </div>

      {/* Color Breakdown Badges */}
      <div className="flex flex-wrap gap-2 pt-1">
        {allColors.map(colorId => {
          const colorDef = getColorDef(colorId);
          const needed = cellCounts[colorId] || 0;
          const provided = catCounts[colorId] || 0;
          const match = needed === provided;

          return (
            <div
              key={colorId}
              style={{ borderColor: colorDef.dark }}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                match
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : provided < needed
                  ? 'bg-rose-50 text-rose-900 border-rose-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              <div
                style={{ backgroundColor: colorDef.hex }}
                className="w-3.5 h-3.5 rounded-full border border-black/20"
              />
              <span className="font-semibold">{colorDef.name}:</span>
              <span>
                {provided}/{needed} cats
              </span>
              {match ? (
                <span className="text-emerald-600">✓</span>
              ) : provided < needed ? (
                <span className="text-rose-600 font-extrabold">
                  (-{needed - provided})
                </span>
              ) : (
                <span className="text-amber-600 font-extrabold">
                  (+{provided - needed})
                </span>
              )}
            </div>
          );
        })}
        {allColors.length === 0 && (
          <div className="text-xs text-slate-500 italic">
            Draw cells on the grid to see color requirements.
          </div>
        )}
      </div>
    </div>
  );
};
