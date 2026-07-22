"""
extract_worldclim.py
Extract real temperature and humidity data for all 37 Nigerian states from WorldClim 2.1.

Data Sources:
- WorldClim 2.1 (1970-2000 baseline): https://worldclim.org
  - Bio1 = Annual Mean Temperature
  - Bio15 = Precipitation Seasonality
  - vapr = Water Vapor Pressure (humidity proxy)
- GADM Nigeria Level 1 shapefile: state boundaries

Output: worldclim_nigeria_states.csv
"""

import os
import numpy as np
import pandas as pd
import rasterio # type: ignore
from rasterio.mask import mask # type: ignore
import geopandas as gpd # type: ignore
from shapely.geometry import mapping # type: ignore

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
WORLDCLIM_DIR = os.path.join(DATA_DIR, "world_clim")
GADM_DIR = os.path.join(DATA_DIR, "nigeria_shapefile")
OUTPUT_DIR = DATA_DIR

# File paths
BIO1_PATH = os.path.join(WORLDCLIM_DIR, "bio", "wc2.1_2.5m_bio_1.tif")
BIO15_PATH = os.path.join(WORLDCLIM_DIR, "bio", "wc2.1_2.5m_bio_15.tif")
VAPR_DIR = os.path.join(WORLDCLIM_DIR, "vapr")
GADM_PATH = os.path.join(GADM_DIR, "gadm41_NGA_1.shp")

OUTPUT_CSV = os.path.join(OUTPUT_DIR, "worldclim_nigeria_states.csv")

# 37 Nigerian states + FCT (standard names)
STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
    "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT",
    "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi",
    "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
    "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
]

# State name mapping: GADM -> ViraWatch standard
GADM_TO_VIRAWATCH = {
    "Abia": "Abia", "Adamawa": "Adamawa", "Akwa Ibom": "Akwa Ibom",
    "Anambra": "Anambra", "Bauchi": "Bauchi", "Bayelsa": "Bayelsa",
    "Benue": "Benue", "Borno": "Borno", "Cross River": "Cross River",
    "Delta": "Delta", "Ebonyi": "Ebonyi", "Edo": "Edo", "Ekiti": "Ekiti",
    "Enugu": "Enugu", "Federal Capital Territory": "FCT", "FCT": "FCT",
    "Gombe": "Gombe", "Imo": "Imo", "Jigawa": "Jigawa", "Kaduna": "Kaduna",
    "Kano": "Kano", "Katsina": "Katsina", "Kebbi": "Kebbi", "Kogi": "Kogi",
    "Kwara": "Kwara", "Lagos": "Lagos", "Nasarawa": "Nasarawa",
    "Niger": "Niger", "Ogun": "Ogun", "Ondo": "Ondo", "Osun": "Osun",
    "Oyo": "Oyo", "Plateau": "Plateau", "Rivers": "Rivers",
    "Sokoto": "Sokoto", "Taraba": "Taraba", "Yobe": "Yobe", "Zamfara": "Zamfara"
}

print("=" * 70)
print("VIRAWATCH — WorldClim Temperature & Humidity Extraction")
print("Real data only. No synthetic estimates.")
print("=" * 70)

# ---------------------------------------------------------------------------
# STEP 1: Verify files exist
# ---------------------------------------------------------------------------
print("\n[STEP 1] Verifying input files...")

required_files = [BIO1_PATH, BIO15_PATH, GADM_PATH]
for f in required_files:
    if os.path.exists(f):
        print(f"  ✓ {os.path.basename(f)}")
    else:
        print(f"  ✗ MISSING: {f}")
        raise FileNotFoundError(f"Required file not found: {f}")

vapr_files = sorted([f for f in os.listdir(VAPR_DIR) if f.startswith('wc2.1_2.5m_vapr_') and f.endswith('.tif')])
print(f"  ✓ Found {len(vapr_files)} vapor pressure files")

# ---------------------------------------------------------------------------
# STEP 2: Load GADM shapefile
# ---------------------------------------------------------------------------
print("\n[STEP 2] Loading GADM Nigeria state boundaries...")
gdf = gpd.read_file(GADM_PATH)
print(f"  Loaded {len(gdf)} state polygons")

# Show available columns to find state name column
print(f"  Available columns: {list(gdf.columns)}")

# Find the state name column
state_col = None
for col in ['NAME_1', 'NAME_1_', 'name', 'NAME_1_1']:
    if col in gdf.columns:
        state_col = col
        break

if state_col is None:
    # Try to find any column that might contain state names
    for col in gdf.columns:
        if gdf[col].dtype == object:
            sample = str(gdf[col].iloc[0]) if len(gdf) > 0 else ""
            if any(state in sample for state in ["Lagos", "Kano", "Ondo"]):
                state_col = col
                break

if state_col is None:
    raise ValueError("Could not find state name column in GADM shapefile")

print(f"  Using column '{state_col}' for state names")

# ---------------------------------------------------------------------------
# STEP 3: Extract temperature (Bio1)
# ---------------------------------------------------------------------------
print("\n[STEP 3] Extracting temperature (Bio1)...")

results = []

for idx, row in gdf.iterrows():
    gadm_name = row[state_col]
    std_name = GADM_TO_VIRAWATCH.get(gadm_name, gadm_name)
    
    geom = [mapping(row.geometry)]
    
    # Extract Bio1 (Temperature)
    with rasterio.open(BIO1_PATH) as src:
        out_image, out_transform = mask(src, geom, crop=True, nodata=-9999)
        temp_vals = out_image[0]
        temp_vals = temp_vals[temp_vals != -9999]
        temp_vals = temp_vals[temp_vals != src.nodata]
        if len(temp_vals) > 0:
            # WorldClim 2.1 Bio1 stores temperature as actual °C (not °C × 10)
            mean_temp_c = np.mean(temp_vals)
        else:
            mean_temp_c = None
    
    # Extract Bio15 (Precipitation Seasonality)
    with rasterio.open(BIO15_PATH) as src:
        out_image, out_transform = mask(src, geom, crop=True, nodata=-9999)
        bio15_vals = out_image[0]
        bio15_vals = bio15_vals[bio15_vals != -9999]
        bio15_vals = bio15_vals[bio15_vals != src.nodata]
        mean_bio15 = np.mean(bio15_vals) if len(bio15_vals) > 0 else None
    
    # Extract mean vapor pressure (humidity proxy) across 12 months
    vapr_monthly = []
    for vf in vapr_files:
        vpath = os.path.join(VAPR_DIR, vf)
        with rasterio.open(vpath) as src:
            out_image, out_transform = mask(src, geom, crop=True, nodata=-9999)
            v_vals = out_image[0]
            v_vals = v_vals[v_vals != -9999]
            v_vals = v_vals[v_vals != src.nodata]
            if len(v_vals) > 0:
                vapr_monthly.append(np.mean(v_vals))
    
    mean_vapr = np.mean(vapr_monthly) if vapr_monthly else None
    
    results.append({
        'state': std_name,
        'gadm_name': gadm_name,
        'mean_annual_temp_c': round(mean_temp_c, 2) if mean_temp_c else None,
        'precip_seasonality_cv': round(mean_bio15, 2) if mean_bio15 else None,
        'mean_vapor_pressure_kpa': round(mean_vapr, 3) if mean_vapr else None,
    })
    
    print(f"  {std_name:20s} | Temp: {mean_temp_c:5.1f}°C | Vapr: {mean_vapr:.3f} kPa | Bio15: {mean_bio15:.1f}")

# ---------------------------------------------------------------------------
# STEP 4: Create DataFrame and save
# ---------------------------------------------------------------------------
print("\n[STEP 4] Saving results...")

df = pd.DataFrame(results)

# Sort by standard state order
state_order = {s: i for i, s in enumerate(STATES)}
df['sort_key'] = df['state'].map(state_order)
df = df.sort_values('sort_key').drop('sort_key', axis=1).reset_index(drop=True)

# Add metadata columns
df['data_source'] = 'WorldClim 2.1 (Fick & Hijmans 2017)'
df['extraction_method'] = 'Zonal statistics (rasterio + geopandas)'
df['resolution'] = '2.5 arc-minutes (~4.5 km)'
df['period'] = '1970-2000 baseline'

# Save CSV
df.to_csv(OUTPUT_CSV, index=False)
print(f"  ✓ Saved {len(df)} states to: {OUTPUT_CSV}")

# ---------------------------------------------------------------------------
# STEP 5: Summary
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("EXTRACTION COMPLETE")
print("=" * 70)
print(f"\nTemperature range: {df['mean_annual_temp_c'].min():.1f}°C ({df.loc[df['mean_annual_temp_c'].idxmin(), 'state']}) → {df['mean_annual_temp_c'].max():.1f}°C ({df.loc[df['mean_annual_temp_c'].idxmax(), 'state']})")
print(f"Vapor pressure range: {df['mean_vapor_pressure_kpa'].min():.3f} kPa ({df.loc[df['mean_vapor_pressure_kpa'].idxmin(), 'state']}) → {df['mean_vapor_pressure_kpa'].max():.3f} kPa ({df.loc[df['mean_vapor_pressure_kpa'].idxmax(), 'state']})")
print(f"Precip seasonality range: {df['precip_seasonality_cv'].min():.1f} CV ({df.loc[df['precip_seasonality_cv'].idxmin(), 'state']}) → {df['precip_seasonality_cv'].max():.1f} CV ({df.loc[df['precip_seasonality_cv'].idxmax(), 'state']})")
print("\nAll data is REAL — extracted from WorldClim 2.1 global climate surfaces.")
print("No synthetic estimates used.")
print("=" * 70)