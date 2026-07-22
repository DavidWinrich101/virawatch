/**
 * NationalSummary - National situational awareness cards
 * Displays key metrics at a glance
 * 
 * Version: 1.1 - Removed unused lowRiskStates
 * Last updated: 2026-07-21
 */

import React from 'react';
import { 
  Shield, AlertTriangle, MapPin, Calendar, 
  TrendingUp, TrendingDown, Minus 
} from 'lucide-react';

interface NationalSummaryProps {
  totalStates: number;
  highRiskStates: number;
  moderateRiskStates: number;
  currentEpiWeek: number;
  trend?: 'up' | 'down' | 'stable';
  isLoading?: boolean;
}

export const NationalSummary: React.FC<NationalSummaryProps> = ({
  totalStates = 37,
  highRiskStates = 0,
  moderateRiskStates = 0,
  currentEpiWeek,
  trend = 'stable',
  isLoading = false,
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-red-400" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendText = () => {
    if (trend === 'up') return 'Increasing';
    if (trend === 'down') return 'Decreasing';
    return 'Stable';
  };

  const cards = [
    {
      label: 'States Under Surveillance',
      value: totalStates,
      icon: MapPin,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      label: 'High Risk States',
      value: highRiskStates,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
    },
    {
      label: 'Moderate Risk States',
      value: moderateRiskStates,
      icon: Shield,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Current Epi Week',
      value: currentEpiWeek,
      icon: Calendar,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="skeleton-text w-24 h-4 mb-2" />
            <div className="skeleton-text w-12 h-6" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">National Overview</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">National Trend:</span>
          <span className="flex items-center gap-1 text-gray-300">
            {getTrendIcon()}
            {getTrendText()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`bg-gray-800/50 border ${card.borderColor} rounded-xl p-4`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-2">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};