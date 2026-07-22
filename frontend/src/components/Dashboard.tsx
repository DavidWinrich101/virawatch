/**
 * ViraWatch - Dashboard Component
 * 
 * Displays selected state's risk profile and bioclimatic data.
 * Fetches real data from API and states.ts.
 * 
 * Version: 4.8 - Simplified hover effects
 * Last updated: 2026-07-22
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, Droplets, Thermometer, Users, 
  AlertTriangle, Info, MapPin, Calendar, Loader2
} from 'lucide-react';
import type { State, PredictionResult } from '../types';
import { NIGERIAN_STATES } from '../data/states';
import { MetricCard, SectionHeader, RiskGauge } from './shared';
import { getRiskBadgeColor, getRiskTier } from '../types';
import { NationalSummary } from './NationalSummary';

interface DashboardProps {
  selectedState: State | null;
  prediction?: PredictionResult | null;
  isLoading?: boolean;
  error?: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  selectedState, 
  prediction, 
  isLoading = false,
  error = null 
}) => {
  const [allPredictions, setAllPredictions] = useState<Record<string, PredictionResult>>({});
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);

  // Fetch predictions for all states to calculate national summary
  useEffect(() => {
    const fetchAllPredictions = async () => {
      setLoadingSummary(true);
      try {
        const { getPrediction } = await import('../lib/api');
        const results: Record<string, PredictionResult> = {};
        
        const currentEpiWeek = 29;
        const currentYear = 2026;

        const promises = NIGERIAN_STATES.map(async (state) => {
          try {
            const prediction = await getPrediction(
              state.name,
              currentEpiWeek,
              currentYear,
              70,
              27,
              0,
              state.endemic ? 1 : 0,
              'rf'
            );
            results[state.name] = prediction;
          } catch (err) {
            console.warn(`Failed to fetch prediction for ${state.name}`);
          }
        });

        await Promise.allSettled(promises);
        setAllPredictions(results);
      } catch (err) {
        console.warn('Failed to fetch national summary:', err);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchAllPredictions();
  }, []);

  // Calculate national summary stats
  const getNationalStats = () => {
    const predictions = Object.values(allPredictions);
    if (predictions.length === 0) {
      return { highRisk: 0, moderateRisk: 0, total: NIGERIAN_STATES.length };
    }

    let highRisk = 0;
    let moderateRisk = 0;

    predictions.forEach((p) => {
      const tier = p?.risk_tier || 'Minimal';
      if (tier === 'High' || tier === 'Critical') highRisk++;
      else if (tier === 'Moderate') moderateRisk++;
    });

    return { highRisk, moderateRisk, total: NIGERIAN_STATES.length };
  };

  const stats = getNationalStats();

  if (!selectedState) {
    return (
      <div className="space-y-6">
        <NationalSummary
          totalStates={stats.total}
          highRiskStates={stats.highRisk}
          moderateRiskStates={stats.moderateRisk}
          currentEpiWeek={29}
          trend="stable"
          isLoading={loadingSummary}
        />

        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <MapPin className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Select a state to view risk profile</p>
          <p className="text-sm mt-1">Choose from the state list on the left</p>
        </div>
      </div>
    );
  }

  const isEndemic = selectedState.endemic;
  const probability = prediction?.probability || 0;
  const riskTier = prediction?.risk_tier || getRiskTier(probability, isEndemic);
  const badgeColor = getRiskBadgeColor(riskTier);

  const stateClimate = NIGERIAN_STATES.find(s => s.name === selectedState.name);
  
  const rainfallRaw = prediction?.features_used?.rainfall_lag8 
    ? Number(prediction.features_used.rainfall_lag8) 
    : 0;
  
  const predictionYear = prediction?.year || new Date().getFullYear();
  const isEstimated = predictionYear > 2026;
  
  const rainfall = rainfallRaw > 0 ? rainfallRaw : 0;
  
  const temperature = stateClimate?.meanTempC || 27;
  const density = selectedState.density;
  const recentCases = prediction?.features_used?.confirmed_cases 
    ? Number(prediction.features_used.confirmed_cases) 
    : 0;

  // Metric card data with tooltips
  const metricCards = [
    {
      icon: Droplets,
      label: 'Rainfall',
      value: rainfall > 0 ? rainfall.toFixed(1) : 'N/A',
      unit: rainfall > 0 ? 'mm' : '',
      color: 'blue' as const,
      subtext: rainfall > 0 ? (isEstimated ? '8-week lag (estimated)' : '8-week lag') : 'No data',
      tooltip: isEstimated 
        ? 'Estimated 8-week lag rainfall. Real CHIRPS data available for 1981-2026.'
        : 'Rainfall from 8 weeks ago—captures rodent breeding cycle.',
      isEstimated: isEstimated,
    },
    {
      icon: Thermometer,
      label: 'Temperature',
      value: temperature.toFixed(1),
      unit: '°C',
      color: 'orange' as const,
      subtext: 'Annual average',
      tooltip: 'Annual mean temperature from WorldClim 2.1.',
      isEstimated: false,
    },
    {
      icon: Users,
      label: 'Population Density',
      value: density.toLocaleString(),
      unit: '/km²',
      color: 'purple' as const,
      subtext: 'NPC 2023 projection',
      tooltip: 'Higher density = increased human-rodent contact risk.',
      isEstimated: false,
    },
    {
      icon: Activity,
      label: 'Recent Cases',
      value: recentCases > 0 ? recentCases.toString() : '0',
      unit: 'cases',
      color: 'rose' as const,
      subtext: 'Current surveillance week',
      tooltip: 'Confirmed cases in the current epidemiological week.',
      isEstimated: false,
    },
  ];

  const recommendations = prediction?.recommendations || [
    {
      priority: 1,
      action: 'Maintain routine surveillance',
      timeline: 'Ongoing',
      responsible: 'Disease Surveillance Officer'
    },
    {
      priority: 2,
      action: 'Update health workers on case definitions',
      timeline: '1 month',
      responsible: 'Training Coordinator'
    }
  ];

  return (
    <div className="space-y-6">
      <NationalSummary
        totalStates={stats.total}
        highRiskStates={stats.highRisk}
        moderateRiskStates={stats.moderateRisk}
        currentEpiWeek={29}
        trend="stable"
        isLoading={loadingSummary}
      />

      {/* State Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {selectedState.name}
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
          </h1>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {selectedState.region} Region • {selectedState.density.toLocaleString()} people/km²
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-gray-300">Epi Week {prediction?.epi_week || 29}, {prediction?.year || 2026}</span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse flex items-center gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            Loading prediction...
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

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
            {probability > 0 && (
              <span className="text-xs opacity-70">{Math.round(probability * 100)}% probability</span>
            )}
          </div>
        </div>
      )}

      {/* Bioclimatic Profile */}
      <div>
        <SectionHeader 
          title="Bioclimatic Profile"
          subtitle="Current environmental conditions"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map((card) => (
            <div 
              key={card.label}
              className="relative group cursor-pointer"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 pointer-events-none">
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45 border-r border-b border-gray-700" />
                <p className="text-xs font-semibold text-cyan-400 mb-1">{card.label}</p>
                <p className="text-xs text-gray-300">{card.tooltip}</p>
              </div>

              {/* Card with hover effects */}
              <div className="transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/10 hover:border-cyan-500/30 rounded-xl border border-transparent">
                <MetricCard
                  icon={card.icon}
                  label={card.label}
                  value={card.value}
                  unit={card.unit}
                  color={card.color}
                  subtext={card.subtext}
                />
                {card.isEstimated && (
                  <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 rounded-full w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] text-amber-400 font-medium">Estimated</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <SectionHeader 
          title="Recommended Actions"
          subtitle="Based on current risk assessment"
        />
        <div className="space-y-2">
          {recommendations.map((rec) => (
            <div
              key={rec.priority}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-start gap-3 hover:border-cyan-500/20 transition-colors cursor-pointer hover:bg-gray-800/70"
            >
              <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-900/50 border border-cyan-700/50 text-cyan-400 text-xs font-bold flex items-center justify-center">
                {rec.priority}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{rec.action}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {rec.timeline}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {rec.responsible}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Source */}
      <div className="flex items-start gap-2 p-3 bg-gray-800/30 border border-gray-700/50 rounded-lg">
        <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-500">
          Data sources: NCDC Weekly Reports (2018-2024) • WorldClim 2.1 • CHIRPS Rainfall • NPC Population
          {prediction && ` • Last updated: ${new Date(prediction.timestamp).toLocaleString()}`}
        </p>
      </div>
    </div>
  );
};