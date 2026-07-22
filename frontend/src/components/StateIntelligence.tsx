/**
 * StateIntelligence - Dedicated state intelligence page
 * Resembles an intelligence report rather than a statistics page
 * 
 * Version: 1.1 - Fixed unused imports and variables
 * Last updated: 2026-07-21
 */

import React from 'react';
import {
  MapPin, Calendar, AlertTriangle, Droplets, Thermometer,
  Users, TrendingUp, Minus, Shield, Activity, Info
} from 'lucide-react';
import type { State, PredictionResult } from '../types';
import { NIGERIAN_STATES } from '../data/states';
import { SectionHeader, RiskGauge } from './shared';
import { getRiskBadgeColor, getRiskTier } from '../types';

interface StateIntelligenceProps {
  state: State | null;
  prediction?: PredictionResult | null;
  isLoading?: boolean;
  error?: string | null;
}

export const StateIntelligence: React.FC<StateIntelligenceProps> = ({
  state,
  prediction,
  isLoading = false,
  error = null,
}) => {
  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <MapPin className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Select a state to view intelligence</p>
        <p className="text-sm mt-1">Choose from the state list on the left</p>
      </div>
    );
  }

  const isEndemic = state.endemic;
  const probability = prediction?.probability || 0;
  const riskTier = prediction?.risk_tier || getRiskTier(probability, isEndemic);
  const badgeColor = getRiskBadgeColor(riskTier);

  const stateClimate = NIGERIAN_STATES.find(s => s.name === state.name);
  const rainfall = prediction?.features_used?.rainfall_lag8
    ? Number(prediction.features_used.rainfall_lag8)
    : 0;
  const temperature = stateClimate?.meanTempC || 27;
  const density = state.density;

  const getTrendIcon = () => {
    if (probability > 0.5) return <TrendingUp className="w-4 h-4 text-red-400" />;
    if (probability > 0.2) return <TrendingUp className="w-4 h-4 text-amber-400" />;
    return <Minus className="w-4 h-4 text-emerald-400" />;
  };

  const getSurveillancePriority = () => {
    if (riskTier === 'High' || riskTier === 'Critical') return 'Critical';
    if (riskTier === 'Moderate') return 'Elevated';
    if (riskTier === 'Low') return 'High';
    return 'Routine';
  };

  const priorityColors: Record<string, string> = {
    'Critical': 'bg-red-500/20 text-red-300 border-red-500/30',
    'Elevated': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'High': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'Routine': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  const priority = getSurveillancePriority();

  const intelligenceCards = [
    {
      label: 'Current Risk',
      value: riskTier,
      icon: Shield,
      color: badgeColor,
    },
    {
      label: 'Probability',
      value: `${Math.round(probability * 100)}%`,
      icon: Activity,
      color: 'text-cyan-400',
    },
    {
      label: 'Expected Cases',
      value: prediction ? `${prediction.case_range_low} - ${prediction.case_range_high}` : 'N/A',
      icon: Users,
      color: 'text-purple-400',
    },
    {
      label: 'Trend',
      value: probability > 0.5 ? 'Increasing' : probability > 0.2 ? 'Rising' : 'Stable',
      icon: getTrendIcon,
      color: 'text-gray-400',
    },
  ];

  const climateMetrics = [
    {
      icon: Droplets,
      label: 'Rainfall',
      value: rainfall > 0 ? `${rainfall.toFixed(1)} mm` : 'N/A',
      subtext: '8-week lag',
      color: 'text-blue-400',
    },
    {
      icon: Thermometer,
      label: 'Temperature',
      value: `${temperature.toFixed(1)}°C`,
      subtext: 'Annual average',
      color: 'text-orange-400',
    },
    {
      icon: Users,
      label: 'Population Density',
      value: `${density.toLocaleString()} /km²`,
      subtext: 'NPC 2023 projection',
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Intelligence Report styling */}
      <div className="flex items-start justify-between border-b border-gray-700 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{state.name}</h1>
            {isEndemic ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium badge-endemic">
                <AlertTriangle className="w-3 h-3" />
                Endemic
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium badge-nonendemic">
                Non-Endemic
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {state.region} Region • {density.toLocaleString()} people/km²
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-gray-300">Epi Week {prediction?.epi_week || 29}</span>
        </div>
      </div>

      {/* Intelligence Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {intelligenceCards.map((card) => (
          <div
            key={card.label}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
          >
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${typeof card.color === 'string' ? card.color : 'text-white'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Risk Assessment */}
      {!isLoading && !error && (
        <div className={`inline-flex items-center gap-4 px-4 py-3 rounded-lg border ${badgeColor}`}>
          <RiskGauge
            probability={probability}
            riskTier={riskTier}
            size="sm"
            showPercentage={true}
          />
          <div>
            <span className="text-xs opacity-70 uppercase tracking-wider">Weekly Risk Assessment</span>
            <span className="block text-lg font-bold">{riskTier} Risk</span>
            <span className="text-xs opacity-70">{Math.round(probability * 100)}% probability</span>
          </div>
        </div>
      )}

      {/* Surveillance Priority */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-gray-300">Surveillance Priority</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColors[priority]}`}>
            {priority}
          </span>
        </div>
      </div>

      {/* Climate Profile */}
      <div>
        <SectionHeader
          title="Climate Profile"
          subtitle="Current environmental conditions"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {climateMetrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center gap-2">
                <metric.icon className={`w-4 h-4 ${metric.color}`} />
                <span className="text-sm text-gray-400">{metric.label}</span>
              </div>
              <p className="text-lg font-bold text-white mt-2">{metric.value}</p>
              <p className="text-xs text-gray-500">{metric.subtext}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Forecast */}
      {prediction?.forecast && prediction.forecast.length > 0 && (
        <div>
          <SectionHeader
            title="Four Week Forecast"
            subtitle="Projected risk trend"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {prediction.forecast.map((week) => (
              <div
                key={week.week}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-center"
              >
                <p className="text-xs text-gray-500">Week {week.week}</p>
                <p className="text-lg font-bold text-white">{Math.round(week.probability * 100)}%</p>
                <span className={`text-xs ${
                  week.risk_tier === 'High' ? 'text-red-400' :
                  week.risk_tier === 'Moderate' ? 'text-amber-400' :
                  week.risk_tier === 'Low' ? 'text-cyan-400' :
                  'text-emerald-400'
                }`}>
                  {week.risk_tier}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operational Summary */}
      <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-500">
            <strong>Operational Summary:</strong> {state.name} is currently at <strong>{riskTier}</strong> risk level with
            {probability > 0 ? ` ${Math.round(probability * 100)}%` : ' no'} probability of outbreak.
            {isEndemic ? ' This is an endemic state requiring enhanced surveillance.' :
            ' This is a non-endemic state requiring routine surveillance.'}
            {priority === 'Critical' && ' Immediate response recommended.'}
            {prediction && ` Last updated: ${new Date(prediction.timestamp).toLocaleString()}`}
          </p>
        </div>
      </div>
    </div>
  );
};