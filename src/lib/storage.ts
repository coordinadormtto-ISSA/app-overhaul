import { Persona, EvaluationReport, ItemStatus, ZoneType } from '../types';
import { INITIAL_PERSONAS, INITIAL_REPORTS, getPruebaConCargaTemplate } from '../data/initialData';
import { mergeSignaturesIntoReport, saveReportSignatures, hydrateSignaturesCache } from './signatureStorage';
import { readMediaFromIdb, writeMediaToIdb, safeLocalStorageSet, safeLocalStorageRemove } from './mediaCacheDb';

const PERSONAS_KEY = 'kikes_overhaul_personas';
const DELETED_PERSONAS_KEY = 'kikes_overhaul_deleted_personas';
const REPORTS_KEY = 'kikes_overhaul_reports';
const IDB_REPORTS_KEY = 'overhaul_reports';

let memoryPersonas: Persona[] | null = null;
let memoryReports: EvaluationReport[] | null = null;
let reportsMutatedInSession = false;

function getDeletedPersonaKeys(): Set<string> {
  try {
    const data = localStorage.getItem(DELETED_PERSONAS_KEY);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch {
    return new Set();
  }
}

function addDeletedPersonaKey(key: string, id: string) {
  const set = getDeletedPersonaKeys();
  if (key) set.add(key.toLowerCase().trim());
  if (id) set.add(id);
  safeLocalStorageSet(DELETED_PERSONAS_KEY, JSON.stringify(Array.from(set)));
}

export function getStoredPersonas(): Persona[] {
  if (memoryPersonas !== null) {
    return [...memoryPersonas];
  }
  try {
    const data = localStorage.getItem(PERSONAS_KEY);
    const deletedKeys = getDeletedPersonaKeys();

    if (!data) {
      const initialFiltered = INITIAL_PERSONAS.filter((p) => {
        const key = `${p.nombre.toLowerCase().trim()}_${p.correo.toLowerCase().trim()}`;
        return !deletedKeys.has(p.id) && !deletedKeys.has(key);
      }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      memoryPersonas = initialFiltered;
      safeLocalStorageSet(PERSONAS_KEY, JSON.stringify(initialFiltered));
      return initialFiltered;
    }

    const parsed: Persona[] = JSON.parse(data);

    // Seed with INITIAL_PERSONAS (skipping those marked deleted)
    const mergedMap = new Map<string, Persona>();
    INITIAL_PERSONAS.forEach((p) => {
      const key = `${p.nombre.toLowerCase().trim()}_${p.correo.toLowerCase().trim()}`;
      if (!deletedKeys.has(p.id) && !deletedKeys.has(key)) {
        mergedMap.set(key, p);
      }
    });

    // Merge parsed stored personas (skipping deleted ones)
    parsed.forEach((p) => {
      const key = `${p.nombre.toLowerCase().trim()}_${p.correo.toLowerCase().trim()}`;
      if (!deletedKeys.has(p.id) && !deletedKeys.has(key)) {
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          mergedMap.set(key, { ...existing, ...p, id: existing.id || p.id });
        } else {
          mergedMap.set(key, p);
        }
      }
    });

    // Ensure strictly unique IDs across all items
    const seenIds = new Set<string>();
    const mergedList = Array.from(mergedMap.values()).map((p, idx) => {
      let finalId = p.id;
      if (!finalId || seenIds.has(finalId)) {
        finalId = `p-unique-${idx + 1}`;
      }
      seenIds.add(finalId);
      return { ...p, id: finalId };
    });

    mergedList.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

    memoryPersonas = mergedList;
    safeLocalStorageSet(PERSONAS_KEY, JSON.stringify(mergedList));
    return mergedList;
  } catch (e) {
    console.error('Error reading personas from storage:', e);
    const fallback = [...INITIAL_PERSONAS].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    memoryPersonas = fallback;
    return fallback;
  }
}

export function replaceStoredPersonas(personas: Persona[]): Persona[] {
  const sorted = [...(personas || [])].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  );
  memoryPersonas = sorted;
  safeLocalStorageSet(PERSONAS_KEY, JSON.stringify(sorted));
  return sorted;
}

export function savePersona(persona: Persona): Persona[] {
  const current = getStoredPersonas();
  const index = current.findIndex(p => p.id === persona.id);
  let updated: Persona[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = persona;
  } else {
    updated = [persona, ...current];
  }
  updated.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  memoryPersonas = updated;
  safeLocalStorageSet(PERSONAS_KEY, JSON.stringify(updated));
  return updated;
}

export function deletePersona(id: string): Persona[] {
  const current = getStoredPersonas();
  const target = current.find((p) => p.id === id);

  if (target) {
    const key = `${target.nombre.toLowerCase().trim()}_${target.correo.toLowerCase().trim()}`;
    addDeletedPersonaKey(key, id);
  } else {
    addDeletedPersonaKey('', id);
  }

  const updated = current.filter((p) => p.id !== id);
  updated.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  memoryPersonas = updated;
  safeLocalStorageSet(PERSONAS_KEY, JSON.stringify(updated));
  return updated;
}

export function sanitizeReport(report: EvaluationReport): EvaluationReport {
  const isCargaReport = report.reportType === 'PRUEBAS_CARGA';

  if (isCargaReport) {
    const rawSections = report.sections && report.sections.length > 0 ? report.sections : getPruebaConCargaTemplate();
    const sanitizedSections = rawSections.map((sec) => ({
      ...sec,
      items: (sec.items || []).map((it) => {
        const fCount = it.failuresCount !== undefined && it.failuresCount !== null && !isNaN(it.failuresCount)
          ? Math.max(0, it.failuresCount)
          : 0;
        return {
          ...it,
          failuresCount: fCount,
          status: (fCount === 0 ? 'cumple' : 'no_cumple') as ItemStatus,
        };
      }),
    }));

    const allItems = sanitizedSections.flatMap((s) => s.items);
    const sumFailures = allItems.reduce((acc, it) => acc + (it.failuresCount || 0), 0);
    const totalFailures = report.totalFailures !== undefined && !isNaN(report.totalFailures)
      ? report.totalFailures
      : sumFailures;

    const systemsWithZeroFailures = allItems.filter((it) => (it.failuresCount || 0) === 0).length;
    const computedReliability = allItems.length > 0 ? Math.round((systemsWithZeroFailures / allItems.length) * 100) : 100;

    let score = report.totalScore;
    if (score === undefined || score === null || isNaN(score)) {
      score = computedReliability;
    } else if (score > 0 && score <= 1) {
      score = Math.round(score * 100);
    }

    return {
      ...report,
      reportType: 'PRUEBAS_CARGA',
      totalScore: score,
      totalFailures,
      totalItems: allItems.length || 7,
      passedItems: systemsWithZeroFailures,
      failedItems: (allItems.length || 7) - systemsWithZeroFailures,
      sections: sanitizedSections,
    };
  }

  let score = report.totalScore;
  // If score was stored as decimal or 1 (representing 100% in Sheets ratio format)
  if (score !== undefined && score !== null && !isNaN(score)) {
    if (score > 0 && score <= 1) {
      score = Math.round(score * 100);
    }
  } else {
    score = 100;
  }

  // Also check individual sections if items exist
  let calculatedPassed = 0;
  let calculatedFailed = 0;
  let hasItemScores = false;
  let totalScoreSum = 0;
  let evaluatedItemsCount = 0;

  const sanitizedSections = (report.sections || []).map((sec) => {
    const sanitizedItems = (sec.items || []).map((it) => {
      let itemScore = it.score;
      if (itemScore !== undefined && itemScore !== null && !isNaN(itemScore)) {
        if (itemScore > 0 && itemScore <= 1) {
          itemScore = Math.round(itemScore * 100);
        }
      }

      if (itemScore !== undefined && itemScore !== null) {
        hasItemScores = true;
        totalScoreSum += itemScore;
        evaluatedItemsCount++;
        if (itemScore === 100) {
          calculatedPassed++;
        } else {
          calculatedFailed++;
        }
      } else if (it.status === 'cumple') {
        calculatedPassed++;
        hasItemScores = true;
        totalScoreSum += 100;
        evaluatedItemsCount++;
      } else if (it.status === 'no_cumple') {
        calculatedFailed++;
        hasItemScores = true;
        totalScoreSum += 0;
        evaluatedItemsCount++;
      }

      return {
        ...it,
        score: itemScore,
      };
    });

    return {
      ...sec,
      items: sanitizedItems,
    };
  });

  const totalItemsCount = sanitizedSections.flatMap((s) => s.items).length || report.totalItems || 24;

  let finalPassed = report.passedItems;
  let finalFailed = report.failedItems;

  if (hasItemScores && evaluatedItemsCount > 0) {
    finalPassed = calculatedPassed;
    finalFailed = calculatedFailed;
    // If score was 1 or mismatch with items average when all items are 100%
    if (calculatedFailed === 0 && calculatedPassed > 0 && score < 50) {
      score = 100;
    } else if (evaluatedItemsCount > 0 && (score <= 1 || isNaN(score))) {
      score = Math.round((totalScoreSum / evaluatedItemsCount) * 100) / 100;
    }
  } else {
    if (score === 100) {
      finalPassed = totalItemsCount;
      finalFailed = 0;
    } else {
      finalPassed = Math.round((score / 100) * totalItemsCount);
      finalFailed = totalItemsCount - finalPassed;
    }
  }

  // Also sanitize prueba con carga if present
  let sanitizedPruebaConCarga = report.pruebaConCarga;
  if (sanitizedPruebaConCarga) {
    let pcScore = sanitizedPruebaConCarga.totalScore;
    if (pcScore !== undefined && pcScore !== null && pcScore > 0 && pcScore <= 1) {
      pcScore = Math.round(pcScore * 100);
    }
    const pcRawSections = sanitizedPruebaConCarga.sections && sanitizedPruebaConCarga.sections.length > 0
      ? sanitizedPruebaConCarga.sections
      : getPruebaConCargaTemplate();

    const pcSanitizedSections = pcRawSections.map((sec) => ({
      ...sec,
      items: (sec.items || []).map((it) => {
        const fCount = it.failuresCount !== undefined && it.failuresCount !== null && !isNaN(it.failuresCount)
          ? Math.max(0, it.failuresCount)
          : 0;
        return {
          ...it,
          failuresCount: fCount,
          status: (fCount === 0 ? 'cumple' : 'no_cumple') as ItemStatus,
        };
      }),
    }));

    const pcItems = pcSanitizedSections.flatMap((s) => s.items);
    const sumPcFailures = pcItems.reduce((acc, it) => acc + (it.failuresCount || 0), 0);
    const pcFailures = sanitizedPruebaConCarga.totalFailures !== undefined && !isNaN(sanitizedPruebaConCarga.totalFailures)
      ? sanitizedPruebaConCarga.totalFailures
      : sumPcFailures;

    sanitizedPruebaConCarga = {
      ...sanitizedPruebaConCarga,
      totalScore: pcScore ?? 100,
      totalFailures: pcFailures,
      sections: pcSanitizedSections,
    };
  }

  // Ensure zone and zonaNombre are consistent and correct
  let sanitizedZone: ZoneType = report.zone || 'ZUCAMI';
  let sanitizedZonaNombre = report.zonaNombre;

  if (sanitizedZone === 'ZUCAMI' || (sanitizedZonaNombre && sanitizedZonaNombre.toUpperCase().includes('ZUCAMI'))) {
    sanitizedZone = 'ZUCAMI';
    sanitizedZonaNombre = 'ZUCAMI';
  } else if (sanitizedZone === 'SALMET' || (sanitizedZonaNombre && sanitizedZonaNombre.toUpperCase().includes('SALMET'))) {
    sanitizedZone = 'SALMET';
    sanitizedZonaNombre = 'SALMET';
  } else if (sanitizedZone === 'EL ROBLE' || (sanitizedZonaNombre && sanitizedZonaNombre.toUpperCase().includes('ROBLE'))) {
    sanitizedZone = 'EL ROBLE';
    sanitizedZonaNombre = 'EL ROBLE';
  } else if (sanitizedZone === 'GRANJAS PISO' || (sanitizedZonaNombre && sanitizedZonaNombre.toUpperCase().includes('PISO'))) {
    sanitizedZone = 'GRANJAS PISO';
    sanitizedZonaNombre = sanitizedZonaNombre || 'GRANJAS PISO';
  } else {
    sanitizedZonaNombre = sanitizedZonaNombre || sanitizedZone;
  }

  // If report was saved with default 'LEBRIJA' for a ZUCAMI or SALMET or ROBLE report, correct it
  if (sanitizedZone !== 'GRANJAS PISO' && sanitizedZonaNombre === 'LEBRIJA') {
    sanitizedZonaNombre = sanitizedZone;
  }

  const baseReport: EvaluationReport = {
    ...report,
    zone: sanitizedZone,
    zonaNombre: sanitizedZonaNombre,
    totalScore: score,
    totalItems: totalItemsCount,
    passedItems: finalPassed,
    failedItems: finalFailed,
    sections: sanitizedSections,
    pruebaConCarga: sanitizedPruebaConCarga,
  };

  // Restore and maintain signatures from persistent store
  return mergeSignaturesIntoReport(baseReport);
}

function persistReports(reports: EvaluationReport[]): EvaluationReport[] {
  reportsMutatedInSession = true;
  memoryReports = reports;
  void writeMediaToIdb(IDB_REPORTS_KEY, reports);

  try {
    const json = JSON.stringify(reports);
    if (json.length <= 800_000) {
      if (!safeLocalStorageSet(REPORTS_KEY, json)) {
        safeLocalStorageRemove(REPORTS_KEY);
      }
    } else {
      // IndexedDB + memory hold all reports cleanly when payload exceeds 800 KB
      safeLocalStorageRemove(REPORTS_KEY);
    }
  } catch {
    safeLocalStorageRemove(REPORTS_KEY);
  }

  return reports;
}

/**
 * Hydrates signatures and reports from IndexedDB into memory on startup,
 * and safely migrates oversized localStorage payloads to free browser quota.
 */
export async function hydrateReportsCache(): Promise<{ updated: boolean; reports: EvaluationReport[] }> {
  try {
    await hydrateSignaturesCache();
  } catch {
    // Ignore signature hydration error
  }

  try {
    const idbReports = await readMediaFromIdb<EvaluationReport[]>(IDB_REPORTS_KEY);
    const localReports = getStoredReports();

    if (!reportsMutatedInSession && Array.isArray(idbReports) && idbReports.length > 0) {
      // Merge IDB reports and any localStorage reports (preferring localStorage for matching codes/ids)
      const byKey = new Map<string, EvaluationReport>();
      for (const rep of idbReports) {
        const k = (rep.code || rep.id || '').trim().toUpperCase();
        if (k) byKey.set(k, rep);
      }
      for (const rep of localReports) {
        const k = (rep.code || rep.id || '').trim().toUpperCase();
        if (k) byKey.set(k, rep);
      }
      const merged = Array.from(byKey.values()).map(sanitizeReport);
      const changed = merged.length !== localReports.length || localReports.length === 0;
      memoryReports = merged;
      await writeMediaToIdb(IDB_REPORTS_KEY, merged);

      const rawLs = localStorage.getItem(REPORTS_KEY);
      if (rawLs && rawLs.length > 800_000) {
        safeLocalStorageRemove(REPORTS_KEY);
      }
      return { updated: changed, reports: [...merged] };
    }

    if (localReports.length > 0) {
      await writeMediaToIdb(IDB_REPORTS_KEY, localReports);
      const rawLs = localStorage.getItem(REPORTS_KEY);
      if (rawLs && rawLs.length > 800_000) {
        safeLocalStorageRemove(REPORTS_KEY);
      }
    }
    return { updated: false, reports: [...localReports] };
  } catch {
    return { updated: false, reports: getStoredReports() };
  }
}

export function getStoredReports(): EvaluationReport[] {
  if (memoryReports !== null) {
    return [...memoryReports];
  }
  try {
    const data = localStorage.getItem(REPORTS_KEY);
    if (!data) {
      memoryReports = [];
      safeLocalStorageSet(REPORTS_KEY, JSON.stringify([]));
      return [];
    }
    const parsed: EvaluationReport[] = JSON.parse(data);
    const sanitized = Array.isArray(parsed) ? parsed.map(sanitizeReport) : [];
    memoryReports = sanitized;
    const json = JSON.stringify(sanitized);
    if (json.length <= 800_000) {
      safeLocalStorageSet(REPORTS_KEY, json);
    }
    return [...sanitized];
  } catch (e) {
    console.error('Error reading reports from storage:', e);
    memoryReports = [];
    return [];
  }
}

export function replaceStoredReports(rawReports: EvaluationReport[]): EvaluationReport[] {
  const sanitized = (rawReports || []).map(sanitizeReport);
  return persistReports(sanitized);
}

export function saveReport(rawReport: EvaluationReport): EvaluationReport[] {
  const report = sanitizeReport(rawReport);
  if (report.signatures && report.signatures.length > 0) {
    saveReportSignatures(
      report.code,
      report.id,
      report.signatures,
      report.emailSentTo,
      report.notes
    );
  }
  const current = getStoredReports();
  const index = current.findIndex(r => r.id === report.id || (report.code && r.code === report.code));
  let updated: EvaluationReport[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = report;
  } else {
    updated = [report, ...current];
  }
  return persistReports(updated);
}

export function deleteReport(id: string): EvaluationReport[] {
  const current = getStoredReports();
  const updated = current.filter(r => r.id !== id);
  return persistReports(updated);
}
