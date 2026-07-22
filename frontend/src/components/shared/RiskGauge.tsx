/**
 * RiskGauge - Visual risk indicator
 * Displays risk probability as a circular progress gauge
 * Colour-coded based on risk tier: 
 *   Minimal (Emerald)  → #10B981
 *   Low (Cyan)         → #00C8F8
 *   Moderate (Amber)   → #F59E0B
 *   High (Orange)      → #F97316
 *   Critical (Red)     → #EF4444
 * 
 * Version: 2.3 - Removed unused textColor
 */

import React from 'react';

interface RiskGaugeProps {
  probability: number;
  riskTier: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}

const RiskGauge: React.FC<RiskGaugeProps> = ({
  probability,
  riskTier,
  label,
  size = 'md',
  showPercentage = true,
  className = '',
}) => {
  const p = Math.max(0, Math.min(probability, 1));
  const percentage = Math.round(p * 100);

  const tierColors: Record<string, string> = {
    'Critical': '#EF4444',
    'High': '#F97316',
    'Moderate': '#F59E0B',
    'Low': '#00C8F8',
    'Minimal': '#10B981',
  };

  const color = tierColors[riskTier] || tierColors['Minimal'];

  const sizeMap = {
    sm: { container: 'w-16 h-16', text: 'text-base font-bold', stroke: 5, radius: 32 },
    md: { container: 'w-24 h-24', text: 'text-xl font-bold', stroke: 6, radius: 38 },
    lg: { container: 'w-36 h-36', text: 'text-3xl font-bold', stroke: 8, radius: 42 },
  };

  const sizeConfig = sizeMap[size];
  const radius = sizeConfig.radius;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - p);

  const viewBoxSize = (radius + 10) * 2;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative">
        <svg
          className={`${sizeConfig.container} transform -rotate-90`}
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        >
          <circle
            cx={viewBoxSize / 2}
            cy={viewBoxSize / 2}
            r={radius}
            fill="none"
            stroke="#1A2233"
            strokeWidth={sizeConfig.stroke}
          />
          <circle
            cx={viewBoxSize / 2}
            cy={viewBoxSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={sizeConfig.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          {showPercentage && (
            <span className={`text-white ${sizeConfig.text}`}>
              {percentage}%
            </span>
          )}
        </div>
      </div>

      {label && (
        <span className="text-xs text-gray-400 mt-1.5">{label}</span>
      )}
    </div>
  );
};

export default RiskGauge;