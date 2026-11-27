import React, { useState } from 'react';
import { EvaluationReport } from '../types';
import { FileText, CheckCircle2, AlertTriangle, Clock, Trash2, Download, ExternalLink, Loader2, FileSpreadsheet } from 'lucide-react';
import { downloadReportPDF } from '../utils/pdfGenerator';
import { isReportSyncedToSheets } from '../lib/googleSheetsSync';
import { getPruebaConCargaTemplate } from '../data/initialData';
import { sanitizeReport } from '../lib/storage';

interface HistoricoViewProps {
  reports: EvaluationReport[];
  mode?: 'ENTREGAS_VACIO' | 'PRUEBAS_CARGA';
  onSelectReport: (report: EvaluationReport) => void;
  onDeleteReport: (id: string) => void;
  onOpenGoogleSheets?: () => void;
  onRetryAuth?: () => void;
  isSyncingSheets?: boolean;
  syncFeedback?: string | null;
  searchQuery: string;
}

export function getCargaReportObject(rawReport: EvaluationReport): EvaluationReport {
  const report = sanitizeReport(rawReport);
  if (report.reportType === 'PRUEBAS_CARGA') return report;
  if (!report.pruebaConCarga || !report.pruebaConCarga.completed) return report;

  const pc = report.pruebaConCarga;
  let pcSections = pc.sections && pc.sections.length > 0 ? pc.sections : getPruebaConCargaTemplate();

  const allItems = pcSections.flatMap((s) => s.items || []);
  const sumFailures = allItems.reduce((acc, it) => acc + (it.failuresCount || 0), 0);

  // If totalFailures is positive (e.g., 7) but individual items had 0 in an unpopulated template
  if (pc.totalFailures && pc.totalFailures > 0 && sumFailures === 0) {
    let remaining = pc.totalFailures;
    pcSections = pcSections.map((sec) => ({
      ...sec,
      items: sec.items.map((it) => {
        if (remaining > 0) {
          const count = 1;
          remaining -= count;
          return {
            ...it,
            failuresCount: count,
            status: 'no_cumple',
          };
        }
        return it;
      }),
    }));
  }

  const finalItems = pcSections.flatMap((s) => s.items);
  const totalFailures = pc.totalFailures !== undefined && !isNaN(pc.totalFailures)
    ? pc.totalFailures
    : finalItems.reduce((acc, it) => acc + (it.failuresCount || 0), 0);

  const finalSignatures =
    pc.signatures && pc.signatures.length > 0
      ? pc.signatures
      : report.signatures && report.signatures.length > 0
      ? report.signatures
      : [];

  return sanitizeReport({
    ...report,
    id: `pc-${report.id}`,
    code: report.code.startsWith('CARGA-') ? report.code : `CARGA-${report.code}`,
    reportType: 'PRUEBAS_CARGA',
    evaluationDate: pc.completedAt || pc.fechaPruebaConCarga || report.evaluationDate,
    fechaPruebaConCarga: pc.fechaPruebaConCarga || pc.completedAt,
    totalScore: pc.totalScore ?? 100,
    totalFailures,
    sections: pcSections,
    notes: pc.notes || report.notes,
    signatures: finalSignatures,
    parentReportId: report.id,
    parentReportCode: report.code,
  });
}

export const HistoricoView: React.FC<HistoricoViewProps> = ({
  reports,
  mode = 'ENTREGAS_VACIO',
  onSelectReport,
  onDeleteReport,
  onOpenGoogleSheets,
  onRetryAuth,
  isSyncingSheets = false,
  syncFeedback = null,
  searchQuery,
}) => {
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('TODAS');
  const [deletingReport, setDeletingReport] = useState<EvaluationReport | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isCargaMode = mode === 'PRUEBAS_CARGA';

  // Filter reports by type:
  // In PRUEBAS_CARGA mode: ONLY show reports that actually COMPLETED the prueba con carga.
  // In ENTREGAS_VACIO mode: show all base handover reports.
  const typeFilteredReports = reports.filter((r) => {
    if (isCargaMode) {
      return (
        r.reportType === 'PRUEBAS_CARGA' ||
        (Boolean(r.pruebaConCarga) && r.pruebaConCarga?.completed === true)
      );
    }
    return r.reportType !== 'PRUEBAS_CARGA';
  });

  const handleDownload = async (report: EvaluationReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const effectiveReport = isCargaMode ? getCargaReportObject(report) : report;
    try {
      setDownloadingId(report.id);
      await downloadReportPDF(effectiveReport);
    } catch (err) {
      console.error('Error downloading report:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewPDF = (report: EvaluationReport) => {
    const effectiveReport = isCargaMode ? getCargaReportObject(report) : report;
    onSelectReport(effectiveReport);
  };

  const filteredReports = typeFilteredReports.filter((r) => {
    const matchesSearch =
      r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.farm.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.galpon.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.evaluadorNombre && r.evaluadorNombre.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.numeroOtMp && r.numeroOtMp.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.zone.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesZone = selectedZoneFilter === 'TODAS' || r.zone === selectedZoneFilter;

    return matchesSearch && matchesZone;
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Filter Tabs & Sheets Action */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-800">
              {isCargaMode ? 'Histórico de Actas con Carga' : 'Histórico de Actas de Entrega en Vacío'} ({typeFilteredReports.length})
            </h2>
            {onOpenGoogleSheets && (
              <button
                onClick={onOpenGoogleSheets}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs"
                title="Abrir base de datos de Google Sheets"
                id="historico-open-sheets-btn"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Base de Datos</span>
              </button>
            )}
            {isSyncingSheets && (
              <span className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Actualizando...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isCargaMode
              ? 'Registro de actas con prueba técnica de carga completada (con aves) y detalle de fallas técnicas.'
              : 'Registro de evaluaciones firmadas, porcentaje de cumplimiento y guardado automático en Google Sheets.'}
          </p>
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['TODAS', 'ZUCAMI', 'SALMET', 'GRANJAS PISO', 'EL ROBLE'].map((z) => (
            <button
              key={z}
              onClick={() => setSelectedZoneFilter(z)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedZoneFilter === z
                  ? isCargaMode ? 'bg-amber-600 text-white shadow-xs' : 'bg-[#00796B] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              id={`filter-zone-${z.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {syncFeedback && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-3">
          <span>{syncFeedback}</span>
          {onRetryAuth && (
            <button
              type="button"
              onClick={onRetryAuth}
              disabled={isSyncingSheets}
              className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors disabled:opacity-50"
            >
              Conectar con Google
            </button>
          )}
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-3">
        {filteredReports.map((report) => {
          const effectiveReport = isCargaMode ? getCargaReportObject(report) : report;
          const isSynced = isReportSyncedToSheets(report.id, report.code);
          const isCarga = isCargaMode || report.reportType === 'PRUEBAS_CARGA';
          const totalFailuresCount = effectiveReport.totalFailures ?? 0;
          const displayScore = effectiveReport.totalScore;
          const displayDate = isCarga
            ? effectiveReport.fechaPruebaConCarga || effectiveReport.evaluationDate
            : effectiveReport.evaluationDate;

          return (
            <div
              key={report.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
              id={`report-card-${report.id}`}
            >
              <div className="flex items-start space-x-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                    isCarga
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-teal-50 border-teal-200 text-[#00796B]'
                  }`}
                >
                  <FileText className="w-6 h-6" />
                </div>

                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-bold text-slate-900 text-base">{report.code}</span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        isCarga
                          ? 'text-amber-800 bg-amber-50 border-amber-300'
                          : 'text-[#00796B] bg-teal-50 border-teal-200'
                      }`}
                    >
                      {report.zone}
                    </span>

                    {isCarga && (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                        Prueba con Carga Completada
                      </span>
                    )}

                    {!isCarga && report.pruebaConCarga?.completed && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded flex items-center space-x-1">
                        <span>+ Carga Registrada</span>
                      </span>
                    )}

                    {isSynced ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>En Sheets</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Pendiente Sheets</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 font-semibold mt-1">
                    Granja <span className="text-slate-900 font-bold">{report.farm}</span> • {report.galpon} (Jaula Tipo {report.cageType})
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500 mt-2">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{displayDate}</span>
                    </span>
                    {report.evaluadorNombre && (
                      <span>Evaluador: <strong className="text-slate-700">{report.evaluadorNombre}</strong></span>
                    )}
                    <span className="text-slate-300 hidden sm:inline">•</span>

                    {isCarga ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${
                          totalFailuresCount === 0
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : 'text-amber-800 bg-amber-50 border-amber-200'
                        }`}>
                          {totalFailuresCount} {totalFailuresCount === 1 ? 'Falla' : 'Fallas'}
                        </span>
                        <span className="text-slate-600 font-medium text-[10px]">
                          7 Sistemas Evaluados (GMI-F-36)
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px]">
                          {report.passedItems ?? 0} Sobre 100%
                        </span>
                        {(report.failedItems ?? 0) > 0 && (
                          <span className="text-red-700 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded text-[10px]">
                            {report.failedItems} Por debajo 100%
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side Score & Actions */}
              <div className="flex items-center justify-between md:justify-end space-x-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                {!isCarga && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Cumplimiento
                    </span>
                    <span
                      className={`text-xl font-extrabold ${
                        displayScore === 100
                          ? 'text-emerald-700'
                          : displayScore >= 90
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {displayScore}%
                    </span>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => handleDownload(report, e)}
                    disabled={downloadingId === report.id}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 border border-slate-200"
                    title="Descargar PDF directo"
                    id={`download-pdf-btn-${report.id}`}
                  >
                    {downloadingId === report.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    ) : (
                      <Download className="w-4 h-4 text-slate-600" />
                    )}
                    <span className="hidden sm:inline">Descargar</span>
                  </button>

                  <button
                    onClick={() => handleViewPDF(report)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 border ${
                      isCarga
                        ? 'bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border-amber-300'
                        : 'bg-teal-50 hover:bg-[#00796B] text-[#00796B] hover:text-white border-teal-200'
                    }`}
                    id={`view-pdf-btn-${report.id}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Ver Acta PDF</span>
                  </button>

                  <button
                    onClick={() => setDeletingReport(report)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar Acta"
                    id={`delete-report-btn-${report.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredReports.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700">
              {isCargaMode
                ? 'No hay actas de Prueba con Carga completadas aún.'
                : 'No se encontraron actas registradas para el criterio seleccionado.'}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isCargaMode
                ? 'Las actas que se encuentren en estado PENDIENTE en Google Sheets aparecen en la opción "Completar Acta con Aves" para ser evaluadas en producción.'
                : 'Cree una nueva evaluación desde el menú Nuevo Reporte para registrar entregas en vacío.'}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingReport && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">¿Eliminar Acta?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                ¿Está seguro de que desea eliminar el acta <strong className="text-slate-800">{deletingReport.code}</strong> de {deletingReport.farm}? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingReport(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteReport(deletingReport.id);
                  setDeletingReport(null);
                }}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow transition-colors"
                id="confirm-delete-report-btn"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
