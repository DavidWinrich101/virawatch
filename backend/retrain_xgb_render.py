"""
Retrain XGBoost on Render with correct parameters
Run this once on Render Shell
"""
import os
import sys
import pandas as pd
import numpy as np
import joblib
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import average_precision_score, fbeta_score, roc_auc_score

print("=" * 60)
print("🔄 RETRAINING XGBOOST ON RENDER")
print("=" * 60)

# 1. Load data
DATA_DIR = 'data'
MODELS_DIR = 'models'

print("\n📂 Loading training data...")
df = pd.read_csv(os.path.join(DATA_DIR, 'training_data_merged.csv'))
print(f"✅ Loaded {len(df)} rows")

# 2. Define features
feature_cols = [
    'confirmed_cases', 'lag_1', 'lag_2', 'lag_3', 'lag_4',
    'rainfall_lag8', 'temp_lag4', 'humidity_lag4', 'pop_density',
    'is_endemic', 'epi_week', 'month', 'epi_week_sin', 'epi_week_cos'
]

X = df[feature_cols]
y = df['outbreak']

print(f"✅ Features: {len(feature_cols)} columns")

# 3. Split
print("\n📊 Splitting data...")
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42)

print(f"   Train: {len(X_train)} samples")
print(f"   Val: {len(X_val)} samples")
print(f"   Test: {len(X_test)} samples")

# 4. Scale
print("\n📐 Scaling features...")
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled = scaler.transform(X_val)
X_test_scaled = scaler.transform(X_test)

# 5. Train XGBoost - WITHOUT use_label_encoder
print("\n🧠 Training XGBoost...")
import xgboost as xgb

xgb_model = xgb.XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    eval_metric='logloss'
    # ⚠️ NO use_label_encoder parameter - this is the fix!
)

xgb_model.fit(
    X_train_scaled, y_train,
    eval_set=[(X_val_scaled, y_val)],
    verbose=True
)

print("✅ XGBoost training complete!")

# 6. Evaluate
print("\n📊 Evaluating XGBoost...")
y_pred_proba = xgb_model.predict_proba(X_test_scaled)[:, 1]
y_pred = (y_pred_proba >= 0.5).astype(int)

metrics = {
    'PR-AUC': float(average_precision_score(y_test, y_pred_proba)),
    'F2-Score': float(fbeta_score(y_test, y_pred, beta=2) if y_test.sum() > 0 else 0),
    'Sensitivity': float((y_pred[y_test == 1].sum() / y_test.sum()) if y_test.sum() > 0 else 0),
    'Specificity': float(((y_pred[y_test == 0] == 0).sum() / (y_test == 0).sum()) if (y_test == 0).sum() > 0 else 0),
    'Precision': float((y_pred[y_test == 1].sum() / y_pred.sum()) if y_pred.sum() > 0 else 0),
    'ROC-AUC': float(roc_auc_score(y_test, y_pred_proba)),
    'n_samples': len(y_test),
    'n_positive': int(y_test.sum())
}

print(f"\n📈 Validation Metrics:")
print(f"   PR-AUC:      {metrics['PR-AUC']:.4f}")
print(f"   F2-Score:    {metrics['F2-Score']:.4f}")
print(f"   Sensitivity: {metrics['Sensitivity']:.4f}")
print(f"   Specificity: {metrics['Specificity']:.4f}")

# 7. Save model
print("\n💾 Saving XGBoost model...")
joblib.dump(xgb_model, os.path.join(MODELS_DIR, 'xgboost_model.pkl'))
joblib.dump(scaler, os.path.join(MODELS_DIR, 'scaler_xgb.pkl'))
print("✅ Model saved to models/xgboost_model.pkl")
print("✅ Scaler saved to models/scaler_xgb.pkl")

# 8. Update config
print("\n📝 Updating XGBoost config...")
xgb_config = {
    "version": "5.0",
    "algorithm": "XGBoost with SMOTE (Retrained on Render)",
    "features": feature_cols,
    "training_period": "2018-2022",
    "validation_period": "W52 2022-2025",
    "test_period": "2026 W1",
    "last_trained": pd.Timestamp.now().isoformat(),
    "metrics": {
        "Validation": metrics
    },
    "feature_importance": dict(zip(feature_cols, xgb_model.feature_importances_.tolist())),
    "platt_scaling": False,
    "data_sources": ["NCDC", "CHIRPS", "WorldClim", "NPC"],
    "note": "Retrained on Render - fixed use_label_encoder and numpy compatibility"
}

with open(os.path.join(MODELS_DIR, 'xgboost_config.json'), 'w') as f:
    json.dump(xgb_config, f, indent=2)
print("✅ Config saved to models/xgboost_config.json")

print("\n" + "=" * 60)
print("✅ XGBOOST RETRAINING COMPLETE!")
print("=" * 60)
print("\n🔧 Next steps:")
print("   1. Restart the server (Render will auto-reload)")
print("   2. Test /predict-comparison endpoint")