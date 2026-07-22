/**
 * MetricCard - Standard metric display card
 * Used for rainfall, temperature, population, cases, etc.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  color?: 'teal' | 'blue' | 'purple' | 'orange' | 'rose' | 'gray';
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon: Icon,
  label,
  value,
  unit,
  subtext,
  color = 'teal',
  className = '',
}) => {
  const colorMap = {
    teal: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    gray: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors ${className}`}>
      <div className={`w-8 h-8 rounded-lg ${colorMap[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      {subtext && (
        <p className="text-xs text-gray-500 mt-0.5">{subtext}</p>
      )}
    </div>
  );
};

export default MetricCard;