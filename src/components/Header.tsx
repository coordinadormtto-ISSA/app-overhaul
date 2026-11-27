import React from 'react';
import { ArrowLeft, RefreshCw, Search, CheckCircle2, FileSpreadsheet, Home } from 'lucide-react';
import { ViewMode } from '../types';

interface HeaderProps {
  title: string;
  currentView: ViewMode;
  onNavigateBack: () => void;
  onGoHome?: () => void;
  onRefresh?: () => void;
  isSyncing?: boolean;
  onOpenGoogleSheets?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  currentView,
  onNavigateBack,
  onGoHome,
  onRefresh,
  isSyncing = false,
  onOpenGoogleSheets,
  searchQuery = '',
  onSearchChange,
  showSearch = true,
}) => {
  const [isSearching, setIsSearching] = React.useState(false);

  return (
    <header className="bg-[#00796B] text-white shadow-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between min-h-[56px]">
        {/* Left Side: Back Arrow or Logo */}
        <div className="flex items-center space-x-3">
          {currentView !== 'INICIO' ? (
            <button
              onClick={onNavigateBack}
              className="p-1.5 hover:bg-[#005B52] rounded-full transition-colors"
              title="Volver"
              id="header-back-btn"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          )}

          {!isSearching ? (
            <div>
              <h1 className="font-bold text-lg tracking-wide uppercase leading-tight">
                {title}
              </h1>
              <span className="text-[11px] text-teal-100 font-medium block">
                Evaluación Overhaul - Huevos Kikes
              </span>
            </div>
          ) : (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Buscar..."
              className="bg-white text-gray-800 px-3 py-1 rounded-md text-sm outline-none w-48 sm:w-64"
              autoFocus
              id="header-search-input"
            />
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-1.5">
          {onGoHome && currentView !== 'INICIO' && (
            <button
              onClick={onGoHome}
              className="bg-white/15 hover:bg-white/25 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors border border-white/25 shadow-xs cursor-pointer"
              title="Volver a la pantalla de Inicio"
              id="header-go-home-btn"
            >
              <Home className="w-3.5 h-3.5 text-teal-200" />
              <span className="hidden sm:inline">Inicio</span>
            </button>
          )}

          {onOpenGoogleSheets && (
            <button
              onClick={onOpenGoogleSheets}
              className="bg-white/15 hover:bg-white/25 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors border border-white/25 shadow-xs"
              title="Abrir base de datos en Google Sheets"
              id="header-google-sheets-btn"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Base de Datos</span>
            </button>
          )}

          {showSearch && onSearchChange && (
            <button
              onClick={() => setIsSearching(!isSearching)}
              className="p-2 hover:bg-[#005B52] rounded-full transition-colors"
              title="Buscar"
              id="header-toggle-search-btn"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className={`p-2 hover:bg-[#005B52] rounded-full transition-colors ${
                isSyncing ? 'animate-spin opacity-80' : 'active:rotate-180 transition-transform duration-300'
              }`}
              title="Sincronizar base de datos / Refrescar"
              id="header-refresh-btn"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
