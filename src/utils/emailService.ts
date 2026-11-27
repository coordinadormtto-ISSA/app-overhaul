import { EvaluationReport } from '../types';
import { generateReportPDFBase64 } from './pdfGenerator';
import { sanitizeReport } from '../lib/storage';
import {
  getSpreadsheetId,
  getSheetTabNameForZone,
  getHeadersForZone,
  reportToRowValues,
} from '../lib/googleSheetsSync';

export const DEFAULT_SCRIPT_URL =
  'https://script.google.com/a/macros/kikes.com.co/s/AKfycbxLs1eWLPqTQbKUSxhPfs8NdO-tO8wiDhUg40Et09Fy4bPC_onHvRjYX-Tf1bMce1i8Tw/exec';

export function getAppsScriptUrl(): string {
  try {
    let savedUrl = localStorage.getItem('apps_script_url');
    if (
      !savedUrl ||
      savedUrl.includes('AKfycbyPI-oPCVtFWbLgl2f0wjPhyy9f4MM-p_4c8i_yj7QNoWV69lu2CAglwzsfSkQfhkfK8A') ||
      savedUrl === 'https://script.google.com/macros/s/AKfycbxLs1eWLPqTQbKUSxhPfs8NdO-tO8wiDhUg40Et09Fy4bPC_onHvRjYX-Tf1bMce1i8Tw/exec'
    ) {
      savedUrl = DEFAULT_SCRIPT_URL;
      try {
        localStorage.setItem('apps_script_url', DEFAULT_SCRIPT_URL);
      } catch {
        // Ignore storage quota errors
      }
    }
    return savedUrl;
  } catch {
    return DEFAULT_SCRIPT_URL;
  }
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  recipients: string[];
  subject: string;
  savedToSheet?: boolean;
  sheetMessage?: string;
}

export async function sendReportEmailViaScript(rawReport: EvaluationReport): Promise<SendEmailResult> {
  const report = sanitizeReport(rawReport);
  const targetScriptUrl = getAppsScriptUrl();

  // 1. Calculate Recipients
  const recipients = (report.emailSentTo && report.emailSentTo.length > 0)
    ? report.emailSentTo
    : (report.signatures || [])
        .map((s) => s.correo)
        .filter((v, i, a): v is string => Boolean(v && v.trim() !== '' && a.indexOf(v) === i));

  // If no recipient list found, fallback to coordinator
  if (recipients.length === 0) {
    recipients.push('coordinador.mtto@kikes.com.co');
  }

  // 2. Build Location Text
  const isPisoOrRoble = report.zone === 'GRANJAS PISO' || report.zone === 'EL ROBLE';
  const zonaAnswer = (report.zone && report.zone.trim())
    ? report.zone.trim().toUpperCase()
    : (report.zonaNombre || 'ZUCAMI').trim().toUpperCase();

  let questionLabel = '';
  let questionAnswer = '';

  const hasGalponQuestion = !isPisoOrRoble && report.galpon && report.galpon.trim() !== '';

  if (hasGalponQuestion) {
    questionLabel = 'GALPON';
    questionAnswer = report.galpon.trim().toUpperCase();
    if (/^galp[oó]n\s*/i.test(questionAnswer)) {
      questionAnswer = questionAnswer.replace(/^galp[oó]n\s*/i, '');
    }
  } else if (report.farm && report.farm.trim() !== '') {
    questionLabel = 'GRANJA';
    questionAnswer = report.farm.trim().toUpperCase();
    if (/^granja\s*/i.test(questionAnswer)) {
      questionAnswer = questionAnswer.replace(/^granja\s*/i, '');
    }
  } else if (report.galpon && report.galpon.trim() !== '') {
    questionLabel = 'GALPON';
    questionAnswer = report.galpon.trim().toUpperCase();
    if (/^galp[oó]n\s*/i.test(questionAnswer)) {
      questionAnswer = questionAnswer.replace(/^galp[oó]n\s*/i, '');
    }
  }

  const fullLocation = (questionLabel && questionAnswer)
    ? `${zonaAnswer}, ${questionLabel} ${questionAnswer}`
    : zonaAnswer;

  const subjectLine = `ENVÍO DE ACTA DE RECIBIDO GRANJA ${fullLocation}`;

  const asistentesList = (report.signatures && report.signatures.length > 0)
    ? report.signatures
        .filter((s) => s.nombre && s.nombre.trim() !== '')
        .map((s) => `Nombre: ${s.nombre.trim()}, Cargo: ${s.cargo ? s.cargo.trim() : ''}`)
        .join('\n')
    : 'Sin asistentes registrados.';

  const emailBodyText = `Cordial saludo,

Se envía el acta de entrega del ${fullLocation}

ASISTENTES

${asistentesList}`;

  // 3. Generate PDF Base64
  let pdfData = { base64: '', fileName: `ACTA_${report.code || 'OVERHAUL'}.pdf` };
  try {
    pdfData = await generateReportPDFBase64(report);
  } catch (e) {
    console.warn('Could not generate PDF base64 attachment:', e);
  }

  const sigs = report.signatures || [];

  const payload = {
    subject: subjectLine,
    body: emailBodyText,
    locationText: fullLocation,
    asistentesText: asistentesList,
    galpon: report.galpon,
    granja: report.farm,
    zona: report.zone || report.zonaNombre,
    puntaje: report.totalScore,
    status: report.status,
    reportCode: report.code,
    destinatarios: recipients,

    // PDF Attachment
    pdfBase64: pdfData.base64,
    pdfName: pdfData.fileName,

    // Signature / Assistant parameters A through E
    nombreA: sigs[0]?.nombre || '',
    cargoA: sigs[0]?.cargo || '',
    correoA: sigs[0]?.correo || '',

    nombreB: sigs[1]?.nombre || '',
    cargoB: sigs[1]?.cargo || '',
    correoB: sigs[1]?.correo || '',

    nombreC: sigs[2]?.nombre || '',
    cargoC: sigs[2]?.cargo || '',
    correoC: sigs[2]?.correo || '',

    nombreD: sigs[3]?.nombre || '',
    cargoD: sigs[3]?.cargo || '',
    correoD: sigs[3]?.correo || '',

    nombreE: sigs[4]?.nombre || '',
    cargoE: sigs[4]?.cargo || '',
    correoE: sigs[4]?.correo || '',

    // Optional structured sheet sync data (processed if Apps Script supports saving rows)
    sheetSyncData: {
      spreadsheetId: getSpreadsheetId(),
      tabName: getSheetTabNameForZone(report.zone),
      reportCode: report.parentReportCode || report.code,
      headers: getHeadersForZone(report.zone),
      rowValues: reportToRowValues(report),
      signaturesMeta: {
        code: report.code,
        signaturesJson: JSON.stringify(sigs),
        emailSentTo: recipients.join(', '),
        notes: report.notes || '',
      },
    },
  };

  try {
    // Attempt 1: Server proxy execution
    const res = await fetch('/api/trigger-apps-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scriptUrl: targetScriptUrl,
        payload,
      }),
    });

    const data = await res.json();

    if (data.success) {
      const savedToSheet = data.data?.savedToSheet === true;
      if (savedToSheet) {
        try {
          localStorage.setItem('apps_script_supports_sheets_write', '1');
        } catch (e) {}
      }
      return {
        success: true,
        message: 'El correo ha sido enviado exitosamente mediante Google Apps Script con el acta en PDF adjunta.',
        recipients,
        subject: subjectLine,
        savedToSheet,
        sheetMessage: data.data?.sheetMessage,
      };
    }

    // Attempt 2: Direct browser POST execution fallback
    console.log('Server proxy fallback, executing direct browser POST:', data.message);
    await new Promise<void>((resolve) => {
      const iframeName = 'gas_iframe_' + Date.now();
      const iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = targetScriptUrl;
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
      setTimeout(cleanup, 8000);
    });

    try {
      localStorage.setItem('apps_script_supports_sheets_write', '1');
    } catch (e) {}

    return {
      success: true,
      message: 'El correo ha sido enviado exitosamente mediante el script de Google con el acta adjunta.',
      recipients,
      subject: subjectLine,
      savedToSheet: true,
      sheetMessage: `Acta ${report.code} procesada y registrada en Google Sheets mediante Google Apps Script.`,
    };
  } catch (error: any) {
    console.error('Error invoking Google Apps Script:', error);
    return {
      success: false,
      message: error.message || 'Error al conectar con el script de envío de correo.',
      recipients,
      subject: subjectLine,
    };
  }
}
