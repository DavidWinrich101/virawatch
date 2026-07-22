"""
Diagnostic: Rainfall-Case Correlation Analysis

This script determines whether rainfall actually predicts Lassa fever cases
before we build a reconstruction pipeline around it.

If correlation is weak (< 0.1), we will skip rainfall modulation.
If correlation is moderate (0.1-0.3), we will use it conservatively.
If correlation is strong (> 0.3), we will use it as a primary signal.
"""

import pandas as pd
import numpy as np
import os
from scipy.stats import pearsonr

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
LAGS = [4, 6, 8, 10, 12]  # Weeks to test

# Endemic states
ENDEMIC_STATES = ['Bauchi', 'Benue', 'Ebonyi', 'Edo', 'Kogi', 'Ondo', 'Taraba']

# -----------------------------------------------------------------------------
# LOAD DATA
# -----------------------------------------------------------------------------

print("=" * 70)
print("RAINFALL-CASE CORRELATION DIAGNOSTIC")
print("=" * 70)

# Load anchor points
anchor_path = os.path.join(DATA_DIR, 'ncdc_anchor_points_v3_combined.xlsx')
anchor_df = pd.read_excel(anchor_path, sheet_name='Raw_Extracted_Data')

# Clean column names
if anchor_df.iloc[0].astype(str).str.contains('year|week|state').any():
    anchor_df = anchor_df.iloc[1:].reset_index(drop=True)

anchor_df.columns = ['year', 'week', 'state', 'current_confirmed', 
                      'cumulative_confirmed', 'data_quality_flag']

# Convert types
anchor_df['year'] = pd.to_numeric(anchor_df['year'], errors='coerce').astype(int)
anchor_df['week'] = pd.to_numeric(anchor_df['week'], errors='coerce').astype(int)
anchor_df['current_confirmed'] = pd.to_numeric(anchor_df['current_confirmed'], errors='coerce')
anchor_df['cumulative_confirmed'] = pd.to_numeric(anchor_df['cumulative_confirmed'], errors='coerce')

print(f"\n[Load] Loaded {len(anchor_df)} anchor points")

# Load CHIRPS rainfall
chirps_path = os.path.join(DATA_DIR, 'chirps_weekly_nigeria.csv')
chirps_df = pd.read_csv(chirps_path)

print(f"[Load] Loaded {len(chirps_df)} CHIRPS records")

# -----------------------------------------------------------------------------
# JOIN ANCHORS WITH RAINFALL AT DIFFERENT LAGS
# -----------------------------------------------------------------------------

# Merge at exact week
anchor_rain = anchor_df.merge(
    chirps_df[['state', 'year', 'epi_week', 'rainfall_mm', 'rainfall_anomaly_pct', 'rainfall_lta_mm']],
    left_on=['state', 'year', 'week'],
    right_on=['state', 'year', 'epi_week'],
    how='left'
)

print(f"\n[Merge] Matched {len(anchor_rain[~anchor_rain['rainfall_mm'].isna()])} anchors with rainfall data")

# For each lag, shift the rainfall
results = []

for lag in LAGS:
    # Create a shifted version: rainfall at (week - lag) maps to current week
    lagged_df = chirps_df[['state', 'year', 'epi_week', 'rainfall_mm']].copy()
    lagged_df['lagged_week'] = lagged_df['epi_week'] + lag
    lagged_df['lagged_year'] = lagged_df['year']
    
    # Handle week wrap-around (e.g., week 52 + 4 = week 4, year+1)
    lagged_df['lagged_week'] = lagged_df['lagged_week'] % 52
    lagged_df['lagged_week'] = lagged_df['lagged_week'].replace(0, 52)
    
    # Merge lagged rainfall onto anchors
    merged = anchor_df.merge(
        lagged_df[['state', 'year', 'lagged_week', 'rainfall_mm']],
        left_on=['state', 'year', 'week'],
        right_on=['state', 'year', 'lagged_week'],
        how='left'
    )
    
    # Compute correlation per state
    for state in merged['state'].unique():
        state_data = merged[merged['state'] == state].dropna(subset=['current_confirmed', 'rainfall_mm'])
        
        if len(state_data) > 5:
            corr, p_val = pearsonr(state_data['current_confirmed'], state_data['rainfall_mm'])
            is_endemic = 1 if state in ENDEMIC_STATES else 0
            
            results.append({
                'state': state,
                'lag': lag,
                'correlation': corr,
                'p_value': p_val,
                'n_samples': len(state_data),
                'is_endemic': is_endemic
            })

# Convert to DataFrame
results_df = pd.DataFrame(results)

# -----------------------------------------------------------------------------
# ANALYSIS
# -----------------------------------------------------------------------------

print("\n" + "=" * 70)
print("CORRELATION ANALYSIS RESULTS")
print("=" * 70)

# Overall by lag
print("\n[1] Overall correlation by lag:")
for lag in LAGS:
    lag_data = results_df[results_df['lag'] == lag]
    mean_corr = lag_data['correlation'].mean()
    median_corr = lag_data['correlation'].median()
    print(f"  Lag {lag} weeks: mean = {mean_corr:.3f}, median = {median_corr:.3f}")

# Endemic vs non-endemic
print("\n[2] Endemic vs Non-Endemic (overall):")
for lag in LAGS:
    lag_data = results_df[results_df['lag'] == lag]
    endemic = lag_data[lag_data['is_endemic'] == 1]['correlation']
    non_endemic = lag_data[lag_data['is_endemic'] == 0]['correlation']
    
    if len(endemic) > 0 and len(non_endemic) > 0:
        print(f"  Lag {lag} weeks: endemic mean = {endemic.mean():.3f}, non-endemic mean = {non_endemic.mean():.3f}")

# Best lag per state
print("\n[3] Best lag per state:")
best_lags = results_df.loc[results_df.groupby('state')['correlation'].idxmax()]
best_lags = best_lags[['state', 'lag', 'correlation', 'is_endemic']].sort_values('correlation', ascending=False)

# Show top and bottom
print("\n  Top 5 states (positive correlation):")
for _, row in best_lags.head(5).iterrows():
    endemic_str = "ENDEMIC" if row['is_endemic'] == 1 else "non-endemic"
    print(f"    {row['state']:15s} lag={row['lag']:2d} corr={row['correlation']:.3f} ({endemic_str})")

print("\n  Bottom 5 states (negative correlation):")
for _, row in best_lags.tail(5).iterrows():
    endemic_str = "ENDEMIC" if row['is_endemic'] == 1 else "non-endemic"
    print(f"    {row['state']:15s} lag={row['lag']:2d} corr={row['correlation']:.3f} ({endemic_str})")

# Overall assessment
print("\n" + "=" * 70)
print("ASSESSMENT")
print("=" * 70)

all_corrs = results_df['correlation'].dropna()
mean_corr_all = all_corrs.mean()
abs_mean_corr = abs(all_corrs).mean()

print(f"\nMean correlation across all states and lags: {mean_corr_all:.3f}")
print(f"Mean absolute correlation: {abs_mean_corr:.3f}")

if abs_mean_corr < 0.1:
    print("\n[RECOMMENDATION] Correlations are very weak (< 0.1)")
    print("  → Rainfall does NOT appear to be a useful predictor.")
    print("  → SKIP rainfall modulation in data reconstruction.")
elif abs_mean_corr < 0.2:
    print("\n[RECOMMENDATION] Correlations are weak (0.1-0.2)")
    print("  → Rainfall may have a small effect.")
    print("  → USE rainfall modulation CONSERVATIVELY (small weight).")
elif abs_mean_corr < 0.3:
    print("\n[RECOMMENDATION] Correlations are moderate (0.2-0.3)")
    print("  → Rainfall has a meaningful relationship.")
    print("  → USE rainfall modulation with moderate weight.")
else:
    print("\n[RECOMMENDATION] Correlations are strong (> 0.3)")
    print("  → Rainfall is a significant predictor.")
    print("  → USE rainfall modulation as a primary signal.")

# -----------------------------------------------------------------------------
# EXPORT FOR FURTHER ANALYSIS
# -----------------------------------------------------------------------------

output_path = os.path.join(DATA_DIR, 'rainfall_correlation_analysis.csv')
results_df.to_csv(output_path, index=False)
print(f"\n[Export] Detailed results saved to: {output_path}")

print("\n" + "=" * 70)
print("DIAGNOSTIC COMPLETE")
print("=" * 70)

# -----------------------------------------------------------------------------
# RECOMMENDED NEXT STEP
# -----------------------------------------------------------------------------

print("\nNEXT STEP:")
print("  Review the correlation results above.")
print("  If correlations are weak (< 0.1) — we skip rainfall modulation.")
print("  If correlations are moderate (0.1-0.3) — we use it conservatively.")
print("  If correlations are strong (> 0.3) — we use it as a primary signal.")