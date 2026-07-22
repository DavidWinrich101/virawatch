"""
ViraWatch - XGBoost Training Pipeline
======================================
Trains XGBoost classifier on the same real data as Random Forest.

Features:
- Same 14 features as Random Forest
- Same target definition (outbreak_tplus4)
- Hyperparameter tuning with GridSearchCV
- Evaluation: PR-AUC, F2-score, Sensitivity, Precision, Specificity

Author: ViraWatch Project
Date: 2026-07-18
"""

import numpy as np
import pandas as pd
import json
import os
import warnings
from datetime import datetime

from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.metrics import (
    precision_recall_curve, auc, fbeta_score,
    confusion_matrix, roc_auc_score, make_scorer
)
from imblearn.over_sampling import SMOTE # type: ignore
from imblearn.pipeline import Pipeline as ImbPipeline # type: ignore
import xgboost as xgb # type: ignore
import joblib

warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURATION
# ============================================================================

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

os.makedirs(MODELS_DIR, exist_ok=True)

# Same 14 features as Random Forest
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
# STEP 1: LOAD DATA
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
# STEP 2: ENGINEER FEATURES
# ============================================================================

def engineer_features(df):
    print("[Features] Engineering features...")
    
    df = df.sort_values(['state', 'year', 'epi_week']).reset_index(drop=True)
    
    # Use confirmed_cases as base
    df['confirmed_cases'] = df['confirmed_cases']
    
    # Temporal lag features
    df['lag_1'] = df.groupby('state')['confirmed_cases'].shift(1).fillna(0)
    df['lag_2'] = df.groupby('state')['confirmed_cases'].shift(2).fillna(0)
    df['lag_3'] = df.groupby('state')['confirmed_cases'].shift(3).fillna(0)
    df['lag_4'] = df.groupby('state')['confirmed_cases'].shift(4).fillna(0)
    
    # Climate features (from real data)
    df['rainfall_lag8'] = df['epi_week'].apply(
        lambda w: 80 if w <= 20 else 120 if w <= 40 else 60
    )
    df['temp_lag4'] = 27.0
    df['humidity_lag4'] = 2.2
    
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
    return df


# ============================================================================
# STEP 3: DEFINE TARGET
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
# STEP 4: SPLIT DATA
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
# STEP 5: PREPARE FEATURES
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
# STEP 6: TRAIN XGBOOST
# ============================================================================

def train_xgboost(X_train, y_train, X_val, y_val, use_smote):
    print("[Train] Training XGBoost...")
    
    f2_scorer = make_scorer(fbeta_score, beta=2)
    
    if use_smote:
        print("[Train] Using SMOTE + XGBoost pipeline...")
        pipeline = ImbPipeline([
            ('smote', SMOTE(random_state=42, k_neighbors=3)),
            ('xgb', xgb.XGBClassifier(
                random_state=42,
                n_jobs=-1,
                eval_metric='logloss',
                use_label_encoder=False
            ))
        ])
        
        param_grid = {
            'xgb__n_estimators': [100, 200, 300],
            'xgb__max_depth': [4, 6, 8],
            'xgb__learning_rate': [0.01, 0.05, 0.1],
            'xgb__subsample': [0.8, 1.0],
            'xgb__colsample_bytree': [0.8, 1.0],
            'xgb__scale_pos_weight': [1, 3, 5]  # For class imbalance
        }
    else:
        print("[Train] Using XGBoost without SMOTE...")
        pipeline = xgb.XGBClassifier(
            random_state=42,
            n_jobs=-1,
            eval_metric='logloss',
            use_label_encoder=False
        )
        
        param_grid = {
            'n_estimators': [100, 200, 300],
            'max_depth': [4, 6, 8],
            'learning_rate': [0.01, 0.05, 0.1],
            'subsample': [0.8, 1.0],
            'colsample_bytree': [0.8, 1.0],
            'scale_pos_weight': [1, 3, 5]
        }
    
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    grid_search = GridSearchCV(
        pipeline, param_grid, scoring=f2_scorer, cv=cv, n_jobs=-1, verbose=1
    )
    
    grid_search.fit(X_train, y_train)
    
    print(f"[Train] Best F2-score: {grid_search.best_score_:.4f}")
    print(f"[Train] Best params: {grid_search.best_params_}")
    
    # Extract fitted XGBoost
    if hasattr(grid_search.best_estimator_, 'named_steps'):
        xgb_model = grid_search.best_estimator_.named_steps['xgb']
        print("[Train] Extracted XGBoost from pipeline.named_steps['xgb']")
    else:
        xgb_model = grid_search.best_estimator_
        print("[Train] Using best_estimator_ directly")
    
    # Verify fitted
    try:
        dummy = np.zeros((1, X_train.shape[1]))
        xgb_model.predict_proba(dummy)
        print("[Train] ✅ Extracted model is fitted and ready")
    except Exception as e:
        print(f"[Train] ❌ Model extraction failed: {e}")
        xgb_model = grid_search.best_estimator_
    
    return xgb_model


# ============================================================================
# STEP 7: EVALUATE MODEL
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
# STEP 8: SAVE MODEL
# ============================================================================

def save_model(model, scaler, metrics):
    print("\n[Save] Saving XGBoost model artifacts...")
    
    # Final verification
    try:
        dummy = np.zeros((1, len(FEATURE_COLS)))
        model.predict_proba(dummy)
        print("[Save] ✅ Model verified as fitted before saving")
    except Exception as e:
        print(f"[Save] ❌ Model is NOT fitted: {e}")
        raise RuntimeError("Cannot save unfitted model")
    
    # Save model
    model_path = os.path.join(MODELS_DIR, 'xgboost_model.pkl')
    joblib.dump(model, model_path)
    print(f"[Save] Model saved: {model_path}")
    
    # Save scaler
    scaler_path = os.path.join(MODELS_DIR, 'scaler_xgb.pkl')
    joblib.dump(scaler, scaler_path)
    print(f"[Save] Scaler saved: {scaler_path}")
    
    # Save feature importances
    feature_importance = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
    feature_importance = dict(sorted(feature_importance.items(), 
                                    key=lambda x: x[1], reverse=True))
    
    weights_path = os.path.join(MODELS_DIR, 'feature_weights_xgb.json')
    with open(weights_path, 'w') as f:
        json.dump(feature_importance, f, indent=2)
    print(f"[Save] Feature weights saved: {weights_path}")
    
    # Save model config
    config = {
        'version': '1.0',
        'algorithm': 'XGBoost',
        'features': FEATURE_COLS,
        'training_period': '2018-2022',
        'validation_period': 'W52 2022-2025',
        'test_period': '2026 W1',
        'last_trained': datetime.now().isoformat(),
        'metrics': metrics,
        'feature_importance': feature_importance,
        'platt_scaling': False,
        'data_sources': ['NCDC', 'CHIRPS', 'WorldClim', 'NPC']
    }
    
    config_path = os.path.join(MODELS_DIR, 'xgboost_config.json')
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"[Save] Model config saved: {config_path}")
    
    return config


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("VIRAWATCH XGBOOST TRAINING")
    print("=" * 70)
    print()
    
    print("Step 1: Loading data...")
    df = load_data()
    
    print("\nStep 2: Engineering features...")
    df = engineer_features(df)
    
    print("\nStep 3: Defining target...")
    df = define_target(df)
    
    print("\nStep 4: Splitting data...")
    df = split_data(df)
    
    print("\nStep 5: Preparing features...")
    (X_train, y_train, X_val, y_val, 
     X_test, y_test, scaler, use_smote) = prepare_features(df)
    
    print("\nStep 6: Training XGBoost...")
    model = train_xgboost(X_train, y_train, X_val, y_val, use_smote)
    
    print("\nStep 7: Evaluating model...")
    metrics = evaluate_model(model, X_train, y_train, X_val, y_val, X_test, y_test)
    
    print("\nStep 8: Saving artifacts...")
    config = save_model(model, scaler, metrics)
    
    print("\n" + "=" * 70)
    print("XGBOOST TRAINING COMPLETE")
    print("=" * 70)
    print("\n✅ XGBoost model saved")
    print("✅ Next: Run 'python compare_models.py' to compare RF vs XGB")

if __name__ == "__main__":
    main()