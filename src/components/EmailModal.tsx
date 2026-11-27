import React, { useState, useEffect } from 'react';
import { EvaluationReport } from '../types';
import { X, Mail, Send, CheckCircle2, Paperclip, ExternalLink, Printer, Code2, Copy, Check, Terminal } from 'lucide-react';
import { generateReportPDFBase64 } from '../utils/pdfGenerator';
import { sanitizeReport } from '../lib/storage';

interface EmailModalProps {
  report: EvaluationReport;
  onClose: () => void;
}

export const EmailModal: React.FC<EmailModalProps> = ({ report: rawReport, onClose }) => {
  const report = sanitizeReport(rawReport);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [sendMode, setSendMode] = useState<'mailto' | 'smtp' | 'apps_script' | null>(null);
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [showScriptConfig, setShowScriptConfig] = useState(false);
  const [scriptResult, setScriptResult] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const DEFAULT_SCRIPT_URL = 'https://script.google.com/a/macros/kikes.com.co/s/AKfycbxLs1eWLPqTQbKUSxhPfs8NdO-tO8wiDhUg40Et09Fy4bPC_onHvRjYX-Tf1bMce1i8Tw/exec';

  useEffect(() => {
    try {
      let savedUrl = localStorage.getItem('apps_script_url');
      if (
        !savedUrl ||
        savedUrl.includes('AKfycbyPI-oPCVtFWbLgl2f0wjPhyy9f4MM-p_4c8i_yj7QNoWV69lu2CAglwzsfSkQfhkfK8A') ||
        savedUrl === 'https://script.google.com/macros/s/AKfycbxLs1eWLPqTQbKUSxhPfs8NdO-tO8wiDhUg40Et09Fy4bPC_onHvRjYX-Tf1bMce1i8Tw/exec'
      ) {
        savedUrl = DEFAULT_SCRIPT_URL;
        localStorage.setItem('apps_script_url', DEFAULT_SCRIPT_URL);
      }
      setAppsScriptUrl(savedUrl);
    } catch {
      setAppsScriptUrl(DEFAULT_SCRIPT_URL);
    }
  }, []);

  const handleSaveScriptUrl = (url: string) => {
    // Automatically normalize domain workspace URLs to standard public web app format
    let cleanUrl = url.trim();
    if (cleanUrl.includes('/a/macros/')) {
      cleanUrl = cleanUrl.replace(/\/a\/macros\/[^\/]+\//, '/');
    }
    setAppsScriptUrl(cleanUrl);
    try {
      localStorage.setItem('apps_script_url', cleanUrl);
    } catch {
      // Ignore storage quota errors
    }
  };

  const defaultRecipients = (report.emailSentTo && report.emailSentTo.length > 0)
    ? report.emailSentTo
    : report.signatures.map((s) => s.correo).filter((v, i, a) => v && v.trim() !== '' && a.indexOf(v) === i);

  const buildLocationText = (): { zonaAnswer: string; questionLabel: string; questionAnswer: string; fullLocation: string } => {
    // 1. Answer to ZONA question: Prioritize report.zone over any stale zonaNombre
    const zonaAnswer = (report.zone && report.zone.trim())
      ? report.zone.trim().toUpperCase()
      : (report.zonaNombre || 'ZUCAMI').trim().toUpperCase();

    // 2. Determine whether to append GALPON or GRANJA
    const isPisoOrRoble = report.zone === 'GRANJAS PISO' || report.zone === 'EL ROBLE';

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

    return { zonaAnswer, questionLabel, questionAnswer, fullLocation };
  };

  const locationInfo = buildLocationText();
  const subjectLine = `ENVÍO DE ACTA DE RECIBIDO GRANJA ${locationInfo.fullLocation}`;

  const asistentesList = (report.signatures && report.signatures.length > 0)
    ? report.signatures
        .filter((s) => s.nombre && s.nombre.trim() !== '')
        .map((s) => `Nombre: ${s.nombre.trim()}, Cargo: ${s.cargo ? s.cargo.trim() : ''}`)
        .join('\n')
    : 'Sin asistentes registrados.';

  const emailBodyText = `Cordial saludo,

Se envía el acta de entrega del ${locationInfo.fullLocation}

ASISTENTES

${asistentesList}`;

  // Builds payload matching AppSheet function `correoZucami` parameters
  const buildAppsScriptPayload = async () => {
    const sigs = report.signatures || [];
    let pdfData = { base64: '', fileName: `ACTA_${report.code || 'OVERHAUL'}.pdf` };

    try {
      pdfData = await generateReportPDFBase64(report);
    } catch (e) {
      console.warn('Could not generate PDF base64 attachment:', e);
    }

    return {
      subject: subjectLine,
      body: emailBodyText,
      locationText: locationInfo.fullLocation,
      asistentesText: asistentesList,
      galpon: report.galpon,
      granja: report.farm,
      zona: report.zone || report.zonaNombre,
      puntaje: report.totalScore,
      status: report.status,
      reportCode: report.code,
      destinatarios: defaultRecipients,

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
    };
  };

  const handleOpenMailClient = () => {
    setIsSending(true);
    const recipientsString = defaultRecipients.join(',');
    const mailtoUrl = `mailto:${recipientsString}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(emailBodyText)}`;

    window.location.href = mailtoUrl;

    setTimeout(() => {
      setIsSending(false);
      setSendMode('mailto');
      setIsSent(true);
    }, 800);
  };

  const handleSendServerEmail = async () => {
    setIsSending(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: defaultRecipients,
          subject: subjectLine,
          text: emailBodyText,
          reportCode: report.code,
        }),
      });
      const data = await res.json();
      setIsSending(false);

      if (data.success && data.mode === 'smtp') {
        setSendMode('smtp');
        setIsSent(true);
      } else {
        handleOpenMailClient();
      }
    } catch (e) {
      console.warn('API send error, falling back to mailto', e);
      handleOpenMailClient();
    }
  };

  const handleTriggerAppsScript = async () => {
    if (!appsScriptUrl.trim()) {
      setShowScriptConfig(true);
      return;
    }

    setIsSending(true);
    setScriptResult(null);

    const payload = await buildAppsScriptPayload();
    let targetUrl = appsScriptUrl.trim();

    try {
      // First attempt: Server-side proxy call
      const res = await fetch('/api/trigger-apps-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl: targetUrl,
          payload,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setIsSending(false);
        setSendMode('apps_script');
        setIsSent(true);
        return;
      }

      // Second attempt: Direct browser form submission (carries active KIKES Google login cookies from browser)
      console.log('Server proxy required auth, executing browser direct POST:', data.message);

      await new Promise<void>((resolve) => {
        const iframeName = 'gas_iframe_' + Date.now();
        const iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = targetUrl;
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
        setTimeout(cleanup, 2000);
      });

      setIsSending(false);
      setSendMode('apps_script');
      setIsSent(true);

    } catch (err: any) {
      console.error('Error triggering Apps Script:', err);
      setIsSending(false);
      setScriptResult(err.message || 'Error de conexión');
    }
  };

  const appsScriptTemplate = `function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    supportsSheetsWrite: true
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = {};
    if (e.parameter && e.parameter.payload) {
      data = JSON.parse(e.parameter.payload);
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    var savedToSheet = false;
    var sheetMessage = "";

    // 0. Guardar o actualizar fila en Google Sheets si viene sheetSyncData (permite guardar sin OAuth del técnico)
    if (data.sheetSyncData && data.sheetSyncData.spreadsheetId && data.sheetSyncData.tabName) {
      try {
        var sync = data.sheetSyncData;
        var ss = SpreadsheetApp.openById(sync.spreadsheetId);
        var sheet = ss.getSheetByName(sync.tabName);
        if (!sheet) {
          sheet = ss.insertSheet(sync.tabName);
        }

        // Asegurar encabezados si la hoja está vacía
        if (sheet.getLastRow() === 0 && Array.isArray(sync.headers) && sync.headers.length > 0) {
          sheet.getRange(1, 1, 1, sync.headers.length).setValues([sync.headers]);
          sheet.getRange(1, 1, 1, sync.headers.length)
            .setBackground("#162a78")
            .setFontColor("#ffffff")
            .setFontWeight("bold")
            .setHorizontalAlignment("center");
          sheet.setFrozenRows(1);
        }

        var rowValues = sync.rowValues || [];
        var finalRow = rowValues.slice();

        // Alinear valores con los encabezados reales de la fila 1 si ya existen
        if (sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 1 && Array.isArray(sync.headers) && sync.headers.length > 0 && rowValues.length > 0) {
          var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          var normFn = function(s) {
            return (s || "").toString().trim().toUpperCase().replace(/\\s+/g, " ");
          };
          var stripFn = function(s) {
            return normFn(s).replace(/^\\d+[\\.\\)]\\s*/, "").trim();
          };
          var isObsFn = function(s) {
            var n = normFn(s);
            return n.indexOf("OBSERVACIONES:") !== -1 || n.indexOf("[OBSERVACIONES]") !== -1;
          };

          var headerIndexMap = {};
          var strippedIndexMap = {};
          for (var c = 0; c < existingHeaders.length; c++) {
            var nh = normFn(existingHeaders[c]);
            if (nh && headerIndexMap[nh] === undefined) headerIndexMap[nh] = c;
            var sk = (isObsFn(nh) ? "OBS:" : "SCR:") + stripFn(nh);
            if (stripFn(nh) && strippedIndexMap[sk] === undefined) strippedIndexMap[sk] = c;
          }

          if (Object.keys(headerIndexMap).length > 0) {
            var aligned = new Array(Math.max(existingHeaders.length, rowValues.length));
            for (var k = 0; k < aligned.length; k++) aligned[k] = "";
            for (var i = 0; i < sync.headers.length && i < rowValues.length; i++) {
              var hNorm = normFn(sync.headers[i]);
              var targetCol = headerIndexMap[hNorm];
              if (targetCol === undefined) {
                var hStripped = (isObsFn(hNorm) ? "OBS:" : "SCR:") + stripFn(hNorm);
                targetCol = strippedIndexMap[hStripped];
              }
              if (targetCol === undefined) targetCol = i;
              aligned[targetCol] = rowValues[i];
            }
            finalRow = aligned;
          }
        }

        var code = (sync.reportCode || "").toString().trim().toUpperCase();
        var targetRow = -1;

        if (code && sheet.getLastRow() > 1) {
          var colA = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
          for (var r = 1; r < colA.length; r++) {
            if ((colA[r][0] || "").toString().trim().toUpperCase() === code) {
              targetRow = r + 1;
              break;
            }
          }
        }

        if (finalRow.length > 0) {
          if (targetRow > 1) {
            sheet.getRange(targetRow, 1, 1, finalRow.length).setValues([finalRow]);
            sheetMessage = "Acta " + code + " actualizada en la fila " + targetRow + " de " + sync.tabName;
          } else {
            sheet.appendRow(finalRow);
            sheetMessage = "Acta " + code + " guardada en la pestaña " + sync.tabName;
          }
          savedToSheet = true;
        }

        // Guardar firmas en CONFIG_FIRMAS_ACTAS
        if (sync.signaturesMeta && sync.signaturesMeta.code) {
          var sigTab = ss.getSheetByName("CONFIG_FIRMAS_ACTAS") || ss.insertSheet("CONFIG_FIRMAS_ACTAS");
          if (sigTab.getLastRow() === 0) {
            sigTab.getRange(1, 1, 1, 5).setValues([["Código Acta", "Firmas JSON", "Correos Enviados", "Notas", "Actualizado"]]);
          }
          var sigCode = sync.signaturesMeta.code.toString().trim().toUpperCase();
          var sigColA = sigTab.getRange(1, 1, sigTab.getLastRow(), 1).getValues();
          var sigRowIdx = -1;
          for (var sr = 1; sr < sigColA.length; sr++) {
            if ((sigColA[sr][0] || "").toString().trim().toUpperCase() === sigCode) {
              sigRowIdx = sr + 1;
              break;
            }
          }
          var sigRow = [
            sigCode,
            sync.signaturesMeta.signaturesJson || "[]",
            sync.signaturesMeta.emailSentTo || "",
            sync.signaturesMeta.notes || "",
            new Date().toISOString()
          ];
          if (sigRowIdx > 1) {
            sigTab.getRange(sigRowIdx, 1, 1, 5).setValues([sigRow]);
          } else {
            sigTab.appendRow(sigRow);
          }
        }
      } catch (sheetErr) {
        sheetMessage = "Error guardando en hoja: " + sheetErr.toString();
      }
    }

    // Si solo era guardado en hoja (sin envío de correo), responder de inmediato
    if (data.action === "saveReportToSheet") {
      return ContentService.createTextOutput(JSON.stringify({
        status: savedToSheet ? "success" : "error",
        savedToSheet: savedToSheet,
        sheetMessage: sheetMessage,
        message: sheetMessage || "Operación en Google Sheets completada."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Obtener la lista de correos destinatarios
    var recipients = data.destinatarios;
    if (Array.isArray(recipients)) {
      recipients = recipients.filter(function(email) { return email && email.trim() !== ''; }).join(',');
    }
    
    if (!recipients || typeof recipients !== 'string' || recipients.trim() === '') {
      var correosVector = [];
      if (data.correoA) correosVector.push(data.correoA);
      if (data.correoB) correosVector.push(data.correoB);
      if (data.correoC) correosVector.push(data.correoC);
      if (data.correoD) correosVector.push(data.correoD);
      if (data.correoE) correosVector.push(data.correoE);
      recipients = correosVector.join(',');
    }
    
    if (!recipients || recipients.trim() === '') {
      recipients = "coordinador.mtto@kikes.com.co";
    }
    
    // 2. Asunto del correo
    var subject = data.subject || ("ENVÍO DE ACTA DE RECIBIDO GRANJA " + (data.locationText || (data.zona || "")));
    
    // 3. Cuerpo del correo
    var body = data.body;
    if (!body || body.trim() === '') {
      var locationText = data.locationText;
      if (!locationText) {
        var zonaStr = (data.zona || "").toString().trim().toUpperCase();
        var galponStr = (data.galpon || "").toString().trim().toUpperCase();
        var granjaStr = (data.granja || "").toString().trim().toUpperCase();
        if (galponStr !== '') {
          locationText = zonaStr + ", GALPON " + galponStr.replace(/^GALP[OÓ]N\\s*/i, '');
        } else if (granjaStr !== '') {
          locationText = zonaStr + ", GRANJA " + granjaStr.replace(/^GRANJA\\s*/i, '');
        } else {
          locationText = zonaStr;
        }
      }
      
      var asistentes = [];
      if (data.nombreA) asistentes.push("Nombre: " + data.nombreA + ", Cargo: " + (data.cargoA || ""));
      if (data.nombreB) asistentes.push("Nombre: " + data.nombreB + ", Cargo: " + (data.cargoB || ""));
      if (data.nombreC) asistentes.push("Nombre: " + data.nombreC + ", Cargo: " + (data.cargoC || ""));
      if (data.nombreD) asistentes.push("Nombre: " + data.nombreD + ", Cargo: " + (data.cargoD || ""));
      if (data.nombreE) asistentes.push("Nombre: " + data.nombreE + ", Cargo: " + (data.cargoE || ""));
      
      var asistentesStr = asistentes.length > 0 ? asistentes.join("\\n") : "Sin asistentes registrados.";
      
      body = "Cordial saludo,\\n\\nSe envía el acta de entrega del " + locationText + "\\n\\nASISTENTES\\n\\n" + asistentesStr + "\\n\\n\\n** Correo generado automáticamente desde Sistema Overhaul Kikes. **";
    }
    
    // 4. Adjuntar el PDF digital generado por la aplicación (GMI-F-35)
    var mailOptions = { noReply: true };
    var docAdjunto = null;
    
    if (data.pdfBase64 && data.pdfBase64.trim() !== '') {
      var base64Clean = data.pdfBase64.replace(/^data:application\\/pdf;base64,/, '');
      var pdfBytes = Utilities.base64Decode(base64Clean);
      var fileName = data.pdfName || ("ACTA_" + (data.reportCode || "OVERHAUL") + ".pdf");
      if (!fileName.toLowerCase().endsWith(".pdf")) {
        fileName += ".pdf";
      }
      docAdjunto = Utilities.newBlob(pdfBytes, "application/pdf", fileName);
      mailOptions.attachments = [docAdjunto];
    }
    
    // 5. Enviar el correo principal a los asistentes
    GmailApp.sendEmail(recipients, subject, body, mailOptions);
    
    // 6. Enviar copias a Jefaturas si están marcadas
    var cuerpoCorreoJefe = "Cordial saludo,\\n\\nSe envía el acta de entrega del " + (data.locationText || "mantenimiento") + "\\n\\n";
    
    if (data.correoJefeIndustrial == "SI") {
      GmailApp.sendEmail("daniel.mesa@kikes.com.co", subject, cuerpoCorreoJefe, mailOptions);
    }
    if (data.correoJefeSantander == "SI") {
      GmailApp.sendEmail("jose.pinzon@kikes.com.co", subject, cuerpoCorreoJefe, mailOptions);
    }
    if (data.correoCoordinador == "SI") {
      GmailApp.sendEmail("jairo.useda@kikes.com.co", subject, cuerpoCorreoJefe, mailOptions);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      savedToSheet: savedToSheet,
      sheetMessage: sheetMessage,
      message: "Acta GMI-F-35 y correo enviados exitosamente a: " + recipients
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyAppsScriptCode = () => {
    navigator.clipboard.writeText(appsScriptTemplate);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-[#00796B]">
            <Mail className="w-5 h-5" />
            <h3 className="font-bold text-lg text-slate-800">
              Despacho de Correo - Acta Virtual
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
            id="close-email-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isSent ? (
          <div className="mt-4 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
              <strong>Opciones de envío:</strong> Puede enviar mediante el <strong>Script de Google Apps Script (`correoZucami`)</strong>, mediante su cliente de correo local (Outlook/Gmail) o servidor SMTP.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Destinatarios del Correo ({defaultRecipients.length})
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                {defaultRecipients.length > 0 ? (
                  defaultRecipients.map((email) => (
                    <div key={email} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200">
                      <span className="font-medium text-slate-800">{email}</span>
                      <span className="text-[10px] font-bold text-teal-700 uppercase bg-teal-50 px-1.5 py-0.5 rounded">
                        Destinatario
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 p-2 text-center italic">No hay correos seleccionados</div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Asunto del Mensaje
              </label>
              <input
                type="text"
                readOnly
                value={subjectLine}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Cuerpo del Mensaje
              </label>
              <textarea
                readOnly
                rows={5}
                value={emailBodyText}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-sans leading-relaxed resize-none"
              />
            </div>

            {/* Google Apps Script Integration Section */}
            <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-teal-900 font-bold text-xs">
                  <Terminal className="w-4 h-4 text-teal-700" />
                  <span>Google Apps Script (`correoZucami`)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScriptConfig(!showScriptConfig)}
                  className="text-[11px] font-bold text-teal-800 hover:underline flex items-center space-x-1"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showScriptConfig ? 'Ocultar Configuración' : 'Configurar URL Script'}</span>
                </button>
              </div>

              {showScriptConfig && (
                <div className="space-y-2 pt-1 border-t border-teal-200 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      URL del Web App de Google Apps Script:
                    </label>
                    <input
                      type="url"
                      value={appsScriptUrl}
                      onChange={(e) => handleSaveScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="bg-white border border-teal-200 rounded-lg p-2.5 space-y-1.5 text-[11px] text-slate-600">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>Instrucciones para Apps Script:</span>
                      <button
                        type="button"
                        onClick={copyAppsScriptCode}
                        className="text-teal-700 hover:text-teal-900 flex items-center space-x-1 bg-teal-50 px-2 py-0.5 rounded border border-teal-300 font-semibold"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCode ? '¡Copiado!' : 'Copiar Código'}</span>
                      </button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-slate-700 bg-teal-50/80 border border-teal-200 p-2 rounded">
                      <strong>✅ Compatibilidad KIKES Workspace:</strong> Puede seleccionar <strong>"Anyone within KIKES"</strong> o <strong>"Anyone"</strong>. La aplicación detecta automáticamente su sesión de Google en el navegador y ejecuta el script usando sus credenciales corporativas.
                    </p>
                  </div>
                </div>
              )}

              {scriptResult && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded-lg text-xs font-medium">
                  {scriptResult}
                </div>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    Adjunto: {report.code}.pdf
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Puntaje {report.totalScore}% - {report.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="text-[#00796B] hover:text-[#005B52] font-bold text-xs flex items-center space-x-1 bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-200"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / PDF</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleTriggerAppsScript}
                disabled={isSending}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white rounded-xl flex items-center justify-center space-x-1.5 shadow"
                id="send-apps-script-btn"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Ejecutar Script Google Apps Script</span>
              </button>

              <button
                type="button"
                onClick={handleOpenMailClient}
                disabled={isSending || defaultRecipients.length === 0}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center justify-center space-x-1.5 shadow"
                id="send-email-client-btn"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Cliente de Correo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-lg text-slate-800">
              {sendMode === 'apps_script'
                ? '¡Script ejecutado exitosamente!'
                : sendMode === 'smtp'
                ? '¡Correo Enviado desde el Servidor!'
                : '¡Cliente de Correo Abierto!'}
            </h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              {sendMode === 'apps_script' ? (
                <>Se ejecutó el script de Google Apps Script (<strong>correoZucami</strong>) enviando los datos del acta y notificando a <strong>{defaultRecipients.join(', ')}</strong>.</>
              ) : sendMode === 'smtp' ? (
                <>El correo fue entregado a los servidores SMTP hacia <strong>{defaultRecipients.join(', ')}</strong>.</>
              ) : (
                <>Se ha abierto su aplicación de correo (Outlook / Gmail) dirigida a <strong>{defaultRecipients.join(', ')}</strong>.</>
              )}
            </p>
            <div className="pt-2">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[#00796B] text-white text-xs font-bold rounded-xl hover:bg-[#005B52] shadow"
              >
                Aceptar y Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
