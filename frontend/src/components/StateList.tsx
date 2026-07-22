import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, ShieldAlert, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { NIGERIAN_STATES, REGIONS } from '../data/states';
import { getPrediction } from '../lib/api';
import type { State, PredictionResult } from '../types';
import { getRiskBadgeColor } from '../types';

interface StateListProps {
  onSelectState: (state: State, prediction?: PredictionResult) => void;
  selectedState?: State | null;
}

export const StateList: React.FC<StateListProps> = ({ onSelectState, selectedState }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [predictions, setPredictions] = useState<Record<string, PredictionResult>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getCurrentEpiWeek = (date: Date): number => {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.floor(dayOfYear / 7) + 1;
  };

  const currentEpiWeek = getCurrentEpiWeek(new Date());
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchAllPredictions = async () => {
      setLoading(true);
      setError(null);
      
      const results: Record<string, PredictionResult> = {};
      const errors: string[] = [];

      const promises = NIGERIAN_STATES.map(async (state) => {
        try {
          const rainfall = 70;
          const temperature = 27;
          const recentCases = 0;
          const endemicFlag = state.endemic ? 1 : 0;

          const prediction = await getPrediction(
            state.name,
            currentEpiWeek,
            currentYear,
            rainfall,
            temperature,
            recentCases,
            endemicFlag,
            'rf'
          );
          results[state.name] = prediction;
        } catch (err) {
          errors.push(state.name);
        }
      });

      await Promise.allSettled(promises);
      
      setPredictions(results);
      if (errors.length > 0 && errors.length === NIGERIAN_STATES.length) {
        setError('Failed to fetch predictions. Please check your connection.');
      }
      setLoading(false);
    };

    fetchAllPredictions();
  }, []);

  const getRiskBadge = (state: State) => {
    const prediction = predictions[state.name];

    if (prediction) {
      const riskTier = prediction.risk_tier || 'Minimal';
      const colorClass = getRiskBadgeColor(riskTier);
      return (
        <span className={`risk-badge ${colorClass}`}>
          {riskTier}
        </span>
      );
    }

    // Fallback: muted endemic badge
    if (state.endemic) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium badge-endemic">
          <ShieldAlert className="w-3 h-3" />
          Endemic
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium badge-nonendemic">
        <ShieldCheck className="w-3 h-3" />
        Non-Endemic
      </span>
    );
  };

  const filteredStates = useMemo(() => {
    return NIGERIAN_STATES.filter((state) => {
      const matchesSearch = state.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRegion = selectedRegion === 'All' || state.region === selectedRegion;
      return matchesSearch && matchesRegion;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery, selectedRegion]);

  const handleStateClick = (state: State) => {
    const prediction = predictions[state.name];
    onSelectState(state, prediction);
  };

  return (
    <div className="w-full max-w-md bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-cyan-400" />
          States & FCT
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-2" />}
        </h2>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search states..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedRegion('All')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedRegion === 'All'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedRegion === region
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-xs text-red-200">{error}</span>
          </div>
        )}
      </div>

      <div className="max-h-100 overflow-y-auto">
        {filteredStates.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No states found</div>
        ) : (
          <ul className="divide-y divide-gray-700/50">
            {filteredStates.map((state) => (
              <li key={state.name}>
                <button
                  onClick={() => handleStateClick(state)}
                  className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors hover:bg-gray-700/50 ${
                    selectedState?.name === state.name ? 'bg-gray-700/70 border-l-2 border-cyan-400' : ''
                  }`}
                >
                  <div>
                    <span className="text-sm font-medium text-white">{state.name}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">{state.region}</span>
                  </div>
                  {getRiskBadge(state)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-2 bg-gray-900/50 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>{filteredStates.length} of {NIGERIAN_STATES.length} states</span>
        {!loading && Object.keys(predictions).length > 0 && (
          <span className="text-cyan-400">✓ Live predictions loaded</span>
        )}
      </div>
    </div>
  );
};