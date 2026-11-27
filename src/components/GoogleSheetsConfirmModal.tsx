import React from 'react';
import { X, FileSpreadsheet, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { SPREADSHEET_URL } from '../lib/googleSheetsSync';

interface GoogleSheetsConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSheetsConfirmModal: React.FC<GoogleSheetsConfirmModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleOpenSpreadsheet = () => {
    window.open(SPREADSHEET_URL, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#00796B] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center border border-white/20">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">Base de Datos Overhaul</h3>
              <p className="text-[11px] text-teal-100 font-medium">Google Sheets Kikes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors"
            id="close-sheets-confirm-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-slate-700">
          <div className="flex items-start space-x-3.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-bold block mb-0.5">Acceso Institucional Seguro</span>
              El documento contiene el consolidado de actas organizadas por pestañas (Zucami, Salmet, Granjas Piso y El Roble).
            </div>
          </div>

          <div className="text-center py-2">
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              ¿Está seguro que desea ingresar a la base de datos de Google Sheets?
            </p>
            <p className="text-xs text-slate-500 mt-1.5">
              Se abrirá la hoja de cálculo en una nueva pestaña del navegador. Recuerde que debe contar con permisos en su cuenta Google corporativa.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
            id="cancel-open-sheets-btn"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleOpenSpreadsheet}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-colors flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20"
            id="confirm-open-sheets-btn"
          >
            <span>Sí, abrir base de datos</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
