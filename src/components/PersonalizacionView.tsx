import React, { useState, useRef, useEffect } from 'react';
import {
  MENU_ITEMS_CATALOG,
  getCustomMenuImages,
  saveMenuImage,
  resetMenuImage,
  processUploadedImage,
  hydrateCustomMediaCache,
  MenuItemImageConfig
} from '../lib/customImages';
import {
  getCompanyLogo,
  saveCompanyLogo,
  resetCompanyLogo,
  hasCustomCompanyLogo
} from '../assets/logo';
import {
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Check,
  Info,
  FileText,
  Building2,
  Loader2
} from 'lucide-react';
import {
  saveSingleCustomImageToGoogleSheet,
  removeSingleCustomImageFromGoogleSheet,
  importCustomImagesFromGoogleSheets
} from '../lib/googleSheetsSync';

interface PersonalizacionViewProps {
  onImagesUpdated: () => void;
}

export const PersonalizacionView: React.FC<PersonalizacionViewProps> = ({ onImagesUpdated }) => {
  const [imagesMap, setImagesMap] = useState<Record<string, string>>(() => getCustomMenuImages());
  const [currentLogo, setCurrentLogo] = useState<string>(() => getCompanyLogo());
  const [activeCategory, setActiveCategory] = useState<string>('TODOS');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const runAutoPullFromCloud = async (cancelledRef?: { current: boolean }) => {
    try {
      setIsSyncingCloud(true);
      setFeedbackMessage(null);
      const hydrated = await hydrateCustomMediaCache();
      if (cancelledRef?.current) return;
      if (hydrated) {
        setImagesMap(getCustomMenuImages());
        setCurrentLogo(getCompanyLogo());
        onImagesUpdated();
      }
      const res = await importCustomImagesFromGoogleSheets(undefined, true);
      if (cancelledRef?.current) return;
      if (res.success) {
        setImagesMap(getCustomMenuImages());
        setCurrentLogo(getCompanyLogo());
        onImagesUpdated();
      } else {
        showFeedback(
          'error',
          res.error || 'Inicie sesión con Google para descargar las imágenes y el logo más recientes.'
        );
      }
    } catch (err: any) {
      if (!cancelledRef?.current) {
        showFeedback(
          'error',
          err?.message || 'Inicie sesión con Google para descargar las imágenes y el logo más recientes.'
        );
      }
    } finally {
      if (!cancelledRef?.current) {
        setIsSyncingCloud(false);
      }
    }
  };

  useEffect(() => {
    const cancelledRef = { current: false };
    runAutoPullFromCloud(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    if (type === 'success') {
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 4500);
    }
  };

  const handleFileUpload = async (key: string, file: File) => {
    try {
      setLoadingKey(key);
      const dataUrl = await processUploadedImage(file);
      saveMenuImage(key, dataUrl);
      const freshMap = getCustomMenuImages();
      setImagesMap(freshMap);
      onImagesUpdated();

      // Automatically sync this single image to the cloud database
      const itemConfig = MENU_ITEMS_CATALOG.find((c) => c.key === key);
      const itemTitle = itemConfig?.title || key;
      const cloudRes = await saveSingleCustomImageToGoogleSheet(key, dataUrl, itemTitle);

      if (cloudRes.success) {
        showFeedback('success', `¡Imagen para "${itemTitle}" subida y sincronizada en la nube con éxito!`);
      } else {
        showFeedback('success', `Imagen para "${itemTitle}" guardada localmente (${cloudRes.error ? 'Aviso nube: ' + cloudRes.error : ''})`);
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error al procesar y subir la imagen.');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleResetSingle = async (item: MenuItemImageConfig) => {
    try {
      setLoadingKey(item.key);
      resetMenuImage(item.key);
      const freshMap = getCustomMenuImages();
      setImagesMap(freshMap);
      onImagesUpdated();

      // Remove / clear from cloud row
      await removeSingleCustomImageFromGoogleSheet(item.key);
      showFeedback('success', `Imagen de "${item.title}" restablecida al diseño predeterminado.`);
    } catch (err) {
      showFeedback('success', `Imagen de "${item.title}" restablecida.`);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      setLoadingLogo(true);
      const dataUrl = await processUploadedImage(file, 480, 160, 0.9);
      saveCompanyLogo(dataUrl);
      setCurrentLogo(getCompanyLogo());
      onImagesUpdated();

      // Automatically sync the company logo to the cloud database
      const cloudRes = await saveSingleCustomImageToGoogleSheet(
        'COMPANY_LOGO',
        dataUrl,
        'Logo Oficial de la Empresa (Encabezado Actas y Visores)'
      );

      if (cloudRes.success) {
        showFeedback('success', '¡Logo oficial subido y sincronizado automáticamente en la nube!');
      } else {
        showFeedback('success', `Logo guardado localmente (${cloudRes.error ? 'Aviso nube: ' + cloudRes.error : ''})`);
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error al procesar el logo de la empresa.');
    } finally {
      setLoadingLogo(false);
    }
  };

  const handleResetLogo = async () => {
    try {
      setLoadingLogo(true);
      resetCompanyLogo();
      setCurrentLogo(getCompanyLogo());
      onImagesUpdated();

      // Remove / clear logo from cloud row
      await removeSingleCustomImageFromGoogleSheet('COMPANY_LOGO');
      showFeedback('success', 'Logo oficial restablecido al diseño predeterminado.');
    } catch (err) {
      showFeedback('success', 'Logo de la empresa restablecido.');
    } finally {
      setLoadingLogo(false);
    }
  };

  const categories = [
    { id: 'TODOS', label: 'Todos' },
    { id: 'FORMATO_LOGO', label: '⭐ Logo Formatos (Top Left)' },
    { id: 'PRINCIPAL', label: 'Menú Inicio' },
    { id: 'VACIO', label: 'Entregas en Vacío' },
    { id: 'ZONAS', label: 'Zonas / Sistemas' },
    { id: 'CARGA', label: 'Pruebas con Carga' },
  ];

  const filteredItems = MENU_ITEMS_CATALOG.filter((item) => {
    if (activeCategory === 'TODOS') return true;
    if (activeCategory === 'FORMATO_LOGO') return false;
    return item.category === activeCategory;
  });

  const isCustomLogo = hasCustomCompanyLogo();

  return (
    <div className="p-4 sm:p-6 pb-28 sm:pb-36 max-w-5xl mx-auto space-y-6">
      {/* Top Welcome Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00796B]"></span>
            <h2 className="text-xl font-bold text-slate-800">Personalización de Imágenes y Logo</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personalice el logo oficial para el encabezado superior izquierdo de los formatos (actas PDF) y las imágenes de los menús.
          </p>
        </div>

        {isSyncingCloud && (
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Actualizando imágenes...</span>
          </div>
        )}
      </div>

      {/* Gray Information Banner */}
      <div className="bg-slate-100/90 border border-slate-300 rounded-xl p-4 text-slate-700 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="w-7 h-7 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 text-slate-600 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Sincronización Automática Individual y Especificaciones
            </h4>
            <div className="text-xs text-slate-600 space-y-0.5 leading-relaxed">
              <p>
                <span className="font-semibold text-slate-700">Subida individual a la nube:</span> Cada vez que sube o actualiza una imagen o logo, se guarda automáticamente en la base de datos en Google Sheets de forma aislada sin afectar las demás.
              </p>
              <p>
                <span className="font-semibold text-slate-700">Formatos compatibles:</span> PNG (con o sin transparencia), JPG, JPEG, WEBP, SVG
              </p>
              <p>
                <span className="font-semibold text-slate-700">Logo de Formatos:</span> Recomendado horizontal o rectangular (con fondo transparente o blanco)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold animate-fadeIn ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          {feedbackMessage.type === 'error' && (
            <button
              type="button"
              onClick={() => runAutoPullFromCloud()}
              disabled={isSyncingCloud}
              className="bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors disabled:opacity-50"
            >
              Conectar con Google
            </button>
          )}
        </div>
      )}

      {/* Categories Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#00796B] text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
              id={`cat-filter-${cat.id.toLowerCase()}`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* FEATURED: Company Format Logo (Top Left Header) */}
      {(activeCategory === 'TODOS' || activeCategory === 'FORMATO_LOGO') && (
        <div
          className="bg-white rounded-xl border-2 border-teal-600/30 p-5 shadow-xs space-y-4 relative overflow-hidden"
          id="custom-format-logo-card"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00796B]">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                    Logo Oficial de la Empresa (Encabezado Superior Izquierdo de Actas)
                  </h3>
                  {isCustomLogo ? (
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>Personalizado Activo</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Predeterminado
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Este logo se ubica automáticamente en el espacio superior izquierdo de las actas de mantenimiento tipo overhaul (GMI-F-35), visor de PDF y reportes impresos o enviados por correo.
                </p>
              </div>
            </div>
          </div>

          {/* Real-time Format Header Live Preview Frame */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Vista Previa en Vivo: Encabezado Oficial del Formato (Top Left)
            </span>

            <div className="bg-white border-b-2 border-slate-900 p-3 sm:p-4 rounded-lg shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Top Left Logo Position */}
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center h-12 w-36 sm:w-44 bg-slate-50/50 border border-dashed border-teal-300 rounded-md p-1 relative shrink-0">
                  <img
                    src={currentLogo}
                    alt="Logo Empresa"
                    className="max-h-10 w-auto max-w-full object-contain block"
                  />
                  {loadingLogo && (
                    <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                      <div className="animate-spin w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#162e84] uppercase tracking-wider block">
                    GESTIÓN DE MANTENIMIENTO
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase leading-tight">
                    GMI-F-35 ACTA DE RECIBIDO DE MANTENIMIENTO TIPO OVERHAUL
                  </h4>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-right shrink-0 hidden md:block">
                <div className="text-[9px] text-slate-400 font-bold uppercase">CÓDIGO FORMATO</div>
                <div className="text-xs font-bold text-[#162e84] font-mono">GMI-F-35-SAMPLE</div>
              </div>
            </div>
          </div>

          {/* Logo Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              className="hidden"
              ref={logoInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleLogoUpload(file);
                  e.target.value = '';
                }
              }}
            />

            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={loadingLogo}
              className="bg-[#00796B] hover:bg-[#005B52] text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center space-x-2 transition-colors shadow-2xs disabled:opacity-50"
              id="upload-company-logo-btn"
            >
              <Upload className="w-4 h-4" />
              <span>Subir Logo Oficial para Formatos</span>
            </button>

            {isCustomLogo && (
              <button
                type="button"
                onClick={handleResetLogo}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-lg border border-slate-300 transition-colors flex items-center space-x-1.5 shadow-2xs"
                id="reset-company-logo-btn"
                title="Restablecer logo predeterminado"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Logo Original</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid of Menu Customization Cards */}
      {filteredItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Iconos e Imágenes de Opciones de Menús
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const currentImg = imagesMap[item.key] || item.defaultImage;
              const isCustom = imagesMap[item.key] && imagesMap[item.key] !== item.defaultImage;
              const isLoading = loadingKey === item.key;

              return (
                <div
                  key={item.key}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  id={`custom-img-card-${item.key}`}
                >
                  {/* Header of card */}
                  <div className="p-4 pb-2 flex items-center justify-between border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        {item.category === 'PRINCIPAL' ? 'Menú Principal' : item.category === 'VACIO' ? 'Entregas Vacío' : item.category === 'ZONAS' ? 'Zona' : 'Pruebas Carga'}
                      </span>
                      <h3 className="font-bold text-slate-800 text-sm">{item.title}</h3>
                    </div>

                    {isCustom ? (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Personalizada</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Original
                      </span>
                    )}
                  </div>

                  {/* Image Preview Box matching the actual menu card look */}
                  <div className="p-4 flex flex-col items-center justify-center bg-slate-50/70 border-b border-slate-100">
                    <div className="w-44 h-40 rounded-xl overflow-hidden bg-white border border-slate-200 shadow-xs flex items-center justify-center relative group-hover:border-teal-500 transition-colors">
                      <img
                        src={currentImg}
                        alt={item.title}
                        className="w-full h-full object-contain p-2"
                        referrerPolicy="no-referrer"
                      />
                      {isLoading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                          <div className="animate-spin w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 text-center line-clamp-1">{item.subtitle}</p>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3.5 bg-white flex items-center justify-between gap-2">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                      className="hidden"
                      ref={(el) => {
                        fileInputRefs.current[item.key] = el;
                      }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(item.key, file);
                          e.target.value = '';
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[item.key]?.click()}
                      disabled={isLoading}
                      className="flex-1 bg-[#00796B] hover:bg-[#005B52] text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-2xs disabled:opacity-50"
                      id={`upload-btn-${item.key}`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir Imagen</span>
                    </button>

                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleResetSingle(item)}
                        title="Restablecer a imagen predeterminada"
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition-colors shrink-0"
                        id={`reset-btn-${item.key}`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

