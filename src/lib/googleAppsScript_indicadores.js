/**
 * SISTEMA KIKES OVERHAUL - ACTUALIZACIÓN AUTOMÁTICA DE MATRIZ DE INDICADORES
 * --------------------------------------------------------------------------
 * Horarios de ejecución automática:
 * - Miércoles a las 6:00 AM
 * - Sábados a las 6:00 AM
 *
 * Columna de referencia estricta para el mes de corte:
 * - "Fecha de finalización al 100%:" (Columna K / índice 10)
 * - Las filas con esta columna vacía se omiten (no usan otras fechas como respaldo).
 *
 * Mes evaluado: Mes vencido (el último mes calendario completamente finalizado).
 */

const NOMBRE_PESTANA_MATRIZ = 'MATRIZ_INDICADORES';
const PESTANAS_GRANJAS = ['ZUCAMI', 'SALMET', 'GRANJAS PISO', 'EL ROBLE'];
const NOMBRES_PESTANA_CATEGORIAS = ['CATEG_:ACTIVIDADES', 'CATEG_ACTIVIDADES'];

// 11 Categorías oficiales de Kikes Overhaul
const CATEGORIAS_OFICIALES = [
  { id: 'cat_a_electrico', label: '[A] Mtto electrico cajas de control y potencia [19]', group: 'A' },
  { id: 'cat_a_agua', label: '[A] Suministro agua [17]', group: 'A' },
  { id: 'cat_a_alimento', label: '[A] Suministro alimento [17]', group: 'A' },
  { id: 'cat_a_gallinaza', label: '[A] Recogida gallinaza [27]', group: 'A' },
  { id: 'cat_a_alumbrado', label: '[A] Alumbrado [17]', group: 'A' },
  { id: 'cat_a_ambiente', label: '[A] Ambiente controlado [17]', group: 'A' },
  { id: 'cat_b_silos', label: '[B] Silos [56]', group: 'B' },
  { id: 'cat_b_antipicaje', label: '[B] Antipicaje [56]', group: 'B' },
  { id: 'cat_c_huevo', label: '[C] Recogida huevo [56]', group: 'C' },
  { id: 'cat_c_jaula', label: '[C] Jaula [26]', group: 'C' },
  { id: 'cat_c_otros', label: '[C] Otros [26]', group: 'C' }
];

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const MAPA_MESES_NOMBRE = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  ene: 0, abr: 3, ago: 7, dic: 11,
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

/**
 * 1. FUNCIÓN PRINCIPAL:
 * Extrae las actas del mes vencido (último mes calendario finalizado, usando estrictamente
 * "Fecha de finalización al 100%:") de las 4 granjas y genera la matriz en 'MATRIZ_INDICADORES'.
 */
function actualizarMatrizIndicadores() {
  Logger.log('🚀 [Kikes Overhaul] Iniciando actualización de Matriz de Indicadores (Mes Vencido)...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/Bogota';
  const hoyStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const hoyPartes = hoyStr.split('-');
  const anioActual = parseInt(hoyPartes[0], 10);
  const mesActual = parseInt(hoyPartes[1], 10) - 1;

  // Calcular siempre el mes vencido (último mes completamente transcurrido)
  const mesVencidoDate = new Date(Date.UTC(anioActual, mesActual - 1, 15));
  const anioEvaluado = mesVencidoDate.getUTCFullYear();
  const mesEvaluado = mesVencidoDate.getUTCMonth();

  Logger.log('📅 [Kikes Overhaul] Mes vencido a evaluar: ' + MESES_ES[mesEvaluado] + '-' + anioEvaluado + ' (Ref estricta: Fecha de finalización al 100%:)');

  // 1. Obtener mapeo de preguntas a categorías
  const mapaCategorias = obtenerMapaCategorias(ss);

  // 2. Extraer actas del mes vencido
  var actasMes = recolectarActasParaMes(ss, tz, anioEvaluado, mesEvaluado, mapaCategorias);

  Logger.log('📊 [Kikes Overhaul] Total de actas encontradas para ' + MESES_ES[mesEvaluado] + '-' + anioEvaluado + ': ' + actasMes.length);

  // Ordenar columnas por Granja y luego por Galpón
  actasMes.sort(function (a, b) {
    if (a.granja !== b.granja) return a.granja.localeCompare(b.granja);
    var gA = parseInt(a.galpon, 10);
    var gB = parseInt(b.galpon, 10);
    if (!isNaN(gA) && !isNaN(gB)) return gA - gB;
    return String(a.galpon).localeCompare(String(b.galpon));
  });

  // 3. Renderizar matriz con estilos y semáforo
  renderizarMatriz(ss, actasMes, anioEvaluado, mesEvaluado);

  Logger.log('✅ [Kikes Overhaul] Matriz actualizada con éxito en la pestaña "MATRIZ_INDICADORES".');
}

/**
 * Recolecta las actas de las 4 pestañas de granjas cuyo mes de "Fecha de finalización al 100%:" coincida con anio/mes.
 * Las filas donde "Fecha de finalización al 100%:" está vacía se omiten por completo.
 */
function recolectarActasParaMes(ss, tz, anioObjetivo, mesObjetivo, mapaCategorias) {
  var resultado = [];

  PESTANAS_GRANJAS.forEach(function (nombrePestana) {
    const hoja = ss.getSheetByName(nombrePestana);
    if (!hoja) return;

    const rango = hoja.getDataRange();
    const datos = rango.getValues();
    // Usar getDisplayValues() para fechas evita que Google Sheets (en configuración regional EE.UU. MM/DD/YYYY)
    // invierta día y mes en fechas como "01/10/2026" o "11/08/2026".
    const displayDatos = rango.getDisplayValues();
    if (datos.length <= 1) return;

    const encabezados = datos[0];
    const colIdx = resolverIndicesColumnas(encabezados);
    var conteoPestana = 0;

    for (var i = 1; i < datos.length; i++) {
      var fila = datos[i];
      var filaDisplay = displayDatos[i];
      var codigo = fila[0];
      var codigoStr = String(codigo || '').trim();
      if (!codigoStr) continue;
      if (codigoStr.toUpperCase().indexOf('CÓDIGO ACTA') !== -1 || codigoStr.toUpperCase().indexOf('CODIGO ACTA') !== -1) {
        continue;
      }

      // Columna de referencia estricta: "Fecha de finalización al 100%:" (Col K / índice 10)
      var rawFecha100 = String(filaDisplay[colIdx.finalizacion100] || '').trim();
      if (!rawFecha100) {
        // Si está vacía, esta fila aún no tiene Fecha de finalización al 100% y NO debe mostrarse.
        continue;
      }

      var fechaRef = parsearFecha(rawFecha100, tz);
      if (!fechaRef) continue;

      if (fechaRef.getUTCFullYear() === anioObjetivo && fechaRef.getUTCMonth() === mesObjetivo) {
        resultado.push(procesarActa(fila, filaDisplay, encabezados, colIdx, fechaRef, mapaCategorias, tz));
        conteoPestana++;
      }
    }

    if (conteoPestana > 0) {
      Logger.log('📍 Encontradas ' + conteoPestana + ' actas en "' + nombrePestana + '"');
    }
  });

  return resultado;
}

/**
 * Resuelve dinámicamente los índices de columna por nombre de encabezado (con respaldo en los índices estándar).
 */
function resolverIndicesColumnas(encabezados) {
  var buscar = function (patrones, fallbackIdx) {
    for (var i = 0; i < encabezados.length; i++) {
      var h = normalizarTexto(encabezados[i]);
      for (var p = 0; p < patrones.length; p++) {
        if (h.indexOf(patrones[p]) !== -1) {
          return i;
        }
      }
    }
    return fallbackIdx;
  };

  var pcDividerIdx = encabezados.length;
  for (var i = 21; i < encabezados.length; i++) {
    var hRaw = String(encabezados[i] || '').trim().toUpperCase();
    if (
      hRaw === 'PRUEBA CON CARGA' ||
      hRaw === 'PRUEBA CON CARGA (CON AVES)' ||
      hRaw.indexOf('PC - FECHA') !== -1 ||
      hRaw.indexOf('PC - % CONFIABILIDAD') !== -1 ||
      hRaw.indexOf('PC - ') === 0
    ) {
      pcDividerIdx = i;
      break;
    }
  }

  return {
    zona: buscar(['zona / sistema', 'zona'], 1),
    granja: buscar(['granja'], 2),
    galpon: buscar(['galpon'], 3),
    inicio: buscar(['fecha de inicio del mantenimiento'], 6),
    diasProg: buscar(['dias de mantenimiento programados'], 7),
    finProg: buscar(['fecha de inicio + dias programados'], 8),
    finalizacion: buscar(['fecha de finalizacion:'], 9),
    finalizacion100: buscar(['fecha de finalizacion al 100%'], 10),
    entregaVacio: buscar(['fecha de entrega de vacio'], 11),
    diasVacio: buscar(['dias de vacio sanitario'], 13),
    evaluacion: buscar(['fecha de evaluacion'], 14),
    totalScore: buscar(['calificacion general'], 17),
    pcDividerIdx: pcDividerIdx
  };
}

/**
 * 2. CONFIGURACIÓN DE DISPARADORES AUTOMÁTICOS:
 * Ejecuta la actualización todos los Miércoles y Sábados a las 6:00 AM
 */
function configurarActualizacionAutomatica() {
  Logger.log('⏰ [Kikes Overhaul] Configurando disparadores automáticos...');
  var disparadoresExistentes = ScriptApp.getProjectTriggers();
  for (var i = 0; i < disparadoresExistentes.length; i++) {
    if (disparadoresExistentes[i].getHandlerFunction() === 'actualizarMatrizIndicadores') {
      ScriptApp.deleteTrigger(disparadoresExistentes[i]);
    }
  }

  // Disparador 1: Miércoles a las 6:00 AM
  ScriptApp.newTrigger('actualizarMatrizIndicadores')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(6)
    .create();

  // Disparador 2: Sábados a las 6:00 AM
  ScriptApp.newTrigger('actualizarMatrizIndicadores')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SATURDAY)
    .atHour(6)
    .create();

  Logger.log('✅ Disparadores creados: Miércoles y Sábados a las 6:00 AM.');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Automatización Activada',
      'La Matriz de Indicadores se actualizará automáticamente todos los MIÉRCOLES y SÁBADOS a las 6:00 AM para el mes vencido (según Fecha de finalización al 100%).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // Si se ejecuta desde el editor sin UI abierta
  }
}

/**
 * 3. MENÚ EN GOOGLE SHEETS
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 Kikes Overhaul')
    .addItem('▶️ Actualizar Matriz Ahora (Mes Vencido)', 'actualizarMatrizIndicadores')
    .addItem('⏰ Activar Actualización Automática (Miércoles y Sábados)', 'configurarActualizacionAutomatica')
    .addItem('ℹ️ Ver Estado de Automatización', 'verEstadoAutomatizacion')
    .addToUi();
}

function verEstadoAutomatizacion() {
  var disparadores = ScriptApp.getProjectTriggers();
  var activos = 0;
  for (var i = 0; i < disparadores.length; i++) {
    if (disparadores[i].getHandlerFunction() === 'actualizarMatrizIndicadores') {
      activos++;
    }
  }

  var ui = SpreadsheetApp.getUi();
  if (activos >= 2) {
    ui.alert('📅 Estado: ACTIVO', 'La actualización automática está programada para ejecutarse los Miércoles y Sábados a las 6:00 AM.', ui.ButtonSet.OK);
  } else {
    ui.alert('⚠️ Estado: INACTIVO', 'Ejecuta "Activar Actualización Automática" en el menú para programar las ejecuciones.', ui.ButtonSet.OK);
  }
}

/**
 * AUXILIARES DE CÁLCULO Y DISEÑO
 */
function procesarActa(fila, filaDisplay, encabezados, colIdx, fechaRef, mapaCategorias, tz) {
  var granja = String(fila[colIdx.granja] || fila[colIdx.zona] || 'GRANJA').trim().toUpperCase();
  var galpon = String(fila[colIdx.galpon] || '1').trim();
  var galponMatch = galpon.match(/\d+/);
  if (galponMatch) {
    galpon = galponMatch[0];
  }

  var fechaEntregaStr = MESES_ES[fechaRef.getUTCMonth()] + '-' + fechaRef.getUTCFullYear();

  var fInicio = parsearFecha(filaDisplay[colIdx.inicio] || fila[colIdx.inicio], tz);
  var diasProg = parseInt(fila[colIdx.diasProg], 10) || 0;
  var fFinProg = parsearFecha(filaDisplay[colIdx.finProg] || fila[colIdx.finProg], tz);
  if (fFinProg && fFinProg.getUTCFullYear() < 2000) {
    fFinProg = null;
  }
  if (!fFinProg && fInicio && diasProg > 0) {
    fFinProg = new Date(fInicio.getTime());
    fFinProg.setUTCDate(fFinProg.getUTCDate() + diasProg);
  }

  var fReal = fechaRef;

  var cumplimientoFecha = null;
  if (fInicio && fReal && fFinProg) {
    var msPorDia = 1000 * 60 * 60 * 24;
    var diasReales = Math.round((fReal.getTime() - fInicio.getTime()) / msPorDia);
    var diasIdeales = Math.round((fFinProg.getTime() - fInicio.getTime()) / msPorDia);
    if (diasIdeales > 0) {
      cumplimientoFecha = Math.round(((diasReales / diasIdeales) - 1) * 10000) / 100;
    } else if (diasIdeales === 0) {
      cumplimientoFecha = diasReales === 0 ? 0.0 : 100.0;
    }
  }

  var totalScore = parsearPuntaje(fila[colIdx.totalScore], 100);

  var diasVacioRaw = fila[colIdx.diasVacio];
  var diasVacio = 8;
  if (diasVacioRaw !== undefined && diasVacioRaw !== null && diasVacioRaw !== '') {
    var parsedDias = parseInt(diasVacioRaw, 10);
    if (!isNaN(parsedDias)) {
      diasVacio = parsedDias;
    }
  }

  var catScores = {};
  CATEGORIAS_OFICIALES.forEach(function (cat) {
    catScores[cat.id] = { total: 0, count: 0 };
  });

  // Iterar únicamente sobre las columnas de evaluación en vacío (detenerse antes de PRUEBA CON CARGA)
  for (var col = 21; col < colIdx.pcDividerIdx; col += 2) {
    var preguntaRaw = String(encabezados[col] || '').trim();
    if (!preguntaRaw) continue;
    if (preguntaRaw.toUpperCase().indexOf('OBSERVACIONES:') !== -1) continue;

    var valor = fila[col];
    if (valor === undefined || valor === null || valor === '') continue;

    var valStr = String(valor).trim();
    var valLower = valStr.toLowerCase();
    if (valLower === 'n/a' || valLower === 'na') continue;

    var preguntaNorm = normalizarPregunta(preguntaRaw);
    var catId =
      mapaCategorias[preguntaRaw.toLowerCase()] ||
      mapaCategorias[preguntaNorm] ||
      autoDetectarCategoria(preguntaRaw);

    if (catId && catScores[catId]) {
      var numVal = null;
      if (valLower.indexOf('no cumple') !== -1 || valLower === 'no_cumple') {
        numVal = 0;
      } else if (valLower.indexOf('cumple') !== -1) {
        numVal = 100;
      } else {
        numVal = parsearPuntaje(valor, null);
      }

      if (numVal !== null) {
        catScores[catId].total += numVal;
        catScores[catId].count += 1;
      }
    }
  }

  var finalCatAverages = {};
  CATEGORIAS_OFICIALES.forEach(function (cat) {
    if (catScores[cat.id].count > 0) {
      finalCatAverages[cat.id] = Math.round((catScores[cat.id].total / catScores[cat.id].count) * 100) / 100;
    } else {
      finalCatAverages[cat.id] = null;
    }
  });

  return {
    granja: granja,
    galpon: galpon,
    fechaEntregaStr: fechaEntregaStr,
    cumplimientoFecha: cumplimientoFecha,
    cumplimientoCondicion: totalScore,
    diasVacio: diasVacio,
    catAverages: finalCatAverages
  };
}

function renderizarMatriz(ss, actasMes, anio, mes) {
  var hoja = ss.getSheetByName(NOMBRE_PESTANA_MATRIZ);
  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_PESTANA_MATRIZ);
  }

  try {
    hoja.setHiddenGridlines(true);
  } catch (e) {
    // ignorar si no está soportado
  }

  var maxCols = Math.max(hoja.getMaxColumns(), 40);
  var maxRows = Math.max(hoja.getMaxRows(), 60);

  hoja.getRange(1, 1, maxRows, maxCols).clearContent();
  hoja.getRange(1, 1, maxRows, maxCols).setBackground('#ffffff');
  hoja.getRange(1, 1, maxRows, maxCols).setBorder(false, false, false, false, false, false);
  hoja.getRange(1, 1, maxRows, maxCols).setFontWeight('normal');

  var mesNombre = MESES_ES[mes] + '-' + anio;
  var ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  var mStr = String(mes + 1).padStart(2, '0');
  var fechaInicio = '01/' + mStr + '/' + anio;
  var fechaFin = ultimoDia + '/' + mStr + '/' + anio;

  var filas = [
    ['INDICADORES – OVERHAUL'],
    [],
    ['MES DE CORTE', mesNombre],
    ['FECHA INICIO', fechaInicio],
    ['FECHA FIN', fechaFin],
    []
  ];

  var filaGranja = ['Granja'];
  var filaGalpon = ['Galpón'];
  var filaFecha = ['Fecha Entrega'];
  var filaCumplFecha = ['Cumplimiento en Fecha'];
  var filaCumplCond = ['Cumplimiento en Condición'];
  var filaVacio = ['Días Vacio Sanitario'];

  actasMes.forEach(function (acta) {
    filaGranja.push(acta.granja);
    filaGalpon.push(acta.galpon);
    filaFecha.push(acta.fechaEntregaStr);

    filaCumplFecha.push(
      acta.cumplimientoFecha !== null
        ? String(acta.cumplimientoFecha.toFixed(2)).replace('.', ',') + '%'
        : '-'
    );
    filaCumplCond.push(String(acta.cumplimientoCondicion.toFixed(2)).replace('.', ',') + '%');
    filaVacio.push(acta.diasVacio !== null ? acta.diasVacio : 8);
  });

  filas.push(filaGranja);
  filas.push(filaGalpon);
  filas.push(filaFecha);
  filas.push(filaCumplFecha);
  filas.push(filaCumplCond);
  filas.push(filaVacio);

  CATEGORIAS_OFICIALES.forEach(function (cat) {
    var filaCat = [cat.label];
    actasMes.forEach(function (acta) {
      var val = acta.catAverages[cat.id];
      filaCat.push(val !== null && val !== undefined ? String(val.toFixed(2)).replace('.', ',') + '%' : '');
    });
    filas.push(filaCat);
  });

  var numFilas = filas.length;

  for (var r = 0; r < filas.length; r++) {
    if (filas[r].length > 0) {
      hoja.getRange(r + 1, 1, 1, filas[r].length).setValues([filas[r]]);
    }
  }

  var COLOR_TEAL_OSCURO = '#005B52';
  var COLOR_GRIS_ENCABEZADO = '#f1f5f9';
  var COLOR_VERDE_SEMAFORO = '#bfead2';
  var COLOR_ROJO_SEMAFORO = '#fecdd3';
  var COLOR_TEAL_CLARO = '#e6f4f2';

  hoja.getRange('A1:D1').setBackground(COLOR_TEAL_OSCURO).setFontColor('#ffffff').setFontWeight('bold').setFontSize(12);
  hoja.getRange('A3:A5').setBackground('#e2e8f0').setFontWeight('bold').setFontSize(9);
  hoja.getRange('B3:B5').setBackground(COLOR_TEAL_CLARO).setFontColor(COLOR_TEAL_OSCURO).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);

  if (actasMes.length > 0) {
    var colTotal = actasMes.length + 1;

    hoja.getRange(7, 1, 1, colTotal).setBackground(COLOR_GRIS_ENCABEZADO).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);
    hoja.getRange(8, 1, 1, colTotal).setBackground(COLOR_GRIS_ENCABEZADO).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);
    hoja.getRange(9, 1, 1, colTotal).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);
    hoja.getRange(7, 1, numFilas - 6, 1).setHorizontalAlignment('left').setFontWeight('bold').setFontSize(9);

    actasMes.forEach(function (acta, idx) {
      var col = idx + 2;
      var celda = hoja.getRange(10, col);
      celda.setHorizontalAlignment('center').setFontWeight('bold').setFontSize(9);
      if (acta.cumplimientoFecha !== null) {
        celda.setBackground(acta.cumplimientoFecha <= 12 ? COLOR_VERDE_SEMAFORO : COLOR_ROJO_SEMAFORO);
      }
    });

    actasMes.forEach(function (acta, idx) {
      var col = idx + 2;
      var celda = hoja.getRange(11, col);
      celda.setHorizontalAlignment('center').setFontWeight('bold').setFontSize(9);
      celda.setBackground(acta.cumplimientoCondicion >= 95 ? COLOR_VERDE_SEMAFORO : COLOR_ROJO_SEMAFORO);
    });

    hoja.getRange(12, 2, 1, actasMes.length).setHorizontalAlignment('center').setFontWeight('bold').setFontSize(9);

    CATEGORIAS_OFICIALES.forEach(function (cat, catIdx) {
      var rFila = 13 + catIdx;
      actasMes.forEach(function (acta, colIdx) {
        var col = colIdx + 2;
        var score = acta.catAverages[cat.id];
        if (score !== null && score !== undefined) {
          var celda = hoja.getRange(rFila, col);
          celda.setHorizontalAlignment('center').setFontWeight('bold').setFontSize(9);
          var esVerde = cat.group === 'A' ? score >= 100 : score >= 95;
          celda.setBackground(esVerde ? COLOR_VERDE_SEMAFORO : COLOR_ROJO_SEMAFORO);
        }
      });
    });

    hoja.setColumnWidth(1, 320);
    for (var c = 2; c <= colTotal; c++) {
      hoja.setColumnWidth(c, 115);
    }
  }

  hoja.setFrozenRows(6);
  hoja.setFrozenColumns(1);
}

/**
 * Convierte valores de calificación en porcentaje 0..100.
 * Maneja celdas formateadas como porcentaje en Google Sheets (0.91 -> 91, 1 -> 100, 0 -> 0).
 */
function parsearPuntaje(val, valorPorDefecto) {
  if (val === undefined || val === null || val === '') return valorPorDefecto;
  var str = String(val).replace('%', '').trim().replace(',', '.');
  if (str === '') return valorPorDefecto;
  var num = parseFloat(str);
  if (isNaN(num)) return valorPorDefecto;
  if (num > 0 && num <= 1) {
    return Math.round(num * 10000) / 100;
  }
  return Math.round(num * 100) / 100;
}

/**
 * Parsea fechas en múltiples formatos (DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YYYY, Date)
 * normalizadas al mediodía UTC para evitar desfases de zona horaria o inversión DD/MM vs MM/DD.
 */
function parsearFecha(val, tz) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    var zone = tz || Session.getScriptTimeZone() || 'America/Bogota';
    var iso = Utilities.formatDate(val, zone, 'yyyy-MM-dd');
    var p = iso.split('-');
    return new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12, 0, 0));
  }

  var s = String(val).trim();
  if (s === '') return null;

  // YYYY-MM-DD o YYYY/MM/DD (incluye timestamps ISO)
  var ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    var y1 = parseInt(ymdMatch[1], 10);
    var m1 = parseInt(ymdMatch[2], 10) - 1;
    var d1 = parseInt(ymdMatch[3], 10);
    return new Date(Date.UTC(y1, m1, d1, 12, 0, 0));
  }

  // DD/MM/YYYY o DD-MM-YYYY (con detección si el segundo número > 12 => MM/DD/YYYY)
  var dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    var p1 = parseInt(dmyMatch[1], 10);
    var p2 = parseInt(dmyMatch[2], 10);
    var y2 = parseInt(dmyMatch[3], 10);
    if (p2 > 12 && p1 <= 12) {
      return new Date(Date.UTC(y2, p1 - 1, p2, 12, 0, 0));
    }
    return new Date(Date.UTC(y2, p2 - 1, p1, 12, 0, 0));
  }

  // DD-MMM-YYYY o DD MMM YYYY (ej. 29-Aug-2026, 15-Oct-2026)
  var dMmmMatch = s.match(/^(\d{1,2})[\s\-]+([a-zA-ZáéíóúÁÉÍÓÚ]+)[\s\-]+(\d{4})/);
  if (dMmmMatch) {
    var d3 = parseInt(dMmmMatch[1], 10);
    var mNombre = dMmmMatch[2].toLowerCase();
    var y3 = parseInt(dMmmMatch[3], 10);
    if (MAPA_MESES_NOMBRE[mNombre] !== undefined) {
      return new Date(Date.UTC(y3, MAPA_MESES_NOMBRE[mNombre], d3, 12, 0, 0));
    }
  }

  var dtGen = new Date(s);
  if (!isNaN(dtGen.getTime())) {
    return new Date(Date.UTC(dtGen.getFullYear(), dtGen.getMonth(), dtGen.getDate(), 12, 0, 0));
  }

  return null;
}

function normalizarTexto(txt) {
  return String(txt || '')
    .trim()
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u');
}

function normalizarPregunta(txt) {
  return normalizarTexto(txt)
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\*+$/, '')
    .trim();
}

function obtenerMapaCategorias(ss) {
  var mapa = {};
  var hoja = null;

  for (var n = 0; n < NOMBRES_PESTANA_CATEGORIAS.length; n++) {
    hoja = ss.getSheetByName(NOMBRES_PESTANA_CATEGORIAS[n]);
    if (hoja) break;
  }

  if (!hoja) {
    var hojas = ss.getSheets();
    for (var s = 0; s < hojas.length; s++) {
      var normTitle = hojas[s].getName().toUpperCase().replace(/[\s_:]/g, '');
      if (normTitle === 'CATEGACTIVIDADES') {
        hoja = hojas[s];
        break;
      }
    }
  }

  if (!hoja) return mapa;

  var datos = hoja.getDataRange().getValues();
  if (datos.length <= 1) return mapa;

  var headers = datos[0];
  var idxPregunta = 6;
  var idxIdCat = 3;
  var idxCat = 4;

  for (var h = 0; h < headers.length; h++) {
    var hNorm = String(headers[h] || '').trim().toUpperCase();
    if (hNorm === 'ACTIVIDAD_PREGUNTA') idxPregunta = h;
    if (hNorm === 'ID_CATEGORIA') idxIdCat = h;
    if (hNorm === 'CATEGORIA') idxCat = h;
  }

  for (var i = 1; i < datos.length; i++) {
    var preguntaRaw = String(datos[i][idxPregunta] || '').trim();
    var idCatRaw = String(datos[i][idxIdCat] || '').trim();
    var catLabelRaw = String(datos[i][idxCat] || '').trim();
    var catCombinada = (idCatRaw + ' ' + catLabelRaw).trim();

    if (preguntaRaw && catCombinada) {
      CATEGORIAS_OFICIALES.forEach(function (cat) {
        if (
          idCatRaw === cat.id ||
          catCombinada.indexOf(cat.label) !== -1 ||
          catCombinada.indexOf(cat.id) !== -1 ||
          catCombinada.toLowerCase().indexOf(cat.label.toLowerCase().replace(/\s*\[\d+\]$/, '')) !== -1
        ) {
          mapa[preguntaRaw.toLowerCase()] = cat.id;
          mapa[normalizarPregunta(preguntaRaw)] = cat.id;
        }
      });
    }
  }
  return mapa;
}

function autoDetectarCategoria(pregunta) {
  var p = normalizarTexto(pregunta);
  if (p.indexOf('electr') !== -1 || p.indexOf('caja') !== -1 || p.indexOf('potencia') !== -1 || p.indexOf('voltaje') !== -1 || p.indexOf('breaker') !== -1) return 'cat_a_electrico';
  if (p.indexOf('agua') !== -1 || p.indexOf('bebed') !== -1 || p.indexOf('nipple') !== -1 || p.indexOf('tuberia') !== -1 || p.indexOf('flotador') !== -1) return 'cat_a_agua';
  if (p.indexOf('aliment') !== -1 || p.indexOf('comeder') !== -1 || p.indexOf('plato') !== -1 || p.indexOf('dosificador') !== -1 || p.indexOf('carro repartidor') !== -1) return 'cat_a_alimento';
  if (p.indexOf('gallinaza') !== -1 || p.indexOf('estiercol') !== -1 || p.indexOf('raspador') !== -1) return 'cat_a_gallinaza';
  if (p.indexOf('alumbr') !== -1 || p.indexOf('luz') !== -1 || p.indexOf('bombill') !== -1 || p.indexOf('ilumin') !== -1 || p.indexOf('luminaria') !== -1) return 'cat_a_alumbrado';
  if (p.indexOf('ambient') !== -1 || p.indexOf('ventil') !== -1 || p.indexOf('cortin') !== -1 || p.indexOf('extractor') !== -1 || p.indexOf('evaporativ') !== -1) return 'cat_a_ambiente';
  if (p.indexOf('silo') !== -1 || p.indexOf('bascul') !== -1 || p.indexOf('sinfin') !== -1) return 'cat_b_silos';
  if (p.indexOf('antipicaje') !== -1 || p.indexOf('picaje') !== -1 || p.indexOf('pico') !== -1) return 'cat_b_antipicaje';
  if (p.indexOf('huevo') !== -1 || p.indexOf('elevador') !== -1 || p.indexOf('transversal') !== -1) return 'cat_c_huevo';
  if (p.indexOf('jaula') !== -1 || p.indexOf('piso') !== -1 || p.indexOf('malla') !== -1 || p.indexOf('puerta') !== -1) return 'cat_c_jaula';
  return 'cat_c_otros';
}
