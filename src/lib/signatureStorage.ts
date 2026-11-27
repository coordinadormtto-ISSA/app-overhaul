import { Signature, EvaluationReport } from '../types';
import { readMediaFromIdb, writeMediaToIdb, safeLocalStorageSet, safeLocalStorageRemove } from './mediaCacheDb';

const SIGNATURES_STORE_KEY = 'kikes_report_signatures_map';
const IDB_SIGNATURES_KEY = 'report_signatures_map';

export interface StoredSignaturePayload {
  reportCode: string;
  reportId?: string;
  signatures: Signature[];
  emailSentTo?: string[];
  notes?: string;
  updatedAt: string;
}

let memorySignaturesMap: Record<string, StoredSignaturePayload> | null = null;
let signaturesMutatedInSession = false;

function readSignaturesFromLocalStorage(): Record<string, StoredSignaturePayload> {
  try {
    const raw = localStorage.getItem(SIGNATURES_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistSignaturesMap(map: Record<string, StoredSignaturePayload>): void {
  signaturesMutatedInSession = true;
  memorySignaturesMap = map;
  void writeMediaToIdb(IDB_SIGNATURES_KEY, map);

  try {
    const json = JSON.stringify(map);
    if (json.length <= 300_000) {
      if (!safeLocalStorageSet(SIGNATURES_STORE_KEY, json)) {
        safeLocalStorageRemove(SIGNATURES_STORE_KEY);
      }
    } else {
      // Keep large signature payloads in IndexedDB + memory so localStorage stays lightweight
      safeLocalStorageRemove(SIGNATURES_STORE_KEY);
    }
  } catch {
    safeLocalStorageRemove(SIGNATURES_STORE_KEY);
  }
}

/**
 * Hydrates signatures map from IndexedDB and migrates any oversized localStorage entry.
 */
export async function hydrateSignaturesCache(): Promise<boolean> {
  try {
    const idbMap = await readMediaFromIdb<Record<string, StoredSignaturePayload>>(IDB_SIGNATURES_KEY);
    const localMap = readSignaturesFromLocalStorage();

    if (!signaturesMutatedInSession && idbMap && typeof idbMap === 'object') {
      const merged: Record<string, StoredSignaturePayload> = { ...idbMap, ...localMap };
      memorySignaturesMap = merged;
      if (Object.keys(localMap).length > 0) {
        await writeMediaToIdb(IDB_SIGNATURES_KEY, merged);
      }
      const rawLs = localStorage.getItem(SIGNATURES_STORE_KEY);
      if (rawLs && rawLs.length > 300_000) {
        safeLocalStorageRemove(SIGNATURES_STORE_KEY);
      }
      return Object.keys(merged).length > 0;
    }

    if (Object.keys(localMap).length > 0) {
      memorySignaturesMap = { ...(memorySignaturesMap || {}), ...localMap };
      await writeMediaToIdb(IDB_SIGNATURES_KEY, memorySignaturesMap);
      const rawLs = localStorage.getItem(SIGNATURES_STORE_KEY);
      if (rawLs && rawLs.length > 300_000) {
        safeLocalStorageRemove(SIGNATURES_STORE_KEY);
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Retrieves the complete persistent signature map from memory/localStorage.
 */
export function getSignaturesMap(): Record<string, StoredSignaturePayload> {
  if (memorySignaturesMap !== null) {
    return memorySignaturesMap;
  }
  const parsed = readSignaturesFromLocalStorage();
  memorySignaturesMap = parsed;
  return parsed;
}

/**
 * Saves or updates signatures for a given report code/id safely.
 */
export function saveReportSignatures(
  reportCode: string,
  reportId: string | undefined,
  signatures: Signature[],
  emailSentTo?: string[],
  notes?: string
): void {
  if (!reportCode && !reportId) return;
  if (!signatures || signatures.length === 0) return;

  try {
    const map = { ...getSignaturesMap() };
    const cleanCode = (reportCode || '').trim().toUpperCase();
    const cleanId = (reportId || '').trim();

    const validSignatures = signatures.filter((s) => s && (s.nombre?.trim() || s.signatureDataUrl));
    if (validSignatures.length === 0) return;

    const payload: StoredSignaturePayload = {
      reportCode: cleanCode || cleanId,
      reportId: cleanId,
      signatures: validSignatures,
      emailSentTo: emailSentTo || [],
      notes: notes || '',
      updatedAt: new Date().toISOString(),
    };

    const primaryKey = cleanCode || cleanId;
    map[primaryKey] = payload;
    // Remove legacy duplicate entry under cleanId when cleanCode is primary
    if (cleanCode && cleanId && cleanId !== cleanCode && map[cleanId]) {
      delete map[cleanId];
    }

    persistSignaturesMap(map);
  } catch (e) {
    console.error('Error saving report signatures:', e);
  }
}

function findSignaturePayload(
  map: Record<string, StoredSignaturePayload>,
  cleanCode: string,
  cleanId: string
): StoredSignaturePayload | undefined {
  if (cleanCode && map[cleanCode]) return map[cleanCode];
  if (cleanId && map[cleanId]) return map[cleanId];

  const allEntries = Object.entries(map);
  const byKey = allEntries.find(
    ([k]) => (cleanCode && k.toUpperCase() === cleanCode) || (cleanId && k === cleanId)
  );
  if (byKey) return byKey[1];

  return allEntries
    .map(([, v]) => v)
    .find(
      (v) =>
        v &&
        ((cleanCode && (v.reportCode || '').toUpperCase() === cleanCode) ||
          (cleanId && v.reportId === cleanId))
    );
}

/**
 * Retrieves signatures for a given report by its code or ID.
 */
export function getReportSignatures(reportCode?: string, reportId?: string): Signature[] {
  const map = getSignaturesMap();
  const cleanCode = (reportCode || '').trim().toUpperCase();
  const cleanId = (reportId || '').trim();

  const found = findSignaturePayload(map, cleanCode, cleanId);
  if (found?.signatures?.length) {
    return found.signatures;
  }

  return [];
}

/**
 * Retrieves saved email recipients for a given report.
 */
export function getReportEmails(reportCode?: string, reportId?: string): string[] {
  const map = getSignaturesMap();
  const cleanCode = (reportCode || '').trim().toUpperCase();
  const cleanId = (reportId || '').trim();

  const found = findSignaturePayload(map, cleanCode, cleanId);
  if (found?.emailSentTo?.length) {
    return found.emailSentTo;
  }
  return [];
}

/**
 * Merges and guarantees signatures and email recipients on an EvaluationReport object.
 * If report.signatures is missing or empty, it pulls from the local persistent signatures store.
 * If report.signatures has items, it updates the persistent store.
 */
export function mergeSignaturesIntoReport(report: EvaluationReport): EvaluationReport {
  if (!report) return report;

  const hasReportSignatures = Boolean(
    report.signatures &&
      report.signatures.length > 0 &&
      report.signatures.some((s) => s.nombre?.trim() || s.signatureDataUrl)
  );

  if (hasReportSignatures) {
    // Keep persistent store updated
    saveReportSignatures(
      report.code,
      report.id,
      report.signatures,
      report.emailSentTo,
      report.notes
    );
    return report;
  }

  // Signatures were empty or wiped: recover them from persistent store
  const storedSignatures = getReportSignatures(report.code, report.id);
  const storedEmails = getReportEmails(report.code, report.id);

  const updatedSignatures = storedSignatures.length > 0 ? storedSignatures : (report.signatures || []);
  const updatedEmails =
    report.emailSentTo && report.emailSentTo.length > 0
      ? report.emailSentTo
      : storedEmails;

  // Also check nested pruebaConCarga signatures
  let updatedPruebaConCarga = report.pruebaConCarga;
  if (updatedPruebaConCarga) {
    const pcHasSignatures = Boolean(
      updatedPruebaConCarga.signatures &&
        updatedPruebaConCarga.signatures.length > 0 &&
        updatedPruebaConCarga.signatures.some((s) => s.nombre?.trim() || s.signatureDataUrl)
    );
    if (!pcHasSignatures && updatedSignatures.length > 0) {
      updatedPruebaConCarga = {
        ...updatedPruebaConCarga,
        signatures: updatedSignatures,
      };
    }
  }

  return {
    ...report,
    signatures: updatedSignatures,
    emailSentTo: updatedEmails,
    pruebaConCarga: updatedPruebaConCarga,
  };
}
