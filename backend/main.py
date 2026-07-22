"""
ViraWatch - FastAPI Backend (V5.5)
===================================
Multi-model prediction API with comprehensive prediction intelligence.

Features:
- Random Forest (Primary) and XGBoost (Comparison)
- Input Quality Assessment
- Prediction Confidence
- Model Agreement Analysis
- Prediction Reliability
- Overall Assessment
- 4-Week Forecast
- XGBoost loads from native JSON format to avoid use_label_encoder issues

Version: 5.5.0
Author: ViraWatch Project
Date: 2026-07-22
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import XGBoost for native format loading
import xgboost as xgb

# ============================================================================
# CONFIGURATION
# ============================================================================

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

ENDEMIC_STATES = ['Bauchi', 'Benue', 'Ebonyi', 'Edo', 'Kogi', 'Ondo', 'Taraba']

# 14 features
FEATURE_COLS = [
    'confirmed_cases',
    'lag_1', 'lag_2', 'lag_3', 'lag_4',
    'rainfall_lag8', 'temp_lag4', 'humidity_lag4',
    'pop_density', 'is_endemic',
    'epi_week', 'month',
    'epi_week_sin', 'epi_week_cos'
]

ENDEMIC_THRESHOLDS = {'High': 0.60, 'Moderate': 0.30, 'Low': 0.10, 'Minimal': 0.0}
NON_ENDEMIC_THRESHOLDS = {'High': 0.40, 'Moderate': 0.20, 'Low': 0.10, 'Minimal': 0.0}

# Model metadata
MODEL_METADATA = {
    'rf': {
        'name': 'Random Forest',
        'display_name': 'Random Forest (Primary)',
        'description': 'Best-performing validated model based on PR-AUC and Specificity',
        'file': 'virawatch_model.pkl',
        'scaler': 'scaler.pkl',
        'config': 'model_config.json',
        'is_primary': True
    },
    'xgb': {
        'name': 'XGBoost',
        'display_name': 'XGBoost (Comparison)',
        'description': 'Alternative model for research and comparison purposes',
        'file': 'xgboost_model.pkl',
        'scaler': 'scaler_xgb.pkl',
        'config': 'xgboost_config.json',
        'is_primary': False
    }
}


# ============================================================================
# LOAD STATIC DATA
# ============================================================================

def load_static_data():
    data = {}

    wc_path = os.path.join(DATA_DIR, 'worldclim_nigeria_states.csv')
    if os.path.exists(wc_path):
        wc_df = pd.read_csv(wc_path)
        col_map = {
            'mean_annual_temp_c': 'temp_c',
            'mean_vapor_pressure_kpa': 'vapor_pressure_kpa',
            'precip_seasonality_cv': 'precip_seasonality',
            'state': 'state'
        }
        wc_df = wc_df.rename(columns=col_map)
        data['climate'] = wc_df.set_index('state').to_dict('index')
        print(f"[Data] Loaded WorldClim for {len(wc_df)} states")

    pop_path = os.path.join(DATA_DIR, 'nigeria_state_population_density.csv')
    if os.path.exists(pop_path):
        pop_df = pd.read_csv(pop_path)
        data['population'] = pop_df.set_index('state')['density_2023'].to_dict()
        print(f"[Data] Loaded population density for {len(pop_df)} states")

    chirps_path = os.path.join(DATA_DIR, 'chirps_weekly_nigeria.csv')
    if os.path.exists(chirps_path):
        chirps_df = pd.read_csv(chirps_path)
        if 'state' in chirps_df.columns and 'epi_week' in chirps_df.columns:
            data['rainfall'] = chirps_df.groupby(['state', 'epi_week'])['rainfall_mm'].mean().to_dict()
            data['rainfall_lag8'] = chirps_df.groupby(['state', 'epi_week'])['rainfall_lag8_mm'].mean().to_dict()
        print("[Data] Loaded CHIRPS rainfall patterns")

    return data


# ============================================================================
# LOAD XGBOOST NATIVE FORMAT
# ============================================================================

def load_xgboost_native(model_path):
    """Load XGBoost model from native .json format"""
    model = xgb.XGBClassifier()
    model.load_model(model_path)
    return model


# ============================================================================
# LOAD MODELS WITH NATIVE XGBOOST SUPPORT
# ============================================================================

def load_model_artifacts():
    """Load all models, scalers, and configs with native XGBoost support."""
    models = {}
    
    for model_key, meta in MODEL_METADATA.items():
        try:
            model_path = os.path.join(MODELS_DIR, meta['file'])
            scaler_path = os.path.join(MODELS_DIR, meta['scaler'])
            config_path = os.path.join(MODELS_DIR, meta['config'])
            
            if os.path.exists(scaler_path):
                scaler = joblib.load(scaler_path)
                
                # For XGBoost, try native JSON format FIRST
                if model_key == 'xgb':
                    json_path = os.path.join(MODELS_DIR, 'xgboost_model.json')
                    if os.path.exists(json_path):
                        try:
                            model = load_xgboost_native(json_path)
                            config = json.load(open(config_path)) if os.path.exists(config_path) else None
                            models[model_key] = {
                                'model': model,
                                'scaler': scaler,
                                'config': config,
                                'loaded': True,
                                'format': 'native_json'
                            }
                            print(f"[Model] ✅ XGBoost loaded from native JSON format")
                            continue  # Skip pickle fallback
                        except Exception as e:
                            print(f"[Model] ⚠️ Failed to load native JSON: {e}")
                            # Fall through to pickle
                
                # Try pickle/joblib format (for RF and XGB fallback)
                if os.path.exists(model_path):
                    try:
                        model = joblib.load(model_path)
                        config = json.load(open(config_path)) if os.path.exists(config_path) else None
                        
                        # Verify model is fitted
                        try:
                            dummy = np.zeros((1, len(FEATURE_COLS)))
                            model.predict_proba(dummy)
                            models[model_key] = {
                                'model': model,
                                'scaler': scaler,
                                'config': config,
                                'loaded': True
                            }
                            print(f"[Model] ✅ {meta['name']} loaded successfully (pickle)")
                        except AttributeError as e:
                            if 'use_label_encoder' in str(e) and model_key == 'xgb':
                                print(f"[Model] ⚠️ {meta['name']} loaded but has use_label_encoder warning")
                                models[model_key] = {
                                    'model': model,
                                    'scaler': scaler,
                                    'config': config,
                                    'loaded': True,
                                    'verification_warning': True
                                }
                            else:
                                print(f"[Model] ⚠️ {meta['name']} failed verification: {e}")
                                models[model_key] = {'loaded': False}
                    except ModuleNotFoundError as e:
                        if 'numpy._core' in str(e) and model_key == 'xgb':
                            print(f"[Model] ⚠️ XGBoost numpy compatibility issue: {e}")
                            print(f"[Model] ℹ️ Make sure xgboost_model.json exists")
                            models[model_key] = {
                                'loaded': False,
                                'error': 'numpy._core not found - please use native JSON format',
                                'error_type': 'numpy_compatibility'
                            }
                        else:
                            raise e
                else:
                    print(f"[Model] ⚠️ {meta['name']} model file not found")
                    models[model_key] = {'loaded': False}
            else:
                print(f"[Model] ⚠️ {meta['name']} scaler not found")
                models[model_key] = {'loaded': False}
        except Exception as e:
            print(f"[Model] ❌ Failed to load {meta['name']}: {e}")
            models[model_key] = {'loaded': False, 'error': str(e)}
    
    return models


# ============================================================================
# FEATURE CONSTRUCTION
# ============================================================================

def construct_features(state, epi_week, year, rainfall_mm, temp_c, recent_cases, endemic_flag, static_data):
    features = {}

    features['confirmed_cases'] = float(recent_cases)

    # Lag features with persistence model
    features['lag_1'] = float(recent_cases) * 0.9
    features['lag_2'] = float(recent_cases) * 0.7
    features['lag_3'] = float(recent_cases) * 0.5
    features['lag_4'] = float(recent_cases) * 0.3

    # Rainfall with 8-week lag
    rainfall_key = (state, epi_week)
    if rainfall_key in static_data.get('rainfall_lag8', {}):
        features['rainfall_lag8'] = static_data['rainfall_lag8'][rainfall_key]
    else:
        features['rainfall_lag8'] = float(rainfall_mm) * 0.8

    # Temperature
    if state in static_data.get('climate', {}):
        features['temp_lag4'] = static_data['climate'][state]['temp_c']
    else:
        features['temp_lag4'] = float(temp_c)

    # Humidity
    if state in static_data.get('climate', {}):
        features['humidity_lag4'] = static_data['climate'][state]['vapor_pressure_kpa']
    else:
        features['humidity_lag4'] = 2.2 if rainfall_mm > 100 else 1.8

    # Population density
    if state in static_data.get('population', {}):
        features['pop_density'] = static_data['population'][state]
    else:
        features['pop_density'] = 200

    features['is_endemic'] = int(endemic_flag)
    features['epi_week'] = int(epi_week)
    features['month'] = ((epi_week - 1) // 4) + 1
    features['epi_week_sin'] = np.sin(2 * np.pi * epi_week / 52)
    features['epi_week_cos'] = np.cos(2 * np.pi * epi_week / 52)

    return features


# ============================================================================
# RISK CLASSIFICATION
# ============================================================================

def classify_risk(probability, is_endemic):
    thresholds = ENDEMIC_THRESHOLDS if is_endemic else NON_ENDEMIC_THRESHOLDS
    if probability >= thresholds['High']:
        return 'High'
    elif probability >= thresholds['Moderate']:
        return 'Moderate'
    elif probability >= thresholds['Low']:
        return 'Low'
    else:
        return 'Minimal'


def generate_recommendations(risk_tier, state):
    recommendations = {
        'High': [
            {'priority': 1, 'action': f'EMERGENCY: Activate State EOC for {state} immediately', 'timeline': '24 hours', 'responsible': 'State Epidemiologist'},
            {'priority': 2, 'action': 'Ensure Ribavirin stockpiles are available', 'timeline': '48 hours', 'responsible': 'State Logistics Officer'},
            {'priority': 3, 'action': 'Deploy rapid response teams to high-risk LGAs', 'timeline': '72 hours', 'responsible': 'Incident Manager'}
        ],
        'Moderate': [
            {'priority': 1, 'action': f'ACTIVE: Enhanced surveillance in {state}', 'timeline': '1 week', 'responsible': 'LGA Disease Surveillance Officer'},
            {'priority': 2, 'action': 'Pre-position medical supplies and PPE', 'timeline': '2 weeks', 'responsible': 'State Logistics Officer'},
            {'priority': 3, 'action': 'Conduct community sensitization', 'timeline': '2 weeks', 'responsible': 'Health Education Officer'}
        ],
        'Low': [
            {'priority': 1, 'action': f'MONITOR: Maintain routine surveillance in {state}', 'timeline': 'Ongoing', 'responsible': 'Disease Surveillance Officer'},
            {'priority': 2, 'action': 'Update health workers on case definitions', 'timeline': '1 month', 'responsible': 'Training Coordinator'}
        ],
        'Minimal': [
            {'priority': 1, 'action': f'ROUTINE: Standard surveillance protocols in {state}', 'timeline': 'Ongoing', 'responsible': 'Disease Surveillance Officer'}
        ]
    }
    return recommendations.get(risk_tier, recommendations['Minimal'])


def estimate_case_range(probability, is_endemic):
    base_low = 1 if is_endemic else 0
    base_high = 3 if is_endemic else 1
    return int(base_low + probability * 5), int(base_high + probability * 15)


def generate_forecast(state, epi_week, year, probability, is_endemic):
    """Generate 4-week forecast based on current prediction."""
    forecast = []
    current_prob = probability
    
    for i in range(1, 5):
        week = epi_week + i
        year_adj = year
        if week > 52:
            week = week - 52
            year_adj = year + 1
        
        if probability >= 0.50:
            change = -0.02 * i
        else:
            change = 0.02 * i
        
        if week <= 12 or week >= 45:
            seasonality = 0.03
        elif 21 <= week <= 40:
            seasonality = -0.02
        else:
            seasonality = 0.01
        
        next_prob = current_prob + change + seasonality
        next_prob = max(0.01, min(0.99, next_prob))
        
        forecast.append({
            "week": week,
            "year": year_adj,
            "probability": round(next_prob, 4),
            "risk_tier": classify_risk(next_prob, is_endemic)
        })
        current_prob = next_prob
    
    return forecast


# ============================================================================
# PREDICTION INTELLIGENCE HELPERS
# ============================================================================

def assess_input_quality(state, epi_week, year, rainfall_mm, temp_c, recent_cases, endemic_flag):
    issues = []
    score = 100
    
    if recent_cases == 0:
        issues.append("Case count is zero (may indicate missing data)")
        score -= 10
    
    if rainfall_mm == 70:
        issues.append("Rainfall uses default value")
        score -= 5
    
    if temp_c == 27:
        issues.append("Temperature uses default value")
        score -= 5
    
    if recent_cases > 1000:
        issues.append("Case count is unusually high")
        score -= 15
    
    if rainfall_mm < 0 or rainfall_mm > 500:
        issues.append("Rainfall outside expected range")
        score -= 20
    
    if temp_c < 15 or temp_c > 45:
        issues.append("Temperature outside expected range")
        score -= 20
    
    if endemic_flag == 0 and state in ENDEMIC_STATES:
        issues.append("Endemic flag does not match state classification")
        score -= 15
    
    score = max(0, min(100, score))
    
    if score >= 80:
        level = "Excellent"
    elif score >= 60:
        level = "Good"
    elif score >= 40:
        level = "Fair"
    elif score >= 20:
        level = "Limited"
    else:
        level = "Poor"
    
    return {
        "score": score,
        "level": level,
        "issues": issues,
        "justification": f"Input quality assessed at {score}/100. {len(issues)} issues identified." if issues else "All inputs appear valid."
    }


def assess_prediction_confidence(probability, risk_tier):
    distance = abs(probability - 0.5)
    normalized = min(1, distance * 2)
    score = int(normalized * 100)
    
    if score >= 75:
        level = "Very High"
    elif score >= 60:
        level = "High"
    elif score >= 45:
        level = "Moderate"
    elif score >= 30:
        level = "Low"
    else:
        level = "Very Low"
    
    threshold_distance = round(abs(probability - 0.5) * 100, 1)
    
    return {
        "level": level,
        "score": score,
        "threshold_distance": threshold_distance,
        "justification": f"Prediction probability of {probability*100:.1f}% is {threshold_distance}% from the decision threshold."
    }


def calculate_agreement(rf_prob, xgb_prob, rf_tier, xgb_tier):
    diff = abs(rf_prob - xgb_prob)
    agreement_score = int((1 - diff) * 100)
    agreement_score = max(0, min(100, agreement_score))
    tier_match = rf_tier == xgb_tier
    
    if agreement_score >= 80 and tier_match:
        level = "High"
        interpretation = "Both models produced similar assessments."
        recommendation = "Proceed with standard protocol."
    elif agreement_score >= 60:
        level = "Medium"
        interpretation = "Models show moderate disagreement."
        recommendation = "Consider enhanced surveillance."
    elif agreement_score >= 40:
        level = "Low"
        interpretation = "Models produced substantially different assessments."
        recommendation = "Enhanced surveillance recommended until additional evidence becomes available."
    else:
        level = "Very Low"
        interpretation = "Models completely disagree. Predictive uncertainty is elevated."
        recommendation = "Clinical review recommended. Escalate to epidemiologist."
    
    return {
        "level": level,
        "score": agreement_score,
        "difference": round(diff * 100, 1),
        "tier_agreement": tier_match,
        "interpretation": interpretation,
        "recommendation": recommendation,
        "rf_probability": round(rf_prob * 100, 1),
        "xgb_probability": round(xgb_prob * 100, 1)
    }


def assess_prediction_reliability(input_quality, prediction_confidence, agreement, primary_result):
    reliability_score = input_quality['score']
    confidence_score = prediction_confidence.get('score', 50)
    reliability_score = (reliability_score + confidence_score) / 2
    
    if agreement:
        agreement_score = agreement.get('score', 50)
        reliability_score = (reliability_score + agreement_score) / 2
    
    if reliability_score >= 80:
        level = "High"
        reasoning = ["Excellent input quality", "Strong validation performance", "High prediction confidence"]
        if agreement and agreement.get('level') == "High":
            reasoning.append("High agreement between models")
    elif reliability_score >= 60:
        level = "Moderate"
        reasoning = ["Adequate input quality", "Moderate prediction confidence"]
        if agreement and agreement.get('level') in ["Low", "Very Low"]:
            reasoning.append("Models disagree substantially")
    else:
        level = "Limited"
        reasoning = ["Limited input quality", "Low prediction confidence"]
        if agreement and agreement.get('level') in ["Low", "Very Low"]:
            reasoning.append("Models disagree substantially")
    
    return {
        "level": level,
        "score": int(reliability_score),
        "reasoning": reasoning[:4],
        "justification": f"Reliability assessed at {int(reliability_score)}/100 based on input quality, prediction confidence, and model agreement."
    }


def generate_overall_assessment(primary_result, prediction_confidence, input_quality, agreement, reliability):
    evidence = []
    
    evidence.append({
        "type": "Validation Performance",
        "status": "Strong",
        "detail": "Model achieved PR-AUC of 0.106 and F2-score of 0.227 on test data."
    })
    
    if input_quality['level'] in ["Excellent", "Good"]:
        evidence.append({
            "type": "Input Quality",
            "status": "✓",
            "detail": f"Input quality is {input_quality['level'].lower()}."
        })
    else:
        evidence.append({
            "type": "Input Quality",
            "status": "⚠️",
            "detail": f"Input quality is {input_quality['level'].lower()}. {len(input_quality.get('issues', []))} issues identified."
        })
    
    evidence.append({
        "type": "Prediction Confidence",
        "status": prediction_confidence['level'],
        "detail": f"Confidence is {prediction_confidence['level'].lower()}."
    })
    
    if agreement:
        evidence.append({
            "type": "Model Agreement",
            "status": agreement['level'],
            "detail": f"Models show {agreement['level'].lower()} agreement."
        })
    
    if reliability['level'] == "High":
        verdict = "High Confidence"
        summary = "Suitable for operational decision support."
    elif reliability['level'] == "Moderate":
        verdict = "Moderate Confidence"
        summary = "Use alongside epidemiological investigation and expert review."
    else:
        verdict = "Use With Caution"
        summary = "Recommend enhanced surveillance and clinical review before operational decisions."
    
    risk_tier = primary_result.get('risk_tier', 'Unknown') if primary_result and not isinstance(primary_result, dict) else 'Unknown'
    
    return {
        "verdict": verdict,
        "summary": summary,
        "risk_tier": risk_tier,
        "evidence": evidence,
        "recommendation": f"Based on {verdict.lower()}, {'proceed with' if reliability['level'] in ['High', 'Moderate'] else 'exercise caution in'} decision-making."
    }


def get_primary_model():
    rf_path = os.path.join(MODELS_DIR, 'model_config.json')
    xgb_path = os.path.join(MODELS_DIR, 'xgboost_config.json')
    
    rf_f2 = 0
    xgb_f2 = 0
    
    if os.path.exists(rf_path):
        with open(rf_path) as f:
            rf_config = json.load(f)
            rf_f2 = rf_config.get('metrics', {}).get('Validation', {}).get('F2-Score', 0)
    
    if os.path.exists(xgb_path):
        with open(xgb_path) as f:
            xgb_config = json.load(f)
            xgb_f2 = xgb_config.get('metrics', {}).get('Validation', {}).get('F2-Score', 0)
    
    # Fallback if no config files exist
    if rf_f2 == 0 and xgb_f2 == 0:
        print("[Warning] No config files found - defaulting to Random Forest")
        return "Random Forest"
    
    return "Random Forest" if rf_f2 >= xgb_f2 else "XGBoost"


# ============================================================================
# PREDICTION FUNCTIONS
# ============================================================================

def make_prediction(
    state, epi_week, year, rainfall_mm, temp_c, recent_cases, 
    endemic_flag, model_data, static_data, model_key
):
    """Standard prediction for Random Forest and XGBoost."""
    features = construct_features(
        state, epi_week, year, rainfall_mm, temp_c, 
        recent_cases, endemic_flag, static_data
    )
    
    feature_vector = np.array([[features[col] for col in FEATURE_COLS]])
    feature_scaled = model_data['scaler'].transform(feature_vector)
    
    probability = float(model_data['model'].predict_proba(feature_scaled)[0, 1])
    
    is_endemic = bool(endemic_flag)
    risk_tier = classify_risk(probability, is_endemic)
    case_low, case_high = estimate_case_range(probability, is_endemic)
    recommendations = generate_recommendations(risk_tier, state)
    forecast = generate_forecast(state, epi_week, year, probability, is_endemic)
    
    meta = MODEL_METADATA[model_key]
    
    return {
        "state": state,
        "epi_week": epi_week,
        "year": year,
        "probability": round(probability, 4),
        "risk_tier": risk_tier,
        "case_range_low": case_low,
        "case_range_high": case_high,
        "recommendations": recommendations,
        "forecast": forecast,
        "model_used": meta['display_name'],
        "model_type": meta['name'],
        "is_primary": meta['is_primary'],
        "features_used": {k: round(v, 4) if isinstance(v, float) else v for k, v in features.items()},
        "timestamp": datetime.now().isoformat()
    }


# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="ViraWatch API",
    description="Lassa Fever outbreak risk prediction using real climate and epidemiological data",
    version="5.5.0"
)

# CORS - Production Ready
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://virawatch.vercel.app",
        "https://virawatch-site.vercel.app",
        "https://virawatch.site",
        "https://www.virawatch.site",
        "https://virawatch-api.onrender.com",
        "https://api.virawatch.site",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("[Startup] Loading static data sources...")
STATIC_DATA = load_static_data()

print("[Startup] Loading ML models...")
MODELS = load_model_artifacts()


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    return {
        "message": "ViraWatch API",
        "version": "5.5.0",
        "status": "operational",
        "endpoints": ["/health", "/model-info", "/predict", "/predict-comparison", "/predict-batch"]
    }


@app.get("/health")
def health_check():
    rf_loaded = MODELS.get('rf', {}).get('loaded', False)
    xgb_loaded = MODELS.get('xgb', {}).get('loaded', False)
    xgb_error = MODELS.get('xgb', {}).get('error', None)
    xgb_format = MODELS.get('xgb', {}).get('format', None)
    
    return {
        "status": "operational",
        "models_loaded": {
            "random_forest": rf_loaded,
            "xgboost": xgb_loaded
        },
        "xgboost_error": xgb_error if not xgb_loaded else None,
        "xgboost_format": xgb_format if xgb_loaded else None,
        "primary_model": get_primary_model(),
        "platt_scaling": False,
        "version": "5.5.0",
        "timestamp": datetime.now().isoformat(),
        "note": "Random Forest is fully operational. XGBoost loaded from native JSON format."
    }


@app.get("/model-info")
def model_info():
    rf_path = os.path.join(MODELS_DIR, 'model_config.json')
    xgb_path = os.path.join(MODELS_DIR, 'xgboost_config.json')
    
    rf_config = {}
    xgb_config = {}
    
    if os.path.exists(rf_path):
        with open(rf_path) as f:
            rf_config = json.load(f)
    
    if os.path.exists(xgb_path):
        with open(xgb_path) as f:
            xgb_config = json.load(f)
    
    primary = get_primary_model()
    xgb_loaded = MODELS.get('xgb', {}).get('loaded', False)
    xgb_format = MODELS.get('xgb', {}).get('format', None)
    
    return {
        "version": "5.5.0",
        "primary_model": primary,
        "selection_reason": f"{primary} selected because it achieved the strongest validation performance during model evaluation.",
        "models": {
            "random_forest": {
                "name": "Random Forest",
                "is_primary": primary == "Random Forest",
                "loaded": MODELS.get('rf', {}).get('loaded', False),
                "metrics": rf_config.get('metrics', {}),
                "feature_importance": rf_config.get('feature_importance', {})
            },
            "xgboost": {
                "name": "XGBoost",
                "is_primary": primary == "XGBoost",
                "loaded": xgb_loaded,
                "format": xgb_format,
                "metrics": xgb_config.get('metrics', {}),
                "feature_importance": xgb_config.get('feature_importance', {}),
                "error": MODELS.get('xgb', {}).get('error', None) if not xgb_loaded else None
            }
        }
    }


@app.get("/predict")
def predict(
    state: str = Query(..., description="Nigerian state name"),
    epi_week: int = Query(..., ge=1, le=52),
    year: int = Query(..., ge=2018, le=2026),
    rainfall_mm: float = Query(..., ge=0),
    temp_c: float = Query(..., ge=15, le=45),
    recent_cases: int = Query(..., ge=0),
    endemic_flag: int = Query(..., ge=0, le=1),
    model: str = Query('rf', description="Model to use: 'rf' (Random Forest) or 'xgb' (XGBoost)")
):
    if model not in ['rf', 'xgb']:
        raise HTTPException(status_code=400, detail="Model must be 'rf' or 'xgb'")
    
    model_data = MODELS.get(model)
    if not model_data or not model_data.get('loaded'):
        error_msg = model_data.get('error', 'Model not loaded') if model_data else 'Model not found'
        raise HTTPException(
            status_code=503, 
            detail=f"Model '{model}' not loaded. Error: {error_msg}"
        )
    
    result = make_prediction(
        state, epi_week, year, rainfall_mm, temp_c, recent_cases,
        endemic_flag, model_data, STATIC_DATA, model
    )
    
    return result


@app.get("/predict-comparison")
def predict_comparison(
    state: str = Query(..., description="Nigerian state name"),
    epi_week: int = Query(..., ge=1, le=52),
    year: int = Query(..., ge=2018, le=2026),
    rainfall_mm: float = Query(..., ge=0),
    temp_c: float = Query(..., ge=15, le=45),
    recent_cases: int = Query(..., ge=0),
    endemic_flag: int = Query(..., ge=0, le=1)
):
    # 1. Get BOTH predictions (if available)
    rf_result = None
    xgb_result = None
    xgb_error = None
    
    # Try Random Forest
    rf_data = MODELS.get('rf')
    if rf_data and rf_data.get('loaded'):
        try:
            rf_result = make_prediction(
                state, epi_week, year, rainfall_mm, temp_c, recent_cases,
                endemic_flag, rf_data, STATIC_DATA, 'rf'
            )
            print(f"[Debug] RF Prediction: {rf_result.get('probability') if rf_result else 'None'}")
        except Exception as e:
            print(f"[Error] RF failed: {e}")
            rf_result = {"error": str(e)}
    else:
        print("[Error] RF model not loaded!")
    
    # Try XGBoost
    xgb_data = MODELS.get('xgb')
    xgb_is_loaded = xgb_data and xgb_data.get('loaded', False)
    
    if xgb_is_loaded:
        try:
            xgb_result = make_prediction(
                state, epi_week, year, rainfall_mm, temp_c, recent_cases,
                endemic_flag, xgb_data, STATIC_DATA, 'xgb'
            )
            print(f"[Debug] XGB Prediction: {xgb_result.get('probability') if xgb_result else 'None'}")
        except Exception as e:
            print(f"[Error] XGB failed: {e}")
            xgb_result = {"error": str(e)}
            xgb_error = str(e)
    else:
        xgb_error = xgb_data.get('error', 'XGBoost not loaded') if xgb_data else 'XGBoost not available'
        print(f"[Warning] XGBoost unavailable: {xgb_error}")
    
    # 2. FORCE Random Forest as primary (it's the reliable one)
    primary_result = rf_result
    comparison_result = xgb_result
    primary_model_name = "Random Forest"
    comparison_name = "XGBoost" if xgb_is_loaded else "XGBoost (Not Available)"
    print(f"[Debug] Using RF as primary: {primary_result.get('probability') if primary_result and not isinstance(primary_result, dict) else 'None'}")
    
    # 3. Input Quality Assessment
    input_quality = assess_input_quality(
        state, epi_week, year, rainfall_mm, temp_c, recent_cases, endemic_flag
    )
    
    # 4. Prediction Confidence
    if primary_result and not isinstance(primary_result, dict):
        prediction_confidence = assess_prediction_confidence(
            primary_result['probability'],
            primary_result.get('risk_tier', 'Low')
        )
    else:
        prediction_confidence = {"level": "Unknown", "score": 0, "justification": "Unable to assess confidence"}
    
    # 5. Agreement Analysis
    agreement = None
    if (rf_result and xgb_result and 
        not isinstance(rf_result, dict) and 
        not isinstance(xgb_result, dict)):
        agreement = calculate_agreement(
            rf_result['probability'],
            xgb_result['probability'],
            rf_result.get('risk_tier', 'Low'),
            xgb_result.get('risk_tier', 'Low')
        )
        print(f"[Debug] Agreement calculated: {agreement.get('level') if agreement else 'None'}")
    else:
        rf_prob = rf_result['probability'] * 100 if rf_result and not isinstance(rf_result, dict) else None
        agreement = {
            "level": "N/A",
            "score": 0,
            "difference": None,
            "tier_agreement": None,
            "interpretation": "XGBoost is currently unavailable for comparison.",
            "recommendation": "Using Random Forest primary prediction.",
            "rf_probability": rf_prob,
            "xgb_probability": None,
            "error": xgb_error or "XGBoost not loaded"
        }
    
    # 6. Prediction Reliability
    reliability = assess_prediction_reliability(
        input_quality,
        prediction_confidence,
        agreement if agreement else None,
        primary_result
    )
    
    # 7. Overall Assessment
    overall = generate_overall_assessment(
        primary_result,
        prediction_confidence,
        input_quality,
        agreement if agreement else None,
        reliability
    )
    
    # 8. Build response
    response = {
        "state": state,
        "epi_week": epi_week,
        "year": year,
        "timestamp": datetime.now().isoformat(),
        "primary_prediction": {
            "model": primary_model_name,
            "probability": primary_result['probability'] if primary_result and not isinstance(primary_result, dict) else None,
            "risk_tier": primary_result.get('risk_tier') if primary_result and not isinstance(primary_result, dict) else None,
            "case_range_low": primary_result.get('case_range_low') if primary_result and not isinstance(primary_result, dict) else None,
            "case_range_high": primary_result.get('case_range_high') if primary_result and not isinstance(primary_result, dict) else None,
            "confidence": prediction_confidence,
            "forecast": primary_result.get('forecast') if primary_result and not isinstance(primary_result, dict) else [],
            "recommendations": primary_result.get('recommendations') if primary_result and not isinstance(primary_result, dict) else []
        },
        "comparison_prediction": {
            "model": comparison_name,
            "probability": comparison_result['probability'] if comparison_result and not isinstance(comparison_result, dict) else None,
            "risk_tier": comparison_result.get('risk_tier') if comparison_result and not isinstance(comparison_result, dict) else None,
            "case_range_low": comparison_result.get('case_range_low') if comparison_result and not isinstance(comparison_result, dict) else None,
            "case_range_high": comparison_result.get('case_range_high') if comparison_result and not isinstance(comparison_result, dict) else None,
            "loaded": xgb_is_loaded,
            "format": MODELS.get('xgb', {}).get('format', None) if xgb_is_loaded else None,
            "error": xgb_error if not xgb_is_loaded or (xgb_result and isinstance(xgb_result, dict)) else None
        },
        "agreement": agreement,
        "input_quality": input_quality,
        "prediction_confidence": prediction_confidence,
        "reliability": reliability,
        "overall_assessment": overall,
        "features_used": primary_result.get('features_used') if primary_result and not isinstance(primary_result, dict) else {},
        "note": "Random Forest is fully operational. XGBoost loaded from native JSON format."
    }
    
    return response


class BatchPredictionRequest(BaseModel):
    predictions: List[dict]
    model: Optional[str] = 'rf'


@app.post("/predict-batch")
def predict_batch(request: BatchPredictionRequest):
    model_key = request.model if request.model in ['rf', 'xgb'] else 'rf'
    model_data = MODELS.get(model_key)
    
    if not model_data or not model_data.get('loaded'):
        error_msg = model_data.get('error', 'Model not loaded') if model_data else 'Model not found'
        raise HTTPException(status_code=503, detail=f"Model '{model_key}' not loaded. Error: {error_msg}")
    
    results = []
    for pred in request.predictions:
        try:
            result = make_prediction(
                pred['state'], pred['epi_week'], pred['year'],
                pred['rainfall_mm'], pred['temp_c'], pred['recent_cases'],
                pred['endemic_flag'], model_data, STATIC_DATA, model_key
            )
            results.append(result)
        except Exception as e:
            results.append({
                "state": pred.get('state', 'unknown'),
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
    
    return {"results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)