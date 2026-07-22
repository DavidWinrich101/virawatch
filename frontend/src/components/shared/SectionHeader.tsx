/**
 * SectionHeader - Consistent section header with optional subtitle
 */

import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  className = '',
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-cyan-400">{icon}</span>}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
};

export default SectionHeader;