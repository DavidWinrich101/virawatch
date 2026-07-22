"""
test_model.py - Test the trained ViraWatch model (V3.2)
"""

import numpy as np
import joblib
import json
import os

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

print("="*60)
print("VIRAWATCH MODEL TEST")
print("="*60)

model = joblib.load(os.path.join(MODELS_DIR, 'virawatch_model.pkl'))
scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler.pkl'))

with open(os.path.join(MODELS_DIR, 'model_config.json'), 'r') as f:
    config = json.load(f)

# Check if model is raw RandomForest
print(f"[DEBUG] Model type: {type(model).__name__}")
if 'RandomForestClassifier' in str(type(model)):
    print("[DEBUG] ✅ Using raw RandomForestClassifier directly")
    rf_model = model
else:
    # Try to extract if wrapped
    if hasattr(model, 'estimator_'):
        rf_model = model.estimator_
        print("[DEBUG] Extracted from estimator_")
    else:
        rf_model = model
        print("[DEBUG] Using model as-is")

# Verify fitted
try:
    dummy = np.zeros((1, 14))  # 14 features (rolling_4wk_avg removed)
    rf_model.predict_proba(dummy)
    print("[DEBUG] ✅ Model is fitted and ready")
except Exception as e:
    print(f"[DEBUG] ⚠️ Model may not be fitted: {e}")
    rf_model = model

print(f"\n[Model Info]")
print(f"  Algorithm: {config.get('algorithm', 'Random Forest')}")
print(f"  Features: {len(config.get('features', []))}")
print(f"  Last trained: {config.get('last_trained', 'unknown')}")
print(f"  Platt scaling: {config.get('platt_scaling', False)}")

# 14 features - REMOVED rolling_4wk_avg
FEATURE_COLS = [
    'confirmed_cases', 'lag_1', 'lag_2', 'lag_3', 'lag_4',
    'rainfall_lag8', 'temp_lag4', 'humidity_lag4',
    'pop_density', 'is_endemic',
    'epi_week', 'month',
    'epi_week_sin', 'epi_week_cos'
]

ENDEMIC_STATES = ['Bauchi', 'Benue', 'Ebonyi', 'Edo', 'Kogi', 'Ondo', 'Taraba']

def create_feature_vector(state, epi_week, confirmed_cases, lag_1=0, lag_2=0, lag_3=0, lag_4=0):
    # REMOVED: rolling_4wk_avg
    
    if epi_week <= 20:
        rainfall = 80
    elif epi_week <= 40:
        rainfall = 120
    else:
        rainfall = 60
    
    temp = 27.0
    humidity = 2.2
    
    pop_density_map = {
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
    pop_density = pop_density_map.get(state, 200)
    is_endemic = 1 if state in ENDEMIC_STATES else 0
    month = ((epi_week - 1) // 4) + 1
    epi_week_sin = np.sin(2 * np.pi * epi_week / 52)
    epi_week_cos = np.cos(2 * np.pi * epi_week / 52)
    
    # 14 features - REMOVED rolling_4wk_avg
    feature_vector = [
        confirmed_cases, lag_1, lag_2, lag_3, lag_4,
        rainfall, temp, humidity,
        pop_density, is_endemic,
        epi_week, month,
        epi_week_sin, epi_week_cos
    ]
    return np.array(feature_vector).reshape(1, -1)

def predict_outbreak(state, epi_week, confirmed_cases, **lags):
    feature_vector = create_feature_vector(state, epi_week, confirmed_cases,
        lag_1=lags.get('lag_1', 0), lag_2=lags.get('lag_2', 0),
        lag_3=lags.get('lag_3', 0), lag_4=lags.get('lag_4', 0))
    X_scaled = scaler.transform(feature_vector)
    prob = rf_model.predict_proba(X_scaled)[0, 1]
    return prob, 1 if prob >= 0.5 else 0

print("\n" + "="*60)
print("TEST SCENARIOS")
print("="*60)

# Test 1
print("\n[Test 1] Real Data - 2026 Week 1")
print("-" * 40)
real_cases = {'Bauchi': 7, 'Ondo': 5, 'Edo': 4, 'Taraba': 3, 'Kogi': 1}
for state, confirmed in real_cases.items():
    prob, pred = predict_outbreak(state, 1, confirmed, lag_1=0, lag_2=0, lag_3=0, lag_4=0)
    status = "🚨 OUTBREAK" if pred == 1 else "✅ No outbreak"
    print(f"  {state:10} | Confirmed: {confirmed:2} | Prob: {prob:.3f} | {status}")

# Test 2
print("\n[Test 2] ENDEMIC state (Ondo, Week 8) - Varying cases")
print("-" * 40)
for cases in [5, 15, 30, 50, 100]:
    prob, pred = predict_outbreak('Ondo', 8, cases, lag_1=10, lag_2=8, lag_3=5, lag_4=3)
    status = "🚨 OUTBREAK" if pred == 1 else "✅ No outbreak"
    print(f"  Confirmed: {cases:3} | Prob: {prob:.3f} | {status}")

# Test 3
print("\n[Test 3] NON-ENDEMIC state (Lagos, Week 8) - Varying cases")
print("-" * 40)
for cases in [10, 25, 50, 100, 200]:
    prob, pred = predict_outbreak('Lagos', 8, cases, lag_1=10, lag_2=8, lag_3=5, lag_4=3)
    status = "🚨 OUTBREAK" if pred == 1 else "✅ No outbreak"
    print(f"  Confirmed: {cases:3} | Prob: {prob:.3f} | {status}")

# Test 4
print("\n[Test 4] Endemic vs Non-Endemic (50 cases, Week 8)")
print("-" * 40)
for state in ['Ondo', 'Edo', 'Bauchi', 'Lagos', 'Kano', 'FCT']:
    prob, pred = predict_outbreak(state, 8, 50, lag_1=20, lag_2=15, lag_3=10, lag_4=5)
    endemic = "🔴 Endemic" if state in ENDEMIC_STATES else "🟢 Non-endemic"
    status = "🚨 OUTBREAK" if pred == 1 else "✅ No outbreak"
    print(f"  {state:10} | {endemic:12} | Prob: {prob:.3f} | {status}")

# Test 5
print("\n[Test 5] Seasonal Pattern: Ondo, 50 cases")
print("-" * 40)
for week in [5, 15, 25, 35, 45]:
    prob, pred = predict_outbreak('Ondo', week, 50, lag_1=20, lag_2=15, lag_3=10, lag_4=5)
    status = "🚨 OUTBREAK" if pred == 1 else "✅ No outbreak"
    print(f"  Week {week:2} | Prob: {prob:.3f} | {status}")

print("\n" + "="*60)
print("TEST COMPLETE")
print("="*60)