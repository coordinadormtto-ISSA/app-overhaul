import React, { useState } from 'react';
import { EvaluationReport } from '../types';
import {
  MonthOption,
  getMonthOptions,
  calculateMonthlyIndicatorMatrix,
} from '../lib/indicatorsManager';
import {
  exportMatrizIndicadoresToGoogleSheets,
  ExportMatrizResult,
  MATRIZ_INDICADORES_TAB_NAME,
  SPREADSHEET_URL,
  clearGoogleToken,
  authenticateWithGoogle,
} from '../lib/googleSheetsSync';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Calendar,
  X,
  Sparkles,
  Info,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

interface GoogleSheetsMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: EvaluationReport[];
  initialMonthKey?: string;
}

export const GoogleSheetsMatrixModal: React.FC<GoogleSheetsMatrixModalProps> = ({
  isOpen,
  onClose,
  reports,
  initialMonthKey,
}) => {
  const monthOptions = React.useMemo(() => getMonthOptions(reports), [reports]);

  // Default month selection
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (initialMonthKey && monthOptions.some((m) => m.key === initialMonthKey)) {
      return initialMonthKey;
    }
    const hasAugust2026 = monthOptions.find((m) => m.key === '2026-08');
    if (hasAugust2026 && hasAugust2026.reportCount > 0) return '2026-08';
    const monthWithReports = monthOptions.find((m) => m.reportCount > 0);
    if (monthWithReports) return monthWithReports.key;
    return monthOptions[0]?.key || '2026-08';
  });

  const [selectedFarm, setSelectedFarm] = useState<string>('TODAS');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportMatrizResult | null>(null);

  React.useEffect(() => {
    if (isOpen && initialMonthKey && monthOptions.some((m) => m.key === initialMonthKey)) {
      setSelectedMonthKey(initialMonthKey);
      setExportResult(null);
      setErrorMessage(null);
    }
  }, [isOpen, initialMonthKey, monthOptions]);

  // Available farms in the dataset
  const availableFarms = React.useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      const f = (r.farm || r.zone || '').trim().toUpperCase();
      if (f) set.add(f);
    });
    return Array.from(set).sort();
  }, [reports]);

  // Current selected month option
  const currentMonthOption = React.useMemo(() => {
    return (
      monthOptions.find((m) => m.key === selectedMonthKey) ||
      monthOptions[0] || {
        key: '2026-08',
        label: 'ago-2026',
        fullLabel: 'Agosto 2026',
        startDateStr: '1/08/2026',
        endDateStr: '31/08/2026',
        reportCount: 0,
      }
    );
  }, [monthOptions, selectedMonthKey]);

  // Filter reports and build matrix
  const matrix = React.useMemo(() => {
    return calculateMonthlyIndicatorMatrix(reports, selectedMonthKey, selectedFarm);
  }, [reports, selectedFarm, selectedMonthKey]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (matrix.columns.length === 0) {
      setErrorMessage(`No hay actas registradas para el período ${currentMonthOption.label}.`);
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const res = await exportMatrizIndicadoresToGoogleSheets(
        reports,
        selectedMonthKey,
        selectedFarm
      );

      if (res.success) {
        setExportResult(res);
      } else {
        setErrorMessage(res.error || 'No se pudo exportar a Google Sheets.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Error al conectar con Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleReconnectGoogle = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      clearGoogleToken();
      await authenticateWithGoogle();
      await handleExport();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error al autenticar con Google.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#00796B] text-white p-5 flex items-start justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-teal-100">
                  Opción 1 Oficial
                </span>
                <span className="text-xs text-teal-200">•</span>
                <span className="text-xs font-semibold text-teal-100">Google Sheets Sync</span>
              </div>
              <h3 className="font-extrabold text-lg text-white">
                Publicar Matriz en Google Sheets
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 text-xs">
          {/* Success Result View */}
          {exportResult ? (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-emerald-950">
                  ¡Matriz Publicada en Google Sheets con Éxito!
                </h4>
                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                  La pestaña <strong>{MATRIZ_INDICADORES_TAB_NAME}</strong> fue actualizada con los{' '}
                  <strong>{exportResult.columnsEvaluated} galpones evaluados</strong> del mes{' '}
                  <strong>{exportResult.mesCorteLabel}</strong> con formato y colores completos.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={exportResult.tabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold bg-[#00796B] hover:bg-[#005B52] text-white flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir Pestaña en Google Sheets</span>
                </a>
                <button
                  type="button"
                  onClick={() => setExportResult(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                >
                  Publicar Otro Mes
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Target Sheet Info Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 text-teal-700 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">
                      Pestaña de Destino: {MATRIZ_INDICADORES_TAB_NAME}
                    </span>
                    <a
                      href={SPREADSHEET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline flex items-center space-x-1"
                    >
                      <span>Ver Hoja General</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    La matriz se creará o actualizará automáticamente dentro de la misma hoja oficial de
                    Kikes donde se sincronizan las actas y actividades.
                  </p>
                </div>
              </div>

              {/* Step 1: Select Month */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <label className="font-extrabold text-sm text-slate-900 block">
                  1. Selecciona el Mes de Corte a Exportar:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Mes de Corte:
                    </label>
                    <select
                      value={selectedMonthKey}
                      onChange={(e) => setSelectedMonthKey(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00796B]"
                    >
                      {monthOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.fullLabel || opt.label} ({opt.reportCount} actas)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Filtrar por Granja (Opcional):
                    </label>
                    <select
                      value={selectedFarm}
                      onChange={(e) => setSelectedFarm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00796B]"
                    >
                      <option value="TODAS">Todas las Granjas</option>
                      {availableFarms.map((f) => (
                        <option key={f} value={f}>
                          Granja: {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Period Summary Preview */}
                <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-teal-800 uppercase block">
                      Período Seleccionado:
                    </span>
                    <span className="font-bold text-xs text-slate-800">
                      {currentMonthOption.startDateStr} al {currentMonthOption.endDateStr}
                    </span>
                  </div>
                  <span className="font-extrabold text-xs px-2.5 py-1 rounded-lg bg-white border border-teal-200 text-teal-900">
                    {matrix.columns.length} actas / galpones
                  </span>
                </div>
              </div>

              {/* Informative card about color rules applied */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-xs">
                  <Info className="w-4 h-4 text-teal-700" />
                  <span>Reglas de Color que se aplicarán en Google Sheets:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <strong className="block text-slate-900">Cumplimiento Fecha:</strong>
                    <span className="text-emerald-700 font-bold">≤ 12% Verde</span> •{' '}
                    <span className="text-rose-700 font-bold">&gt; 12% Rojo</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <strong className="block text-slate-900">Condición & Grp [B],[C]:</strong>
                    <span className="text-emerald-700 font-bold">95%-100% Verde</span> •{' '}
                    <span className="text-rose-700 font-bold">&lt; 95% Rojo</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <strong className="block text-slate-900">Grupo [A] Crítico:</strong>
                    <span className="text-emerald-700 font-bold">100% Verde</span> •{' '}
                    <span className="text-rose-700 font-bold">&lt; 100% Rojo</span>
                  </div>
                </div>
              </div>

              {/* Error Feedback */}
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 space-y-2 text-rose-800 text-xs animate-in fade-in duration-150">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 flex-1">
                      <span className="font-bold">No se pudo exportar a Google Sheets</span>
                      <p className="text-[11px] text-rose-700">{errorMessage}</p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleReconnectGoogle}
                      disabled={isExporting}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs flex items-center space-x-1.5 transition-colors"
                    >
                      {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Reconectar Cuenta Google y Reintentar</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        {!exportResult && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || matrix.columns.length === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white flex items-center space-x-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publicando en MATRIZ_INDICADORES...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                  <span>Publicar en Google Sheets</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
