import React from 'react';
import { FlyingCat as FlyingCatType } from '../types';
import { getColorDef } from '../engine/palette';

interface FlyingCatProps {
  cat: FlyingCatType;
}

export const FlyingCat: React.FC<FlyingCatProps> = ({ cat }) => {
  const colorDef = getColorDef(cat.color);

  // Parabolic trajectory or linear with smooth easing
  const currentX = cat.fromX + (cat.toX - cat.fromX) * cat.progress;
  // Add a slight parabolic arc upward (negative Y offset)
  const arcOffset = Math.sin(cat.progress * Math.PI) * -35;
  const currentY = cat.fromY + (cat.toY - cat.fromY) * cat.progress + arcOffset;

  return (
    <div
      style={{
        transform: `translate3d(${currentX}px, ${currentY}px, 0) scale(${
          0.8 + 0.4 * Math.sin(cat.progress * Math.PI)
        })`,
        left: 0,
        top: 0
      }}
      className="absolute pointer-events-none z-50 transition-none"
    >
      <div
        style={{
          backgroundColor: colorDef.hex,
          boxShadow: `0 3px 6px ${colorDef.dark}`
        }}
        className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white text-white drop-shadow-md relative animate-bounce"
      >
        {/* Cat Ears */}
        <div
          style={{ borderBottomColor: colorDef.hex }}
          className="absolute -top-1.5 -left-0.5 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px]"
        />
        <div
          style={{ borderBottomColor: colorDef.hex }}
          className="absolute -top-1.5 -right-0.5 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px]"
        />
        {/* Little Cat Face */}
        <span className="text-[10px] select-none font-bold leading-none">🐱</span>
      </div>
    </div>
  );
};
