/**
 * Risk Colors - Centralized color constants for all risk tiers
 */

export const RISK_TIERS = {
  MINIMAL: 'Minimal',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
} as const;

export type RiskTier = typeof RISK_TIERS[keyof typeof RISK_TIERS];

export const RISK_COLORS = {
  Minimal: {
    bg: 'bg-gray-500',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
    gauge: '#6B7280',
    bgLight: 'bg-gray-500/10',
  },
  Low: {
    bg: 'bg-green-500',
    text: 'text-green-400',
    border: 'border-green-500/30',
    gauge: '#22C55E',
    bgLight: 'bg-green-500/10',
  },
  Moderate: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    gauge: '#F59E0B',
    bgLight: 'bg-yellow-500/10',
  },
  High: {
    bg: 'bg-red-500',
    text: 'text-red-400',
    border: 'border-red-500/30',
    gauge: '#EF4444',
    bgLight: 'bg-red-500/10',
  },
} as const;

export function getRiskTier(probability: number, isEndemic: boolean): RiskTier {
  if (isEndemic) {
    if (probability >= 0.60) return 'High';
    if (probability >= 0.30) return 'Moderate';
    if (probability >= 0.10) return 'Low';
    return 'Minimal';
  } else {
    if (probability >= 0.40) return 'High';
    if (probability >= 0.20) return 'Moderate';
    if (probability >= 0.10) return 'Low';
    return 'Minimal';
  }
}