import pandas as pd
import numpy as np
from datetime import timedelta
import os

INPUT_PATH = r"C:\Users\davew\Desktop\virawatch\data\chirps_rainfall\nga-rainfall-subnat-full.csv"
OUTPUT_PATH = r"C:\Users\davew\Desktop\virawatch\backend\data\chirps_weekly_nigeria.csv"

# Nigeria state PCODE to name mapping (from WFP/HDX standard)
# We'll extract actual names from the data or use PCODE
STATE_PCODES = {
    'NG001': 'Abia', 'NG002': 'Adamawa', 'NG003': 'Akwa_Ibom', 'NG004': 'Anambra',
    'NG005': 'Bauchi', 'NG006': 'Bayelsa', 'NG007': 'Benue', 'NG008': 'Borno',
    'NG009': 'Cross_River', 'NG010': 'Delta', 'NG011': 'Ebonyi', 'NG012': 'Edo',
    'NG013': 'Ekiti', 'NG014': 'Enugu', 'NG015': 'Gombe', 'NG016': 'Imo',
    'NG017': 'Jigawa', 'NG018': 'Kaduna', 'NG019': 'Kano', 'NG020': 'Katsina',
    'NG021': 'Kebbi', 'NG022': 'Kogi', 'NG023': 'Kwara', 'NG024': 'Lagos',
    'NG025': 'Nasarawa', 'NG026': 'Niger', 'NG027': 'Ogun', 'NG028': 'Ondo',
    'NG029': 'Osun', 'NG030': 'Oyo', 'NG031': 'Plateau', 'NG032': 'Rivers',
    'NG033': 'Sokoto', 'NG034': 'Taraba', 'NG035': 'Yobe', 'NG036': 'Zamfara',
    'NG037': 'FCT'
}


def main():
    print("Loading CHIRPS data...")
    df = pd.read_csv(INPUT_PATH)
    
    print(f"Loaded {len(df):,} rows")
    print(f"Columns: {list(df.columns)}")
    print(f"adm_level values: {df['adm_level'].unique()}")
    print(f"Unique PCODEs: {df['PCODE'].nunique()}")
    print(f"Date range: {df['date'].min()} to {df['date'].max()}")
    print(f"\nFirst few rows:")
    print(df.head())
    
    # Filter for state-level only (adm_level = 1)
    df = df[df['adm_level'] == 1].copy()
    print(f"\nAfter filtering states only: {len(df):,} rows")
    
    # Map PCODE to state name
    df['state'] = df['PCODE'].map(STATE_PCODES)
    
    # Check for unmapped PCODEs
    unmapped = df[df['state'].isna()]['PCODE'].unique()
    if len(unmapped) > 0:
        print(f"WARNING: Unmapped PCODEs: {unmapped}")
    
    print(f"States found: {sorted(df['state'].dropna().unique())}")
    print(f"State count: {df['state'].nunique()}")
    
    # Parse dates
    df['date'] = pd.to_datetime(df['date'])
    
    # Week start (Monday)
    df['week_start'] = df['date'].apply(lambda d: d - timedelta(days=d.weekday()))
    
    # Aggregate to weekly by state
    weekly = df.groupby(['state', 'week_start']).agg({
        'rfh': 'mean',
        'rfh_avg': 'mean',
        'rfq': 'mean',
        'PCODE': 'first'
    }).reset_index()
    
    # Extract epi week and year
    weekly['epi_week'] = weekly['week_start'].apply(lambda d: d.isocalendar()[1])
    weekly['year'] = weekly['week_start'].apply(lambda d: d.isocalendar()[0])
    
    # Rename
    weekly = weekly.rename(columns={
        'rfh': 'rainfall_mm',
        'rfh_avg': 'rainfall_lta_mm',
        'rfq': 'rainfall_anomaly_pct'
    })
    
    # Sort for lag
    weekly = weekly.sort_values(['state', 'year', 'epi_week'])
    
    # rainfall_lag8: mean of previous 8 weeks
    weekly['rainfall_lag8_mm'] = weekly.groupby('state')['rainfall_mm'].transform(
        lambda x: x.shift(1).rolling(window=8, min_periods=1).mean()
    )
    
    # Final columns
    weekly = weekly[[
        'state', 'year', 'epi_week',
        'rainfall_mm', 'rainfall_lag8_mm',
        'rainfall_lta_mm', 'rainfall_anomaly_pct'
    ]]
    
    print(f"\n--- OUTPUT ---")
    print(f"Weekly rows: {len(weekly):,}")
    print(f"States: {weekly['state'].nunique()}")
    print(f"Year range: {weekly['year'].min()} - {weekly['year'].max()}")
    print(f"\nSample (Edo state, recent):")
    print(weekly[weekly['state'] == 'Edo'].tail(5))
    
    # Validation
    n_states = weekly['state'].nunique()
    if n_states != 37:
        print(f"\n⚠️ WARNING: Expected 37 states, got {n_states}")
    else:
        print(f"\n✅ Verified: 37 states + FCT")
    
    # Save
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    weekly.to_csv(OUTPUT_PATH, index=False)
    print(f"\n✅ Saved to: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()