import React, { useState, useEffect } from 'react';
import {
  ZoneType,
  FarmName,
  CageType,
  Persona,
  EvaluationReport,
  EvaluationSection,
  ItemStatus,
  Signature
} from '../types';
import { getSectionTemplateForZone } from '../data/initialData';
import { CheckCircle2, XCircle, MinusCircle, FileText, Send, Camera, ArrowRight, ArrowLeft, Calendar, Lock, X, ChevronDown, PenTool, AlertCircle, Save, CheckCircle, AlertTriangle, Loader2, Mail } from 'lucide-react';
import { SignatureModal } from './SignatureModal';
import { sendReportEmailViaScript } from '../utils/emailService';
import { calculateCumplimientoEnFecha, getFormSections } from '../lib/indicatorsManager';
import {
  importIndicatorActivitiesFromGoogleSheets,
  getCachedGoogleToken,
  getValidAccessToken,
} from '../lib/googleSheetsSync';

export interface AssistantSlot {
  personaId: string;
  nombre: string;
  cargo: string;
  correo: string;
  signatureDataUrl?: string;
}

export const PISO_FARMS_MAPPING: { farm: string; galpones: number }[] = [
  { farm: 'ANDALUCÍA', galpones: 7 },
  { farm: 'SAN GABRIEL', galpones: 4 },
  { farm: 'BORINQUEN', galpones: 12 },
  { farm: 'CANELOS', galpones: 6 },
  { farm: 'CONQUISTA', galpones: 6 },
  { farm: 'MUISCA', galpones: 4 },
  { farm: 'CAGUAN', galpones: 5 },
  { farm: 'LOMAS', galpones: 13 },
  { farm: 'SAN DIEGO', galpones: 9 },
  { farm: 'GUATAVITA', galpones: 4 },
  { farm: 'SAN FELIPE', galpones: 3 },
  { farm: 'TRES ESQUISAS', galpones: 5 },
  { farm: 'TRES ESQUINAS', galpones: 5 },
  { farm: 'LAGUNA', galpones: 5 },
  { farm: 'SANTA SOFIA', galpones: 3 },
  { farm: 'PARAISO', galpones: 1 },
  { farm: 'PRAGA', galpones: 4 },
  { farm: 'SANTA ISABEL', galpones: 4 },
  { farm: 'SANTA MARÍA', galpones: 4 },
].filter((v, i, a) => a.findIndex((t) => t.farm === v.farm) === i);

interface EvaluationFormViewProps {
  zone: ZoneType;
  personas: Persona[];
  onSaveReport: (
    report: EvaluationReport,
    options?: { savedToSheetViaScript?: boolean; scriptSheetMessage?: string }
  ) => Promise<void> | void;
  onCancel: () => void;
}

export const EvaluationFormView: React.FC<EvaluationFormViewProps> = ({
  zone,
  personas,
  onSaveReport,
  onCancel,
}) => {
  // Navigation Tabs inside form
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const isPisoOrRoble = zone === 'GRANJAS PISO' || zone === 'EL ROBLE';

  // Form State: Informacion General
  const [zonaNombre, setZonaNombre] = useState(
    zone === 'EL ROBLE' ? 'EL ROBLE' : zone === 'SALMET' ? 'SALMET' : zone === 'ZUCAMI' ? 'ZUCAMI' : 'GRANJAS PISO'
  );
  const [selectedFarm, setSelectedFarm] = useState<FarmName>(() => {
    if (zone === 'GRANJAS PISO') return 'CANELOS';
    if (zone === 'SALMET') return 'PALMAS';
    if (zone === 'EL ROBLE') return 'EL ROBLE';
    return 'EGIPTO';
  });
  const [selectedCageType, setSelectedCageType] = useState<CageType>(
    zone === 'GRANJAS PISO' || zone === 'EL ROBLE' ? 'PISO' : zone === 'ZUCAMI' ? 'A' : 'D'
  );
  const [galpon, setGalpon] = useState<string>(() => {
    if (zone === 'GRANJAS PISO') return '6';
    return '';
  });
  const [numeroOtMp, setNumeroOtMp] = useState('');
  const [diasVacioSanitario, setDiasVacioSanitario] = useState(8);

  const handlePisoFarmChange = (newFarm: string) => {
    setSelectedFarm(newFarm);
    if (zone === 'GRANJAS PISO') {
      const mapped = PISO_FARMS_MAPPING.find((p) => p.farm === newFarm);
      if (mapped) {
        setGalpon(mapped.galpones.toString());
      }
    }
  };

  // Maintenance dates & delivery schedule
  const [fechaInicioMantenimiento, setFechaInicioMantenimiento] = useState('');
  const [diasMantenimientoProgramados, setDiasMantenimientoProgramados] = useState(23);
  const [fechaFinalizacion, setFechaFinalizacion] = useState('2026-08-11');
  const [fechaFinalizacion100, setFechaFinalizacion100] = useState('');
  const [fechaEntregaVacioProduccion, setFechaEntregaVacioProduccion] = useState('');
  const [fechaPruebaConCarga, setFechaPruebaConCarga] = useState('');

  const [evaluatorId, setEvaluatorId] = useState(personas[0]?.id || '');
  const [supervisorId, setSupervisorId] = useState(personas[1]?.id || personas[0]?.id || '');

  // Build fresh unrated checklist sections for evaluation
  const buildUnratedSections = (targetZone: string): EvaluationSection[] => {
    const loaded = getFormSections(targetZone);
    const source = loaded && loaded.length > 0 ? loaded : getSectionTemplateForZone(targetZone);
    return source.map((sec) => ({
      ...sec,
      items: (sec.items || []).map((it) => ({
        ...it,
        status: 'cumple' as ItemStatus,
        score: undefined,
        observation: '',
        photoUrl: undefined,
      })),
    }));
  };

  // Sections Checklist state
  const [sections, setSections] = useState<EvaluationSection[]>(() => buildUnratedSections(zone));
  const [isSyncingActivities, setIsSyncingActivities] = useState(false);

  // Always fetch latest activities from CATEG_:ACTIVIDADES when entering form so deletions/additions propagate to all users
  useEffect(() => {
    let cancelled = false;
    const syncLatestActivities = async () => {
      try {
        setIsSyncingActivities(true);
        const res = await importIndicatorActivitiesFromGoogleSheets(undefined, true);
        if (cancelled) return;
        if (res.success && res.count > 0) {
          const freshUnrated = buildUnratedSections(zone);
          setSections((prevSections) => {
            // Preserve any ratings/observations the user already entered during this session
            const prevMap = new Map<string, { score?: number; status: ItemStatus; observation?: string; photoUrl?: string }>();
            prevSections.forEach((sec) => {
              sec.items.forEach((it) => {
                const normQ = it.question.replace(/^\d+[\.\)]\s*/, '').trim().toUpperCase();
                const entry = {
                  score: it.score,
                  status: it.status,
                  observation: it.observation,
                  photoUrl: it.photoUrl,
                };
                prevMap.set(it.id, entry);
                if (normQ) prevMap.set(normQ, entry);
              });
            });

            return freshUnrated.map((sec) => ({
              ...sec,
              items: sec.items.map((it) => {
                const normQ = it.question.replace(/^\d+[\.\)]\s*/, '').trim().toUpperCase();
                const touched = prevMap.get(it.id) || prevMap.get(normQ);
                if (
                  touched &&
                  (touched.score !== undefined ||
                    (touched.observation && touched.observation.trim() !== '') ||
                    touched.photoUrl)
                ) {
                  return {
                    ...it,
                    score: touched.score,
                    status: touched.status,
                    observation: touched.observation || '',
                    photoUrl: touched.photoUrl,
                  };
                }
                return it;
              }),
            }));
          });
        }
      } catch (e) {
        console.warn('Could not refresh activities on form entry:', e);
      } finally {
        if (!cancelled) setIsSyncingActivities(false);
      }
    };
    syncLatestActivities();
    return () => {
      cancelled = true;
    };
  }, [zone]);

  // Signature / Notes / Email Toggles state
  const [notes, setNotes] = useState('');
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [emailToggles, setEmailToggles] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelConfirmModalOpen, setIsCancelConfirmModalOpen] = useState(false);

  // Asistentes state (up to 5)
  const [asistentes, setAsistentes] = useState<AssistantSlot[]>([
    { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
    { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
    { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
    { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
    { personaId: '', nombre: '', cargo: '', correo: '', signatureDataUrl: '' },
  ]);
  const [activeSigningSlot, setActiveSigningSlot] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Sorted personas list alphabetically by name
  const sortedPersonas = [...personas].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  );

  const handleSelectPersona = (idx: number, personaId: string) => {
    setValidationError(null);
    if (!personaId) {
      setAsistentes((prev) =>
        prev.map((a, i) =>
          i >= idx
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
            signatureDataUrl: a.signatureDataUrl,
          };
        }
        return a;
      })
    );
  };

  const handleClearPersona = (idx: number) => {
    handleSelectPersona(idx, '');
  };

  const handleSaveSignature = (dataUrl: string) => {
    if (activeSigningSlot === null) return;
    setAsistentes((prev) =>
      prev.map((a, i) => (i === activeSigningSlot ? { ...a, signatureDataUrl: dataUrl } : a))
    );
    setActiveSigningSlot(null);
    setValidationError(null);
  };

  // Farms List
  const farmsList: FarmName[] = ['EGIPTO', 'BELLAVISTA', 'LA FLORESTA', 'SANTA MARIA', 'EL ROBLE', 'OTRA'];
  const cageTypesList: CageType[] = zone === 'GRANJAS PISO' || zone === 'EL ROBLE' ? ['PISO', 'OTRO'] : ['A', 'D', 'MEC', 'OTRO'];

  // Calculate Fecha de inicio + Días programados (formula)
  const getFechaInicioMasDias = (startDateStr: string, daysToAdd: number): string => {
    if (!startDateStr) return '';
    const parts = startDateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';
    const date = new Date(year, month, day);
    date.setDate(date.getDate() + (daysToAdd || 0));
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // All Tabs list
  const tabTitles = [
    'INFORMACIÓN GENERAL',
    ...sections.map((s) => s.title),
    'ASISTENTES',
    'PORCENTAJE FINAL DE AVANCE TOTAL',
  ];

  // Calculate live score & item counts based strictly on answered questions
  const allItems = sections.flatMap((s) => s.items);
  const totalItems = allItems.length;

  const answeredItems = allItems.filter((i) => i.score !== undefined);
  const emptyItemsCount = allItems.filter((i) => i.score === undefined).length;

  // Logic: "Sobre el 100%" counts only 100% activities; "Por debajo del 100%" counts anything below 100% (and evaluated)
  const passedItems = answeredItems.filter((i) => i.score === 100).length;
  const failedItems = answeredItems.filter((i) => i.score! < 100).length;
  const naItems = allItems.filter((i) => i.status === 'na').length;

  const totalScoreSum = answeredItems.reduce((acc, item) => acc + (item.score ?? 0), 0);
  const liveScore = answeredItems.length > 0 ? Math.round((totalScoreSum / answeredItems.length) * 100) / 100 : 0;

  const handleScoreChange = (sectionId: string, itemId: string, score: number) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          items: sec.items.map((item) => {
            if (item.id !== itemId) return item;
            const status: ItemStatus = score === 100 ? 'cumple' : 'no_cumple';
            return { ...item, score, status };
          }),
        };
      })
    );
  };

  const handleStatusChange = (sectionId: string, itemId: string, status: ItemStatus) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          items: sec.items.map((item) => {
            if (item.id !== itemId) return item;
            return { ...item, status };
          }),
        };
      })
    );
  };

  const handleObservationChange = (sectionId: string, itemId: string, obs: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          items: sec.items.map((item) => {
            if (item.id !== itemId) return item;
            return { ...item, observation: obs };
          }),
        };
      })
    );
  };

  const handlePhotoUpload = (sectionId: string, itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSections((prev) =>
        prev.map((sec) => {
          if (sec.id !== sectionId) return sec;
          return {
            ...sec,
            items: sec.items.map((item) => {
              if (item.id !== itemId) return item;
              return { ...item, photoUrl: reader.result as string };
            }),
          };
        })
      );
    };
    reader.readAsDataURL(file);
  };

  const handleValidateAndOpenSaveConfirm = () => {
    setValidationError(null);
    setAttemptedSubmit(true);

    // 1. VALIDATE TAB 0: INFORMACIÓN GENERAL (All fields marked with *)
    // Granja
    if (!selectedFarm || !selectedFarm.trim()) {
      setValidationError('La selección de GRANJA es obligatoria en Información General (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Galpón
    if (!galpon || !galpon.trim()) {
      setValidationError('El campo GALPÓN es obligatorio en Información General (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Tipo de Jaula (for Zucami)
    if (zone === 'ZUCAMI' && (!selectedCageType || !selectedCageType.trim())) {
      setValidationError('Debe seleccionar el TIPO DE JAULA en Información General (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Zona (for Granjas Piso / El Roble)
    if (isPisoOrRoble && (!zonaNombre || !zonaNombre.trim())) {
      setValidationError('El campo ZONA es obligatorio en Información General (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Días vacío sanitario
    if (diasVacioSanitario === undefined || diasVacioSanitario === null || diasVacioSanitario < 0) {
      setValidationError('El número de Días vacío sanitario es obligatorio (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Fecha de inicio del mantenimiento
    if (!fechaInicioMantenimiento || !fechaInicioMantenimiento.trim()) {
      setValidationError('La Fecha de inicio del mantenimiento es obligatoria (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Días de mantenimiento programados
    if (
      diasMantenimientoProgramados === undefined ||
      diasMantenimientoProgramados === null ||
      diasMantenimientoProgramados <= 0
    ) {
      setValidationError('Los Días de mantenimiento programados deben ser mayores a 0 (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Fecha de finalización
    if (!fechaFinalizacion || !fechaFinalizacion.trim()) {
      setValidationError('La Fecha de finalización es obligatoria (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Fecha entrega en vacío a producción
    if (!fechaEntregaVacioProduccion || !fechaEntregaVacioProduccion.trim()) {
      setValidationError('La Fecha entrega en vacío a producción es obligatoria (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Evaluador / Técnico
    if (!evaluatorId || !evaluatorId.trim()) {
      setValidationError('Debe seleccionar el Evaluador / Técnico Overhaul (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Supervisor / Coordinador
    if (!supervisorId || !supervisorId.trim()) {
      setValidationError('Debe seleccionar el Supervisor / Coordinador (*).');
      setActiveTabIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 2. VALIDATE TABS 1 to N: EVALUATION QUESTIONS (All checklist criteria must be rated)
    for (let secIdx = 0; secIdx < sections.length; secIdx++) {
      const section = sections[secIdx];
      const unratedItem = section.items.find(
        (it) => it.score === undefined || it.score === null
      );
      if (unratedItem) {
        const cleanQuestion = unratedItem.question
          .replace(/^\d+[\.\)]\s*/, '')
          .replace(/\*+$/, '')
          .trim();
        setValidationError(
          `Todas las preguntas de evaluación (*) son obligatorias. Faltan ${emptyItemsCount} preguntas por responder. Falta calificar en "${section.title}": "${cleanQuestion}".`
        );
        setActiveTabIndex(secIdx + 1); // Jump to the section's tab
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // 3. VALIDATE TAB ASISTENTES: REGISTRO Y FIRMAS
    // Asistente 1 is required
    if (!asistentes[0].nombre.trim()) {
      setValidationError('Debe seleccionar el Nombre del Asistente 1 (Obligatorio *).');
      setActiveTabIndex(sections.length + 1); // Jump to ASISTENTES tab
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Asistente 1 signature is required
    if (!asistentes[0].signatureDataUrl) {
      setValidationError(`La firma es obligatoria para el Asistente 1 (${asistentes[0].nombre}) (*).`);
      setActiveTabIndex(sections.length + 1); // Jump to ASISTENTES tab
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Signature is required for every additional selected assistant
    for (let i = 1; i < asistentes.length; i++) {
      if (asistentes[i].nombre.trim() !== '' && !asistentes[i].signatureDataUrl) {
        setValidationError(`La firma es obligatoria para el Asistente ${i + 1} (${asistentes[i].nombre}) (*).`);
        setActiveTabIndex(sections.length + 1); // Jump to ASISTENTES tab
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Validation passed -> Ensure Google token exists within click gesture (unless Apps Script bridge handles writes)
    if (!getCachedGoogleToken() && localStorage.getItem('apps_script_supports_sheets_write') !== '1') {
      getValidAccessToken(true).catch(() => null);
    }

    setIsSaving(true);
    executeSave()
      .catch((err) => {
        console.error('Error executing save:', err);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const executeSave = async () => {
    const filledAsistentes = asistentes.filter((a) => a.nombre.trim() !== '');
    const evaluator = personas.find((p) => p.id === filledAsistentes[0]?.personaId) || personas[0];
    const supervisor = personas.find((p) => p.id === filledAsistentes[1]?.personaId) || personas[1] || evaluator;

    const checkedEmailPersonas = sortedPersonas.filter(
      (p) => p.mostrarOpcionCorreo && emailToggles[p.id] === true && p.correo
    );

    const emailRecipients = [
      ...filledAsistentes.map((a) => a.correo),
      ...checkedEmailPersonas.map((p) => p.correo),
    ].filter((v, i, a) => v && v.trim() !== '' && a.indexOf(v) === i);

    const reportCode = `ACTA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const reportSignatures: Signature[] = filledAsistentes.map((a, idx) => ({
      role: `Asistente ${idx + 1}`,
      personaId: a.personaId,
      nombre: a.nombre,
      cargo: a.cargo,
      correo: a.correo,
      signedAt: new Date().toLocaleString('es-CO'),
      signatureDataUrl: a.signatureDataUrl,
    }));

    const newReport: EvaluationReport = {
      id: `rep-${Date.now()}`,
      code: reportCode,
      reportType: 'ENTREGAS_VACIO',
      zone,
      farm: selectedFarm,
      cageType: selectedCageType,
      galpon: galpon.trim() || 'Galpón 1',
      evaluationDate: new Date().toISOString().split('T')[0],
      evaluadorId: evaluator.id,
      evaluadorNombre: evaluator.nombre,
      supervisorId: supervisor.id,
      supervisorNombre: supervisor.nombre,
      sections,
      totalScore: liveScore,
      totalItems,
      passedItems,
      failedItems,
      naItems,
      signatures: reportSignatures,
      emailSentTo: emailRecipients,
      pdfGenerated: true,
      createdAt: new Date().toISOString(),
      notes: notes.trim(),

      // General Info fields
      zonaNombre,
      numeroOtMp,
      diasVacioSanitario,
      fechaInicioMantenimiento,
      diasMantenimientoProgramados,
      fechaInicioMasDiasProgramados: getFechaInicioMasDias(fechaInicioMantenimiento, diasMantenimientoProgramados),
      fechaFinalizacion,
      fechaFinalizacion100,
      fechaEntregaVacioProduccion,
      fechaPruebaConCarga,
    };

    // Calculate Cumplimiento en fecha based on formula: =((E2-D2)/(F2-D2))-1
    const { score: calcCumplimiento } = calculateCumplimientoEnFecha(newReport);
    if (calcCumplimiento !== null) {
      newReport.cumplimientoEnFecha = calcCumplimiento;
    }

    // Activate the email script directly when completing the form
    let savedToSheetViaScript = false;
    let scriptSheetMessage: string | undefined = undefined;
    if (emailRecipients.length > 0) {
      try {
        const emailResult = await Promise.race([
          sendReportEmailViaScript(newReport),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000)),
        ]);
        if (emailResult && emailResult.savedToSheet) {
          savedToSheetViaScript = true;
          scriptSheetMessage = emailResult.sheetMessage;
        }
      } catch (err) {
        console.warn('Background email send execution:', err);
      }
    }

    await onSaveReport(newReport, { savedToSheetViaScript, scriptSheetMessage });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-28">
      {/* Top Banner with Zone Title and Score Badge */}
      <div className="bg-[#00796B] text-white rounded-xl p-4 shadow mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-teal-200">
            FORMULARIO DE EVALUACIÓN OVERHAUL
          </span>
          <div className="flex items-center space-x-2.5 flex-wrap">
            <h2 className="text-xl font-bold uppercase">{zone}</h2>
            {isSyncingActivities && (
              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold bg-white/15 text-teal-50 px-2 py-0.5 rounded-md border border-white/20">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Actualizando actividades...</span>
              </span>
            )}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-lg px-4 py-2 flex items-center space-x-3">
          <div className="text-right">
            <div className="text-[10px] uppercase text-teal-100 font-semibold">Cumplimiento</div>
            <div className={`text-xl font-extrabold ${liveScore === 100 ? 'text-emerald-300' : liveScore >= 90 ? 'text-amber-300' : 'text-red-300'}`}>
              {liveScore}%
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-xs text-teal-100 space-y-0.5">
            <span className="text-emerald-300 font-bold block">{passedItems} ✓ Sobre el 100%</span>
            {failedItems > 0 && <span className="text-red-300 font-bold block">{failedItems} ✕ Por debajo del 100%</span>}
            {emptyItemsCount > 0 && <span className="text-slate-200 font-medium block">{emptyItemsCount} ○ Vacías</span>}
          </div>
        </div>
      </div>

      {/* Horizontal Tabs Scroll Bar (matching AppSheet screenshot) */}
      <div className="overflow-x-auto no-scrollbar bg-slate-100 p-1.5 rounded-xl border border-slate-200 mb-4 flex space-x-1">
        {tabTitles.map((title, idx) => (
          <button
            key={title}
            onClick={() => setActiveTabIndex(idx)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              activeTabIndex === idx
                ? 'bg-[#00796B] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
            id={`form-tab-${idx}`}
          >
            {title}
          </button>
        ))}
      </div>

      {/* Global Validation Alert Banner */}
      {validationError && (
        <div className="bg-red-50 border-2 border-red-300 text-red-800 p-4 rounded-xl text-xs font-bold flex items-start space-x-3 mb-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="block text-[13px] font-extrabold uppercase text-red-900 mb-0.5">
              ⚠️ Campo o criterio requerido pendiente
            </span>
            <span className="text-red-800 font-medium text-xs leading-relaxed">{validationError}</span>
          </div>
        </div>
      )}

      {/* TAB 0: INFORMACIÓN GENERAL */}
      {activeTabIndex === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          {/* HEADER / TOP FIELDS BASED ON FORM TYPE */}
          {zone === 'GRANJAS PISO' ? (
            /* GRANJAS PISO LAYOUT (Matching AppSheet screenshots) */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  ZONA <span className="text-teal-600">*</span>
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-800 text-center uppercase tracking-wide">
                  {zonaNombre || 'GRANJAS PISO'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  GRANJA <span className="text-teal-600">*</span>
                </label>
                <select
                  value={selectedFarm}
                  onChange={(e) => handlePisoFarmChange(e.target.value)}
                  className="w-full border-2 border-[#00796B] rounded-lg px-3 py-2.5 text-sm font-extrabold text-slate-900 bg-white outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="select-piso-granja"
                >
                  {PISO_FARMS_MAPPING.map((item) => (
                    <option key={item.farm} value={item.farm}>
                      {item.farm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  #GALPONES
                </label>
                <div
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 bg-slate-50/70 select-none flex items-center justify-between"
                  id="display-piso-num-galpones"
                >
                  <span>{galpon}</span>
                  <span className="text-slate-400 text-xs">▼</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Número OT MP:
                </label>
                <input
                  type="text"
                  value={numeroOtMp}
                  onChange={(e) => setNumeroOtMp(e.target.value)}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="input-ot-mp"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Días vacío sanitario <span className="text-teal-600">*</span>
                </label>
                <div className="flex items-center justify-between border border-slate-300 rounded-lg px-4 py-2 bg-white">
                  <button
                    type="button"
                    onClick={() => setDiasVacioSanitario((prev) => Math.max(0, prev - 1))}
                    className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                  >
                    −
                  </button>
                  <span className="text-slate-800 font-bold text-base">{diasVacioSanitario}</span>
                  <button
                    type="button"
                    onClick={() => setDiasVacioSanitario((prev) => prev + 1)}
                    className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : isPisoOrRoble ? (
            /* EL ROBLE LAYOUT */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  ZONA <span className="text-teal-600">*</span>
                </label>
                <input
                  type="text"
                  value={zonaNombre}
                  onChange={(e) => setZonaNombre(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="input-zona-nombre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  GRANJA <span className="text-teal-600">*</span>
                </label>
                <select
                  value={selectedFarm}
                  onChange={(e) => setSelectedFarm(e.target.value as FarmName)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 bg-white outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="select-granja"
                >
                  {farmsList.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  GALPÓN <span className="text-teal-600">*</span>
                </label>
                <input
                  type="text"
                  value={galpon}
                  onChange={(e) => {
                    setGalpon(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Ingrese el galpón o estructura"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="input-galpon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Número OT MP:
                </label>
                <input
                  type="text"
                  value={numeroOtMp}
                  onChange={(e) => setNumeroOtMp(e.target.value)}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="input-ot-mp"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Días vacío sanitario <span className="text-teal-600">*</span>
                </label>
                <div className="flex items-center justify-between border border-slate-300 rounded-lg px-4 py-2 bg-white">
                  <button
                    type="button"
                    onClick={() => setDiasVacioSanitario((prev) => Math.max(0, prev - 1))}
                    className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                  >
                    −
                  </button>
                  <span className="text-slate-800 font-bold text-base">{diasVacioSanitario}</span>
                  <button
                    type="button"
                    onClick={() => setDiasVacioSanitario((prev) => prev + 1)}
                    className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : zone === 'ZUCAMI' ? (
            /* ZUCAMI FORM LAYOUT (Matching AppSheet screenshot) */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  GRANJA <span className="text-teal-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['EGIPTO', 'BELLAVISTA'] as FarmName[]).map((farm) => (
                    <button
                      key={farm}
                      type="button"
                      onClick={() => setSelectedFarm(farm)}
                      className={`py-3 px-4 rounded-lg border text-sm font-extrabold uppercase transition-all text-center tracking-wide ${
                        selectedFarm === farm
                          ? 'border-[#00796B] bg-teal-50/60 text-[#00796B] shadow-2xs ring-1 ring-[#00796B]'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      id={`btn-farm-${farm.toLowerCase()}`}
                    >
                      {farm}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  TIPO DE JAULA <span className="text-teal-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['A', 'D', 'MEC'] as CageType[]).map((cage) => (
                    <button
                      key={cage}
                      type="button"
                      onClick={() => setSelectedCageType(cage)}
                      className={`py-3 px-4 rounded-lg border text-sm font-extrabold uppercase transition-all text-center tracking-wide ${
                        selectedCageType === cage
                          ? 'border-[#00796B] bg-teal-50/60 text-[#00796B] shadow-2xs ring-1 ring-[#00796B]'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      id={`btn-cage-${cage.toLowerCase()}`}
                    >
                      {cage}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  GALPÓN <span className="text-teal-600">*</span>
                </label>
                <input
                  type="text"
                  value={galpon}
                  onChange={(e) => setGalpon(e.target.value)}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="input-galpon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Número OT MP:
                </label>
                <input
                  type="text"
                  value={numeroOtMp}
                  onChange={(e) => setNumeroOtMp(e.target.value)}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="input-ot-mp"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Días vacío sanitario <span className="text-teal-600">*</span>
                </label>
                <div className="flex items-center justify-between border border-slate-300 rounded-lg px-4 py-2 bg-white">
                  <button
                    type="button"
                    onClick={() => setDiasVacioSanitario((prev) => Math.max(0, prev - 1))}
                    className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                  >
                    −
                  </button>
                  <span className="text-slate-800 font-bold text-base">{diasVacioSanitario}</span>
                  <button
                    type="button"
                    onClick={() => setDiasVacioSanitario((prev) => prev + 1)}
                    className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* SALMET FORM LAYOUT */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  GRANJA <span className="text-teal-600">*</span>
                </label>
                <div className="w-full bg-[#00796B] text-white text-center font-extrabold py-3 rounded-lg text-sm tracking-wide uppercase shadow-2xs">
                  PALMAS
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  TIPO DE JAULA <span className="text-teal-600">*</span>
                </label>
                <div className="w-full bg-[#00796B] text-white text-center font-extrabold py-3 rounded-lg text-sm tracking-wide uppercase shadow-2xs">
                  SALMET
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  GALPÓN <span className="text-teal-600">*</span>
                </label>
                <input
                  type="text"
                  value={galpon}
                  onChange={(e) => setGalpon(e.target.value)}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="input-galpon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Número OT MP:
                </label>
                <input
                  type="text"
                  value={numeroOtMp}
                  onChange={(e) => setNumeroOtMp(e.target.value)}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
                  id="input-ot-mp"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Días vacío sanitario <span className="text-teal-600">*</span>
                </label>
                <div className="flex items-center justify-between border border-slate-300 rounded-lg px-4 py-2 bg-white">
                  <button
                    type="button"
                    onClick={() => setDiasVacioSanitario((prev) => Math.max(0, prev - 1))}
                    className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                  >
                    −
                  </button>
                  <span className="text-slate-800 font-bold text-base">{diasVacioSanitario}</span>
                  <button
                    type="button"
                    onClick={() => setDiasVacioSanitario((prev) => prev + 1)}
                    className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* COMMON SECTION: INICIO Y FINALIZACIÓN DEL MANTENIMIENTO */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              INICIO Y FINALIZACIÓN DEL MANTENIMIENTO
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Fecha de inicio del mantenimiento <span className="text-teal-600">*</span>
              </label>
              <input
                type="date"
                value={fechaInicioMantenimiento}
                onChange={(e) => setFechaInicioMantenimiento(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2.5 text-slate-800 font-medium text-sm focus:outline-none transition-all ${
                  attemptedSubmit && !fechaInicioMantenimiento
                    ? 'border-red-500 ring-2 ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:ring-2 focus:ring-[#00796B]'
                }`}
                id="input-fecha-inicio"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Días de mantenimiento programados: <span className="text-teal-600">*</span>
              </label>
              <div className="flex items-center justify-between border border-slate-300 rounded-lg px-4 py-2 bg-white">
                <button
                  type="button"
                  onClick={() => setDiasMantenimientoProgramados((prev) => Math.max(0, prev - 1))}
                  className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                >
                  −
                </button>
                <span className="text-slate-800 font-bold text-base">{diasMantenimientoProgramados}</span>
                <button
                  type="button"
                  onClick={() => setDiasMantenimientoProgramados((prev) => prev + 1)}
                  className="text-slate-600 hover:text-slate-900 font-extrabold text-xl px-2"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Fecha de inicio + Días programados: <span className="text-teal-600">*</span>
              </label>
              <div className="border border-slate-200 bg-slate-50/80 rounded-lg px-4 py-2.5 flex items-center justify-between text-slate-600 font-semibold text-sm">
                <span className={getFechaInicioMasDias(fechaInicioMantenimiento, diasMantenimientoProgramados) ? 'text-slate-800' : 'text-slate-400 italic'}>
                  {getFechaInicioMasDias(fechaInicioMantenimiento, diasMantenimientoProgramados) || 'Seleccione fecha de inicio'}
                </span>
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Fecha de finalización: <span className="text-teal-600">*</span>
              </label>
              <input
                type="date"
                value={fechaFinalizacion}
                onChange={(e) => setFechaFinalizacion(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2.5 text-slate-800 font-medium text-sm focus:outline-none transition-all ${
                  attemptedSubmit && !fechaFinalizacion
                    ? 'border-red-500 ring-2 ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:ring-2 focus:ring-[#00796B]'
                }`}
                id="input-fecha-finalizacion"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Fecha de finalización al 100%:
              </label>
              <input
                type="date"
                value={fechaFinalizacion100}
                onChange={(e) => setFechaFinalizacion100(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#00796B]"
                id="input-fecha-finalizacion-100"
              />
            </div>
          </div>

          {/* COMMON SECTION: PROGRAMACIÓN DE ENTREGAS */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              PROGRAMACIÓN DE ENTREGAS
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Fecha entrega en vacío a producción: <span className="text-teal-600">*</span>
              </label>
              <input
                type="date"
                value={fechaEntregaVacioProduccion}
                onChange={(e) => setFechaEntregaVacioProduccion(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2.5 text-slate-800 font-medium text-sm focus:outline-none transition-all ${
                  attemptedSubmit && !fechaEntregaVacioProduccion
                    ? 'border-red-500 ring-2 ring-red-200 bg-red-50/20'
                    : 'border-slate-300 focus:ring-2 focus:ring-[#00796B]'
                }`}
                id="input-fecha-entrega-vacio"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Fecha de prueba con carga:
              </label>
              <input
                type="date"
                value={fechaPruebaConCarga}
                onChange={(e) => setFechaPruebaConCarga(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#00796B]"
                id="input-fecha-prueba-carga"
              />
            </div>
          </div>

          {/* RESPONSABLES SECTION */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                EVALUADOR / TÉCNICO OVERHAUL <span className="text-teal-600">*</span>
              </label>
              <select
                value={evaluatorId}
                onChange={(e) => setEvaluatorId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 bg-white outline-none focus:ring-2 focus:ring-[#00796B]"
                id="select-evaluator"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.cargo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                SUPERVISOR / COORDINADOR <span className="text-teal-600">*</span>
              </label>
              <select
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 bg-white outline-none focus:ring-2 focus:ring-[#00796B]"
                id="select-supervisor"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.cargo})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TABS 1 to N: EVALUATION CHECKLIST SECTIONS */}
      {activeTabIndex > 0 && activeTabIndex <= sections.length && (
        <div className="space-y-4">
          {(() => {
            const currentSection = sections[activeTabIndex - 1];
            return (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base uppercase tracking-wide">
                    {currentSection.title}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                    {currentSection.items.length} Criterios
                  </span>
                </div>

                <div className="space-y-6">
                  {currentSection.items.map((item, idx) => {
                    const rawQuestion = item.question.trim();
                    const numMatch = rawQuestion.match(/^\d+[\.\)]/);
                    const cleanText = rawQuestion.replace(/^\d+[\.\)]\s*/, '').replace(/\*+$/, '').trim();
                    const questionNumber = numMatch ? numMatch[0].replace(/[\.\)]/, '') : `${idx + 1}`;
                    const isRated = item.score !== undefined && item.score !== null;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl p-4 sm:p-5 border transition-all space-y-3 ${
                          attemptedSubmit && !isRated
                            ? 'bg-red-50/20 border-red-300 ring-2 ring-red-100 shadow-sm'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                        id={`item-card-${item.id}`}
                      >
                        {/* Question Title with asterisk * */}
                        <div className="text-slate-800 font-medium text-sm sm:text-[15px] leading-snug flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-slate-900">{questionNumber}. </span>
                            <span>{cleanText}</span>
                            <span className="text-[#00796B] font-bold ml-0.5">*</span>
                          </div>
                          {attemptedSubmit && !isRated && (
                            <span className="shrink-0 text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                              Calificación pendiente *
                            </span>
                          )}
                        </div>

                        {item.criteria && (
                          <p className="text-xs text-slate-500 italic -mt-1">{item.criteria}</p>
                        )}

                        {/* Range Slider Container with indicator floating above thumb */}
                        <div className="relative pt-6 pb-2 px-1">
                          <div
                            className={`absolute top-0 transform -translate-x-1/2 text-xs sm:text-sm font-bold transition-all duration-100 select-none ${
                              !isRated
                                ? 'text-slate-500'
                                : item.score === 100
                                ? 'text-emerald-700'
                                : (item.score ?? 0) >= 90
                                ? 'text-amber-600'
                                : 'text-red-600'
                            }`}
                            style={{ left: `${item.score ?? 0}%` }}
                          >
                            {isRated ? `${item.score}%` : '?'}
                          </div>

                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="10"
                            value={item.score ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              handleScoreChange(currentSection.id, item.id, val);
                            }}
                            className="w-full h-2.5 rounded-full appearance-none cursor-pointer outline-none transition-all"
                            style={{
                              background: isRated
                                ? `linear-gradient(to right, #00796B 0%, #00796B ${item.score ?? 0}%, #e2e8f0 ${item.score ?? 0}%, #e2e8f0 100%)`
                                : '#e2e8f0'
                            }}
                            id={`slider-${item.id}`}
                          />
                        </div>

                        {/* OBSERVACIONES (Open follow up for issues/problems found) */}
                        <div className="pt-2 space-y-1.5">
                          <label
                            htmlFor={`obs-input-${item.id}`}
                            className="block text-xs font-bold text-slate-600 uppercase tracking-wider"
                          >
                            OBSERVACIONES
                          </label>
                          <input
                            type="text"
                            value={item.observation || ''}
                            onChange={(e) => handleObservationChange(currentSection.id, item.id, e.target.value)}
                            placeholder="Escribe la novedad o problema para revisión del cliente..."
                            className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all placeholder:text-slate-400 font-normal"
                            id={`obs-input-${item.id}`}
                          />

                          {/* Optional Photo Attachment */}
                          <div className="flex items-center justify-between pt-1">
                            <label className="cursor-pointer inline-flex items-center space-x-1.5 text-xs text-teal-700 bg-teal-50/60 border border-teal-200/80 px-2.5 py-1 rounded-md hover:bg-teal-100/60 font-semibold transition-colors">
                              <Camera className="w-3.5 h-3.5" />
                              <span>{item.photoUrl ? 'Cambiar Evidencia' : 'Adjuntar Evidencia'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePhotoUpload(currentSection.id, item.id, e)}
                                className="hidden"
                              />
                            </label>

                            {item.photoUrl && (
                              <img
                                src={item.photoUrl}
                                alt="Evidencia"
                                className="w-10 h-10 object-cover rounded-md border border-slate-300"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB ASISTENTES: REGISTRO Y FIRMAS */}
      {activeTabIndex === sections.length + 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-base uppercase">
              ASISTENTES Y FIRMAS DE CONFORMIDAD
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Relacione hasta 5 asistentes para registrar la firma digital del acta de entrega.
            </p>
          </div>

          {validationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Assistant Slots (Up to 5) */}
          <div className="space-y-6">
            {asistentes.map((asistente, idx) => {
              const isVisible = idx === 0 || (asistentes[idx - 1].nombre.trim() !== '');
              if (!isVisible) return null;

              const isNameSelected = asistente.nombre.trim() !== '';

              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-2xs transition-all"
                >
                  <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide border-b border-slate-100 pb-2 flex items-center justify-between">
                    <span>ASISTENTE {idx + 1}</span>
                    {idx === 0 && <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-bold uppercase">Obligatorio</span>}
                  </h4>

                  {/* 1. NOMBRE ASISTENTE */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      NOMBRE ASISTENTE {idx + 1} {idx === 0 ? '*' : ''}
                    </label>
                    <div className="relative flex items-center">
                      <select
                        value={asistente.personaId}
                        onChange={(e) => handleSelectPersona(idx, e.target.value)}
                        className={`w-full border rounded-xl pl-3.5 pr-10 py-3 text-sm font-medium text-slate-800 bg-white outline-none appearance-none transition-all cursor-pointer ${
                          idx === 0 && attemptedSubmit && !asistente.nombre.trim()
                            ? 'border-red-500 ring-2 ring-red-200 bg-red-50/20'
                            : 'border-slate-300 focus:ring-2 focus:ring-[#00796B]'
                        }`}
                        id={`select-asistente-nombre-${idx}`}
                      >
                        <option value="">Seleccione una persona...</option>
                        {sortedPersonas.map((p) => {
                          const isChosenElsewhere = asistentes.some((a, i) => i !== idx && a.personaId === p.id);
                          return (
                            <option key={p.id} value={p.id} disabled={isChosenElsewhere}>
                              {p.nombre} {isChosenElsewhere ? '(Ya seleccionado)' : ''}
                            </option>
                          );
                        })}
                      </select>

                      <div className="absolute right-3 flex items-center space-x-1 text-slate-400">
                        {isNameSelected && (
                          <button
                            type="button"
                            onClick={() => handleClearPersona(idx)}
                            className="p-1 hover:text-red-600 transition-colors rounded"
                            title="Limpiar selección"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <ChevronDown className="w-4 h-4 pointer-events-none" />
                      </div>
                    </div>
                    {idx === 0 && attemptedSubmit && !asistente.nombre.trim() && (
                      <span className="text-[11px] font-bold text-red-600 mt-1 block">
                        * Debe seleccionar el Asistente 1
                      </span>
                    )}
                  </div>

                  {/* 2. CARGO ASISTENTE (Read-only, auto filled) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      CARGO ASISTENTE {idx + 1} {idx === 0 ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={asistente.cargo}
                      placeholder={isNameSelected ? '' : 'Se completa automáticamente'}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 bg-slate-50/80 cursor-not-allowed outline-none"
                      id={`input-asistente-cargo-${idx}`}
                    />
                  </div>

                  {/* 3. FIRMA ASISTENTE */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      FIRMA ASISTENTE {idx + 1} {idx === 0 ? '*' : ''}
                    </label>

                    {!isNameSelected ? (
                      /* Locked State */
                      <div className="border border-slate-200 rounded-2xl p-8 bg-slate-50/60 flex flex-col items-center justify-center text-slate-400 space-y-2 select-none cursor-not-allowed">
                        <Lock className="w-6 h-6 text-slate-300" />
                        <span className="text-xs font-semibold text-slate-400">
                          Seleccione un nombre para habilitar la firma
                        </span>
                      </div>
                    ) : asistente.signatureDataUrl ? (
                      /* Signed State */
                      <div className="border border-teal-300 bg-teal-50/20 rounded-2xl p-4 flex flex-col items-center space-y-2">
                        <img
                          src={asistente.signatureDataUrl}
                          alt={`Firma ${asistente.nombre}`}
                          className="h-24 object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveSigningSlot(idx)}
                          className="text-xs font-bold text-[#00796B] hover:underline flex items-center space-x-1.5 pt-1"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Cambiar Firma</span>
                        </button>
                      </div>
                    ) : (
                      /* Tap to Unlock State */
                      <div
                        onClick={() => setActiveSigningSlot(idx)}
                        className={`rounded-2xl p-8 flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all group ${
                          attemptedSubmit
                            ? 'border-2 border-red-400 ring-2 ring-red-200 bg-red-50/20 shadow-sm'
                            : 'border border-slate-300 hover:border-[#00796B] bg-white hover:bg-teal-50/20 shadow-2xs'
                        }`}
                        id={`box-firma-asistente-${idx}`}
                      >
                        <Lock
                          className={`w-6 h-6 transition-colors ${
                            attemptedSubmit ? 'text-red-500' : 'text-slate-500 group-hover:text-[#00796B]'
                          }`}
                        />
                        <span
                          className={`text-sm font-bold transition-colors ${
                            attemptedSubmit
                              ? 'text-red-600'
                              : 'text-slate-700 group-hover:text-[#00796B]'
                          }`}
                        >
                          {attemptedSubmit ? '⚠️ Firma requerida — Tap to unlock' : 'Tap to unlock'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 4. CORREO ASISTENTE (Pill) */}
                  {isNameSelected && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        CORREO ASISTENTE {idx + 1} {idx === 0 ? '*' : ''}
                      </label>
                      <div className="inline-block bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full">
                        {asistente.correo || 'sin-correo@kikes.com.co'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB FINAL: PORCENTAJE FINAL DE AVANCE TOTAL */}
      {activeTabIndex === sections.length + 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-base uppercase">
              PORCENTAJE FINAL DE AVANCE TOTAL
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Revise el resultado global de la evaluación y configure las notificaciones por correo.
            </p>
          </div>

          {validationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. % AVANCE TOTAL */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              % Avance total
            </label>
            <div className={`w-full border rounded-xl px-4 py-3 text-base font-bold flex items-center justify-between ${
              liveScore === 100
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : liveScore >= 90
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}>
              <span>% Avance Total Evaluado:</span>
              <span className="text-xl font-black">{liveScore.toFixed(2)}%</span>
            </div>

            {/* Questions Answered vs Empty Breakdown Table */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="block text-[10px] font-bold uppercase text-emerald-800 tracking-wide">
                  SOBRE EL 100%
                </span>
                <span className="text-lg font-extrabold text-emerald-700">{passedItems}</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <span className="block text-[10px] font-bold uppercase text-red-800 tracking-wide">
                  POR DEBAJO DEL 100%
                </span>
                <span className="text-lg font-extrabold text-red-700">{failedItems}</span>
              </div>
              <div className="bg-white border border-slate-300 rounded-xl p-3 text-center shadow-2xs">
                <span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide">
                  VACÍAS
                </span>
                <span className="text-lg font-extrabold text-slate-600">{emptyItemsCount}</span>
              </div>
            </div>
          </div>

          {/* Note: Question 2 (¿Subir formulario con ese porcentaje de avance?*) is OMITTED as requested */}

          {/* 3. OBSERVACIONES GENERALES */}
          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              OBSERVACIONES GENERALES (aparecen al final de la hoja)
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ingrese las observaciones generales de la evaluación..."
              className="w-full border border-slate-300 rounded-xl p-3.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#00796B]"
              id="textarea-observaciones-generales"
            />
          </div>

          {/* 4. EMAIL QUESTIONS based on PERSONAS database checkbox */}
          {(() => {
            const emailPersonas = sortedPersonas.filter((p) => p.mostrarOpcionCorreo === true);

            return (
              <div className="space-y-4 pt-3 border-t border-slate-100">
                {/* Explanatory banner */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold text-slate-700 block mb-0.5">
                      💡 ¿Cómo gestionar los destinatarios de correo aquí?
                    </span>
                    Para hacer que una persona aparezca o desaparezca de estas opciones de correo, vaya al módulo de <strong className="text-slate-800">PERSONAS</strong> y marque o desmarque la casilla <span className="italic font-semibold text-slate-700">"Mostrar como opción para enviar correo con copia del acta en formulario?"</span>. Este ajuste se aplicará globalmente a todos los formularios.
                  </div>
                </div>

                {emailPersonas.map((p) => {
                  const isChecked = emailToggles[p.id] === true;

                  return (
                    <div key={p.id} className="space-y-1.5 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase">
                          ¿Enviar correo a {p.cargo ? p.cargo.toLowerCase() : p.nombre}?
                        </label>
                        <p className="text-xs font-medium text-slate-500">
                          {p.nombre}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setEmailToggles((prev) => ({ ...prev, [p.id]: true }))}
                          className={`py-3 px-4 rounded-xl text-sm font-extrabold uppercase transition-all ${
                            isChecked
                              ? 'bg-[#00796B] text-white shadow-md border border-[#00796B]'
                              : 'bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                          id={`email-toggle-si-${p.id}`}
                        >
                          SI
                        </button>

                        <button
                          type="button"
                          onClick={() => setEmailToggles((prev) => ({ ...prev, [p.id]: false }))}
                          className={`py-3 px-4 rounded-xl text-sm font-extrabold uppercase transition-all ${
                            !isChecked
                              ? 'bg-[#00796B] text-white shadow-md border border-[#00796B]'
                              : 'bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                          id={`email-toggle-no-${p.id}`}
                        >
                          NO
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Submit Action Button */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {(() => {
                const filledAsistentes = asistentes.filter((a) => a.nombre.trim() !== '');
                const checkedEmailPersonas = sortedPersonas.filter(
                  (p) => p.mostrarOpcionCorreo && emailToggles[p.id] === true && p.correo
                );
                const recs = [
                  ...filledAsistentes.map((a) => a.correo),
                  ...checkedEmailPersonas.map((p) => p.correo),
                ].filter((v, i, a) => v && v.trim() !== '' && a.indexOf(v) === i);
                return recs.length > 0 ? (
                  <span className="text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Se enviará copia a: {recs.join(', ')}
                  </span>
                ) : (
                  <span className="text-slate-400">Sin destinatarios de correo seleccionados.</span>
                );
              })()}
            </div>

            <button
              onClick={handleValidateAndOpenSaveConfirm}
              disabled={isSaving}
              className="w-full sm:w-auto bg-[#00796B] hover:bg-[#005B52] disabled:opacity-60 text-white px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer"
              id="submit-evaluation-form-btn"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>GUARDANDO Y ENVIANDO CORREO...</span>
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  <span>GUARDAR Y ENVIAR ACTA POR CORREO</span>
                  <Send className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={activeSigningSlot !== null}
        onClose={() => setActiveSigningSlot(null)}
        onSave={handleSaveSignature}
        title={
          activeSigningSlot !== null
            ? `Firma Asistente ${activeSigningSlot + 1} (${asistentes[activeSigningSlot]?.nombre})`
            : 'Firma de Conformidad'
        }
        initialSignature={
          activeSigningSlot !== null ? asistentes[activeSigningSlot]?.signatureDataUrl : undefined
        }
      />

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
                <p className="text-xs text-slate-500">Atención: Hay respuestas y datos sin guardar</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold">
                ⚠️ Si cancela ahora, se perderán todas las calificaciones, notas, firmas y datos prellenados en esta evaluación ({zone} - {selectedFarm || 'Granja'}).
              </p>
              <p className="text-amber-800 text-[11px]">
                Esta acción descartará el progreso actual y regresará al menú principal.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelConfirmModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                id="cancel-modal-continue-btn"
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
                id="cancel-modal-confirm-discard-btn"
              >
                Sí, descartar y salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AppSheet-Style Persistent Bottom Navigation Control Bar (Prev / Cancel / Siguiente) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-6 shadow-2xl z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Left: Prev Button */}
          <button
            type="button"
            onClick={() => {
              if (activeTabIndex > 0) {
                setActiveTabIndex(activeTabIndex - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            disabled={activeTabIndex === 0}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-lg flex items-center space-x-1.5 transition-colors ${
              activeTabIndex > 0
                ? 'text-[#00796B] hover:bg-teal-50 border border-[#00796B]'
                : 'text-slate-300 border border-slate-200 cursor-not-allowed'
            }`}
            id="form-prev-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Anterior</span>
          </button>

          {/* Center: Cancel Button with Confirmation Protection */}
          <button
            type="button"
            onClick={() => setIsCancelConfirmModalOpen(true)}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg uppercase tracking-wider transition-colors"
            id="form-cancel-btn"
          >
            Cancelar
          </button>

          {/* Right: Next Button (Visible only until the penultimate tab; on the final tab, the prominent 'FINALIZAR Y GENERAR ACTA PDF' button is used) */}
          <div className="flex items-center space-x-2">
            {activeTabIndex < tabTitles.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTabIndex(activeTabIndex + 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-5 py-2 text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white rounded-lg flex items-center space-x-1.5 shadow-md transition-all active:scale-95"
                id="form-next-btn"
              >
                <span>Siguiente</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            ) : (
              <div className="w-[88px]" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
