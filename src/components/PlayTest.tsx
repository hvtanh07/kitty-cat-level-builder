import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  LevelConfig,
  FlyingCat as FlyingCatType,
  ParkedBox
} from '../types';
import {
  GameState,
  createInitialGameState,
  tapQueueBox,
  dispatchCats,
  processLineClears,
  checkWinLose,
  boosterShuffleQueues,
  boosterBroomClear
} from '../engine/gameEngine';
import { CellView } from './CellView';
import { CatBoxView } from './CatBoxView';
import { FlyingCat } from './FlyingCat';
import { sounds } from '../audio/sound';
import {
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  Volume2,
  VolumeX,
  FastForward,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Paintbrush
} from 'lucide-react';

interface PlayTestProps {
  level: LevelConfig;
  onBackToEditor: () => void;
  onNextLevel?: () => void;
}

export const PlayTest: React.FC<PlayTestProps> = ({
  level,
  onBackToEditor,
  onNextLevel
}) => {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(level)
  );
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(sounds.isMuted);
  const [history, setHistory] = useState<GameState[]>([]);

  // Refs for tracking DOM elements to calculate flying cat coordinates
  const containerRef = useRef<HTMLDivElement>(null);
  const parkingSlotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Reset game on level change
  useEffect(() => {
    setGameState(createInitialGameState(level));
    setHistory([]);
  }, [level]);

  // Handle Confetti on Win
  useEffect(() => {
    if (gameState.status === 'won') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [gameState.status]);

  // Coordinate getters
  const getSlotCoords = useCallback((slotIndex: number): { x: number; y: number } => {
    const el = parkingSlotRefs.current[slotIndex];
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      return {
        x: elRect.left - contRect.left + elRect.width / 2 - 12,
        y: elRect.top - contRect.top + elRect.height / 2 - 12
      };
    }
    return { x: 180, y: 520 };
  }, []);

  const getCellCoords = useCallback((r: number, c: number): { x: number; y: number } => {
    const key = `${r}-${c}`;
    const el = cellRefs.current.get(key);
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      return {
        x: elRect.left - contRect.left + elRect.width / 2 - 12,
        y: elRect.top - contRect.top + elRect.height / 2 - 12
      };
    }
    return { x: 180, y: 220 };
  }, []);

  // Animation Frame Loop for Flying Cats
  useEffect(() => {
    if (gameState.flyingCats.length === 0) return;

    let animId: number;
    let lastTime = performance.now();

    const updateLoop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setGameState(prevState => {
        if (prevState.flyingCats.length === 0) return prevState;

        const catSpeed = 2.4 * speedMultiplier; // Complete trip in ~0.4s
        const updatedCats: FlyingCatType[] = [];
        const arrivedCats: FlyingCatType[] = [];

        for (const cat of prevState.flyingCats) {
          const nextProgress = cat.progress + dt * catSpeed;
          if (nextProgress >= 1) {
            arrivedCats.push(cat);
          } else {
            updatedCats.push({ ...cat, progress: nextProgress });
          }
        }

        if (arrivedCats.length > 0) {
          arrivedCats.forEach(() => sounds.playSeal());

          // Process line clears
          let stateAfterClears = processLineClears({
            ...prevState,
            flyingCats: updatedCats
          });

          // Cascade check: dispatch from any parked boxes that now match newly exposed slots
          const stateAfterCascade = dispatchCats(
            stateAfterClears,
            getSlotCoords,
            getCellCoords
          );

          return checkWinLose(stateAfterCascade);
        }

        return {
          ...prevState,
          flyingCats: updatedCats
        };
      });

      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, [gameState.flyingCats.length, speedMultiplier, getSlotCoords, getCellCoords]);

  // Handle Box Tap from Queue
  const handleTapQueue = (qIdx: number) => {
    if (gameState.status !== 'playing') return;
    if (gameState.flyingCats.length > 0) return; // Wait for current swarm to land

    // Save history for Undo booster
    setHistory(prev => [...prev.slice(-5), gameState]);

    const { nextState, moved } = tapQueueBox(gameState, qIdx);
    if (!moved) {
      setGameState(nextState);
      return;
    }

    // Immediately dispatch matching cats from parking slots
    const stateAfterDispatch = dispatchCats(
      nextState,
      getSlotCoords,
      getCellCoords
    );

    setGameState(stateAfterDispatch);
  };

  // Booster handlers
  const handleShuffle = () => {
    if (gameState.status !== 'playing') return;
    setGameState(prevState => boosterShuffleQueues(prevState));
  };

  const handleBroom = () => {
    if (gameState.status !== 'playing') return;
    setGameState(prevState => boosterBroomClear(prevState));
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setGameState(previous);
    sounds.playTap();
  };

  const handleRestart = () => {
    setGameState(createInitialGameState(level));
    setHistory([]);
    sounds.playTap();
  };

  const toggleSound = () => {
    sounds.isMuted = !sounds.isMuted;
    setIsMuted(sounds.isMuted);
  };

  // Calculate cleared progress percentage
  const totalCells = gameState.initialCellCount || 1;
  let currentNonEmpty = 0;
  for (const row of gameState.grid) {
    for (const c of row) {
      if (c !== null && c.state !== 'sealed') currentNonEmpty++;
    }
  }
  const clearedPercent = Math.min(
    100,
    Math.max(0, Math.round(((totalCells - currentNonEmpty) / totalCells) * 100))
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] p-2 sm:p-4">
      {/* Play Test Container Frame (Mobile Device Aspect) */}
      <div
        ref={containerRef}
        className="relative w-full max-w-[430px] rounded-[36px] bg-gradient-to-b from-[#fcedda] via-[#f7e0c4] to-[#ecc9a2] border-[10px] border-[#d8ae7b] shadow-[0_20px_50px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col items-center select-none"
        style={{ minHeight: '820px' }}
      >
        {/* Top Header Bar */}
        <div className="w-full px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          {/* Back to Editor button */}
          <button
            onClick={onBackToEditor}
            title="Back to Level Editor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-800/20 hover:bg-amber-800/30 text-amber-950 font-bold text-xs transition"
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>

          {/* Level Indicator & Progress Bar */}
          <div className="flex-1 flex flex-col items-center px-2">
            <div className="flex items-center justify-between w-full max-w-[170px] text-xs font-black text-amber-950 mb-1">
              <span>{level.name}</span>
              <span>{clearedPercent}%</span>
            </div>
            <div className="w-full max-w-[170px] h-3 bg-amber-950/20 rounded-full p-0.5 shadow-inner">
              <div
                style={{ width: `${clearedPercent}%` }}
                className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-300 shadow-sm"
              />
            </div>
          </div>

          {/* Controls: Mute & Speed */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleSound}
              title={isMuted ? 'Unmute' : 'Mute'}
              className="p-1.5 rounded-full bg-white/70 hover:bg-white text-amber-950 shadow-sm transition"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() =>
                setSpeedMultiplier(prev => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1))
              }
              title={`Speed: ${speedMultiplier}x`}
              className="px-2 py-1 rounded-full bg-white/70 hover:bg-white text-amber-950 font-black text-xs shadow-sm transition flex items-center gap-0.5"
            >
              <FastForward className="w-3 h-3" />
              <span>{speedMultiplier}x</span>
            </button>
          </div>
        </div>

        {/* Booster Action Bar (Matches Screenshot) */}
        <div className="w-full px-6 py-2 flex items-center justify-center gap-4">
          {/* Undo Booster */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo Move"
            className="flex flex-col items-center gap-1 group disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-indigo-400 to-indigo-600 border-2 border-indigo-300 shadow-md flex items-center justify-center text-white group-hover:scale-105 active:scale-95 transition">
              <RotateCcw className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold text-amber-950">Undo</span>
          </button>

          {/* Shuffle Booster */}
          <button
            onClick={handleShuffle}
            title="Shuffle Front Boxes"
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-300 shadow-md flex items-center justify-center text-white group-hover:scale-105 active:scale-95 transition">
              <Shuffle className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold text-amber-950">Shuffle</span>
          </button>

          {/* Broom Booster */}
          <button
            onClick={handleBroom}
            title="Clear Stuck Parking Box"
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-purple-400 to-purple-600 border-2 border-purple-300 shadow-md flex items-center justify-center text-white group-hover:scale-105 active:scale-95 transition">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold text-amber-950">Broom</span>
          </button>
        </div>

        {/* Recessed Grid Board Container */}
        <div className="w-[92%] my-2 p-3 rounded-2xl bg-[#452818] border-4 border-[#331c0e] shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-auto min-h-[360px] max-h-[400px]">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gameState.cols}, minmax(0, 1fr))`,
              gap: '2px'
            }}
            className="justify-center items-center"
          >
            {gameState.grid.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r}-${c}`;
                const isClearing = gameState.clearingRows.includes(r);
                return (
                  <div
                    key={key}
                    ref={el => {
                      if (el) cellRefs.current.set(key, el);
                      else cellRefs.current.delete(key);
                    }}
                  >
                    <CellView
                      cell={cell}
                      r={r}
                      c={c}
                      size={gameState.cols > 15 ? 18 : gameState.cols > 12 ? 21 : 25}
                      isClearing={isClearing}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 5 Parking Slots Tray (Matches Screenshot) */}
        <div className="w-[92%] my-3 px-3 py-2.5 rounded-3xl bg-[#dcb386] border-4 border-[#c79b6c] shadow-[inset_0_3px_8px_rgba(0,0,0,0.25)] flex items-center justify-around gap-1.5">
          {gameState.parkingSlots.map((box, idx) => (
            <div
              key={`parking-slot-${idx}`}
              ref={el => {
                parkingSlotRefs.current[idx] = el;
              }}
              className="flex items-center justify-center"
            >
              <CatBoxView
                box={box}
                isParking={true}
                size="sm"
              />
            </div>
          ))}
        </div>

        {/* Cat Box Queues (3 Queues stacked underneath) */}
        <div className="w-[92%] flex-1 pb-4 flex justify-around items-start gap-2">
          {gameState.queues.map((queue, qIdx) => {
            const isShaking = gameState.shakingQueueIndex === qIdx;
            const frontBox = queue.length > 0 ? queue[0] : null;
            const remainingBoxes = queue.slice(1);

            return (
              <div
                key={`queue-${qIdx}`}
                className="flex flex-col items-center flex-1 max-w-[110px]"
              >
                {/* Front Box (Interactive) */}
                <div className="relative mb-2 z-20">
                  {frontBox ? (
                    <CatBoxView
                      box={frontBox}
                      isFront={true}
                      isShaking={isShaking}
                      size="md"
                      onClick={() => handleTapQueue(qIdx)}
                    />
                  ) : (
                    <div className="w-16 h-20 rounded-2xl border-2 border-dashed border-amber-900/20 flex items-center justify-center">
                      <span className="text-amber-900/30 text-xs font-bold">Done</span>
                    </div>
                  )}
                </div>

                {/* Upcoming boxes in stack */}
                <div className="w-full flex flex-col items-center -space-y-12 opacity-85 pointer-events-none">
                  {remainingBoxes.slice(0, 4).map((box, bIdx) => (
                    <div
                      key={box.id || `box-preview-${bIdx}`}
                      style={{ zIndex: 10 - bIdx }}
                      className="scale-90"
                    >
                      <CatBoxView
                        box={box}
                        size="sm"
                      />
                    </div>
                  ))}
                  {remainingBoxes.length > 4 && (
                    <div className="text-[10px] font-extrabold text-amber-950 bg-white/60 px-2 py-0.5 rounded-full z-10">
                      +{remainingBoxes.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Flying Cats Overlay */}
        {gameState.flyingCats.map(cat => (
          <FlyingCat key={cat.id} cat={cat} />
        ))}

        {/* Win Modal Overlay */}
        {gameState.status === 'won' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-gradient-to-b from-amber-100 to-amber-200 border-4 border-amber-400 rounded-3xl p-6 shadow-2xl flex flex-col items-center max-w-[320px] text-center">
              <div className="text-5xl mb-2 animate-bounce">🏆</div>
              <h2 className="text-2xl font-black text-amber-950">Level Complete!</h2>
              <p className="text-xs text-amber-900 mt-1 mb-4">
                All cats found their cozy slots and cleared the board!
              </p>

              <div className="bg-white/70 rounded-2xl p-3 w-full mb-4 text-xs font-bold text-slate-700 flex justify-around">
                <div>
                  <div className="text-amber-950 font-black text-base">{gameState.stats.moves}</div>
                  <div>Moves</div>
                </div>
                <div>
                  <div className="text-amber-950 font-black text-base">{gameState.stats.linesCleared}</div>
                  <div>Lines Cleared</div>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full">
                {onNextLevel && (
                  <button
                    onClick={onNextLevel}
                    className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-sm shadow-md hover:brightness-110 active:scale-95 transition"
                  >
                    Next Level 🎉
                  </button>
                )}
                <button
                  onClick={handleRestart}
                  className="w-full py-2 rounded-2xl bg-amber-300 text-amber-950 font-black text-xs shadow hover:bg-amber-400 active:scale-95 transition flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Play Again</span>
                </button>
                <button
                  onClick={onBackToEditor}
                  className="w-full py-2 rounded-2xl bg-white text-slate-700 font-bold text-xs shadow-sm hover:bg-slate-50 transition"
                >
                  Return to Editor
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lose Modal Overlay */}
        {gameState.status === 'lost' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-gradient-to-b from-rose-100 to-rose-200 border-4 border-rose-400 rounded-3xl p-6 shadow-2xl flex flex-col items-center max-w-[320px] text-center">
              <div className="text-5xl mb-2">😿</div>
              <h2 className="text-2xl font-black text-rose-950">Out of Moves!</h2>
              <p className="text-xs text-rose-900 mt-1 mb-4">
                All 5 parking slots are full and none match currently exposed slots.
              </p>

              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={handleRestart}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-black text-sm shadow-md hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
                {history.length > 0 && (
                  <button
                    onClick={handleUndo}
                    className="w-full py-2 rounded-2xl bg-amber-300 text-amber-950 font-black text-xs shadow hover:bg-amber-400 transition"
                  >
                    Undo Last Move
                  </button>
                )}
                <button
                  onClick={onBackToEditor}
                  className="w-full py-2 rounded-2xl bg-white text-slate-700 font-bold text-xs shadow-sm hover:bg-slate-50 transition"
                >
                  Return to Editor
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
