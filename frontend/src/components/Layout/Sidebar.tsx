/**
 * Sidebar - Collapsible navigation sidebar
 * 
 * Version: 1.4 - Added reports tab
 * Last updated: 2026-07-21
 */

import React, { useState } from 'react';
import {
  LayoutDashboard, MapPin, Activity, Calendar,
  FlaskConical, Droplets, History, FileText,
  Info, Shield, ChevronLeft, ChevronRight,
} from 'lucide-react';

type Tab = 'dashboard' | 'whatif' | 'modelinfo' | 'reports';
type NavId = Tab | 'map' | 'states' | 'forecast' | 'climate' | 'history';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

interface NavItem {
  id: NavId;
  label: string;
  icon: React.ElementType;
  section: 'surveillance' | 'analytics' | 'management' | 'about';
  disabled?: boolean;
}

const navItems: NavItem[] = [
  // Surveillance
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'surveillance' },
  { id: 'map', label: 'Interactive Map', icon: MapPin, section: 'surveillance', disabled: true },
  { id: 'states', label: 'State Intelligence', icon: Activity, section: 'surveillance', disabled: true },
  { id: 'forecast', label: 'Forecast', icon: Calendar, section: 'surveillance', disabled: true },

  // Analytics
  { id: 'whatif', label: 'Scenario Simulator', icon: FlaskConical, section: 'analytics' },
  { id: 'climate', label: 'Climate Intelligence', icon: Droplets, section: 'analytics', disabled: true },

  // Management
  { id: 'history', label: 'Prediction History', icon: History, section: 'management', disabled: true },
  { id: 'reports', label: 'Reports', icon: FileText, section: 'management' },

  // About
  { id: 'modelinfo', label: 'Model Information', icon: Info, section: 'about' },
];

const sectionLabels: Record<string, string> = {
  surveillance: 'Surveillance',
  analytics: 'Analytics',
  management: 'Management',
  about: 'About',
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const [collapsed, setCollapsed] = useState(false);

  const handleTabClick = (id: NavId) => {
    if (['dashboard', 'whatif', 'modelinfo', 'reports'].includes(id)) {
      onTabChange(id as Tab);
    }
  };

  const isActive = (id: NavId): boolean => id === activeTab;
  const isValidTab = (id: NavId): boolean => ['dashboard', 'whatif', 'modelinfo', 'reports'].includes(id);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div
      className={`relative bg-gray-900/95 border-r border-gray-800 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      } shrink-0`}
    >
      {/* Logo Area - Click to Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center gap-2 px-4 h-16 w-full border-b border-gray-800 transition-all duration-200 hover:bg-gray-800/30 group"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <div className="relative">
          <Shield className="w-6 h-6 text-cyan-400 shrink-0 transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(0,200,248,0.4)] group-hover:scale-105" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold text-white tracking-tight transition-opacity duration-200">
            ViraWatch
          </span>
        )}
        {!collapsed && (
          <ChevronLeft className="w-4 h-4 text-gray-500 ml-auto transition-transform duration-300 group-hover:text-cyan-400" />
        )}
        {collapsed && (
          <ChevronRight className="w-4 h-4 text-gray-500 ml-auto transition-transform duration-300 group-hover:text-cyan-400" />
        )}
      </button>

      {/* Navigation */}
      <nav className="p-2 space-y-4 overflow-y-auto h-[calc(100vh-4rem)]">
        {Object.entries(
          navItems.reduce((acc, item) => {
            if (!acc[item.section]) acc[item.section] = [];
            acc[item.section].push(item);
            return acc;
          }, {} as Record<string, typeof navItems>)
        ).map(([section, items]) => (
          <div key={section}>
            {!collapsed && (
              <div className="px-3 py-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {sectionLabels[section]}
              </div>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.id);
                const valid = isValidTab(item.id);
                const disabled = item.disabled || !valid;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      active
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                    {active && !collapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Coming Soon indicator */}
        {!collapsed && (
          <div className="mt-4 px-3 py-2 bg-gray-800/30 rounded-lg border border-gray-700/50">
            <p className="text-[10px] text-gray-500">More features coming</p>
          </div>
        )}
      </nav>
    </div>
  );
};