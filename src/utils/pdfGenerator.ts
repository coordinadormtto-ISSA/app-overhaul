import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { EvaluationReport, EvaluationItem } from '../types';
import { renderIncubadoraLogoHtml } from '../assets/logo';
import { sanitizeReport } from '../lib/storage';
import { formatDateDDMMYYYY } from '../lib/googleSheetsSync';

function getItemScoreInfo(item: EvaluationItem): { label: string; bg: string; color: string; border: string } {
  if (item.score !== undefined && item.score !== null) {
    const s = item.score;
    if (s === 100) {
      return { label: `${s}%`, bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
    } else if (s >= 90) {
      return { label: `${s}%`, bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
    } else {
      return { label: `${s}%`, bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
    }
  }

  if (item.status === 'cumple') {
    return { label: '100%', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  } else if (item.status === 'no_cumple') {
    return { label: '0%', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
  }

  return { label: 'N/A', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
}

export interface GeneratedPDFResult {
  doc: jsPDF;
  fileName: string;
  blob: Blob;
  base64: string;
}

function renderSectionHtml(sectionTitle: string, items: EvaluationItem[], isContinuation: boolean = false, isCarga: boolean = false): string {
  const itemsHtml = items
    .map((item, idx) => {
      if (isCarga) {
        const failures = item.failuresCount ?? 0;
        const failureBadge = failures === 0
          ? `<span style="display: inline-block; min-width: 60px; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 5px; font-weight: 800; font-size: 10.5px;">0 Fallas</span>`
          : `<span style="display: inline-block; min-width: 60px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 5px; font-weight: 800; font-size: 10.5px;">${failures} ${failures === 1 ? 'Falla' : 'Fallas'}</span>`;

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 7px 10px; font-size: 10px; color: #1e293b; vertical-align: middle;">
              <div style="font-weight: 700; color: #0f172a; text-transform: uppercase;">${idx + 1}. ${item.question}</div>
              ${item.criteria ? `<div style="font-size: 8.5px; color: #64748b; margin-top: 1.5px; line-height: 1.3;">${item.criteria}</div>` : ''}
              ${item.observation ? `<div style="font-size: 9px; color: #b45309; background: #fffbeb; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 2px; border: 1px solid #fef3c7;"><strong>Obs:</strong> ${item.observation}</div>` : ''}
            </td>
            <td style="padding: 7px 10px; text-align: center; width: 95px; vertical-align: middle;">
              ${failureBadge}
            </td>
          </tr>
        `;
      }

      const scoreInfo = getItemScoreInfo(item);
      const formattedTitle = (() => {
        const q = item.question.trim();
        return /^\d+[\.\)]/.test(q) ? q : `${idx + 1}. ${q}`;
      })();

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 10px; font-size: 10px; color: #1e293b; vertical-align: middle;">
            <div style="font-weight: 600; line-height: 1.25;">${formattedTitle}</div>
            ${item.criteria ? `<div style="font-size: 9px; color: #64748b; font-style: italic; margin-top: 1px;">${item.criteria}</div>` : ''}
            ${item.observation ? `<div style="font-size: 9px; color: #0369a1; background: #f0f9ff; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 2px;"><strong>Obs:</strong> ${item.observation}</div>` : ''}
          </td>
          <td style="padding: 6px 10px; text-align: center; width: 85px; vertical-align: middle;">
            <span style="display: inline-block; min-width: 50px; color: ${scoreInfo.color}; background: ${scoreInfo.bg}; border: 1px solid ${scoreInfo.border}; padding: 2px 6px; border-radius: 5px; font-weight: 800; font-size: 11px;">
              ${scoreInfo.label}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff;">
      <div style="background-color: #f1f5f9; padding: 6px 10px; font-weight: 800; font-size: 10px; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
        <span>${sectionTitle}${isContinuation ? ' (CONTINUACIÓN)' : ''}</span>
        <span style="font-size: 9px; color: #64748b; font-weight: 600;">${items.length} sistemas</span>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #fafafa; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #64748b; text-transform: uppercase;">
            <th style="padding: 4px 10px; text-align: left; font-weight: 700;">${isCarga ? 'SISTEMA Y REVISIÓN DE CONFIABILIDAD' : 'ACTIVIDADES EVALUADAS'}</th>
            <th style="padding: 4px 10px; text-align: center; width: ${isCarga ? '95px' : '85px'}; font-weight: 700;">${isCarga ? 'CANT. FALLAS' : '% AVANCE'}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function renderHeaderBlock(report: EvaluationReport, pageNumber: number): string {
  const locationTitle = (report.zone || report.zonaNombre || 'ZUCAMI').toUpperCase();
  const farmTitle = (report.farm || '').toUpperCase();
  const galponTitle = (report.galpon || '').toUpperCase();
  const isCarga = report.reportType === 'PRUEBAS_CARGA';
  const displayFecha = formatDateDDMMYYYY(report.fechaPruebaConCarga || report.evaluationDate);

  if (pageNumber === 1) {
    const logoHtml = renderIncubadoraLogoHtml(48);
    const documentTitle = 'GMI-F-35 ACTA DE RECIBIDO DE MANTENIMIENTO TIPO OVERHAUL';

    return `
      <!-- Header Block -->
      <div style="border-bottom: 2.5px solid ${isCarga ? '#b45309' : '#162e84'}; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${logoHtml}
          <div>
            <div style="font-size: 8px; font-weight: 800; color: ${isCarga ? '#b45309' : '#162e84'}; letter-spacing: 0.8px; text-transform: uppercase;">
              GESTIÓN DE MANTENIMIENTO
            </div>
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 1px; text-transform: uppercase; line-height: 1.2;">
              ${documentTitle}
            </div>
            <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">
              CÓDIGO: <strong>${report.code}</strong> | FECHA PRUEBA: <strong>${displayFecha}</strong>
            </div>
          </div>
        </div>
        ${(() => {
          if (isCarga) {
            return `
              <div style="text-align: right; background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 14px; border-radius: 8px; flex-shrink: 0;">
                <div style="font-size: 8px; color: #64748b; font-weight: 800; text-transform: uppercase;">TOTAL FALLAS</div>
                <div style="font-size: 18px; font-weight: 900; color: #b45309; line-height: 1.1;">${report.totalFailures ?? 0}</div>
                <div style="font-size: 7.5px; font-weight: 700; color: #64748b; margin-top: 1px;">7 Sistemas</div>
              </div>
            `;
          }
          const s = report.totalScore;
          const is100 = s === 100;
          const is90Plus = s >= 90 && s < 100;
          const scoreColor = is100 ? '#047857' : is90Plus ? '#b45309' : '#b91c1c';
          const scoreBg = is100 ? '#ecfdf5' : is90Plus ? '#fffbeb' : '#fef2f2';
          const scoreBorder = is100 ? '#a7f3d0' : is90Plus ? '#fde68a' : '#fecaca';

          return `
            <div style="text-align: right; background: ${scoreBg}; border: 1px solid ${scoreBorder}; padding: 4px 12px; border-radius: 8px; flex-shrink: 0;">
              <div style="font-size: 8px; color: ${scoreColor}; font-weight: 800; text-transform: uppercase;">% CUMPLIMIENTO</div>
              <div style="font-size: 18px; font-weight: 900; color: ${scoreColor}; line-height: 1.1;">${report.totalScore}%</div>
            </div>
          `;
        })()}
      </div>

      <!-- Metadata Grid - Complete General Information Questions -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 10px; font-size: 9.5px;">
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">ZONA / FABRICANTE</span><strong>${locationTitle}</strong></div>
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">GRANJA</span><strong>${farmTitle || 'N/A'}</strong></div>
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">GALPÓN / ESTRUCTURA</span><strong>${galponTitle || 'N/A'}</strong></div>
        
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">NÚMERO OT MP</span><strong>${report.numeroOtMp || 'N/A'}</strong></div>
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">TIPO DE JAULA</span><strong>${report.cageType || 'N/A'}</strong></div>
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">DÍAS VACÍO SANITARIO</span><strong>${report.diasVacioSanitario !== undefined && report.diasVacioSanitario !== null ? `${report.diasVacioSanitario} días` : 'N/A'}</strong></div>
        
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">INICIO MTTO</span><strong>${formatDateDDMMYYYY(report.fechaInicioMantenimiento) || 'N/A'}</strong></div>
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">DÍAS MTTO PROG.</span><strong>${report.diasMantenimientoProgramados !== undefined && report.diasMantenimientoProgramados !== null ? `${report.diasMantenimientoProgramados} días` : 'N/A'}</strong></div>
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">INICIO + DÍAS PROG.</span><strong>${formatDateDDMMYYYY(report.fechaInicioMasDiasProgramados) || 'N/A'}</strong></div>
        
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">FECHA FINALIZACIÓN</span><strong>${formatDateDDMMYYYY(report.fechaFinalizacion) || 'N/A'}</strong></div>
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">FINALIZACIÓN 100%</span><strong>${formatDateDDMMYYYY(report.fechaFinalizacion100) || 'N/A'}</strong></div>
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">ENTREGA VACÍO</span><strong>${formatDateDDMMYYYY(report.fechaEntregaVacioProduccion) || 'N/A'}</strong></div>
        
        <div><span style="color: #64748b; font-size: 8px; font-weight: 700; display: block; text-transform: uppercase;">PRUEBA CON CARGA</span><strong style="color: #b45309;">${formatDateDDMMYYYY(report.fechaPruebaConCarga || report.pruebaConCarga?.fechaPruebaConCarga) || 'N/A'}</strong></div>
      </div>

      <div style="font-size: 10.5px; font-weight: 800; margin-bottom: 8px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
        ${isCarga ? 'DETALLE DE REVISIÓN DE CONFIABILIDAD (7 SISTEMAS)' : 'DETALLE DE EVALUACIÓN POR ÍTEMS'}
      </div>
    `;
  } else {
    return `
      <!-- Secondary Page Mini Header -->
      <div style="border-bottom: 1.5px solid ${isCarga ? '#b45309' : '#162e84'}; padding-bottom: 4px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 8.5px; font-weight: 800; color: ${isCarga ? '#b45309' : '#162e84'}; text-transform: uppercase;">
          INCUBADORA SANTANDER S.A. | GMI-F-35 ACTA DE RECIBIDO OVERHAUL - ${report.code}
        </div>
        <div style="font-size: 8px; color: #64748b;">
          ${galponTitle ? `GALPÓN: ${galponTitle}` : ''} | FECHA: ${displayFecha}
        </div>
      </div>
    `;
  }
}

function renderSignaturesBlock(report: EvaluationReport): string {
  const asistentesHtml = (report.signatures || [])
    .filter((s) => s.nombre && s.nombre.trim() !== '')
    .map((s) => {
      const sigImg = s.signatureDataUrl
        ? `<div style="height: 36px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;"><img src="${s.signatureDataUrl}" style="max-height: 34px; max-width: 130px; height: auto; width: auto; display: block; margin: 0 auto;" /></div>`
        : `<div style="height: 24px; border-bottom: 1px dashed #cbd5e1; margin-bottom: 4px; width: 75%; margin-left: auto; margin-right: auto;"></div>`;

      return `
        <div style="width: 195px; max-width: 210px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 9px; background: #ffffff; text-align: center; display: inline-block;">
          ${sigImg}
          <div style="border-top: 2px solid #0f172a; padding-top: 3px; font-weight: bold; font-size: 9.5px; color: #0f172a; line-height: 1.2;">
            ${s.nombre}
          </div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 1px; text-transform: uppercase; font-weight: 600;">
            ${s.cargo || 'Asistente'}
          </div>
          <div style="font-size: 8px; color: #00796B; font-family: monospace; margin-top: 1px; word-break: break-all;">
            ${s.correo || ''}
          </div>
          ${s.signedAt ? `<div style="font-size: 7.5px; color: #94a3b8; margin-top: 1px;">Firmado: ${s.signedAt}</div>` : ''}
        </div>
      `;
    })
    .join('');

  return `
    <div style="margin-top: 12px; border-top: 2px solid #00796B; padding-top: 8px; text-align: center;">
      <div style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
        ASISTENTES Y FIRMANTES DE CONFORMIDAD
      </div>
      <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 0 auto;">
        ${asistentesHtml}
      </div>
    </div>
  `;
}

export const generateReportPDF = async (rawReport: EvaluationReport): Promise<GeneratedPDFResult> => {
  const report = sanitizeReport(rawReport);
  // A4 dimensions in px at 96 DPI: 794px width x 1123px height
  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = 1123;
  const PADDING_TOP_PX = 24;
  const PADDING_BOTTOM_PX = 28;
  const PADDING_X_PX = 28;
  const FOOTER_HEIGHT_PX = 28;
  const CONTENT_WIDTH_PX = PAGE_WIDTH_PX - (PADDING_X_PX * 2); // 738px

  // Usable height inside each page
  const USABLE_PAGE_HEIGHT_PX = PAGE_HEIGHT_PX - PADDING_TOP_PX - PADDING_BOTTOM_PX - FOOTER_HEIGHT_PX;

  // Offscreen measurement container
  const measureContainer = document.createElement('div');
  measureContainer.style.position = 'absolute';
  measureContainer.style.left = '-9999px';
  measureContainer.style.top = '-9999px';
  measureContainer.style.width = `${CONTENT_WIDTH_PX}px`;
  measureContainer.style.boxSizing = 'border-box';
  measureContainer.style.fontFamily = 'Arial, Helvetica, sans-serif';
  measureContainer.style.backgroundColor = '#ffffff';
  measureContainer.style.color = '#0f172a';
  document.body.appendChild(measureContainer);

  const measureHeight = (html: string): number => {
    measureContainer.innerHTML = html;
    const h = measureContainer.offsetHeight;
    measureContainer.innerHTML = '';
    return h;
  };

  const page1HeaderHeight = measureHeight(renderHeaderBlock(report, 1));
  const pageNHeaderHeight = measureHeight(renderHeaderBlock(report, 2));

  // Prepare all blocks to be placed
  interface ContentBlock {
    html: string;
    height: number;
  }

  const blocksToPlace: ContentBlock[] = [];

  const isCarga = report.reportType === 'PRUEBAS_CARGA';

  // Add all evaluation sections
  for (const sec of report.sections) {
    if (!sec.items || sec.items.length === 0) continue;

    const fullHtml = renderSectionHtml(sec.title, sec.items, false, isCarga);
    const fullHeight = measureHeight(fullHtml);

    // If a section is reasonably sized (fits on standard page ~900px), keep intact
    if (fullHeight <= USABLE_PAGE_HEIGHT_PX - pageNHeaderHeight - 20) {
      blocksToPlace.push({ html: fullHtml, height: fullHeight });
    } else {
      // Chunk into smaller parts if massive section (> 10 items)
      const CHUNK = 5;
      for (let i = 0; i < sec.items.length; i += CHUNK) {
        const slice = sec.items.slice(i, i + CHUNK);
        const chunkHtml = renderSectionHtml(sec.title, slice, i > 0, isCarga);
        blocksToPlace.push({ html: chunkHtml, height: measureHeight(chunkHtml) });
      }
    }
  }

  // Add Observations Block (if any)
  if (report.notes && report.notes.trim() !== '') {
    const obsHtml = `
      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; font-size: 9.5px;">
        <strong style="color: #92400e; display: block; margin-bottom: 2px; text-transform: uppercase; font-size: 8.5px;">OBSERVACIONES GENERALES:</strong>
        <span style="color: #334155;">${report.notes}</span>
      </div>
    `;
    blocksToPlace.push({ html: obsHtml, height: measureHeight(obsHtml) });
  }

  // Add Signatures Block
  const sigHtml = renderSignaturesBlock(report);
  blocksToPlace.push({ html: sigHtml, height: measureHeight(sigHtml) });

  // Distribute blocks into page buckets
  interface PageBucket {
    pageNumber: number;
    headerHtml: string;
    blocksHtml: string[];
    usedHeight: number;
    maxHeight: number;
  }

  const pageBuckets: PageBucket[] = [];

  const startNewPage = (): PageBucket => {
    const pageNum = pageBuckets.length + 1;
    const headerHtml = renderHeaderBlock(report, pageNum);
    const headerH = pageNum === 1 ? page1HeaderHeight : pageNHeaderHeight;
    const bucket: PageBucket = {
      pageNumber: pageNum,
      headerHtml,
      blocksHtml: [],
      usedHeight: headerH,
      maxHeight: USABLE_PAGE_HEIGHT_PX,
    };
    pageBuckets.push(bucket);
    return bucket;
  };

  let currentBucket = startNewPage();

  for (const block of blocksToPlace) {
    const availableSpace = currentBucket.maxHeight - currentBucket.usedHeight;

    if (block.height <= availableSpace) {
      // Fits on current page
      currentBucket.blocksHtml.push(block.html);
      currentBucket.usedHeight += block.height;
    } else {
      // If current page already has content, push to a new page
      if (currentBucket.blocksHtml.length > 0) {
        currentBucket = startNewPage();
      }
      currentBucket.blocksHtml.push(block.html);
      currentBucket.usedHeight += block.height;
    }
  }

  // Cleanup measure container
  if (document.body.contains(measureContainer)) {
    document.body.removeChild(measureContainer);
  }

  // Render final pages into a hidden wrapper
  const renderWrapper = document.createElement('div');
  renderWrapper.style.position = 'absolute';
  renderWrapper.style.left = '-9999px';
  renderWrapper.style.top = '-9999px';
  renderWrapper.style.width = `${PAGE_WIDTH_PX}px`;
  renderWrapper.style.backgroundColor = '#ffffff';
  document.body.appendChild(renderWrapper);

  const totalPages = pageBuckets.length;
  const renderedPageElements: HTMLElement[] = [];

  pageBuckets.forEach((bucket) => {
    const pageDiv = document.createElement('div');
    pageDiv.style.width = `${PAGE_WIDTH_PX}px`;
    pageDiv.style.height = `${PAGE_HEIGHT_PX}px`;
    pageDiv.style.padding = `${PADDING_TOP_PX}px ${PADDING_X_PX}px ${PADDING_BOTTOM_PX}px ${PADDING_X_PX}px`;
    pageDiv.style.boxSizing = 'border-box';
    pageDiv.style.backgroundColor = '#ffffff';
    pageDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
    pageDiv.style.color = '#0f172a';
    pageDiv.style.display = 'flex';
    pageDiv.style.flexDirection = 'column';
    pageDiv.style.justifyContent = 'space-between';
    pageDiv.style.overflow = 'hidden';

    // Content container
    const contentDiv = document.createElement('div');
    contentDiv.style.width = '100%';
    contentDiv.innerHTML = `
      ${bucket.headerHtml}
      ${bucket.blocksHtml.join('')}
    `;

    // Footer
    const footerDiv = document.createElement('div');
    footerDiv.style.height = `${FOOTER_HEIGHT_PX}px`;
    footerDiv.style.borderTop = '1px solid #cbd5e1';
    footerDiv.style.paddingTop = '6px';
    footerDiv.style.display = 'flex';
    footerDiv.style.justifyContent = 'space-between';
    footerDiv.style.alignItems = 'center';
    footerDiv.style.fontSize = '8.5px';
    footerDiv.style.color = '#64748b';
    footerDiv.style.fontWeight = '600';
    footerDiv.style.boxSizing = 'border-box';

    footerDiv.innerHTML = `
      <span>INCUBADORA SANTANDER S.A. - GMI-F-35 SISTEMA DE MANTENIMIENTO OVERHAUL</span>
      <span>PÁGINA ${bucket.pageNumber} DE ${totalPages}</span>
    `;

    pageDiv.appendChild(contentDiv);
    pageDiv.appendChild(footerDiv);
    renderWrapper.appendChild(pageDiv);
    renderedPageElements.push(pageDiv);
  });

  try {
    // Wait for all images inside renderWrapper to be fully loaded and decoded
    const images = Array.from(renderWrapper.querySelectorAll('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) {
                resolve();
              } else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            })
        )
      );
      // Extra microtask pause to ensure styles and font bounding boxes settle
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;

    for (let i = 0; i < renderedPageElements.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const canvas = await html2canvas(renderedPageElements[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const pageImgData = canvas.toDataURL('image/jpeg', 0.94);
      pdf.addImage(pageImgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm);
    }

    if (document.body.contains(renderWrapper)) {
      document.body.removeChild(renderWrapper);
    }

    const base64String = pdf.output('datauristring').split(',')[1];
    const blob = pdf.output('blob');
    const fileName = `ACTA_${(report.code || 'OVERHAUL').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    return { doc: pdf, fileName, blob, base64: base64String };
  } catch (err) {
    if (document.body.contains(renderWrapper)) {
      document.body.removeChild(renderWrapper);
    }
    throw err;
  }
};

export const generateReportPDFBase64 = async (report: EvaluationReport): Promise<{ base64: string; fileName: string }> => {
  const result = await generateReportPDF(report);
  return { base64: result.base64, fileName: result.fileName };
};

export const downloadReportPDF = async (report: EvaluationReport): Promise<{ success: boolean; fileName: string }> => {
  const { doc, fileName, blob } = await generateReportPDF(report);

  try {
    // Primary download method using jsPDF save
    doc.save(fileName);
  } catch (e) {
    console.warn('doc.save encountered an issue, attempting blob download fallback:', e);
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 2000);
    } catch (fallbackError) {
      console.error('Blob download fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }

  return { success: true, fileName };
};
