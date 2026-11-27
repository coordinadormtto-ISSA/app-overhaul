import React, { useState, useEffect, useRef } from 'react';
import { ViewMode, Persona, EvaluationReport, ZoneType } from './types';
import {
  getStoredPersonas,
  savePersona,
  deletePersona,
  getStoredReports,
  saveReport,
  deleteReport,
  sanitizeReport,
  replaceStoredReports,
  hydrateReportsCache,
} from './lib/storage';
import { hydrateCustomMediaCache } from './lib/customImages';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { MainMenuView } from './components/MainMenuView';
import { SubMenuView } from './components/SubMenuView';
import { EvaluationFormView } from './components/EvaluationFormView';
import { PruebaCargaPendingListView } from './components/PruebaCargaPendingListView';
import { PruebaCargaFormView } from './components/PruebaCargaFormView';
import { PersonasView } from './components/PersonasView';
import { HistoricoView } from './components/HistoricoView';
import { IndicadoresHubView } from './components/IndicadoresHubView';
import { PersonalizacionView } from './components/PersonalizacionView';
import { PDFReportModal } from './components/PDFReportModal';
import { GoogleSheetsConfirmModal } from './components/GoogleSheetsConfirmModal';
import { InitialGoogleAuthModal } from './components/InitialGoogleAuthModal';
import {
  exportReportToGoogleSheet,
  importReportsFromGoogleSheets,
  syncPersonasBidirectional,
  exportPersonasToGoogleSheet,
  syncCustomImagesBidirectional,
  importCustomImagesFromGoogleSheets,
  importIndicatorActivitiesFromGoogleSheets,
  isReportSyncedToSheets,
  markReportAsSynced,
  getCachedGoogleToken,
  getValidAccessToken,
  checkAppsScriptSupportsSheetsWrite,
} from './lib/googleSheetsSync';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('INICIO');

  // App State
  const [personas, setPersonas] = useState<Persona[]>(getStoredPersonas);
  const [reports, setReports] = useState<EvaluationReport[]>(getStoredReports);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Zone for New Evaluation Form
  const [selectedFormZone, setSelectedFormZone] = useState<ZoneType>('ZUCAMI');

  // Selected Parent Report for Completing Prueba con Carga
  const [selectedParentReport, setSelectedParentReport] = useState<EvaluationReport | null>(null);

  // Modals
  const [activePdfReport, setActivePdfReport] = useState<EvaluationReport | null>(null);
  const [activePdfInitialMessage, setActivePdfInitialMessage] = useState<string | null>(null);
  const [activePdfSheetsStatus, setActivePdfSheetsStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [showInitialAuthModal, setShowInitialAuthModal] = useState<boolean>(() => !getCachedGoogleToken());
  const [isInitialAuthLoading, setIsInitialAuthLoading] = useState(false);
  const [isInitialDataSyncing, setIsInitialDataSyncing] = useState(false);
  const [initialAuthError, setInitialAuthError] = useState<string | null>(null);

  // Sync state changes to storage
  const handleSavePersona = async (p: Persona) => {
    const updated = savePersona(p);
    setPersonas(updated);
    try {
      await exportPersonasToGoogleSheet(updated);
    } catch (e) {
      console.warn('Background sync of personas will occur when connected:', e);
    }
  };

  const handleDeletePersona = async (id: string) => {
    const updated = deletePersona(id);
    setPersonas(updated);
    try {
      await exportPersonasToGoogleSheet(updated);
    } catch (e) {
      console.warn('Background sync of personas will occur when connected:', e);
    }
  };

  const isExportingReportRef = useRef(false);
  const [isSyncingFromSheets, setIsSyncingFromSheets] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const pushPendingLocalReports = async (token?: string) => {
    const activeToken = token || getCachedGoogleToken();
    if (!activeToken) return;
    const localReports = getStoredReports();
    const pending = localReports.filter((r) => !isReportSyncedToSheets(r.id, r.code));
    for (const rep of pending) {
      try {
        await exportReportToGoogleSheet(rep, activeToken);
      } catch (err) {
        console.warn(`Pending report sync skipped for ${rep.code}:`, err);
      }
    }
  };

  const handleSaveReport = async (
    report: EvaluationReport,
    options?: { savedToSheetViaScript?: boolean; scriptSheetMessage?: string }
  ) => {
    isExportingReportRef.current = true;
    try {
      const updated = saveReport(report);
      setReports(updated);
      if (report.emailSentTo && report.emailSentTo.length > 0) {
        setActivePdfInitialMessage(
          `¡Correo enviado exitosamente! Se despachó el acta ${report.code} a: ${report.emailSentTo.join(', ')}`
        );
      } else {
        setActivePdfInitialMessage(null);
      }

      // Export to Google Sheets BEFORE switching view so Historico auto-sync never races or overwrites it
      let sheetsResult: { success: boolean; message: string };
      if (options?.savedToSheetViaScript) {
        markReportAsSynced(report);
        sheetsResult = {
          success: true,
          message: options.scriptSheetMessage || `Acta ${report.code} guardada en Google Sheets.`,
        };
      } else {
        try {
          sheetsResult = await exportReportToGoogleSheet(report);
        } catch (e: any) {
          sheetsResult = {
            success: false,
            message: e?.message || 'Error al guardar en Google Sheets.',
          };
        }
      }

      if (!sheetsResult.success) {
        setSyncFeedback(
          `El acta ${report.code} se guardó localmente y en correo, pero no pudo registrarse en Google Sheets: ${sheetsResult.message}. Use "Conectar con Google" para reintentar.`
        );
      } else {
        setSyncFeedback(null);
      }

      setActivePdfSheetsStatus(sheetsResult);
      setActivePdfReport(report);
      setCurrentView('HISTORICO');
    } finally {
      isExportingReportRef.current = false;
    }
  };

  const handleSavePruebaCargaReport = async (report: EvaluationReport) => {
    isExportingReportRef.current = true;
    try {
      // 1. Also update parent report in storage so it contains pruebaConCarga embedded data
      let parentReportToExport: EvaluationReport | null = null;
      if (report.parentReportId || report.parentReportCode) {
        const currentReports = getStoredReports();
        const parentIndex = currentReports.findIndex(
          (r) =>
            (report.parentReportId && r.id === report.parentReportId) ||
            (report.parentReportCode && r.code === report.parentReportCode)
        );

        if (parentIndex >= 0) {
          const parent = currentReports[parentIndex];
          parent.fechaPruebaConCarga = report.fechaPruebaConCarga || report.evaluationDate;
          parent.pruebaConCarga = {
            id: report.id,
            completed: true,
            completedAt: report.createdAt || new Date().toISOString(),
            fechaPruebaConCarga: report.fechaPruebaConCarga || report.evaluationDate,
            totalScore: report.totalScore,
            totalFailures: report.totalFailures ?? 0,
            notes: report.notes,
            sections: report.sections,
            signatures: report.signatures,
          };
          saveReport(parent);
          parentReportToExport = parent;
        }
      }

      // 2. Save the standalone Prueba con Carga report for Historico Actas
      saveReport(report);
      setReports(getStoredReports());
      setSelectedParentReport(null);

      // 3. Export/update parent row in Google Sheets BEFORE switching view
      let sheetsResult: { success: boolean; message: string };
      try {
        const targetReportToExport = parentReportToExport || report;
        sheetsResult = await exportReportToGoogleSheet(targetReportToExport);
        if (sheetsResult.success && parentReportToExport) {
          markReportAsSynced(report);
        }
      } catch (e: any) {
        sheetsResult = {
          success: false,
          message: e?.message || 'Error al guardar en Google Sheets.',
        };
      }

      if (!sheetsResult.success) {
        setSyncFeedback(
          `El acta ${report.code} se guardó localmente, pero no pudo actualizarse en Google Sheets: ${sheetsResult.message}. Use "Conectar con Google" para reintentar.`
        );
      } else {
        setSyncFeedback(null);
      }

      setActivePdfInitialMessage(null);
      setActivePdfSheetsStatus(sheetsResult);
      setActivePdfReport(report);
      setCurrentView('HISTORICO_ACTAS');
    } finally {
      isExportingReportRef.current = false;
    }
  };

  const handleOpenExistingReportPdf = (report: EvaluationReport) => {
    setActivePdfInitialMessage(null);
    const synced = isReportSyncedToSheets(report.id, report.code);
    setActivePdfSheetsStatus(
      synced
        ? null
        : {
            success: false,
            message: 'Esta acta aún está pendiente de registrarse en Google Sheets.',
          }
    );
    setActivePdfReport(report);
  };

  const handleRetrySingleReportExport = async (
    report: EvaluationReport
  ): Promise<{ success: boolean; message: string }> => {
    const localReports = getStoredReports();
    const exportTarget =
      report.reportType === 'PRUEBAS_CARGA' && (report.parentReportId || report.parentReportCode)
        ? localReports.find(
            (r) =>
              (report.parentReportId && r.id === report.parentReportId) ||
              (report.parentReportCode && r.code === report.parentReportCode)
          ) || report
        : report;

    const res = await exportReportToGoogleSheet(exportTarget);
    if (res.success) {
      markReportAsSynced(report);
      setSyncFeedback(null);
      setReports(getStoredReports());
    } else {
      setSyncFeedback(
        `No se pudo guardar el acta ${report.code} en Google Sheets: ${res.message}`
      );
    }
    setActivePdfSheetsStatus(res);
    return res;
  };

  const handleDeleteReport = (id: string) => {
    const updated = deleteReport(id);
    setReports(updated);
  };

  const handleSyncFromGoogleSheets = async (
    promptIfMissing: boolean = true,
    showSuccessBanner: boolean = false,
    customToken?: string
  ) => {
    if (isExportingReportRef.current) return;
    try {
      setIsSyncingFromSheets(true);
      if (promptIfMissing) {
        setSyncFeedback(null);
      }

      // Push any unsynced local reports first if we already have an authenticated token
      const existingToken = customToken || getCachedGoogleToken();
      if (existingToken) {
        await pushPendingLocalReports(existingToken);
      }

      const res = await importReportsFromGoogleSheets(existingToken || undefined, promptIfMissing);
      if (res.success) {
        const localReports = getStoredReports().map(sanitizeReport);

        if (res.reports && res.reports.length > 0) {
          const freshReports = res.reports.map(sanitizeReport);
          const freshCodes = new Set(freshReports.map((r) => r.code.trim().toUpperCase()));

          // Keep any local reports that have NOT been synced to Sheets yet so local submissions are never wiped
          const unsyncedLocal = localReports.filter(
            (lr) =>
              !freshCodes.has(lr.code.trim().toUpperCase()) &&
              !isReportSyncedToSheets(lr.id, lr.code)
          );

          const mergedReports = [...unsyncedLocal, ...freshReports];
          const persistedReports = replaceStoredReports(mergedReports);
          setReports(persistedReports);

          // Update synced IDs tracker strictly for reports confirmed in Google Sheets
          try {
            const syncedKey = 'kikes_synced_reports_set';
            const syncedIds = new Set<string>();
            freshReports.forEach((r) => {
              if (r.id) syncedIds.add(r.id);
              if (r.code) syncedIds.add(r.code);
              if (r.parentReportCode) syncedIds.add(r.parentReportCode);
            });
            localStorage.setItem(syncedKey, JSON.stringify(Array.from(syncedIds)));
          } catch (e) {}

          if (showSuccessBanner) {
            setSyncFeedback(`Sincronización exitosa: ${freshReports.length} actas obtenidas desde Google Sheets.`);
          }
        } else if (promptIfMissing && getCachedGoogleToken()) {
          // Only clear synced reports if Google Sheets truly has 0 rows; preserve unsynced local reports
          const unsyncedLocal = localReports.filter((lr) => !isReportSyncedToSheets(lr.id, lr.code));
          const persistedUnsynced = replaceStoredReports(unsyncedLocal);
          setReports(persistedUnsynced);
          if (showSuccessBanner) {
            setSyncFeedback('Sincronización exitosa: No hay actas registradas en Google Sheets.');
          }
        }
      } else {
        if (promptIfMissing) {
          setSyncFeedback(
            res.error || 'Inicie sesión con Google para obtener los datos más recientes de Google Sheets.'
          );
        }
      }
    } catch (e: any) {
      if (promptIfMissing) {
        setSyncFeedback(
          e?.message || 'Inicie sesión con Google para obtener los datos más recientes de Google Sheets.'
        );
      }
    } finally {
      setIsSyncingFromSheets(false);
    }
  };

  const handleRetryAuthAndSync = async () => {
    try {
      const token = await getValidAccessToken(true);
      if (token) {
        await pushPendingLocalReports(token);
      }
    } catch (e) {}
    await handleSyncFromGoogleSheets(true, true);
  };

  // Auto-sync on startup (silent)
  useEffect(() => {
    // Hydrate custom images & company logo from IndexedDB first (avoids localStorage quota issues)
    hydrateCustomMediaCache()
      .then((updated) => {
        if (updated) {
          setCustomImagesVersion((v) => v + 1);
        }
      })
      .catch(() => {});

    // Hydrate reports & signatures from IndexedDB first, then sync with Google Sheets
    hydrateReportsCache()
      .then(({ updated, reports: hydratedReports }) => {
        if (updated && !isExportingReportRef.current) {
          setReports(hydratedReports);
        }
      })
      .catch(() => {})
      .finally(() => {
        handleSyncFromGoogleSheets(false);
      });

    // Silent sync of personas on app launch
    syncPersonasBidirectional(undefined, false)
      .then((res) => {
        if (res.success && res.personas && res.personas.length > 0) {
          setPersonas(res.personas);
        }
      })
      .catch((e) => console.warn('Silent personas sync on startup skipped:', e));

    // Silent sync of custom menu images and company logo from Google Sheets
    syncCustomImagesBidirectional(undefined, false)
      .then((res) => {
        if (res.success && res.count > 0) {
          setCustomImagesVersion((v) => v + 1);
        }
      })
      .catch((e) => console.warn('Silent images sync on startup skipped:', e));

    // Silent capability probe for Apps Script sheet-writing bridge
    checkAppsScriptSupportsSheetsWrite().catch(() => false);

    // Silent sync of indicator activities & form definitions from CATEG_:ACTIVIDADES
    importIndicatorActivitiesFromGoogleSheets(undefined, false)
      .catch((e) => console.warn('Silent activities sync on startup skipped:', e));
  }, []);

  // Auto-sync (with Google sign-in prompt if missing) when entering Completar Acta, Historicos, or Indicadores
  useEffect(() => {
    if (
      !isExportingReportRef.current &&
      (currentView === 'COMPLETAR_ACTA' ||
        currentView === 'HISTORICO' ||
        currentView === 'HISTORICO_ACTAS' ||
        currentView === 'INDICADORES' ||
        currentView === 'INDICADORES_ACTIVIDADES')
    ) {
      handleSyncFromGoogleSheets(true, false);
    }
  }, [currentView]);

  // Custom Images change version tracker to trigger re-renders
  const [customImagesVersion, setCustomImagesVersion] = useState(0);

  // Helper to resolve title for Header
  const getHeaderTitle = (): string => {
    switch (currentView) {
      case 'INICIO':
        return 'INICIO';
      case 'ENTREGAS_VACIO':
        return 'ENTREGAS EN VACIO';
      case 'PRUEBAS_CARGA':
        return 'PRUEBAS CON CARGA';
      case 'PERSONAS':
        return 'PERSONAS';
      case 'PERSONALIZACION':
        return 'PERSONALIZACIÓN DE MENÚS';
      case 'NUEVO_REPORTE_MENU':
        return 'NUEVO REPORTE';
      case 'FORM_ZUCAMI':
        return 'ZUCAMI';
      case 'FORM_SALMET':
        return 'SALMET';
      case 'FORM_GRANJAS_PISO':
        return 'GRANJAS PISO';
      case 'FORM_EL_ROBLE':
        return 'EL ROBLE';
      case 'HISTORICO':
        return 'HISTORICO ENTREGAS EN VACIO';
      case 'HISTORICO_ACTAS':
        return 'HISTORICO PRUEBAS CON CARGA';
      case 'INDICADORES_MENU':
        return 'INDICADORES';
      case 'INDICADORES':
        return 'MEDICIÓN DE INDICADORES';
      case 'INDICADORES_ACTIVIDADES':
        return 'CONFIGURACIÓN DE ACTIVIDADES';
      case 'COMPLETAR_ACTA':
        return 'COMPLETAR ACTA CON AVES';
      case 'FORM_PRUEBA_CARGA':
        return 'PRUEBA CON CARGA';
      default:
        return 'MANTENIMIENTO OVERHAUL';
    }
  };

  const handleNavigateBack = () => {
    if (
      currentView === 'FORM_ZUCAMI' ||
      currentView === 'FORM_SALMET' ||
      currentView === 'FORM_GRANJAS_PISO' ||
      currentView === 'FORM_EL_ROBLE'
    ) {
      setCurrentView('NUEVO_REPORTE_MENU');
    } else if (currentView === 'NUEVO_REPORTE_MENU' || currentView === 'HISTORICO') {
      setCurrentView('ENTREGAS_VACIO');
    } else if (currentView === 'FORM_PRUEBA_CARGA') {
      setSelectedParentReport(null);
      setCurrentView('COMPLETAR_ACTA');
    } else if (currentView === 'COMPLETAR_ACTA' || currentView === 'HISTORICO_ACTAS') {
      setCurrentView('PRUEBAS_CARGA');
    } else if (currentView === 'INDICADORES' || currentView === 'INDICADORES_ACTIVIDADES') {
      setCurrentView('INDICADORES_MENU');
    } else {
      setCurrentView('INICIO');
    }
  };

  const handleSelectOption = (view: ViewMode) => {
    setSearchQuery('');
    setSyncFeedback(null);
    if (view === 'FORM_ZUCAMI') setSelectedFormZone('ZUCAMI');
    if (view === 'FORM_SALMET') setSelectedFormZone('SALMET');
    if (view === 'FORM_GRANJAS_PISO') setSelectedFormZone('GRANJAS PISO');
    if (view === 'FORM_EL_ROBLE') setSelectedFormZone('EL ROBLE');

    // Trigger Google OAuth synchronously inside user click gesture when entering admin config views,
    // or form/history views if the Apps Script sheet-write bridge is not yet active.
    const bridgeActive = localStorage.getItem('apps_script_supports_sheets_write') === '1';
    const isAdminConfigView =
      view === 'PERSONAS' ||
      view === 'PERSONALIZACION' ||
      view === 'INDICADORES' ||
      view === 'INDICADORES_ACTIVIDADES';
    const isUserView =
      view === 'HISTORICO' ||
      view === 'HISTORICO_ACTAS' ||
      view === 'COMPLETAR_ACTA' ||
      view === 'NUEVO_REPORTE_MENU' ||
      view === 'FORM_ZUCAMI' ||
      view === 'FORM_SALMET' ||
      view === 'FORM_GRANJAS_PISO' ||
      view === 'FORM_EL_ROBLE' ||
      view === 'FORM_PRUEBA_CARGA';

    if ((isAdminConfigView || (!bridgeActive && isUserView)) && !getCachedGoogleToken()) {
      getValidAccessToken(true).catch(() => null);
    }

    setCurrentView(view);
  };

  const handleFullCloudSync = async (
    explicitToken?: string,
    showSuccessBanner: boolean = true
  ) => {
    try {
      setIsSyncingFromSheets(true);
      const activeToken = explicitToken || getCachedGoogleToken() || undefined;
      // 0. Push any pending local reports if connected
      await pushPendingLocalReports(activeToken);
      // 1. Sync Reports
      await handleSyncFromGoogleSheets(true, showSuccessBanner, activeToken);
      // 2. Sync Personas
      try {
        const pRes = await syncPersonasBidirectional(activeToken, false);
        if (pRes.success && pRes.personas && pRes.personas.length > 0) {
          setPersonas(pRes.personas);
        }
      } catch (e) {}
      // 3. Sync Images and Company Logo
      try {
        const imgRes = await importCustomImagesFromGoogleSheets(activeToken, false);
        if (imgRes.success) {
          setCustomImagesVersion((v) => v + 1);
        }
      } catch (e) {}
      // 4. Sync Indicator Activities
      try {
        await importIndicatorActivitiesFromGoogleSheets(activeToken, false);
      } catch (e) {}
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      setIsSyncingFromSheets(false);
    }
  };

  const handleInitialGoogleSignIn = async () => {
    setInitialAuthError(null);
    setIsInitialAuthLoading(true);
    try {
      const token = await getValidAccessToken(true);
      if (!token) {
        setInitialAuthError('No se pudo obtener la autorización de Google. Intente nuevamente.');
        return;
      }
      setIsInitialAuthLoading(false);
      setIsInitialDataSyncing(true);
      await handleFullCloudSync(token, false);
      setShowInitialAuthModal(false);
    } catch (err: any) {
      const code = err?.code || err?.message || '';
      if (code.includes('popup-closed-by-user')) {
        setInitialAuthError('Se cerró la ventana de Google antes de completar el inicio de sesión.');
      } else if (code.includes('popup-blocked')) {
        setInitialAuthError('El navegador bloqueó la ventana de Google. Permita las ventanas emergentes e intente de nuevo.');
      } else {
        setInitialAuthError(err?.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setIsInitialAuthLoading(false);
      setIsInitialDataSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-teal-200">
      {/* Top Header matching AppSheet Teal style */}
      <Header
        title={getHeaderTitle()}
        currentView={currentView}
        onNavigateBack={handleNavigateBack}
        onGoHome={() => setCurrentView('INICIO')}
        onRefresh={() => handleFullCloudSync()}
        isSyncing={isSyncingFromSheets}
        onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showSearch={currentView === 'PERSONAS' || currentView === 'HISTORICO' || currentView === 'HISTORICO_ACTAS' || currentView === 'COMPLETAR_ACTA'}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-24 sm:pb-28">
        {currentView === 'INICIO' && (
          <MainMenuView key={`main-${customImagesVersion}`} onSelectOption={handleSelectOption} />
        )}

        {(currentView === 'ENTREGAS_VACIO' ||
          currentView === 'PRUEBAS_CARGA' ||
          currentView === 'INDICADORES_MENU' ||
          currentView === 'NUEVO_REPORTE_MENU') && (
          <SubMenuView
            key={`sub-${currentView}-${customImagesVersion}`}
            currentView={currentView}
            onSelectOption={handleSelectOption}
          />
        )}

        {currentView === 'PERSONALIZACION' && (
          <PersonalizacionView
            onImagesUpdated={() => setCustomImagesVersion((v) => v + 1)}
          />
        )}

        {(currentView === 'FORM_ZUCAMI' ||
          currentView === 'FORM_SALMET' ||
          currentView === 'FORM_GRANJAS_PISO' ||
          currentView === 'FORM_EL_ROBLE') && (
          <EvaluationFormView
            zone={selectedFormZone}
            personas={personas}
            onSaveReport={handleSaveReport}
            onCancel={() => setCurrentView('NUEVO_REPORTE_MENU')}
          />
        )}

        {currentView === 'PERSONAS' && (
          <PersonasView
            personas={personas}
            onSavePersona={handleSavePersona}
            onDeletePersona={handleDeletePersona}
            onPersonasSynced={(newPersonas) => setPersonas(newPersonas)}
            searchQuery={searchQuery}
          />
        )}

        {currentView === 'HISTORICO' && (
          <HistoricoView
            reports={reports}
            mode="ENTREGAS_VACIO"
            onSelectReport={handleOpenExistingReportPdf}
            onDeleteReport={handleDeleteReport}
            onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
            onRetryAuth={handleRetryAuthAndSync}
            isSyncingSheets={isSyncingFromSheets}
            syncFeedback={syncFeedback}
            searchQuery={searchQuery}
          />
        )}

        {currentView === 'HISTORICO_ACTAS' && (
          <HistoricoView
            reports={reports}
            mode="PRUEBAS_CARGA"
            onSelectReport={handleOpenExistingReportPdf}
            onDeleteReport={handleDeleteReport}
            onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
            onRetryAuth={handleRetryAuthAndSync}
            isSyncingSheets={isSyncingFromSheets}
            syncFeedback={syncFeedback}
            searchQuery={searchQuery}
          />
        )}

        {(currentView === 'INDICADORES' || currentView === 'INDICADORES_ACTIVIDADES') && (
          <IndicadoresHubView
            reports={reports}
            initialTab={currentView === 'INDICADORES_ACTIVIDADES' ? 'actividades' : 'medicion'}
            onOpenPdfReport={handleOpenExistingReportPdf}
            onGoHome={() => setCurrentView('INICIO')}
          />
        )}

        {currentView === 'COMPLETAR_ACTA' && (
          <PruebaCargaPendingListView
            reports={reports}
            onSelectReportToComplete={(parent) => {
              setSelectedParentReport(parent);
              setCurrentView('FORM_PRUEBA_CARGA');
            }}
            onNavigateToHistorico={() => setCurrentView('HISTORICO_ACTAS')}
            onRetryAuth={handleRetryAuthAndSync}
            isSyncingSheets={isSyncingFromSheets}
            syncFeedback={syncFeedback}
          />
        )}

        {currentView === 'FORM_PRUEBA_CARGA' && selectedParentReport && (
          <PruebaCargaFormView
            parentReport={selectedParentReport}
            personas={personas}
            onSaveReport={handleSavePruebaCargaReport}
            onCancel={() => {
              setSelectedParentReport(null);
              setCurrentView('COMPLETAR_ACTA');
            }}
          />
        )}
      </main>

      {/* First-Launch / New-Device Google Sign-In Prompt */}
      <InitialGoogleAuthModal
        isOpen={showInitialAuthModal}
        isAuthenticating={isInitialAuthLoading}
        isSyncingData={isInitialDataSyncing}
        errorMessage={initialAuthError}
        onSignIn={handleInitialGoogleSignIn}
        onContinueOffline={() => setShowInitialAuthModal(false)}
      />

      {/* Google Sheets Open Database Confirmation Modal */}
      <GoogleSheetsConfirmModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
      />

      {/* PDF View Modal */}
      {activePdfReport && (
        <PDFReportModal
          report={activePdfReport}
          onClose={() => {
            setActivePdfReport(null);
            setActivePdfInitialMessage(null);
            setActivePdfSheetsStatus(null);
          }}
          initialEmailStatusMessage={activePdfInitialMessage}
          sheetsStatus={activePdfSheetsStatus}
          onRetrySheetsExport={handleRetrySingleReportExport}
        />
      )}

      {/* Fixed Bottom Bar - Only shown on navigation/menu views, hidden in Form Views, Inicio, and Indicadores */}
      {currentView !== 'INICIO' &&
        currentView !== 'INDICADORES' &&
        currentView !== 'INDICADORES_MEDICION' &&
        currentView !== 'INDICADORES_ACTIVIDADES' &&
        currentView !== 'FORM_ZUCAMI' &&
        currentView !== 'FORM_SALMET' &&
        currentView !== 'FORM_GRANJAS_PISO' &&
        currentView !== 'FORM_EL_ROBLE' &&
        currentView !== 'FORM_PRUEBA_CARGA' && (
          <BottomNav onGoHome={() => setCurrentView('INICIO')} />
        )}
    </div>
  );
}
