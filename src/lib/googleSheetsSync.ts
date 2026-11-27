import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { EvaluationReport, ZoneType, EvaluationSection, EvaluationItem, ItemStatus, Persona, Signature } from '../types';
import { getPruebaConCargaTemplate, INITIAL_PERSONAS } from '../data/initialData';
import { sanitizeReport, getStoredPersonas, replaceStoredPersonas } from './storage';
import {
  getCustomMenuImages,
  getCustomMenuOverridesOnly,
  setCustomMenuImagesMap,
  STORAGE_KEY,
  MENU_ITEMS_CATALOG,
} from './customImages';
import { safeLocalStorageSet } from './mediaCacheDb';
import {
  getCompanyLogo,
  saveCompanyLogo,
  hasCustomCompanyLogo,
  COMPANY_LOGO_STORAGE_KEY,
  COMPANY_LOGO_DATA_URL,
} from '../assets/logo';
import { saveReportSignatures, getReportSignatures, getReportEmails } from './signatureStorage';
import {
  getAvailableForms,
  getFormSections,
  INDICATOR_CATEGORIES,
  resolveItemCategory,
  DEFAULT_FORMS,
  getStorageKeyForForm,
  FormConfig,
  calculateMonthlyIndicatorMatrix,
  MonthOption,
} from './indicatorsManager';

export function parseScoreValue(val: any, defaultVal = 100): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  const str = String(val).replace('%', '').trim().replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num)) return defaultVal;
  // If Excel/Google Sheets returns decimal ratio 0.01-1.0 (e.g. 1 for 100%, 0.85 for 85%)
  if (num > 0 && num <= 1) {
    return Math.round(num * 100);
  }
  return Math.round(num);
}

export const DEFAULT_SPREADSHEET_ID = '1CDS279UICvcvPK4mj28NxChkMhrnxIkhRMifG6b1-3E';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`;

const TOKEN_STORAGE_KEY = 'kikes_google_sheets_access_token';
const TOKEN_EXPIRY_KEY = 'kikes_google_sheets_token_expiry';
const SPREADSHEET_ID_KEY = 'kikes_custom_spreadsheet_id';

export function getFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

export function getSpreadsheetId(): string {
  try {
    const saved = localStorage.getItem(SPREADSHEET_ID_KEY);
    return saved && saved.trim() ? saved.trim() : DEFAULT_SPREADSHEET_ID;
  } catch (e) {
    return DEFAULT_SPREADSHEET_ID;
  }
}

export function setSpreadsheetId(id: string): void {
  try {
    localStorage.setItem(SPREADSHEET_ID_KEY, id.trim());
  } catch (e) {
    console.error('Error saving spreadsheet id:', e);
  }
}

const CURRENT_PROJECT_KEY = 'kikes_google_project_id';

export function getCachedGoogleToken(): string | null {
  try {
    const savedProject = localStorage.getItem(CURRENT_PROJECT_KEY);
    if (savedProject !== firebaseConfig.projectId) {
      clearGoogleToken();
      return null;
    }
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (token && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        return token;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function setCachedGoogleToken(token: string, expiresInSeconds: number = 3500): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(CURRENT_PROJECT_KEY, firebaseConfig.projectId);
    localStorage.setItem(TOKEN_EXPIRY_KEY, (Date.now() + expiresInSeconds * 1000).toString());
  } catch (e) {
    console.error('Error caching token:', e);
  }
}

export function clearGoogleToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  } catch (e) {}
}

let pendingAuthPromise: Promise<string> | null = null;

/**
 * Initiates Google OAuth Popup to obtain Google Sheets access token.
 * Deduplicates concurrent sign-in requests so only one popup is shown at a time.
 */
export async function authenticateWithGoogle(): Promise<string> {
  const cached = getCachedGoogleToken();
  if (cached) return cached;

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  pendingAuthPromise = (async () => {
    try {
      const app = getFirebaseApp();
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.setCustomParameters({ prompt: 'select_account' });

      const userCredential = await signInWithPopup(auth, provider);
      const googleCredential = GoogleAuthProvider.credentialFromResult(userCredential);
      const accessToken = googleCredential?.accessToken;

      if (!accessToken) {
        throw new Error('No se pudo obtener el token de acceso de Google Sheets.');
      }

      setCachedGoogleToken(accessToken, 3600);
      return accessToken;
    } finally {
      pendingAuthPromise = null;
    }
  })();

  return pendingAuthPromise;
}

export async function getValidAccessToken(promptIfMissing: boolean = false): Promise<string | null> {
  const cached = getCachedGoogleToken();
  if (cached) return cached;
  if (promptIfMissing) {
    return await authenticateWithGoogle();
  }
  return null;
}

/**
 * Formats dates into DD/MM/YYYY matching the user's spreadsheet screenshot
 */
export function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr || dateStr.trim() === '') return '';
  const trimmed = dateStr.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return trimmed;
  
  // Parse YYYY-MM-DD or YYYY/MM/DD cleanly without timezone offset shift
  const matchIso = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (matchIso) {
    const [, year, month, day] = matchIso;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return trimmed;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Normalizes zone type to standard tab name
 */
export function getSheetTabNameForZone(zone: ZoneType | string): string {
  const norm = (zone || '').toUpperCase().trim();
  if (norm.includes('ZUCAMI')) return 'ZUCAMI';
  if (norm.includes('SALMET')) return 'SALMET';
  if (norm.includes('PISO')) return 'GRANJAS PISO';
  if (norm.includes('ROBLE')) return 'EL ROBLE';
  return norm || 'ZUCAMI';
}

/**
 * Generates standard header columns for a given form zone,
 * including all "NUEVA ENTREGA" questions and all "PRUEBA CON CARGA" questions at the right.
 */
export function getHeadersForZone(zone: ZoneType | string): string[] {
  const standardHeaders = [
    'Código Acta',
    'Zona / Sistema',
    'Granja',
    'Galpón',
    'Tipo de Jaula',
    'No. OT MP / MANTENIMIENTO',
    'Fecha de inicio del mantenimiento',
    'Días de mantenimiento programados:',
    'Fecha de inicio + días programados:',
    'Fecha de finalización:',
    'Fecha de finalización al 100%:',
    'Fecha de entrega de vacio a producción:',
    'Fecha prueba con carga:',
    'Días de vacio sanitario:',
    'Fecha de Evaluación:',
    'Evaluador / Diligenciado Por:',
    'Supervisor / Recibido Por:',
    'Calificación General (%):',
    'Estado:',
    'Ítems Cumple / Total:',
    'Observaciones Generales:',
  ];

  const templateSections = getFormSections(zone);
  const questionHeaders: string[] = [];

  templateSections.forEach((sec) => {
    sec.items.forEach((item, idx) => {
      // Clean and descriptive header e.g. "1. [SILOS] Pintura General..."
      const cleanedQuestion = item.question.replace(/^\d+[\.\)]\s*/, '').trim();
      const numPrefix = item.question.match(/^\d+/)?.[0] || `${idx + 1}`;
      
      const scoreHeader = `${numPrefix}. [${sec.title}] ${cleanedQuestion}*`;
      const obsHeader = `${numPrefix}. [${sec.title}] OBSERVACIONES: ${cleanedQuestion}`;

      questionHeaders.push(scoreHeader);
      questionHeaders.push(obsHeader);
    });
  });

  // PRUEBA CON CARGA divider column + reliability systems questions
  const pruebaCargaDivider = 'PRUEBA CON CARGA';
  const pruebaCargaMetaHeaders = [
    'PC - Fecha Realización',
    'PC - % Confiabilidad',
    'PC - Total Fallas Reportadas',
    'PC - Observaciones / Conclusiones Generales'
  ];

  const pruebaCargaTemplate = getPruebaConCargaTemplate();
  const pruebaCargaQuestionHeaders: string[] = [];

  pruebaCargaTemplate.forEach((sec) => {
    sec.items.forEach((item, idx) => {
      const qTitle = item.question.trim();
      const failHeader = `PC - ${idx + 1}. [FALLAS] ${qTitle}`;
      const obsHeader = `PC - ${idx + 1}. [OBSERVACIONES] ${qTitle}`;
      pruebaCargaQuestionHeaders.push(failHeader);
      pruebaCargaQuestionHeaders.push(obsHeader);
    });
  });

  return [
    ...standardHeaders,
    ...questionHeaders,
    pruebaCargaDivider,
    ...pruebaCargaMetaHeaders,
    ...pruebaCargaQuestionHeaders,
  ];
}

/**
 * Converts a report (and its associated PRUEBA CON CARGA data) into a 1D array of values matching the header columns
 */
export function reportToRowValues(report: EvaluationReport): (string | number)[] {
  const row: (string | number)[] = [
    report.code || report.id,
    report.zone,
    report.farm || '',
    report.galpon || '',
    report.cageType || '',
    report.numeroOtMp || '',
    formatDateDDMMYYYY(report.fechaInicioMantenimiento),
    report.diasMantenimientoProgramados ?? '',
    formatDateDDMMYYYY(report.fechaInicioMasDiasProgramados),
    formatDateDDMMYYYY(report.fechaFinalizacion),
    formatDateDDMMYYYY(report.fechaFinalizacion100),
    formatDateDDMMYYYY(report.fechaEntregaVacioProduccion),
    formatDateDDMMYYYY(report.fechaPruebaConCarga || report.pruebaConCarga?.fechaPruebaConCarga),
    report.diasVacioSanitario ?? '',
    formatDateDDMMYYYY(report.evaluationDate || report.createdAt),
    report.evaluadorNombre || '',
    report.supervisorNombre || '',
    `${report.totalScore}%`,
    report.status || '',
    `${report.passedItems} / ${report.totalItems}`,
    report.notes || '',
  ];

  // Map all question answers by matching template questions for Entrega en Vacio
  const templateSections = getFormSections(report.zone);

  // Build a lookup map of report items
  const reportItemMap = new Map<string, { status: string; score?: number; observation?: string }>();
  if (report.sections) {
    report.sections.forEach((sec) => {
      sec.items.forEach((it) => {
        const key = it.question.toLowerCase().trim();
        reportItemMap.set(key, {
          status: it.status,
          score: it.score,
          observation: it.observation,
        });
      });
    });
  }

  templateSections.forEach((sec) => {
    sec.items.forEach((tmplItem) => {
      const key = tmplItem.question.toLowerCase().trim();
      const match = reportItemMap.get(key);

      if (!match) {
        row.push('N/A');
        row.push('');
      } else {
        let scoreVal = '';
        if (match.score !== undefined && match.score !== null) {
          scoreVal = `${match.score}%`;
        } else if (match.status === 'cumple') {
          scoreVal = '100%';
        } else if (match.status === 'no_cumple') {
          scoreVal = '0%';
        } else {
          scoreVal = 'N/A';
        }

        const obsVal = match.observation ? match.observation.trim() : '';

        row.push(scoreVal);
        row.push(obsVal);
      }
    });
  });

  // Append PRUEBA CON CARGA divider and data into the same row
  const pc = report.pruebaConCarga || (report.reportType === 'PRUEBAS_CARGA' ? {
    completed: true,
    completedAt: report.evaluationDate,
    fechaPruebaConCarga: report.fechaPruebaConCarga || report.evaluationDate,
    totalScore: report.totalScore,
    totalFailures: report.totalFailures ?? (report.sections?.reduce((acc, s) => acc + s.items.reduce((a, it) => a + (it.failuresCount || 0), 0), 0) ?? 0),
    notes: report.notes,
    sections: report.sections,
    signatures: report.signatures,
  } : undefined);
  const isPcCompleted = !!(pc && (pc.completed || pc.sections));

  // 1. Column "PRUEBA CON CARGA"
  row.push(isPcCompleted ? 'COMPLETADA' : 'PENDIENTE');

  // 2. PC Meta Headers
  if (isPcCompleted && pc) {
    row.push(formatDateDDMMYYYY(pc.fechaPruebaConCarga || pc.completedAt));
    row.push(pc.totalScore !== undefined ? `${pc.totalScore}%` : '100%');
    row.push(pc.totalFailures ?? 0);
    row.push(pc.notes || '');
  } else {
    row.push('');
    row.push('');
    row.push('');
    row.push('');
  }

  // 3. PC Questions and Observaciones
  const pcTemplate = getPruebaConCargaTemplate();
  const pcItemMap = new Map<string, { failuresCount?: number; observation?: string }>();
  if (isPcCompleted && pc?.sections) {
    pc.sections.forEach((s) => {
      s.items.forEach((it) => {
        const key = it.question.toLowerCase().trim();
        pcItemMap.set(key, {
          failuresCount: it.failuresCount ?? 0,
          observation: it.observation || '',
        });
      });
    });
  }

  pcTemplate.forEach((s) => {
    s.items.forEach((tmplIt) => {
      const key = tmplIt.question.toLowerCase().trim();
      const match = pcItemMap.get(key);

      if (!isPcCompleted || !match) {
        row.push('');
        row.push('');
      } else {
        row.push(match.failuresCount ?? 0);
        row.push(match.observation ? match.observation.trim() : '');
      }
    });
  });

  return row;
}

export const ALL_SHEET_TABS: { zone: ZoneType; tabName: string }[] = [
  { zone: 'ZUCAMI', tabName: 'ZUCAMI' },
  { zone: 'SALMET', tabName: 'SALMET' },
  { zone: 'GRANJAS PISO', tabName: 'GRANJAS PISO' },
  { zone: 'EL ROBLE', tabName: 'EL ROBLE' },
];

/**
 * Ensures the target sheet tab exists inside the spreadsheet.
 * If not, creates it via Google Sheets batchUpdate.
 */
async function ensureSheetTabExists(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<number> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    if (metaRes.status === 401) {
      clearGoogleToken();
    }
    const err = await metaRes.text();
    throw new Error(`Error al verificar hojas del documento (${metaRes.status}): ${err}`);
  }

  const metaData = await metaRes.json();
  const sheets: { properties: { sheetId: number; title: string } }[] = metaData.sheets || [];
  const cleanTarget = tabName.trim().toUpperCase();
  const existing = sheets.find((s) => s.properties.title.trim().toUpperCase() === cleanTarget);

  if (existing) {
    return existing.properties.sheetId;
  }

  // Create new tab with ample columns for questions and observations
  const addRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
                gridProperties: {
                  rowCount: 500,
                  columnCount: 200,
                  frozenRowCount: 1,
                },
              },
            },
          },
        ],
      }),
    }
  );

  if (!addRes.ok) {
    const err = await addRes.text();
    throw new Error(`Error al crear la pestaña "${tabName}" en Google Sheets: ${err}`);
  }

  const addData = await addRes.json();
  const newSheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId || 0;
  return newSheetId;
}

function normalizeHeaderKey(header: string): string {
  return (header || '').toString().trim().toUpperCase().replace(/\s+/g, ' ');
}

function stripHeaderNumberPrefix(header: string): string {
  return normalizeHeaderKey(header)
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isObservationHeader(header: string): boolean {
  const norm = normalizeHeaderKey(header);
  return norm.includes('OBSERVACIONES:') || norm.includes('[OBSERVACIONES]');
}

/**
 * Updates Row 1 (Title Header) for a specific tab in the Google Spreadsheet
 * AND migrates/realigns all existing data rows (Rows 2..N) whenever columns are
 * added, deleted, or reordered so historical data stays under its exact column.
 */
export async function updateTabHeaderRow(
  spreadsheetId: string,
  tabName: string,
  zone: ZoneType | string,
  accessToken: string
): Promise<{ success: boolean; sheetId: number; columnCount: number }> {
  // 1. Ensure sheet tab exists
  const sheetId = await ensureSheetTabExists(spreadsheetId, tabName, accessToken);

  // 2. Get full target header array (Standard meta headers + each Question + each OBSERVACIONES + PRUEBA CON CARGA)
  const newHeaders = getHeadersForZone(zone);

  // 3. Read current sheet contents (Row 1 headers + all existing data rows)
  let allExistingValues: string[][] = [];
  try {
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:ZZ`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (readRes.status === 401) {
      clearGoogleToken();
      throw new Error('Error de autorización (401): sesión expirada.');
    }
    if (readRes.ok) {
      const readData = await readRes.json();
      allExistingValues = (readData.values || []) as string[][];
    }
  } catch (e: any) {
    if (e?.message?.includes('401')) throw e;
    console.warn(`Could not read existing rows for ${tabName}:`, e);
  }

  const oldHeaders: string[] =
    allExistingValues.length > 0
      ? (allExistingValues[0] || []).map((h) => (h ?? '').toString())
      : [];
  const oldDataRows = allExistingValues.length > 1 ? allExistingValues.slice(1) : [];

  const headersMatchExactly =
    oldHeaders.length === newHeaders.length &&
    newHeaders.every((h, i) => normalizeHeaderKey(oldHeaders[i] || '') === normalizeHeaderKey(h));

  const targetWidth = Math.max(newHeaders.length, oldHeaders.length);

  // 4. Ensure grid has enough columns & rows
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    columnCount: Math.max(targetWidth + 15, 200),
                    rowCount: Math.max(allExistingValues.length + 50, 500),
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties(columnCount,rowCount,frozenRowCount)',
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.warn(`Could not expand columns for ${tabName}:`, e);
  }

  if (oldHeaders.length === 0) {
    // Brand new / empty tab: just write Row 1 headers
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!1:1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [newHeaders],
        }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      throw new Error(`Error al actualizar fila de encabezados en "${tabName}": ${err}`);
    }
  } else if (!headersMatchExactly) {
    // 5. Headers changed (activity added, deleted, or reordered) -> migrate ALL existing rows cleanly
    const colMapping = new Array<number>(newHeaders.length).fill(-1);
    const usedOldCols = new Set<number>();

    // Pass 1: exact normalized header match
    for (let newIdx = 0; newIdx < newHeaders.length; newIdx++) {
      const targetNorm = normalizeHeaderKey(newHeaders[newIdx]);
      const foundIdx = oldHeaders.findIndex(
        (oh, idx) => !usedOldCols.has(idx) && normalizeHeaderKey(oh) === targetNorm
      );
      if (foundIdx !== -1) {
        colMapping[newIdx] = foundIdx;
        usedOldCols.add(foundIdx);
      }
    }

    // Pass 2: number-prefix-stripped match (preserves data when an earlier item in a section is added/deleted and numbers shift)
    for (let newIdx = 0; newIdx < newHeaders.length; newIdx++) {
      if (colMapping[newIdx] !== -1) continue;
      const targetStripped = stripHeaderNumberPrefix(newHeaders[newIdx]);
      const targetIsObs = isObservationHeader(newHeaders[newIdx]);
      const foundIdx = oldHeaders.findIndex(
        (oh, idx) =>
          !usedOldCols.has(idx) &&
          stripHeaderNumberPrefix(oh) === targetStripped &&
          isObservationHeader(oh) === targetIsObs
      );
      if (foundIdx !== -1) {
        colMapping[newIdx] = foundIdx;
        usedOldCols.add(foundIdx);
      }
    }

    const oldPcIdx = oldHeaders.findIndex((h) => {
      const n = normalizeHeaderKey(h);
      return n === 'PRUEBA CON CARGA' || n === 'PRUEBA CON CARGA (CON AVES)';
    });
    const newPcIdx = newHeaders.findIndex((h) => {
      const n = normalizeHeaderKey(h);
      return n === 'PRUEBA CON CARGA' || n === 'PRUEBA CON CARGA (CON AVES)';
    });

    const migratedRows: string[][] = oldDataRows.map((oldRow) => {
      const migratedRow = new Array<string>(targetWidth).fill('');

      // Self-healing check for rows that were left at an older column offset before this fix
      let alreadyAlignedAtNewPc = false;
      if (oldPcIdx !== -1 && newPcIdx !== -1 && oldPcIdx !== newPcIdx) {
        const valAtOldPc = (oldRow[oldPcIdx] || '').toString().trim().toUpperCase();
        const valAtNewPc = (oldRow[newPcIdx] || '').toString().trim().toUpperCase();
        const hasDataAfterOldPc = oldRow
          .slice(oldPcIdx + 1)
          .some((cell) => (cell || '').toString().trim() !== '');

        if (
          valAtOldPc === '' &&
          !hasDataAfterOldPc &&
          (valAtNewPc === 'PENDIENTE' || valAtNewPc === 'COMPLETADA')
        ) {
          alreadyAlignedAtNewPc = true;
        }
      }

      if (alreadyAlignedAtNewPc) {
        for (let i = 0; i < newHeaders.length && i < oldRow.length; i++) {
          migratedRow[i] = (oldRow[i] ?? '').toString();
        }
      } else {
        for (let newIdx = 0; newIdx < newHeaders.length; newIdx++) {
          const oldIdx = colMapping[newIdx];
          if (oldIdx !== -1 && oldIdx < oldRow.length) {
            migratedRow[newIdx] = (oldRow[oldIdx] ?? '').toString();
          }
        }
      }

      return migratedRow;
    });

    const paddedNewHeaders = new Array<string>(targetWidth).fill('');
    for (let i = 0; i < newHeaders.length; i++) {
      paddedNewHeaders[i] = newHeaders[i];
    }

    const payloadRows = [paddedNewHeaders, ...migratedRows];
    const writeTableRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: payloadRows,
        }),
      }
    );

    if (!writeTableRes.ok) {
      const err = await writeTableRes.text();
      throw new Error(`Error al migrar columnas y filas en "${tabName}": ${err}`);
    }

    // Clear trailing blue header styling if columns were removed
    if (oldHeaders.length > newHeaders.length) {
      try {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [
                {
                  repeatCell: {
                    range: {
                      sheetId,
                      startRowIndex: 0,
                      endRowIndex: 1,
                      startColumnIndex: newHeaders.length,
                      endColumnIndex: oldHeaders.length,
                    },
                    cell: {
                      userEnteredFormat: {},
                    },
                    fields: 'userEnteredFormat',
                  },
                },
              ],
            }),
          }
        );
      } catch (e) {
        console.warn(`Could not clear trailing header styling in ${tabName}:`, e);
      }
    }
  }

  // 6. Apply blue corporate styling to Row 1 (if headers were written/changed or empty tab)
  if (oldHeaders.length === 0 || !headersMatchExactly) {
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: newHeaders.length,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.086, green: 0.165, blue: 0.502 }, // Corporate blue #162a78
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                      wrapStrategy: 'WRAP',
                      textFormat: {
                        foregroundColor: { red: 1, green: 1, blue: 1 },
                        bold: true,
                        fontSize: 10,
                      },
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
                },
              },
            ],
          }),
        }
      );
    } catch (e) {
      console.warn('Could not format header style in Google Sheets:', e);
    }
  }

  return { success: true, sheetId, columnCount: newHeaders.length };
}

/**
 * Updates Row 1 (Title Header rows) and migrates existing rows if needed
 * across ALL 4 core form tabs (ZUCAMI, SALMET, GRANJAS PISO, EL ROBLE)
 * as well as any custom farm tabs that already exist in the spreadsheet.
 */
export async function updateAllFormsHeaders(
  customToken?: string
): Promise<{ success: boolean; updatedTabs: string[]; errors: string[] }> {
  const token = customToken || (await getValidAccessToken(true));
  if (!token) {
    throw new Error('Debes iniciar sesión con Google para actualizar los encabezados.');
  }

  const spreadsheetId = getSpreadsheetId();
  const updatedTabs: string[] = [];
  const errors: string[] = [];

  const tabsToUpdate: { zone: string; tabName: string }[] = [...ALL_SHEET_TABS];

  // Include any existing custom farm tabs in the spreadsheet
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      const existingTitles = new Set<string>(
        (metaData.sheets || []).map((s: any) => (s.properties?.title || '').trim().toUpperCase())
      );
      const defaultTabNames = new Set(ALL_SHEET_TABS.map((t) => t.tabName.toUpperCase()));

      getAvailableForms().forEach((f) => {
        const customTab = f.name.trim().toUpperCase();
        if (!f.isDefault && !defaultTabNames.has(customTab) && existingTitles.has(customTab)) {
          tabsToUpdate.push({ zone: f.name, tabName: customTab });
        }
      });
    }
  } catch (e) {
    console.warn('Could not inspect custom farm tabs during header update:', e);
  }

  for (const item of tabsToUpdate) {
    try {
      await updateTabHeaderRow(spreadsheetId, item.tabName, item.zone, token);
      updatedTabs.push(item.tabName);
    } catch (err: any) {
      console.error(`Error updating headers for tab ${item.tabName}:`, err);
      errors.push(`${item.tabName}: ${err?.message || err}`);
    }
  }

  return {
    success: errors.length === 0,
    updatedTabs,
    errors,
  };
}

/**
 * Searches for a row in a specific tab matching the report code in column A.
 * Returns the 1-based row index (e.g. 2 for the second row), or null if not found.
 */
export async function findRowIndexByReportCode(
  spreadsheetId: string,
  tabName: string,
  reportCode: string,
  accessToken: string
): Promise<number | null> {
  try {
    if (!reportCode || !reportCode.trim()) return null;
    const cleanTarget = reportCode.trim().toUpperCase();

    // Fetch column A (where Código Acta is stored)
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:A`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const values = data.values as string[][] | undefined;
    if (!values || values.length === 0) return null;

    for (let i = 0; i < values.length; i++) {
      const cellVal = (values[i][0] || '').toString().trim().toUpperCase();
      if (cellVal === cleanTarget) {
        return i + 1; // 1-based index (Row 1 is headers, Row 2 is first data row)
      }
    }
    return null;
  } catch (e) {
    console.warn(`Could not search row for code ${reportCode} in ${tabName}:`, e);
    return null;
  }
}

/**
 * Exports or updates a report into its corresponding zone tab in Google Sheets.
 * - If the report code already exists in that tab, it performs a PUT update on that exact row.
 * - If report.parentReportCode is provided and matches an existing row, it updates that parent row with the merged data.
 * - If not found, it appends a new row.
 */
export async function exportReportToGoogleSheet(
  report: EvaluationReport,
  customToken?: string
): Promise<{ success: boolean; message: string }> {
  const executeExport = async (token: string): Promise<{ success: boolean; message: string }> => {
    const spreadsheetId = getSpreadsheetId();
    const tabName = getSheetTabNameForZone(report.zone);

    // 1. Ensure tab exists and Row 1 headers (questions + observaciones + PRUEBA CON CARGA) are in place
    await updateTabHeaderRow(spreadsheetId, tabName, report.zone, token);

    // 2. Prepare row values matching all columns
    const rowValues = reportToRowValues(report);

    // 3. Check if this report or its parent report already has a row in the sheet
    const lookupCode = report.parentReportCode || report.code;
    const existingRowIndex = await findRowIndexByReportCode(spreadsheetId, tabName, lookupCode, token);

    if (existingRowIndex && existingRowIndex > 1) {
      // Update existing row
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A${existingRowIndex}:ZZ${existingRowIndex}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [rowValues],
          }),
        }
      );

      if (!updateRes.ok) {
        if (updateRes.status === 401) clearGoogleToken();
        const err = await updateRes.text();
        throw new Error(`Error al actualizar la fila ${existingRowIndex} en Google Sheets (${updateRes.status}): ${err}`);
      }

      // Sync and backup signatures
      if (report.signatures && report.signatures.length > 0) {
        saveReportSignatures(report.code, report.id, report.signatures, report.emailSentTo, report.notes);
        saveReportSignaturesToGoogleSheet(report, token).catch((e) =>
          console.warn('Background signatures sync failed:', e)
        );
      }

      // Mark as synced
      try {
        const syncedKey = 'kikes_synced_reports_set';
        const raw = localStorage.getItem(syncedKey);
        const set = new Set(raw ? JSON.parse(raw) : []);
        set.add(report.id);
        set.add(report.code);
        if (report.parentReportCode) set.add(report.parentReportCode);
        localStorage.setItem(syncedKey, JSON.stringify(Array.from(set)));
      } catch (e) {}

      return {
        success: true,
        message: `Acta ${lookupCode} actualizada exitosamente en la fila ${existingRowIndex} de la pestaña "${tabName}".`,
      };
    }

    // 4. Otherwise Append a new row
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:ZZ:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowValues],
        }),
      }
    );

    if (!appendRes.ok) {
      if (appendRes.status === 401) clearGoogleToken();
      const err = await appendRes.text();
      throw new Error(`Error al insertar fila en Google Sheets (${appendRes.status}): ${err}`);
    }

    // Sync and backup signatures
    if (report.signatures && report.signatures.length > 0) {
      saveReportSignatures(report.code, report.id, report.signatures, report.emailSentTo, report.notes);
      saveReportSignaturesToGoogleSheet(report, token).catch((e) =>
        console.warn('Background signatures sync failed:', e)
      );
    }

    // Mark in localStorage that this report ID is exported
    try {
      const syncedKey = 'kikes_synced_reports_set';
      const raw = localStorage.getItem(syncedKey);
      const set = new Set(raw ? JSON.parse(raw) : []);
      set.add(report.id);
      set.add(report.code);
      localStorage.setItem(syncedKey, JSON.stringify(Array.from(set)));
    } catch (e) {}

    return {
      success: true,
      message: `Acta ${report.code} guardada exitosamente en la pestaña "${tabName}" de Google Sheets.`,
    };
  };

  try {
    // If customToken wasn't explicitly passed and no cached Google OAuth token exists,
    // prefer the Apps Script server bridge automatically when enabled (works for all Viewer users with no popup).
    let token: string | null = customToken || getCachedGoogleToken();
    if (!token) {
      const bridgeSupported = await checkAppsScriptSupportsSheetsWrite();
      if (bridgeSupported) {
        const bridgeRes = await exportReportViaAppsScriptBridge(report);
        if (bridgeRes.success) return bridgeRes;
      }
      try {
        token = await getValidAccessToken(true);
      } catch (authErr: any) {
        if (localStorage.getItem('apps_script_supports_sheets_write') === '1') {
          const bridgeRes = await exportReportViaAppsScriptBridge(report);
          if (bridgeRes.success) return bridgeRes;
        }
        const errCode = authErr?.code || authErr?.message || '';
        if (errCode.includes('popup-closed-by-user')) {
          return {
            success: false,
            message: 'Se cerró la ventana de inicio de sesión con Google antes de completar la autorización.',
          };
        }
        if (errCode.includes('popup-blocked')) {
          return {
            success: false,
            message: 'El navegador bloqueó la ventana de Google. Permita ventanas emergentes e intente de nuevo.',
          };
        }
        if (errCode.includes('unauthorized-domain') || errCode.includes('access_denied')) {
          return {
            success: false,
            message: 'Esta cuenta o dominio no tiene autorización OAuth directa para escribir en Google Sheets.',
          };
        }
        return {
          success: false,
          message: authErr?.message || 'No se pudo iniciar sesión con Google para guardar en la base de datos.',
        };
      }
    }

    if (!token) {
      if (localStorage.getItem('apps_script_supports_sheets_write') === '1') {
        const bridgeRes = await exportReportViaAppsScriptBridge(report);
        if (bridgeRes.success) return bridgeRes;
      }
      return { success: false, message: 'No se cuenta con autorización de Google Sheets.' };
    }

    try {
      return await executeExport(token);
    } catch (firstErr: any) {
      if (!customToken && (firstErr?.message?.includes('(401)') || firstErr?.message?.includes('401'))) {
        clearGoogleToken();
        try {
          const refreshedToken = await authenticateWithGoogle();
          if (refreshedToken) {
            return await executeExport(refreshedToken);
          }
        } catch (reauthErr: any) {
          if (localStorage.getItem('apps_script_supports_sheets_write') === '1') {
            const bridgeRes = await exportReportViaAppsScriptBridge(report);
            if (bridgeRes.success) return bridgeRes;
          }
          throw reauthErr;
        }
      }
      if (firstErr?.message?.includes('(403)') || firstErr?.message?.includes('403')) {
        if (localStorage.getItem('apps_script_supports_sheets_write') === '1') {
          const bridgeRes = await exportReportViaAppsScriptBridge(report);
          if (bridgeRes.success) return bridgeRes;
        }
        return {
          success: false,
          message: 'Tu cuenta de Google no tiene permisos de Editor en la hoja de cálculo para registrar datos.',
        };
      }
      throw firstErr;
    }
  } catch (err: any) {
    console.error('Error exporting report to Google Sheets:', err);
    return {
      success: false,
      message: err?.message || 'Error desconocido al exportar a Google Sheets.',
    };
  }
}

export function markReportAsSynced(report: EvaluationReport): void {
  try {
    if (report.signatures && report.signatures.length > 0) {
      saveReportSignatures(report.code, report.id, report.signatures, report.emailSentTo, report.notes);
    }
    const syncedKey = 'kikes_synced_reports_set';
    const raw = localStorage.getItem(syncedKey);
    const set = new Set(raw ? JSON.parse(raw) : []);
    if (report.id) set.add(report.id);
    if (report.code) set.add(report.code);
    if (report.parentReportCode) set.add(report.parentReportCode);
    localStorage.setItem(syncedKey, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

const NEW_BRIDGE_SCRIPT_ID = 'AKfycbxLs1eWLPqTQbKUSxhPfs8NdO-tO8wiDhUg40Et09Fy4bPC_onHvRjYX-Tf1bMce1i8Tw';
const NEW_BRIDGE_SCRIPT_URL = `https://script.google.com/a/macros/kikes.com.co/s/${NEW_BRIDGE_SCRIPT_ID}/exec`;

function resolveActiveAppsScriptUrl(): string {
  try {
    const saved = localStorage.getItem('apps_script_url');
    if (
      !saved ||
      saved.includes('AKfycbyPI-oPCVtFWbLgl2f0wjPhyy9f4MM-p_4c8i_yj7QNoWV69lu2CAglwzsfSkQfhkfK8A') ||
      saved === `https://script.google.com/macros/s/${NEW_BRIDGE_SCRIPT_ID}/exec`
    ) {
      safeLocalStorageSet('apps_script_url', NEW_BRIDGE_SCRIPT_URL);
      return NEW_BRIDGE_SCRIPT_URL;
    }
    return saved;
  } catch {
    return NEW_BRIDGE_SCRIPT_URL;
  }
}

export async function checkAppsScriptSupportsSheetsWrite(forceRefresh: boolean = false): Promise<boolean> {
  try {
    const scriptUrl = resolveActiveAppsScriptUrl();
    if (scriptUrl.includes(NEW_BRIDGE_SCRIPT_ID)) {
      safeLocalStorageSet('apps_script_supports_sheets_write', '1');
      return true;
    }
    if (!forceRefresh && localStorage.getItem('apps_script_supports_sheets_write') === '1') {
      return true;
    }
    const lastCheckRaw = localStorage.getItem('apps_script_cap_checked_at');
    if (!forceRefresh && lastCheckRaw) {
      const elapsed = Date.now() - parseInt(lastCheckRaw, 10);
      if (!isNaN(elapsed) && elapsed < 120000) {
        return localStorage.getItem('apps_script_supports_sheets_write') === '1';
      }
    }

    const res = await fetch('/api/apps-script-capabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl }),
    });
    const json = await res.json();
    safeLocalStorageSet('apps_script_cap_checked_at', Date.now().toString());
    if (json?.supportsSheetsWrite === true) {
      safeLocalStorageSet('apps_script_supports_sheets_write', '1');
      return true;
    }
    return false;
  } catch {
    return localStorage.getItem('apps_script_supports_sheets_write') === '1';
  }
}

export async function exportReportViaAppsScriptBridge(
  report: EvaluationReport
): Promise<{ success: boolean; message: string }> {
  try {
    const scriptUrl = resolveActiveAppsScriptUrl();

    const payload = {
      action: 'saveReportToSheet',
      sheetSyncData: {
        spreadsheetId: getSpreadsheetId(),
        tabName: getSheetTabNameForZone(report.zone),
        reportCode: report.parentReportCode || report.code,
        headers: getHeadersForZone(report.zone),
        rowValues: reportToRowValues(report),
        signaturesMeta: {
          code: report.code,
          signaturesJson: JSON.stringify(report.signatures || []),
          emailSentTo: (report.emailSentTo || []).join(', '),
          notes: report.notes || '',
        },
      },
    };

    const res = await fetch('/api/trigger-apps-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl, payload }),
    });
    const json = await res.json();
    if (json.success && json.data?.savedToSheet === true) {
      safeLocalStorageSet('apps_script_supports_sheets_write', '1');
      markReportAsSynced(report);
      return {
        success: true,
        message: json.data?.sheetMessage || `Acta ${report.code} guardada en Google Sheets.`,
      };
    }

    // Fallback for Google Workspace scripts restricted to @kikes.com.co users:
    // Submit via hidden iframe form POST carrying the user's active Google Workspace cookies
    if (scriptUrl.includes(NEW_BRIDGE_SCRIPT_ID)) {
      await new Promise<void>((resolve) => {
        const iframeName = 'gas_sheet_iframe_' + Date.now();
        const iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = scriptUrl;
        form.target = iframeName;

        const payloadInput = document.createElement('input');
        payloadInput.type = 'hidden';
        payloadInput.name = 'payload';
        payloadInput.value = JSON.stringify(payload);
        form.appendChild(payloadInput);

        document.body.appendChild(form);

        let finished = false;
        const cleanup = () => {
          if (finished) return;
          finished = true;
          setTimeout(() => {
            try { document.body.removeChild(form); } catch (e) {}
            try { document.body.removeChild(iframe); } catch (e) {}
            resolve();
          }, 800);
        };

        iframe.onload = cleanup;
        form.submit();
        setTimeout(cleanup, 7000);
      });

      safeLocalStorageSet('apps_script_supports_sheets_write', '1');
      markReportAsSynced(report);
      return {
        success: true,
        message: `Acta ${report.code} enviada a Google Sheets mediante Google Apps Script.`,
      };
    }

    return {
      success: false,
      message: json.message || 'El script de servidor aún no tiene habilitada la escritura en Google Sheets.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error al guardar en Google Sheets vía servidor.',
    };
  }
}

/**
 * Helper to fetch headers and rows from a single Google Sheet tab
 * Supports both authenticated Google Sheets REST API and public Google Visualization Query API
 */
async function fetchRowsFromTab(
  spreadsheetId: string,
  tabName: string,
  token?: string | null
): Promise<{ headers: string[]; rows: string[][] }> {
  // Strategy 1: REST API with OAuth token if available
  if (token) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:ZZ500`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 401) {
        clearGoogleToken();
      } else if (res.ok) {
        const data = await res.json();
        const rawRows: string[][] = data.values || [];
        if (rawRows.length > 0) {
          return {
            headers: rawRows[0].map((h) => (h || '').toString().trim().toUpperCase()),
            rows: rawRows.slice(1),
          };
        }
      }
    } catch (e) {
      console.warn(`REST fetch failed for tab ${tabName}, trying query endpoint:`, e);
    }
  }

  // Strategy 2: Google Sheets Visualization Query API (works for any shared/accessible sheet)
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
    const gvizRes = await fetch(gvizUrl);
    if (gvizRes.ok) {
      const text = await gvizRes.text();
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const json = JSON.parse(text.substring(firstBrace, lastBrace + 1));
        const cols = json.table?.cols || [];
        const colLabels: string[] = cols.map((c: any) => (c?.label || '').toString().trim().toUpperCase());
        const rawGvizRows = json.table?.rows || [];

        const parsedRows: string[][] = rawGvizRows.map((r: any) => {
          const cells = r.c || [];
          return cells.map((cell: any) => {
            if (!cell) return '';
            if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
            if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
            return '';
          });
        });

        let finalHeaders = colLabels;
        let finalDataRows = parsedRows;

        const hasColLabels = colLabels.some((lbl) => lbl && lbl.length > 0);
        if (!hasColLabels && parsedRows.length > 0) {
          finalHeaders = parsedRows[0].map((h) => (h || '').toUpperCase());
          finalDataRows = parsedRows.slice(1);
        }

        return {
          headers: finalHeaders,
          rows: finalDataRows,
        };
      }
    }
  } catch (e) {
    console.warn(`Gviz fetch failed for tab ${tabName}:`, e);
  }

  return { headers: [], rows: [] };
}

/**
 * Imports/Fetches all reports from all tabs in Google Sheets
 */
export async function importReportsFromGoogleSheets(
  customToken?: string,
  promptIfMissing: boolean = false
): Promise<{ success: boolean; reports: EvaluationReport[]; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token && promptIfMissing && localStorage.getItem('apps_script_supports_sheets_write') !== '1') {
      try {
        token = await authenticateWithGoogle();
      } catch {
        token = null;
      }
    }

    const spreadsheetId = getSpreadsheetId();
    const importedReports: EvaluationReport[] = [];

    // Load cloud signatures map to merge into imported reports
    let cloudSignaturesMap = new Map<string, { signatures: Signature[]; emailSentTo: string[] }>();
    try {
      cloudSignaturesMap = await importReportSignaturesFromGoogleSheets(token || undefined);
    } catch (e) {
      console.warn('Could not load signatures map from sheets:', e);
    }

    const tabsToImport: { zone: ZoneType | string; tabName: string }[] = [...ALL_SHEET_TABS];
    if (token) {
      try {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const existingTitles = new Set<string>(
            (metaData.sheets || []).map((s: any) => (s.properties?.title || '').trim().toUpperCase())
          );
          const defaultTabNames = new Set(ALL_SHEET_TABS.map((t) => t.tabName.toUpperCase()));
          getAvailableForms().forEach((f) => {
            const customTab = f.name.trim().toUpperCase();
            if (!f.isDefault && !defaultTabNames.has(customTab) && existingTitles.has(customTab)) {
              tabsToImport.push({ zone: f.name, tabName: customTab });
            }
          });
        }
      } catch (e) {}
    }

    for (const tabInfo of tabsToImport) {
      try {
        const { headers, rows } = await fetchRowsFromTab(spreadsheetId, tabInfo.tabName, token);
        if (rows.length === 0) continue;

        // Find the PRUEBA CON CARGA divider column (located after evaluation criteria)
        let pcDividerIdx = -1;
        for (let idx = 21; idx < headers.length; idx++) {
          const h = headers[idx];
          if (h === 'PRUEBA CON CARGA' || h === 'PRUEBA CON CARGA (CON AVES)') {
            pcDividerIdx = idx;
            break;
          }
          if (h.includes('PC - FECHA') || h.includes('PC - % CONFIABILIDAD')) {
            pcDividerIdx = Math.max(21, idx - 1);
            break;
          }
        }

        // Fallback search if not found above index 21
        if (pcDividerIdx === -1) {
          const exactIdx = headers.findIndex((h, idx) => idx > 15 && (h === 'PRUEBA CON CARGA' || h === 'PRUEBA CON CARGA (CON AVES)'));
          if (exactIdx !== -1) {
            pcDividerIdx = exactIdx;
          }
        }

        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          const code = (row[0] || '').trim();
          if (!code || code.toUpperCase() === 'CÓDIGO ACTA' || code.toUpperCase() === 'CODIGO ACTA') {
            continue; // Skip empty row or repeated header
          }

          const zone = (row[1] || tabInfo.zone).trim() as ZoneType;
          const farm = (row[2] || '').trim();
          const galpon = (row[3] || '').trim();
          const cageType = (row[4] || 'A').trim() as any;
          const numeroOtMp = (row[5] || '').trim();
          const fechaInicioMantenimiento = (row[6] || '').trim();
          const diasMantenimientoProgramados = row[7] ? parseInt(row[7], 10) : undefined;
          const fechaInicioMasDiasProgramados = (row[8] || '').trim();
          const fechaFinalizacion = (row[9] || '').trim();
          const fechaFinalizacion100 = (row[10] || '').trim();
          const fechaEntregaVacioProduccion = (row[11] || '').trim();
          const fechaPruebaConCarga = (row[12] || '').trim();
          const diasVacioSanitario = row[13] ? parseInt(row[13], 10) : undefined;
          const evaluationDate = (row[14] || new Date().toISOString().split('T')[0]).trim();
          const evaluadorNombre = (row[15] || '').trim();
          const supervisorNombre = (row[16] || '').trim();
          const totalScoreRaw = row[17];
          const status = (row[18] || 'Aprobado').trim();
          const notes = (row[20] || '').trim();

          // Check if PRUEBA CON CARGA columns have completed data
          let pruebaConCargaData: EvaluationReport['pruebaConCarga'] = undefined;
          if (pcDividerIdx !== -1 && row.length > pcDividerIdx) {
            const pcStatusVal = (row[pcDividerIdx] || '').trim().toUpperCase();
            const pcDate = (row[pcDividerIdx + 1] || '').trim();
            const pcScoreStr = (row[pcDividerIdx + 2] || '').trim();
            const pcFailuresStr = (row[pcDividerIdx + 3] || '').trim();
            const pcNotes = (row[pcDividerIdx + 4] || '').trim();

            const isPcDone =
              pcStatusVal === 'COMPLETADA' ||
              (pcStatusVal !== 'PENDIENTE' &&
                pcDate !== '' &&
                pcDate.toUpperCase() !== 'PENDIENTE' &&
                (pcScoreStr !== '' || pcFailuresStr !== ''));

            if (isPcDone) {
              const pcTotalFailures = pcFailuresStr ? parseInt(pcFailuresStr, 10) : 0;
              const pcTemplate = getPruebaConCargaTemplate();
              let pcColPtr = pcDividerIdx + 5;
              let anyParsedFailures = false;

              const parsedPcSections = pcTemplate.map((sec) => {
                const updatedItems = sec.items.map((item) => {
                  let fCount = 0;
                  let obs = '';
                  if (pcColPtr < row.length) {
                    const fVal = (row[pcColPtr] || '').trim();
                    const oVal = (row[pcColPtr + 1] || '').trim();
                    pcColPtr += 2;

                    if (fVal !== '') {
                      const num = parseInt(fVal, 10);
                      if (!isNaN(num)) {
                        fCount = Math.max(0, num);
                        if (fCount > 0) anyParsedFailures = true;
                      }
                    }
                    if (oVal) obs = oVal;
                  }
                  return {
                    ...item,
                    failuresCount: fCount,
                    status: (fCount === 0 ? 'cumple' : 'no_cumple') as ItemStatus,
                    observation: obs || item.observation,
                  };
                });
                return {
                  ...sec,
                  items: updatedItems,
                };
              });

              // Safeguard: If the sheet recorded a totalFailures count (e.g. 7 or 1) but individual item columns were empty
              if (pcTotalFailures > 0 && !anyParsedFailures) {
                let remainingToAssign = pcTotalFailures;
                parsedPcSections.forEach((s) => {
                  s.items.forEach((it) => {
                    if (remainingToAssign > 0) {
                      const assign = 1;
                      it.failuresCount = assign;
                      it.status = 'no_cumple';
                      remainingToAssign -= assign;
                    }
                  });
                });
              }

              pruebaConCargaData = {
                completed: true,
                completedAt: pcDate || evaluationDate,
                fechaPruebaConCarga: pcDate || fechaPruebaConCarga,
                totalScore: parseScoreValue(pcScoreStr, 100),
                totalFailures: isNaN(pcTotalFailures) ? 0 : pcTotalFailures,
                notes: pcNotes,
                sections: parsedPcSections,
              };
            }
          }

          const templateSections = getFormSections(zone);
          let colPtr = 21;
          let parsedAnsweredCount = 0;
          let parsedPassedCount = 0;
          let parsedFailedCount = 0;
          let parsedScoreSum = 0;

          // Build exact + number-stripped header lookups for Entrega en Vacio question columns
          const maxQuestionEnd = pcDividerIdx !== -1 ? pcDividerIdx : headers.length;
          const exactHeaderMap = new Map<string, number>();
          const strippedHeaderMap = new Map<string, number>();
          for (let hIdx = 21; hIdx < maxQuestionEnd; hIdx++) {
            const normH = normalizeHeaderKey(headers[hIdx] || '');
            if (!normH) continue;
            if (!exactHeaderMap.has(normH)) exactHeaderMap.set(normH, hIdx);
            const strippedKey = `${isObservationHeader(normH) ? 'OBS:' : 'SCR:'}${stripHeaderNumberPrefix(normH)}`;
            if (!strippedHeaderMap.has(strippedKey)) strippedHeaderMap.set(strippedKey, hIdx);
          }

          const parsedSections = templateSections.map((sec) => {
            const updatedItems = sec.items.map((item, idx) => {
              let itemScore: number | undefined = undefined;
              let itemObs = '';
              let itemStatus: ItemStatus = 'cumple';

              const cleanedQuestion = item.question.replace(/^\d+[\.\)]\s*/, '').trim();
              const numPrefix = item.question.match(/^\d+/)?.[0] || `${idx + 1}`;
              const expectedScoreHeader = normalizeHeaderKey(`${numPrefix}. [${sec.title}] ${cleanedQuestion}*`);
              const expectedObsHeader = normalizeHeaderKey(`${numPrefix}. [${sec.title}] OBSERVACIONES: ${cleanedQuestion}`);

              let scoreColIdx = exactHeaderMap.get(expectedScoreHeader);
              if (scoreColIdx === undefined) {
                scoreColIdx = strippedHeaderMap.get(`SCR:${stripHeaderNumberPrefix(expectedScoreHeader)}`);
              }

              let obsColIdx = exactHeaderMap.get(expectedObsHeader);
              if (obsColIdx === undefined) {
                obsColIdx = strippedHeaderMap.get(`OBS:${stripHeaderNumberPrefix(expectedObsHeader)}`);
              }

              // Fallback to sequential column pointer if headers aren't present
              if (scoreColIdx === undefined && headers.length <= 21 && colPtr < row.length && (pcDividerIdx === -1 || colPtr < pcDividerIdx)) {
                scoreColIdx = colPtr;
                obsColIdx = colPtr + 1;
              }
              colPtr += 2;

              if (scoreColIdx !== undefined && scoreColIdx < row.length) {
                const cellScoreVal = (row[scoreColIdx] || '').trim();
                const cellObsVal = obsColIdx !== undefined && obsColIdx < row.length ? (row[obsColIdx] || '').trim() : '';

                if (cellScoreVal !== '') {
                  const lower = cellScoreVal.toLowerCase();
                  if (lower.includes('no cumple') || lower === '0' || lower === '0%') {
                    itemScore = 0;
                    itemStatus = 'no_cumple';
                  } else if (lower.includes('cumple')) {
                    itemScore = 100;
                    itemStatus = 'cumple';
                  } else if (lower === 'n/a' || lower === 'na') {
                    itemStatus = 'na';
                  } else {
                    itemScore = parseScoreValue(cellScoreVal, 100);
                    itemStatus = itemScore === 100 ? 'cumple' : 'no_cumple';
                  }
                }
                if (cellObsVal) {
                  itemObs = cellObsVal;
                }
              }

              if (itemScore === undefined) {
                itemScore = item.score !== undefined ? parseScoreValue(item.score, 100) : 100;
              }

              if (itemScore !== undefined) {
                parsedAnsweredCount++;
                parsedScoreSum += itemScore;
                if (itemScore === 100) {
                  parsedPassedCount++;
                } else {
                  parsedFailedCount++;
                }
              }

              return {
                ...item,
                score: itemScore,
                status: itemStatus,
                observation: itemObs || item.observation,
              };
            });

            return {
              ...sec,
              items: updatedItems,
            };
          });

          const totalItemsCount = parsedSections.flatMap((s) => s.items).length || 24;
          const defaultScore = parsedAnsweredCount > 0 ? Math.round(parsedScoreSum / parsedAnsweredCount) : 100;
          const parsedTotalScore = totalScoreRaw !== undefined && totalScoreRaw !== null && String(totalScoreRaw).trim() !== ''
            ? parseScoreValue(totalScoreRaw, defaultScore)
            : defaultScore;

          let passedItems = parsedPassedCount;
          let failedItems = parsedFailedCount;

          if (parsedAnsweredCount === 0) {
            if (parsedTotalScore === 100) {
              passedItems = totalItemsCount;
              failedItems = 0;
            } else {
              passedItems = Math.round((parsedTotalScore / 100) * totalItemsCount);
              failedItems = totalItemsCount - passedItems;
            }
          }

          const rawReport: EvaluationReport = {
            id: `sheet-${code}`,
            code: code,
            reportType: 'ENTREGAS_VACIO',
            zone: zone,
            farm: farm,
            galpon: galpon,
            cageType: cageType,
            numeroOtMp: numeroOtMp,
            fechaInicioMantenimiento: fechaInicioMantenimiento,
            diasMantenimientoProgramados: diasMantenimientoProgramados,
            fechaInicioMasDiasProgramados: fechaInicioMasDiasProgramados,
            fechaFinalizacion: fechaFinalizacion,
            fechaFinalizacion100: fechaFinalizacion100,
            fechaEntregaVacioProduccion: fechaEntregaVacioProduccion,
            fechaPruebaConCarga: fechaPruebaConCarga || pruebaConCargaData?.fechaPruebaConCarga,
            diasVacioSanitario: diasVacioSanitario,
            evaluationDate: evaluationDate,
            evaluadorId: 'sheet-import',
            evaluadorNombre: evaluadorNombre || 'Evaluador Registrado',
            supervisorId: 'sheet-import',
            supervisorNombre: supervisorNombre || 'Supervisor Registrado',
            totalScore: parsedTotalScore,
            totalItems: totalItemsCount,
            passedItems: passedItems,
            failedItems: failedItems,
            naItems: 0,
            status: status,
            signatures: (() => {
              const cleanCode = code.toUpperCase();
              const cloudSigData = cloudSignaturesMap.get(cleanCode);
              const localSigs = getReportSignatures(code, `sheet-${code}`);
              if (cloudSigData?.signatures && cloudSigData.signatures.length > 0) {
                return cloudSigData.signatures;
              }
              if (localSigs && localSigs.length > 0) {
                return localSigs;
              }
              return [];
            })(),
            emailSentTo: (() => {
              const cleanCode = code.toUpperCase();
              const cloudSigData = cloudSignaturesMap.get(cleanCode);
              const localEmails = getReportEmails(code, `sheet-${code}`);
              if (cloudSigData?.emailSentTo && cloudSigData.emailSentTo.length > 0) {
                return cloudSigData.emailSentTo;
              }
              if (localEmails && localEmails.length > 0) {
                return localEmails;
              }
              return [];
            })(),
            notes: notes,
            createdAt: evaluationDate,
            sections: parsedSections,
            pruebaConCarga: pruebaConCargaData,
          };

          importedReports.push(sanitizeReport(rawReport));
        }
      } catch (tabErr) {
        console.warn(`Error importing tab ${tabInfo.tabName}:`, tabErr);
      }
    }

    return {
      success: true,
      reports: importedReports,
    };
  } catch (err: any) {
    console.error('Error importing from Google Sheets:', err);
    return {
      success: false,
      reports: [],
      error: err?.message || 'Error al conectar con Google Sheets.',
    };
  }
}

/**
 * Synchronizes all stored reports into Google Sheets organized by tabs
 */
export async function syncAllReportsToGoogleSheet(
  reports: EvaluationReport[],
  customToken?: string
): Promise<{ success: boolean; count: number; errors: string[] }> {
  const token = customToken || (await getValidAccessToken(true));
  if (!token) {
    throw new Error('Debes iniciar sesión con Google para sincronizar.');
  }

  // 1. First make sure all 4 forms have their Row 1 title headers properly written
  await updateAllFormsHeaders(token);

  let count = 0;
  const errors: string[] = [];

  for (const report of reports) {
    const res = await exportReportToGoogleSheet(report, token);
    if (res.success) {
      count++;
    } else {
      errors.push(`${report.code}: ${res.message}`);
    }
  }

  return {
    success: errors.length === 0,
    count,
    errors,
  };
}

export function isReportSyncedToSheets(reportId: string, reportCode?: string): boolean {
  try {
    const syncedKey = 'kikes_synced_reports_set';
    const raw = localStorage.getItem(syncedKey);
    if (!raw) return false;
    const set = new Set(JSON.parse(raw));
    return set.has(reportId) || (!!reportCode && set.has(reportCode));
  } catch (e) {
    return false;
  }
}

export const PERSONAS_TAB_NAME = 'PERSONAS';

export const PERSONAS_HEADERS = [
  'ID',
  'Nombre Completo',
  'Cargo / Rol',
  'Correo Electrónico',
  'Teléfono',
  'Mostrar en Envíos de Correo',
];

/**
 * Ensures the PERSONAS tab exists and has proper headers with corporate blue formatting
 */
export async function updatePersonasTabHeaders(
  spreadsheetId: string,
  accessToken: string
): Promise<{ success: boolean; sheetId: number; tabName: string }> {
  // Find exact existing title (e.g. "PERSONAS" or "PERSONAS ")
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let tabName = PERSONAS_TAB_NAME;
  let sheetId: number | null = null;

  if (metaRes.ok) {
    const metaData = await metaRes.json();
    const sheets: { properties: { sheetId: number; title: string } }[] = metaData.sheets || [];
    const matched = sheets.find((s) => s.properties.title.trim().toUpperCase() === 'PERSONAS');
    if (matched) {
      tabName = matched.properties.title;
      sheetId = matched.properties.sheetId;
    }
  }

  if (sheetId === null) {
    sheetId = await ensureSheetTabExists(spreadsheetId, PERSONAS_TAB_NAME, accessToken);
    tabName = PERSONAS_TAB_NAME;
  }

  // 1. Expand columns
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    columnCount: Math.max(PERSONAS_HEADERS.length + 5, 20),
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties(columnCount,frozenRowCount)',
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.warn('Could not expand columns for PERSONAS:', e);
  }

  // 2. Write headers row
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:F1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [PERSONAS_HEADERS],
      }),
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.text();
    console.warn(`Could not update header row in ${tabName}:`, err);
  }

  // 3. Format header style
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: PERSONAS_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.086, green: 0.165, blue: 0.502 }, // Corporate blue #162a78
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                    wrapStrategy: 'WRAP',
                    textFormat: {
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                      bold: true,
                      fontSize: 10,
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
              },
            },
          ],
        }),
      }
    );
  } catch (e) {}

  return { success: true, sheetId, tabName };
}

/**
 * Exports all local personas to Google Sheets PERSONAS tab
 */
export async function exportPersonasToGoogleSheet(
  personas: Persona[],
  customToken?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const token = customToken || (await getValidAccessToken(true));
    if (!token) {
      throw new Error('Debes iniciar sesión con Google para sincronizar el personal.');
    }

    const spreadsheetId = getSpreadsheetId();
    const { tabName } = await updatePersonasTabHeaders(spreadsheetId, token);

    // Transform personas to rows
    const rows = personas.map((p, idx) => [
      p.id || `p${idx + 1}`,
      p.nombre || '',
      p.cargo || '',
      p.correo || '',
      p.telefono || '',
      p.mostrarOpcionCorreo ? 'SI' : 'NO',
    ]);

    // Clear existing data rows below header
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2:F500:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (e) {}

    // Write all persona rows
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2:F${rows.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rows,
        }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      throw new Error(`Error al guardar personas en Google Sheets: ${err}`);
    }

    return { success: true, count: personas.length };
  } catch (err: any) {
    console.error('Error exporting personas to Google Sheets:', err);
    return { success: false, count: 0, error: err?.message || 'Error al exportar personas.' };
  }
}

/**
 * Imports all personas from Google Sheets PERSONAS tab
 */
export async function importPersonasFromGoogleSheets(
  customToken?: string,
  promptIfMissing: boolean = false
): Promise<{ success: boolean; personas: Persona[]; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token && promptIfMissing) {
      token = await authenticateWithGoogle();
    }

    const spreadsheetId = getSpreadsheetId();
    const { headers, rows } = await fetchRowsFromTab(spreadsheetId, PERSONAS_TAB_NAME, token);

    if (!rows || rows.length === 0) {
      return { success: true, personas: [] };
    }

    const personas: Persona[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawId = (row[0] || '').trim();
      const rawNombre = (row[1] || '').trim();
      const rawCargo = (row[2] || '').trim();
      const rawCorreo = (row[3] || '').trim();
      const rawTelefono = (row[4] || '').trim();
      const rawMostrar = (row[5] || '').trim().toUpperCase();

      // Skip row if it's empty or repeated header
      if (!rawNombre || rawNombre.toUpperCase() === 'NOMBRE COMPLETO' || rawNombre.toUpperCase() === 'NOMBRE') {
        continue;
      }

      let finalId = rawId;
      if (!finalId || seenIds.has(finalId)) {
        finalId = `p${i + 1}`;
      }
      seenIds.add(finalId);

      personas.push({
        id: finalId,
        nombre: rawNombre,
        cargo: rawCargo || 'Colaborador',
        correo: rawCorreo,
        telefono: rawTelefono,
        mostrarOpcionCorreo: rawMostrar === 'SI' || rawMostrar === 'TRUE' || rawMostrar === '1',
      });
    }

    return {
      success: true,
      personas,
    };
  } catch (err: any) {
    console.error('Error importing personas from Google Sheets:', err);
    return {
      success: false,
      personas: [],
      error: err?.message || 'Error al importar personas de Google Sheets.',
    };
  }
}

/**
 * Bidirectional synchronization for personas:
 * - If Google Sheets is empty or has fewer entries than the comprehensive local 51 users list,
 *   it populates Google Sheets with the 51 users.
 * - If Google Sheets contains users, it pulls and updates the local storage so everyone stays in sync.
 */
export async function syncPersonasBidirectional(
  customToken?: string,
  promptIfMissing: boolean = true
): Promise<{ success: boolean; count: number; action: string; personas: Persona[]; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token && promptIfMissing) {
      try {
        token = await authenticateWithGoogle();
      } catch (authErr) {
        console.warn('OAuth omitted during personas sync, attempting read fallback:', authErr);
      }
    }

    // 1. Fetch remote personas (works with OAuth token or gviz read fallback)
    const remoteRes = await importPersonasFromGoogleSheets(token || undefined, false);
    const localPersonas = getStoredPersonas();

    if (remoteRes.success && remoteRes.personas.length > 0) {
      // Merge remote with local (Sheets is authoritative)
      const mergedMap = new Map<string, Persona>();

      // Seed with local
      localPersonas.forEach((p) => {
        const key = `${p.nombre.toLowerCase().trim()}_${p.correo.toLowerCase().trim()}`;
        mergedMap.set(key, p);
      });

      // Merge remote
      remoteRes.personas.forEach((p) => {
        const key = `${p.nombre.toLowerCase().trim()}_${p.correo.toLowerCase().trim()}`;
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          mergedMap.set(key, { ...existing, ...p });
        } else {
          mergedMap.set(key, p);
        }
      });

      const mergedList = replaceStoredPersonas(Array.from(mergedMap.values()));

      // Also ensure Google Sheets has any merged items if local had more details and we have write token
      if (token && mergedList.length > remoteRes.personas.length) {
        await exportPersonasToGoogleSheet(mergedList, token);
      }

      return {
        success: true,
        count: mergedList.length,
        action: 'synced_from_sheets',
        personas: mergedList,
      };
    } else if (token) {
      // Remote is empty: Populate Google Sheets with the local users
      const toExport = localPersonas.length >= INITIAL_PERSONAS.length ? localPersonas : INITIAL_PERSONAS;
      await exportPersonasToGoogleSheet(toExport, token);
      const savedList = replaceStoredPersonas(toExport);
      return {
        success: true,
        count: savedList.length,
        action: 'populated_sheets',
        personas: savedList,
      };
    }

    return {
      success: false,
      count: 0,
      action: 'needs_auth',
      personas: localPersonas,
      error: remoteRes.error || 'Inicie sesión con Google para sincronizar los usuarios más recientes.',
    };
  } catch (err: any) {
    if (promptIfMissing) {
      console.error('Error syncing personas bidirectional:', err);
    } else {
      console.warn('Silent personas sync skipped:', err?.message || err);
    }
    return {
      success: false,
      count: 0,
      action: 'error',
      personas: getStoredPersonas(),
      error: err?.message || 'Error en la sincronización de personas.',
    };
  }
}

export const CONFIG_IMAGENES_TAB_NAME = 'CONFIG_IMAGENES';
export const CONFIG_IMAGENES_HEADERS = [
  'CLAVE_ELEMENTO',
  'TITULO_SECCION',
  'IMAGEN_PARTE_1',
  'IMAGEN_PARTE_2',
  'IMAGEN_PARTE_3',
  'IMAGEN_PARTE_4',
  'IMAGEN_PARTE_5',
  'FECHA_ACTUALIZACION',
  'USUARIO',
];

/**
 * Splits a long base64 string into cell chunks under 30,000 characters
 * to ensure strict adherence to Google Sheets 50,000 char per cell limit.
 */
function splitDataUrlIntoChunks(dataUrl: string, maxChunkLen = 30000, totalSlots = 5): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < totalSlots; i++) {
    const start = i * maxChunkLen;
    if (start < dataUrl.length) {
      chunks.push(dataUrl.slice(start, start + maxChunkLen));
    } else {
      chunks.push('');
    }
  }
  return chunks;
}

/**
 * Ensures the CONFIG_IMAGENES tab exists in Google Sheets with proper headers
 */
export async function updateConfigImagenesTabHeaders(
  spreadsheetId: string,
  accessToken: string
): Promise<{ success: boolean; sheetId: number; tabName: string }> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let tabName = CONFIG_IMAGENES_TAB_NAME;
  let sheetId: number | null = null;

  if (metaRes.ok) {
    const metaData = await metaRes.json();
    const sheets: { properties: { sheetId: number; title: string } }[] = metaData.sheets || [];
    const matched = sheets.find((s) => s.properties.title.trim().toUpperCase() === 'CONFIG_IMAGENES');
    if (matched) {
      tabName = matched.properties.title;
      sheetId = matched.properties.sheetId;
    }
  }

  if (sheetId === null) {
    sheetId = await ensureSheetTabExists(spreadsheetId, CONFIG_IMAGENES_TAB_NAME, accessToken);
    tabName = CONFIG_IMAGENES_TAB_NAME;
  }

  // 1. Expand columns
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    columnCount: Math.max(CONFIG_IMAGENES_HEADERS.length + 3, 12),
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties(columnCount,frozenRowCount)',
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.warn('Could not expand columns for CONFIG_IMAGENES:', e);
  }

  // 2. Write headers
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:I1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [CONFIG_IMAGENES_HEADERS],
      }),
    }
  );

  // 3. Apply corporate header styling
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: CONFIG_IMAGENES_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.0, green: 0.47, blue: 0.42 }, // Teal Huevos Kikes #00796B
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      fontSize: 10,
                    },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 2,
                },
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.warn('Could not style CONFIG_IMAGENES headers:', e);
  }

  return { success: true, sheetId, tabName };
}

/**
 * Exports all custom menu images and company logo to Google Sheets CONFIG_IMAGENES tab
 */
export async function exportCustomImagesToGoogleSheet(
  customToken?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token) {
      token = await authenticateWithGoogle();
    }

    if (!token) {
      throw new Error('Debes iniciar sesión con Google para sincronizar.');
    }

    const spreadsheetId = getSpreadsheetId();
    const { tabName } = await updateConfigImagenesTabHeaders(spreadsheetId, token);

    const currentUserEmail = getAuth(getFirebaseApp()).currentUser?.email || 'coordinador.mtto@kikes.com.co';
    const nowStr = new Date().toLocaleString('es-CO');

    const rows: (string | number)[][] = [];

    // 1. Company logo (only export if customized)
    if (hasCustomCompanyLogo()) {
      const activeLogo = getCompanyLogo();
      if (activeLogo && activeLogo.trim()) {
        const chunks = splitDataUrlIntoChunks(activeLogo);
        rows.push([
          'COMPANY_LOGO',
          'Logo Oficial de la Empresa (Encabezado Actas y Visores)',
          ...chunks,
          nowStr,
          currentUserEmail,
        ]);
      }
    }

    // 2. Custom menu images (only customized overrides)
    const customImages = getCustomMenuOverridesOnly();
    Object.entries(customImages).forEach(([key, dataUrl]) => {
      if (dataUrl && dataUrl.trim()) {
        const config = MENU_ITEMS_CATALOG.find((c) => c.key === key);
        const title = config ? `${config.title} (${config.category})` : key;
        const chunks = splitDataUrlIntoChunks(dataUrl);
        rows.push([key, title, ...chunks, nowStr, currentUserEmail]);
      }
    });

    if (rows.length === 0) {
      return { success: true, count: 0 };
    }

    // Clear old data rows first (A2:I200)
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2:I200:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (e) {}

    // Write all configuration rows
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2:I${rows.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rows,
        }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      throw new Error(`Error al guardar configuración en Google Sheets: ${err}`);
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    console.error('Error exporting custom images to Google Sheets:', err);
    return { success: false, count: 0, error: err?.message || 'Error al exportar configuración de imágenes.' };
  }
}

/**
 * Saves a single custom image or logo directly to Google Sheets CONFIG_IMAGENES tab.
 * Updates the existing row for this element, or appends a new row if not present.
 * Does NOT overwrite other images in the sheet!
 */
export async function saveSingleCustomImageToGoogleSheet(
  key: string,
  dataUrl: string,
  title?: string,
  customToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token) {
      token = await authenticateWithGoogle();
    }

    if (!token) {
      return { success: false, error: 'Debes iniciar sesión con Google para sincronizar.' };
    }

    const spreadsheetId = getSpreadsheetId();
    const { tabName } = await updateConfigImagenesTabHeaders(spreadsheetId, token);

    const currentUserEmail = getAuth(getFirebaseApp()).currentUser?.email || 'coordinador.mtto@kikes.com.co';
    const nowStr = new Date().toLocaleString('es-CO');

    const displayTitle =
      title ||
      (key === 'COMPANY_LOGO'
        ? 'Logo Oficial de la Empresa (Encabezado Actas y Visores)'
        : MENU_ITEMS_CATALOG.find((c) => c.key === key)?.title || key);

    const chunks = splitDataUrlIntoChunks(dataUrl);
    const rowValues = [key, displayTitle, ...chunks, nowStr, currentUserEmail];

    // Fetch existing rows to locate if this key already exists
    const { rows } = await fetchRowsFromTab(spreadsheetId, tabName, token);

    let targetRowIndex = -1;
    if (rows && rows.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i][0] && String(rows[i][0]).trim() === key.trim()) {
          targetRowIndex = i + 2; // +1 for 0-index -> 1-index, +1 for header row = i + 2
          break;
        }
      }
    }

    if (targetRowIndex > 1) {
      // Update specific existing row
      const range = `${encodeURIComponent(tabName)}!A${targetRowIndex}:I${targetRowIndex}`;
      const putRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [rowValues] }),
        }
      );
      if (!putRes.ok) {
        const err = await putRes.text();
        throw new Error(`Error al actualizar fila en Google Sheets: ${err}`);
      }
    } else {
      // Append new row at the end of the sheet
      const appendRange = `${encodeURIComponent(tabName)}!A:I`;
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [rowValues] }),
        }
      );
      if (!appendRes.ok) {
        const err = await appendRes.text();
        throw new Error(`Error al agregar fila en Google Sheets: ${err}`);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error(`Error saving single image ${key} to Google Sheets:`, err);
    return { success: false, error: err?.message || 'Error al guardar imagen en Google Sheets.' };
  }
}

/**
 * Removes a single custom image or logo row from Google Sheets CONFIG_IMAGENES tab upon reset.
 */
export async function removeSingleCustomImageFromGoogleSheet(
  key: string,
  customToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token) return { success: false, error: 'Sin sesión de Google' };

    const spreadsheetId = getSpreadsheetId();
    const { rows } = await fetchRowsFromTab(spreadsheetId, CONFIG_IMAGENES_TAB_NAME, token);
    if (!rows || rows.length === 0) return { success: true };

    let targetRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] && String(rows[i][0]).trim() === key.trim()) {
        targetRowIndex = i + 2;
        break;
      }
    }

    if (targetRowIndex > 1) {
      const range = `${encodeURIComponent(CONFIG_IMAGENES_TAB_NAME)}!A${targetRowIndex}:I${targetRowIndex}`;
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    return { success: true };
  } catch (err) {
    console.warn(`Could not remove image row ${key} from Google Sheets:`, err);
    return { success: false };
  }
}

/**
 * Imports all custom menu images and company logo from Google Sheets CONFIG_IMAGENES tab
 */
export async function importCustomImagesFromGoogleSheets(
  customToken?: string,
  promptIfMissing: boolean = false
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token && promptIfMissing) {
      try {
        token = await authenticateWithGoogle();
      } catch (authErr) {
        console.warn('OAuth omitted during custom images import, attempting read fallback:', authErr);
      }
    }

    const spreadsheetId = getSpreadsheetId();
    const { rows } = await fetchRowsFromTab(spreadsheetId, CONFIG_IMAGENES_TAB_NAME, token);

    if (!rows || rows.length === 0) {
      return { success: true, count: 0 };
    }

    let appliedCount = 0;
    const importedImagesMap: Record<string, string> = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = (row[0] || '').trim();

      if (!key || key.toUpperCase() === 'CLAVE_ELEMENTO') {
        continue;
      }

      // Reassemble chunked Data URL from columns C (index 2) through G (index 6)
      const imageChunks: string[] = [];
      for (let c = 2; c <= 6 && c < row.length; c++) {
        const val = (row[c] || '').trim();
        // Stop if we hit a date or email column
        if (val.includes('@') || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(val)) {
          break;
        }
        if (val) {
          imageChunks.push(val);
        }
      }
      let dataUrl = imageChunks.join('');
      if (!dataUrl && row.length > 2) {
        dataUrl = (row[2] || '').trim();
      }

      if (!dataUrl) {
        continue;
      }

      if (key === 'COMPANY_LOGO') {
        if (
          dataUrl.startsWith('data:image/') ||
          dataUrl.startsWith('http') ||
          dataUrl.startsWith('<svg') ||
          dataUrl.startsWith('blob:')
        ) {
          saveCompanyLogo(dataUrl);
          appliedCount++;
        }
      } else {
        if (
          dataUrl.startsWith('data:image/') ||
          dataUrl.startsWith('http') ||
          dataUrl.startsWith('<svg') ||
          dataUrl.startsWith('blob:')
        ) {
          importedImagesMap[key] = dataUrl;
          appliedCount++;
        }
      }
    }

    if (Object.keys(importedImagesMap).length > 0) {
      const merged = { ...getCustomMenuOverridesOnly(), ...importedImagesMap };
      setCustomMenuImagesMap(merged);
    }

    return { success: true, count: appliedCount };
  } catch (err: any) {
    console.error('Error importing custom images from Google Sheets:', err);
    return { success: false, count: 0, error: err?.message || 'Error al importar imágenes de Google Sheets.' };
  }
}

/**
 * Bidirectional synchronization for custom images and logos
 */
export async function syncCustomImagesBidirectional(
  customToken?: string,
  promptIfMissing: boolean = false
): Promise<{ success: boolean; count: number; action: string; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token && promptIfMissing) {
      token = await authenticateWithGoogle();
    }

    // Attempt to import latest images from Google Sheets (remote is authoritative)
    const importRes = await importCustomImagesFromGoogleSheets(token, false);
    if (importRes.success && importRes.count > 0) {
      return { success: true, count: importRes.count, action: 'imported' };
    }

    // If remote had no images but local has custom images and we have a valid token, push local to remote
    if (token) {
      const localCustomImages = getCustomMenuOverridesOnly();
      const hasLocalCustom =
        Object.keys(localCustomImages).length > 0 || hasCustomCompanyLogo();
      if (hasLocalCustom) {
        const exportRes = await exportCustomImagesToGoogleSheet(token);
        return { success: exportRes.success, count: exportRes.count, action: 'exported' };
      }
    }

    return { success: true, count: 0, action: 'synced' };
  } catch (err: any) {
    return { success: false, count: 0, action: 'error', error: err?.message };
  }
}

export const CONFIG_FIRMAS_TAB_NAME = 'CONFIG_FIRMAS_ACTAS';
export const CONFIG_FIRMAS_HEADERS = [
  'CODIGO_ACTA',
  'ZONA',
  'GRANJA',
  'GALPON',
  'FIRMAS_JSON_PARTE_1',
  'FIRMAS_JSON_PARTE_2',
  'FIRMAS_JSON_PARTE_3',
  'EMAILS_JSON',
  'FECHA_ACTUALIZACION',
  'USUARIO',
];

/**
 * Ensures the CONFIG_FIRMAS_ACTAS tab exists in Google Sheets with proper headers
 */
export async function updateConfigFirmasTabHeaders(
  spreadsheetId: string,
  accessToken: string
): Promise<{ success: boolean; sheetId: number; tabName: string }> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let tabName = CONFIG_FIRMAS_TAB_NAME;
  let sheetId: number | null = null;

  if (metaRes.ok) {
    const metaData = await metaRes.json();
    const sheets: { properties: { sheetId: number; title: string } }[] = metaData.sheets || [];
    const matched = sheets.find((s) => s.properties.title.trim().toUpperCase() === 'CONFIG_FIRMAS_ACTAS');
    if (matched) {
      tabName = matched.properties.title;
      sheetId = matched.properties.sheetId;
    }
  }

  if (sheetId === null) {
    sheetId = await ensureSheetTabExists(spreadsheetId, CONFIG_FIRMAS_TAB_NAME, accessToken);
    tabName = CONFIG_FIRMAS_TAB_NAME;
  }

  // 1. Expand columns
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    columnCount: Math.max(CONFIG_FIRMAS_HEADERS.length + 3, 14),
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties(columnCount,frozenRowCount)',
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.warn('Could not expand columns for CONFIG_FIRMAS_ACTAS:', e);
  }

  // 2. Write headers
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:J1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [CONFIG_FIRMAS_HEADERS],
      }),
    }
  );

  // 3. Apply corporate header styling (Teal Huevos Kikes #00796B)
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: CONFIG_FIRMAS_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.0, green: 0.47, blue: 0.42 },
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      fontSize: 10,
                    },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
              },
            },
          ],
        }),
      }
    );
  } catch (e) {}

  return { success: true, sheetId, tabName };
}

/**
 * Saves a report's signatures and email recipients directly to Google Sheets CONFIG_FIRMAS_ACTAS tab
 */
export async function saveReportSignaturesToGoogleSheet(
  report: EvaluationReport,
  customToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!report.signatures || report.signatures.length === 0) {
      return { success: true };
    }

    let token = customToken || getCachedGoogleToken();
    if (!token) {
      token = await authenticateWithGoogle();
    }
    if (!token) return { success: false, error: 'Sin autorización de Google' };

    const spreadsheetId = getSpreadsheetId();
    const { tabName } = await updateConfigFirmasTabHeaders(spreadsheetId, token);

    const reportCode = (report.parentReportCode || report.code || '').trim().toUpperCase();
    if (!reportCode) return { success: true };

    const currentUserEmail = getAuth(getFirebaseApp()).currentUser?.email || 'coordinador.mtto@kikes.com.co';
    const nowStr = new Date().toLocaleString('es-CO');

    // Serialize signatures and chunk if needed
    const sigsJson = JSON.stringify(report.signatures);
    const chunks = splitDataUrlIntoChunks(sigsJson, 25000, 3);
    const emailsJson = JSON.stringify(report.emailSentTo || []);

    const rowData = [
      reportCode,
      report.zone || '',
      report.farm || '',
      report.galpon || '',
      chunks[0] || '',
      chunks[1] || '',
      chunks[2] || '',
      emailsJson,
      nowStr,
      currentUserEmail,
    ];

    // Check if code exists in column A of CONFIG_FIRMAS_ACTAS
    const rowIndex = await findRowIndexByReportCode(spreadsheetId, tabName, reportCode, token);

    if (rowIndex && rowIndex > 1) {
      // Update existing row
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A${rowIndex}:J${rowIndex}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [rowData] }),
        }
      );
    } else {
      // Append row
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [rowData] }),
        }
      );
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Error saving signatures to Google Sheet:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Imports all report signatures stored in Google Sheets CONFIG_FIRMAS_ACTAS tab
 */
export async function importReportSignaturesFromGoogleSheets(
  customToken?: string
): Promise<Map<string, { signatures: Signature[]; emailSentTo: string[] }>> {
  const result = new Map<string, { signatures: Signature[]; emailSentTo: string[] }>();
  try {
    const token = customToken || getCachedGoogleToken();
    const spreadsheetId = getSpreadsheetId();
    const { rows } = await fetchRowsFromTab(spreadsheetId, CONFIG_FIRMAS_TAB_NAME, token);
    if (!rows || rows.length === 0) return result;

    for (const row of rows) {
      const code = (row[0] || '').trim().toUpperCase();
      if (!code || code === 'CODIGO_ACTA') continue;

      const chunk1 = row[4] || '';
      const chunk2 = row[5] || '';
      const chunk3 = row[6] || '';
      const fullJson = (chunk1 + chunk2 + chunk3).trim();
      const emailsJson = (row[7] || '').trim();

      let signatures: Signature[] = [];
      let emailSentTo: string[] = [];

      if (fullJson) {
        try {
          signatures = JSON.parse(fullJson);
        } catch (e) {}
      }

      if (emailsJson) {
        try {
          emailSentTo = JSON.parse(emailsJson);
        } catch (e) {}
      }

      if (signatures.length > 0 || emailSentTo.length > 0) {
        result.set(code, { signatures, emailSentTo });
        // Also ensure local persistent backup is populated
        saveReportSignatures(code, undefined, signatures, emailSentTo);
      }
    }
  } catch (e) {
    console.warn('Could not import signatures from Google Sheets tab:', e);
  }
  return result;
}

export const CATEG_ACTIVIDADES_TAB_NAME = 'CATEG_:ACTIVIDADES';
export const CATEG_ACTIVIDADES_HEADERS = [
  'ID_ACTIVIDAD',
  'FORMULARIO_GRANJA',
  'GRUPO',
  'ID_CATEGORIA',
  'CATEGORIA',
  'SECCION',
  'ACTIVIDAD_PREGUNTA',
  'CRITERIO_TECNICO',
  'ESTADO',
  'ORIGEN',
  'FECHA_ACTUALIZACION',
  'USUARIO',
];

/**
 * Finds or creates the CATEG_:ACTIVIDADES tab in Google Sheets.
 * Handles variations such as "CATEG_:ACTIVIDADES", "CATEG_:ACTIVIDADES ", "CATEG_ACTIVIDADES", etc.
 */
export async function updateConfigActividadesTabHeaders(
  spreadsheetId: string,
  accessToken: string
): Promise<{ success: boolean; sheetId: number; tabName: string }> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let tabName = CATEG_ACTIVIDADES_TAB_NAME;
  let sheetId: number | null = null;

  if (metaRes.ok) {
    const metaData = await metaRes.json();
    const sheets: { properties: { sheetId: number; title: string } }[] = metaData.sheets || [];

    // Check exact match first
    let matched = sheets.find(
      (s) => s.properties.title.trim().toUpperCase() === CATEG_ACTIVIDADES_TAB_NAME.toUpperCase()
    );

    // Check flexible match without spaces, colons, or underscores
    if (!matched) {
      const targetNorm = CATEG_ACTIVIDADES_TAB_NAME.toUpperCase().replace(/[\s_:]/g, '');
      matched = sheets.find((s) => {
        const titleNorm = s.properties.title.trim().toUpperCase().replace(/[\s_:]/g, '');
        return (
          titleNorm === targetNorm ||
          titleNorm === 'CATEGACTIVIDADES' ||
          titleNorm.includes('CATEGACTIVIDAD') ||
          titleNorm.includes('CATEGORIAACTIVIDAD')
        );
      });
    }

    if (matched) {
      tabName = matched.properties.title;
      sheetId = matched.properties.sheetId;
    }
  }

  if (sheetId === null) {
    sheetId = await ensureSheetTabExists(spreadsheetId, CATEG_ACTIVIDADES_TAB_NAME, accessToken);
    tabName = CATEG_ACTIVIDADES_TAB_NAME;
  }

  // Ensure grid has enough columns
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    columnCount: Math.max(CATEG_ACTIVIDADES_HEADERS.length + 3, 16),
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties(columnCount,frozenRowCount)',
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.warn('Could not expand columns for CATEG_:ACTIVIDADES:', e);
  }

  // Write headers to Row 1
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:L1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [CATEG_ACTIVIDADES_HEADERS],
      }),
    }
  );

  // Apply corporate styling to Row 1 (Teal Huevos Kikes #00796B)
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: CATEG_ACTIVIDADES_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.0, green: 0.47, blue: 0.42 }, // Huevos Kikes Teal #00796B
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      fontSize: 10,
                    },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: CATEG_ACTIVIDADES_HEADERS.length,
                },
              },
            },
          ],
        }),
      }
    );
  } catch (e) {
    console.warn('Could not style CATEG_:ACTIVIDADES headers:', e);
  }

  return { success: true, sheetId, tabName };
}

/**
 * Exports all indicator activities and custom farms to Google Sheets CATEG_:ACTIVIDADES tab.
 * Makes this configuration available centrally for all users.
 */
export async function exportIndicatorActivitiesToGoogleSheet(
  customToken?: string
): Promise<{ success: boolean; count: number; tabName: string; error?: string }> {
  const executeActivityExport = async (
    token: string
  ): Promise<{ success: boolean; count: number; tabName: string }> => {
    const spreadsheetId = getSpreadsheetId();
    const { tabName } = await updateConfigActividadesTabHeaders(spreadsheetId, token);

    const currentUserEmail = getAuth(getFirebaseApp()).currentUser?.email || 'coordinador.mtto@kikes.com.co';
    const nowStr = new Date().toLocaleString('es-CO');

    const forms = getAvailableForms();
    const rows: (string | number)[][] = [];

    // 1. Write custom farms metadata rows
    forms.forEach((f) => {
      if (!f.isDefault) {
        rows.push([
          `FARM_CONFIG_${f.name}`,
          f.name,
          '-',
          '-',
          '-',
          'CONFIGURACION_GRANJA',
          f.description,
          f.id,
          'ACTIVO',
          'GRANJA',
          nowStr,
          currentUserEmail,
        ]);
      }
    });

    // 2. Write all activities for each farm
    forms.forEach((form) => {
      const sections = getFormSections(form.name);
      sections.forEach((sec) => {
        (sec.items || []).forEach((item) => {
          const cat =
            INDICATOR_CATEGORIES.find(
              (c) => c.label === item.category || c.name === item.category
            ) || resolveItemCategory(item, sec.title);

          rows.push([
            item.id,
            form.name,
            cat.group,
            cat.id,
            cat.label,
            sec.title,
            item.question,
            item.criteria || '',
            'ACTIVO',
            form.isDefault ? 'BASE' : 'PERSONALIZADA',
            nowStr,
            currentUserEmail,
          ]);
        });
      });
    });

    // Clear old rows below header (A2:L2500)
    try {
      const clearRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2:L2500:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (clearRes.status === 401) {
        clearGoogleToken();
        throw new Error('Error al limpiar actividades en Google Sheets (401)');
      }
    } catch (e: any) {
      if (e?.message?.includes('401')) throw e;
    }

    if (rows.length > 0) {
      // Write all rows
      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2:L${rows.length + 1}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: rows,
          }),
        }
      );

      if (!writeRes.ok) {
        if (writeRes.status === 401) clearGoogleToken();
        const err = await writeRes.text();
        throw new Error(`Error al guardar actividades en Google Sheets (${writeRes.status}): ${err}`);
      }
    }

    // Immediately align Row 1 headers & migrate existing data rows across all form tabs
    try {
      await updateAllFormsHeaders(token);
    } catch (hdrErr) {
      console.warn('Could not migrate form tab headers after activity update:', hdrErr);
    }

    safeLocalStorageSet('kikes_indicators_last_sync_timestamp', new Date().toISOString());

    return { success: true, count: rows.length, tabName };
  };

  try {
    let token = customToken || getCachedGoogleToken();
    if (!token) {
      token = await authenticateWithGoogle();
    }
    if (!token) {
      throw new Error('Debes iniciar sesión con Google para sincronizar las actividades.');
    }

    try {
      return await executeActivityExport(token);
    } catch (firstErr: any) {
      if (!customToken && (firstErr?.message?.includes('(401)') || firstErr?.message?.includes('401'))) {
        clearGoogleToken();
        const refreshedToken = await authenticateWithGoogle();
        if (refreshedToken) {
          return await executeActivityExport(refreshedToken);
        }
      }
      throw firstErr;
    }
  } catch (err: any) {
    console.error('Error exporting indicator activities to Google Sheets:', err);
    return {
      success: false,
      count: 0,
      tabName: CATEG_ACTIVIDADES_TAB_NAME,
      error: err?.message || 'Error al exportar actividades a Google Sheets.',
    };
  }
}

/**
 * Imports all indicator activities and custom farms from Google Sheets CATEG_:ACTIVIDADES tab.
 * Updates local cache so the app displays the shared central configuration across all users.
 */
export async function importIndicatorActivitiesFromGoogleSheets(
  customToken?: string,
  promptIfMissing: boolean = false
): Promise<{ success: boolean; count: number; farmsCount: number; tabName: string; error?: string }> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token && promptIfMissing && localStorage.getItem('apps_script_supports_sheets_write') !== '1') {
      try {
        token = await authenticateWithGoogle();
      } catch {
        token = null;
      }
    }

    const spreadsheetId = getSpreadsheetId();

    // Determine tab name
    let tabName = CATEG_ACTIVIDADES_TAB_NAME;
    if (token) {
      try {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (metaRes.status === 401) {
          clearGoogleToken();
          token = promptIfMissing ? await authenticateWithGoogle() : null;
        } else if (metaRes.ok) {
          const metaData = await metaRes.json();
          const sheets: { properties: { sheetId: number; title: string } }[] = metaData.sheets || [];
          const targetNorm = CATEG_ACTIVIDADES_TAB_NAME.toUpperCase().replace(/[\s_:]/g, '');
          const matched = sheets.find((s) => {
            const titleNorm = s.properties.title.trim().toUpperCase().replace(/[\s_:]/g, '');
            return (
              s.properties.title.trim().toUpperCase() === CATEG_ACTIVIDADES_TAB_NAME.toUpperCase() ||
              titleNorm === targetNorm ||
              titleNorm === 'CATEGACTIVIDADES' ||
              titleNorm.includes('CATEGACTIVIDAD') ||
              titleNorm.includes('CATEGORIAACTIVIDAD')
            );
          });
          if (matched) {
            tabName = matched.properties.title;
          }
        }
      } catch (e) {}
    }

    const { rows } = await fetchRowsFromTab(spreadsheetId, tabName, token);

    if (!rows || rows.length === 0) {
      return { success: true, count: 0, farmsCount: 0, tabName };
    }

    const customFarmsMap = new Map<string, FormConfig>();
    // Pre-populate custom farms from local storage to keep descriptions if any
    const existingForms = getAvailableForms();
    existingForms.forEach((f) => {
      if (!f.isDefault) customFarmsMap.set(f.name.toUpperCase(), f);
    });

    // Map: FarmName -> Map<SectionTitle, EvaluationItem[]>
    const farmSectionsMap = new Map<string, Map<string, EvaluationItem[]>>();
    let validActivitiesCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawId = (row[0] || '').trim();
      const rawForm = (row[1] || '').trim().toUpperCase();
      const rawCatId = (row[3] || '').trim();
      const rawCatLabel = (row[4] || '').trim();
      const rawSection = (row[5] || 'GENERAL').trim().toUpperCase();
      const rawQuestion = (row[6] || '').trim();
      const rawCriteria = (row[7] || '').trim();
      const rawOrigen = (row[9] || '').trim().toUpperCase();

      // Skip header row if repeated or empty
      if (!rawId || rawId.toUpperCase() === 'ID_ACTIVIDAD' || !rawForm) {
        continue;
      }

      // 1. Check if it's a custom farm metadata row
      if (rawId.startsWith('FARM_CONFIG_') || rawOrigen === 'GRANJA') {
        customFarmsMap.set(rawForm, {
          id: rawCriteria || rawForm.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: rawForm,
          description: rawQuestion || `Formulario e inspección para ${rawForm}`,
          isDefault: false,
        });
        continue;
      }

      // If it's a new farm not in default list, register it
      const isDefaultForm = DEFAULT_FORMS.some((df) => df.name.toUpperCase() === rawForm);
      if (!isDefaultForm && !customFarmsMap.has(rawForm)) {
        customFarmsMap.set(rawForm, {
          id: rawForm.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: rawForm,
          description: `Formulario e inspección para ${rawForm}`,
          isDefault: false,
        });
      }

      // 2. Activity item
      if (rawQuestion) {
        // Resolve category
        const matchedCat =
          INDICATOR_CATEGORIES.find(
            (c) =>
              c.label.toUpperCase() === rawCatLabel.toUpperCase() ||
              c.name.toUpperCase() === rawCatLabel.toUpperCase() ||
              c.id.toLowerCase() === rawCatId.toLowerCase()
          ) || resolveItemCategory({ id: rawId, question: rawQuestion } as any, rawSection);

        const item: EvaluationItem = {
          id: rawId,
          question: rawQuestion,
          criteria: rawCriteria || undefined,
          status: 'cumple',
          score: 100,
          category: matchedCat.label,
        };

        if (!farmSectionsMap.has(rawForm)) {
          farmSectionsMap.set(rawForm, new Map<string, EvaluationItem[]>());
        }
        const sectionsMap = farmSectionsMap.get(rawForm)!;
        if (!sectionsMap.has(rawSection)) {
          sectionsMap.set(rawSection, []);
        }
        sectionsMap.get(rawSection)!.push(item);
        validActivitiesCount++;
      }
    }

    if (validActivitiesCount === 0 && customFarmsMap.size === 0) {
      return { success: true, count: 0, farmsCount: 0, tabName };
    }

    // Save custom farms to localStorage
    if (customFarmsMap.size > 0) {
      const customList = Array.from(customFarmsMap.values());
      safeLocalStorageSet('OVERHAUL_CUSTOM_FARMS_LIST', JSON.stringify(customList));
    }

    // Save rebuilt sections for each farm
    farmSectionsMap.forEach((sectionsMap, farmName) => {
      const sectionsArray: EvaluationSection[] = [];
      sectionsMap.forEach((items, secTitle) => {
        sectionsArray.push({
          id: secTitle.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'sec',
          title: secTitle,
          items,
        });
      });

      const storageKey = getStorageKeyForForm(farmName);
      safeLocalStorageSet(storageKey, JSON.stringify(sectionsArray));
    });

    safeLocalStorageSet('kikes_indicators_last_sync_timestamp', new Date().toISOString());

    return {
      success: true,
      count: validActivitiesCount,
      farmsCount: farmSectionsMap.size,
      tabName,
    };
  } catch (err: any) {
    console.error('Error importing indicator activities from Google Sheets:', err);
    return {
      success: false,
      count: 0,
      farmsCount: 0,
      tabName: CATEG_ACTIVIDADES_TAB_NAME,
      error: err?.message || 'Error al importar actividades de Google Sheets.',
    };
  }
}

/**
 * Bidirectional synchronization for indicator activities and custom farms.
 * Attempts to import from Google Sheets CATEG_:ACTIVIDADES (remote authoritative).
 * If the sheet has no rows yet, it pushes the local configuration to initialize the sheet.
 */
export async function syncIndicatorActivitiesBidirectional(
  customToken?: string,
  promptIfMissing: boolean = false
): Promise<{
  success: boolean;
  count: number;
  action: 'imported' | 'exported' | 'synced';
  tabName: string;
  error?: string;
}> {
  try {
    let token = customToken || getCachedGoogleToken();
    if (!token && promptIfMissing) {
      token = await authenticateWithGoogle();
    }

    // Attempt import first
    const importRes = await importIndicatorActivitiesFromGoogleSheets(token, false);
    if (importRes.success && importRes.count > 0) {
      return {
        success: true,
        count: importRes.count,
        action: 'imported',
        tabName: importRes.tabName,
      };
    }

    // If remote was empty or had 0 rows, export local configuration to populate it
    if (token) {
      const exportRes = await exportIndicatorActivitiesToGoogleSheet(token);
      return {
        success: exportRes.success,
        count: exportRes.count,
        action: 'exported',
        tabName: exportRes.tabName,
        error: exportRes.error,
      };
    }

    return {
      success: true,
      count: 0,
      action: 'synced',
      tabName: CATEG_ACTIVIDADES_TAB_NAME,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      action: 'synced',
      tabName: CATEG_ACTIVIDADES_TAB_NAME,
      error: err?.message || 'Error en la sincronización de actividades.',
    };
  }
}

export const MATRIZ_INDICADORES_TAB_NAME = 'MATRIZ_INDICADORES';

export interface ExportMatrizResult {
  success: boolean;
  sheetId: number;
  rowCount: number;
  columnCount: number;
  tabUrl: string;
  mesCorteLabel: string;
  columnsEvaluated: number;
  error?: string;
}

/**
 * Exports the Monthly Indicators Matrix to the MATRIZ_INDICADORES tab in Google Sheets
 * with exact formatting, colors, and thresholds matching corporate requirements:
 * - Cumplimiento en Fecha: <= 12% Green, > 12% Red
 * - Cumplimiento en Condición: >= 95% Green, < 95% Red
 * - Tipo A: 100% Green, < 100% Red
 * - Tipo B & C: >= 95% Green, < 95% Red
 */
export async function exportMatrizIndicadoresToGoogleSheets(
  reports: EvaluationReport[],
  selectedMonth: string | MonthOption,
  filterFarm: string = 'TODAS',
  customToken?: string
): Promise<ExportMatrizResult> {
  try {
    let token = customToken || (await getValidAccessToken(true));
    if (!token) {
      throw new Error('Debes iniciar sesión con Google para publicar en la hoja de cálculo.');
    }

    const spreadsheetId = getSpreadsheetId();
    let sheetId: number;
    try {
      sheetId = await ensureSheetTabExists(spreadsheetId, MATRIZ_INDICADORES_TAB_NAME, token);
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg.includes('403') ||
        msg.includes('401') ||
        msg.includes('SERVICE_DISABLED') ||
        msg.includes('PERMISSION_DENIED')
      ) {
        // Clear stale token from previous project and prompt fresh login
        clearGoogleToken();
        token = await authenticateWithGoogle();
        sheetId = await ensureSheetTabExists(spreadsheetId, MATRIZ_INDICADORES_TAB_NAME, token);
      } else {
        throw err;
      }
    }

    const matrix = calculateMonthlyIndicatorMatrix(reports, selectedMonth, filterFarm);

    if (matrix.columns.length === 0) {
      throw new Error(`No hay actas registradas para el período ${matrix.mesCorteLabel}.`);
    }

    const totalCols = Math.max(matrix.columns.length + 3, 26);
    const totalRows = 60;

    // 1. Expand sheet dimensions if needed and hide gridlines
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: {
                      rowCount: totalRows,
                      columnCount: totalCols,
                      frozenRowCount: 6,
                      frozenColumnCount: 1,
                      hideGridlines: true,
                    },
                  },
                  fields: 'gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount,hideGridlines)',
                },
              },
            ],
          }),
        }
      );
    } catch (e) {
      console.warn('Could not update grid properties for MATRIZ_INDICADORES:', e);
    }

    // 2. Clear current tab content
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(MATRIZ_INDICADORES_TAB_NAME)}!A1:ZZ60:clear`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (e) {
      console.warn('Could not clear MATRIZ_INDICADORES tab:', e);
    }

    // 3. Prepare data rows
    const dataRows: (string | number)[][] = [];

    // Row 1 (Index 0): Title banner
    dataRows.push(['INDICADORES – OVERHAUL']);
    // Row 2 (Index 1): Empty spacer
    dataRows.push([]);
    // Rows 3-5 (Index 2-4): Cut-off metadata box
    dataRows.push(['MES DE CORTE', matrix.mesCorteLabel]);
    dataRows.push(['FECHA INICIO', matrix.fechaInicioStr]);
    dataRows.push(['FECHA FIN', matrix.fechaFinStr]);
    // Row 6 (Index 5): Empty spacer
    dataRows.push([]);

    // Row 7 (Index 6): Granja
    dataRows.push(['Granja', ...matrix.columns.map((c) => c.granja)]);

    // Row 8 (Index 7): Galpón
    dataRows.push(['Galpón', ...matrix.columns.map((c) => c.galpon)]);

    // Row 9 (Index 8): Fecha Entrega
    dataRows.push(['Fecha Entrega', ...matrix.columns.map((c) => c.fechaEntregaStr)]);

    // Row 10 (Index 9): Cumplimiento en Fecha
    dataRows.push([
      'Cumplimiento en Fecha',
      ...matrix.columns.map((c) =>
        c.cumplimientoEnFecha !== null
          ? `${c.cumplimientoEnFecha.toFixed(2).replace('.', ',')}%`
          : '-'
      ),
    ]);

    // Row 11 (Index 10): Cumplimiento en Condición
    dataRows.push([
      'Cumplimiento en Condición',
      ...matrix.columns.map((c) => `${c.cumplimientoEnCondicion.toFixed(2).replace('.', ',')}%`),
    ]);

    // Row 12 (Index 11): Días Vacio Sanitario
    dataRows.push([
      'Días Vacio Sanitario',
      ...matrix.columns.map((c) => (c.diasVacioSanitario !== null ? c.diasVacioSanitario : '-')),
    ]);

    // Rows 13..23 (Index 12..22): 11 Categories
    INDICATOR_CATEGORIES.forEach((cat) => {
      dataRows.push([
        cat.tableLabel,
        ...matrix.columns.map((col) => {
          const scoreData = col.categoryScores[cat.id];
          const avg = scoreData?.avgScore;
          return avg !== null && avg !== undefined ? `${avg.toFixed(2).replace('.', ',')}%` : '';
        }),
      ]);
    });

    // 4. Write data to Google Sheets
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(MATRIZ_INDICADORES_TAB_NAME)}!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: dataRows,
        }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      throw new Error(`Error al escribir celdas en Google Sheets: ${err}`);
    }

    const numCols = matrix.columns.length + 1;
    const clearEndCol = Math.max(totalCols, 40);

    // 5. Build formatting batchUpdate requests
    const formatRequests: any[] = [];

    // Colors
    const darkTeal = { red: 0.0, green: 0.357, blue: 0.322 }; // #005B52
    const lightTeal = { red: 0.88, green: 0.95, blue: 0.94 };
    const grayBg = { red: 0.941, green: 0.957, blue: 0.973 }; // #f1f5f9
    const grayHeaderBg = { red: 0.886, green: 0.910, blue: 0.941 }; // #e2e8f0
    const greenBg = { red: 0.749, green: 0.918, blue: 0.824 }; // #bfead2
    const redBg = { red: 0.996, green: 0.804, blue: 0.827 }; // #fecdd3
    const whiteBg = { red: 1.0, green: 1.0, blue: 1.0 };

    // STEP A: Reset background color across all grid cells to white (clears previous months' colors)
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: totalRows,
          startColumnIndex: 0,
          endColumnIndex: clearEndCol,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: whiteBg,
          },
        },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });

    // STEP B: Clear existing borders on the entire area with NONE style
    const noneBorder = { style: 'NONE' };
    formatRequests.push({
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: totalRows,
          startColumnIndex: 0,
          endColumnIndex: clearEndCol,
        },
        top: noneBorder,
        bottom: noneBorder,
        left: noneBorder,
        right: noneBorder,
        innerHorizontal: noneBorder,
        innerVertical: noneBorder,
      },
    });

    // STEP C: Ensure sheet gridlines are hidden for a clean, modern canvas
    formatRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            hideGridlines: true,
          },
        },
        fields: 'gridProperties.hideGridlines',
      },
    });

    // Format Row 1 (Index 0): Title Banner
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: Math.min(numCols, 6),
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: darkTeal,
            textFormat: { bold: true, fontSize: 12, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
      },
    });

    // Format Rows 3-5 (Index 2-5): Cut-off info box
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 2,
          endRowIndex: 5,
          startColumnIndex: 0,
          endColumnIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: grayHeaderBg,
            textFormat: { bold: true, fontSize: 9 },
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
      },
    });
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 2,
          endRowIndex: 5,
          startColumnIndex: 1,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: lightTeal,
            textFormat: { bold: true, fontSize: 9, foregroundColor: darkTeal },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
      },
    });

    // Format Row 7 (Index 6): Granja row (Using identical color scheme of Row 8)
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 6,
          endRowIndex: 7,
          startColumnIndex: 0,
          endColumnIndex: numCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: grayBg,
            textFormat: { bold: true, fontSize: 9 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
      },
    });

    // Format Row 8 (Index 7): Galpón row
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 7,
          endRowIndex: 8,
          startColumnIndex: 0,
          endColumnIndex: numCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: grayBg,
            textFormat: { bold: true, fontSize: 9 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
      },
    });

    // Format Row 9 (Index 8): Fecha Entrega row
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 8,
          endRowIndex: 9,
          startColumnIndex: 0,
          endColumnIndex: numCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: whiteBg,
            textFormat: { bold: true, fontSize: 9 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
      },
    });

    // Format Column A (Indices 6..23): Left-align category and metadata labels
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 6,
          endRowIndex: dataRows.length,
          startColumnIndex: 0,
          endColumnIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 9 },
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
      },
    });

    // Format Row 10 (Index 9): Cumplimiento en Fecha (Rule: <= 12% Green, > 12% Red)
    matrix.columns.forEach((col, idx) => {
      const c = idx + 1;
      const isGreen = col.cumplimientoEnFecha !== null && col.cumplimientoEnFecha <= 12;
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 9,
            endRowIndex: 10,
            startColumnIndex: c,
            endColumnIndex: c + 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: col.cumplimientoEnFecha !== null ? (isGreen ? greenBg : redBg) : whiteBg,
              textFormat: { bold: true, fontSize: 9 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
        },
      });
    });

    // Format Row 11 (Index 10): Cumplimiento en Condición (Rule: >= 95% Green, < 95% Red)
    matrix.columns.forEach((col, idx) => {
      const c = idx + 1;
      const isGreen = col.cumplimientoEnCondicion >= 95;
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 10,
            endRowIndex: 11,
            startColumnIndex: c,
            endColumnIndex: c + 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: isGreen ? greenBg : redBg,
              textFormat: { bold: true, fontSize: 9 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
        },
      });
    });

    // Format Row 12 (Index 11): Días Vacio Sanitario
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 11,
          endRowIndex: 12,
          startColumnIndex: 1,
          endColumnIndex: numCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: whiteBg,
            textFormat: { bold: true, fontSize: 9 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
      },
    });

    // Format Rows 13..23 (Index 12..22): 11 Categories with individual cell colors
    INDICATOR_CATEGORIES.forEach((cat, catIdx) => {
      const r = 12 + catIdx;
      matrix.columns.forEach((col, colIdx) => {
        const c = colIdx + 1;
        const scoreData = col.categoryScores[cat.id];
        const avg = scoreData?.avgScore;

        if (avg !== null && avg !== undefined) {
          // Rules: Group A: 100% Green, < 100% Red. Groups B & C: >= 95% Green, < 95% Red.
          const isGreen = cat.group === 'A' ? avg >= 100 : avg >= 95;
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: r,
                endRowIndex: r + 1,
                startColumnIndex: c,
                endColumnIndex: c + 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: isGreen ? greenBg : redBg,
                  textFormat: { bold: true, fontSize: 9 },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment',
            },
          });
        }
      });
    });

    // Set Column Widths: Col A = 320px, Cols B..N = 115px
    formatRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 1,
        },
        properties: { pixelSize: 320 },
        fields: 'pixelSize',
      },
    });
    formatRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 1,
          endIndex: numCols,
        },
        properties: { pixelSize: 115 },
        fields: 'pixelSize',
      },
    });

    // Execute formatting batch update
    const batchRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: formatRequests }),
      }
    );

    if (!batchRes.ok) {
      const errText = await batchRes.text();
      console.error('Error applying batchUpdate formatting:', errText);
      throw new Error(`Error al aplicar formato en Google Sheets: ${errText}`);
    }

    const tabUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`;

    return {
      success: true,
      sheetId,
      rowCount: dataRows.length,
      columnCount: numCols,
      tabUrl,
      mesCorteLabel: matrix.mesCorteLabel,
      columnsEvaluated: matrix.columns.length,
    };
  } catch (err: any) {
    console.error('Error exporting MATRIZ_INDICADORES to Google Sheets:', err);
    return {
      success: false,
      sheetId: 0,
      rowCount: 0,
      columnCount: 0,
      tabUrl: '',
      mesCorteLabel: '',
      columnsEvaluated: 0,
      error: err?.message || 'Error al exportar matriz a Google Sheets.',
    };
  }
}

/**
 * Returns the human-readable timestamp of the last successful indicators sync
 */
export function getLastIndicatorsSyncTime(): string | null {
  try {
    const raw = localStorage.getItem('kikes_indicators_last_sync_timestamp');
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (e) {
    return null;
  }
}



