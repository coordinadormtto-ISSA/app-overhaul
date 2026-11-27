import React, { useState } from 'react';
import {
  EvaluationReport,
  EvaluationSection,
  Persona,
  Signature
} from '../types';
import { getPruebaConCargaTemplate } from '../data/initialData';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Layers,
  Save,
  PenTool,
  X,
  ChevronDown,
  Info,
  Plus,
  Minus,
  CheckCircle,
  HelpCircle,
  Hash,
  Loader2
} from 'lucide-react';
import { SignatureModal } from './SignatureModal';
import { getCachedGoogleToken, getValidAccessToken } from '../lib/googleSheetsSync';

export interface AssistantSlot {
  personaId: string;
  nombre: string;
  cargo: string;
  correo: string;
  signatureDataUrl?: string;
}

interface PruebaCargaFormViewProps {
  parentReport: EvaluationReport;
  personas: Persona[];
  onSaveReport: (report: EvaluationReport) => Promise<void> | void;
  onCancel: () => void;
}

export const PruebaCargaFormView: React.FC<PruebaCargaFormViewProps> = ({
  parentReport,
  personas,
  onSaveReport,
  onCancel,
}) => {
  // Navigation Tabs: 0: Preguntas de Confiabilidad, 1: Asistentes y Firmas
  const [activeTab, setActiveTab] = useState<'preguntas' | 'firmas'>('preguntas');

  // Form Date for Prueba con Carga
  const todayStr = new Date().toISOString().split('T')[0];
  const [fechaPruebaConCarga, setFechaPruebaConCarga] = useState(
    parentReport.fechaPruebaConCarga || todayStr
  );

  // Sections Checklist state (7 systems)
  const [sections, setSections] = useState<EvaluationSection[]>(() => {
    return getPruebaConCargaTemplate();
  });

  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveConfirmModalOpen, setIsSaveConfirmModalOpen] = useState(false);
  const [isCancelConfirmModalOpen, setIsCancelConfirmModalOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Asistentes (up to 5) - initialized cleanly so no phantom supervisors (like Alex Fernel) appear
  const [asistentes, setAsistentes] = useState<AssistantSlot[]>(() => {
    if (parentReport.pruebaConCarga?.signatures && parentReport.pruebaConCarga.signatures.length > 0) {
      const existing = parentReport.pruebaConCarga.signatures.map((s) => ({
        personaId: s.personaId || '',
        nombre: s.nombre || '',
        cargo: s.cargo || '',
        correo: s.correo || '',
        signatureDataUrl: s.signatureDataUrl || '',
      }));
      while (existing.length < 5) {
        existing.push({ personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' });
      }
      return existing.slice(0, 5);
    }
    return [
      { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
      { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
      { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
      { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
      { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
    ];
  });

  const [activeSigningSlot, setActiveSigningSlot] = useState<number | null>(null);

  // Sorted personas list
  const sortedPersonas = [...personas].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  );

  // Handlers for question failure counts and observations
  const handleFailureCountChange = (itemId: string, newCount: number) => {
    const safeCount = Math.max(0, Math.floor(newCount));
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        items: sec.items.map((it) => {
          if (it.id === itemId) {
            return {
              ...it,
              failuresCount: safeCount,
              status: safeCount === 0 ? 'cumple' : 'no_cumple',
            };
          }
          return it;
        }),
      }))
    );
  };

  const handleObservationChange = (itemId: string, observation: string) => {
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        items: sec.items.map((it) => {
          if (it.id === itemId) {
            return { ...it, observation };
          }
          return it;
        }),
      }))
    );
  };

  const handleSelectPersona = (idx: number, personaId: string) => {
    setValidationError(null);
    if (!personaId) {
      setAsistentes((prev) =>
        prev.map((a, i) =>
          i === idx
            ? { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' }
            : a
        )
      );
      return;
    }

    const selected = personas.find((p) => p.id === personaId);
    if (!selected) return;

    setAsistentes((prev) =>
      prev.map((a, i) => {
        if (i === idx) {
          return {
            personaId: selected.id,
            nombre: selected.nombre,
            cargo: selected.cargo,
            correo: selected.correo,
            signatureDataUrl: a.signatureDataUrl || '',
          };
        }
        return a;
      })
    );
  };

  const handleSaveSignature = (dataUrl: string) => {
    if (activeSigningSlot !== null) {
      setAsistentes((prev) =>
        prev.map((a, i) => (i === activeSigningSlot ? { ...a, signatureDataUrl: dataUrl } : a))
      );
    }
    setActiveSigningSlot(null);
  };

  // Metrics calculation
  const allItems = sections.flatMap((s) => s.items);
  const totalFailures = allItems.reduce((acc, it) => acc + (it.failuresCount || 0), 0);
  const systemsWithZeroFailures = allItems.filter((it) => (it.failuresCount || 0) === 0).length;
  const reliabilityPercentage = Math.round((systemsWithZeroFailures / allItems.length) * 100);

  const handleValidateAndOpenSaveConfirm = () => {
    setValidationError(null);

    if (!fechaPruebaConCarga || !fechaPruebaConCarga.trim()) {
      setActiveTab('general');
      setValidationError('La Fecha de Prueba con Carga es obligatoria (*).');
      return;
    }

    // Validate assistant 1
    if (!asistentes[0].nombre.trim()) {
      setActiveTab('firmas');
      setValidationError('Debe seleccionar al menos el Asistente 1 (*).');
      return;
    }

    // Validate signatures
    for (let i = 0; i < asistentes.length; i++) {
      if (asistentes[i].nombre.trim() !== '' && !asistentes[i].signatureDataUrl) {
        setActiveTab('firmas');
        setValidationError(`La firma es obligatoria para ${asistentes[i].nombre} (Asistente ${i + 1}) (*).`);
        return;
      }
    }

    setIsSaveConfirmModalOpen(true);
  };

  const handleSubmit = async () => {
    setValidationError(null);
    if (!getCachedGoogleToken()) {
      getValidAccessToken(true).catch(() => null);
    }

    // Validate only assistants that are actually selected from the catalog
    const validAsistentes = asistentes.filter((a) => a.personaId && a.nombre && a.nombre.trim() !== '');
    if (validAsistentes.length === 0) {
      setActiveTab('firmas');
      setValidationError('Debe seleccionar al menos un asistente / firmante para el acta.');
      return;
    }

    // Build signatures array strictly from valid chosen attendees
    const signatures: Signature[] = validAsistentes.map((a) => ({
      role: a.cargo || 'Asistente',
      personaId: a.personaId,
      nombre: a.nombre,
      cargo: a.cargo,
      correo: a.correo,
      signedAt: a.signatureDataUrl ? new Date().toLocaleString('es-CO') : undefined,
      signatureDataUrl: a.signatureDataUrl,
    }));

    // Generate unique code for this Prueba con Carga
    const newCode = `CARGA-${parentReport.code}`;

    const newReport: EvaluationReport = {
      id: `rep-carga-${Date.now()}`,
      code: newCode,
      reportType: 'PRUEBAS_CARGA',
      zone: parentReport.zone,
      farm: parentReport.farm,
      cageType: parentReport.cageType,
      galpon: parentReport.galpon,
      evaluationDate: fechaPruebaConCarga,
      evaluadorId: validAsistentes[0]?.personaId || '',
      evaluadorNombre: validAsistentes[0]?.nombre || '',
      supervisorId: validAsistentes[1]?.personaId || '',
      supervisorNombre: validAsistentes[1]?.nombre || '',
      sections,
      totalScore: reliabilityPercentage,
      totalItems: allItems.length,
      passedItems: systemsWithZeroFailures,
      failedItems: allItems.length - systemsWithZeroFailures,
      naItems: 0,
      totalFailures,
      signatures,
      createdAt: new Date().toISOString(),
      notes,
      parentReportId: parentReport.id,
      parentReportCode: parentReport.code,

      // Inherited header data
      numeroOtMp: parentReport.numeroOtMp,
      diasVacioSanitario: parentReport.diasVacioSanitario,
      fechaInicioMantenimiento: parentReport.fechaInicioMantenimiento,
      diasMantenimientoProgramados: parentReport.diasMantenimientoProgramados,
      fechaInicioMasDiasProgramados: parentReport.fechaInicioMasDiasProgramados,
      fechaFinalizacion: parentReport.fechaFinalizacion,
      fechaFinalizacion100: parentReport.fechaFinalizacion100,
      fechaEntregaVacioProduccion: parentReport.fechaEntregaVacioProduccion,
      fechaPruebaConCarga,
      zonaNombre: parentReport.zonaNombre || parentReport.zone,
    };

    try {
      setIsSaving(true);
      await onSaveReport(newReport);
    } finally {
      setIsSaving(false);
      setIsSaveConfirmModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      {/* Top Banner Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsCancelConfirmModalOpen(true)}
              className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
              title="Volver a la lista de pendientes"
              id="back-to-pending-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-amber-100 text-amber-900 font-bold text-[10px] uppercase px-2 py-0.5 rounded-md border border-amber-300">
                  Prueba con Carga
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {parentReport.code}
                </span>
              </div>
              <h1 className="font-bold text-slate-800 text-sm sm:text-base">
                Granja {parentReport.farm} • Galpón {parentReport.galpon}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCancelConfirmModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleValidateAndOpenSaveConfirm}
              className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5"
              id="save-carga-report-btn"
            >
              <Save className="w-4 h-4" />
              <span>Finalizar y Guardar</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-5xl mx-auto px-4 flex space-x-4 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('preguntas')}
            className={`py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'preguntas'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Revisión de Confiabilidad ({allItems.length} Sistemas)</span>
          </button>
          <button
            onClick={() => setActiveTab('firmas')}
            className={`py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'firmas'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Asistentes y Firmas</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Inherited General Information Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-800">Datos Heredados de Entrega en Vacío</h2>
                <p className="text-[11px] text-slate-500">Información sincronizada del mantenimiento general</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Vacío al {parentReport.totalScore}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Zona / Sistema</span>
              <span className="font-bold text-slate-700">{parentReport.zone}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Granja</span>
              <span className="font-bold text-slate-700">{parentReport.farm}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Galpón</span>
              <span className="font-bold text-slate-700">{parentReport.galpon}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">No. OT MP</span>
              <span className="font-bold text-slate-700">{parentReport.numeroOtMp || 'N/A'}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Tipo de Jaula</span>
              <span className="font-bold text-slate-700">{parentReport.cageType || 'N/A'}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Inicio Mtto</span>
              <span className="font-bold text-slate-700">{parentReport.fechaInicioMantenimiento || 'N/A'}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Entrega Vacío</span>
              <span className="font-bold text-slate-700">{parentReport.fechaEntregaVacioProduccion || parentReport.evaluationDate}</span>
            </div>
            <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
              <label className="text-[10px] text-amber-800 font-bold uppercase block">Fecha Prueba Carga</label>
              <input
                type="date"
                value={fechaPruebaConCarga}
                onChange={(e) => setFechaPruebaConCarga(e.target.value)}
                className="w-full font-bold text-amber-950 bg-transparent border-b border-amber-300 focus:outline-none focus:border-amber-600 mt-0.5 text-xs"
                id="input-fecha-prueba-carga"
              />
            </div>
          </div>
        </div>

        {/* TAB 1: PREGUNTAS DE CONFIABILIDAD */}
        {activeTab === 'preguntas' && (
          <div className="space-y-4">
            {/* KPI Banner */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider">
                  Métricas de Confiabilidad
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Revisión Técnica desde Encasetamiento
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Registre la cantidad de fallas presentadas en MP y las observaciones respectivas para cada uno de los 7 sistemas.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <div className="bg-white/10 border border-white/15 px-4 py-2 rounded-xl text-center">
                  <div className={`text-xl font-black ${totalFailures === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {totalFailures}
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase">Fallas Totales</div>
                </div>
                <div className="bg-white/10 border border-white/15 px-4 py-2 rounded-xl text-center">
                  <div className="text-xl font-black text-white">{allItems.length}</div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase">Sistemas</div>
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {allItems.map((item, idx) => {
                const count = item.failuresCount || 0;
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-3 hover:border-amber-300 transition-colors"
                    id={`carga-item-${item.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-slate-200">
                            ÍTEM {idx + 1} • TIPO {item.category || 'A'}
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm uppercase">
                            {item.question}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
                          {item.criteria}
                        </p>
                      </div>

                      {/* Number of failures control */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center md:items-end justify-center min-w-[240px] shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center space-x-1">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <span>Fallas Desde Encasetamiento</span>
                        </span>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleFailureCountChange(item.id, count - 1)}
                            disabled={count <= 0}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center font-bold transition-colors"
                            title="Disminuir fallas"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={count}
                            onChange={(e) => handleFailureCountChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-center font-black text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                            id={`input-failures-${item.id}`}
                          />

                          <button
                            type="button"
                            onClick={() => handleFailureCountChange(item.id, count + 1)}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold transition-colors"
                            title="Aumentar fallas"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="mt-1.5">
                          {count === 0 ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>0 fallas • Confiable</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>{count} {count === 1 ? 'falla registrada' : 'fallas registradas'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Observations field */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Observaciones del Sistema
                      </label>
                      <input
                        type="text"
                        placeholder="Describa causas de fallas, correctivos aplicados o novedades en el galpón..."
                        value={item.observation || ''}
                        onChange={(e) => handleObservationChange(item.id, e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-800 placeholder:text-slate-400"
                        id={`obs-input-${item.id}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* General Notes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <h3 className="font-bold text-sm text-slate-800">Observaciones Generales de la Prueba con Carga</h3>
              <textarea
                rows={3}
                placeholder="Indique cualquier otra observación técnica, acuerdos de garantía o requerimientos de seguimiento con producción..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-800 placeholder:text-slate-400"
                id="textarea-carga-general-notes"
              />
            </div>

            {/* Bottom Next Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('firmas')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
              >
                <span>Continuar a Asistentes y Firmas</span>
                <PenTool className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ASISTENTES Y FIRMAS */}
        {activeTab === 'firmas' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Asistentes y Firmantes de Conformidad</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seleccione el personal responsable de recibir y validar la prueba con carga.
                </p>
              </div>

              {validationError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {asistentes.map((asistente, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">
                        Asistente #{idx + 1}
                      </span>
                      {asistente.signatureDataUrl && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Firmado</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Nombre de la Persona
                      </label>
                      <select
                        value={asistente.personaId}
                        onChange={(e) => handleSelectPersona(idx, e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                        id={`select-asistente-carga-${idx}`}
                      >
                        <option value="">-- Seleccionar Persona --</option>
                        {sortedPersonas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} ({p.cargo})
                          </option>
                        ))}
                      </select>
                    </div>

                    {asistente.nombre && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Cargo</span>
                          <span className="font-semibold text-slate-700">{asistente.cargo || 'N/A'}</span>
                        </div>

                        {asistente.correo && (
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Correo</span>
                            <span className="font-mono text-slate-600 text-[11px]">{asistente.correo}</span>
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setActiveSigningSlot(idx)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors"
                            id={`btn-sign-carga-${idx}`}
                          >
                            <PenTool className="w-3.5 h-3.5 text-amber-600" />
                            <span>{asistente.signatureDataUrl ? 'Actualizar Firma' : 'Firmar en Pantalla'}</span>
                          </button>

                          {asistente.signatureDataUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setAsistentes((prev) =>
                                  prev.map((a, i) => (i === idx ? { ...a, signatureDataUrl: '' } : a))
                                );
                              }}
                              className="text-xs text-red-600 hover:text-red-800 font-semibold"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>

                        {asistente.signatureDataUrl && (
                          <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center h-14">
                            <img
                              src={asistente.signatureDataUrl}
                              alt="Firma"
                              className="max-h-12 max-w-full object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3">
              <button
                type="button"
                onClick={() => setActiveTab('preguntas')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a Preguntas</span>
              </button>

              <button
                type="button"
                onClick={handleValidateAndOpenSaveConfirm}
                className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
                id="submit-carga-btn"
              >
                <Save className="w-4 h-4" />
                <span>Guardar y Finalizar Acta</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Signature Modal */}
      {activeSigningSlot !== null && (
        <SignatureModal
          isOpen={true}
          title={`Firma Asistente ${activeSigningSlot + 1} (${asistentes[activeSigningSlot]?.nombre || 'Asistente'})`}
          personaNombre={asistentes[activeSigningSlot]?.nombre || 'Asistente'}
          initialSignature={asistentes[activeSigningSlot]?.signatureDataUrl}
          onClose={() => setActiveSigningSlot(null)}
          onSave={handleSaveSignature}
          onSaveSignature={handleSaveSignature}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {isCancelConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">¿Desea cancelar el formulario?</h3>
                <p className="text-xs text-slate-500">Atención: Hay cambios sin guardar</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold">
                ⚠️ Si cancela ahora, se perderán todas las respuestas, fallas registradas y firmas de esta Prueba con Carga ({parentReport.farm} - Galpón {parentReport.galpon}).
              </p>
              <p className="text-amber-800 text-[11px]">
                Esta acción descartará el progreso y volverá a la lista de actas pendientes.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelConfirmModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                id="cancel-carga-continue-btn"
              >
                Continuar diligenciando
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCancelConfirmModalOpen(false);
                  onCancel();
                }}
                className="px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-xs"
                id="cancel-carga-confirm-discard-btn"
              >
                Sí, descartar y salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {isSaveConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <ClipboardCheck className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Confirmar Finalización de Acta con Carga</h3>
              </div>
              <button
                onClick={() => setIsSaveConfirmModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-slate-700 text-xs">
              <p className="font-semibold text-slate-800 text-sm">
                ¿Está seguro de registrar y finalizar esta acta de Prueba con Carga?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1 text-amber-900">
                <div className="font-bold text-xs">Granja {parentReport.farm} • Galpón {parentReport.galpon}</div>
                <div>Código Vinculado: <span className="font-mono font-bold">CARGA-{parentReport.code}</span></div>
                <div>Fallas Registradas: <span className="font-bold">{totalFailures}</span> ({reliabilityPercentage}% confiabilidad)</div>
                <div>Fecha de Prueba: <span className="font-bold">{fechaPruebaConCarga}</span></div>
              </div>
              <p className="text-slate-500">
                Al confirmar, el acta quedará guardada en el <strong>Histórico de Actas con Carga</strong>.
              </p>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setIsSaveConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl"
              >
                Volver a revisar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSubmit()}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-xl transition-colors shadow-xs flex items-center space-x-1.5"
                id="confirm-finalize-carga-btn"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSaving ? 'Guardando...' : 'Sí, Finalizar y Guardar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
