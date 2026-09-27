import React from 'react';
import { CellData } from '../types';
import { getColorDef } from '../engine/palette';
import { Lock } from 'lucide-react';

interface CellViewProps {
  cell: CellData | null;
  r: number;
  c: number;
  size?: number; // size in px
  isClearing?: boolean;
  isEditor?: boolean;
  isSelected?: boolean;
  isRevealed?: boolean;
  onClick?: () => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
}

export const CellView: React.FC<CellViewProps> = ({
  cell,
  r,
  c,
  size = 28,
  isClearing = false,
  isEditor = false,
  isSelected = false,
  isRevealed = false,
  onClick,
  onMouseEnter
}) => {
  if (!cell) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`transition-all duration-150 ${
          isEditor
            ? 'border border-dashed border-amber-900/15 hover:border-amber-900/40 hover:bg-amber-900/5 cursor-pointer rounded-sm'
            : 'opacity-0 pointer-events-none'
        }`}
      />
    );
  }

  // In PlayTest mode, unrevealed hidden cells mask their real colors
  const isHidden = !isEditor && !!(cell.hiddenGroup && !isRevealed);
  const isLocked = !!(cell.lockCount && cell.lockCount > 0);

  const colorDef = isHidden
    ? {
        id: 'hidden_mystery',
        name: 'Mystery',
        hex: '#3c3646',
        light: '#5b5368',
        dark: '#26222d',
        rim: '#1c1922'
      }
    : getColorDef(cell.color);

  // Locked or hidden cells cannot be exposed
  const state = isHidden || isLocked ? 'closed' : (cell.state || 'closed');

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: state === 'exposed' ? colorDef.dark : colorDef.hex
      }}
      className={`relative rounded-[4px] select-none transition-all duration-200 cursor-pointer ${
        isClearing ? 'animate-ping scale-110 opacity-70' : ''
      } ${isSelected ? 'ring-2 ring-white scale-105 z-10' : ''}`}
    >
      {/* 3D Bevel Highlight (Top & Left) */}
      <div
        style={{
          borderTopColor: colorDef.light,
          borderLeftColor: colorDef.light,
          borderRightColor: colorDef.dark,
          borderBottomColor: colorDef.dark
        }}
        className="absolute inset-0 rounded-[4px] border-[2px] pointer-events-none"
      />

      {/* State-specific rendering */}
      {state === 'exposed' ? (
        // Open hollow slot / cavity waiting for a cat
        <div
          style={{
            backgroundColor: colorDef.rim,
            boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.6)'
          }}
          className="absolute inset-[3px] rounded-[3px] flex items-center justify-center border border-black/30"
        >
          {/* Glowing pulse indicator for open slot */}
          <div
            style={{ backgroundColor: colorDef.light }}
            className="w-2 h-2 rounded-full opacity-75 animate-ping"
          />
        </div>
      ) : state === 'sealed' ? (
        // Closed lid with cute stamped Paw Print!
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color: colorDef.rim }}
            className="w-4 h-4 drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)] opacity-85"
          >
            {/* Paw Print Path */}
            <circle cx="7" cy="8" r="2.2" />
            <circle cx="12" cy="5.5" r="2.2" />
            <circle cx="17" cy="8" r="2.2" />
            <ellipse cx="12" cy="14" rx="4.5" ry="3.8" />
          </svg>
        </div>
      ) : isHidden ? (
        // Hidden mystery cell in PlayTest
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-amber-400/20 border border-amber-300/40 flex items-center justify-center shadow-inner">
            <span className="text-[11px] font-black text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              ?
            </span>
          </div>
        </div>
      ) : (
        // Closed solid block lid
        <div className="absolute inset-[2px] rounded-[2px] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      )}

      {/* Locked Cell Overlay Badge (Shows countdown) */}
      {isLocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-amber-950/90 text-amber-300 border border-amber-400/70 rounded-md px-1 py-0.5 shadow-md flex items-center gap-0.5 animate-pulse">
            <Lock className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
            <span className="text-[10px] font-black leading-none drop-shadow">
              {cell.lockCount}
            </span>
          </div>
        </div>
      )}

      {/* Editor mode badges for Hidden Group and Lock Count */}
      {isEditor && (
        <>
          {cell.hiddenGroup && (
            <div
              title={`Hidden Group ${cell.hiddenGroup}`}
              className="absolute top-0.5 left-0.5 z-20 bg-purple-950/90 text-purple-200 border border-purple-400/60 rounded px-1 text-[8px] font-black leading-tight pointer-events-none shadow-xs"
            >
              ?G{cell.hiddenGroup}
            </div>
          )}

          {cell.lockCount && cell.lockCount > 0 && !isLocked && (
            <div
              title={`Locked: ${cell.lockCount} seals to unlock`}
              className="absolute bottom-0.5 right-0.5 z-20 bg-amber-950/90 text-amber-300 border border-amber-400/60 rounded px-1 text-[8px] font-black leading-tight flex items-center gap-0.5 pointer-events-none shadow-xs"
            >
              <Lock className="w-2 h-2" />
              <span>{cell.lockCount}</span>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 text-[9px] text-white font-bold rounded">
            {state === 'exposed' ? 'O' : state === 'sealed' ? 'S' : ''}
          </div>
        </>
      )}
    </div>
  );
};
