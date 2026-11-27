import React, { useState, useEffect } from 'react';
import { EvaluationReport } from '../types';
import { IndicadoresMedicionView } from './IndicadoresMedicionView';
import { IndicadoresActividadesView } from './IndicadoresActividadesView';
import {
  BarChart3,
  Settings2,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Info,
  Home,
} from 'lucide-react';
import {
  syncIndicatorActivitiesBidirectional,
  exportIndicatorActivitiesToGoogleSheet,
  importIndicatorActivitiesFromGoogleSheets,
  getLastIndicatorsSyncTime,
  CATEG_ACTIVIDADES_TAB_NAME,
  SPREADSHEET_URL,
} from '../lib/googleSheetsSync';

interface IndicadoresHubViewProps {
  reports: EvaluationReport[];
  initialTab?: 'medicion' | 'actividades';
  onFormUpdated?: () => void;
  onOpenPdfReport?: (report: EvaluationReport) => void;
  onGoHome?: () => void;
}

export const IndicadoresHubView: React.FC<IndicadoresHubViewProps> = ({
  reports,
  initialTab = 'medicion',
  onFormUpdated,
  onOpenPdfReport,
  onGoHome,
}) => {
  const [activeTab, setActiveTab] = useState<'medicion' | 'actividades'>(initialTab);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncTrigger, setSyncTrigger] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastIndicatorsSyncTime());
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    if (type === 'success') {
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);
    }
  };

  const handleSyncBidirectional = async () => {
    try {
      setIsSyncing(true);
      const res = await syncIndicatorActivitiesBidirectional(undefined, true);
      if (res.success) {
        const timeStr = getLastIndicatorsSyncTime();
        setLastSyncTime(timeStr);
        setSyncTrigger((prev) => prev + 1);
        if (onFormUpdated) onFormUpdated();

        if (res.action === 'imported') {
          showFeedback(
            'success',
            `¡Sincronización exitosa! Se descargaron y actualizaron ${res.count} actividades desde la hoja "${res.tabName}" de Google Sheets.`
          );
        } else if (res.action === 'exported') {
          showFeedback(
            'success',
            `¡Sincronización exitosa! Se cargaron ${res.count} actividades a la hoja "${res.tabName}" de Google Sheets para todos los usuarios.`
          );
        } else {
          showFeedback(
            'success',
            `¡Sincronización completada! Configuración verificada con la hoja "${res.tabName}".`
          );
        }
      } else {
        showFeedback('error', res.error || 'No se pudo sincronizar con Google Sheets.');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error al conectar con Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportToSheets = async () => {
    try {
      setIsSyncing(true);
      const res = await exportIndicatorActivitiesToGoogleSheet();
      if (res.success) {
        const timeStr = getLastIndicatorsSyncTime();
        setLastSyncTime(timeStr);
        setSyncTrigger((prev) => prev + 1);
        if (onFormUpdated) onFormUpdated();
        showFeedback(
          'success',
          `¡Configuración guardada en Google Sheets! Se exportaron ${res.count} actividades a la pestaña "${res.tabName}".`
        );
      } else {
        showFeedback('error', res.error || 'Error al exportar actividades a Google Sheets.');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error al conectar con Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  const runAutoImportFromSheets = async (cancelledRef?: { current: boolean }) => {
    try {
      setIsSyncing(true);
      setFeedbackMessage(null);
      const res = await importIndicatorActivitiesFromGoogleSheets(undefined, true);
      if (cancelledRef?.current) return;
      if (res.success) {
        if (res.count > 0) {
          const timeStr = getLastIndicatorsSyncTime();
          setLastSyncTime(timeStr);
          setSyncTrigger((prev) => prev + 1);
          if (onFormUpdated) onFormUpdated();
        }
      } else {
        showFeedback(
          'error',
          res.error || 'Inicie sesión con Google para descargar las actividades más recientes.'
        );
      }
    } catch (err: any) {
      if (!cancelledRef?.current) {
        showFeedback(
          'error',
          err?.message || 'Inicie sesión con Google para descargar las actividades más recientes.'
        );
      }
    } finally {
      if (!cancelledRef?.current) {
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    const cancelledRef = { current: false };
    runAutoImportFromSheets(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-36 sm:pb-48">
      {/* Top Header with Title and Central Sync Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              MÓDULO DE INDICADORES
            </span>
            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              <span>Hoja: {CATEG_ACTIVIDADES_TAB_NAME}</span>
            </span>
            {lastSyncTime && (
              <span className="text-[11px] text-slate-500 font-medium">
                • Última sinc: {lastSyncTime}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">
            Medición y Configuración de Indicadores
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl">
            Clasificación oficial en 11 categorías y 3 grupos de criticidad [A], [B], [C]. Sincronizado centralmente en Google Sheets para todos los usuarios.
          </p>
        </div>

        {/* Sync & Navigation Buttons */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 border border-teal-200 cursor-pointer shadow-xs"
              title="Volver a la pantalla de Inicio"
              id="btn-gohome-indicadores"
            >
              <Home className="w-3.5 h-3.5 text-teal-700" />
              <span>Inicio</span>
            </button>
          )}

          <button
            onClick={handleSyncBidirectional}
            disabled={isSyncing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 shadow-xs disabled:opacity-50"
            title="Sincronizar y obtener la configuración más reciente desde la hoja CATEG_:ACTIVIDADES de Google Sheets"
            id="btn-sync-database-indicadores"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Sincronizar Base de Datos</span>
          </button>

          <button
            onClick={handleExportToSheets}
            disabled={isSyncing}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center space-x-1 shrink-0 border border-slate-300 disabled:opacity-50 cursor-pointer"
            title="Exportar configuración actual hacia la hoja CATEG_:ACTIVIDADES"
            id="btn-export-indicadores-sheets"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Subir a Hoja</span>
          </button>
        </div>
      </div>

      {/* Gray Information Banner */}
      <div className="bg-slate-100/90 border border-slate-300 rounded-xl p-3.5 text-slate-700 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="w-7 h-7 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 text-slate-600 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Sincronización Centralizada en la Hoja "{CATEG_ACTIVIDADES_TAB_NAME}"
              </h4>
              <a
                href={SPREADSHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline flex items-center space-x-1"
              >
                <span>Ver Hoja de Cálculo en Google Sheets</span>
              </a>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5 leading-relaxed">
              <p>
                <span className="font-semibold text-slate-700">Disponible para todos los usuarios:</span> Las actividades creadas, sus criterios y la asignación a las 11 categorías se almacenan centralmente en la pestaña <strong>{CATEG_ACTIVIDADES_TAB_NAME}</strong> de Google Sheets.
              </p>
              <p>
                <span className="font-semibold text-slate-700">Botón Sincronizar Base de Datos:</span> Descarga las actividades compartidas y, si la hoja está recién creada, carga automáticamente la configuración inicial para todo el equipo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          {feedbackMessage.type === 'error' && (
            <button
              type="button"
              onClick={() => runAutoImportFromSheets()}
              disabled={isSyncing}
              className="bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors disabled:opacity-50"
            >
              Conectar con Google
            </button>
          )}
        </div>
      )}

      {/* Navigation Segmented Control between KPI Measurement and Activity Configuration */}
      <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center max-w-md mx-auto shadow-inner">
        <button
          onClick={() => setActiveTab('medicion')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
            activeTab === 'medicion'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          id="tab-btn-indicadores-medicion"
        >
          <BarChart3 className="w-4 h-4 text-teal-700" />
          <span>Medición de Indicadores</span>
        </button>

        <button
          onClick={() => setActiveTab('actividades')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
            activeTab === 'actividades'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          id="tab-btn-indicadores-actividades"
        >
          <Settings2 className="w-4 h-4 text-teal-700" />
          <span>Configurar Actividades</span>
        </button>
      </div>

      {/* Render active tab content */}
      {activeTab === 'medicion' ? (
        <IndicadoresMedicionView
          key={`med-${syncTrigger}`}
          reports={reports}
          onOpenPdfReport={onOpenPdfReport}
          onGoHome={onGoHome}
        />
      ) : (
        <IndicadoresActividadesView
          key={`act-${syncTrigger}`}
          onFormUpdated={onFormUpdated}
          syncTrigger={syncTrigger}
        />
      )}
    </div>
  );
};

