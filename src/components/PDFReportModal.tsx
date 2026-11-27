import React, { useState } from 'react';
import { EvaluationReport } from '../types';
import { X, Printer, Mail, Download, CheckCircle2, AlertTriangle, Send, Loader2, FileDown, Check, AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { downloadReportPDF } from '../utils/pdfGenerator';
import { getCompanyLogo } from '../assets/logo';
import { sanitizeReport } from '../lib/storage';
import { formatDateDDMMYYYY, markReportAsSynced } from '../lib/googleSheetsSync';
import { sendReportEmailViaScript, SendEmailResult } from '../utils/emailService';

interface PDFReportModalProps {
  report: EvaluationReport;
  onClose: () => void;
  onOpenEmailModal?: () => void;
  initialEmailStatusMessage?: string | null;
  sheetsStatus?: { success: boolean; message: string } | null;
  onRetrySheetsExport?: (report: EvaluationReport) => Promise<{ success: boolean; message: string }>;
}

export const PDFReportModal: React.FC<PDFReportModalProps> = ({
  report: rawReport,
  onClose,
  initialEmailStatusMessage,
  sheetsStatus: initialSheetsStatus = null,
  onRetrySheetsExport,
}) => {
  const report = sanitizeReport(rawReport);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Direct email sending states
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<SendEmailResult | null>(
    initialEmailStatusMessage
      ? {
          success: true,
          message: initialEmailStatusMessage,
          recipients: report.emailSentTo || [],
          subject: '',
        }
      : null
  );
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(initialEmailStatusMessage || null);
  const [sheetsStatus, setSheetsStatus] = useState<{ success: boolean; message: string } | null>(initialSheetsStatus);
  const [isRetryingSheets, setIsRetryingSheets] = useState(false);

  const handleRetrySheets = async () => {
    if (!onRetrySheetsExport || isRetryingSheets) return;
    setIsRetryingSheets(true);
    try {
      const res = await onRetrySheetsExport(report);
      setSheetsStatus(res);
    } catch (err: any) {
      setSheetsStatus({
        success: false,
        message: err?.message || 'No se pudo guardar en Google Sheets.',
      });
    } finally {
      setIsRetryingSheets(false);
    }
  };

  const handlePrintOrDownload = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setDownloadSuccess(false);

    try {
      await downloadReportPDF(report);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      // Fallback in case browser environment permits window.print
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmailDirect = async () => {
    if (isSendingEmail) return;
    setIsSendingEmail(true);
    setEmailStatusMessage(null);
    setEmailResult(null);

    try {
      const result = await sendReportEmailViaScript(report);
      setEmailResult(result);
      if (result.success) {
        setEmailStatusMessage(`¡Correo enviado exitosamente! Se despachó el acta ${report.code} a: ${result.recipients.join(', ')}`);
        if (result.savedToSheet) {
          markReportAsSynced(report);
          setSheetsStatus({
            success: true,
            message: result.sheetMessage || `Acta ${report.code} guardada en Google Sheets.`,
          });
        }
      } else {
        setEmailStatusMessage(`No se pudo completar el envío: ${result.message}`);
      }
    } catch (err: any) {
      console.error('Error sending email:', err);
      setEmailStatusMessage(`Error al enviar el correo: ${err.message || 'Error de comunicación'}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Modal Top Bar */}
        <div className="bg-[#00796B] text-white p-4 rounded-t-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-wide">ACTA VIRTUAL PDF:</span>
            <span className="bg-white/20 px-2.5 py-0.5 rounded text-xs font-mono font-bold">
              {report.code}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrintOrDownload}
              disabled={isGenerating}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs ${
                downloadSuccess
                  ? 'bg-emerald-500 text-white'
                  : isGenerating
                  ? 'bg-white/30 text-white cursor-wait'
                  : 'bg-white/20 hover:bg-white/30 text-white active:scale-95'
              }`}
              title="Descargar Acta en PDF / Imprimir"
              id="pdf-modal-print-btn"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>¡PDF Descargado!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Descargar PDF / Imprimir</span>
                  <span className="sm:hidden">PDF</span>
                </>
              )}
            </button>

            {/* Direct 1-Click Send Email via Google Apps Script */}
            <button
              onClick={handleSendEmailDirect}
              disabled={isSendingEmail}
              className={`p-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs ${
                emailResult?.success
                  ? 'bg-emerald-600 text-white'
                  : isSendingEmail
                  ? 'bg-white/30 text-white cursor-wait'
                  : 'bg-white text-[#00796B] hover:bg-teal-50 active:scale-95'
              }`}
              title="Enviar acta directamente por correo electrónico con Google Apps Script"
              id="pdf-modal-email-btn"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando correo...</span>
                </>
              ) : emailResult?.success ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">¡Correo Enviado!</span>
                  <span className="sm:hidden">Enviado</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span className="hidden sm:inline">Enviar Correo</span>
                  <span className="sm:hidden">Enviar</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              id="pdf-modal-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Email Status Notification Banner (shown directly upon sending) */}
        {emailStatusMessage && (
          <div
            className={`px-4 py-2.5 flex items-center justify-between text-xs font-medium border-b shrink-0 animate-in fade-in slide-in-from-top-1 ${
              emailResult?.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {emailResult?.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{emailStatusMessage}</span>
            </div>
            <button
              onClick={() => setEmailStatusMessage(null)}
              className="p-1 hover:bg-black/5 rounded text-slate-500 hover:text-slate-700"
              title="Cerrar notificación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Google Sheets Database Sync Status Banner */}
        {sheetsStatus && (
          <div
            className={`px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-medium border-b shrink-0 ${
              sheetsStatus.success
                ? 'bg-teal-50 text-teal-900 border-teal-200'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}
          >
            <div className="flex items-start sm:items-center space-x-2">
              {sheetsStatus.success ? (
                <FileSpreadsheet className="w-4 h-4 text-teal-700 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <span>
                <strong>Base de Datos (Google Sheets):</strong> {sheetsStatus.message}
              </span>
            </div>
            {!sheetsStatus.success && onRetrySheetsExport && (
              <button
                type="button"
                onClick={handleRetrySheets}
                disabled={isRetryingSheets}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-colors disabled:opacity-60 self-start sm:self-auto"
                id="pdf-modal-retry-sheets-btn"
              >
                {isRetryingSheets ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{isRetryingSheets ? 'Guardando...' : 'Reintentar Guardar en Sheets'}</span>
              </button>
            )}
          </div>
        )}

        {/* Document Body (Printable Area) */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800" id="printable-area">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Logo block */}
              <div className="inline-flex items-center select-none shrink-0">
                <img
                  src={getCompanyLogo()}
                  alt="Incubadora Santander S.A."
                  style={{ height: '50px', width: 'auto', maxWidth: '170px' }}
                  className="h-[50px] w-auto max-w-[170px] object-contain block"
                />
              </div>

              <div>
                <span className="text-xs font-bold text-[#162e84] uppercase tracking-widest block">
                  GESTIÓN DE MANTENIMIENTO
                </span>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 uppercase leading-tight">
                  GMI-F-35 ACTA DE RECIBIDO DE MANTENIMIENTO TIPO OVERHAUL
                </h1>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-right shrink-0">
              <div className="text-[10px] text-slate-500 font-bold uppercase">CÓDIGO DE DOCUMENTO</div>
              <div className="text-base font-extrabold text-[#162e84] font-mono">{report.code}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                Fecha: {formatDateDDMMYYYY(report.fechaPruebaConCarga || report.evaluationDate)}
              </div>
            </div>
          </div>

          {/* General Metadata Table - Complete General Information Questions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">ZONA / FABRICANTE</span>
              <span className="font-bold text-slate-900">{report.zone || report.zonaNombre || 'ZUCAMI'}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">GRANJA</span>
              <span className="font-bold text-slate-900">{report.farm || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">GALPÓN / ESTRUCTURA</span>
              <span className="font-bold text-slate-900">{report.galpon || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">NÚMERO OT MP</span>
              <span className="font-bold text-slate-900">{report.numeroOtMp || 'N/A'}</span>
            </div>

            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">TIPO DE JAULA</span>
              <span className="font-bold text-slate-900">{report.cageType || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">DÍAS VACÍO SANITARIO</span>
              <span className="font-bold text-slate-900">
                {report.diasVacioSanitario !== undefined && report.diasVacioSanitario !== null
                  ? `${report.diasVacioSanitario} días`
                  : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">INICIO MANTENIMIENTO</span>
              <span className="font-bold text-slate-900">
                {formatDateDDMMYYYY(report.fechaInicioMantenimiento) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">DÍAS MTTO PROGRAMADOS</span>
              <span className="font-bold text-slate-900">
                {report.diasMantenimientoProgramados !== undefined && report.diasMantenimientoProgramados !== null
                  ? `${report.diasMantenimientoProgramados} días`
                  : 'N/A'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">INICIO + DÍAS PROGRAMADOS</span>
              <span className="font-bold text-slate-900">
                {formatDateDDMMYYYY(report.fechaInicioMasDiasProgramados) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">FECHA FINALIZACIÓN</span>
              <span className="font-bold text-slate-900">
                {formatDateDDMMYYYY(report.fechaFinalizacion) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">FINALIZACIÓN 100%</span>
              <span className="font-bold text-slate-900">
                {formatDateDDMMYYYY(report.fechaFinalizacion100) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">ENTREGA A PRODUCCIÓN</span>
              <span className="font-bold text-slate-900">
                {formatDateDDMMYYYY(report.fechaEntregaVacioProduccion) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 uppercase text-[10px] font-bold block">FECHA PRUEBA CON CARGA</span>
              <span className="font-bold text-amber-900">
                {formatDateDDMMYYYY(report.fechaPruebaConCarga || report.pruebaConCarga?.fechaPruebaConCarga) || 'N/A'}
              </span>
            </div>
          </div>

          {/* Score Summary Banner */}
          {(() => {
            const isCarga = report.reportType === 'PRUEBAS_CARGA';
            const s = report.totalScore;
            const is100 = s === 100;
            const is90Plus = s >= 90 && s < 100;

            const bannerStyle = isCarga
              ? 'bg-amber-50 border-amber-200'
              : is100
              ? 'bg-emerald-50 border-emerald-200'
              : is90Plus
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200';

            const iconBg = isCarga
              ? 'bg-amber-600'
              : is100
              ? 'bg-emerald-600'
              : is90Plus
              ? 'bg-amber-500'
              : 'bg-red-600';

            const titleColor = isCarga
              ? 'text-amber-900'
              : is100
              ? 'text-emerald-900'
              : is90Plus
              ? 'text-amber-900'
              : 'text-red-900';

            const subColor = isCarga
              ? 'text-amber-700'
              : is100
              ? 'text-emerald-700'
              : is90Plus
              ? 'text-amber-700'
              : 'text-red-700';

            const scoreColor = is100
              ? 'text-emerald-700'
              : is90Plus
              ? 'text-amber-600'
              : 'text-red-600';

            return (
              <div className={`${bannerStyle} border rounded-xl p-4 flex items-center justify-between`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full ${iconBg} text-white flex items-center justify-center font-bold`}>
                    ✓
                  </div>
                  <div>
                    <span className={`text-xs font-bold ${titleColor} uppercase block`}>
                      {isCarga ? 'Revisión Técnica con Carga' : 'Resultado de Evaluación'}
                    </span>
                    <span className={`text-xs ${subColor}`}>
                      {isCarga
                        ? `${report.totalFailures ?? 0} fallas presentadas en total desde encasetamiento (7 Sistemas Evaluados)`
                        : `${report.passedItems} Sobre el 100% · ${report.failedItems} Por debajo del 100%`}
                    </span>
                  </div>
                </div>

                {!isCarga && (
                  <div className="text-right">
                    <span className={`text-[10px] font-bold uppercase ${scoreColor} block`}>
                      % Cumplimiento
                    </span>
                    <span className={`text-2xl font-black ${scoreColor}`}>{report.totalScore}%</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Sections Breakdown */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide border-b pb-1">
              {report.reportType === 'PRUEBAS_CARGA' ? 'DETALLE DE REVISIÓN DE CONFIABILIDAD' : 'DETALLE DE CRITERIOS EVALUADOS'}
            </h3>

            {report.sections.map((section) => (
              <div key={section.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800 uppercase">
                  {section.title}
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase">
                      <th className="p-2">Sistema / Descripción</th>
                      <th className="p-2 w-32 text-center">{report.reportType === 'PRUEBAS_CARGA' ? 'Cant. Fallas' : 'Calificación'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, idx) => {
                      if (report.reportType === 'PRUEBAS_CARGA') {
                        const failures = item.failuresCount ?? 0;
                        return (
                          <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="p-2.5 font-medium text-slate-800">
                              <div className="font-bold">{idx + 1}. {item.question}</div>
                              {item.criteria && (
                                <div className="text-[11px] text-slate-500 mt-0.5">{item.criteria}</div>
                              )}
                              {item.observation && (
                                <div className="text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200 px-2 py-0.5 rounded mt-1 inline-block">
                                  <span className="font-bold">Obs:</span> {item.observation}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 w-32 text-center font-extrabold">
                              <span className={`px-2.5 py-1 rounded-md border text-xs font-bold inline-block min-w-[70px] ${
                                failures === 0
                                  ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                  : 'text-amber-800 bg-amber-50 border-amber-200'
                              }`}>
                                {failures} {failures === 1 ? 'Falla' : 'Fallas'}
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      const scoreInfo = (() => {
                        if (item.score !== undefined && item.score !== null) {
                          const s = item.score;
                          if (s === 100) return { label: `${s}%`, className: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
                          if (s >= 90) return { label: `${s}%`, className: 'text-amber-800 bg-amber-50 border-amber-200' };
                          return { label: `${s}%`, className: 'text-red-800 bg-red-50 border-red-200' };
                        }
                        if (item.status === 'cumple') return { label: '100%', className: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
                        if (item.status === 'no_cumple') return { label: '0%', className: 'text-red-800 bg-red-50 border-red-200' };
                        return { label: 'N/A', className: 'text-slate-600 bg-slate-100 border-slate-200' };
                      })();

                      return (
                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="p-2.5 font-medium text-slate-800">
                            <div>{item.question}</div>
                            {item.criteria && (
                              <div className="text-[11px] text-slate-500 italic mt-0.5">{item.criteria}</div>
                            )}
                            {item.observation && (
                              <div className="text-[11px] text-teal-800 bg-teal-50/70 border border-teal-100 px-2 py-0.5 rounded mt-1 inline-block">
                                <span className="font-bold">Obs:</span> {item.observation}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 w-28 text-center font-extrabold">
                            <span className={`px-2.5 py-1 rounded-md border text-xs font-bold inline-block min-w-[50px] ${scoreInfo.className}`}>
                              {scoreInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Notes */}
          {report.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-1">
              <span className="font-bold text-amber-900 uppercase block">Observaciones del Inspector:</span>
              <p className="text-slate-700 italic">{report.notes}</p>
            </div>
          )}

          {/* Signatures Section */}
          <div className="pt-6 border-t border-slate-200">
            <h3 className="font-bold text-xs text-slate-500 uppercase tracking-widest mb-5 text-center">
              FIRMAS DE CONFORMIDAD DE ENTREGA
            </h3>

            <div className="flex flex-wrap justify-center gap-5 text-center">
              {(report.signatures || []).filter((s) => s.nombre && s.nombre.trim() !== '').map((sig, idx) => (
                <div key={idx} className="w-[215px] border border-slate-200 rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between">
                  <div className="h-14 flex items-center justify-center mb-1">
                    {sig.signatureDataUrl ? (
                      <img src={sig.signatureDataUrl} alt="Firma" className="max-h-12 max-w-[150px] object-contain" />
                    ) : (
                      <div className="h-6 border-b border-dashed border-slate-300 w-3/4"></div>
                    )}
                  </div>
                  <div className="border-t-2 border-slate-800 pt-2 px-1">
                    <div className="font-bold text-xs text-slate-900 leading-tight">{sig.nombre}</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">{sig.cargo || 'Asistente'}</div>
                    <div className="text-[9px] text-teal-800 font-mono mt-1 break-all">{sig.correo}</div>
                    {sig.signedAt && (
                      <div className="text-[8.5px] text-slate-400 mt-1">Firmado: {sig.signedAt}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 rounded-b-2xl text-center text-[11px] text-slate-500">
          Documento generado automáticamente por el Sistema de Evaluación Overhaul - Huevos Kikes.
        </div>
      </div>
    </div>
  );
};
