export type ViewMode = 
  | 'INICIO' 
  | 'ENTREGAS_VACIO' 
  | 'PRUEBAS_CARGA' 
  | 'INDICADORES_MENU'
  | 'PERSONAS' 
  | 'PERSONALIZACION'
  | 'NUEVO_REPORTE_MENU' 
  | 'FORM_ZUCAMI' 
  | 'FORM_SALMET' 
  | 'FORM_GRANJAS_PISO' 
  | 'FORM_EL_ROBLE' 
  | 'HISTORICO' 
  | 'INDICADORES' 
  | 'INDICADORES_ACTIVIDADES'
  | 'COMPLETAR_ACTA' 
  | 'FORM_PRUEBA_CARGA'
  | 'HISTORICO_ACTAS';

export type ZoneType = 'ZUCAMI' | 'SALMET' | 'GRANJAS PISO' | 'EL ROBLE';

export type FarmName = string;

export type CageType = 'A' | 'D' | 'MEC' | 'PISO' | 'OTRO';

export type ItemStatus = 'cumple' | 'no_cumple' | 'na';

export interface Persona {
  id: string;
  nombre: string;
  cargo: string;
  correo: string;
  telefono?: string;
  avatarUrl?: string;
  mostrarOpcionCorreo?: boolean;
}

export interface EvaluationItem {
  id: string;
  question: string;
  criteria?: string;
  status: ItemStatus;
  score?: number;
  failuresCount?: number;
  category?: string;
  observation?: string;
  photoUrl?: string;
  priority?: 'Alta' | 'Media' | 'Baja';
}

export interface EvaluationSection {
  id: string;
  title: string;
  items: EvaluationItem[];
}

export interface Signature {
  role: string;
  personaId: string;
  nombre: string;
  cargo: string;
  correo: string;
  signedAt?: string;
  signatureDataUrl?: string;
}

export interface EvaluationReport {
  id: string;
  code: string; // e.g. ACTA-2026-001
  reportType: 'ENTREGAS_VACIO' | 'PRUEBAS_CARGA';
  zone: ZoneType;
  farm: FarmName;
  cageType: CageType;
  galpon: string;
  evaluationDate: string;
  evaluadorId: string;
  evaluadorNombre: string;
  supervisorId: string;
  supervisorNombre: string;
  coordinadorId?: string;
  coordinadorNombre?: string;
  sections: EvaluationSection[];
  totalScore: number; // percentage e.g. 92.5
  totalItems: number;
  passedItems: number;
  failedItems: number;
  naItems: number;
  status?: string;
  signatures: Signature[];
  emailSentTo?: string[];
  pdfGenerated?: boolean;
  createdAt: string;
  notes?: string;
  parentReportId?: string;
  parentReportCode?: string;
  totalFailures?: number;

  // Embedded PRUEBA CON CARGA data on the same report
  pruebaConCarga?: {
    id?: string;
    completed: boolean;
    completedAt?: string;
    fechaPruebaConCarga?: string;
    totalScore?: number;
    totalFailures?: number;
    notes?: string;
    sections?: EvaluationSection[];
    signatures?: Signature[];
  };

  // General Information Fields (Información General)
  numeroOtMp?: string;
  diasVacioSanitario?: number;
  cumplimientoEnFecha?: number;
  fechaInicioMantenimiento?: string;
  diasMantenimientoProgramados?: number;
  fechaInicioMasDiasProgramados?: string;
  fechaFinalizacion?: string;
  fechaFinalizacion100?: string;
  fechaEntregaVacioProduccion?: string;
  fechaPruebaConCarga?: string;
  zonaNombre?: string;
}

export interface MenuItem {
  menu: string;
  titulo: string;
  imagen: string;
  description?: string;
  targetView: ViewMode;
}
