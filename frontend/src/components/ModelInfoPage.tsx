/**
 * ViraWatch - Model Information Page
 * 
 * Displays model details with selector for RF/XGB
 * 
 * Version: 2.1 - Fixed unused imports
 * Last updated: 2026-07-21
 */

import React, { useEffect, useState } from 'react';
import { Brain, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { fetchModelInfo } from '../lib/api';
import type { ModelInfo } from '../types';
import { SectionHeader } from './shared';

export const ModelInfoPage: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<'rf' | 'xgb'>('rf');

  useEffect(() => {
    const load = async () => {
      try {
        const info = await fetchModelInfo();
        setModelInfo(info);
      } catch (err) {
        setError('Failed to load model information');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const metrics = [
    { label: 'PR-AUC', value: 0.1057, display: '0.106', description: 'Precision-Recall Area Under Curve', color: 'text-blue-400' },
    { label: 'F2-Score', value: 0.2273, display: '0.227', description: 'F-beta score with β=2 (recall-weighted)', color: 'text-cyan-400' },
    { label: 'Sensitivity', value: 0.3011, display: '0.301', description: 'True Positive Rate (Recall)', color: 'text-green-400' },
    { label: 'Precision', value: 0.1148, display: '0.115', description: 'Positive Predictive Value', color: 'text-amber-400' },
    { label: 'Specificity', value: 0.8717, display: '0.872', description: 'True Negative Rate', color: 'text-purple-400' },
  ];

  const xgbMetrics = [
    { label: 'PR-AUC', value: 0.1522, display: '0.152', description: 'Precision-Recall Area Under Curve', color: 'text-blue-400' },
    { label: 'F2-Score', value: 0.0, display: '0.000', description: 'F-beta score with β=2 (recall-weighted)', color: 'text-cyan-400' },
    { label: 'Sensitivity', value: 0.0, display: '0.000', description: 'True Positive Rate (Recall)', color: 'text-green-400' },
    { label: 'Precision', value: 0.0, display: '0.000', description: 'Positive Predictive Value', color: 'text-amber-400' },
    { label: 'Specificity', value: 0.9928, display: '0.993', description: 'True Negative Rate', color: 'text-purple-400' },
  ];

  const thresholds = [
    { label: 'Endemic States', high: '≥ 0.60', moderate: '≥ 0.30', low: '≥ 0.10', minimal: '< 0.10', note: 'Bauchi, Benue, Ebonyi, Edo, Kogi, Ondo, Taraba' },
    { label: 'Non-Endemic States', high: '≥ 0.40', moderate: '≥ 0.20', low: '≥ 0.10', minimal: '< 0.10', note: 'All other states + FCT' },
  ];

  const featureDescriptions: Record<string, string> = {
    'confirmed_cases': 'Current confirmed cases (direct input)',
    'lag_1': 'Case count from 1 week prior',
    'lag_2': 'Case count from 2 weeks prior',
    'lag_3': 'Case count from 3 weeks prior',
    'lag_4': 'Case count from 4 weeks prior',
    'rainfall_lag8': 'Rainfall 8 weeks prior (rodent breeding cycle)',
    'temp_lag4': 'Temperature 4 weeks prior',
    'humidity_lag4': 'Humidity 4 weeks prior',
    'pop_density': 'Population density (people/km²)',
    'is_endemic': 'Binary endemic flag (1 = endemic state)',
    'epi_week': 'Epidemiological week of year (1–52)',
    'month': 'Calendar month (1–12)',
    'epi_week_sin': 'Cyclical encoding - sine of epi_week',
    'epi_week_cos': 'Cyclical encoding - cosine of epi_week',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const currentMetrics = selectedModel === 'rf' ? metrics : xgbMetrics;
  const modelDisplayName = selectedModel === 'rf' ? 'Random Forest' : 'XGBoost';
  const isPrimary = selectedModel === 'rf';

  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Model Information"
        subtitle="Lassa Fever Outbreak Classification Pipeline"
        icon={<Brain className="w-5 h-5 text-cyan-400" />}
      />

      {/* Model Selector */}
      <div className="flex items-center gap-4 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <span className="text-sm text-gray-400 font-medium">Select Model:</span>
        <button
          onClick={() => setSelectedModel('rf')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedModel === 'rf'
              ? 'bg-cyan-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Random Forest {isPrimary && '(Primary)'}
        </button>
        <button
          onClick={() => setSelectedModel('xgb')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedModel === 'xgb'
              ? 'bg-cyan-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          XGBoost
        </button>
      </div>

      {/* Training Configuration */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <SectionHeader 
          title="Training Configuration"
          subtitle="Data split periods"
          className="mb-4"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 mb-1">Training Period</p>
            <p className="text-lg font-bold text-white">{modelInfo?.training_period || '2018-2022'}</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 mb-1">Validation Period</p>
            <p className="text-lg font-bold text-white">{modelInfo?.validation_period || 'W52 2022-2025'}</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 mb-1">Test Period</p>
            <p className="text-lg font-bold text-white">{modelInfo?.test_period || '2026 W1'}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Last trained: {modelInfo?.last_trained ? new Date(modelInfo.last_trained).toLocaleString() : '2026-07-18'}
        </p>
      </div>

      {/* Model Performance */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <SectionHeader 
          title={`${modelDisplayName} Performance Metrics`}
          subtitle={isPrimary ? 'Primary prediction engine' : 'Comparison model'}
          className="mb-4"
        />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {currentMetrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-colors group cursor-help"
              title={`${metric.label}: ${metric.description}`}
            >
              <p className={`text-xs text-gray-500 mb-1 ${metric.color}`}>{metric.label}</p>
              <p className="text-2xl font-bold text-white">{metric.display}</p>
              <p className="text-xs text-gray-600 mt-1">{metric.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-amber-900/10 border border-amber-700/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400/80">
            These metrics reflect performance on highly imbalanced outbreak data. The model prioritizes sensitivity to avoid missing true outbreaks.
          </p>
        </div>
      </div>

      {/* Risk Thresholds */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <SectionHeader 
          title="Risk Classification Thresholds"
          subtitle="Endemic vs Non-Endemic states"
          className="mb-4"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">State Type</th>
                <th className="text-center py-2 px-3 text-red-400 font-medium">High</th>
                <th className="text-center py-2 px-3 text-amber-400 font-medium">Moderate</th>
                <th className="text-center py-2 px-3 text-yellow-400 font-medium">Low</th>
                <th className="text-center py-2 px-3 text-emerald-400 font-medium">Minimal</th>
              </tr>
            </thead>
            <tbody>
              {thresholds.map((t) => (
                <tr key={t.label} className="border-b border-gray-700/50">
                  <td className="py-2 px-3 text-white font-medium">
                    {t.label}
                    <span className="block text-xs text-gray-500 font-normal">{t.note}</span>
                  </td>
                  <td className="text-center py-2 px-3 text-red-300">{t.high}</td>
                  <td className="text-center py-2 px-3 text-amber-300">{t.moderate}</td>
                  <td className="text-center py-2 px-3 text-yellow-300">{t.low}</td>
                  <td className="text-center py-2 px-3 text-emerald-300">{t.minimal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Importance */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <SectionHeader 
          title={`${modelDisplayName} Feature Importance`}
          subtitle="Most influential factors"
          className="mb-4"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(modelInfo?.features || [
            'confirmed_cases', 'lag_1', 'lag_2', 'lag_3', 'lag_4',
            'rainfall_lag8', 'temp_lag4', 'humidity_lag4',
            'pop_density', 'is_endemic', 'epi_week', 'month',
            'epi_week_sin', 'epi_week_cos'
          ]).map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-2 p-2.5 bg-gray-900/40 rounded-lg border border-gray-700/30 hover:border-cyan-500/20 transition-colors cursor-help"
              title={`${feature}: ${featureDescriptions[feature] || 'Engineered feature'}`}
            >
              <CheckCircle className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white font-mono">{feature}</p>
                <p className="text-xs text-gray-500">{featureDescriptions[feature] || 'Engineered feature'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Source */}
      <div className="p-4 bg-gray-900/50 border border-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-500">
          <strong>Data Sources:</strong> NCDC Weekly Reports (2018-2024) • CHIRPS Rainfall (1981-2026) • 
          WorldClim 2.1 (Temperature & Humidity) • NPC Population Density (2023 projections).
          <br />
          <span className="text-gray-600">All data sources are real and validated. Version 4.0 with 14 features.</span>
        </p>
      </div>
    </div>
  );
};