import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { EvaluationSection, EvaluationItem } from '../types';
import { safeLocalStorageSet } from './mediaCacheDb';

const SPREADSHEET_ID = '1VIsyEabzn28tO4WLAb48ztymu2l1FLlmth7GrelMcQI';

export function getFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

export interface SheetRow {
  itemNumber?: string;
  sectionTitle?: string;
  questionText?: string;
  criteriaText?: string;
}

export interface GoogleSheetsFetchResult {
  zucamiSections: EvaluationSection[];
  salmetSections: EvaluationSection[];
  granjasPisoSections?: EvaluationSection[];
  elRobleSections?: EvaluationSection[];
  rawZucamiRows: string[][];
  rawSalmetRows: string[][];
  sheetTitles: string[];
}

export async function fetchGoogleSheetsQuestions(): Promise<GoogleSheetsFetchResult> {
  const app = getFirebaseApp();
  const auth = getAuth(app);

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');

  // Popup sign-in to get Google OAuth Access Token
  const userCredential = await signInWithPopup(auth, provider);
  const googleCredential = GoogleAuthProvider.credentialFromResult(userCredential);
  const accessToken = googleCredential?.accessToken;

  if (!accessToken) {
    throw new Error('No se pudo obtener el token de acceso de Google.');
  }

  // 1. Fetch spreadsheet metadata to get sheet names
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    const errorText = await metaRes.text();
    throw new Error(`Error al leer metadata del Google Sheet (${metaRes.status}): ${errorText}`);
  }

  const metaData = await metaRes.json();
  const sheetTitles: string[] = (metaData.sheets || []).map(
    (s: { properties: { title: string } }) => s.properties.title
  );

  console.log('Hojas encontradas en la hoja de cálculo:', sheetTitles);

  // Determine sheet matches (case insensitive search)
  const zucamiSheetName = sheetTitles.find((t) => t.toUpperCase().includes('ZUCAMI')) || 'ZUCAMI';
  const salmetSheetName = sheetTitles.find((t) => t.toUpperCase().includes('SALMET')) || 'SALMET';
  const pisoSheetName = sheetTitles.find((t) => t.toUpperCase().includes('PISO') || t.toUpperCase().includes('GRANJA')) || '';
  const robleSheetName = sheetTitles.find((t) => t.toUpperCase().includes('ROBLE')) || '';

  const fetchSheetData = async (title: string) => {
    if (!title) return [];
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}!A1:Z500`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.values || [];
  };

  const rawZucamiRows = await fetchSheetData(zucamiSheetName);
  const rawSalmetRows = await fetchSheetData(salmetSheetName);
  const rawPisoRows = pisoSheetName ? await fetchSheetData(pisoSheetName) : [];
  const rawRobleRows = robleSheetName ? await fetchSheetData(robleSheetName) : [];

  const zucamiSections = parseRowsToSections(rawZucamiRows, 'zucami');
  const salmetSections = parseRowsToSections(rawSalmetRows, 'salmet');
  const granjasPisoSections = pisoSheetName ? parseRowsToSections(rawPisoRows, 'granjas_piso') : [];
  const elRobleSections = robleSheetName ? parseRowsToSections(rawRobleRows, 'el_roble') : [];

  // Save to localStorage so they persist for form usage
  if (zucamiSections.length > 0) {
    safeLocalStorageSet('OVERHAUL_CUSTOM_SECTIONS_ZUCAMI', JSON.stringify(zucamiSections));
  }
  if (salmetSections.length > 0) {
    safeLocalStorageSet('OVERHAUL_CUSTOM_SECTIONS_SALMET', JSON.stringify(salmetSections));
  }
  if (granjasPisoSections.length > 0) {
    safeLocalStorageSet('OVERHAUL_CUSTOM_SECTIONS_GRANJAS_PISO', JSON.stringify(granjasPisoSections));
  }
  if (elRobleSections.length > 0) {
    safeLocalStorageSet('OVERHAUL_CUSTOM_SECTIONS_EL_ROBLE', JSON.stringify(elRobleSections));
  }

  return {
    zucamiSections,
    salmetSections,
    granjasPisoSections,
    elRobleSections,
    rawZucamiRows,
    rawSalmetRows,
    sheetTitles,
  };
}

/**
 * Parses raw 2D array matrix from Google Sheets into structured EvaluationSection[]
 */
export function parseRowsToSections(rows: string[][], zoneKey: string): EvaluationSection[] {
  if (!rows || rows.length < 2) return [];

  // Find header index (search up to row 25 to account for document headers)
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const rowStr = rows[i].join(' ').toUpperCase();
    if (
      rowStr.includes('ITEM') ||
      rowStr.includes('SECCION') ||
      rowStr.includes('SISTEMA') ||
      rowStr.includes('ACTIVIDADES') ||
      rowStr.includes('DESCRIPCION')
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 0;

  const headers = rows[headerRowIndex].map((h) => h.toUpperCase().trim());

  // Find column indexes
  let itemColIdx = headers.findIndex((h) => h.includes('ITEM') || h.includes('NUM') || h.includes('Nº'));
  let sectionColIdx = headers.findIndex(
    (h) => h.includes('SISTEMA') || h.includes('SECCION') || h.includes('SECCIÓN') || h.includes('CATEGORIA')
  );
  let questionColIdx = headers.findIndex(
    (h) =>
      h.includes('ACTIVIDAD') ||
      h.includes('FINALIZACION') ||
      h.includes('PREGUNTA') ||
      h.includes('DESCRIPCION') ||
      h.includes('CRITERIO') ||
      h.includes('EVALUAR')
  );
  let criteriaColIdx = headers.findIndex(
    (h) => h.includes('ESPECIFICACION') || h.includes('TOLERANCIA') || h.includes('OBSERVACION')
  );

  // Fallbacks if not detected by header text
  if (sectionColIdx === -1) sectionColIdx = 1;
  if (itemColIdx === -1) itemColIdx = sectionColIdx === 1 ? 3 : 0;
  if (questionColIdx === -1) questionColIdx = Math.max(itemColIdx + 1, sectionColIdx + 1);

  const sectionsMap: { [key: string]: EvaluationItem[] } = {};
  let currentSectionTitle = 'SILOS';

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawSection = sectionColIdx >= 0 && row[sectionColIdx] ? row[sectionColIdx].trim() : '';
    const itemNum = itemColIdx >= 0 && row[itemColIdx] ? row[itemColIdx].trim() : '';
    
    // Find question text in assigned column, or fallback to any non-empty cell after itemColIdx
    let rawQuestion = questionColIdx >= 0 && row[questionColIdx] ? row[questionColIdx].trim() : '';
    if (!rawQuestion) {
      for (let c = itemColIdx + 1; c < row.length; c++) {
        if (row[c] && row[c].trim().length > 3 && !row[c].includes('%')) {
          rawQuestion = row[c].trim();
          break;
        }
      }
    }

    const rawCriteria = criteriaColIdx >= 0 && row[criteriaColIdx] ? row[criteriaColIdx].trim() : '';

    if (!rawQuestion && !itemNum && !rawSection) continue;
    // Skip subheader rows
    if (rawQuestion.toUpperCase().includes('PORCENTAJE DE CUMPLIMIENTO') || rawQuestion.toUpperCase().includes('ACTIVIDADES REALIZADAS')) continue;

    if (rawSection && rawSection.toUpperCase() !== 'SISTEMA' && rawSection.toUpperCase() !== currentSectionTitle) {
      currentSectionTitle = rawSection;
    }

    if (!sectionsMap[currentSectionTitle]) {
      sectionsMap[currentSectionTitle] = [];
    }

    const questionText = itemNum
      ? `${itemNum}. ${rawQuestion || rawSection}`
      : rawQuestion || 'Criterio de evaluación';

    sectionsMap[currentSectionTitle].push({
      id: `${zoneKey}_row_${r}_${Math.random().toString(36).substring(2, 6)}`,
      question: questionText,
      criteria: rawCriteria || undefined,
      status: 'cumple',
    });
  }

  // Convert map to EvaluationSection array
  return Object.keys(sectionsMap).map((secTitle, idx) => ({
    id: `${zoneKey}_sec_${idx}`,
    title: secTitle.toUpperCase(),
    items: sectionsMap[secTitle],
  }));
}
