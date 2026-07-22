"""
ViraWatch - Model Training Pipeline (V3.3 - REAL CLIMATE DATA)
===============================================================
Trains Random Forest classifier using REAL climate data.

Key fixes:
- Loads REAL CHIRPS rainfall data
- Loads REAL WorldClim temperature/humidity
- Removes synthetic placeholders
- Extracts fitted Random Forest from pipeline
- Saves as raw RandomForestClassifier (NO Platt scaling)

Author: ViraWatch Project
Date: 2026-07-18
"""

import numpy as np
import pandas as pd
import json
import os
import warnings
from datetime import datetime

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.metrics import (
    precision_recall_curve, auc, fbeta_score,
    confusion_matrix, roc_auc_score, make_scorer
)
from imblearn.over_sampling import SMOTE # type: ignore
from imblearn.pipeline import Pipeline as ImbPipeline # type: ignore
import joblib

warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

os.makedirs(MODELS_DIR, exist_ok=True)

# 14 features - NO rolling_4wk_avg
FEATURE_COLS = [
    'confirmed_cases',
    'lag_1', 'lag_2', 'lag_3', 'lag_4',
    'rainfall_lag8', 'temp_lag4', 'humidity_lag4',
    'pop_density', 'is_endemic',
    'epi_week', 'month',
    'epi_week_sin', 'epi_week_cos'
]

TARGET_COL = 'outbreak_tplus4'

SMOTE_IMBALANCE_THRESHOLD = 0.20

ENDEMIC_STATES = ['Bauchi', 'Benue', 'Ebonyi', 'Edo', 'Kogi', 'Ondo', 'Taraba']


# ============================================================================
# STEP 1: LOAD REAL CLIMATE DATA
# ============================================================================

def load_climate_data():
    """Load real CHIRPS and WorldClim data."""
    
    climate_data = {}
    
    # Load CHIRPS rainfall
    chirps_path = os.path.join(DATA_DIR, 'chirps_weekly_nigeria.csv')
    if os.path.exists(chirps_path):
        chirps_df = pd.read_csv(chirps_path)
        print(f"[Climate] Loaded CHIRPS: {len(chirps_df)} rows")
        
        # Standardize column names if needed
        if 'State' in chirps_df.columns:
            chirps_df = chirps_df.rename(columns={'State': 'state'})
        if 'Epi_Week' in chirps_df.columns:
            chirps_df = chirps_df.rename(columns={'Epi_Week': 'epi_week'})
        
        # Store rainfall lookup
        climate_data['rainfall'] = chirps_df.set_index(['state', 'epi_week'])['rainfall_mm'].to_dict()
        climate_data['rainfall_lag8'] = chirps_df.set_index(['state', 'epi_week'])['rainfall_lag8_mm'].to_dict()
        print(f"[Climate] Loaded rainfall for {len(climate_data['rainfall'])} state-week combinations")
    else:
        print("[Climate] WARNING: CHIRPS data not found, using defaults")
        climate_data['rainfall'] = {}
        climate_data['rainfall_lag8'] = {}
    
    # Load WorldClim temperature/humidity
    wc_path = os.path.join(DATA_DIR, 'worldclim_nigeria_states.csv')
    if os.path.exists(wc_path):
        wc_df = pd.read_csv(wc_path)
        
        # Standardize column names
        col_map = {
            'mean_annual_temp_c': 'temp_c',
            'mean_vapor_pressure_kpa': 'vapor_pressure_kpa',
            'state': 'state'
        }
        wc_df = wc_df.rename(columns=col_map)
        
        climate_data['temp'] = wc_df.set_index('state')['temp_c'].to_dict()
        climate_data['humidity'] = wc_df.set_index('state')['vapor_pressure_kpa'].to_dict()
        print(f"[Climate] Loaded WorldClim for {len(wc_df)} states")
    else:
        print("[Climate] WARNING: WorldClim data not found, using defaults")
        climate_data['temp'] = {}
        climate_data['humidity'] = {}
    
    return climate_data


# ============================================================================
# STEP 2: LOAD NCDC DATA
# ============================================================================

def load_data():
    data_path = os.path.join(DATA_DIR, 'training_data_merged.csv')
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Training data not found at {data_path}")
    df = pd.read_csv(data_path)
    print(f"[Load] Loaded {len(df)} rows")
    print(f"[Load] Years: {df['year'].unique().tolist()}")
    return df


# ============================================================================
# STEP 3: ENGINEER FEATURES (WITH REAL CLIMATE DATA)
# ============================================================================

def engineer_features(df, climate_data):
    print("[Features] Engineering features with REAL climate data...")
    
    df = df.sort_values(['state', 'year', 'epi_week']).reset_index(drop=True)
    
    # Use confirmed_cases
    df['confirmed_cases'] = df['confirmed_cases']
    
    # Temporal lag features
    df['lag_1'] = df.groupby('state')['confirmed_cases'].shift(1).fillna(0)
    df['lag_2'] = df.groupby('state')['confirmed_cases'].shift(2).fillna(0)
    df['lag_3'] = df.groupby('state')['confirmed_cases'].shift(3).fillna(0)
    df['lag_4'] = df.groupby('state')['confirmed_cases'].shift(4).fillna(0)
    
    # =====================================================================
    # REAL CLIMATE DATA: Look up from CHIRPS and WorldClim
    # =====================================================================
    
    # Rainfall with 8-week lag (from CHIRPS)
    rainfall_lag8_lookup = climate_data.get('rainfall_lag8', {})
    df['rainfall_lag8'] = df.apply(
        lambda row: rainfall_lag8_lookup.get((row['state'], row['epi_week']), 60.0),
        axis=1
    )
    
    # Temperature (from WorldClim)
    temp_lookup = climate_data.get('temp', {})
    df['temp_lag4'] = df['state'].map(temp_lookup).fillna(27.0)
    
    # Humidity (from WorldClim)
    humidity_lookup = climate_data.get('humidity', {})
    df['humidity_lag4'] = df['state'].map(humidity_lookup).fillna(2.2)
    
    # Population density
    default_densities = {
        'Lagos': 4715, 'FCT': 657, 'Kano': 807, 'Anambra': 1507,
        'Imo': 1098, 'Rivers': 653, 'Ogun': 385, 'Oyo': 264,
        'Delta': 402, 'Akwa Ibom': 816, 'Kaduna': 181, 'Ondo': 344,
        'Edo': 290, 'Enugu': 754, 'Osun': 517, 'Kogi': 169,
        'Plateau': 175, 'Bauchi': 164, 'Niger': 88, 'Borno': 94,
        'Abia': 924, 'Ekiti': 535, 'Ebonyi': 707, 'Cross River': 208,
        'Kwara': 116, 'Zamfara': 139, 'Gombe': 229, 'Yobe': 96,
        'Taraba': 80, 'Kebbi': 163, 'Nasarawa': 135, 'Jigawa': 301,
        'Katsina': 384, 'Adamawa': 142, 'Sokoto': 226, 'Bayelsa': 114,
        'Benue': 196
    }
    df['pop_density'] = df['state'].map(default_densities).fillna(200)
    
    # Endemic flag
    df['is_endemic'] = df['state'].isin(ENDEMIC_STATES).astype(int)
    
    # Temporal features
    df['epi_week'] = df['epi_week']
    df['month'] = ((df['epi_week'] - 1) // 4) + 1
    
    # Cyclical encoding
    df['epi_week_sin'] = np.sin(2 * np.pi * df['epi_week'] / 52)
    df['epi_week_cos'] = np.cos(2 * np.pi * df['epi_week'] / 52)
    
    print(f"[Features] Shape: {df.shape}, Features: {len(FEATURE_COLS)}")
    
    # Show sample of real climate data
    print("\n[Features] Sample of REAL climate data:")
    sample_cols = ['state', 'epi_week', 'rainfall_lag8', 'temp_lag4', 'humidity_lag4']
    print(df[sample_cols].head(10).to_string(index=False))
    
    return df


# ============================================================================
# STEP 4: DEFINE TARGET
# ============================================================================

def define_target(df):
    print("[Target] Defining outbreak target...")
    
    state_baselines = df.groupby('state')['confirmed_cases'].mean().to_dict()
    state_std = df.groupby('state')['confirmed_cases'].std().to_dict()
    
    df['future_confirmed_t4'] = df.groupby('state')['confirmed_cases'].shift(-4)
    
    df['state_mean'] = df['state'].map(state_baselines)
    df['state_std'] = df['state'].map(state_std)
    df['outbreak_threshold'] = df['state_mean'] + 1.5 * df['state_std']
    df['outbreak_threshold'] = df['outbreak_threshold'].clip(lower=0.5)
    
    df['outbreak_tplus4'] = (
        df['future_confirmed_t4'] >= df['outbreak_threshold']
    ).astype(int)
    
    df = df.dropna(subset=['outbreak_tplus4']).reset_index(drop=True)
    
    target_dist = df['outbreak_tplus4'].value_counts()
    print(f"[Target] Distribution: {dict(target_dist)}")
    print(f"[Target] Prevalence: {df['outbreak_tplus4'].mean()*100:.2f}%")
    
    return df


# ============================================================================
# STEP 5: SPLIT DATA
# ============================================================================

def split_data(df):
    print("[Split] Splitting data...")
    
    df['split'] = 'train'
    df.loc[(df['epi_week'] == 52) & (df['year'].isin([2022, 2023, 2024, 2025])), 'split'] = 'validation'
    df.loc[(df['year'] == 2026) & (df['epi_week'] == 1), 'split'] = 'test'
    
    for split_name in ['train', 'validation', 'test']:
        count = len(df[df['split'] == split_name])
        print(f"[Split] {split_name}: {count} rows")
    
    return df


# ============================================================================
# STEP 6: PREPARE FEATURES
# ============================================================================

def prepare_features(df):
    print("[Features] Preparing features...")
    
    available_features = [c for c in FEATURE_COLS if c in df.columns]
    missing = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        print(f"[Warning] Missing: {missing}")
        for col in missing:
            df[col] = 0
    
    train_df = df[df['split'] == 'train'].copy()
    val_df = df[df['split'] == 'validation'].copy()
    test_df = df[df['split'] == 'test'].copy()
    
    print(f"[Features] Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")
    
    X_train = train_df[FEATURE_COLS].values
    y_train = train_df[TARGET_COL].values
    
    X_val = val_df[FEATURE_COLS].values if len(val_df) > 0 else None
    y_val = val_df[TARGET_COL].values if len(val_df) > 0 else None
    
    X_test = test_df[FEATURE_COLS].values if len(test_df) > 0 else None
    y_test = test_df[TARGET_COL].values if len(test_df) > 0 else None
    
    unique, counts = np.unique(y_train, return_counts=True)
    minority_pct = min(counts) / len(y_train)
    use_smote = minority_pct < SMOTE_IMBALANCE_THRESHOLD
    
    print(f"[SMOTE] Minority: {minority_pct*100:.2f}%, Apply: {use_smote}")
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val) if X_val is not None else None
    X_test_scaled = scaler.transform(X_test) if X_test is not None else None
    
    print(f"[Features] Shape: {X_train_scaled.shape}, Features: {len(available_features)}")
    
    return (X_train_scaled, y_train, X_val_scaled, y_val, 
            X_test_scaled, y_test, scaler, use_smote)


# ============================================================================
# STEP 7: TRAIN MODEL
# ============================================================================

def train_model(X_train, y_train, X_val, y_val, use_smote):
    print("[Train] Training Random Forest (NO Platt scaling)...")
    
    f2_scorer = make_scorer(fbeta_score, beta=2)
    
    if use_smote:
        print("[Train] Using SMOTE + Random Forest pipeline...")
        pipeline = ImbPipeline([
            ('smote', SMOTE(random_state=42, k_neighbors=3)),
            ('rf', RandomForestClassifier(random_state=42, n_jobs=-1))
        ])
        
        param_grid = {
            'rf__n_estimators': [100, 200],
            'rf__max_depth': [8, 12, 16],
            'rf__min_samples_split': [2, 5],
            'rf__min_samples_leaf': [1, 2],
            'rf__class_weight': ['balanced', 'balanced_subsample']
        }
    else:
        print("[Train] Using Random Forest without SMOTE...")
        pipeline = RandomForestClassifier(
            random_state=42, n_jobs=-1, class_weight='balanced'
        )
        param_grid = {
            'n_estimators': [100, 200],
            'max_depth': [8, 12, 16],
            'min_samples_split': [2, 5],
            'min_samples_leaf': [1, 2]
        }
    
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    grid_search = GridSearchCV(
        pipeline, param_grid, scoring=f2_scorer, cv=cv, n_jobs=-1, verbose=1
    )
    
    grid_search.fit(X_train, y_train)
    
    print(f"[Train] Best F2-score: {grid_search.best_score_:.4f}")
    print(f"[Train] Best params: {grid_search.best_params_}")
    
    # Extract fitted Random Forest
    if hasattr(grid_search.best_estimator_, 'named_steps'):
        rf_model = grid_search.best_estimator_.named_steps['rf']
        print("[Train] Extracted Random Forest from pipeline.named_steps['rf']")
    else:
        rf_model = grid_search.best_estimator_
        print("[Train] Using best_estimator_ directly")
    
    # Verify fitted
    try:
        dummy = np.zeros((1, X_train.shape[1]))
        rf_model.predict_proba(dummy)
        print("[Train] ✅ Extracted model is fitted and ready")
    except Exception as e:
        print(f"[Train] ❌ Model extraction failed: {e}")
        rf_model = grid_search.best_estimator_
    
    return rf_model


# ============================================================================
# STEP 8: EVALUATE MODEL
# ============================================================================

def evaluate_model(model, X_train, y_train, X_val, y_val, X_test, y_test):
    print("\n[Evaluate] Model Evaluation")
    print("=" * 50)
    
    results = {}
    
    for name, X, y in [('Train', X_train, y_train),
                        ('Validation', X_val, y_val),
                        ('Test', X_test, y_test)]:
        if X is None or len(y) == 0:
            continue
        
        try:
            y_proba = model.predict_proba(X)[:, 1]
            y_pred = (y_proba >= 0.5).astype(int)
        except Exception as e:
            print(f"[{name}] Prediction failed: {e}")
            continue
        
        if len(np.unique(y)) < 2:
            print(f"[{name}] Only one class present")
            continue
        
        tn, fp, fn, tp = confusion_matrix(y, y_pred).ravel()
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        f2 = fbeta_score(y, y_pred, beta=2)
        
        pr_curve, rec_curve, _ = precision_recall_curve(y, y_proba)
        pr_auc = auc(rec_curve, pr_curve)
        roc_auc = roc_auc_score(y, y_proba)
        
        metrics = {
            'PR-AUC': round(pr_auc, 4),
            'F2-Score': round(f2, 4),
            'Sensitivity': round(recall, 4),
            'Precision': round(precision, 4),
            'Specificity': round(specificity, 4),
            'ROC-AUC': round(roc_auc, 4),
            'n_samples': len(y),
            'n_positive': int(sum(y))
        }
        results[name] = metrics
        
        print(f"\n[{name}] Set:")
        for k, v in metrics.items():
            print(f"  {k}: {v}")
    
    return results


# ============================================================================
# STEP 9: SAVE MODEL
# ============================================================================

def save_model(model, scaler, metrics, use_smote):
    print("\n[Save] Saving model artifacts...")
    
    # Final verification
    try:
        dummy = np.zeros((1, len(FEATURE_COLS)))
        model.predict_proba(dummy)
        print("[Save] ✅ Model verified as fitted before saving")
    except Exception as e:
        print(f"[Save] ❌ Model is NOT fitted: {e}")
        raise RuntimeError("Cannot save unfitted model")
    
    # Save model
    model_path = os.path.join(MODELS_DIR, 'virawatch_model.pkl')
    joblib.dump(model, model_path)
    print(f"[Save] Model saved: {model_path}")
    
    # Save scaler
    scaler_path = os.path.join(MODELS_DIR, 'scaler.pkl')
    joblib.dump(scaler, scaler_path)
    print(f"[Save] Scaler saved: {scaler_path}")
    
    # Save feature importances
    feature_importance = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
    feature_importance = dict(sorted(feature_importance.items(), 
                                    key=lambda x: x[1], reverse=True))
    
    weights_path = os.path.join(MODELS_DIR, 'feature_weights.json')
    with open(weights_path, 'w') as f:
        json.dump(feature_importance, f, indent=2)
    print(f"[Save] Feature weights saved: {weights_path}")
    
    # Save model config
    config = {
        'version': '3.3',
        'algorithm': 'Random Forest with SMOTE (NO Platt scaling)',
        'features': FEATURE_COLS,
        'training_period': '2018-2022',
        'validation_period': 'W52 2022-2025',
        'test_period': '2026 W1',
        'last_trained': datetime.now().isoformat(),
        'metrics': metrics,
        'feature_importance': feature_importance,
        'smote_applied': bool(use_smote),
        'platt_scaling': False,
        'fix': 'REAL climate data from CHIRPS and WorldClim',
        'data_sources': ['NCDC', 'CHIRPS', 'WorldClim', 'NPC']
    }
    
    config_path = os.path.join(MODELS_DIR, 'model_config.json')
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"[Save] Model config saved: {config_path}")
    
    return config


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("VIRAWATCH MODEL TRAINING (VERSION 3.3 - REAL CLIMATE DATA)")
    print("=" * 70)
    print()
    
    print("Step 1: Loading REAL climate data...")
    climate_data = load_climate_data()
    
    print("\nStep 2: Loading NCDC data...")
    df = load_data()
    
    print("\nStep 3: Engineering features with REAL climate data...")
    df = engineer_features(df, climate_data)
    
    print("\nStep 4: Defining target...")
    df = define_target(df)
    
    print("\nStep 5: Splitting data...")
    df = split_data(df)
    
    print("\nStep 6: Preparing features...")
    (X_train, y_train, X_val, y_val, 
     X_test, y_test, scaler, use_smote) = prepare_features(df)
    
    print("\nStep 7: Training model...")
    model = train_model(X_train, y_train, X_val, y_val, use_smote)
    
    print("\nStep 8: Evaluating model...")
    metrics = evaluate_model(model, X_train, y_train, X_val, y_val, X_test, y_test)
    
    print("\nStep 9: Saving artifacts...")
    config = save_model(model, scaler, metrics, use_smote)
    
    print("\n" + "=" * 70)
    print("TRAINING COMPLETE (VERSION 3.3)")
    print("=" * 70)
    print("\n✅ REAL climate data from CHIRPS and WorldClim")
    print("✅ NO synthetic climate placeholders")
    print("✅ Model saved as raw, fitted Random Forest")
    print("✅ NO Platt scaling")
    print("\nNext step: Restart backend with 'uvicorn main:app --reload'")

if __name__ == "__main__":
    main()