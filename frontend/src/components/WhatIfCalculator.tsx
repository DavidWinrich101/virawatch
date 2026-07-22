/**
 * ViraWatch - Risk Level Calculator Component
 * 
 * Primary user interface for predicting Lassa fever outbreak risk.
 * Supports both Random Forest (Primary) and XGBoost (Comparison) models.
 * 
 * Version: 3.0 - Year dropdown with amber dot for future years
 * Last updated: 2026-07-21
 */

import { useState, useEffect } from 'react';
import { getPrediction } from '../lib/api';
import { NIGERIAN_STATES } from '../data/states';
import type { PredictionResult } from '../types';
import { 
  Loader2, Play, AlertCircle, Calendar, Thermometer, 
  Droplets, Users, Brain, Info, TrendingUp, 
  TrendingDown, Clock
} from 'lucide-react';
import { RiskGauge, MetricCard, SectionHeader, RecommendationGroup } from './shared';

// ============================================================================
// HELPERS
// ============================================================================

function getCurrentEpiWeek(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.floor(dayOfYear / 7) + 1;
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getCurrentDateTime(): string {
  return new Date().toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Generate week options 1-52
const WEEK_OPTIONS = Array.from({ length: 52 }, (_, i) => i + 1);

// Generate year options 2018-2030
const YEAR_OPTIONS = Array.from({ length: 13 }, (_, i) => 2018 + i);

// ============================================================================
// COMPONENT
// ============================================================================

export default function WhatIfCalculator() {
  // --- State ---
  const [selectedState, setSelectedState] = useState('Edo');
  const [epiWeek, setEpiWeek] = useState<number>(() => getCurrentEpiWeek(new Date()));
  const [year, setYear] = useState<number>(() => getCurrentYear());
  const [rainfall, setRainfall] = useState<number>(70);
  const [temperature, setTemperature] = useState<number>(27);
  const [recentCases, setRecentCases] = useState<number>(0);
  const [isEndemic, setIsEndemic] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<'rf' | 'xgb'>('rf');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false);

  const loadingMessages = [
    'Preparing surveillance profile...',
    'Loading environmental variables...',
    `Running ${selectedModel === 'rf' ? 'Random Forest' : 'XGBoost'} model...`,
    'Analyzing outbreak patterns...',
    'Generating forecast...',
  ];

  // --- Auto-derive date on load ---
  useEffect(() => {
    const now = new Date();
    setEpiWeek(getCurrentEpiWeek(now));
    setYear(getCurrentYear());
  }, []);

  // --- Update endemic flag when state changes ---
  useEffect(() => {
    const stateData = NIGERIAN_STATES.find(s => s.name === selectedState);
    setIsEndemic(stateData?.endemic || false);
  }, [selectedState]);

  // --- Helper: Safely get rainfall value ---
  const getRainfallValue = (): string => {
    if (!result?.features_used?.rainfall_lag8) return 'N/A';
    const val = result.features_used.rainfall_lag8;
    if (typeof val === 'number') return val.toFixed(1);
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 'N/A' : parsed.toFixed(1);
    }
    return 'N/A';
  };

  // --- Handle prediction with loading animation ---
  const handlePredict = async () => {
    // Validation
    if (recentCases < 0) {
      setError('Recent cases cannot be negative.');
      return;
    }
    if (recentCases > 10000) {
      setError('Recent cases exceeds historical maximum.');
      return;
    }
    if (rainfall < 0 || rainfall > 500) {
      setError('Rainfall should be between 0 and 500mm.');
      return;
    }
    if (temperature < 10 || temperature > 45) {
      setError('Temperature should be between 10°C and 45°C.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setShowLoadingMessage(true);
    setLoadingStep(0);

    try {
      const endemicFlag = isEndemic ? 1 : 0;

      // Animate through loading steps
      const stepInterval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < loadingMessages.length - 1) {
            return prev + 1;
          }
          clearInterval(stepInterval);
          return prev;
        });
      }, 350);

      const prediction = await getPrediction(
        selectedState,
        epiWeek,
        year,
        rainfall,
        temperature,
        recentCases,
        endemicFlag,
        selectedModel
      );

      clearInterval(stepInterval);
      setLoadingStep(loadingMessages.length - 1);

      // Wait 500ms before showing results
      await new Promise((resolve) => setTimeout(resolve, 500));

      setResult(prediction);
      setShowLoadingMessage(false);
    } catch (err) {
      setError('Failed to get prediction. Please try again.');
      console.error('Prediction error:', err);
      setShowLoadingMessage(false);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handle Enter key ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handlePredict();
    }
  };

  const handleClear = () => {
    setResult(null);
    setError(null);
  };

  const stateData = NIGERIAN_STATES.find(s => s.name === selectedState);

  // --- Generate explainability text ---
  const getExplainability = (): string => {
    if (!result) return '';
    const prob = result.probability;
    const tier = result.risk_tier;
    
    if (tier === 'High' || tier === 'Critical') {
      return `The model predicts a ${Math.round(prob * 100)}% probability of outbreak. This is primarily driven by the combination of current case trends, environmental conditions, and historical patterns in this region. Enhanced surveillance and preparedness measures are recommended.`;
    } else if (tier === 'Moderate') {
      return `The model predicts a ${Math.round(prob * 100)}% probability of outbreak. While immediate action may not be required, the environmental and epidemiological indicators suggest active monitoring is warranted.`;
    } else if (tier === 'Low') {
      return `The model predicts a ${Math.round(prob * 100)}% probability of outbreak. Current indicators suggest routine surveillance is sufficient at this time.`;
    } else {
      return `The model predicts a ${Math.round(prob * 100)}% probability of outbreak. All indicators remain within expected ranges for this region.`;
    }
  };

  // --- Check if year is future ---
  const isFutureYear = (yearValue: number): boolean => {
    return yearValue > getCurrentYear();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" onKeyDown={handleKeyDown}>
      {/* Header with Date/Time */}
      <div className="flex items-center justify-between">
        <div>
          <SectionHeader 
            title="Risk Level Calculator"
            subtitle="Assess Lassa fever outbreak risk for any state-week combination"
            icon={<Brain className="w-5 h-5 text-cyan-400" />}
            className="mb-0"
          />
        </div>
        <div className="text-right text-xs text-gray-500 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span>{getCurrentDateTime()}</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-200 text-sm">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 text-sm hover:text-red-300 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* State Selection */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              State
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {NIGERIAN_STATES.map((state) => (
                <option key={state.name} value={state.name}>
                  {state.name} {state.endemic ? '★' : ''}
                </option>
              ))}
            </select>
            {stateData && (
              <p className="text-xs text-gray-500">
                {stateData.region} • {stateData.density.toLocaleString()} people/km²
                {stateData.endemic && ' • Endemic State'}
              </p>
            )}
          </div>

          {/* Endemic Flag */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              Endemic Status
            </label>
            <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5">
              <button
                onClick={() => setIsEndemic(true)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  isEndemic ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Endemic
              </button>
              <button
                onClick={() => setIsEndemic(false)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  !isEndemic ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Non-Endemic
              </button>
              <span className="text-xs text-gray-500 ml-auto">
                {isEndemic ? '★ Higher baseline risk' : 'Lower baseline risk'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Epi Week - Dropdown */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Epi Week
            </label>
            <select
              value={epiWeek}
              onChange={(e) => setEpiWeek(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 max-h-48 overflow-y-auto"
            >
              {WEEK_OPTIONS.map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Select epidemiological week</p>
          </div>

          {/* Year - Dropdown with Amber Dot for Future Years */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 max-h-48 overflow-y-auto"
            >
              {YEAR_OPTIONS.map((yearOption) => {
                const isFuture = isFutureYear(yearOption);
                const isCurrent = yearOption === getCurrentYear();
                return (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                    {isCurrent ? ' (Current)' : ''}
                    {isFuture ? ' ★' : ''}
                  </option>
                );
              })}
            </select>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>2018-2030</span>
              {isFutureYear(year) && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Future projection</span>
                </span>
              )}
            </div>
          </div>

          {/* Recent Cases */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Recent Cases
            </label>
            <input
              type="number"
              min={0}
              max={10000}
              value={recentCases === 0 ? '' : recentCases}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || value === '-') {
                  setRecentCases(0);
                  return;
                }
                const num = Number(value);
                if (!isNaN(num)) {
                  setRecentCases(Math.min(10000, Math.max(0, num)));
                }
              }}
              onFocus={(e) => e.target.select()}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="0"
            />
            <p className="text-xs text-gray-500">Max: 10,000</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rainfall Slider */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              Rainfall: {rainfall} mm
            </label>
            <input
              type="range"
              min={0}
              max={450}
              value={rainfall}
              onChange={(e) => setRainfall(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0mm (Severe Dry)</span>
              <span>450mm (Heavy Monsoon)</span>
            </div>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              Temperature: {temperature}°C
            </label>
            <input
              type="range"
              min={15}
              max={45}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>15°C (Cool Season)</span>
              <span>45°C (Extreme Heat)</span>
            </div>
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Prediction Engine
          </label>
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5">
            <button
              onClick={() => setSelectedModel('rf')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                selectedModel === 'rf'
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Random Forest <span className="text-xs opacity-70">(Primary)</span>
            </button>
            <button
              onClick={() => setSelectedModel('xgb')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                selectedModel === 'xgb'
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              XGBoost <span className="text-xs opacity-70">(Comparison)</span>
            </button>
            <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
              <Info className="w-3 h-3" />
              <span className="hidden sm:inline">
                {selectedModel === 'rf' 
                  ? 'Best-performing validated model'
                  : 'Alternative model for research'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handlePredict}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing prediction...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Calculate Risk
              </>
            )}
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Loading Animation */}
      {isLoading && showLoadingMessage && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-sm text-gray-300">{loadingMessages[loadingStep]}</span>
          </div>
          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all duration-300"
              style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {result && !showLoadingMessage && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-6 animate-fadeIn">
          {/* Model Used Badge */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-300">
                Model Used: <span className="text-white font-medium">
                  {result.model_used || (selectedModel === 'rf' ? 'Random Forest (Primary)' : 'XGBoost (Comparison)')}
                </span>
              </span>
              {result.is_primary && (
                <span className="px-2 py-0.5 bg-cyan-900/50 text-cyan-400 text-xs rounded-full border border-cyan-700/30">
                  Best Performing
                </span>
              )}
              {result.isOfflineFallback && (
                <span className="px-2 py-0.5 bg-amber-900/50 text-amber-400 text-xs rounded-full border border-amber-700/30">
                  Offline Mode
                </span>
              )}
            </div>
          </div>

          {/* Risk Gauge + Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex justify-center md:justify-start">
              <RiskGauge 
                probability={result.probability}
                riskTier={result.risk_tier}
                label="Outbreak Risk"
                size="lg"
                showPercentage={true}
              />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <MetricCard
                icon={Users}
                label="Expected Cases"
                value={`${result.case_range_low} - ${result.case_range_high}`}
                color="teal"
              />
              <MetricCard
                icon={Calendar}
                label="Epi Week"
                value={result.epi_week.toString()}
                color="blue"
              />
              <MetricCard
                icon={Users}
                label="State"
                value={result.state}
                color="purple"
              />
              <MetricCard
                icon={Droplets}
                label="Rainfall"
                value={getRainfallValue()}
                unit="mm"
                color="blue"
              />
            </div>
          </div>

          {/* 4-Week Forecast - Central Feature */}
          {result.forecast && result.forecast.length > 0 && (
            <div className="space-y-3">
              <SectionHeader 
                title="Four Week Forecast"
                subtitle="Projected risk trend for the next 4 weeks"
                className="mb-0"
                icon={<Calendar className="w-4 h-4 text-cyan-400" />}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {result.forecast.map((week, index) => {
                  const isCurrent = index === 0;
                  const prevWeek = index > 0 ? result.forecast![index - 1] : null;
                  const isIncreasing = prevWeek && week.probability > prevWeek.probability;
                  const isDecreasing = prevWeek && week.probability < prevWeek.probability;
                  
                  return (
                    <div
                      key={week.week}
                      className={`bg-gray-900/50 border rounded-xl p-3 text-center transition-all hover:border-cyan-500/30 ${
                        isCurrent ? 'border-cyan-500/40' : 'border-gray-700'
                      }`}
                    >
                      <p className="text-xs text-gray-500">
                        {isCurrent ? 'Current' : `Week ${week.week}`}
                      </p>
                      <p className="text-lg font-bold text-white">
                        {Math.round(week.probability * 100)}%
                      </p>
                      <span className={`text-xs ${
                        week.risk_tier === 'High' || week.risk_tier === 'Critical' ? 'text-red-400' :
                        week.risk_tier === 'Moderate' ? 'text-amber-400' :
                        week.risk_tier === 'Low' ? 'text-cyan-400' :
                        'text-emerald-400'
                      }`}>
                        {week.risk_tier}
                      </span>
                      {isCurrent && (
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 mx-auto" />
                      )}
                      {isIncreasing && (
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <TrendingUp className="w-3 h-3 text-red-400" />
                          <span className="text-[10px] text-red-400">Rising</span>
                        </div>
                      )}
                      {isDecreasing && (
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <TrendingDown className="w-3 h-3 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400">Falling</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Explainability Section */}
          <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-gray-300">Prediction Explanation</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {getExplainability()}
            </p>
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            <SectionHeader 
              title="Recommendations"
              subtitle="Containment actions based on prediction"
              className="mb-0"
            />
            <RecommendationGroup
              stakeholder="State Ministry of Health"
              recommendations={result.recommendations}
              variant="numbered"
            />
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-500 border-t border-gray-700 pt-3 flex justify-between">
            <span>Prediction: {new Date(result.timestamp).toLocaleString()}</span>
            <span>{result.isOfflineFallback ? 'Offline' : 'Online'}</span>
          </div>
        </div>
      )}
    </div>
  );
}