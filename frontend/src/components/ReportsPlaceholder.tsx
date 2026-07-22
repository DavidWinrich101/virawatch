import React, { useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';

export const ReportsPlaceholder: React.FC = () => {
  const [isShaking, setIsShaking] = useState(false);

  const handleClick = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 800);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-100 p-8 text-center">
      <div
        className={`relative transition-all duration-300 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        <div
          className={`w-24 h-24 rounded-full bg-gray-800/50 border-2 flex items-center justify-center mb-6 transition-all duration-300 ${
            isShaking ? 'border-red-400/60 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-gray-700'
          }`}
        >
          <FileText className={`w-12 h-12 transition-colors duration-300 ${
            isShaking ? 'text-red-400' : 'text-gray-500'
          }`} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Reports</h2>
        <p className="text-gray-400 max-w-md mb-6">
          Comprehensive outbreak reports, trend analyses, and data exports will be available in this section.
        </p>
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4 max-w-lg mx-auto">
          <p className="text-sm text-gray-500">
            <span className="inline-block px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-xs font-medium mr-2">
              Coming Soon
            </span>
            This feature is currently under development and will be available in a future release.
          </p>
        </div>
        <a
          href="https://ncdc.gov.ng/diseases/info/L#background"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm font-medium"
          onClick={handleClick}
        >
          <ExternalLink className="w-4 h-4" />
          Learn more about Lassa Fever on NCDC website
        </a>
        <button
          onClick={handleClick}
          className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Click here to see placeholder animation
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.6s ease-in-out;
        }
      `}</style>
    </div>
  );
};