import React from 'react';
import { ShieldCheck, LogIn, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getCompanyLogo } from '../assets/logo';

interface InitialGoogleAuthModalProps {
  isOpen: boolean;
  isAuthenticating: boolean;
  isSyncingData: boolean;
  errorMessage: string | null;
  onSignIn: () => void;
  onContinueOffline: () => void;
}

export const InitialGoogleAuthModal: React.FC<InitialGoogleAuthModalProps> = ({
  isOpen,
  isAuthenticating,
  isSyncingData,
  errorMessage,
  onSignIn,
  onContinueOffline,
}) => {
  if (!isOpen) return null;

  const isBusy = isAuthenticating || isSyncingData;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      id="initial-google-auth-modal"
    >
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Top corporate header */}
        <div className="bg-[#00796B] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-wide uppercase">
                Iniciar Sesión con Google
              </h2>
              <p className="text-[11px] text-teal-100 font-medium">
                Evaluación Overhaul • Huevos Kikes
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex justify-center">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 inline-flex items-center justify-center">
              <img
                src={getCompanyLogo()}
                alt="Incubadora Santander S.A."
                className="h-10 w-auto max-w-[190px] object-contain"
              />
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <h3 className="text-sm font-bold text-slate-800">
              Sincronice los menús e imágenes más recientes
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Inicie sesión con su cuenta corporativa de Google (<span className="font-semibold text-slate-700">@kikes.com.co</span>) para cargar automáticamente las imágenes personalizadas, usuarios, formularios y actas actualizadas desde la base de datos.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2 text-xs text-rose-800 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={onSignIn}
              disabled={isBusy}
              className="w-full bg-[#00796B] hover:bg-[#005B52] text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md flex items-center justify-center space-x-2.5 transition-colors disabled:opacity-70 cursor-pointer"
              id="initial-google-signin-btn"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {isSyncingData
                      ? 'Descargando menús, imágenes y datos...'
                      : 'Conectando con Google...'}
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Iniciar sesión con Google</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onContinueOffline}
              disabled={isBusy}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
              id="initial-google-skip-btn"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Continuar sin iniciar sesión (datos locales)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
