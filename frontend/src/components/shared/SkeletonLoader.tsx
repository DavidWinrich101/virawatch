/**
 * SkeletonLoader - Reusable skeleton loading components
 * Used for cards, charts, gauges, and text placeholders
 * 
 * Version: 1.0
 * Last updated: 2026-07-21
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const SkeletonText: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`skeleton-text ${className}`} />
);

export const SkeletonCard: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`skeleton-card ${className}`} />
);

export const SkeletonGauge: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`w-32 h-32 rounded-full skeleton ${className}`} />
);

export const SkeletonMetric: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`bg-gray-800/50 border border-gray-700 rounded-xl p-4 ${className}`}>
    <div className="w-8 h-8 rounded-lg bg-gray-700 skeleton mb-3" />
    <div className="skeleton-text w-16 mb-2" />
    <div className="skeleton-text w-24 h-5" />
  </div>
);

export const SkeletonStateList: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="flex items-center justify-between px-4 py-3 bg-gray-800/30 rounded-lg">
        <div>
          <div className="skeleton-text w-24 h-4 mb-1" />
          <div className="skeleton-text w-16 h-3" />
        </div>
        <div className="skeleton-text w-20 h-5" />
      </div>
    ))}
  </div>
);

export const SkeletonRecommendations: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-gray-700 skeleton" />
          <div className="flex-1">
            <div className="skeleton-text w-3/4 h-4 mb-2" />
            <div className="flex gap-3">
              <div className="skeleton-text w-20 h-3" />
              <div className="skeleton-text w-24 h-3" />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonChart: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`bg-gray-800/50 border border-gray-700 rounded-xl p-4 ${className}`}>
    <div className="flex justify-between mb-4">
      <div className="skeleton-text w-32 h-4" />
      <div className="skeleton-text w-20 h-4" />
    </div>
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton-text w-12 h-3" />
          <div className={`skeleton-text h-3 rounded-full`} style={{ width: `${60 + i * 8}%` }} />
        </div>
      ))}
    </div>
  </div>
);