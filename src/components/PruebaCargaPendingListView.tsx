import React, { useState } from 'react';
import { EvaluationReport } from '../types';
import {
  ClipboardCheck,
  Search,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Loader2
} from 'lucide-react';

interface PruebaCargaPendingListViewProps {
  reports: EvaluationReport[];
  onSelectReportToComplete: (report: EvaluationReport) => void;
  onNavigateToHistorico: () => void;
  onRetryAuth?: () => void;
  isSyncingSheets?: boolean;
  syncFeedback?: string | null;
}

export const PruebaCargaPendingListView: React.FC<PruebaCargaPendingListViewProps> = ({
  reports,
  onSelectReportToComplete,
  onNavigateToHistorico,
  onRetryAuth,
  isSyncingSheets = false,
  syncFeedback = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('TODAS');

  // Completed PRUEBAS_CARGA parent codes/ids to exclude from pending list
  const completedCargaParentIds = new Set<string>();
  const completedCargaParentCodes = new Set<string>();

  reports.forEach((r) => {
    if (r.reportType === 'PRUEBAS_CARGA') {
      if (r.parentReportId) completedCargaParentIds.add(r.parentReportId);
      if (r.parentReportCode) completedCargaParentCodes.add(r.parentReportCode);
      if (r.code) {
        // e.g. CARGA-ACTA-2026-001 -> ACTA-2026-001
        const cleanParentCode = r.code.replace(/^CARGA-/, '');
        completedCargaParentCodes.add(cleanParentCode);
      }
    }
  });

  // Filter only ENTREGAS_VACIO that haven't been completed in PRUEBAS_CARGA yet
  const pendingVacioReports = reports.filter((r) => {
    if (r.reportType === 'PRUEBAS_CARGA') return false;
    if (r.pruebaConCarga && r.pruebaConCarga.completed) return false;
    const isCompleted =
      completedCargaParentIds.has(r.id) ||
      completedCargaParentCodes.has(r.code);
    return !isCompleted;
  });

  const completedCargaCount = reports.filter((r) => r.reportType === 'PRUEBAS_CARGA').length;

  const filteredPending = pendingVacioReports.filter((r) => {
    const matchesSearch =
      r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.farm && r.farm.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.galpon && r.galpon.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.numeroOtMp && r.numeroOtMp.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.zonaNombre && r.zonaNombre.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesZone =
      selectedZoneFilter === 'TODAS' || r.zone === selectedZoneFilter;

    return matchesSearch && matchesZone;
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-2xl p-6 shadow-md border border-amber-600/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-200 text-xs font-bold uppercase tracking-wider mb-1">
            <ClipboardCheck className="w-4 h-4" />
            <span>Módulo de Prueba con Carga</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Completar Acta con Aves</h2>
          <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-2xl">
            Seleccione una de las actas finalizadas en <strong>Entrega en Vacío</strong> para diligenciar la revisión de confiabilidad y fallas de equipos en producción.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2 rounded-xl text-center">
            <div className="text-2xl font-black text-white leading-none">{pendingVacioReports.length}</div>
            <div className="text-[10px] font-bold text-amber-200 uppercase mt-0.5">Pendientes</div>
          </div>
          {isSyncingSheets && (
            <span className="bg-amber-900/50 text-white border border-amber-500/40 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Actualizando...</span>
            </span>
          )}
          <button
            onClick={onNavigateToHistorico}
            className="bg-white text-amber-900 hover:bg-amber-50 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5"
            id="view-historico-carga-btn"
          >
            <span>Ver Histórico Carga ({completedCargaCount})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código de acta, granja, galpón, OT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
            id="pending-carga-search-input"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['TODAS', 'ZUCAMI', 'SALMET', 'GRANJAS PISO', 'EL ROBLE'].map((zone) => (
            <button
              key={zone}
              onClick={() => setSelectedZoneFilter(zone)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedZoneFilter === zone
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              id={`filter-pending-${zone.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {zone}
            </button>
          ))}
        </div>
      </div>

      {/* List of Pending Reports */}
      {filteredPending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {pendingVacioReports.length === 0
              ? 'No hay actas pendientes de Entrega en Vacío'
              : 'No se encontraron actas con los filtros aplicados'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {pendingVacioReports.length === 0
              ? 'Todas las actas de entrega en vacío registradas ya cuentan con su prueba con carga completada o no se han registrado nuevas entregas.'
              : 'Intente modificar el término de búsqueda o la zona seleccionada.'}
          </p>
          {completedCargaCount > 0 && (
            <div className="pt-2">
              <button
                onClick={onNavigateToHistorico}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors"
              >
                <span>Consultar {completedCargaCount} actas en Histórico con Carga</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPending.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-amber-400 transition-all p-5 flex flex-col justify-between group space-y-4"
              id={`pending-acta-card-${report.id}`}
            >
              <div>
                {/* Card Top */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-amber-300">
                      {report.zone}
                    </span>
                    <span className="font-mono font-black text-slate-800 text-sm">
                      {report.code}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Vacío {report.totalScore}%</span>
                  </span>
                </div>

                {/* Granja y Galpón */}
                <h3 className="font-bold text-slate-800 text-base group-hover:text-amber-700 transition-colors">
                  Granja {report.farm || 'N/A'} {report.galpon ? `• Galpón ${report.galpon}` : ''}
                </h3>

                {/* Data Grid */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">No. OT MP</span>
                    <span className="font-semibold text-slate-700">{report.numeroOtMp || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Tipo de Jaula</span>
                    <span className="font-semibold text-slate-700">{report.cageType || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Fecha Entrega Vacío</span>
                    <span className="font-semibold text-slate-700">{report.fechaEntregaVacioProduccion || report.evaluationDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Días Vacío Sanit.</span>
                    <span className="font-semibold text-slate-700">{report.diasVacioSanitario !== undefined ? `${report.diasVacioSanitario} días` : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-medium text-amber-700 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pendiente prueba técnica</span>
                </span>
                <button
                  onClick={() => onSelectReportToComplete(report)}
                  className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-xs flex items-center space-x-1.5"
                  id={`btn-complete-carga-${report.id}`}
                >
                  <span>Diligenciar Prueba</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
