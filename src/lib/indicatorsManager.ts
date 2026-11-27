import { EvaluationSection, EvaluationItem, EvaluationReport } from '../types';
import { getSectionTemplateForZone } from '../data/initialData';
import { safeLocalStorageSet } from './mediaCacheDb';

export interface IndicatorCategory {
  id: string;
  name: string;
  group: 'A' | 'B' | 'C';
  label: string;
  tableLabel: string;
  benchmarkDays?: number;
  shortName: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const INDICATOR_CATEGORIES: IndicatorCategory[] = [
  {
    id: 'cat_a_electrico',
    group: 'A',
    name: 'Mtto electrico cajas de control y potencia',
    label: '[A] Mtto electrico cajas de control y potencia',
    tableLabel: '[A] Mtto electrico cajas de control y potencia [19]',
    benchmarkDays: 19,
    shortName: 'Cajas Control y Potencia',
    color: '#b91c1c',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    badgeBorder: 'border-red-200',
  },
  {
    id: 'cat_a_agua',
    group: 'A',
    name: 'Suministro agua',
    label: '[A] Suministro agua',
    tableLabel: '[A] Suministro agua [17]',
    benchmarkDays: 17,
    shortName: 'Suministro Agua',
    color: '#0284c7',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
  },
  {
    id: 'cat_a_alimento',
    group: 'A',
    name: 'Suministro alimento',
    label: '[A] Suministro alimento',
    tableLabel: '[A] Suministro alimento [17]',
    benchmarkDays: 17,
    shortName: 'Suministro Alimento',
    color: '#d97706',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
  },
  {
    id: 'cat_a_gallinaza',
    group: 'A',
    name: 'Recogida gallinaza',
    label: '[A] Recogida gallinaza',
    tableLabel: '[A] Recogida gallinaza [27]',
    benchmarkDays: 27,
    shortName: 'Recogida Gallinaza',
    color: '#78350f',
    badgeBg: 'bg-stone-50',
    badgeText: 'text-stone-700',
    badgeBorder: 'border-stone-200',
  },
  {
    id: 'cat_a_alumbrado',
    group: 'A',
    name: 'Alumbrado',
    label: '[A] Alumbrado',
    tableLabel: '[A] Alumbrado [17]',
    benchmarkDays: 17,
    shortName: 'Alumbrado',
    color: '#ca8a04',
    badgeBg: 'bg-yellow-50',
    badgeText: 'text-yellow-700',
    badgeBorder: 'border-yellow-200',
  },
  {
    id: 'cat_a_ambiente',
    group: 'A',
    name: 'Ambiente controlado',
    label: '[A] Ambiente controlado',
    tableLabel: '[A] Ambiente controlado [17]',
    benchmarkDays: 17,
    shortName: 'Ambiente Controlado',
    color: '#0d9488',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    badgeBorder: 'border-teal-200',
  },
  {
    id: 'cat_b_silos',
    group: 'B',
    name: 'Silos',
    label: '[B] Silos',
    tableLabel: '[B] Silos [56]',
    benchmarkDays: 56,
    shortName: 'Silos y Básculas',
    color: '#2563eb',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
  },
  {
    id: 'cat_b_antipicaje',
    group: 'B',
    name: 'Antipicaje',
    label: '[B] Antipicaje',
    tableLabel: '[B] Antipicaje [56]',
    benchmarkDays: 56,
    shortName: 'Antipicaje',
    color: '#9333ea',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
  },
  {
    id: 'cat_c_huevo',
    group: 'C',
    name: 'Recogida huevo',
    label: '[C] Recogida huevo',
    tableLabel: '[C] Recogida huevo [56]',
    benchmarkDays: 56,
    shortName: 'Recogida Huevo',
    color: '#ea580c',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    badgeBorder: 'border-orange-200',
  },
  {
    id: 'cat_c_jaula',
    group: 'C',
    name: 'Jaula',
    label: '[C] Jaula',
    tableLabel: '[C] Jaula [26]',
    benchmarkDays: 26,
    shortName: 'Jaula y Estructura',
    color: '#475569',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
  {
    id: 'cat_c_otros',
    group: 'C',
    name: 'Otros',
    label: '[C] Otros',
    tableLabel: '[C] Otros [26]',
    benchmarkDays: 26,
    shortName: 'Otros Sistemas',
    color: '#64748b',
    badgeBg: 'bg-gray-50',
    badgeText: 'text-gray-700',
    badgeBorder: 'border-gray-200',
  },
];

export interface FormConfig {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
}

export const DEFAULT_FORMS: FormConfig[] = [
  { id: 'zucami', name: 'ZUCAMI', description: 'Sistema de Jaulas Automatizadas Zucami', isDefault: true },
  { id: 'salmet', name: 'SALMET', description: 'Sistema de Jaulas Salmet en Multinivel', isDefault: true },
  { id: 'granjas_piso', name: 'GRANJAS PISO', description: 'Galpones de Alojamiento Tradicional en Piso', isDefault: true },
  { id: 'el_roble', name: 'EL ROBLE', description: 'Estructuras y Galpones Especiales El Roble', isDefault: true },
];

const CUSTOM_FARMS_STORAGE_KEY = 'OVERHAUL_CUSTOM_FARMS_LIST';

/**
 * Get all available forms / farms (default + custom)
 */
export function getAvailableForms(): FormConfig[] {
  if (typeof window === 'undefined') return DEFAULT_FORMS;
  try {
    const raw = localStorage.getItem(CUSTOM_FARMS_STORAGE_KEY);
    if (!raw) return DEFAULT_FORMS;
    const custom: FormConfig[] = JSON.parse(raw);
    const map = new Map<string, FormConfig>();
    DEFAULT_FORMS.forEach((f) => map.set(f.name.toUpperCase(), f));
    custom.forEach((c) => map.set(c.name.toUpperCase(), c));
    return Array.from(map.values());
  } catch (e) {
    console.error('Error reading custom forms:', e);
    return DEFAULT_FORMS;
  }
}

/**
 * Add a new custom farm / form
 */
export function addCustomFarm(name: string, description?: string): FormConfig {
  const normName = name.trim().toUpperCase();
  const forms = getAvailableForms();
  const existing = forms.find((f) => f.name.toUpperCase() === normName);
  if (existing) return existing;

  const newForm: FormConfig = {
    id: normName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: normName,
    description: description?.trim() || `Formulario e inspección para ${normName}`,
    isDefault: false,
  };

  const customOnly = forms.filter((f) => !f.isDefault);
  customOnly.push(newForm);
  safeLocalStorageSet(CUSTOM_FARMS_STORAGE_KEY, JSON.stringify(customOnly));

  // Initialize standard starter template for this new farm if not exists
  const storageKey = getStorageKeyForForm(normName);
  if (!localStorage.getItem(storageKey)) {
    const starterSections = createStarterSectionsForNewFarm();
    safeLocalStorageSet(storageKey, JSON.stringify(starterSections));
  }

  return newForm;
}

/**
 * Delete a custom farm
 */
export function deleteCustomFarm(name: string): boolean {
  const normName = name.trim().toUpperCase();
  const forms = getAvailableForms();
  const customOnly = forms.filter((f) => !f.isDefault && f.name.toUpperCase() !== normName);
  safeLocalStorageSet(CUSTOM_FARMS_STORAGE_KEY, JSON.stringify(customOnly));
  return true;
}

/**
 * Resolve local storage key for sections of a given form/zone
 */
export function getStorageKeyForForm(formName: string): string {
  const norm = (formName || '').toUpperCase().replace(/_/g, ' ').trim();
  if (norm.includes('ZUCAMI')) return 'OVERHAUL_CUSTOM_SECTIONS_ZUCAMI';
  if (norm.includes('SALMET')) return 'OVERHAUL_CUSTOM_SECTIONS_SALMET';
  if (norm.includes('PISO')) return 'OVERHAUL_CUSTOM_SECTIONS_GRANJAS_PISO';
  if (norm.includes('ROBLE')) return 'OVERHAUL_CUSTOM_SECTIONS_EL_ROBLE';
  return `OVERHAUL_CUSTOM_SECTIONS_${norm.replace(/\s+/g, '_')}`;
}

/**
 * Resolve an item's indicator category matching the 11 categories
 */
export function resolveItemCategory(item: EvaluationItem, sectionTitle?: string): IndicatorCategory {
  if (item.category) {
    const directMatch = INDICATOR_CATEGORIES.find(
      (c) =>
        c.label.toUpperCase() === item.category!.trim().toUpperCase() ||
        c.tableLabel.toUpperCase() === item.category!.trim().toUpperCase() ||
        c.name.toUpperCase() === item.category!.trim().toUpperCase() ||
        c.shortName.toUpperCase() === item.category!.trim().toUpperCase()
    );
    if (directMatch) return directMatch;
  }

  const combined = `${sectionTitle || ''} ${item.question || ''}`.toUpperCase();

  if (
    combined.includes('CAJA') ||
    combined.includes('CONTROL Y POTENCIA') ||
    combined.includes('ELECTRICO') ||
    combined.includes('ELÉCTRICO') ||
    combined.includes('VOLTAJE') ||
    combined.includes('BREAKER')
  ) {
    return INDICATOR_CATEGORIES[0]; // [A] Mtto electrico cajas de control y potencia
  }
  if (
    combined.includes('AGUA') ||
    combined.includes('BEBEDERO') ||
    combined.includes('NIPPLE') ||
    combined.includes('TUBERIA') ||
    combined.includes('TUBERÍA') ||
    combined.includes('FLOTADOR')
  ) {
    return INDICATOR_CATEGORIES[1]; // [A] Suministro agua
  }
  if (
    combined.includes('ALIMENTO') ||
    combined.includes('CARRO REPARTIDOR') ||
    combined.includes('COMEDERO') ||
    combined.includes('DOSIFICADOR') ||
    combined.includes('PATINES') ||
    combined.includes('CADENA DE ALIMENTO')
  ) {
    return INDICATOR_CATEGORIES[2]; // [A] Suministro alimento
  }
  if (
    combined.includes('GALLINAZA') ||
    combined.includes('ESTIERCOL') ||
    combined.includes('ESTIÉRCOL') ||
    combined.includes('CINTA DE GALLINAZA') ||
    combined.includes('RASPADOR')
  ) {
    return INDICATOR_CATEGORIES[3]; // [A] Recogida gallinaza
  }
  if (
    combined.includes('ALUMBRADO') ||
    combined.includes('ILUMINACION') ||
    combined.includes('ILUMINACIÓN') ||
    combined.includes('LAMPARA') ||
    combined.includes('LÁMPARA') ||
    combined.includes('BOMBILLO') ||
    combined.includes('LUMINARIA')
  ) {
    return INDICATOR_CATEGORIES[4]; // [A] Alumbrado
  }
  if (
    combined.includes('AMBIENTE') ||
    combined.includes('VENTILADOR') ||
    combined.includes('EXTRACTOR') ||
    combined.includes('PANEL EVAPORATIVO') ||
    combined.includes('CORTINA') ||
    combined.includes('CLIMATIZACION')
  ) {
    return INDICATOR_CATEGORIES[5]; // [A] Ambiente controlado
  }
  if (
    combined.includes('SILO') ||
    combined.includes('BASCULA') ||
    combined.includes('BÁSCULA') ||
    combined.includes('TORNILLO SINFIN') ||
    combined.includes('SINFÍN') ||
    combined.includes('BOTA DE SILO')
  ) {
    return INDICATOR_CATEGORIES[6]; // [B] Silos
  }
  if (
    combined.includes('ANTIPICAJE') ||
    combined.includes('PICAJE') ||
    combined.includes('CORTE PICO') ||
    combined.includes('DESPIQUE')
  ) {
    return INDICATOR_CATEGORIES[7]; // [B] Antipicaje
  }
  if (
    combined.includes('HUEVO') ||
    combined.includes('TRANSVERSAL') ||
    combined.includes('ELEVADOR') ||
    combined.includes('CINTA DE HUEVO') ||
    combined.includes('CANASTILLA') ||
    combined.includes('RECOLECCION')
  ) {
    return INDICATOR_CATEGORIES[8]; // [C] Recogida huevo
  }
  if (
    combined.includes('JAULA') ||
    combined.includes('PATAS') ||
    combined.includes('PISOS DE JAULA') ||
    combined.includes('CABEZAL') ||
    combined.includes('NIDO') ||
    combined.includes('PUERTA') ||
    combined.includes('MALLA')
  ) {
    return INDICATOR_CATEGORIES[9]; // [C] Jaula
  }

  return INDICATOR_CATEGORIES[10]; // [C] Otros
}

/**
 * Get sections for any form/zone
 */
export function getFormSections(formName: string): EvaluationSection[] {
  const norm = (formName || '').toUpperCase().trim();
  const storageKey = getStorageKeyForForm(norm);

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure every item has its category populated
          return parsed.map((sec) => ({
            ...sec,
            items: (sec.items || []).map((item: EvaluationItem) => ({
              ...item,
              category: item.category || resolveItemCategory(item, sec.title).label,
            })),
          }));
        }
      } catch (e) {
        console.error(`Error parsing sections for ${formName}:`, e);
      }
    }
  }

  // Fallback to base templates for defaults
  const baseSections = getSectionTemplateForZone(norm);
  return baseSections.map((sec) => ({
    ...sec,
    items: (sec.items || []).map((item) => ({
      ...item,
      category: item.category || resolveItemCategory(item, sec.title).label,
    })),
  }));
}

/**
 * Save sections for a form/zone
 */
export function saveFormSections(formName: string, sections: EvaluationSection[]): void {
  const storageKey = getStorageKeyForForm(formName);
  safeLocalStorageSet(storageKey, JSON.stringify(sections));
}

/**
 * Create a new activity for a specific form and classify it into one of the 11 categories
 */
export function createActivityForForm(
  formName: string,
  question: string,
  criteria: string,
  categoryLabel: string
): EvaluationItem {
  const sections = getFormSections(formName);
  const targetCategory =
    INDICATOR_CATEGORIES.find((c) => c.label === categoryLabel) || INDICATOR_CATEGORIES[0];

  const newItemId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const newItem: EvaluationItem = {
    id: newItemId,
    question: question.trim(),
    criteria: criteria.trim() || undefined,
    status: 'cumple',
    score: 100,
    category: targetCategory.label,
  };

  // Find or create a matching section
  let targetSection = sections.find((s) => {
    const sTitle = s.title.toUpperCase();
    return (
      sTitle === targetCategory.name.toUpperCase() ||
      sTitle.includes(targetCategory.shortName.toUpperCase()) ||
      sTitle === targetCategory.label.toUpperCase()
    );
  });

  if (!targetSection) {
    if (sections.length > 0) {
      targetSection = sections[sections.length - 1];
    } else {
      targetSection = {
        id: `sec_${targetCategory.id}`,
        title: targetCategory.name.toUpperCase(),
        items: [],
      };
      sections.push(targetSection);
    }
  }

  targetSection.items.push(newItem);
  saveFormSections(formName, sections);
  return newItem;
}

/**
 * Update an existing activity
 */
export function updateActivityInForm(
  formName: string,
  itemId: string,
  updates: Partial<EvaluationItem>
): boolean {
  const sections = getFormSections(formName);
  let found = false;

  for (const sec of sections) {
    const idx = sec.items.findIndex((it) => it.id === itemId);
    if (idx !== -1) {
      sec.items[idx] = {
        ...sec.items[idx],
        ...updates,
      };
      found = true;
      break;
    }
  }

  if (found) {
    saveFormSections(formName, sections);
  }
  return found;
}

/**
 * Delete an activity from a form
 */
export function deleteActivityFromForm(formName: string, itemId: string): boolean {
  const sections = getFormSections(formName);
  let found = false;

  for (const sec of sections) {
    const idx = sec.items.findIndex((it) => it.id === itemId);
    if (idx !== -1) {
      sec.items.splice(idx, 1);
      found = true;
      break;
    }
  }

  if (found) {
    saveFormSections(formName, sections);
  }
  return found;
}

/**
 * Starter template for a newly created farm
 */
function createStarterSectionsForNewFarm(): EvaluationSection[] {
  return [
    {
      id: 'sec_electric',
      title: 'MANTENIMIENTO ELECTRICO DE CAJAS DE CONTROL Y POTENCIA',
      items: [
        {
          id: `act_${Date.now()}_1`,
          question: 'Revisión y ajuste de conexiones en cajas de control y potencia.',
          criteria: 'Bornas ajustadas, limpieza de polvo y contactores en buen estado',
          status: 'cumple',
          score: 100,
          category: '[A] Mtto electrico cajas de control y potencia',
        },
      ],
    },
    {
      id: 'sec_agua',
      title: 'SUMINISTRO DE AGUA',
      items: [
        {
          id: `act_${Date.now()}_2`,
          question: 'Prueba de caudal y estanqueidad en línea de niples y bebederos.',
          criteria: 'Presión uniforme sin fugas ni goteos en línea',
          status: 'cumple',
          score: 100,
          category: '[A] Suministro agua',
        },
      ],
    },
    {
      id: 'sec_alimento',
      title: 'SUMINISTRO DE ALIMENTO',
      items: [
        {
          id: `act_${Date.now()}_3`,
          question: 'Verificación de dosificación y desplazamiento de carros o sinfines.',
          criteria: 'Dosificación calibrada y movimiento fluido',
          status: 'cumple',
          score: 100,
          category: '[A] Suministro alimento',
        },
      ],
    },
    {
      id: 'sec_silos',
      title: 'SILOS Y BASCULAS',
      items: [
        {
          id: `act_${Date.now()}_4`,
          question: 'Inspección de botas, cajetines y hermeticidad de silos.',
          criteria: 'Sin filtraciones ni humedad interna',
          status: 'cumple',
          score: 100,
          category: '[B] Silos',
        },
      ],
    },
    {
      id: 'sec_huevo',
      title: 'RECOGIDA DE HUEVO',
      items: [
        {
          id: `act_${Date.now()}_5`,
          question: 'Alineación y tensión de cintas transportadoras de huevo.',
          criteria: 'Cintas limpias, sin torceduras ni deshilachado',
          status: 'cumple',
          score: 100,
          category: '[C] Recogida huevo',
        },
      ],
    },
  ];
}

/**
 * Metric summary calculation for Group-based Indicator Measurement
 */
export interface EvaluatedActivityItem {
  reportId: string;
  reportCode: string;
  farm: string;
  zone: string;
  date: string;
  galpon?: string;
  question: string;
  criteria?: string;
  score: number;
  status: string;
  observation?: string;
  category: IndicatorCategory;
}

export interface CategoryMetric {
  category: IndicatorCategory;
  totalEvaluated: number;
  avgScore: number;
  perfectCount: number; // 100%
  warningCount: number; // 90-99%
  dangerCount: number; // <90%
  items: EvaluatedActivityItem[];
}

export interface GroupMetric {
  group: 'A' | 'B' | 'C';
  groupName: string;
  groupDescription: string;
  color: string;
  avgScore: number;
  totalEvaluated: number;
  perfectCount: number;
  warningCount: number;
  dangerCount: number;
  categories: CategoryMetric[];
}

export function calculateIndicatorMetrics(
  reports: EvaluationReport[],
  selectedZone: string = 'TODAS'
): {
  overallAvg: number;
  totalReports: number;
  totalActivitiesEvaluated: number;
  groupMetrics: Record<'A' | 'B' | 'C', GroupMetric>;
  categoryMetrics: CategoryMetric[];
  allEvaluatedItems: EvaluatedActivityItem[];
} {
  const filteredReports = reports.filter((r) => {
    if (selectedZone === 'TODAS') return true;
    const rZone = (r.zone || r.zonaNombre || '').toUpperCase();
    return rZone === selectedZone.toUpperCase() || (r.farm && r.farm.toUpperCase() === selectedZone.toUpperCase());
  });

  const allItems: EvaluatedActivityItem[] = [];

  filteredReports.forEach((r) => {
    (r.sections || []).forEach((sec) => {
      (sec.items || []).forEach((it) => {
        const cat = resolveItemCategory(it, sec.title);
        const scoreVal = it.score !== undefined && it.score !== null
          ? it.score
          : it.status === 'cumple'
          ? 100
          : it.status === 'no_cumple'
          ? 0
          : 100;

        allItems.push({
          reportId: r.id,
          reportCode: r.code || 'SIN_CODIGO',
          farm: r.farm || r.zone || 'GRANJA',
          zone: r.zone || r.zonaNombre || 'ZUCAMI',
          date: r.evaluationDate || r.createdAt,
          galpon: r.galpon,
          question: it.question,
          criteria: it.criteria,
          score: scoreVal,
          status: it.status,
          observation: it.observation,
          category: cat,
        });
      });
    });
  });

  // Calculate for each of the 11 categories
  const categoryMetrics: CategoryMetric[] = INDICATOR_CATEGORIES.map((cat) => {
    const matching = allItems.filter((i) => i.category.id === cat.id);
    const total = matching.length;
    const avg = total > 0 ? Math.round((matching.reduce((acc, i) => acc + i.score, 0) / total) * 10) / 10 : 0;
    const perfect = matching.filter((i) => i.score === 100).length;
    const warning = matching.filter((i) => i.score >= 90 && i.score < 100).length;
    const danger = matching.filter((i) => i.score < 90).length;

    return {
      category: cat,
      totalEvaluated: total,
      avgScore: avg,
      perfectCount: perfect,
      warningCount: warning,
      dangerCount: danger,
      items: matching,
    };
  });

  // Calculate for Group [A], [B], [C]
  const createGroup = (
    groupKey: 'A' | 'B' | 'C',
    name: string,
    desc: string,
    color: string
  ): GroupMetric => {
    const cats = categoryMetrics.filter((c) => c.category.group === groupKey);
    const items = allItems.filter((i) => i.category.group === groupKey);
    const total = items.length;
    const avg = total > 0 ? Math.round((items.reduce((acc, i) => acc + i.score, 0) / total) * 10) / 10 : 0;
    const perfect = items.filter((i) => i.score === 100).length;
    const warning = items.filter((i) => i.score >= 90 && i.score < 100).length;
    const danger = items.filter((i) => i.score < 90).length;

    return {
      group: groupKey,
      groupName: name,
      groupDescription: desc,
      color,
      avgScore: avg,
      totalEvaluated: total,
      perfectCount: perfect,
      warningCount: warning,
      dangerCount: danger,
      categories: cats,
    };
  };

  const groupA = createGroup(
    'A',
    'Grupo [A] - Sistemas Vitales y Críticos',
    'Electricidad, Agua, Alimento, Gallinaza, Alumbrado y Climatización',
    '#b91c1c'
  );
  const groupB = createGroup(
    'B',
    'Grupo [B] - Abastecimiento y Bienestar',
    'Silos, Básculas y Sistemas de Antipicaje',
    '#2563eb'
  );
  const groupC = createGroup(
    'C',
    'Grupo [C] - Operativos y Estructura',
    'Recogida de Huevo, Jaula y Otros Sistemas',
    '#059669'
  );

  const totalActs = allItems.length;
  const overallAvg =
    totalActs > 0 ? Math.round((allItems.reduce((acc, i) => acc + i.score, 0) / totalActs) * 10) / 10 : 0;

  return {
    overallAvg,
    totalReports: filteredReports.length,
    totalActivitiesEvaluated: totalActs,
    groupMetrics: { A: groupA, B: groupB, C: groupC },
    categoryMetrics,
    allEvaluatedItems: allItems,
  };
}

export const SPANISH_MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const SPANISH_MONTH_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Strict date resolution for evaluation reports based exclusively on:
 * "Fecha de finalización al 100%:" (fechaFinalizacion100).
 * Returns null if empty/missing so unfinalized rows are not included in monthly indicator matrices.
 */
export function getReportDate(report: EvaluationReport): Date | null {
  if (!report.fechaFinalizacion100 || !String(report.fechaFinalizacion100).trim()) {
    return null;
  }

  const parsed = parseFlexibleDate(report.fechaFinalizacion100);
  if (!parsed) return null;

  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

export interface CumplimientoFechaDetails {
  fechaInicioStr: string;
  fechaFinalizacion100Str: string;
  fechaProgramadaStr: string;
  diasReales: number; // E2 - D2 (días entre inicio y finalización 100%)
  diasIdeales: number; // F2 - D2 (días entre inicio y fecha programada)
  desviacionDias: number; // diasReales - diasIdeales
  porcentaje: number; // ((diasReales / diasIdeales) - 1) * 100
  formulaStr: string; // "((24 - 23) / 23) * 100 = +4.35%"
  cumple: boolean; // diasReales <= diasIdeales
  fechaPruebaCargaStr?: string;
}

const MONTH_NAME_MAP: Record<string, number> = {
  // English
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  // Spanish
  ene: 0, abr: 3, ago: 7, dic: 11,
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

export function parseFlexibleDate(val: string | Date | undefined | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (!str) return null;

  // Google Visualization Date(yyyy,m,d) format (0-indexed month)
  const gvizMatch = str.match(/^Date\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})/i);
  if (gvizMatch) {
    const year = parseInt(gvizMatch[1], 10);
    const month = parseInt(gvizMatch[2], 10);
    const day = parseInt(gvizMatch[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  // DD-MMM-YYYY or DD MMM YYYY (e.g. 29-Aug-2026, 22-Sep-2026, 21-Sep-2026)
  const dMmmYMatch = str.match(/^(\d{1,2})[\s\-]+([a-zA-ZáéíóúÁÉÍÓÚ]+)[\s\-]+(\d{4})/);
  if (dMmmYMatch) {
    const day = parseInt(dMmmYMatch[1], 10);
    const mStr = dMmmYMatch[2].toLowerCase();
    const year = parseInt(dMmmYMatch[3], 10);
    const month = MONTH_NAME_MAP[mStr];
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
  }

  return null;
}

export function differenceInCalendarDays(dateB: Date, dateA: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((dateB.getTime() - dateA.getTime()) / msPerDay);
}

/**
 * Calculates the "Cumplimiento en fecha" indicator based on the user's guide:
 * Compares days between start date and target date (fecha de inicio + dias programados)
 * versus days between start date and actual completion date (fecha finalizacion al 100%).
 *
 * Formula from spreadsheet:
 * =((E2 - D2) / (F2 - D2)) - 1
 *
 * Where:
 * D2 = FECHA DE INICIO (fechaInicioMantenimiento)
 * E2 = Fecha de finalización al 100% (fechaFinalizacion100, or fallback to fechaFinalizacion / fechaEntregaVacioProduccion)
 * F2 = Fecha de inicio + Días programados (fechaInicioMasDiasProgramados, or D2 + diasMantenimientoProgramados)
 */
export function calculateCumplimientoEnFecha(report: EvaluationReport): {
  score: number | null;
  details: CumplimientoFechaDetails | null;
} {
  const dStart = parseFlexibleDate(report.fechaInicioMantenimiento);
  const dActual = parseFlexibleDate(
    report.fechaFinalizacion100 ||
    report.fechaFinalizacion ||
    report.fechaEntregaVacioProduccion ||
    report.evaluationDate
  );

  let dTarget = parseFlexibleDate(report.fechaInicioMasDiasProgramados);
  if (dTarget && dTarget.getUTCFullYear() < 2000) {
    dTarget = null;
  }
  if (!dTarget && dStart && report.diasMantenimientoProgramados) {
    const temp = new Date(dStart.getTime());
    temp.setUTCDate(temp.getUTCDate() + report.diasMantenimientoProgramados);
    dTarget = temp;
  }

  const dPrueba = parseFlexibleDate(report.fechaPruebaConCarga || report.pruebaConCarga?.fechaPruebaConCarga);

  const formatD = (dt: Date) => {
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = dt.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  if (dStart && dActual && dTarget) {
    const actualDays = differenceInCalendarDays(dActual, dStart);
    const idealDays = differenceInCalendarDays(dTarget, dStart);

    if (idealDays > 0) {
      // Excel formula: ((E2 - D2) / (F2 - D2)) - 1
      const ratio = (actualDays / idealDays) - 1;
      const percentage = Math.round(ratio * 10000) / 100; // e.g. 4.35
      const desviacionDias = actualDays - idealDays;

      return {
        score: percentage,
        details: {
          fechaInicioStr: formatD(dStart),
          fechaFinalizacion100Str: formatD(dActual),
          fechaProgramadaStr: formatD(dTarget),
          diasReales: actualDays,
          diasIdeales: idealDays,
          desviacionDias,
          porcentaje: percentage,
          formulaStr: `=((${actualDays} - ${idealDays}) / ${idealDays}) = ${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`,
          cumple: actualDays <= idealDays,
          fechaPruebaCargaStr: dPrueba ? formatD(dPrueba) : undefined,
        },
      };
    } else if (idealDays === 0) {
      const percentage = actualDays === 0 ? 0.0 : 100.0;
      return {
        score: percentage,
        details: {
          fechaInicioStr: formatD(dStart),
          fechaFinalizacion100Str: formatD(dActual),
          fechaProgramadaStr: formatD(dTarget),
          diasReales: actualDays,
          diasIdeales: idealDays,
          desviacionDias: actualDays,
          porcentaje: percentage,
          formulaStr: `=((${actualDays} días reales vs ${idealDays} días ideales))`,
          cumple: actualDays === 0,
          fechaPruebaCargaStr: dPrueba ? formatD(dPrueba) : undefined,
        },
      };
    }
  }

  // Fallback if explicit numeric score was provided on report
  if (report.cumplimientoEnFecha !== undefined && report.cumplimientoEnFecha !== null) {
    return {
      score: report.cumplimientoEnFecha,
      details: null,
    };
  }

  return {
    score: null,
    details: null,
  };
}

export interface DocumentActivityScore {
  avgScore: number | null; // null if 0 items evaluated
  evaluatedCount: number;
  items: { question: string; score: number; criteria?: string; sectionTitle?: string }[];
}

export interface DocumentIndicatorColumn {
  reportId: string;
  reportCode: string;
  report: EvaluationReport;
  granja: string;
  galpon: string;
  fechaEntregaStr: string; // e.g. "ago-2026"
  rawDate: Date;
  cumplimientoEnFecha: number | null; // e.g. 4.35
  cumplimientoFechaDetails?: CumplimientoFechaDetails | null;
  cumplimientoEnCondicion: number; // e.g. 100.00
  diasVacioSanitario: number | null; // e.g. 8
  categoryScores: Record<string, DocumentActivityScore>;
}

export interface MonthOption {
  key: string; // e.g. "2026-08"
  year: number;
  monthIndex: number; // 0-11
  label: string; // e.g. "ago-2026"
  fullLabel: string; // e.g. "Agosto 2026 (ago-2026)"
  startDateStr: string; // e.g. "1/08/2026"
  endDateStr: string; // e.g. "31/08/2026"
  reportCount: number;
}

/**
 * Builds all available month options from existing reports and surrounding months
 */
export function getMonthOptions(reports: EvaluationReport[]): MonthOption[] {
  const monthMap = new Map<string, { year: number; monthIndex: number; count: number }>();

  // Collect months from reports that have a valid "Fecha de finalización al 100%:"
  reports.forEach((r) => {
    if (r.reportType === 'PRUEBAS_CARGA') return;
    const d = getReportDate(r);
    if (!d) return;
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      monthMap.set(key, { year: y, monthIndex: m, count: 1 });
    }
  });

  // Ensure current year months and 2026 months exist
  const now = new Date();
  const currentYear = now.getFullYear();
  const targetYears = [2026, currentYear];
  targetYears.forEach((yr) => {
    for (let mi = 0; mi < 12; mi++) {
      const key = `${yr}-${String(mi + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { year: yr, monthIndex: mi, count: 0 });
      }
    }
  });

  const sortedKeys = Array.from(monthMap.keys()).sort().reverse();

  return sortedKeys.map((key) => {
    const item = monthMap.get(key)!;
    const shortLabel = `${SPANISH_MONTH_SHORT[item.monthIndex]}-${item.year}`;
    const fullMonth = SPANISH_MONTH_FULL[item.monthIndex];
    const mStr = String(item.monthIndex + 1).padStart(2, '0');
    const lastDay = new Date(item.year, item.monthIndex + 1, 0).getDate();

    return {
      key,
      year: item.year,
      monthIndex: item.monthIndex,
      label: shortLabel,
      fullLabel: `${fullMonth} ${item.year} (${shortLabel})`,
      startDateStr: `1/${mStr}/${item.year}`,
      endDateStr: `${lastDay}/${mStr}/${item.year}`,
      reportCount: item.count,
    };
  });
}

/**
 * Builds the indicator column for a single document
 */
export function buildDocumentIndicatorColumn(report: EvaluationReport): DocumentIndicatorColumn {
  const d =
    getReportDate(report) ||
    (() => {
      const fallback = parseFlexibleDate(
        report.fechaFinalizacion || report.fechaEntregaVacioProduccion || report.evaluationDate || report.createdAt
      );
      return fallback
        ? new Date(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate())
        : new Date();
    })();
  const m = d.getMonth();
  const year = d.getFullYear();
  const fechaEntregaStr = `${SPANISH_MONTH_SHORT[m]}-${year}`;

  // Extract clean galpón number or name
  let galponClean = (report.galpon || '1').trim();
  const galponMatch = galponClean.match(/\d+/);
  if (galponMatch) {
    galponClean = galponMatch[0];
  }

  const categoryScores: Record<string, DocumentActivityScore> = {};

  INDICATOR_CATEGORIES.forEach((cat) => {
    categoryScores[cat.id] = {
      avgScore: null,
      evaluatedCount: 0,
      items: [],
    };
  });

  (report.sections || []).forEach((sec) => {
    (sec.items || []).forEach((it) => {
      const cat = resolveItemCategory(it, sec.title);
      if (it.status === 'na') return;

      let score: number | null = null;
      if (it.score !== undefined && it.score !== null) {
        score = it.score;
      } else if (it.status === 'cumple') {
        score = 100;
      } else if (it.status === 'no_cumple') {
        score = 0;
      }

      if (score !== null && categoryScores[cat.id]) {
        categoryScores[cat.id].items.push({
          question: it.question,
          score,
          criteria: it.criteria,
          sectionTitle: sec.title,
        });
      }
    });
  });

  // Calculate average for each category in this document
  INDICATOR_CATEGORIES.forEach((cat) => {
    const entry = categoryScores[cat.id];
    entry.evaluatedCount = entry.items.length;
    if (entry.items.length > 0) {
      const sum = entry.items.reduce((acc, curr) => acc + curr.score, 0);
      entry.avgScore = Math.round((sum / entry.items.length) * 100) / 100;
    } else {
      entry.avgScore = null;
    }
  });

  // Cumplimiento en fecha (using user formula =((E2-D2)/(F2-D2))-1)
  const { score: cumplimientoFecha, details: cumplimientoFechaDetails } = calculateCumplimientoEnFecha(report);

  // Días vacío sanitario
  let diasVacio: number | null = null;
  if (report.diasVacioSanitario !== undefined && report.diasVacioSanitario !== null) {
    diasVacio = report.diasVacioSanitario;
  } else {
    diasVacio = 8;
  }

  return {
    reportId: report.id,
    reportCode: report.code || report.id,
    report,
    granja: (report.farm || report.zone || 'GRANJA').toUpperCase(),
    galpon: galponClean,
    fechaEntregaStr,
    rawDate: d,
    cumplimientoEnFecha: cumplimientoFecha,
    cumplimientoFechaDetails,
    cumplimientoEnCondicion: report.totalScore ?? 100,
    diasVacioSanitario: diasVacio,
    categoryScores,
  };
}

export interface MonthlyIndicatorMatrix {
  selectedMonthKey: string;
  mesCorteLabel: string;
  fechaInicioStr: string;
  fechaFinStr: string;
  columns: DocumentIndicatorColumn[];
  monthlyAverages: {
    cumplimientoEnFecha: number | null;
    cumplimientoEnCondicion: number | null;
    diasVacioSanitario: number | null;
    categories: Record<string, number | null>;
  };
}

/**
 * Calculates the monthly indicator matrix conforming to the Excel structure
 */
export function calculateMonthlyIndicatorMatrix(
  reports: EvaluationReport[],
  selectedMonth: string | MonthOption,
  filterFarm: string = 'TODAS'
): MonthlyIndicatorMatrix {
  const monthKey =
    typeof selectedMonth === 'string'
      ? selectedMonth
      : selectedMonth && typeof selectedMonth === 'object' && 'key' in selectedMonth
      ? (selectedMonth as MonthOption).key
      : '2026-08';

  const monthParts = (monthKey || '2026-08').split('-');
  const y = parseInt(monthParts[0], 10) || 2026;
  const m = Math.max(0, Math.min(11, (parseInt(monthParts[1], 10) || 8) - 1));
  const mesCorteLabel = `${SPANISH_MONTH_SHORT[m]}-${y}`;
  const mStr = String(m + 1).padStart(2, '0');
  const lastDay = new Date(y, m + 1, 0).getDate();
  const fechaInicioStr = `1/${mStr}/${y}`;
  const fechaFinStr = `${lastDay}/${mStr}/${y}`;

  // Filter reports matching the year & month based strictly on "Fecha de finalización al 100%:"
  const matchingReports = reports.filter((r) => {
    // Only include empty delivery and evaluation reports
    if (r.reportType === 'PRUEBAS_CARGA') return false;

    const rd = getReportDate(r);
    if (!rd) return false;
    const isSameMonth = rd.getFullYear() === y && rd.getMonth() === m;
    if (!isSameMonth) return false;

    if (filterFarm && filterFarm !== 'TODAS') {
      const farmName = (r.farm || r.zone || '').toUpperCase();
      if (farmName !== filterFarm.toUpperCase()) return false;
    }

    return true;
  });

  // Build columns
  const columns = matchingReports.map(buildDocumentIndicatorColumn);

  // Sort columns: by farm, then by numerical galpon
  columns.sort((a, b) => {
    if (a.granja !== b.granja) return a.granja.localeCompare(b.granja);
    const gA = parseInt(a.galpon, 10);
    const gB = parseInt(b.galpon, 10);
    if (!isNaN(gA) && !isNaN(gB)) return gA - gB;
    return a.galpon.localeCompare(b.galpon);
  });

  // Calculate monthly summary averages across all columns
  let sumCumplimientoFecha = 0;
  let countCumplimientoFecha = 0;
  let sumCondicion = 0;
  let sumVacio = 0;
  let countVacio = 0;

  const categoryAverages: Record<string, number | null> = {};
  INDICATOR_CATEGORIES.forEach((cat) => {
    let catSum = 0;
    let catCount = 0;

    columns.forEach((col) => {
      const cScore = col.categoryScores[cat.id]?.avgScore;
      if (cScore !== null && cScore !== undefined) {
        catSum += cScore;
        catCount += 1;
      }
    });

    if (catCount > 0) {
      categoryAverages[cat.id] = Math.round((catSum / catCount) * 100) / 100;
    } else {
      categoryAverages[cat.id] = null;
    }
  });

  columns.forEach((col) => {
    if (col.cumplimientoEnFecha !== null) {
      sumCumplimientoFecha += col.cumplimientoEnFecha;
      countCumplimientoFecha += 1;
    }
    sumCondicion += col.cumplimientoEnCondicion;
    if (col.diasVacioSanitario !== null) {
      sumVacio += col.diasVacioSanitario;
      countVacio += 1;
    }
  });

  const avgCumplimientoFecha =
    countCumplimientoFecha > 0 ? Math.round((sumCumplimientoFecha / countCumplimientoFecha) * 100) / 100 : null;
  const avgCondicion =
    columns.length > 0 ? Math.round((sumCondicion / columns.length) * 100) / 100 : null;
  const avgVacio = countVacio > 0 ? Math.round((sumVacio / countVacio) * 10) / 10 : null;

  return {
    selectedMonthKey: monthKey,
    mesCorteLabel,
    fechaInicioStr,
    fechaFinStr,
    columns,
    monthlyAverages: {
      cumplimientoEnFecha: avgCumplimientoFecha,
      cumplimientoEnCondicion: avgCondicion,
      diasVacioSanitario: avgVacio,
      categories: categoryAverages,
    },
  };
}
