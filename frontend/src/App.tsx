import { useState, useEffect } from 'react';
import { Signal, SignalZero, AlertCircle } from 'lucide-react';
import { StateList } from './components/StateList';
import { Dashboard } from './components/Dashboard';
import WhatIfCalculator from './components/WhatIfCalculator';
import { ModelInfoPage } from './components/ModelInfoPage';
import { ReportsPlaceholder } from './components/ReportsPlaceholder';
import { Sidebar } from './components/Layout';
import type { State, PredictionResult } from './types';
import { fetchHealth, getPrediction } from './lib/api';

type Tab = 'dashboard' | 'whatif' | 'modelinfo' | 'reports';

type Disease = 'lassa' | 'cholera' | 'mpox' | 'ebola' | 'yellowfever';

interface DiseaseOption {
  id: Disease;
  label: string;
  icon: React.ElementType;
  available: boolean;
  description: string;
}

const diseases: DiseaseOption[] = [
  { id: 'lassa', label: 'Lassa Fever', icon: AlertCircle, available: true, description: 'Current surveillance focus' },
  { id: 'cholera', label: 'Cholera', icon: AlertCircle, available: false, description: 'Coming soon' },
  { id: 'mpox', label: 'Mpox', icon: AlertCircle, available: false, description: 'Coming soon' },
  { id: 'ebola', label: 'Ebola', icon: AlertCircle, available: false, description: 'Coming soon' },
  { id: 'yellowfever', label: 'Yellow Fever', icon: AlertCircle, available: false, description: 'Coming soon' },
];

function getCurrentEpiWeek(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.floor(dayOfYear / 7) + 1;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [selectedDisease, setSelectedDisease] = useState<Disease>('lassa');
  const [diseaseError, setDiseaseError] = useState<string | null>(null);

  const currentEpiWeek = getCurrentEpiWeek(new Date());
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await fetchHealth();
        setIsOnline(health.status === 'operational');
      } catch {
        setIsOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchPrediction = async () => {
      if (!selectedState) {
        setSelectedPrediction(null);
        setPredictionError(null);
        return;
      }

      setIsLoading(true);
      setPredictionError(null);

      try {
        const rainfall = 70;
        const temperature = 27;
        const recentCases = 0;
        const endemicFlag = selectedState.endemic ? 1 : 0;

        const prediction = await getPrediction(
          selectedState.name,
          currentEpiWeek,
          currentYear,
          rainfall,
          temperature,
          recentCases,
          endemicFlag,
          'rf'
        );
        setSelectedPrediction(prediction);
      } catch (err) {
        setPredictionError('Failed to load prediction for this state.');
        setSelectedPrediction(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrediction();
  }, [selectedState, currentEpiWeek, currentYear]);

  const handleDiseaseSelect = (disease: Disease) => {
    if (disease === 'lassa') {
      setSelectedDisease(disease);
      setDiseaseError(null);
    } else {
      setDiseaseError(`${diseases.find(d => d.id === disease)?.label} support is currently under development and will be available in a future release.`);
      const element = document.getElementById(`disease-${disease}`);
      if (element) {
        element.classList.add('animate-shake-disease');
        setTimeout(() => {
          element.classList.remove('animate-shake-disease');
        }, 600);
      }
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <StateList
                onSelectState={(state, prediction) => {
                  setSelectedState(state);
                  if (prediction) {
                    setSelectedPrediction(prediction);
                  }
                }}
                selectedState={selectedState}
              />
            </div>
            <div className="lg:col-span-2">
              <Dashboard
                selectedState={selectedState}
                prediction={selectedPrediction}
                isLoading={isLoading}
                error={predictionError}
              />
            </div>
          </div>
        );
      case 'whatif':
        return <WhatIfCalculator />;
      case 'modelinfo':
        return <ModelInfoPage />;
      case 'reports':
        return <ReportsPlaceholder />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0 z-40">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {activeTab === 'dashboard' && 'Surveillance Dashboard'}
                  {activeTab === 'whatif' && 'Scenario Simulator'}
                  {activeTab === 'modelinfo' && 'Model Information'}
                  {activeTab === 'reports' && 'Reports'}
                </h1>
                <p className="text-[10px] text-gray-500 -mt-0.5">
                  {activeTab === 'dashboard' && 'National situational awareness'}
                  {activeTab === 'whatif' && 'Simulate outbreak scenarios'}
                  {activeTab === 'modelinfo' && 'Machine learning model details'}
                  {activeTab === 'reports' && 'Outbreak reports and analysis'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Disease Selector */}
              <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
                {diseases.map((disease) => {
                  const isActive = selectedDisease === disease.id;
                  return (
                    <button
                      key={disease.id}
                      id={`disease-${disease.id}`}
                      onClick={() => handleDiseaseSelect(disease.id)}
                      disabled={!disease.available}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                        isActive && disease.available
                          ? 'bg-cyan-600 text-white'
                          : disease.available
                          ? 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                          : 'text-gray-600 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <disease.icon className="w-3 h-3" />
                      {disease.label}
                      {!disease.available && (
                        <span className="text-[8px] uppercase text-gray-500 ml-0.5">(Soon)</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Online/Offline Indicator - with cursor-pointer and hover effect */}
              {isOnline !== null && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all hover:scale-105 ${
                    isOnline
                      ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700/30 hover:bg-emerald-900/50'
                      : 'bg-red-900/30 text-red-400 border-red-700/30 hover:bg-red-900/50'
                  }`}
                  title={isOnline ? 'Backend connected' : 'Backend disconnected'}
                  onClick={() => window.open('http://localhost:8000/health', '_blank')}
                >
                  {isOnline ? <Signal className="w-3 h-3" /> : <SignalZero className="w-3 h-3" />}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              )}
            </div>
          </div>

          {/* Disease Error Message */}
          {diseaseError && (
            <div className="px-4 sm:px-6 lg:px-8 pb-3">
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 flex items-start gap-3 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-300/80">{diseaseError}</p>
                <button
                  onClick={() => setDiseaseError(null)}
                  className="text-amber-400/60 hover:text-amber-400 text-xs ml-auto"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {renderTabContent()}
        </main>

        <footer className="border-t border-gray-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 py-4 text-xs text-gray-500">
            <p>ViraWatch © 2026 | BSc Final Year Project</p>
            <p>Gregory University Uturu | Multi-Model Surveillance Pipeline</p>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes shake-disease {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake-disease {
          animation: shake-disease 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default App;