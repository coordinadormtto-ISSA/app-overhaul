import React, { useState } from 'react';
import { Undo2, ChevronDown, ChevronUp } from 'lucide-react';

interface BottomNavProps {
  onGoHome: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onGoHome }) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  if (isMinimized) {
    return (
      <div className="fixed bottom-3 right-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center space-x-1.5 bg-[#00796B] text-white shadow-xl rounded-full pl-3 pr-2 py-1.5 border border-teal-600/80">
          <button
            onClick={onGoHome}
            className="flex items-center space-x-1.5 text-xs font-bold hover:text-teal-200 transition-colors"
            title="Volver a Inicio"
            id="bottom-nav-minimized-inicio-btn"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>INICIO</span>
          </button>
          <div className="h-4 w-px bg-teal-600 mx-1" />
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-teal-700 rounded-full transition-colors"
            title="Expandir barra inferior"
          >
            <ChevronUp className="w-3.5 h-3.5 text-teal-200" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#00796B] text-white shadow-lg z-40 border-t border-teal-800 transition-all">
      <div className="max-w-5xl mx-auto flex items-center justify-between py-1.5 px-4">
        {/* Left balance placeholder */}
        <div className="w-8 hidden sm:block" />

        {/* Center: INICIO button */}
        <button
          onClick={onGoHome}
          className="flex flex-col items-center justify-center text-white px-6 py-1 hover:bg-[#005B52] rounded transition-colors group cursor-pointer mx-auto"
          id="bottom-nav-inicio-btn"
        >
          <div className="w-7 h-7 bg-white/20 rounded flex items-center justify-center mb-0.5 group-hover:scale-110 transition-transform">
            <Undo2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-[11px] font-bold tracking-wider">INICIO</span>
        </button>

        {/* Right: Minimize toggle */}
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1.5 text-teal-200 hover:text-white hover:bg-teal-800/60 rounded-lg transition-colors text-[10px] flex items-center space-x-1"
          title="Minimizar barra inferior"
        >
          <span className="hidden sm:inline">Minimizar</span>
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
