import React from 'react';
import { CatBoxData } from '../types';
import { getColorDef } from '../engine/palette';

interface CatBoxViewProps {
  box: CatBoxData | null;
  isFront?: boolean;
  isParking?: boolean;
  isShaking?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const CatBoxView: React.FC<CatBoxViewProps> = ({
  box,
  isFront = false,
  isParking = false,
  isShaking = false,
  size = 'md',
  onClick
}) => {
  if (!box) {
    // Empty slot in parking tray
    return (
      <div
        className={`rounded-2xl border-2 border-dashed border-amber-900/20 bg-amber-900/10 flex items-center justify-center transition-all ${
          size === 'sm' ? 'w-12 h-14' : size === 'lg' ? 'w-20 h-24' : 'w-16 h-20'
        }`}
      >
        <span className="text-amber-900/20 font-bold text-xs select-none">Empty</span>
      </div>
    );
  }

  const isMystery = box.isMystery && !isFront && !isParking;
  const colorDef = isMystery
    ? {
        id: 'mystery',
        name: 'Mystery Box',
        hex: '#94a3b8',
        light: '#cbd5e1',
        dark: '#64748b',
        rim: '#475569',
        text: '#1e293b',
        bgGradient: 'from-slate-300 to-slate-400'
      }
    : getColorDef(box.color);

  // Dimension presets
  const sizeClasses = {
    sm: 'w-12 h-14 text-xs',
    md: 'w-16 h-20 text-sm',
    lg: 'w-20 h-24 text-base'
  }[size];

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: colorDef.hex,
        boxShadow: isFront || isParking
          ? `0 6px 0 ${colorDef.dark}, 0 8px 12px rgba(0,0,0,0.25)`
          : `0 3px 0 ${colorDef.dark}, 0 4px 6px rgba(0,0,0,0.15)`
      }}
      className={`relative rounded-2xl flex flex-col items-center justify-between p-1.5 transition-transform duration-150 select-none cursor-pointer ${sizeClasses} ${
        isShaking ? 'animate-[shake_0.35s_ease-in-out]' : ''
      } ${
        isFront
          ? 'hover:-translate-y-1 active:translate-y-0.5 active:shadow-none'
          : ''
      }`}
    >
      {/* Top 3D highlight bevel */}
      <div
        style={{
          borderTopColor: colorDef.light,
          borderLeftColor: colorDef.light,
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent'
        }}
        className="absolute inset-0 rounded-2xl border-t-2 border-l-2 pointer-events-none opacity-80"
      />

      {/* Top Counter Pill Badge */}
      <div className="w-full flex justify-center pt-0.5">
        <div className="bg-white/95 text-slate-800 font-extrabold rounded-full px-2.5 py-0.5 shadow-sm min-w-[28px] text-center border border-black/10">
          {isMystery ? '?' : box.count}
        </div>
      </div>

      {/* Paw Print Emblem on Box Front */}
      <div className="pb-1">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ color: colorDef.dark }}
          className="w-5 h-5 opacity-90 drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]"
        >
          <circle cx="7" cy="8" r="2.2" />
          <circle cx="12" cy="5.5" r="2.2" />
          <circle cx="17" cy="8" r="2.2" />
          <ellipse cx="12" cy="14" rx="4.5" ry="3.8" />
        </svg>
      </div>
    </div>
  );
};
