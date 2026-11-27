import React, { useState, useEffect } from 'react';
import { Persona } from '../types';
import { Edit2, Trash2, Plus, Mail, Phone, UserCheck, X, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { syncPersonasBidirectional, exportPersonasToGoogleSheet } from '../lib/googleSheetsSync';

interface PersonasViewProps {
  personas: Persona[];
  onSavePersona: (persona: Persona) => void;
  onDeletePersona: (id: string) => void;
  onPersonasSynced?: (personas: Persona[]) => void;
  searchQuery: string;
}

export const PersonasView: React.FC<PersonasViewProps> = ({
  personas,
  onSavePersona,
  onDeletePersona,
  onPersonasSynced,
  searchQuery,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Persona | null>(null);
  const [deletingPerson, setDeletingPerson] = useState<Persona | null>(null);

  // Synchronization State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [mostrarOpcionCorreo, setMostrarOpcionCorreo] = useState(false);

  const filteredPersonas = [...personas]
    .filter(
      (p) =>
        p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.cargo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.correo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.telefono && p.telefono.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

  const runSyncDatabase = async (promptIfMissing: boolean = true, showSuccessToast: boolean = true, cancelledRef?: { current: boolean }) => {
    try {
      setIsSyncing(true);
      if (showSuccessToast) {
        setSyncStatus(null);
      }
      const res = await syncPersonasBidirectional(undefined, promptIfMissing);
      if (cancelledRef?.current) return;
      if (res.success) {
        if (onPersonasSynced && res.personas) {
          onPersonasSynced(res.personas);
        }
        if (showSuccessToast) {
          setSyncStatus({
            type: 'success',
            message:
              res.action === 'populated_sheets'
                ? `Base de datos poblada exitosamente en Google Sheets con ${res.count} personas.`
                : `Sincronización exitosa: ${res.count} personas sincronizadas con Google Sheets.`,
          });
        }
      } else {
        setSyncStatus({
          type: 'error',
          message: res.error || 'No se pudo conectar con la base de datos de Google Sheets.',
        });
      }
    } catch (e: any) {
      if (!cancelledRef?.current) {
        setSyncStatus({
          type: 'error',
          message: e?.message || 'Error al conectar con Google Sheets.',
        });
      }
    } finally {
      if (!cancelledRef?.current) {
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    const cancelledRef = { current: false };
    runSyncDatabase(true, false, cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const handleSyncDatabase = () => runSyncDatabase(true, true);

  const handleOpenAddModal = () => {
    setEditingPerson(null);
    setNombre('');
    setCargo('');
    setCorreo('');
    setTelefono('');
    setMostrarOpcionCorreo(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Persona) => {
    setEditingPerson(p);
    setNombre(p.nombre);
    setCargo(p.cargo);
    setCorreo(p.correo);
    setTelefono(p.telefono || '');
    setMostrarOpcionCorreo(!!p.mostrarOpcionCorreo);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !correo.trim()) return;

    const newPerson: Persona = {
      id: editingPerson ? editingPerson.id : `p-${Date.now()}`,
      nombre: nombre.trim(),
      cargo: cargo.trim() || 'Colaborador',
      correo: correo.trim(),
      telefono: telefono.trim(),
      mostrarOpcionCorreo,
    };

    onSavePersona(newPerson);
    setIsModalOpen(false);

    // Background push to Google Sheets if token exists
    try {
      const currentList = [...personas.filter((p) => p.id !== newPerson.id), newPerson];
      await exportPersonasToGoogleSheet(currentList);
    } catch (e) {
      console.warn('Background sync to Google Sheets skipped until connected:', e);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-36 sm:pb-44">
      {/* Top Info Banner with Synchronize and Add Buttons */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-800">
              Directorio de Personal ({personas.length})
            </h2>
            <span className="bg-teal-50 text-[#00796B] text-xs font-semibold px-2 py-0.5 rounded-full border border-teal-200">
              Google Sheets
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Usuarios sincronizados con la pestaña «PERSONAS» en Google Sheets para firmas y supervisión.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={handleSyncDatabase}
            disabled={isSyncing}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors border border-slate-300 shadow-xs disabled:opacity-50"
            id="sync-personas-btn"
            title="Sincronizar directorio con pestaña PERSONAS en Google Sheets"
          >
            <RefreshCw className={`w-4 h-4 text-[#00796B] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-[#00796B] hover:bg-[#005B52] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow"
            id="add-persona-btn-top"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Persona</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Message */}
      {syncStatus && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in ${
            syncStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{syncStatus.message}</span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {syncStatus.type === 'error' && (
              <button
                type="button"
                onClick={handleSyncDatabase}
                disabled={isSyncing}
                className="bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                Conectar con Google
              </button>
            )}
            <button
              onClick={() => setSyncStatus(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid of Person Cards matching AppSheet Screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPersonas.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
            id={`persona-card-${p.id}`}
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{p.nombre}</h3>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{p.cargo}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-[#00796B]">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center space-x-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{p.correo}</span>
                </div>
                {p.telefono && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{p.telefono}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => handleOpenEditModal(p)}
                className="p-2 text-slate-600 hover:text-[#00796B] hover:bg-teal-50 rounded-lg transition-colors"
                title="Editar"
                id={`edit-persona-${p.id}`}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeletingPerson(p)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar persona"
                id={`delete-persona-${p.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredPersonas.length === 0 && (
          <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No se encontraron personas con ese criterio de búsqueda.
          </div>
        )}
      </div>

      {/* Floating Action Button for Mobile / AppSheet Feel */}
      <button
        onClick={handleOpenAddModal}
        className="fixed bottom-16 right-6 w-14 h-14 bg-[#00796B] text-white rounded-full shadow-lg hover:bg-[#005B52] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-30"
        title="Agregar Persona"
        id="fab-add-persona"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">
                {editingPerson ? 'Editar Persona' : 'Agregar Nueva Persona'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                id="close-modal-persona"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Ademar Uribe"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00796B] outline-none"
                  id="persona-input-nombre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cargo / Rol *
                </label>
                <input
                  type="text"
                  required
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ej. Auxiliar de granja, Coordinador mtto..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00796B] outline-none"
                  id="persona-input-cargo"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="ejemplo@kikes.com.co"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00796B] outline-none"
                  id="persona-input-correo"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Teléfono / Móvil
                </label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+57 310..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00796B] outline-none"
                  id="persona-input-telefono"
                />
              </div>

              <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 mt-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mostrarOpcionCorreo}
                    onChange={(e) => setMostrarOpcionCorreo(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#00796B] rounded border-teal-300 focus:ring-[#00796B]"
                    id="checkbox-mostrar-opcion-correo"
                  />
                  <span className="text-xs font-semibold text-teal-900 leading-tight">
                    Mostrar como opción para enviar correo con copia del acta en formulario?
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-[#00796B] hover:bg-[#005B52] text-white rounded-lg transition-colors shadow"
                  id="persona-submit-btn"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPerson && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">¿Eliminar Persona?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                ¿Está seguro de que desea eliminar a <strong className="text-slate-800">{deletingPerson.nombre}</strong>? Esta persona será removida de la base de datos y no aparecerá en los formularios.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPerson(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePersona(deletingPerson.id);
                  setDeletingPerson(null);
                }}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow transition-colors"
                id="confirm-delete-persona-btn"
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

