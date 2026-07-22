"""
ViraWatch - Model Comparison
=============================
Compare Random Forest vs XGBoost performance.

Author: ViraWatch Project
Date: 2026-07-18
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import precision_recall_curve, auc, fbeta_score, confusion_matrix, roc_auc_score

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

print("=" * 70)
print("VIRAWATCH MODEL COMPARISON")
print("=" * 70)

# Load Random Forest
rf_model = joblib.load(os.path.join(MODELS_DIR, 'virawatch_model.pkl'))
rf_config = json.load(open(os.path.join(MODELS_DIR, 'model_config.json')))

# Load XGBoost
try:
    xgb_model = joblib.load(os.path.join(MODELS_DIR, 'xgboost_model.pkl'))
    xgb_config = json.load(open(os.path.join(MODELS_DIR, 'xgboost_config.json')))
    xgb_available = True
except:
    xgb_available = False
    print("[Warning] XGBoost model not found. Train it first with 'python train_model_xgb.py'")

# Load test data
df = pd.read_csv(os.path.join(DATA_DIR, 'training_data_merged.csv'))

# Recreate test set
df = df.sort_values(['state', 'year', 'epi_week']).reset_index(drop=True)

# Need to engineer features (simplified for comparison)
def engineer_features_simple(df):
    df = df.copy()
    df['confirmed_cases'] = df['confirmed_cases']
    df['lag_1'] = df.groupby('state')['confirmed_cases'].shift(1).fillna(0)
    df['lag_2'] = df.groupby('state')['confirmed_cases'].shift(2).fillna(0)
    df['lag_3'] = df.groupby('state')['confirmed_cases'].shift(3).fillna(0)
    df['lag_4'] = df.groupby('state')['confirmed_cases'].shift(4).fillna(0)
    df['rainfall_lag8'] = df['epi_week'].apply(lambda w: 80 if w <= 20 else 120 if w <= 40 else 60)
    df['temp_lag4'] = 27.0
    df['humidity_lag4'] = 2.2
    default_densities = {'Lagos': 4715, 'FCT': 657, 'Kano': 807, 'Anambra': 1507, 'Imo': 1098, 'Rivers': 653, 'Ogun': 385, 'Oyo': 264, 'Delta': 402, 'Akwa Ibom': 816, 'Kaduna': 181, 'Ondo': 344, 'Edo': 290, 'Enugu': 754, 'Osun': 517, 'Kogi': 169, 'Plateau': 175, 'Bauchi': 164, 'Niger': 88, 'Borno': 94, 'Abia': 924, 'Ekiti': 535, 'Ebonyi': 707, 'Cross River': 208, 'Kwara': 116, 'Zamfara': 139, 'Gombe': 229, 'Yobe': 96, 'Taraba': 80, 'Kebbi': 163, 'Nasarawa': 135, 'Jigawa': 301, 'Katsina': 384, 'Adamawa': 142, 'Sokoto': 226, 'Bayelsa': 114, 'Benue': 196}
    df['pop_density'] = df['state'].map(default_densities).fillna(200)
    df['is_endemic'] = df['state'].isin(['Bauchi', 'Benue', 'Ebonyi', 'Edo', 'Kogi', 'Ondo', 'Taraba']).astype(int)
    df['epi_week'] = df['epi_week']
    df['month'] = ((df['epi_week'] - 1) // 4) + 1
    df['epi_week_sin'] = np.sin(2 * np.pi * df['epi_week'] / 52)
    df['epi_week_cos'] = np.cos(2 * np.pi * df['epi_week'] / 52)
    return df

df = engineer_features_simple(df)

# Get test data (2026 W1)
test_mask = (df['year'] == 2026) & (df['epi_week'] == 1)
X_test = df[test_mask][rf_config['features']].values
y_test = df[test_mask]['outbreak_tplus4'].values if 'outbreak_tplus4' in df.columns else None

if y_test is None:
    print("\n[Error] Could not find target column. Creating test set...")
    state_baselines = df.groupby('state')['confirmed_cases'].mean().to_dict()
    state_std = df.groupby('state')['confirmed_cases'].std().to_dict()
    df['future_confirmed_t4'] = df.groupby('state')['confirmed_cases'].shift(-4)
    df['state_mean'] = df['state'].map(state_baselines)
    df['state_std'] = df['state'].map(state_std)
    df['outbreak_threshold'] = df['state_mean'] + 1.5 * df['state_std']
    df['outbreak_threshold'] = df['outbreak_threshold'].clip(lower=0.5)
    df['outbreak_tplus4'] = (df['future_confirmed_t4'] >= df['outbreak_threshold']).astype(int)
    df = df.dropna(subset=['outbreak_tplus4']).reset_index(drop=True)
    test_mask = (df['year'] == 2026) & (df['epi_week'] == 1)
    X_test = df[test_mask][rf_config['features']].values
    y_test = df[test_mask]['outbreak_tplus4'].values

print(f"\n[Test] X_test shape: {X_test.shape}, y_test shape: {y_test.shape}")

def evaluate_model(name, model, X, y):
    if model is None:
        return None
    
    y_proba = model.predict_proba(X)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)
    
    if len(np.unique(y)) < 2:
        return {'error': 'Only one class present'}
    
    tn, fp, fn, tp = confusion_matrix(y, y_pred).ravel()
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    f2 = fbeta_score(y, y_pred, beta=2)
    
    pr_curve, rec_curve, _ = precision_recall_curve(y, y_proba)
    pr_auc = auc(rec_curve, pr_curve)
    roc_auc = roc_auc_score(y, y_proba)
    
    return {
        'PR-AUC': round(pr_auc, 4),
        'F2-Score': round(f2, 4),
        'Sensitivity': round(recall, 4),
        'Precision': round(precision, 4),
        'Specificity': round(specificity, 4),
        'ROC-AUC': round(roc_auc, 4),
        'n_samples': len(y),
        'n_positive': int(sum(y))
    }

# Load scalers
rf_scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler.pkl'))
X_test_rf = rf_scaler.transform(X_test)

if xgb_available:
    xgb_scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler_xgb.pkl'))
    X_test_xgb = xgb_scaler.transform(X_test)

# Evaluate
print("\n" + "=" * 70)
print("MODEL COMPARISON (Test Set: 2026 W1)")
print("=" * 70)

rf_metrics = evaluate_model('Random Forest', rf_model, X_test_rf, y_test)
print("\n[Random Forest]")
if rf_metrics:
    for k, v in rf_metrics.items():
        print(f"  {k}: {v}")

if xgb_available:
    xgb_metrics = evaluate_model('XGBoost', xgb_model, X_test_xgb, y_test)
    print("\n[XGBoost]")
    if xgb_metrics:
        for k, v in xgb_metrics.items():
            print(f"  {k}: {v}")

# Feature importance comparison
print("\n" + "=" * 70)
print("FEATURE IMPORTANCE COMPARISON")
print("=" * 70)

rf_importance = dict(sorted(rf_config['feature_importance'].items(), key=lambda x: x[1], reverse=True))

print("\n[Random Forest] Top 5 Features:")
for i, (feature, importance) in enumerate(list(rf_importance.items())[:5], 1):
    print(f"  {i}. {feature}: {importance:.4f}")

if xgb_available:
    xgb_importance = dict(sorted(xgb_config['feature_importance'].items(), key=lambda x: x[1], reverse=True))
    print("\n[XGBoost] Top 5 Features:")
    for i, (feature, importance) in enumerate(list(xgb_importance.items())[:5], 1):
        print(f"  {i}. {feature}: {importance:.4f}")

print("\n" + "=" * 70)
print("COMPARISON COMPLETE")
print("=" * 70)
print("\nRecommendation:")
if xgb_available:
    if rf_metrics and xgb_metrics and rf_metrics.get('F2-Score', 0) > xgb_metrics.get('F2-Score', 0):
        print("  ✅ Random Forest performs better on F2-score")
    elif rf_metrics and xgb_metrics:
        print("  ✅ XGBoost performs better on F2-score")
    else:
        print("  ⚠️ Compare the metrics above to decide")
else:
    print("  Train XGBoost first: python train_model_xgb.py")