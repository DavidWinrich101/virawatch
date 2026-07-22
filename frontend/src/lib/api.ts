/**
 * ViraWatch - API Client
 * 
 * Communicates with the FastAPI backend.
 * Supports both Random Forest and XGBoost models.
 * 
 * Last updated: 2026-07-22 (V4.1 - Production ready)
 */

import axios from 'axios';
import type { PredictionResult, ModelInfo, HealthStatus } from '../types';
import { NIGERIAN_STATES } from '../data/states';

// ============================================================================
// BASE URL — Production Ready
// ============================================================================

// Use environment variable if available, fallback to localhost for development
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// RISK CALCULATOR (Matches Backend Thresholds)
// ============================================================================

function calculateRiskTier(probability: number, isEndemic: boolean): 'Minimal' | 'Low' | 'Moderate' | 'High' {
  if (isEndemic) {
    if (probability >= 0.60) return 'High';
    if (probability >= 0.30) return 'Moderate';
    if (probability >= 0.10) return 'Low';
    return 'Minimal';
  } else {
    if (probability >= 0.40) return 'High';
    if (probability >= 0.20) return 'Moderate';
    if (probability >= 0.10) return 'Low';
    return 'Minimal';
  }
}

// ============================================================================
// RECOMMENDATIONS ENGINE
// ============================================================================

function generateRecommendations(riskTier: string, state?: string): { priority: number; action: string; timeline: string; responsible: string }[] {
  const stateName = state || 'the state';
  
  const recommendations: Record<string, { priority: number; action: string; timeline: string; responsible: string }[]> = {
    'High': [
      { 
        priority: 1, 
        action: `EMERGENCY: Activate State EOC for ${stateName} immediately`, 
        timeline: '24 hours', 
        responsible: 'State Epidemiologist' 
      },
      { 
        priority: 2, 
        action: 'Ensure Ribavirin stockpiles are available at all health facilities', 
        timeline: '48 hours', 
        responsible: 'State Logistics Officer' 
      },
      { 
        priority: 3, 
        action: 'Deploy rapid response teams to high-risk LGAs', 
        timeline: '72 hours', 
        responsible: 'Incident Manager' 
      },
    ],
    'Moderate': [
      { 
        priority: 1, 
        action: `ACTIVE: Enhanced surveillance in ${stateName} high-risk LGAs`, 
        timeline: '1 week', 
        responsible: 'LGA Disease Surveillance Officer' 
      },
      { 
        priority: 2, 
        action: 'Pre-position medical supplies and PPE', 
        timeline: '2 weeks', 
        responsible: 'State Logistics Officer' 
      },
      { 
        priority: 3, 
        action: 'Conduct community sensitization on Lassa fever prevention', 
        timeline: '2 weeks', 
        responsible: 'Health Education Officer' 
      },
    ],
    'Low': [
      { 
        priority: 1, 
        action: `MONITOR: Maintain routine surveillance in ${stateName}`, 
        timeline: 'Ongoing', 
        responsible: 'Disease Surveillance Officer' 
      },
      { 
        priority: 2, 
        action: 'Update health workers on case definitions', 
        timeline: '1 month', 
        responsible: 'Training Coordinator' 
      },
    ],
    'Minimal': [
      { 
        priority: 1, 
        action: `ROUTINE: Standard surveillance protocols in ${stateName}`, 
        timeline: 'Ongoing', 
        responsible: 'Disease Surveillance Officer' 
      },
    ],
  };
  
  return recommendations[riskTier] || recommendations['Minimal'];
}

// ============================================================================
// MODEL-SPECIFIC OFFLINE FALLBACK
// ============================================================================

/**
 * Generate offline prediction based on the selected model type.
 * Different models have different behavior, so we match the fallback
 * to the expected model behavior.
 */
function getOfflinePrediction(
  state: string, 
  epi_week: number, 
  year: number, 
  rainfall_mm: number = 150, 
  temp_c: number = 28, 
  recent_cases: number = 0,
  model: 'rf' | 'xgb' = 'rf'
): PredictionResult {
  const stateData = NIGERIAN_STATES.find(s => s.name === state);
  const isEndemic = stateData?.endemic || false;
  const density = stateData?.density || 100;

  let baseProb = 0.02;
  if (isEndemic) baseProb += 0.12;

  // Different density sensitivity per model
  if (model === 'rf') {
    baseProb += Math.min(density / 10000, 0.08);
  } else {
    baseProb += Math.min(density / 8000, 0.12);
  }

  // Different case sensitivity per model
  if (model === 'rf') {
    baseProb += Math.min(recent_cases * 0.04, 0.30);
  } else {
    baseProb += Math.min(recent_cases * 0.06, 0.45);
  }

  // Rainfall factor
  const rainfallFactor = rainfall_mm < 50 ? 0 :
                         rainfall_mm < 150 ? 0.05 :
                         rainfall_mm < 300 ? 0.12 :
                         rainfall_mm < 450 ? 0.08 : 0.03;
  baseProb += rainfallFactor;

  // Temperature factor
  const tempFactor = temp_c < 15 ? -0.02 :
                     temp_c > 35 ? -0.01 :
                     0.03;
  baseProb += tempFactor;

  // Seasonality (dry season = higher risk)
  const isDrySeason = (epi_week <= 12) || (epi_week >= 45);
  if (isDrySeason) baseProb += 0.04;

  // XGBoost gets a slight boost from seasonality
  if (model === 'xgb' && isDrySeason) baseProb += 0.03;

  // Clamp to realistic range
  baseProb = Math.max(0.001, Math.min(baseProb, 0.95));

  const riskTier: 'Minimal' | 'Low' | 'Moderate' | 'High' = calculateRiskTier(baseProb, isEndemic);
  const caseRangeLow = Math.round(baseProb * 3);
  const caseRangeHigh = Math.round(baseProb * 10);

  const modelNames = {
    rf: 'Random Forest (Primary) - Offline Fallback',
    xgb: 'XGBoost (Comparison) - Offline Fallback'
  };

  return {
    state,
    epi_week,
    year,
    probability: parseFloat(baseProb.toFixed(4)),
    raw_probability: parseFloat(baseProb.toFixed(4)),
    risk_tier: riskTier,
    case_range_low: caseRangeLow,
    case_range_high: caseRangeHigh,
    recommendations: generateRecommendations(riskTier, state),
    timestamp: new Date().toISOString(),
    isOfflineFallback: true,
    model_used: modelNames[model],
    model_type: model === 'rf' ? 'rf' : 'xgb',
    is_primary: model === 'rf',
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.warn('API health check failed, returning offline status');
    return { 
      status: 'offline', 
      model_loaded: false,
      scaler_loaded: false,
      platt_calibrator_loaded: false,
      version: '4.0.0',
      timestamp: new Date().toISOString()
    };
  }
}

export async function fetchModelInfo(): Promise<ModelInfo> {
  try {
    const response = await api.get('/model-info');
    return response.data;
  } catch (error) {
    console.warn('API model-info failed, returning fallback');
    return {
      algorithm: 'Random Forest with SMOTE Balancing',
      features: ['confirmed_cases', 'lag_1', 'lag_2', 'lag_3', 'lag_4', 'rainfall_lag8', 'temp_lag4', 'humidity_lag4', 'pop_density', 'is_endemic', 'epi_week', 'month', 'epi_week_sin', 'epi_week_cos'],
      training_period: '2018-2022',
      validation_period: 'W52 2022-2025',
      test_period: '2026 W1',
      last_trained: new Date().toISOString(),
      smote_applied: true,
      platt_scaling: false,
      metrics: {},
      models: {
        rf: {
          name: 'Random Forest',
          display_name: 'Random Forest (Primary)',
          is_primary: true,
          loaded: true,
          description: 'Best-performing validated model based on PR-AUC and Specificity'
        },
        xgb: {
          name: 'XGBoost',
          display_name: 'XGBoost (Comparison)',
          is_primary: false,
          loaded: true,
          description: 'Alternative model for research and comparison purposes'
        }
      },
      version: '4.0.0',
      primary_model: 'Random Forest'
    };
  }
}

export async function getPrediction(
  state: string,
  epi_week: number,
  year: number,
  rainfall_mm: number,
  temp_c: number,
  recent_cases: number,
  endemic_flag: number,
  model: 'rf' | 'xgb' = 'rf'
): Promise<PredictionResult> {
  try {
    const response = await api.get('/predict', {
      params: {
        state,
        epi_week,
        year,
        rainfall_mm,
        temp_c,
        recent_cases,
        endemic_flag,
        model,
      },
    });
    return response.data;
  } catch (error) {
    console.warn(`API prediction failed for model ${model}, using offline fallback`);
    return getOfflinePrediction(state, epi_week, year, rainfall_mm, temp_c, recent_cases, model);
  }
}

// ============================================================================
// COMPARE PREDICTIONS
// ============================================================================

export async function comparePredictions(
  state: string,
  epi_week: number,
  year: number,
  rainfall_mm: number,
  temp_c: number,
  recent_cases: number,
  endemic_flag: number
): Promise<any> {
  try {
    const response = await api.get('/predict-compare', {
      params: {
        state,
        epi_week,
        year,
        rainfall_mm,
        temp_c,
        recent_cases,
        endemic_flag,
      },
    });
    return response.data;
  } catch (error) {
    console.warn('API comparison failed:', error);
    return null;
  }
}

// ============================================================================
// BATCH PREDICTION
// ============================================================================

export async function getPredictionsBatch(
  params: {
    state: string;
    epi_week: number;
    year: number;
    rainfall_mm: number;
    temp_c: number;
    recent_cases: number;
    endemic_flag: number;
  }[],
  model: 'rf' | 'xgb' = 'rf'
): Promise<PredictionResult[]> {
  try {
    const response = await api.post('/predict-batch', { 
      predictions: params,
      model: model
    });
    return response.data.results;
  } catch (error) {
    console.warn(`API batch prediction failed for model ${model}, falling back to individual calls`);
    const results = await Promise.all(
      params.map(p => getPrediction(p.state, p.epi_week, p.year, p.rainfall_mm, p.temp_c, p.recent_cases, p.endemic_flag, model))
    );
    return results;
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default api;