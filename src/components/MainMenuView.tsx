import React from 'react';
import { ViewMode } from '../types';
import { getMenuImage } from '../lib/customImages';
import { Palette, ChevronRight, Sparkles } from 'lucide-react';

interface MainMenuViewProps {
  onSelectOption: (view: ViewMode) => void;
}

export const MainMenuView: React.FC<MainMenuViewProps> = ({ onSelectOption }) => {
  const primaryCards = [
    {
      id: 'vacio',
      key: 'menu_entregas_vacio',
      titulo: 'ENTREGAS EN VACIO',
      subtitulo: 'Crear reportes y consultar histórico de Overhaul sin aves',
      target: 'ENTREGAS_VACIO' as ViewMode,
    },
    {
      id: 'carga',
      key: 'menu_pruebas_carga',
      titulo: 'PRUEBAS CON CARGA',
      subtitulo: 'Completar y consultar actas de verificación con producción',
      target: 'PRUEBAS_CARGA' as ViewMode,
    },
    {
      id: 'indicadores',
      key: 'menu_indicadores',
      titulo: 'INDICADORES',
      subtitulo: 'Medición por grupos [A], [B], [C] y configuración de actividades',
      target: 'INDICADORES_MENU' as ViewMode,
    },
    {
      id: 'personas',
      key: 'menu_personas',
      titulo: 'PERSONAS',
      subtitulo: 'Directorio de coordinadores, auxiliares y supervisores',
      target: 'PERSONAS' as ViewMode,
    }
  ];

  const personalizacionImg = getMenuImage('menu_personalizacion');

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Welcome Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Menú Principal Overhaul</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Seleccione la sección para realizar evaluaciones, revisar histórico o administrar personal.
          </p>
        </div>
        <span className="hidden sm:inline-block px-3 py-1 bg-teal-50 text-teal-700 font-bold text-xs rounded-full border border-teal-200">
          Incubadora Santander Kikes
        </span>
      </div>

      {/* Main Menu Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {primaryCards.map((card) => {
          const imgSrc = getMenuImage(card.key);
          return (
            <button
              key={card.id}
              onClick={() => onSelectOption(card.target)}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-lg hover:border-[#00796B] transition-all text-left flex flex-col justify-between overflow-hidden group h-full transform hover:-translate-y-0.5 duration-200"
              id={`main-menu-card-${card.id}`}
            >
              {/* Card Image Area */}
              <div className="w-full h-48 sm:h-56 bg-slate-50/60 p-4 flex items-center justify-center border-b border-slate-100 overflow-hidden relative">
                <img
                  src={imgSrc}
                  alt={card.titulo}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Card Bottom Area */}
              <div className="p-4 flex flex-col justify-between flex-1">
                <div>
                  <h3 className="font-extrabold text-[#00796B] text-sm sm:text-base tracking-wide group-hover:text-[#005B52] transition-colors uppercase">
                    {card.titulo}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {card.subtitulo}
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#00796B]">
                  <span>Ingresar</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Personalización Menu Option Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 hover:border-teal-500 transition-all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-xl bg-purple-50 border border-purple-200 overflow-hidden flex items-center justify-center p-2 shrink-0">
              <img
                src={personalizacionImg}
                alt="Personalización"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-slate-800 text-base">PERSONALIZACIÓN DE MENÚS</h3>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  Nuevo
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Cambie las ilustraciones y fotografías de todas las tarjetas y opciones de navegación subiendo sus propias imágenes en formatos PNG, JPG o SVG.
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectOption('PERSONALIZACION')}
            className="w-full sm:w-auto bg-[#00796B] hover:bg-[#005B52] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center space-x-2 shrink-0"
            id="main-menu-card-personalizacion"
          >
            <Palette className="w-4 h-4" />
            <span>Configurar Imágenes</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
