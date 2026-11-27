import React from 'react';
import { ViewMode } from '../types';
import { getMenuImage } from '../lib/customImages';
import { ChevronRight } from 'lucide-react';

interface SubMenuViewProps {
  currentView: ViewMode;
  onSelectOption: (view: ViewMode) => void;
}

export const SubMenuView: React.FC<SubMenuViewProps> = ({ currentView, onSelectOption }) => {
  if (currentView === 'ENTREGAS_VACIO') {
    const options = [
      {
        titulo: 'NUEVO REPORTE',
        subtitulo: 'Crear informe de evaluación por zona (Zucami, Salmet, Granjas Piso, El Roble)',
        target: 'NUEVO_REPORTE_MENU' as ViewMode,
        imgKey: 'submenu_nuevo_reporte',
        badge: 'Crear'
      },
      {
        titulo: 'HISTORICO',
        subtitulo: 'Consultar actas anteriores, firmadas y con observaciones',
        target: 'HISTORICO' as ViewMode,
        imgKey: 'submenu_historico',
        badge: 'Consultar'
      }
    ];

    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-2">
          <h2 className="text-base sm:text-lg font-bold text-teal-900 uppercase tracking-wide">
            Entregas en Vacío
          </h2>
          <p className="text-xs text-teal-700 mt-1">
            Gestión de evaluaciones de infraestructura y equipos post-overhaul sin aves.
          </p>
        </div>

        <div className="space-y-3">
          {options.map((opt) => {
            const imgSrc = getMenuImage(opt.imgKey);
            return (
              <button
                key={opt.titulo}
                onClick={() => onSelectOption(opt.target)}
                className="w-full bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs hover:shadow-md hover:border-teal-500 transition-all text-left flex items-center justify-between group"
                id={`sub-menu-vacio-${opt.titulo.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 p-1.5 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-teal-400 transition-colors">
                    <img
                      src={imgSrc}
                      alt={opt.titulo}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-[#00796B] transition-colors uppercase">
                      {opt.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.subtitulo}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0 ml-2">
                  <span className="hidden sm:inline-block text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    {opt.badge}
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#00796B] group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (currentView === 'INDICADORES_MENU') {
    const options = [
      {
        titulo: 'MEDICIÓN DE INDICADORES',
        subtitulo: 'Dashboard de cumplimiento por Grupo [A] Crítico, [B] Mayor y [C] Operativo con semaforización',
        target: 'INDICADORES' as ViewMode,
        imgKey: 'submenu_indicadores',
        badge: 'Métricas'
      },
      {
        titulo: 'CONFIGURAR ACTIVIDADES',
        subtitulo: 'Crear nuevas actividades por formulario/granja y clasificarlas en las 11 categorías',
        target: 'INDICADORES_ACTIVIDADES' as ViewMode,
        imgKey: 'menu_indicadores',
        badge: 'Gestión'
      }
    ];

    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-2">
          <h2 className="text-base sm:text-lg font-bold text-teal-900 uppercase tracking-wide">
            Indicadores Overhaul Kikes
          </h2>
          <p className="text-xs text-teal-700 mt-1">
            Medición del desempeño por grupos de criticidad [A], [B], [C] y configuración de actividades por formulario.
          </p>
        </div>

        <div className="space-y-3">
          {options.map((opt) => {
            const imgSrc = getMenuImage(opt.imgKey);
            return (
              <button
                key={opt.titulo}
                onClick={() => onSelectOption(opt.target)}
                className="w-full bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs hover:shadow-md hover:border-teal-500 transition-all text-left flex items-center justify-between group"
                id={`sub-menu-indicadores-${opt.titulo.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 p-1.5 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-teal-400 transition-colors">
                    <img
                      src={imgSrc}
                      alt={opt.titulo}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-[#00796B] transition-colors uppercase">
                      {opt.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.subtitulo}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0 ml-2">
                  <span className="hidden sm:inline-block text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    {opt.badge}
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#00796B] group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (currentView === 'NUEVO_REPORTE_MENU') {
    const zones = [
      {
        titulo: 'ZUCAMI',
        subtitulo: 'Sistema de Jaulas Automatizadas Zucami',
        target: 'FORM_ZUCAMI' as ViewMode,
        imgKey: 'zone_zucami',
      },
      {
        titulo: 'SALMET',
        subtitulo: 'Sistema de Jaulas Salmet en Multinivel',
        target: 'FORM_SALMET' as ViewMode,
        imgKey: 'zone_salmet',
      },
      {
        titulo: 'GRANJAS PISO',
        subtitulo: 'Galpones de Alojamiento Tradicional en Piso',
        target: 'FORM_GRANJAS_PISO' as ViewMode,
        imgKey: 'zone_granjas_piso',
      },
      {
        titulo: 'EL ROBLE',
        subtitulo: 'Estructuras y Galpones Especiales El Roble',
        target: 'FORM_EL_ROBLE' as ViewMode,
        imgKey: 'zone_el_roble',
      }
    ];

    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 uppercase tracking-wide">
            Nuevo Reporte - Seleccione la Zona / Sistema
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Cada zona posee preguntas y criterios ajustados a su fabricante y tecnología.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {zones.map((zone) => {
            const imgSrc = getMenuImage(zone.imgKey);
            return (
              <button
                key={zone.titulo}
                onClick={() => onSelectOption(zone.target)}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-500 transition-all text-left flex flex-col justify-between overflow-hidden group h-full"
                id={`zone-btn-${zone.titulo.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="w-full h-36 sm:h-40 bg-slate-50/70 p-3 flex items-center justify-center border-b border-slate-100 overflow-hidden">
                  <img
                    src={imgSrc}
                    alt={zone.titulo}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="font-extrabold text-[#00796B] text-base group-hover:text-[#005B52] transition-colors">
                      {zone.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{zone.subtitulo}</p>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#00796B]">
                    <span>Iniciar Formulario</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (currentView === 'PRUEBAS_CARGA') {
    const cargaOptions = [
      {
        titulo: 'COMPLETAR ACTA',
        subtitulo: 'Diligenciar acta de prueba técnica con carga de aves en producción',
        target: 'COMPLETAR_ACTA' as ViewMode,
        imgKey: 'submenu_completar_acta',
        badge: 'Pendientes'
      },
      {
        titulo: 'HISTORICO DE ACTAS',
        subtitulo: 'Consultar actas históricas con carga y firmas registradas',
        target: 'HISTORICO_ACTAS' as ViewMode,
        imgKey: 'submenu_historico_actas',
        badge: 'Histórico'
      }
    ];

    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="text-base sm:text-lg font-bold text-amber-900 uppercase tracking-wide">
            Pruebas con Carga
          </h2>
          <p className="text-xs text-amber-800 mt-1">
            Evaluaciones y actas finales en funcionamiento activo con animales.
          </p>
        </div>

        <div className="space-y-3">
          {cargaOptions.map((opt) => {
            const imgSrc = getMenuImage(opt.imgKey);
            return (
              <button
                key={opt.titulo}
                onClick={() => onSelectOption(opt.target)}
                className="w-full bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs hover:shadow-md hover:border-amber-500 transition-all text-left flex items-center justify-between group"
                id={`sub-menu-carga-${opt.titulo.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-14 h-14 rounded-xl bg-amber-50/50 border border-amber-200/60 p-1.5 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-amber-400 transition-colors">
                    <img
                      src={imgSrc}
                      alt={opt.titulo}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-amber-700 transition-colors uppercase">
                      {opt.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.subtitulo}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0 ml-2">
                  <span className="hidden sm:inline-block text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                    {opt.badge}
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-700 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
