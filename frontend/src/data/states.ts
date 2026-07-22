export interface State {
  name: string;
  region: string;
  density: number;
  endemic: boolean;
  meanTempC: number;          // WorldClim 2.1 Bio1 - Annual Mean Temperature (°C)
  precipSeasonality: number;  // WorldClim 2.1 Bio15 - Precipitation Seasonality (CV)
  vaporPressureKpa: number;   // WorldClim 2.1 vapr - Mean Water Vapor Pressure (kPa)
}

export const NIGERIAN_STATES: State[] = [
  { name: 'Abia', region: 'South-East', density: 924, endemic: false, meanTempC: 26.41, precipSeasonality: 65.76, vaporPressureKpa: 2.772 },
  { name: 'Adamawa', region: 'North-East', density: 142, endemic: false, meanTempC: 26.37, precipSeasonality: 106.13, vaporPressureKpa: 1.842 },
  { name: 'Akwa Ibom', region: 'South-South', density: 816, endemic: false, meanTempC: 26.49, precipSeasonality: 63.88, vaporPressureKpa: 2.908 },
  { name: 'Anambra', region: 'South-East', density: 1507, endemic: false, meanTempC: 26.81, precipSeasonality: 72.53, vaporPressureKpa: 2.658 },
  { name: 'Bauchi', region: 'North-East', density: 164, endemic: true, meanTempC: 25.89, precipSeasonality: 122.24, vaporPressureKpa: 1.611 },
  { name: 'Bayelsa', region: 'South-South', density: 114, endemic: false, meanTempC: 26.44, precipSeasonality: 62.94, vaporPressureKpa: 2.885 },
  { name: 'Benue', region: 'North-Central', density: 196, endemic: true, meanTempC: 26.96, precipSeasonality: 82.68, vaporPressureKpa: 2.458 },
  { name: 'Borno', region: 'North-East', density: 94, endemic: false, meanTempC: 27.6, precipSeasonality: 139.71, vaporPressureKpa: 1.598 },
  { name: 'Cross River', region: 'South-South', density: 208, endemic: false, meanTempC: 26.28, precipSeasonality: 70.21, vaporPressureKpa: 2.712 },
  { name: 'Delta', region: 'South-South', density: 402, endemic: false, meanTempC: 26.41, precipSeasonality: 69.38, vaporPressureKpa: 2.782 },
  { name: 'Ebonyi', region: 'South-East', density: 707, endemic: true, meanTempC: 27.27, precipSeasonality: 72.79, vaporPressureKpa: 2.696 },
  { name: 'Edo', region: 'South-South', density: 290, endemic: true, meanTempC: 25.99, precipSeasonality: 70.48, vaporPressureKpa: 2.593 },
  { name: 'Ekiti', region: 'South-West', density: 535, endemic: false, meanTempC: 24.61, precipSeasonality: 69.84, vaporPressureKpa: 2.322 },
  { name: 'Enugu', region: 'South-East', density: 754, endemic: false, meanTempC: 26.45, precipSeasonality: 75.05, vaporPressureKpa: 2.563 },
  { name: 'FCT', region: 'North-Central', density: 657, endemic: false, meanTempC: 26.86, precipSeasonality: 93.1, vaporPressureKpa: 2.166 },
  { name: 'Gombe', region: 'North-East', density: 229, endemic: false, meanTempC: 26.58, precipSeasonality: 118.75, vaporPressureKpa: 1.698 },
  { name: 'Imo', region: 'South-East', density: 1098, endemic: false, meanTempC: 26.32, precipSeasonality: 68.32, vaporPressureKpa: 2.738 },
  { name: 'Jigawa', region: 'North-West', density: 301, endemic: false, meanTempC: 26.88, precipSeasonality: 145.05, vaporPressureKpa: 1.513 },
  { name: 'Kaduna', region: 'North-West', density: 181, endemic: false, meanTempC: 25.03, precipSeasonality: 108.38, vaporPressureKpa: 1.742 },
  { name: 'Kano', region: 'North-West', density: 807, endemic: false, meanTempC: 25.95, precipSeasonality: 132.3, vaporPressureKpa: 1.564 },
  { name: 'Katsina', region: 'North-West', density: 384, endemic: false, meanTempC: 26.01, precipSeasonality: 135.36, vaporPressureKpa: 1.53 },
  { name: 'Kebbi', region: 'North-West', density: 163, endemic: false, meanTempC: 28.18, precipSeasonality: 114.5, vaporPressureKpa: 1.829 },
  { name: 'Kogi', region: 'North-Central', density: 169, endemic: true, meanTempC: 26.23, precipSeasonality: 80.49, vaporPressureKpa: 2.388 },
  { name: 'Kwara', region: 'North-Central', density: 116, endemic: false, meanTempC: 26.35, precipSeasonality: 83.83, vaporPressureKpa: 2.281 },
  { name: 'Lagos', region: 'South-West', density: 4715, endemic: false, meanTempC: 26.95, precipSeasonality: 69.2, vaporPressureKpa: 2.919 },
  { name: 'Nasarawa', region: 'North-Central', density: 135, endemic: false, meanTempC: 27.1, precipSeasonality: 92.43, vaporPressureKpa: 2.225 },
  { name: 'Niger', region: 'North-Central', density: 88, endemic: false, meanTempC: 27.17, precipSeasonality: 101.54, vaporPressureKpa: 2.102 },
  { name: 'Ogun', region: 'South-West', density: 385, endemic: false, meanTempC: 26.75, precipSeasonality: 66.65, vaporPressureKpa: 2.753 },
  { name: 'Ondo', region: 'South-West', density: 344, endemic: true, meanTempC: 25.79, precipSeasonality: 67.35, vaporPressureKpa: 2.59 },
  { name: 'Osun', region: 'South-West', density: 517, endemic: false, meanTempC: 25.74, precipSeasonality: 67.3, vaporPressureKpa: 2.482 },
  { name: 'Oyo', region: 'South-West', density: 264, endemic: false, meanTempC: 26.17, precipSeasonality: 70.33, vaporPressureKpa: 2.446 },
  { name: 'Plateau', region: 'North-Central', density: 175, endemic: false, meanTempC: 25.58, precipSeasonality: 99.51, vaporPressureKpa: 1.851 },
  { name: 'Rivers', region: 'South-South', density: 653, endemic: false, meanTempC: 26.44, precipSeasonality: 63.39, vaporPressureKpa: 2.912 },
  { name: 'Sokoto', region: 'North-West', density: 226, endemic: false, meanTempC: 28.2, precipSeasonality: 133.19, vaporPressureKpa: 1.616 },
  { name: 'Taraba', region: 'North-East', density: 80, endemic: true, meanTempC: 26.19, precipSeasonality: 91.68, vaporPressureKpa: 2.071 },
  { name: 'Yobe', region: 'North-East', density: 96, endemic: false, meanTempC: 27.37, precipSeasonality: 148.51, vaporPressureKpa: 1.482 },
  { name: 'Zamfara', region: 'North-West', density: 139, endemic: false, meanTempC: 26.91, precipSeasonality: 124.8, vaporPressureKpa: 1.668 },
];

export const ENDEMIC_STATES = ['Bauchi', 'Benue', 'Ebonyi', 'Edo', 'Kogi', 'Ondo', 'Taraba'];

export const REGIONS = [...new Set(NIGERIAN_STATES.map(s => s.region))];

// Data provenance:
// - density: NPC 2006 Census + NBS 2023 projections (via Wikipedia)
// - meanTempC: WorldClim 2.1 Bio1 - Annual Mean Temperature (°C), 1970-2000 normals
// - precipSeasonality: WorldClim 2.1 Bio15 - Precipitation Seasonality (CV), 1970-2000 normals
// - vaporPressureKpa: WorldClim 2.1 vapr - Mean Water Vapor Pressure (kPa), 1970-2000 normals
// Source: Fick & Hijmans 2017, Int. J. Climatol. 37: 4302-4315
// Extraction: Zonal statistics using rasterio + geopandas + GADM Level 1 boundaries
// Resolution: 2.5 arc-minutes (~4.5 km at equator)
// Note: 1970-2000 baseline does not include recent warming; relative state differences remain valid