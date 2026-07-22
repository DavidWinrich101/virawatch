/**
 * ViraWatch - TypeScript Type Definitions
 * 
 * These types must match the backend API responses.
 * Last updated: 2026-07-21 (V4.0 - Updated colour system)
 */

// ============================================================================
// STATE DATA TYPES
// ============================================================================

export interface State {
  name: string;
  region: string;
  density: number;
  endemic: boolean;
  meanTempC: number;
  precipSeasonality: number;
  vaporPressureKpa: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface Recommendation {
  priority: number;
  action: string;
  timeline: string;
  responsible: string;
}

export interface PredictionResult {
  state: string;
  epi_week: number;
  year: number;
  probability: number;
  raw_probability: number;
  risk_tier: 'Minimal' | 'Low' | 'Moderate' | 'High' | 'Critical';
  case_range_low: number;
  case_range_high: number;
  recommendations: Recommendation[];
  timestamp: string;
  features_used?: Record<string, number | string>;
  isOfflineFallback?: boolean;
  model_used?: string;
  model_type?: string;
  is_primary?: boolean;
  forecast?: ForecastItem[];
  confidence?: PredictionConfidence;
}

export interface ForecastItem {
  week: number;
  year: number;
  probability: number;
  risk_tier: string;
}

export interface PredictionConfidence {
  level: string;
  score: number;
  threshold_distance: number;
  justification: string;
}

export interface ModelInfo {
  algorithm: string;
  features: string[];
  training_period: string;
  validation_period: string;
  test_period: string;
  last_trained: string;
  smote_applied: boolean;
  platt_scaling: boolean;
  metrics: {
    train?: Metrics;
    validation?: Metrics;
    test?: Metrics;
  };
  models?: {
    rf: ModelMetadata;
    xgb: ModelMetadata;
  };
  version?: string;
  primary_model?: string;
  selection_reason?: string;
}

export interface ModelMetadata {
  name: string;
  display_name?: string;
  is_primary: boolean;
  loaded: boolean;
  description: string;
  metrics?: Record<string, any>;
  feature_importance?: Record<string, number>;
}

export interface Metrics {
  'PR-AUC': number;
  'F2-Score': number;
  Sensitivity: number;
  Precision: number;
  Specificity: number;
  'ROC-AUC'?: number;
  n_samples: number;
  n_positive: number;
}

export interface HealthStatus {
  status: 'operational' | 'offline';
  model_loaded: boolean;
  scaler_loaded: boolean;
  platt_calibrator_loaded: boolean;
  version: string;
  timestamp: string;
  models_loaded?: {
    random_forest: boolean;
    xgboost: boolean;
  };
  primary_model?: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface CalculatorState {
  selectedState: string;
  epiWeek: number;
  year: number;
  rainfall: number;
  temperature: number;
  recentCases: number;
  endemicFlag: boolean;
  isLoading: boolean;
  error: string | null;
  result: PredictionResult | null;
  selectedModel: 'rf' | 'xgb';
  showComparison: boolean;
  comparisonResult: any;
}

export interface DashboardState {
  selectedState: string;
  searchQuery: string;
  filterRegion: string | null;
  filterRisk: string | null;
}

// ============================================================================
// RISK CONSTANTS - UPDATED COLOUR SYSTEM
// ============================================================================

export const RISK_TIERS = {
  MINIMAL: 'Minimal',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical'
} as const;


// Risk colours (Emerald → Cyan → Amber → Orange → Red)
export const RISK_COLORS = {
  Minimal: 'bg-emerald-500',
  Low: 'bg-cyan-500',
  Moderate: 'bg-amber-500',
  High: 'bg-orange-500',
  Critical: 'bg-red-500',
} as const;

export const RISK_TEXT_COLORS = {
  Minimal: 'text-emerald-400',
  Low: 'text-cyan-400',
  Moderate: 'text-amber-400',
  High: 'text-orange-400',
  Critical: 'text-red-400',
} as const;

export const RISK_BADGE_COLORS = {
  Minimal: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Low: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  Moderate: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  High: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
} as const;

// Risk thresholds
export const ENDEMIC_THRESHOLDS = {
  Critical: 0.80,
  High: 0.60,
  Moderate: 0.30,
  Low: 0.10,
  Minimal: 0.0
};

export const NON_ENDEMIC_THRESHOLDS = {
  Critical: 0.80,
  High: 0.40,
  Moderate: 0.20,
  Low: 0.10,
  Minimal: 0.0
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRiskColor(riskTier: string): string {
  const colors: Record<string, string> = {
    'Minimal': 'bg-emerald-500',
    'Low': 'bg-cyan-500',
    'Moderate': 'bg-amber-500',
    'High': 'bg-orange-500',
    'Critical': 'bg-red-500',
  };
  return colors[riskTier] || 'bg-gray-500';
}

export function getRiskTextColor(riskTier: string): string {
  const colors: Record<string, string> = {
    'Minimal': 'text-emerald-400',
    'Low': 'text-cyan-400',
    'Moderate': 'text-amber-400',
    'High': 'text-orange-400',
    'Critical': 'text-red-400',
  };
  return colors[riskTier] || 'text-gray-400';
}

export function getRiskBadgeColor(riskTier: string): string {
  const colors: Record<string, string> = {
    'Minimal': 'risk-badge-minimal',
    'Low': 'risk-badge-low',
    'Moderate': 'risk-badge-moderate',
    'High': 'risk-badge-high',
    'Critical': 'risk-badge-critical',
  };
  return colors[riskTier] || 'risk-badge-minimal';
}

export function getRiskTier(probability: number, isEndemic: boolean): 'Minimal' | 'Low' | 'Moderate' | 'High' | 'Critical' {
  const thresholds = isEndemic ? ENDEMIC_THRESHOLDS : NON_ENDEMIC_THRESHOLDS;
  if (probability >= thresholds.Critical) return 'Critical';
  if (probability >= thresholds.High) return 'High';
  if (probability >= thresholds.Moderate) return 'Moderate';
  if (probability >= thresholds.Low) return 'Low';
  return 'Minimal';
}

// Model display names
export const MODEL_DISPLAY_NAMES = {
  rf: 'Random Forest (Primary)',
  xgb: 'XGBoost (Comparison)'
} as const;

export const MODEL_DESCRIPTIONS = {
  rf: 'Best-performing validated model based on PR-AUC and Specificity',
  xgb: 'Alternative model for research and comparison purposes'
} as const;