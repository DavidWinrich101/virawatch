/**
 * StateSelector - Searchable dropdown for Nigerian states
 * Replaces the native select with a searchable input
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { NIGERIAN_STATES } from '../../data/states';

interface StateSelectorProps {
  value: string;
  onChange: (state: string) => void;
  placeholder?: string;
  className?: string;
}

const StateSelector: React.FC<StateSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Search states...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedState = NIGERIAN_STATES.find(s => s.name === value);

  const filteredStates = NIGERIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (stateName: string) => {
    onChange(stateName);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white hover:border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <span className="truncate">
          {selectedState ? selectedState.name : placeholder}
          {selectedState && selectedState.endemic && (
            <span className="ml-2 text-xs text-red-400">⭐ Endemic</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="relative p-2 border-b border-gray-700">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search states..."
              className="w-full pl-9 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filteredStates.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">No states found</div>
            ) : (
              filteredStates.map((state) => (
                <button
                  key={state.name}
                  onClick={() => handleSelect(state.name)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <span className="text-white text-sm">{state.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{state.region}</span>
                    {state.endemic && (
                      <span className="ml-2 text-xs text-red-400">⭐</span>
                    )}
                  </div>
                  {value === state.name && (
                    <Check className="w-4 h-4 text-cyan-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StateSelector;