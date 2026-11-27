import { Persona, EvaluationSection, EvaluationReport } from '../types';

export const INITIAL_PERSONAS: Persona[] = [
  { id: 'p1', nombre: 'Ademar Uribe', cargo: 'Auxiliar de granja', correo: 'aldemaruribe1804@gmail.com', telefono: '+57 310 123 4567' },
  { id: 'p2', nombre: 'Alex Fernel', cargo: 'Coordinador avícola', correo: 'arles.conu@kikes.com.co', mostrarOpcionCorreo: true },
  { id: 'p3', nombre: 'Alex Fernel Jaimes Tarazona', cargo: 'Coordinador mtto industrial Overhaul', correo: 'mtto.overhaul.santander@kikes.com.co', telefono: '+57 315 999 8877', mostrarOpcionCorreo: true },
  { id: 'p4', nombre: 'Andres Felipe Puerto Ortega', cargo: 'Coordinador de mtto', correo: 'coordinador.mtto@kikes.com.co', telefono: '+57 318 444 3322' },
  { id: 'p5', nombre: 'Aquileo Tarazona', cargo: 'Jefe técnico postura bellavista', correo: 'aquileo.tarazona@kikes.com.co' },
  { id: 'p6', nombre: 'Arles fdo conu', cargo: 'Tec mtto ind', correo: 'mtto.px3.tecnico@kikes.com.co', mostrarOpcionCorreo: true },
  { id: 'p7', nombre: 'Camilo capote', cargo: 'Tec mtto ind', correo: 'mtto.px3.tecnico@kikes.com.co' },
  { id: 'p8', nombre: 'Carlos Andrea saavedra', cargo: 'Jefe técnico granjas piso', correo: 'carlos.saavedra@kikes.com.co' },
  { id: 'p9', nombre: 'Cesar Palomino', cargo: 'Supervisor lebrija', correo: 'mtto.granjaspiso.supervisor@kikes.com.co' },
  { id: 'p10', nombre: 'Cesar palomino Lebrija', cargo: 'Supervisor mantenimiento lebrija', correo: 'mtto.granjaspiso.supervisor@kikew.com.co' },
  { id: 'p11', nombre: 'Christian Balanta', cargo: 'Supe produccion', correo: 'egipto.supervisor@kikes.com.co' },
  { id: 'p12', nombre: 'Cristian Yair Hernandez Urbano', cargo: 'Técnico B', correo: 'cristianhernandez281@outlook.com' },
  { id: 'p13', nombre: 'Daniel Martínez', cargo: 'Calidad / Supervisión', correo: 'daniel.martinez@kikes.com.co' },
  { id: 'p14', nombre: 'Eduardo cogollo', cargo: 'Sup produccion', correo: 'egipto.supervisorpx3@kikes.com.co' },
  { id: 'p15', nombre: 'Edward Javier zabaleta mendez', cargo: 'Técnico c mtto', correo: 'edwardzabaleta@autlook.com' },
  { id: 'p16', nombre: 'Edwar molano', cargo: 'Jefe tecnico', correo: 'edwar.molano@kikes.com.co' },
  { id: 'p17', nombre: 'Fabian Molano Castro', cargo: 'Jefe Técnico de granja', correo: 'fabian.molano@kikes.com.co' },
  { id: 'p18', nombre: 'Henry sanchez', cargo: 'Auxiliar de granja', correo: 'henrysanchez@gmail.com' },
  { id: 'p19', nombre: 'Hernando astorga', cargo: 'Auxiliar', correo: 'herasto71@hotmail.com' },
  { id: 'p20', nombre: 'Hugo corzo', cargo: 'Surp mtto', correo: 'hugo.corzo@kikes.com.co' },
  { id: 'p21', nombre: 'Hugo Javier viveros mina', cargo: 'Técnico de mtto', correo: 'mtto.px2.tecnico@kikes.com.co' },
  { id: 'p22', nombre: 'Isaias villamizar', cargo: 'Técnico c', correo: 'mtto.granjaspiso.tecnico@kikez.com.co' },
  { id: 'p23', nombre: 'Jaime mosquera', cargo: 'Jefe veterinario', correo: 'jaime.mosquera@kikes.com.co' },
  { id: 'p24', nombre: 'Jairo Andrés Useda', cargo: 'Coordinador de Mantenimiento Industrial', correo: 'jairo.useda@kikes.com.co' },
  { id: 'p25', nombre: 'Jairo Rodríguez', cargo: 'Líder Overhaul', correo: 'jairo.rodriguez@kikes.com.co' },
  { id: 'p26', nombre: 'Jasson Ardila', cargo: 'Jefe tecnico granja', correo: 'jasson.ardila@kikes.com.co' },
  { id: 'p27', nombre: 'Jeferson Mina Saldaña', cargo: 'Supervisor De Mantenimiento Overhaul', correo: 'jeferson.mina@kikes.com.co' },
  { id: 'p28', nombre: 'Jefferson Sneyder Martinez Diaz', cargo: 'Supervisor de Mantenimiento Overhaul', correo: 'mtto.overhaul.supervisor.santander@kikes.com.co' },
  { id: 'p29', nombre: 'Jhorman Ortiz', cargo: 'Coordinador de mantenimiento bellavista', correo: 'mtto.bellavista.supervisor@kikes.com.co' },
  { id: 'p30', nombre: 'Johan fernando naranjo', cargo: 'TÉCNICO GRADO B', correo: 'fernandonaranjogarcia23@gmail.com' },
  { id: 'p31', nombre: 'John eduard zuñiga diaz', cargo: 'Supervisor de produccion', correo: 'egiptosupervisor1_2@kikes.com' },
  { id: 'p32', nombre: 'Jorge Daniel Mesa', cargo: 'Jefe de Mantenimiento Industrial Cauca', correo: 'daniel.mesa@kikes.com.co', mostrarOpcionCorreo: true },
  { id: 'p33', nombre: 'Jose Manuel Ramirez', cargo: 'Supervisor de producción', correo: 'sandra.pedraza@kikes.com.co' },
  { id: 'p34', nombre: 'José Luis Pérez', cargo: 'Jefe Operaciones', correo: 'jose.perez@kikes.com.co' },
  { id: 'p35', nombre: 'Juan Carlos Martines Alvarez', cargo: 'Jefe técnico Granjas', correo: 'carlos.martinez@kikes.com.co' },
  { id: 'p36', nombre: 'Julian caicedo', cargo: 'Jefe tecnico', correo: 'julian.caicedo@kikes.com.co' },
  { id: 'p37', nombre: 'Luis Carlos Cajiao', cargo: 'Supervisor de mtt px-3 y palmas', correo: 'luis.cajiao@kikes.com.co' },
  { id: 'p38', nombre: 'Luis Fernando Mera', cargo: 'Tecnico overhaul', correo: 'mtto.px2.tecnico@kikes.com.co' },
  { id: 'p39', nombre: 'Luis Francisco gualteros', cargo: 'Técnico grado b', correo: 'lfgualtetos@misena.edu.co' },
  { id: 'p40', nombre: 'Luis Humberto Velasco Quiroga', cargo: 'Auxiliar de granja', correo: 'luishumbertovelascoquiroga@hotmail.com' },
  { id: 'p41', nombre: 'Maira Alejandra Chia Lopez', cargo: 'Analista industrial', correo: 'maira.chia@kikes.com.co' },
  { id: 'p42', nombre: 'Martha Sonia Sanchez Carballo', cargo: 'Jefe Tecnica Granjas Piso', correo: 'martha.sanchez@kikes.com.co' },
  { id: 'p43', nombre: 'Mauricio Garces Mendoza', cargo: 'Jefe técnico de granja', correo: 'mauricio.garces@kikes.com.co' },
  { id: 'p44', nombre: 'Michael torres', cargo: 'Sup mtto ind', correo: 'michael.torres@kikes.com.co' },
  { id: 'p45', nombre: 'Ricardo Dulcey Rodriguez', cargo: 'Técnico Grado A', correo: 'richardul16@hotmail.com' },
  { id: 'p46', nombre: 'Sandra Patricia Benavides', cargo: 'Coordinadora Auditoria', correo: 'sandra.benavides@kikes.com.co' },
  { id: 'p47', nombre: 'Sandra Pedraza', cargo: 'Supervisora de Producción', correo: 'sandra.pedraza@kikes.com.co' },
  { id: 'p48', nombre: 'Sara Victoria Guevara', cargo: 'Jefe Técnico Producción 1', correo: 'victoria.guevara@kikes.com.co' },
  { id: 'p49', nombre: 'Saul quintero alvarez', cargo: 'Auxiliar de granja', correo: 'saulquinteroalvarez94@gmail.com' },
  { id: 'p50', nombre: 'Victor nascon', cargo: 'Sup produc', correo: 'palmas.practicante.produccion@kikes.com.co' },
  { id: 'p51', nombre: 'Wilson Giraldo', cargo: 'Director postura Jaula', correo: 'wilson.giraldo@kikes.com.co' }
];

export const STANDARD_EMAIL_BOT_RECIPIENTS = [
  { nombre: 'Daniel Martínez', correo: 'daniel.martinez@kikes.com.co', cargo: 'Calidad / Supervisión' },
  { nombre: 'José Luis Pérez', correo: 'jose.perez@kikes.com.co', cargo: 'Jefe Operaciones' },
  { nombre: 'Jairo Rodríguez', correo: 'jairo.rodriguez@kikes.com.co', cargo: 'Líder Overhaul' }
];

export function getPruebaConCargaTemplate(): EvaluationSection[] {
  return [
    {
      id: 'revision_confiabilidad',
      title: 'REVISION DE CONFIABILIDAD - PRUEBA CON CARGA',
      items: [
        {
          id: 'c1',
          category: 'A',
          question: 'SUMINISTRO DE AGUA',
          criteria: 'El sistema de suministro de agua ha presentado fallas repetitivas reportadas en MP desde el encasetamiento del galpon que hayan afectado el consumo de agua programado para las aves.',
          failuresCount: 0,
          status: 'cumple',
          observation: ''
        },
        {
          id: 'c2',
          category: 'A',
          question: 'SUMINISTRO DE ALIMENTO',
          criteria: 'El sistema de alimento ha presentado fallas repetitivas reportadas en MP desde el encasetamiento del galpon que hayan afectado el consumo de alimento programado para las aves.',
          failuresCount: 0,
          status: 'cumple',
          observation: ''
        },
        {
          id: 'c3',
          category: 'A',
          question: 'ALUMBRADO',
          criteria: 'El sistema de iluminacion ha presentado fallas repetitivas reportadas en MP desde el encasetamiento del galpon que hayan afectado el bienestar de las aves.',
          failuresCount: 0,
          status: 'cumple',
          observation: ''
        },
        {
          id: 'c4',
          category: 'A',
          question: 'MANTENIMIENTO ELECTRICO DE CAJAS DE CONTROL Y POTENCIA',
          criteria: 'El sistema de control y potencia ha presentado fallas repetitivas reportadas en MP desde el encasetamiento del galpon que hayan afectado el bienestar de las aves.',
          failuresCount: 0,
          status: 'cumple',
          observation: ''
        },
        {
          id: 'c5',
          category: 'A',
          question: 'AMBIENTE CONTROLADO',
          criteria: 'El sistema ambiente controlado ha presentado fallas repetitivas reportadas en MP desde el encasetamiento del galpon que hayan afectado el bienestar de las aves.',
          failuresCount: 0,
          status: 'cumple',
          observation: ''
        },
        {
          id: 'c6',
          category: 'B',
          question: 'SILOS',
          criteria: 'El sistema de silos ha presentado fallas repetitivas reportadas en MP desde el encasetamiento del galpon que hayan afectado el consumo de alimento programado para las aves.',
          failuresCount: 0,
          status: 'cumple',
          observation: ''
        },
        {
          id: 'c7',
          category: 'C',
          question: 'RECOGIDA DE HUEVO',
          criteria: 'El sistema recogida de huevo ha presentado fallas repetitivas reportadas en MP desde el encasetamiento del galpon que hayan afectado la recoleccion de huevo',
          failuresCount: 0,
          status: 'cumple',
          observation: ''
        }
      ]
    }
  ];
}

export function getSectionTemplateForZone(zone: string): EvaluationSection[] {
  const normZone = (zone || '').toUpperCase().replace(/_/g, ' ').trim();

  if (typeof window !== 'undefined') {
    let storageKey = '';
    if (normZone.includes('ZUCAMI')) storageKey = 'OVERHAUL_CUSTOM_SECTIONS_ZUCAMI';
    else if (normZone.includes('SALMET')) storageKey = 'OVERHAUL_CUSTOM_SECTIONS_SALMET';
    else if (normZone.includes('PISO')) storageKey = 'OVERHAUL_CUSTOM_SECTIONS_GRANJAS_PISO';
    else if (normZone.includes('ROBLE')) storageKey = 'OVERHAUL_CUSTOM_SECTIONS_EL_ROBLE';
    else storageKey = `OVERHAUL_CUSTOM_SECTIONS_${normZone.replace(/\s+/g, '_')}`;

    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          console.error(`Error parsing saved sections for ${zone}`, e);
        }
      }
    }
  }

  if (normZone.includes('SALMET')) {
    return getSalmetTemplate();
  }
  if (normZone.includes('PISO')) {
    return getGranjasPisoTemplate();
  }
  if (normZone.includes('ROBLE')) {
    return getElRobleTemplate();
  }

  return getZucamiTemplate();
}

function getZucamiTemplate(): EvaluationSection[] {
  return [
    {
      id: 'silos',
      title: 'SILOS',
      items: [
        {
          id: 'z1',
          question: '1. Pintura General de la estructura del silo bascula.',
          criteria: 'Pintura general en estructura del silo báscula',
          status: 'cumple'
        },
        {
          id: 'z2',
          question: '2. Reparación de botas de silos y cajetínes.',
          criteria: 'Ajuste y reparación de botas de descarga y cajetines',
          status: 'cumple'
        },
        {
          id: 'z3',
          question: '3. Cambio de tubo pvc de 3” y accesorios a sinfín de cargue de alimento.',
          criteria: 'Reemplazo de tubería PVC 3" y accesorios de sinfín',
          status: 'cumple'
        },
        {
          id: 'z4',
          question: '4. Reparación de filtraciones a silos de almacenamiento de alimento.',
          criteria: 'Sellado e impermeabilización contra humedad en silos',
          status: 'cumple'
        },
        {
          id: 'z5',
          question: '5. Comprobar datos spam en display haciendo prueba de señales con peso muerto en la base de silos',
          criteria: 'Verificación de display con prueba de peso muerto patrón',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'recogida_huevo',
      title: 'RECOGIDA DE HUEVO',
      items: [
        {
          id: 'z6',
          question: '6. Recorte y reparación cintas transportadoras de huevo.',
          criteria: 'Alineación y corte limpio sin deshilachado',
          status: 'cumple'
        },
        {
          id: 'z7',
          question: '7. Desmontaje, mantenimiento mecánico, ensamble y puesta en marcha de mecanizado delantero de recogida de huevo.',
          criteria: 'Mantenimiento preventivo/correctivo a mecanizado delantero',
          status: 'cumple'
        },
        {
          id: 'z8',
          question: '8. Cambio de chapas, alineacion y nivelacion de ascensor de transversal.',
          criteria: 'Nivelación precisa y chapas nuevas en ascensor',
          status: 'cumple'
        },
        {
          id: 'z9',
          question: '9. Alineación, nivelación, reparación de cortinas de ascensor de transversal. Ajuste a los tornillos de la base de la transversal.',
          criteria: 'Ajuste de tornillería y reparación de cortinas de ascensor',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'suministro_alimento',
      title: 'SUMINISTRO DE ALIMENTO',
      items: [
        {
          id: 'z10',
          question: '10. Pintura General de los carros repartidores de alimento.',
          criteria: 'Pintura anticorrosiva en carros repartidores',
          status: 'cumple'
        },
        {
          id: 'z11',
          question: '11. Mantenimiento de patines y dosificadores de carro repartidor de alimento (Se entregan completos).',
          criteria: 'Entrega e instalación completa de patines y dosificadores',
          status: 'cumple'
        },
        {
          id: 'z12',
          question: '12. Mantenimiento mecánico y eléctrico a carros repartidores de alimento.',
          criteria: 'Revisión motriz y componentes eléctricos de carros',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'suministro_agua',
      title: 'SUMINISTRO DE AGUA',
      items: [
        {
          id: 'z13',
          question: '13. Reparación del sistema hidráulico del galpón ( visor nivel, Mangueras salida depósito, llaves de paso, flotadores del tanque de 7 litros, tanques elevados).',
          criteria: 'Verificación de visores, flotadores, mangueras y llaves sin fugas',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'alumbrado',
      title: 'ALUMBRADO',
      items: [
        {
          id: 'z14',
          question: '14. Reparación de sockets, luces alineadas y encendidas.',
          criteria: 'Iluminación alineada, sockets reparados, 100% encendido',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'antipicaje',
      title: 'ANTIPICAJE',
      items: [
        {
          id: 'z15',
          question: '15. Mantenimiento y funcionamiento de sistema de antipicaje.',
          criteria: 'Operatividad comprobable de antipicaje',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'jaula',
      title: 'JAULA',
      items: [
        {
          id: 'z16',
          question: '16. Reparación de soportes de comedero partidos.',
          criteria: 'Soportes soldados/reemplazados rígidamente',
          status: 'cumple'
        },
        {
          id: 'z17',
          question: '17. Cambio de canales de comedero deteriorados e instalación de tapas a canales finales.',
          criteria: 'Canales continuos y tapas finales instaladas',
          status: 'cumple'
        },
        {
          id: 'z18',
          question: '18. Reparación de vías de carro deterioradas.',
          criteria: 'Guías de carro rectas sin desviaciones ni baches',
          status: 'cumple'
        },
        {
          id: 'z19',
          question: '19. Tensar mallas de techo de todas las baterías en frente y culata.',
          criteria: 'Tensión firme en mallas de techo en frente y culata',
          status: 'cumple'
        },
        {
          id: 'z20',
          question: '20. Cambio de puertas de jaula zucami ( se entregan completas).',
          criteria: 'Puertas completas Zucami con cierre hermético',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'recogida_gallinaza',
      title: 'RECOGIDA DE GALLINAZA',
      items: [
        {
          id: 'z21',
          question: '21. Recorte y reparación de pegues a cintas deyección.',
          criteria: 'Pegues vulcanizados/unidos sin enganches',
          status: 'cumple'
        },
        {
          id: 'z22',
          question: '22. Cambio total de cinta deyección autorizadas segun diagnostico.',
          criteria: 'Cintas nuevas instaladas según diagnóstico aprobado',
          status: 'cumple'
        },
        {
          id: 'z23',
          question: '23. Raspadores de cintas de gallinaza ( se entregan completos).',
          criteria: 'Raspadores instalados y limpios',
          status: 'cumple'
        },
        {
          id: 'z24',
          question: '24. Mantenimiento mecánico y eléctrico a mecanizado trasero de recogida de gallinaza.',
          criteria: 'Mecanizado trasero alineado y con motores funcionales',
          status: 'cumple'
        },
        {
          id: 'z25',
          question: '25. Desmontaje, desarme, pintura, mantenimiento y ensamble de banda transportadora de gallinaza.',
          criteria: 'Mantenimiento integral y pintura en banda transportadora',
          status: 'cumple'
        },
        {
          id: 'z26',
          question: '26. Desmontaje, desarme, pintura, mantenimiento y ensamble de banda elevadora de gallinaza.',
          criteria: 'Mantenimiento integral y pintura en banda elevadora',
          status: 'cumple'
        },
        {
          id: 'z27',
          question: '27. Desmontaje, desarme, lubricación, ensamble y montaje de rodillos retorno de cintas de gallinaza.',
          criteria: 'Rodillos lubricados y girando suavemente',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'otros',
      title: 'OTROS',
      items: [
        {
          id: 'z28',
          question: '28. Mantenimiento general (Pintura de estructuras, puertas y portones)',
          criteria: 'Pintura general en estructuras y accesos',
          status: 'cumple'
        },
        {
          id: 'z29',
          question: '29. Cambio de láminas de zinc deterioradas de techo del galpón y amarres reventados (Si aplica)',
          criteria: 'Techo sin filtraciones con amarres firmes',
          status: 'cumple'
        },
        {
          id: 'z30',
          question: '30. Reparación de guayas, grilletes, perros metalicos, del sistema de cortinas debe estar completo, malacates de cortinas deben estar funcionales.',
          criteria: 'Malacates y guayas de cortina 100% funcionales',
          status: 'cumple'
        },
        {
          id: 'z31',
          question: '31. Alineación y funcionamiento de ventiladores de techo',
          criteria: 'Ventiladores de techo balanceados y operando',
          status: 'cumple'
        }
      ]
    },
    {
      id: 'cajas_control',
      title: 'MANTENIMIENTO ELECTRICO DE CAJAS DE CONTROL Y POTENCIA',
      items: [
        {
          id: 'z32',
          question: '32. Orden, limpieza, y ajustes de contactos en tableros electricos de control y potencia del galpón.',
          criteria: 'Tableros limpios, ordenados y contactos reajustados',
          status: 'cumple'
        }
      ]
    }
  ];
}

function getSalmetTemplate(): EvaluationSection[] {
  return [
    {
      id: 'silos',
      title: 'SILOS',
      items: [
        { id: 's1', question: '1. Reparación de botas de silos y cajetínes.', criteria: 'Ajuste, soldadura y sellado en botas y cajetines', status: 'cumple' },
        { id: 's2', question: '2. Cambio de tubos metalicos averiados y accesorios a sinfín de cargue de alimento.', criteria: 'Reemplazo de tubería metálica y accesorios de sinfín', status: 'cumple' },
        { id: 's3', question: '3. Reparación de filtraciones a silos de almacenamiento de alimento.', criteria: 'Impermeabilización de uniones y techos de silos', status: 'cumple' }
      ]
    },
    {
      id: 'recogida_huevo',
      title: 'RECOGIDA DE HUEVO',
      items: [
        { id: 's4', question: '4. Recorte y reparación cintas transportadoras de huevo.', criteria: 'Centradas y alineadas sin desgaste lateral', status: 'cumple' },
        { id: 's5', question: '5. Desmontaje, mantenimiento mecánico, ensamble y puesta en marcha de mecanizado delantero de recogida de huevo.', criteria: 'Revisión motriz y puesta en marcha del mecanizado', status: 'cumple' },
        { id: 's6', question: '6. Alineación, nivelación, reparación de cortinas de ascensor de transversal.', criteria: 'Nivelación precisa del ascensor y cortinas', status: 'cumple' }
      ]
    },
    {
      id: 'suministro_alimento',
      title: 'SUMINISTRO DE ALIMENTO',
      items: [
        { id: 's7', question: '7. Cambio de canales de comedero deteriorados e instalación de tapas a canales finales.', criteria: 'Canales en óptimas condiciones y tapas puestas', status: 'cumple' },
        { id: 's8', question: '8. Reparación de vías de carro deterioradas.', criteria: 'Rieles y guías alineados sin obstrucciones', status: 'cumple' },
        { id: 's9', question: '9. Mantenimiento mecánico y eléctrico a carros repartidores de alimento.', criteria: 'Motorización y cableado de carros al 100%', status: 'cumple' }
      ]
    },
    {
      id: 'suministro_agua',
      title: 'SUMINISTRO DE AGUA',
      items: [
        { id: 's10', question: '10. Reparación del sistema hidráulico del galpón ( visor nivel, regulador de presión lubing, llaves de paso, flotadores del tanque elevados, tetinas antigoteo, corchos).', criteria: 'Sistema hidráulico regulado, sin goteos ni fugas', status: 'cumple' }
      ]
    },
    {
      id: 'jaula',
      title: 'JAULA',
      items: [
        { id: 's11', question: '11. Tensar cinta de techo de todas las baterías en frente y culata.', criteria: 'Tensión adecuada en cintas de techo', status: 'cumple' },
        { id: 's12', question: '12. Cambio de puertas de jaula salmet ( se entregan completas).', criteria: 'Puertas completas Salmet instaladas', status: 'cumple' },
        { id: 's13', question: '13. Pintura de pata a pata de Jaula Salmet', criteria: 'Acabado anticorrosivo de pata a pata', status: 'cumple' }
      ]
    },
    {
      id: 'recogida_gallinaza',
      title: 'RECOGIDA DE GALLINAZA',
      items: [
        { id: 's14', question: '14. Recorte y reparación de pegues a cintas deyección.', criteria: 'Cintas unidas y tracción uniforme', status: 'cumple' },
        { id: 's15', question: '15. Cambio total de cinta deyección autorizadas segun diagnostico.', criteria: 'Instalación de cintas autorizadas', status: 'cumple' },
        { id: 's16', question: '16. Mantenimiento mecánico y eléctrico a mecanizado trasero de recogida de gallinaza.', criteria: 'Funcionamiento del mecanizado trasero', status: 'cumple' },
        { id: 's17', question: '17. Desmontaje, desarme, pintura, mantenimiento y ensamble de banda transportadora de gallinaza.', criteria: 'Mantenimiento preventivo/correctivo y pintura', status: 'cumple' },
        { id: 's18', question: '18. Desmontaje, desarme, pintura, mantenimiento y ensamble de banda elevadora de gallinaza.', criteria: 'Banda elevadora totalmente funcional y pintada', status: 'cumple' },
        { id: 's19', question: '19. Desmontaje, ensamble y montaje de rodillos retorno de cinta deyección', criteria: 'Rodillos de retorno alineados con rodamientos OK', status: 'cumple' }
      ]
    },
    {
      id: 'otros',
      title: 'OTROS',
      items: [
        { id: 's20', question: '20. Mantenimiento estructural y pintura de estructuras, puertas y portones', criteria: 'Estructuras pintadas y portones funcionales', status: 'cumple' },
        { id: 's21', question: '21. Revisión de lámparas de alumbrado publico ubicadas al frente y en la culata del galpón', criteria: 'Lámparas de alumbrado exterior encendidas', status: 'cumple' }
      ]
    },
    {
      id: 'cajas_control',
      title: 'MANTENIMIENTO ELECTRICO DE CAJAS DE CONTROL Y POTENCIA',
      items: [
        { id: 's22', question: '22. Orden, limpieza, y ajustes de contactos en tableros electricos de control y potencia del galpón.', criteria: 'Tableros limpios, ordenados y sin puntos calientes', status: 'cumple' }
      ]
    },
    {
      id: 'ambiente_controlado',
      title: 'AMBIENTE CONTROLADO',
      items: [
        { id: 's23', question: '23. Revisión y mantenimiento de bombas de los paneles humedos', criteria: 'Electrobombas con caudal continuo y sin fugas', status: 'cumple' },
        { id: 's24', question: '24. Mantenimiento mecánico y eléctrico a extractores.', criteria: 'Extractores balanceados y correas ajustadas', status: 'cumple' },
        { id: 's25', question: '25. Cambio de paneles humedos deteriorados.', criteria: 'Paneles húmedos limpios/reemplazados', status: 'cumple' },
        { id: 's26', question: '26. Revisión del ambiente controlado (sensores de temperatura, humedad y termostato)', criteria: 'Sensores e higrostatos/termostatos calibrados', status: 'cumple' }
      ]
    }
  ];
}

function getGranjasPisoTemplate(): EvaluationSection[] {
  return [
    {
      id: 'silos',
      title: 'SILOS',
      items: [
        { id: 'gp1', question: '1. Mantenimiento general de los silos', criteria: 'Estructura, impermeabilización y tapas en buen estado', status: 'cumple' },
        { id: 'gp2', question: '2. Mantenimiento general del sistema de pesaje de alimento', criteria: 'Celdas de carga y display de pesaje verificados', status: 'cumple' },
        { id: 'gp3', question: '3. Mantenimiento general de sinfines y tuberia', criteria: 'Sinfines operativos y tubería sin fisuras', status: 'cumple' }
      ]
    },
    {
      id: 'recogida_huevo',
      title: 'RECOGIDA DE HUEVO',
      items: [
        { id: 'gp4', question: '4. Mantenimiento general de los carros transportadores de huevo.', criteria: 'Carros alineados y desplazamiento fluido', status: 'cumple' },
        { id: 'gp5', question: '5. Mantenimiento a sistema de desinfeccion de Huevo', criteria: 'Boquillas y solución desinfectante operativas', status: 'cumple' },
        { id: 'gp6', question: '6. Mantenimiento de Nidos y Soportes', criteria: 'Nidos limpios, tapetes OK y soportes firmes', status: 'cumple' },
        { id: 'gp7', question: '7. Mantenimiento a Nido automatico de ambiente controlado', criteria: 'Mecanismo de expulsión y cierre automático probados', status: 'cumple' },
        { id: 'gp8', question: '8. Mantenimiento a banda de recolección de huevo, ambiente controlado', criteria: 'Banda tensionada, limpia y sin rozamientos', status: 'cumple' },
        { id: 'gp9', question: '9. Mantenimiento a piso de plataforma plastica, ambiente controlado', criteria: 'Pisos plásticos encajados y sin roturas', status: 'cumple' }
      ]
    },
    {
      id: 'suministro_alimento',
      title: 'SUMINISTRO DE ALIMENTO',
      items: [
        { id: 'gp10', question: '10. Mantenimiento general de canales y esquineros.', criteria: 'Canales rectos y esquineros lubricados', status: 'cumple' },
        { id: 'gp11', question: '11. Mantenimiento general de las tolvas comedero y Tolvas auxiliares', criteria: 'Dosificación homogénea y tolvas limpias', status: 'cumple' }
      ]
    },
    {
      id: 'suministro_agua',
      title: 'SUMINISTRO DE AGUA',
      items: [
        { id: 'gp12', question: '12. Mantenimiento a sistema de bebedero automatico', criteria: 'Reguladores de presión y nippers/copas sin fugas', status: 'cumple' },
        { id: 'gp13', question: '13. Mantenimiento a Sistema Hidraulico', criteria: 'Filtros, medidores y tuberías operativas', status: 'cumple' }
      ]
    },
    {
      id: 'alumbrado',
      title: 'ALUMBRADO',
      items: [
        { id: 'gp14', question: '14. Mantenimiento general del alumbrado interno del galpon', criteria: 'Luminarias herméticas y cableado seguro', status: 'cumple' }
      ]
    },
    {
      id: 'otros',
      title: 'OTROS',
      items: [
        { id: 'gp15', question: '15. Mantenimiento general de la cerca eléctrica.', criteria: 'Voltaje correcto en cerca de protección', status: 'cumple' },
        { id: 'gp16', question: '16. Mantenimiento general del alumbrado publico', criteria: 'Lámparas exteriores y reflectores encendidos', status: 'cumple' },
        { id: 'gp17', question: '17. Mantenimiento general de cortinas, malacates y control de caida', criteria: 'Malacates suaves y guayas de cortina firmes', status: 'cumple' },
        { id: 'gp18', question: '18. Mantenimiento general de la estructura y techos', criteria: 'Estructura rígida y techos sin goteos', status: 'cumple' },
        { id: 'gp19', question: '19. Mantenimiento a caja de desinfeccion Ultra Violeta', criteria: 'Lámparas UV funcionales y timer probado', status: 'cumple' },
        { id: 'gp20', question: '20. Mantenimiento general arco de fumigacion, electrobomba y componentes', criteria: 'Electrobomba con presión adecuada y boquillas limpias', status: 'cumple' },
        { id: 'gp21', question: '21. Mantenimiento General a caseta de Compostaje', criteria: 'Caseta ordenada, techo e instalaciones OK', status: 'cumple' }
      ]
    },
    {
      id: 'cajas_control',
      title: 'MANTENIMIENTO ELECTRICO DE CAJAS DE CONTROL Y POTENCIA',
      items: [
        { id: 'gp23', question: '23. Mantenimiento general de los gabinetes eléctricos (Caja de control Alumbrado, Caja de Control y potencia Motores, Caja Sistema Pesaje, Caja Tacos)', criteria: 'Gabinetes limpios, rotulados y contactos ajustados', status: 'cumple' }
      ]
    },
    {
      id: 'ambiente_controlado',
      title: 'AMBIENTE CONTROLADO',
      items: [
        { id: 'gp24', question: '24. Mantenimiento a sistema de control de temperatura y humedad del ambiente controlado', criteria: 'Controlador de clima e higrostatos calibrados', status: 'cumple' },
        { id: 'gp22', question: '22. Mantenimiento a ventiladores de sistema de ambiente controlado', criteria: 'Ventiladores balanceados y persianas de apertura libre', status: 'cumple' },
        { id: 'gp25', question: '25. Mantenimiento a paneles humedos de ambiente controlado', criteria: 'Riego homogéneo en paneles húmedos', status: 'cumple' }
      ]
    }
  ];
}

function getElRobleTemplate(): EvaluationSection[] {
  return [
    {
      id: 'silos',
      title: 'SILOS',
      items: [
        { id: 'er1', question: '1. Mantenimiento general de los silos', criteria: 'Estado físico del silo, botas y escalera en norma', status: 'cumple' },
        { id: 'er2', question: '2. Mantenimiento general del sistema de pesaje de alimento', criteria: 'Calibración de celdas de pesaje y tarjeta indicadora', status: 'cumple' },
        { id: 'er3', question: '3. Mantenimiento general de sinfines y tuberia', criteria: 'Sinfín de alimentación continuo y tubos sin abrasión', status: 'cumple' }
      ]
    },
    {
      id: 'recogida_huevo',
      title: 'RECOGIDA DE HUEVO',
      items: [
        { id: 'er4', question: '4. Mantenimiento general de los carros transportadores de huevo.', criteria: 'Carros recolectores sin baches ni rozamientos', status: 'cumple' },
        { id: 'er5', question: '5. Mantenimiento a sistema de desinfeccion de Huevo', criteria: 'Boquillas y aspersores operativos', status: 'cumple' },
        { id: 'er6', question: '6. Mantenimiento de Nidos y Soportes', criteria: 'Estructura de nidos firme y limpia', status: 'cumple' },
        { id: 'er7', question: '7. Mantenimiento a Nido automatico de ambiente controlado', criteria: 'Automatismo de nidos con apertura/cierre probados', status: 'cumple' },
        { id: 'er8', question: '8. Mantenimiento a banda de recolección de huevo, ambiente controlado', criteria: 'Banda limpia, centrada y sin deshilachar', status: 'cumple' },
        { id: 'er9', question: '9. Mantenimiento a piso de plataforma plastica, ambiente controlado', criteria: 'Plataforma plástica completa y nivelada', status: 'cumple' }
      ]
    },
    {
      id: 'suministro_alimento',
      title: 'SUMINISTRO DE ALIMENTO',
      items: [
        { id: 'er10', question: '10. Mantenimiento general de canales y esquineros.', criteria: 'Canales alineados y esquineros sin desgaste', status: 'cumple' },
        { id: 'er11', question: '11. Mantenimiento general de las tolvas comedero y Tolvas auxiliares', criteria: 'Tolvas de distribución limpias y ajustadas', status: 'cumple' }
      ]
    },
    {
      id: 'suministro_agua',
      title: 'SUMINISTRO DE AGUA',
      items: [
        { id: 'er12', question: '12. Mantenimiento a sistema de bebedero automatico', criteria: 'Bebederos automáticos con flujo continuo', status: 'cumple' },
        { id: 'er13', question: '13. Mantenimiento a Sistema Hidraulico', criteria: 'Depósitos de agua, mangueras y llaves sin fugas', status: 'cumple' },
        { id: 'er14', question: '14. Mantenimiento tuberia de agua y tetinas', criteria: 'Tetinas 360° funcionales y tubería desinfectada', status: 'cumple' }
      ]
    },
    {
      id: 'alumbrado',
      title: 'ALUMBRADO',
      items: [
        { id: 'er16', question: '16. Mantenimiento general del alumbrado interno del galpon', criteria: 'Luminarias internas encendidas y protegidas', status: 'cumple' }
      ]
    },
    {
      id: 'otros',
      title: 'OTROS',
      items: [
        { id: 'er17', question: '17. Mantenimiento general de la cerca eléctrica.', criteria: 'Impulsador y cerca eléctrica probados', status: 'cumple' },
        { id: 'er18', question: '18. Mantenimiento general del alumbrado publico', criteria: 'Alumbrado perimetral operativo', status: 'cumple' },
        { id: 'er19', question: '19. Mantenimiento general de cortinas, malacates y control de caida', criteria: 'Malacates y guayas de cortina con seguro', status: 'cumple' },
        { id: 'er20', question: '20. Mantenimiento general de la estructura y techos', criteria: 'Estructura metálica/madera y techos herméticos', status: 'cumple' },
        { id: 'er21', question: '21. Mantenimiento a caja de desinfeccion Ultra Violeta', criteria: 'Caja UV limpia y funcionando', status: 'cumple' },
        { id: 'er22', question: '22. Mantenimiento general arco de fumigacion, electrobomba y componentes', criteria: 'Arco de fumigación vehicular operativo', status: 'cumple' },
        { id: 'er23', question: '23. Mantenimiento General a caseta de Compostaje', criteria: 'Mantenimiento a zona de compostaje', status: 'cumple' }
      ]
    },
    {
      id: 'cajas_control',
      title: 'MANTENIMIENTO ELECTRICO DE CAJAS DE CONTROL Y POTENCIA',
      items: [
        { id: 'er24', question: '24. Mantenimiento general de los gabinetes eléctricos (Caja de control Alumbrado, Caja de Control y potencia Motores, Caja Sistema Pesaje, Caja Tacos)', criteria: 'Limpieza, apriete y rotulación de tableros', status: 'cumple' }
      ]
    }
  ];
}

export const INITIAL_REPORTS: EvaluationReport[] = [
  {
    id: 'rep-001',
    code: 'ACTA-2026-0801',
    reportType: 'ENTREGAS_VACIO',
    zone: 'ZUCAMI',
    farm: 'EGIPTO',
    cageType: 'A',
    galpon: 'Galpón 12',
    evaluationDate: '2026-08-01',
    evaluadorId: 'p1',
    evaluadorNombre: 'Ademar Uribe',
    supervisorId: 'p4',
    supervisorNombre: 'Andres Felipe Puerto Ortega',
    sections: getSectionTemplateForZone('ZUCAMI'),
    totalScore: 95.8,
    totalItems: 24,
    passedItems: 23,
    failedItems: 1,
    naItems: 0,
    fechaInicioMantenimiento: '2026-07-08',
    diasMantenimientoProgramados: 24,
    fechaInicioMasDiasProgramados: '2026-08-01',
    fechaFinalizacion: '2026-08-01',
    fechaFinalizacion100: '2026-08-01',
    fechaEntregaVacioProduccion: '2026-08-01',
    diasVacioSanitario: 8,
    cumplimientoEnFecha: 0.0,
    signatures: [
      {
        role: 'Evaluador / Auxiliar',
        personaId: 'p1',
        nombre: 'Ademar Uribe',
        cargo: 'Auxiliar de granja',
        correo: 'aldemaruribe1804@gmail.com',
        signedAt: '2026-08-01 14:30'
      },
      {
        role: 'Coordinador Mantenimiento',
        personaId: 'p4',
        nombre: 'Andres Felipe Puerto Ortega',
        cargo: 'Coordinador de mtto',
        correo: 'coordinador.mtto@kikes.com.co',
        signedAt: '2026-08-01 15:10'
      }
    ],
    emailSentTo: ['daniel.martinez@kikes.com.co', 'jose.perez@kikes.com.co', 'jairo.rodriguez@kikes.com.co', 'aldemaruribe1804@gmail.com'],
    pdfGenerated: true,
    createdAt: '2026-08-01T15:10:00.000Z',
    notes: 'Entrega en vacío satisfactoria. Se requiere reajustar persiana del extractor #3 antes del emparvado.'
  },
  {
    id: 'rep-002',
    code: 'ACTA-2026-0805',
    reportType: 'ENTREGAS_VACIO',
    zone: 'SALMET',
    farm: 'BELLAVISTA',
    cageType: 'D',
    galpon: 'Galpón 04',
    evaluationDate: '2026-08-05',
    evaluadorId: 'p3',
    evaluadorNombre: 'Alex Fernel Jaimes Tarazona',
    supervisorId: 'p2',
    supervisorNombre: 'Alex Fernel',
    sections: getSectionTemplateForZone('SALMET'),
    totalScore: 88.5,
    totalItems: 24,
    passedItems: 21,
    failedItems: 3,
    naItems: 0,
    fechaInicioMantenimiento: '2026-07-12',
    diasMantenimientoProgramados: 24,
    fechaInicioMasDiasProgramados: '2026-08-05',
    fechaFinalizacion: '2026-08-05',
    fechaFinalizacion100: '2026-08-05',
    fechaEntregaVacioProduccion: '2026-08-05',
    diasVacioSanitario: 8,
    cumplimientoEnFecha: 0.0,
    signatures: [
      {
        role: 'Líder Overhaul',
        personaId: 'p3',
        nombre: 'Alex Fernel Jaimes Tarazona',
        cargo: 'Coordinador mtto industrial Overhaul',
        correo: 'mtto.overhaul.santander@kikes.com.co',
        signedAt: '2026-08-05 11:00'
      }
    ],
    emailSentTo: ['daniel.martinez@kikes.com.co', 'jose.perez@kikes.com.co', 'jairo.rodriguez@kikes.com.co'],
    pdfGenerated: true,
    createdAt: '2026-08-05T11:00:00.000Z',
    notes: 'Alineación de cinta de huevo en piso 2 requiere calibración de motor reductor.'
  },
  {
    id: 'rep-palmas-01',
    code: 'ACTA-2026-0820-P1',
    reportType: 'ENTREGAS_VACIO',
    zone: 'ZUCAMI',
    farm: 'PALMAS',
    cageType: 'A',
    galpon: '1',
    evaluationDate: '2026-08-20',
    fechaInicioMantenimiento: '2026-08-29', // D2: FECHA DE INICIO
    fechaFinalizacion100: '2026-09-22', // E2: Fecha finalización al 100% (24 días)
    fechaInicioMasDiasProgramados: '2026-09-21', // F2: Fecha inicio + Días programados (23 días)
    diasMantenimientoProgramados: 23,
    fechaPruebaConCarga: '2026-11-07', // G2: Fecha de prueba con carga
    fechaEntregaVacioProduccion: '2026-08-20',
    evaluadorId: 'p1',
    evaluadorNombre: 'Ademar Uribe',
    supervisorId: 'p4',
    supervisorNombre: 'Andres Felipe Puerto Ortega',
    sections: getSectionTemplateForZone('ZUCAMI'),
    totalScore: 100.0,
    totalItems: 24,
    passedItems: 24,
    failedItems: 0,
    naItems: 0,
    diasVacioSanitario: 8,
    cumplimientoEnFecha: 4.35, // ((24 / 23) - 1) = +4.35%
    signatures: [],
    pdfGenerated: true,
    createdAt: '2026-08-20T16:00:00.000Z',
    notes: 'Entrega en vacío 100% conforme. Palmas Galpón 1.'
  },
  {
    id: 'rep-palmas-02',
    code: 'ACTA-2026-0822-P2',
    reportType: 'ENTREGAS_VACIO',
    zone: 'ZUCAMI',
    farm: 'PALMAS',
    cageType: 'A',
    galpon: '2',
    evaluationDate: '2026-08-22',
    fechaInicioMantenimiento: '2026-08-01',
    fechaFinalizacion100: '2026-08-24', // 23 días
    fechaInicioMasDiasProgramados: '2026-08-24', // 23 días
    diasMantenimientoProgramados: 23,
    fechaEntregaVacioProduccion: '2026-08-22',
    evaluadorId: 'p1',
    evaluadorNombre: 'Ademar Uribe',
    supervisorId: 'p4',
    supervisorNombre: 'Andres Felipe Puerto Ortega',
    sections: getSectionTemplateForZone('ZUCAMI'),
    totalScore: 100.0,
    totalItems: 24,
    passedItems: 24,
    failedItems: 0,
    naItems: 0,
    diasVacioSanitario: 8,
    cumplimientoEnFecha: 0.00, // ((23 / 23) - 1) = 0.00%
    signatures: [],
    pdfGenerated: true,
    createdAt: '2026-08-22T16:30:00.000Z',
    notes: 'Entrega en vacío 100% conforme. Palmas Galpón 2.'
  }
];
