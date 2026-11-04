import React from 'react';
import { getHalfCourtGeometry, COURT_WIDTH_METERS, HALF_COURT_LENGTH_METERS } from './HandballCourtGeometry';

export interface HandballCourtSvgProps {
  className?: string;
  showNet?: boolean;
  theme?: 'taraflex-blue' | 'classic-wood' | 'dark-mode';
  children?: React.ReactNode;
}

/**
 * Authentic IHF / SHF Half-Court SVG Component.
 * True 1:1 aspect ratio (20m x 20m), Taraflex styling with distinct 6m crease fill.
 * ViewBox 0 0 20 20 matches percentage coordinates (0%..100% = 0..20m) 1:1.
 */
export function HandballCourtSvg({
  className,
  showNet = true,
  children,
}: HandballCourtSvgProps) {
  const geo = getHalfCourtGeometry();

  const colors = {
    floorGradientTop: '#133a65',
    floorGradientBottom: '#0b2442',
    creaseGradientTop: '#1f5f9f',
    creaseGradientBottom: '#15447a',
    lineCourt: 'rgba(235, 244, 255, 0.88)',
    lineCrease: '#ffffff',
    lineFreeThrow: 'rgba(215, 235, 255, 0.85)',
    goalStroke: '#f87171',
    goalNetHatch: 'rgba(255, 255, 255, 0.28)',
  };

  return (
    <svg
      className={className}
      viewBox={`0 0 ${COURT_WIDTH_METERS} ${HALF_COURT_LENGTH_METERS}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Handbollsplan officiell IHF-halvplan 20x20 meter"
      style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="hm-taraflex-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.floorGradientTop} />
          <stop offset="100%" stopColor={colors.floorGradientBottom} />
        </linearGradient>
        <linearGradient id="hm-taraflex-crease" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.creaseGradientTop} />
          <stop offset="100%" stopColor={colors.creaseGradientBottom} />
        </linearGradient>
      </defs>

      {/* Main Floor Surface (20m x 20m) */}
      <rect
        x={geo.boundary.x}
        y={geo.boundary.y}
        width={geo.boundary.width}
        height={geo.boundary.height}
        fill="url(#hm-taraflex-floor)"
      />

      {/* 6m Goal Area Floor Surface (Taraflex distinct fill) */}
      <path
        d={geo.goalAreaFill}
        fill="url(#hm-taraflex-crease)"
      />

      {/* Outer Court Boundary Lines */}
      <rect
        x={geo.boundary.x}
        y={geo.boundary.y}
        width={geo.boundary.width}
        height={geo.boundary.height}
        fill="none"
        stroke={colors.lineCourt}
        strokeWidth="0.08"
      />

      {/* Goal Net Backdrop (outside court at y < 0) */}
      {showNet && (
        <g id="goal-net" aria-hidden="true">
          <rect
            x={geo.goalNet.backRect.x}
            y={geo.goalNet.backRect.y}
            width={geo.goalNet.backRect.width}
            height={geo.goalNet.backRect.height}
            fill="rgba(0, 0, 0, 0.45)"
            stroke={colors.goalStroke}
            strokeWidth="0.06"
          />
          {geo.goalNet.hatches.map((h, i) => (
            <line
              key={i}
              x1={h.x1}
              y1={h.y1}
              x2={h.x2}
              y2={h.y2}
              stroke={colors.goalNetHatch}
              strokeWidth="0.04"
            />
          ))}
        </g>
      )}

      {/* Goal Line & Goal Posts */}
      <line
        x1={geo.goalLine.x1}
        y1={geo.goalLine.y1}
        x2={geo.goalLine.x2}
        y2={geo.goalLine.y2}
        stroke={colors.goalStroke}
        strokeWidth="0.14"
      />
      {geo.goalPosts.map((post, i) => (
        <line
          key={`post-${i}`}
          x1={post.x1}
          y1={post.y1}
          x2={post.x2}
          y2={post.y2}
          stroke={colors.goalStroke}
          strokeWidth="0.16"
        />
      ))}

      {/* 6m Goal Area Line (Målgårdslinje) */}
      <path
        className="ihf-goal-area-line"
        d={geo.goalAreaLine}
        fill="none"
        stroke={colors.lineCrease}
        strokeWidth="0.09"
      />

      {/* 4m Goalkeeper Restraint Line (Målvaktslinje) */}
      <line
        className="ihf-gk-restraint-line"
        x1={geo.goalkeeperRestraintLine.x1}
        y1={geo.goalkeeperRestraintLine.y1}
        x2={geo.goalkeeperRestraintLine.x2}
        y2={geo.goalkeeperRestraintLine.y2}
        stroke={colors.lineCourt}
        strokeWidth="0.09"
      />

      {/* 7m Penalty Line (Straffkastlinje, length 1.0m) */}
      <line
        className="ihf-penalty-mark"
        x1={geo.penaltyLine.x1}
        y1={geo.penaltyLine.y1}
        x2={geo.penaltyLine.x2}
        y2={geo.penaltyLine.y2}
        stroke={colors.lineCourt}
        strokeWidth="0.11"
      />

      {/* 9m Free Throw Line (Frikastlinje, dashed) */}
      <path
        className="ihf-free-throw-line"
        d={geo.freeThrowLine}
        fill="none"
        stroke={colors.lineFreeThrow}
        strokeWidth="0.08"
        strokeDasharray="0.32 0.28"
      />

      {/* Substitution Mark (Avbytarlinje at y = 15.5m, x = 0m) */}
      <line
        x1={geo.substitutionMark.x1}
        y1={geo.substitutionMark.y1}
        x2={geo.substitutionMark.x2}
        y2={geo.substitutionMark.y2}
        stroke={colors.lineCourt}
        strokeWidth="0.09"
      />

      {/* Center Halfway Line (stopping at center circle) */}
      {geo.halfwayLineSegments.map((seg, i) => (
        <line
          key={`halfway-${i}`}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={colors.lineCourt}
          strokeWidth="0.08"
        />
      ))}

      {/* Center Throw-off Circle (radius 2m at center line) */}
      <path
        d={geo.centerCircleArc}
        fill="none"
        stroke={colors.lineCourt}
        strokeWidth="0.08"
      />

      {children}
    </svg>
  );
}

export default HandballCourtSvg;
