import React, { useState, useMemo } from 'react';
import { EvaluationReport } from '../types';
import {
  INDICATOR_CATEGORIES,
  getMonthOptions,
  calculateMonthlyIndicatorMatrix,
  DocumentIndicatorColumn,
  IndicatorCategory,
  DocumentActivityScore,
} from '../lib/indicatorsManager';
import {
  Calendar,
  Filter,
  Download,
  Copy,
  Check,
  Building2,
  FileText,
  Info,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Layers,
  X,
  ExternalLink,
  Sliders,
  ArrowLeftRight,
  FileSpreadsheet,
} from 'lucide-react';
import { GoogleSheetsMatrixModal } from './GoogleSheetsMatrixModal';
import { SPREADSHEET_URL, MATRIZ_INDICADORES_TAB_NAME } from '../lib/googleSheetsSync';

interface IndicadoresMedicionViewProps {
  reports: EvaluationReport[];
  onOpenPdfReport?: (report: EvaluationReport) => void;
  onGoHome?: () => void;
}

export const IndicadoresMedicionView: React.FC<IndicadoresMedicionViewProps> = ({
  reports,
  onOpenPdfReport,
  onGoHome,
}) => {
  // Available month options from data
  const monthOptions = useMemo(() => getMonthOptions(reports), [reports]);

  // Default to '2026-08' if exists, or month with most reports, or first available
  const defaultMonthKey = useMemo(() => {
    const hasAugust2026 = monthOptions.find((m) => m.key === '2026-08');
    if (hasAugust2026 && hasAugust2026.reportCount > 0) return '2026-08';
    const monthWithReports = monthOptions.find((m) => m.reportCount > 0);
    if (monthWithReports) return monthWithReports.key;
    return monthOptions[0]?.key || '2026-08';
  }, [monthOptions]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(defaultMonthKey);
  const [selectedFarm, setSelectedFarm] = useState<string>('TODAS');
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [isSheetsMatrixModalOpen, setIsSheetsMatrixModalOpen] = useState<boolean>(false);

  // Inspector modal state for cell details
  const [inspectingCell, setInspectingCell] = useState<{
    column: DocumentIndicatorColumn;
    category: IndicatorCategory;
    scoreData: DocumentActivityScore;
  } | null>(null);
  const [inspectingDateCell, setInspectingDateCell] = useState<DocumentIndicatorColumn | null>(null);

  // Available farms in the dataset
  const availableFarms = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      const f = (r.farm || r.zone || '').trim().toUpperCase();
      if (f) set.add(f);
    });
    return Array.from(set).sort();
  }, [reports]);

  // Calculate the monthly matrix
  const matrix = useMemo(() => {
    return calculateMonthlyIndicatorMatrix(reports, selectedMonthKey, selectedFarm);
  }, [reports, selectedMonthKey, selectedFarm]);

  // Selected month metadata
  const currentMonthOption = useMemo(() => {
    return (
      monthOptions.find((m) => m.key === selectedMonthKey) || {
        key: selectedMonthKey,
        label: selectedMonthKey,
        startDateStr: matrix.fechaInicioStr,
        endDateStr: matrix.fechaFinStr,
        reportCount: matrix.columns.length,
      }
    );
  }, [monthOptions, selectedMonthKey, matrix]);

  // Navigation handlers
  const handlePrevMonth = () => {
    const currentIndex = monthOptions.findIndex((m) => m.key === selectedMonthKey);
    if (currentIndex < monthOptions.length - 1) {
      setSelectedMonthKey(monthOptions[currentIndex + 1].key);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = monthOptions.findIndex((m) => m.key === selectedMonthKey);
    if (currentIndex > 0) {
      setSelectedMonthKey(monthOptions[currentIndex - 1].key);
    }
  };

  // Table horizontal scroll and slider state
  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const updateScrollState = React.useCallback(() => {
    if (!tableScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 0) {
      setScrollProgress(0);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const percent = Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100));
    setScrollProgress(percent);
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < maxScroll - 6);
  }, []);

  React.useEffect(() => {
    updateScrollState();
    const el = tableScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [matrix, updateScrollState]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!tableScrollRef.current) return;
    const percent = parseFloat(e.target.value);
    const { scrollWidth, clientWidth } = tableScrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    tableScrollRef.current.scrollLeft = (percent / 100) * maxScroll;
    setScrollProgress(percent);
  };

  const handleScrollBy = (amount: number) => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const handleScrollToStart = () => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const handleScrollToEnd = () => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({
      left: tableScrollRef.current.scrollWidth,
      behavior: 'smooth',
    });
  };

  // Helper formatting for score: 100 -> "100,00%"
  const formatScore = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    return `${val.toFixed(2).replace('.', ',')}%`;
  };

  // Styling rule for cells according to user criteria:
  // - Type A activities: Green if 100%, Red if < 100%
  // - Type B and C activities: Green between 95% and 100%, Red if < 95%
  const getScoreCellStyle = (score: number | null, group: 'A' | 'B' | 'C' = 'A') => {
    if (score === null || score === undefined) {
      return {
        bg: 'bg-white',
        text: 'text-slate-300',
        content: '',
      };
    }

    const isGreen = group === 'A' ? score >= 100 : score >= 95;

    if (isGreen) {
      return {
        bg: 'bg-[#bfead2] hover:bg-[#aee4c4]',
        text: 'text-slate-900 font-bold',
        content: formatScore(score),
      };
    }

    // Non-compliant (< 100% for A, < 95% for B/C) -> Red
    return {
      bg: 'bg-[#fecdd3] hover:bg-[#fda4af]',
      text: 'text-rose-950 font-bold',
      content: formatScore(score),
    };
  };

  // Export matrix to CSV (one by one per maintenance report/galpón)
  const handleExportCSV = () => {
    const rows: string[][] = [];

    // Row: Granja
    rows.push(['Granja', ...matrix.columns.map((c) => c.granja)]);

    // Row: Galpón
    rows.push(['Galpón', ...matrix.columns.map((c) => c.galpon)]);

    // Row: Fecha Entrega
    rows.push(['Fecha Entrega', ...matrix.columns.map((c) => c.fechaEntregaStr)]);

    // Row: Cumplimiento en Fecha
    rows.push([
      'Cumplimiento en Fecha',
      ...matrix.columns.map((c) => (c.cumplimientoEnFecha !== null ? formatScore(c.cumplimientoEnFecha) : '')),
    ]);

    // Row: Cumplimiento en Condición
    rows.push([
      'Cumplimiento en Condición',
      ...matrix.columns.map((c) => formatScore(c.cumplimientoEnCondicion)),
    ]);

    // Row: Días Vacio Sanitario
    rows.push([
      'Días Vacio Sanitario',
      ...matrix.columns.map((c) => (c.diasVacioSanitario !== null ? String(c.diasVacioSanitario) : '')),
    ]);

    // 11 Categories
    INDICATOR_CATEGORIES.forEach((cat) => {
      const row = [
        cat.tableLabel,
        ...matrix.columns.map((c) => {
          const s = c.categoryScores[cat.id]?.avgScore;
          return s !== null ? formatScore(s) : '';
        }),
      ];
      rows.push(row);
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((e) => e.map((val) => `"${(val || '').replace(/"/g, '""')}"`).join(';')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Indicadores_Overhaul_${currentMonthOption.label}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy table TSV to clipboard (can be pasted directly into Excel!)
  const handleCopyTableTSV = async () => {
    try {
      const lines: string[] = [];

      lines.push(['Granja', ...matrix.columns.map((c) => c.granja)].join('\t'));
      lines.push(['Galpón', ...matrix.columns.map((c) => c.galpon)].join('\t'));
      lines.push(['Fecha Entrega', ...matrix.columns.map((c) => c.fechaEntregaStr)].join('\t'));
      lines.push([
        'Cumplimiento en Fecha',
        ...matrix.columns.map((c) => (c.cumplimientoEnFecha !== null ? formatScore(c.cumplimientoEnFecha) : '')),
      ].join('\t'));
      lines.push([
        'Cumplimiento en Condición',
        ...matrix.columns.map((c) => formatScore(c.cumplimientoEnCondicion)),
      ].join('\t'));
      lines.push([
        'Días Vacio Sanitario',
        ...matrix.columns.map((c) => (c.diasVacioSanitario !== null ? String(c.diasVacioSanitario) : '')),
      ].join('\t'));

      INDICATOR_CATEGORIES.forEach((cat) => {
        const row = [
          cat.tableLabel,
          ...matrix.columns.map((c) => {
            const s = c.categoryScores[cat.id]?.avgScore;
            return s !== null ? formatScore(s) : '';
          }),
        ];
        lines.push(row.join('\t'));
      });

      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch (e) {
      console.error('Error copying table:', e);
    }
  };

  return (
    <div className="space-y-6 pb-24 sm:pb-36">
      {/* Top Banner and Description */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              MATRIZ MENSUAL DE INDICADORES
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">Overhaul Kikes</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">
            Medición de Indicadores por Tipo de Actividad
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
            Evaluación individual de actas de entrega en vacío y galpones con cálculo de cumplimiento en fecha, cumplimiento en condición y días de vacío sanitario según el corte mensual.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <button
            onClick={handleCopyTableTSV}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Copiar datos en formato de tabla para pegar directamente en Excel"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">¡Copiado para Excel!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-600" />
                <span>Copiar para Excel</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Descargar hoja en archivo CSV / Excel"
          >
            <Download className="w-4 h-4" />
            <span>Descargar CSV</span>
          </button>

          <button
            onClick={() => setIsSheetsMatrixModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Publicar matriz de indicadores con formato y colores en la pestaña MATRIZ_INDICADORES de Google Sheets"
            id="btn-export-matriz-sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>Publicar en Google Sheets</span>
          </button>

          <a
            href={SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Abrir la hoja oficial de Google Sheets en una nueva pestaña"
          >
            <ExternalLink className="w-4 h-4 text-emerald-600" />
            <span>Ver Hoja en Google Sheets</span>
          </a>
        </div>
      </div>

      {/* TOP CONFIGURATION BOX (Replicating exact Excel controls from uploaded image) */}
      <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Excel-style Cut-off Box: MES DE CORTE, FECHA INICIO, FECHA FIN */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs max-w-md w-full">
            {/* Row 1: MES DE CORTE */}
            <div className="flex items-stretch border-b border-slate-300">
              <div className="w-40 bg-slate-200/90 text-slate-900 font-bold text-xs p-2.5 border-r border-slate-300 flex items-center">
                MES DE CORTE
              </div>
              <div className="flex-1 p-2 bg-white flex items-center space-x-2">
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="select-mes-de-corte"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label} {opt.reportCount > 0 ? `(${opt.reportCount} actas)` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 italic font-medium whitespace-nowrap hidden sm:inline">
                  *Seleccione el mes de corte
                </span>
              </div>
            </div>

            {/* Row 2: FECHA INICIO */}
            <div className="flex items-stretch border-b border-slate-300">
              <div className="w-40 bg-slate-200/90 text-slate-900 font-bold text-xs p-2.5 border-r border-slate-300 flex items-center">
                FECHA INICIO
              </div>
              <div className="flex-1 p-2.5 bg-slate-50/70 text-xs font-bold text-slate-800">
                {currentMonthOption.startDateStr}
              </div>
            </div>

            {/* Row 3: FECHA FIN */}
            <div className="flex items-stretch">
              <div className="w-40 bg-slate-200/90 text-slate-900 font-bold text-xs p-2.5 border-r border-slate-300 flex items-center">
                FECHA FIN
              </div>
              <div className="flex-1 p-2.5 bg-slate-50/70 text-xs font-bold text-slate-800">
                {currentMonthOption.endDateStr}
              </div>
            </div>
          </div>

          {/* Quick Month Navigation & Granja Filters */}
          <div className="flex-1 flex flex-col justify-between space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrevMonth}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>
                <span className="text-xs font-extrabold text-slate-800 bg-teal-50 text-teal-900 px-3 py-1.5 rounded-lg border border-teal-200">
                  {currentMonthOption.fullLabel || currentMonthOption.label}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                  title="Mes siguiente"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Farm filter pills */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-200 overflow-x-auto pb-1">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] font-bold uppercase text-slate-500 shrink-0">
                Filtrar Granja:
              </span>
              <button
                onClick={() => setSelectedFarm('TODAS')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedFarm === 'TODAS'
                    ? 'bg-[#00796B] text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Todas
              </button>
              {availableFarms.map((farm) => (
                <button
                  key={farm}
                  onClick={() => setSelectedFarm(farm)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedFarm === farm
                      ? 'bg-[#00796B] text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {farm}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hint banner & Color Legend */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between text-[11px] text-slate-600 gap-2">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-teal-700 shrink-0" />
            <span>
              Mostrando <strong>{matrix.columns.length} actas</strong> de <strong>{currentMonthOption.label}</strong> (según <em>Fecha de finalización al 100%</em>) evaluadas individualmente.
            </span>
          </div>

          {/* Color threshold rules */}
          <div className="flex items-center space-x-2.5 shrink-0 flex-wrap gap-y-1">
            <span className="font-bold text-slate-700 uppercase text-[10px]">Criterio de Color:</span>
            <div className="flex items-center space-x-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#bfead2] text-slate-900 border border-teal-300">
                Cumplimiento Fecha: ≤ 12%
              </span>
              <span className="text-[10px] text-rose-700 font-semibold">(&gt; 12% Rojo)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#bfead2] text-slate-900 border border-teal-300">
                Condición & Grp [B],[C]: 95%-100%
              </span>
              <span className="text-[10px] text-rose-700 font-semibold">(&lt; 95% Rojo)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#bfead2] text-slate-900 border border-teal-300">
                Grp [A]: 100%
              </span>
              <span className="text-[10px] text-rose-700 font-semibold">(&lt; 100% Rojo)</span>
            </div>
          </div>
        </div>
      </div>

      {/* MATRIX TABLE (Matching exact orientation from uploaded Excel image) */}
      {matrix.columns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              No hay actas registradas para {currentMonthOption.label}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No se encontraron documentos de entrega en vacío finalizados en el período de{' '}
              {currentMonthOption.startDateStr} al {currentMonthOption.endDateStr}.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center space-x-3">
            <button
              onClick={() => setSelectedMonthKey('2026-08')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white transition-colors cursor-pointer shadow-xs"
            >
              Ir a Agosto 2026 (ago-2026)
            </button>
            <button
              onClick={() => setSelectedFarm('TODAS')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              Ver Todas las Granjas
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
          {/* Top Quick Navigation Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center space-x-2 text-slate-700 font-semibold">
              <ArrowLeftRight className="w-3.5 h-3.5 text-teal-700" />
              <span>Explorar actas / columnas:</span>
              <span className="text-[11px] text-slate-500 font-normal">
                ({matrix.columns.length} actas evaluadas individualmente)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleScrollToStart}
                disabled={!canScrollLeft}
                className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-[11px] font-bold text-slate-700 transition-colors cursor-pointer"
                title="Ir a las primeras actas"
              >
                ⏮ Primeras Actas
              </button>
              <button
                type="button"
                onClick={() => handleScrollBy(-220)}
                disabled={!canScrollLeft}
                className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-[11px] font-bold text-slate-700 flex items-center space-x-0.5 transition-colors cursor-pointer"
                title="Desplazar a la izquierda"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Izq</span>
              </button>
              <button
                type="button"
                onClick={() => handleScrollBy(220)}
                disabled={!canScrollRight}
                className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-[11px] font-bold text-slate-700 flex items-center space-x-0.5 transition-colors cursor-pointer"
                title="Desplazar a la derecha"
              >
                <span>Der</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleScrollToEnd}
                disabled={!canScrollRight}
                className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:pointer-events-none text-[11px] font-bold transition-colors cursor-pointer"
                title="Ir a las últimas actas"
              >
                Últimas Actas ⏭
              </button>
            </div>
          </div>

          <div ref={tableScrollRef} className="overflow-x-auto custom-table-scrollbar">
            <table className="w-full border-collapse text-xs select-none">
              <tbody>
                {/* 1. ROW: Granja */}
                <tr className="border-b border-slate-300">
                  <td className="sticky left-0 bg-white z-20 p-2.5 font-bold text-slate-900 border-r border-slate-300 min-w-[260px] sm:min-w-[320px] shadow-xs">
                    Granja
                  </td>
                  {matrix.columns.map((col) => (
                    <td
                      key={`granja-${col.reportId}`}
                      className="p-2.5 font-bold text-center text-slate-900 border-r border-slate-300 min-w-[120px] bg-slate-50/50"
                    >
                      {col.granja}
                    </td>
                  ))}
                </tr>

                {/* 2. ROW: Galpón */}
                <tr className="border-b border-slate-300">
                  <td className="sticky left-0 bg-white z-20 p-2.5 font-bold text-slate-900 border-r border-slate-300 shadow-xs">
                    Galpón
                  </td>
                  {matrix.columns.map((col) => (
                    <td
                      key={`galpon-${col.reportId}`}
                      className="p-2.5 font-bold text-center text-slate-900 border-r border-slate-300"
                    >
                      {col.galpon}
                    </td>
                  ))}
                </tr>

                {/* 3. ROW: Fecha Entrega */}
                <tr className="border-b-2 border-slate-400">
                  <td
                    className="sticky left-0 bg-white z-20 p-2.5 font-bold text-slate-900 border-r border-slate-300 shadow-xs"
                    title="Mes de corte calculado a partir de la columna: Fecha de finalización al 100%:"
                  >
                    Fecha Entrega
                  </td>
                  {matrix.columns.map((col) => (
                    <td
                      key={`fecha-${col.reportId}`}
                      className="p-2.5 font-medium text-center text-slate-800 border-r border-slate-300"
                    >
                      {col.fechaEntregaStr}
                    </td>
                  ))}
                </tr>

                {/* 4. ROW: Cumplimiento en Fecha */}
                <tr className="border-b border-slate-300">
                  <td className="sticky left-0 bg-white z-20 p-2.5 font-bold text-slate-900 border-r border-slate-300 shadow-xs flex items-center justify-between">
                    <div>
                      <span>Cumplimiento en Fecha</span>
                      <span className="block text-[10px] text-slate-500 font-normal">
                        Días Ideales (Prog.) vs Días Reales (100%)
                      </span>
                    </div>
                    <span
                      className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded cursor-help font-semibold shrink-0"
                      title="Comparación días ideales programados vs días reales al 100%. Criterio: ≤ 12% Verde, > 12% Rojo"
                    >
                      ≤ 12% Verde
                    </span>
                  </td>
                  {matrix.columns.map((col) => {
                    const isClickable = col.cumplimientoEnFecha !== null;
                    const isGreen = col.cumplimientoEnFecha !== null && col.cumplimientoEnFecha <= 12;
                    const cellBg =
                      col.cumplimientoEnFecha === null
                        ? 'bg-white text-slate-400'
                        : isGreen
                        ? 'bg-[#bfead2] text-slate-900 hover:bg-[#aee4c4]'
                        : 'bg-[#fecdd3] text-rose-950 hover:bg-[#fda4af]';

                    return (
                      <td
                        key={`cumpl_fecha-${col.reportId}`}
                        onClick={() => {
                          if (isClickable) setInspectingDateCell(col);
                        }}
                        className={`p-2.5 text-center font-bold border-r border-slate-300 ${cellBg} ${
                          isClickable
                            ? 'cursor-pointer hover:ring-2 hover:ring-teal-600 hover:ring-inset'
                            : ''
                        } transition-colors`}
                        title={
                          isClickable
                            ? `Haga clic para ver el desglose de fechas. Criterio: ≤ 12% Verde, > 12% Rojo. Actual: ${col.cumplimientoEnFecha !== null ? col.cumplimientoEnFecha : ''}%`
                            : 'Sin fechas registradas'
                        }
                      >
                        {col.cumplimientoEnFecha !== null
                          ? formatScore(col.cumplimientoEnFecha)
                          : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* 5. ROW: Cumplimiento en Condición */}
                <tr className="border-b border-slate-300">
                  <td className="sticky left-0 bg-white z-20 p-2.5 font-bold text-slate-900 border-r border-slate-300 shadow-xs flex items-center justify-between">
                    <span>Cumplimiento en Condición</span>
                    <span
                      className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded cursor-help font-semibold shrink-0"
                      title="Cumplimiento en Condición. Criterio: 95% - 100% Verde, < 95% Rojo"
                    >
                      ≥ 95% Verde
                    </span>
                  </td>
                  {matrix.columns.map((col) => {
                    const isGreen = col.cumplimientoEnCondicion >= 95;
                    const cellBg = isGreen
                      ? 'bg-[#bfead2] text-slate-900 hover:bg-[#aee4c4]'
                      : 'bg-[#fecdd3] text-rose-950 hover:bg-[#fda4af]';

                    return (
                      <td
                        key={`cumpl_condicion-${col.reportId}`}
                        className={`p-2.5 text-center font-bold border-r border-slate-300 ${cellBg}`}
                        title={`Cumplimiento en Condición: ${formatScore(col.cumplimientoEnCondicion)}. Criterio: 95% - 100% Verde, < 95% Rojo`}
                      >
                        {formatScore(col.cumplimientoEnCondicion)}
                      </td>
                    );
                  })}
                </tr>

                {/* 6. ROW: Días Vacio Sanitario */}
                <tr className="border-b-2 border-slate-400">
                  <td className="sticky left-0 bg-white z-20 p-2.5 font-bold text-slate-900 border-r border-slate-300 shadow-xs">
                    Días Vacio Sanitario
                  </td>
                  {matrix.columns.map((col) => (
                    <td
                      key={`dias_vacio-${col.reportId}`}
                      className="p-2.5 text-center font-bold text-slate-900 border-r border-slate-300 bg-white"
                    >
                      {col.diasVacioSanitario !== null ? col.diasVacioSanitario : '-'}
                    </td>
                  ))}
                </tr>

                {/* 7 - 17: THE 11 ACTIVITY CATEGORIES (in exact order from user uploaded image) */}
                {INDICATOR_CATEGORIES.map((cat, idx) => {
                  const isLastCategory = idx === INDICATOR_CATEGORIES.length - 1;

                  return (
                    <tr
                      key={cat.id}
                      className={`border-b border-slate-300 hover:bg-slate-50/50 transition-colors ${
                        isLastCategory ? 'border-b-2 border-slate-400' : ''
                      }`}
                    >
                      {/* Category Label Cell */}
                      <td className="sticky left-0 bg-white z-20 p-2.5 font-bold text-slate-900 border-r border-slate-300 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="truncate pr-2">{cat.tableLabel}</span>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${
                              cat.group === 'A'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : cat.group === 'B'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            Grp [{cat.group}]
                          </span>
                        </div>
                      </td>

                      {/* Document Columns */}
                      {matrix.columns.map((col) => {
                        const scoreData = col.categoryScores[cat.id];
                        const avg = scoreData?.avgScore;
                        const cellStyle = getScoreCellStyle(avg, cat.group);
                        const isClickable = scoreData && scoreData.items.length > 0;

                        return (
                          <td
                            key={`cell-${cat.id}-${col.reportId}`}
                            onClick={() => {
                              if (isClickable) {
                                setInspectingCell({
                                  column: col,
                                  category: cat,
                                  scoreData,
                                });
                              }
                            }}
                            className={`p-2.5 text-center border-r border-slate-300 transition-colors ${
                              cellStyle.bg
                            } ${cellStyle.text} ${
                              isClickable ? 'cursor-pointer hover:ring-2 hover:ring-teal-600 hover:ring-inset' : ''
                            }`}
                            title={
                              isClickable
                                ? `Haga clic para ver el desglose de ${scoreData.items.length} actividad(es) evaluada(s)`
                                : 'Sin actividades evaluadas en este documento'
                            }
                          >
                            {cellStyle.content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Interactive Horizontal Slider Toolbar (always visible and unobstructed) */}
          <div className="bg-slate-50 border-t border-slate-300 p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                <Sliders className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <span className="font-extrabold uppercase text-[11px] text-slate-800">
                  Deslizador Horizontal de Columnas
                </span>
                <span className="block text-[10px] font-medium text-slate-500">
                  {scrollProgress > 0
                    ? `${Math.round(scrollProgress)}% desplazado`
                    : 'Inicio (primeras actas)'}
                </span>
              </div>
            </div>

            {/* Range Slider Track */}
            <div className="flex-1 w-full max-w-lg mx-auto flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => handleScrollBy(-240)}
                disabled={!canScrollLeft}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-700 transition-colors shrink-0 shadow-2xs cursor-pointer"
                title="Desplazar hacia la izquierda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={scrollProgress}
                  onChange={handleSliderChange}
                  className="w-full accent-[#00796B] cursor-pointer h-2.5 bg-slate-200 rounded-lg outline-none"
                  title="Arrastre el deslizador horizontal para ver las columnas"
                  id="horizontal-table-slider"
                />
              </div>

              <button
                type="button"
                onClick={() => handleScrollBy(240)}
                disabled={!canScrollRight}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-700 transition-colors shrink-0 shadow-2xs cursor-pointer"
                title="Desplazar hacia la derecha"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleScrollToStart}
                className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                title="Ir a las primeras actas"
              >
                ⏮ Primeras Actas
              </button>
              <button
                type="button"
                onClick={handleScrollToEnd}
                className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                title="Ir a las últimas actas"
              >
                Últimas Actas ⏭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTOR MODAL: Break down activities for a selected category cell */}
      {inspectingCell && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    DESGLOSE DE ACTIVIDADES
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-bold text-slate-700">
                    {inspectingCell.column.granja} - Galpón {inspectingCell.column.galpon}
                  </span>
                </div>
                <h3 className="font-extrabold text-base text-slate-900 mt-1">
                  {inspectingCell.category.tableLabel}
                </h3>
              </div>
              <button
                onClick={() => setInspectingCell(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score Summary Box */}
            {(() => {
              const isGroupA = inspectingCell.category.group === 'A';
              const avg = inspectingCell.scoreData.avgScore ?? 0;
              const isCompliant = isGroupA ? avg >= 100 : avg >= 95;

              return (
                <div className={`border rounded-xl p-3.5 flex items-center justify-between ${
                  isCompliant
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-slate-600 uppercase">
                        Promedio de la Categoría
                      </span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${
                        isGroupA
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        Grupo [{inspectingCell.category.group}]
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 block">
                      {inspectingCell.scoreData.items.length} actividad(es) evaluada(s) • Criterio:{' '}
                      <strong className={isCompliant ? 'text-emerald-700' : 'text-rose-700'}>
                        {isGroupA ? '100% Verde (< 100% Rojo)' : '95%-100% Verde (< 95% Rojo)'}
                      </strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black px-3 py-1 rounded-lg ${
                      isCompliant
                        ? 'bg-[#bfead2] text-slate-900'
                        : 'bg-rose-100 text-rose-950'
                    }`}>
                      {formatScore(inspectingCell.scoreData.avgScore)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* List of evaluated activities in this category */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <span className="text-xs font-bold uppercase text-slate-700 tracking-wider block">
                Actividades Evaluadas en este Galpón:
              </span>
              {inspectingCell.scoreData.items.map((it, idx) => {
                const isGroupA = inspectingCell.category.group === 'A';
                const itCompliant = isGroupA ? it.score >= 100 : it.score >= 95;

                return (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-800">{it.question}</div>
                      {it.criteria && (
                        <div className="text-[11px] text-slate-500 italic">
                          Criterio: {it.criteria}
                        </div>
                      )}
                      {it.sectionTitle && (
                        <div className="text-[10px] text-teal-700 font-semibold uppercase">
                          Sección: {it.sectionTitle}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-extrabold ${
                          itCompliant
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {it.score}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              {onOpenPdfReport && (
                <button
                  onClick={() => {
                    onOpenPdfReport(inspectingCell.column.report);
                    setInspectingCell(null);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-[#00796B] hover:text-[#005B52] flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver Acta PDF Completa</span>
                </button>
              )}
              <button
                onClick={() => setInspectingCell(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#00796B] hover:bg-[#005B52] rounded-xl transition-colors ml-auto cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTOR MODAL: Break down Cumplimiento en Fecha calculation */}
      {inspectingDateCell && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    GUÍA DE CÁLCULO
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-bold text-slate-700">
                    {inspectingDateCell.granja} - Galpón {inspectingDateCell.galpon}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({inspectingDateCell.reportCode})
                  </span>
                </div>
                <h3 className="font-extrabold text-base text-slate-900 mt-1">
                  Indicador: Cumplimiento en Fecha
                </h3>
              </div>
              <button
                onClick={() => setInspectingDateCell(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score Summary Banner */}
            {(() => {
              const val = inspectingDateCell.cumplimientoEnFecha;
              const isGreen = val !== null && val <= 12;

              return (
                <div className={`border rounded-xl p-3.5 flex items-center justify-between ${
                  isGreen
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">
                      Resultado Cumplimiento en Fecha
                    </span>
                    <span className="text-xs text-slate-600">
                      {isGreen
                        ? 'Cumple con el cronograma programado (desviación ≤ 12%)'
                        : 'Desviación superior a la tolerancia permitida (> 12% sobre lo programado)'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black px-3 py-1 rounded-lg ${
                      isGreen
                        ? 'bg-[#bfead2] text-slate-900'
                        : 'bg-rose-100 text-rose-950'
                    }`}>
                      {val !== null
                        ? `${val > 0 ? '+' : ''}${formatScore(val)}`
                        : '-'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Excel Formula Guide Visual Container */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Fórmula Oficial en Hoja de Cálculo:
                </span>
                <span className="text-[11px] font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                  =((E2 - D2) / (F2 - D2)) - 1
                </span>
              </div>

              {/* Table mimicking Excel Columns D, E, F, G, H */}
              <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-4 bg-[#005B52] text-white text-[11px] font-bold text-center border-b border-slate-300">
                  <div className="p-2 border-r border-teal-700/50">
                    <span className="block text-[9px] text-teal-200 uppercase">Col D</span>
                    <span>FECHA DE INICIO</span>
                  </div>
                  <div className="p-2 border-r border-teal-700/50">
                    <span className="block text-[9px] text-teal-200 uppercase">Col E</span>
                    <span>Finalización al 100%</span>
                  </div>
                  <div className="p-2 border-r border-teal-700/50">
                    <span className="block text-[9px] text-teal-200 uppercase">Col F</span>
                    <span>Inicio + Días Prog.</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-[9px] text-teal-200 uppercase">Col H</span>
                    <span>Resultado</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 bg-white text-center font-semibold text-slate-800 divide-x divide-slate-200">
                  <div className="p-2.5">
                    {inspectingDateCell.cumplimientoFechaDetails?.fechaInicioStr || inspectingDateCell.report.fechaInicioMantenimiento || 'N/A'}
                  </div>
                  <div className="p-2.5">
                    {inspectingDateCell.cumplimientoFechaDetails?.fechaFinalizacion100Str || inspectingDateCell.report.fechaFinalizacion100 || 'N/A'}
                  </div>
                  <div className="p-2.5">
                    {inspectingDateCell.cumplimientoFechaDetails?.fechaProgramadaStr || inspectingDateCell.report.fechaInicioMasDiasProgramados || 'N/A'}
                  </div>
                  <div className={`p-2.5 font-bold ${
                    inspectingDateCell.cumplimientoEnFecha !== null && inspectingDateCell.cumplimientoEnFecha <= 12
                      ? 'text-slate-900 bg-[#bfead2]'
                      : 'text-rose-950 bg-rose-100'
                  }`}>
                    {inspectingDateCell.cumplimientoEnFecha !== null
                      ? formatScore(inspectingDateCell.cumplimientoEnFecha)
                      : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Step by Step Explanation */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-700">
              <span className="font-bold text-slate-800 uppercase text-[11px] block">
                Desglose Matemático:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">
                    Días reales ejecutados (E2 - D2)
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {inspectingDateCell.cumplimientoFechaDetails?.diasReales ?? '-'} días
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Desde fecha inicio hasta finalización 100%
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">
                    Días ideales programados (F2 - D2)
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {inspectingDateCell.cumplimientoFechaDetails?.diasIdeales ?? inspectingDateCell.report.diasMantenimientoProgramados ?? '-'} días
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Tiempo de mantenimiento planeado
                  </span>
                </div>
              </div>

              {inspectingDateCell.cumplimientoFechaDetails && (
                <div className="pt-1 text-[11px] text-slate-600 space-y-1">
                  <div>
                    <strong>Operación:</strong>{' '}
                    <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">
                      (({inspectingDateCell.cumplimientoFechaDetails.diasReales} - {inspectingDateCell.cumplimientoFechaDetails.diasIdeales}) / {inspectingDateCell.cumplimientoFechaDetails.diasIdeales}) = {inspectingDateCell.cumplimientoFechaDetails.desviacionDias >= 0 ? '+' : ''}{inspectingDateCell.cumplimientoFechaDetails.porcentaje.toFixed(2)}%
                    </code>
                  </div>
                  <div>
                    <strong>Variación de calendario:</strong>{' '}
                    <span>
                      {inspectingDateCell.cumplimientoFechaDetails.desviacionDias === 0
                        ? '0 días (entregado en la fecha exacta planeada)'
                        : inspectingDateCell.cumplimientoFechaDetails.desviacionDias > 0
                        ? `+${inspectingDateCell.cumplimientoFechaDetails.desviacionDias} día(s) adicionales respecto a lo programado`
                        : `${inspectingDateCell.cumplimientoFechaDetails.desviacionDias} día(s) antes de la fecha límite`}
                    </span>
                  </div>
                  {inspectingDateCell.cumplimientoFechaDetails.fechaPruebaCargaStr && (
                    <div>
                      <strong>Fecha de prueba con carga (Col G):</strong>{' '}
                      <span>{inspectingDateCell.cumplimientoFechaDetails.fechaPruebaCargaStr}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              {onOpenPdfReport && (
                <button
                  onClick={() => {
                    onOpenPdfReport(inspectingDateCell.report);
                    setInspectingDateCell(null);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-[#00796B] hover:text-[#005B52] flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver Acta PDF</span>
                </button>
              )}
              <button
                onClick={() => setInspectingDateCell(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#00796B] hover:bg-[#005B52] rounded-xl transition-colors ml-auto cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Matrix Export Modal */}
      <GoogleSheetsMatrixModal
        isOpen={isSheetsMatrixModalOpen}
        onClose={() => setIsSheetsMatrixModalOpen(false)}
        reports={reports}
        initialMonthKey={selectedMonthKey}
      />
    </div>
  );
};
