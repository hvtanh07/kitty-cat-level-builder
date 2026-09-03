import React from 'react';
import { CatBoxData } from '../types';
import { COLOR_PALETTE, getColorDef } from '../engine/palette';
import { Plus, Trash2, ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';

interface QueueEditorProps {
  queues: CatBoxData[][];
  onChange: (queues: CatBoxData[][]) => void;
}

export const QueueEditor: React.FC<QueueEditorProps> = ({ queues, onChange }) => {
  const addQueue = () => {
    if (queues.length >= 6) return;
    onChange([...queues, []]);
  };

  const removeQueue = (qIdx: number) => {
    if (queues.length <= 1) return;
    const next = queues.filter((_, idx) => idx !== qIdx);
    onChange(next);
  };

  const addBox = (qIdx: number) => {
    const next = queues.map((q, idx) => {
      if (idx !== qIdx) return q;
      const newBox: CatBoxData = {
        id: `box-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        color: COLOR_PALETTE[0].id,
        count: 10,
        isMystery: false
      };
      return [...q, newBox];
    });
    onChange(next);
  };

  const updateBox = (qIdx: number, bIdx: number, updates: Partial<CatBoxData>) => {
    const next = queues.map((q, idx) => {
      if (idx !== qIdx) return q;
      return q.map((box, bIndex) => {
        if (bIndex !== bIdx) return box;
        return { ...box, ...updates };
      });
    });
    onChange(next);
  };

  const deleteBox = (qIdx: number, bIdx: number) => {
    const next = queues.map((q, idx) => {
      if (idx !== qIdx) return q;
      return q.filter((_, bIndex) => bIndex !== bIdx);
    });
    onChange(next);
  };

  const moveBox = (qIdx: number, bIdx: number, direction: 'up' | 'down') => {
    const queue = queues[qIdx];
    const targetIdx = direction === 'up' ? bIdx - 1 : bIdx + 1;
    if (targetIdx < 0 || targetIdx >= queue.length) return;

    const next = queues.map((q, idx) => {
      if (idx !== qIdx) return q;
      const copy = [...q];
      [copy[bIdx], copy[targetIdx]] = [copy[targetIdx], copy[bIdx]];
      return copy;
    });
    onChange(next);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-amber-900/20 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-slate-800">Cat Box Queues</h3>
          <p className="text-xs text-slate-500">
            Configure the queues of cat boxes the player can tap into parking slots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addQueue}
            disabled={queues.length >= 6}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs disabled:opacity-40 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Queue ({queues.length}/6)</span>
          </button>
        </div>
      </div>

      {/* Columns of Queues */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 overflow-x-auto pb-2">
        {queues.map((queue, qIdx) => (
          <div
            key={`queue-col-${qIdx}`}
            className="flex flex-col bg-amber-50/70 border border-amber-900/15 rounded-2xl p-3"
          >
            {/* Queue Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-900/10">
              <span className="font-extrabold text-xs text-amber-950">
                Queue {qIdx + 1} ({queue.length} boxes)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => addBox(qIdx)}
                  title="Add box to this queue"
                  className="p-1 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-950 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
                {queues.length > 1 && (
                  <button
                    onClick={() => removeQueue(qIdx)}
                    title="Delete this queue"
                    className="p-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Boxes in this Queue */}
            <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
              {queue.map((box, bIdx) => {
                const colorDef = getColorDef(box.color);
                const isFront = bIdx === 0;

                return (
                  <div
                    key={box.id || `box-row-${bIdx}`}
                    style={{ borderLeftColor: colorDef.hex }}
                    className={`flex items-center justify-between p-2 rounded-xl bg-white border border-amber-900/10 border-l-4 shadow-sm text-xs ${
                      isFront ? 'ring-1 ring-amber-400' : ''
                    }`}
                  >
                    {/* Front Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 w-4">
                        #{bIdx + 1}
                      </span>

                      {/* Color Selector dropdown */}
                      <select
                        value={box.color}
                        onChange={e => updateBox(qIdx, bIdx, { color: e.target.value })}
                        style={{ backgroundColor: colorDef.hex, color: colorDef.text }}
                        className="rounded-lg px-2 py-1 font-bold text-xs shadow-inner cursor-pointer border border-black/20"
                      >
                        {COLOR_PALETTE.map(c => (
                          <option key={c.id} value={c.id} className="bg-white text-slate-900">
                            {c.name}
                          </option>
                        ))}
                      </select>

                      {/* Cat Count Input */}
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={box.count}
                        onChange={e =>
                          updateBox(qIdx, bIdx, {
                            count: Math.max(1, parseInt(e.target.value) || 1)
                          })
                        }
                        className="w-12 px-1.5 py-0.5 rounded-lg border border-slate-300 text-center font-black text-slate-800"
                        title="Cat Count"
                      />
                    </div>

                    {/* Mystery Box & Reorder Controls */}
                    <div className="flex items-center gap-1">
                      {/* Mystery Toggle */}
                      <button
                        onClick={() =>
                          updateBox(qIdx, bIdx, { isMystery: !box.isMystery })
                        }
                        title={
                          box.isMystery
                            ? 'Mystery Box (Reveals when at front)'
                            : 'Normal Box (Always visible)'
                        }
                        className={`p-1 rounded-lg transition ${
                          box.isMystery
                            ? 'bg-purple-100 text-purple-700 font-extrabold'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>

                      {/* Move Up */}
                      <button
                        onClick={() => moveBox(qIdx, bIdx, 'up')}
                        disabled={bIdx === 0}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-20"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>

                      {/* Move Down */}
                      <button
                        onClick={() => moveBox(qIdx, bIdx, 'down')}
                        disabled={bIdx === queue.length - 1}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-20"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteBox(qIdx, bIdx)}
                        className="p-1 rounded hover:bg-rose-50 text-rose-500 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {queue.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  Queue is empty. Click + to add cat boxes.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
