/**
 * RecommendationGroup - Grouped recommendations by stakeholder
 * Each group has a header and list of actions
 */

import React from 'react';

interface Recommendation {
  priority: number;
  action: string;
  timeline: string;
  responsible: string;
}

interface RecommendationGroupProps {
  stakeholder: string;
  icon?: React.ReactNode;
  recommendations: Recommendation[];
  variant?: 'numbered' | 'checkbox';
  className?: string;
}

const RecommendationGroup: React.FC<RecommendationGroupProps> = ({
  stakeholder,
  icon,
  recommendations,
  variant = 'numbered',
  className = '',
}) => {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const stakeholderColors: Record<string, string> = {
    'NCDC': 'bg-red-900/30 border-red-700/30 text-red-300',
    'State Ministry of Health': 'bg-amber-900/30 border-amber-700/30 text-amber-300',
    'Healthcare Facilities': 'bg-blue-900/30 border-blue-700/30 text-blue-300',
    'Local Government': 'bg-green-900/30 border-green-700/30 text-green-300',
    'Communities': 'bg-purple-900/30 border-purple-700/30 text-purple-300',
  };

  const color = stakeholderColors[stakeholder] || 'bg-gray-800/50 border-gray-700 text-gray-300';

  return (
    <div className={`rounded-lg border p-4 ${color} ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-current">{icon}</span>}
        <h4 className="font-medium text-sm">{stakeholder}</h4>
        <span className="text-xs opacity-60 ml-auto">{recommendations.length} actions</span>
      </div>

      <ul className="space-y-2">
        {recommendations.map((rec) => (
          <li
            key={rec.priority}
            className="flex items-start gap-3 text-sm"
          >
            {variant === 'numbered' ? (
              <span className="shrink-0 w-5 h-5 rounded-full bg-current/20 text-current text-xs font-bold flex items-center justify-center">
                {rec.priority}
              </span>
            ) : (
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 accent-current"
                aria-label={`Action ${rec.priority}`}
              />
            )}
            <div>
              <p className="text-white/90">{rec.action}</p>
              <div className="flex gap-3 mt-0.5 text-xs opacity-60">
                <span>⏱ {rec.timeline}</span>
                <span>👤 {rec.responsible}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecommendationGroup;