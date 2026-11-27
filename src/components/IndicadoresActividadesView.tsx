import React, { useState, useEffect } from 'react';
import {
  INDICATOR_CATEGORIES,
  IndicatorCategory,
  getAvailableForms,
  addCustomFarm,
  deleteCustomFarm,
  getFormSections,
  createActivityForForm,
  updateActivityInForm,
  deleteActivityFromForm,
  FormConfig,
} from '../lib/indicatorsManager';
import { EvaluationItem, EvaluationSection } from '../types';
import {
  Plus,
  Building2,
  Tag,
  CheckCircle2,
  Trash2,
  Edit2,
  Search,
  Filter,
  Layers,
  Sparkles,
  AlertCircle,
  X,
  ChevronDown,
  Info,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import {
  syncIndicatorActivitiesBidirectional,
  exportIndicatorActivitiesToGoogleSheet,
  CATEG_ACTIVIDADES_TAB_NAME,
} from '../lib/googleSheetsSync';

interface IndicadoresActividadesViewProps {
  onFormUpdated?: () => void;
  syncTrigger?: number;
}

export const IndicadoresActividadesView: React.FC<IndicadoresActividadesViewProps> = ({
  onFormUpdated,
  syncTrigger = 0,
}) => {
  const [forms, setForms] = useState<FormConfig[]>(() => getAvailableForms());
  const [selectedForm, setSelectedForm] = useState<string>('ZUCAMI');
  const [sections, setSections] = useState<EvaluationSection[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'TODOS' | 'A' | 'B' | 'C'>('TODOS');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Modal: Nueva Actividad
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EvaluationItem | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newCriteria, setNewCriteria] = useState('');
  const [newCategoryLabel, setNewCategoryLabel] = useState<string>(INDICATOR_CATEGORIES[0].label);

  // Modal: Nueva Granja / Formulario
  const [isNewFarmModalOpen, setIsNewFarmModalOpen] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmDescription, setNewFarmDescription] = useState('');

  // Modal: Confirmación de eliminación
  const [deletingActivity, setDeletingActivity] = useState<{ id: string; question: string } | null>(null);
  const [deletingFarm, setDeletingFarm] = useState<FormConfig | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const refreshForms = () => {
    const list = getAvailableForms();
    setForms(list);
  };

  const loadActivities = () => {
    if (!selectedForm) return;
    const secList = getFormSections(selectedForm);
    setSections(secList);
  };

  useEffect(() => {
    loadActivities();
  }, [selectedForm]);

  useEffect(() => {
    refreshForms();
    loadActivities();
  }, [syncTrigger]);

  const handleSyncWithCloud = async () => {
    try {
      setIsSyncing(true);
      const res = await syncIndicatorActivitiesBidirectional(undefined, true);
      if (res.success) {
        refreshForms();
        loadActivities();
        if (onFormUpdated) onFormUpdated();
        showNotification(
          'success',
          res.action === 'imported'
            ? `¡Sincronizado! Se importaron ${res.count} actividades desde "${res.tabName}".`
            : `¡Sincronizado! Se guardaron ${res.count} actividades en la hoja "${res.tabName}".`
        );
      } else {
        showNotification('error', res.error || 'Error al sincronizar con Google Sheets.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Error de conexión con Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadChangesToCloud = async () => {
    try {
      setIsSyncing(true);
      const res = await exportIndicatorActivitiesToGoogleSheet();
      if (res.success) {
        if (onFormUpdated) onFormUpdated();
        showNotification(
          'success',
          `¡Cambios cargados con éxito! Se guardaron ${res.count} actividades en la hoja "${res.tabName}".`
        );
      } else {
        showNotification('error', res.error || 'Error al guardar actividades en Google Sheets.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Error de conexión con Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper to sync activity/farm edits to CATEG_:ACTIVIDADES and form tabs in Google Sheets
  const triggerBackgroundCloudSave = async (successMessage: string) => {
    try {
      setIsSyncing(true);
      const res = await exportIndicatorActivitiesToGoogleSheet();
      if (res.success) {
        showNotification('success', `${successMessage} Base de datos actualizada en Google Sheets.`);
      } else {
        showNotification(
          'error',
          `${successMessage} Sin embargo, no se pudo actualizar Google Sheets (${res.error || 'inicie sesión con Google y use "Cargar Cambios en Base de Datos"'}).`
        );
      }
    } catch (e: any) {
      showNotification(
        'error',
        `${successMessage} Sin embargo, falló la sincronización con Google Sheets (${e?.message || 'error de conexión'}).`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Flatten all items with section title
  const allItems: { item: EvaluationItem; sectionTitle: string }[] = [];
  sections.forEach((sec) => {
    (sec.items || []).forEach((item) => {
      allItems.push({ item, sectionTitle: sec.title });
    });
  });

  // Filter items
  const filteredItems = allItems.filter(({ item }) => {
    const cat = INDICATOR_CATEGORIES.find((c) => c.label === item.category);
    if (selectedGroupFilter !== 'TODOS' && cat?.group !== selectedGroupFilter) {
      return false;
    }
    if (selectedCatFilter !== 'TODAS' && item.category !== selectedCatFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQ = item.question.toLowerCase().includes(q);
      const matchC = item.criteria?.toLowerCase().includes(q);
      const matchCat = item.category?.toLowerCase().includes(q);
      if (!matchQ && !matchC && !matchCat) return false;
    }
    return true;
  });

  // Counts by Group
  const countGroupA = allItems.filter(({ item }) => {
    const c = INDICATOR_CATEGORIES.find((cat) => cat.label === item.category);
    return c?.group === 'A';
  }).length;
  const countGroupB = allItems.filter(({ item }) => {
    const c = INDICATOR_CATEGORIES.find((cat) => cat.label === item.category);
    return c?.group === 'B';
  }).length;
  const countGroupC = allItems.filter(({ item }) => {
    const c = INDICATOR_CATEGORIES.find((cat) => cat.label === item.category);
    return c?.group === 'C';
  }).length;

  const handleOpenAddActivityModal = () => {
    setEditingItem(null);
    setNewQuestion('');
    setNewCriteria('');
    setNewCategoryLabel(INDICATOR_CATEGORIES[0].label);
    setIsActivityModalOpen(true);
  };

  const handleOpenEditActivityModal = (item: EvaluationItem) => {
    setEditingItem(item);
    setNewQuestion(item.question);
    setNewCriteria(item.criteria || '');
    setNewCategoryLabel(item.category || INDICATOR_CATEGORIES[0].label);
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) {
      showNotification('error', 'Por favor ingrese la descripción de la actividad.');
      return;
    }

    let successMsg = '';
    if (editingItem) {
      updateActivityInForm(selectedForm, editingItem.id, {
        question: newQuestion.trim(),
        criteria: newCriteria.trim() || undefined,
        category: newCategoryLabel,
      });
      successMsg = 'Actividad actualizada.';
    } else {
      createActivityForForm(selectedForm, newQuestion.trim(), newCriteria.trim(), newCategoryLabel);
      successMsg = `Actividad creada y clasificada en ${newCategoryLabel}.`;
    }

    setIsActivityModalOpen(false);
    loadActivities();
    triggerBackgroundCloudSave(successMsg);
    if (onFormUpdated) onFormUpdated();
  };

  const handleQuickChangeCategory = (itemId: string, newCat: string) => {
    updateActivityInForm(selectedForm, itemId, { category: newCat });
    loadActivities();
    triggerBackgroundCloudSave(`Categoría actualizada a ${newCat}.`);
    if (onFormUpdated) onFormUpdated();
  };

  const handleDeleteActivity = (itemId: string, question: string) => {
    setDeletingActivity({ id: itemId, question });
  };

  const confirmDeleteActivity = () => {
    if (!deletingActivity) return;
    deleteActivityFromForm(selectedForm, deletingActivity.id);
    setDeletingActivity(null);
    loadActivities();
    triggerBackgroundCloudSave('Actividad eliminada.');
    if (onFormUpdated) onFormUpdated();
  };

  const handleCreateFarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmName.trim()) {
      showNotification('error', 'Ingrese el nombre de la nueva granja o formulario.');
      return;
    }

    const created = addCustomFarm(newFarmName.trim(), newFarmDescription.trim());
    refreshForms();
    setSelectedForm(created.name);
    setIsNewFarmModalOpen(false);
    setNewFarmName('');
    setNewFarmDescription('');
    triggerBackgroundCloudSave(`Granja / Formulario "${created.name}" creada.`);
    if (onFormUpdated) onFormUpdated();
  };

  const handleDeleteFarm = (formConfig: FormConfig) => {
    if (formConfig.isDefault) {
      showNotification('error', 'Las granjas predeterminadas del sistema no pueden eliminarse.');
      return;
    }
    setDeletingFarm(formConfig);
  };

  const confirmDeleteFarm = () => {
    if (!deletingFarm) return;
    const farmName = deletingFarm.name;
    deleteCustomFarm(farmName);
    setDeletingFarm(null);
    refreshForms();
    setSelectedForm('ZUCAMI');
    triggerBackgroundCloudSave(`Granja "${farmName}" eliminada.`);
    if (onFormUpdated) onFormUpdated();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              CONFIGURADOR DE ACTIVIDADES
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">11 Categorías [A], [B], [C]</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 mt-1">Gestión de Actividades por Formulario</h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Cree nuevas actividades por granja o tecnología y clasifíquelas en los grupos de criticidad para medición automática en los indicadores.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handleUploadChangesToCloud}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            id="btn-upload-changes-indicadores"
            title={`Cargar cambios de actividades en la base de datos (${CATEG_ACTIVIDADES_TAB_NAME})`}
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>Cargar Cambios en Base de Datos</span>
          </button>

          <button
            onClick={() => setIsNewFarmModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center space-x-1.5 transition-colors shadow-2xs"
            id="btn-add-new-farm"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>+ Nueva Granja / Formulario</span>
          </button>

          <button
            onClick={handleOpenAddActivityModal}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white flex items-center space-x-1.5 transition-colors shadow-xs"
            id="btn-add-new-activity"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Actividad</span>
          </button>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Form / Farm Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Building2 className="w-4 h-4 text-teal-700" />
            <span>Seleccionar Formulario / Granja:</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            {forms.length} formularios disponibles
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {forms.map((f) => {
            const isSelected = selectedForm.toUpperCase() === f.name.toUpperCase();
            return (
              <div key={f.id} className="relative group shrink-0">
                <button
                  onClick={() => setSelectedForm(f.name)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center space-x-2 ${
                    isSelected
                      ? 'bg-[#00796B] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  id={`form-selector-btn-${f.id}`}
                >
                  <span>{f.name}</span>
                  {!f.isDefault && (
                    <span className="text-[9px] bg-teal-900/30 px-1.5 py-0.5 rounded-full">
                      Personalizada
                    </span>
                  )}
                </button>

                {!f.isDefault && (
                  <button
                    onClick={() => handleDeleteFarm(f)}
                    title={`Eliminar formulario ${f.name}`}
                    className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-xs"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Group KPI distribution counters for current form */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <button
          onClick={() => setSelectedGroupFilter(selectedGroupFilter === 'A' ? 'TODOS' : 'A')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedGroupFilter === 'A'
              ? 'bg-red-50/80 border-red-400 ring-2 ring-red-400 shadow-xs'
              : 'bg-white border-slate-200 hover:border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              GRUPO [A] - CRÍTICO
            </span>
            <span className="text-lg font-black text-red-700">{countGroupA}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2">Sistemas Vitales de Granja</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Cajas control, agua, alimento, gallinaza, alumbrado, ambiente
          </p>
        </button>

        <button
          onClick={() => setSelectedGroupFilter(selectedGroupFilter === 'B' ? 'TODOS' : 'B')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedGroupFilter === 'B'
              ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400 shadow-xs'
              : 'bg-white border-slate-200 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              GRUPO [B] - MAYOR
            </span>
            <span className="text-lg font-black text-blue-700">{countGroupB}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2">Abastecimiento y Bienestar</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Silos, básculas y sistemas de antipicaje
          </p>
        </button>

        <button
          onClick={() => setSelectedGroupFilter(selectedGroupFilter === 'C' ? 'TODOS' : 'C')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedGroupFilter === 'C'
              ? 'bg-orange-50/80 border-orange-400 ring-2 ring-orange-400 shadow-xs'
              : 'bg-white border-slate-200 hover:border-orange-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
              GRUPO [C] - OPERATIVO
            </span>
            <span className="text-lg font-black text-orange-700">{countGroupC}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2">Estructura y Recolección</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Recogida de huevo, jaula y otros sistemas
          </p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar actividad o criterio..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50/50"
            />
          </div>

          {/* Category Dropdown Filter */}
          <div className="flex items-center space-x-2 shrink-0">
            <Tag className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500 max-w-[260px] truncate"
            >
              <option value="TODAS">Todas las Categorías (11)</option>
              {INDICATOR_CATEGORIES.map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter tags summary */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Mostrando <b>{filteredItems.length}</b> de <b>{allItems.length}</b> actividades configuradas para <b>{selectedForm}</b>
          </span>
          {(selectedGroupFilter !== 'TODOS' || selectedCatFilter !== 'TODAS' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedGroupFilter('TODOS');
                setSelectedCatFilter('TODAS');
                setSearchQuery('');
              }}
              className="text-teal-700 font-bold hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">No se encontraron actividades</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No hay actividades registradas con los filtros actuales en el formulario {selectedForm}.
            </p>
            <button
              onClick={handleOpenAddActivityModal}
              className="px-4 py-2 bg-[#00796B] hover:bg-[#005B52] text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Primera Actividad</span>
            </button>
          </div>
        ) : (
          filteredItems.map(({ item, sectionTitle }) => {
            const currentCat = INDICATOR_CATEGORIES.find((c) => c.label === item.category) || INDICATOR_CATEGORIES[10];

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Category Badge */}
                    <span
                      className={`inline-flex items-center text-[10px] font-black px-2.5 py-0.5 rounded-full border ${currentCat.badgeBg} ${currentCat.badgeText} ${currentCat.badgeBorder}`}
                    >
                      {currentCat.label}
                    </span>

                    {/* Group Indicator */}
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                      Grupo [{currentCat.group}]
                    </span>

                    {/* Section origin */}
                    <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">
                      Sección: {sectionTitle}
                    </span>
                  </div>

                  {/* Question */}
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    {item.question}
                  </h4>

                  {/* Criteria */}
                  {item.criteria && (
                    <p className="text-[11px] text-slate-500 leading-relaxed italic">
                      <span className="font-semibold text-slate-600 not-italic">Criterio: </span>
                      {item.criteria}
                    </p>
                  )}
                </div>

                {/* Right controls: Quick Category Selector + Actions */}
                <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Quick Category Dropdown to easily reclassify in any of the 11 categories */}
                  <div className="relative">
                    <select
                      value={item.category || currentCat.label}
                      onChange={(e) => handleQuickChangeCategory(item.id, e.target.value)}
                      className="text-[11px] font-bold py-1.5 pl-2.5 pr-6 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 transition-colors"
                      title="Cambiar clasificación de categoría"
                    >
                      {INDICATOR_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.label}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => handleOpenEditActivityModal(item)}
                    className="p-1.5 text-slate-500 hover:text-[#00796B] hover:bg-teal-50 rounded-lg transition-colors"
                    title="Editar actividad"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteActivity(item.id, item.question)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar actividad"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Nueva / Editar Actividad */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-[#00796B]" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingItem ? 'Editar Actividad' : 'Nueva Actividad'} - {selectedForm}
                </h3>
              </div>
              <button
                onClick={() => setIsActivityModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4">
              {/* Form Target */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Formulario / Granja
                </label>
                <input
                  type="text"
                  value={selectedForm}
                  disabled
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-bold"
                />
              </div>

              {/* Activity Question */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descripción de la Actividad *
                </label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Ej: Calibración y prueba de sensores de peso en básculas"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-500 font-medium"
                  required
                  autoFocus
                />
              </div>

              {/* Criteria */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Criterio de Aceptación / Especificación Técnica
                </label>
                <textarea
                  value={newCriteria}
                  onChange={(e) => setNewCriteria(e.target.value)}
                  placeholder="Ej: Verificación con masa patrón sin fluctuación superior a +/- 10 gramos."
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Category Selector with the 11 categories */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Clasificación de Categoría *
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                  {INDICATOR_CATEGORIES.map((cat) => {
                    const isSelected = newCategoryLabel === cat.label;
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                          isSelected ? `${cat.badgeBg} border ${cat.badgeBorder} font-bold` : 'hover:bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="category"
                          value={cat.label}
                          checked={isSelected}
                          onChange={() => setNewCategoryLabel(cat.label)}
                          className="text-[#00796B] focus:ring-teal-500"
                        />
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${cat.badgeBg} ${cat.badgeText}`}>
                          [{cat.group}]
                        </span>
                        <span className="text-slate-800">{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white rounded-xl transition-colors shadow-xs"
                >
                  {editingItem ? 'Guardar Cambios' : 'Crear Actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Nueva Granja / Formulario */}
      {isNewFarmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#00796B]" />
                <h3 className="font-extrabold text-slate-900 text-base">Nueva Granja / Formulario</h3>
              </div>
              <button
                onClick={() => setIsNewFarmModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFarm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre de la Granja o Fabricante *
                </label>
                <input
                  type="text"
                  value={newFarmName}
                  onChange={(e) => setNewFarmName(e.target.value)}
                  placeholder="Ej: BIG DUTCHMAN, GRANJA LA ESPERANZA, HELLMANN..."
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-500 font-bold uppercase"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={newFarmDescription}
                  onChange={(e) => setNewFarmDescription(e.target.value)}
                  placeholder="Ej: Galpones con tecnología de alimentación automatizada Big Dutchman"
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-800 flex items-start space-x-2">
                <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  Al crear una nueva granja o formulario, aparecerá inmediatamente en el selector para que pueda añadirle actividades y clasificarlas en las 11 categorías de indicadores.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewFarmModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#00796B] hover:bg-[#005B52] text-white rounded-xl transition-colors shadow-xs"
                >
                  Crear Formulario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: Confirmar Eliminar Actividad */}
      {deletingActivity && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-extrabold text-slate-900 text-base">Eliminar Actividad</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ¿Está seguro de eliminar la actividad{' '}
                  <span className="font-bold text-slate-800">"{deletingActivity.question}"</span> del formulario{' '}
                  <span className="font-bold text-slate-800">{selectedForm}</span>?
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-2 text-xs text-amber-900 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <span className="font-bold">Advertencia:</span> Al eliminar esta actividad también se eliminará toda la información registrada en su columna (calificaciones y observaciones) de la base de datos en Google Sheets. Si necesita conservar estos datos, guarde una copia de seguridad antes de continuar.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingActivity(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteActivity}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs"
                id="confirm-delete-activity-btn"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Eliminar Granja Personalizada */}
      {deletingFarm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-900 text-base">Eliminar Granja / Formulario</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ¿Desea eliminar el formulario personalizado{' '}
                  <span className="font-bold text-slate-800">"{deletingFarm.name}"</span>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingFarm(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteFarm}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs"
                id="confirm-delete-farm-btn"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
