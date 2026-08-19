import React from 'react';
import {
  Server,
  Camera,
  ScanLine,
  Wifi,
  UserCheck,
  MonitorSmartphone,
  Smartphone,
  Radio,
  ToggleLeft,
  Mail,
  CreditCard,
} from 'lucide-react';

export const DEVICE_CATALOG = {
  controller: {
    id: 'controller',
    name: 'Controlador',
    role: 'controller',
    phase: 1,
    phaseName: 'Fase 1: Centro de Operaciones / Controlador',
    icon: <Server className="h-5 w-5" />,
    tests: [
      'Equipo encendido y con LED de estado normal.',
      'Conexión a red LAN/WiFi activa y estable.',
      'Hora y zona horaria configuradas correctamente.',
      'Periféricos configurados correctamente desde el dashboard.',
      'Servicios Smartki activos después de reinicio controlado.',
    ],
  },
  qr: {
    id: 'qr',
    name: 'Lector QR',
    role: 'peripheral',
    phase: 2,
    phaseName: 'Fase 2: Periféricos y Accesos',
    icon: <ScanLine className="h-5 w-5" />,
    tests: [
      'Verificar que los lectores QR estén encendidos y conectados al controlador.',
      'Probar lectura de QR válido → acceso concedido.',
      'Verificar que, al conceder acceso por QR, abra el relé correspondiente.',
      'Probar intento de acceso con screenshot/captura del QR → acceso denegado.',
      'Probar lectura de QR inválido → acceso denegado.',
      'Probar lectura de QR vencido → acceso denegado.',
      'Caso de borde: lectura de QR válido desde pantalla de celular con brillo bajo o mica reflectante.',
      'Verificar feedback del lector QR: sonido, parpadeo o señal visual según configuración.',
      'Verificar que el evento quede registrado en aplicación y dashboard.',
    ],
  },
  stickertag: {
    id: 'stickertag',
    name: 'StickerTag',
    role: 'peripheral',
    phase: 2,
    phaseName: 'Fase 2: Periféricos y Accesos',
    icon: <Wifi className="h-5 w-5" />,
    tests: [
      'StickerTag conectado, encendido y visible desde el controlador.',
      'Tag detectado correctamente al acercarlo al lector.',
      'Tag válido asociado a usuario → acceso concedido.',
      'Verificar que, al conceder acceso por StickerTag, abra el relé correspondiente.',
      'Tag inválido o no registrado → acceso denegado.',
      'Eliminar tag, volver agregarlo y verificar que el acceso se actualice correctamente.',
      'Tag asignado a otra comunidad → acceso denegado.',
      'Tag de usuario eliminado → acceso denegado.',
      'Verificar que el evento quede registrado en el sistema.',
    ],
  },
  lpr: {
    id: 'lpr',
    name: 'Cámara LPR',
    role: 'peripheral',
    phase: 2,
    phaseName: 'Fase 2: Periféricos y Accesos',
    icon: <Camera className="h-5 w-5" />,
    tests: [
      'Cámara encendida, conectada y enfocada correctamente.',
      'Patente registrada → barrera/puerta abre correctamente.',
      'Verificar que, al conceder acceso por LPR, abra el relé correspondiente.',
      'Patente no registrada → acceso denegado.',
      'Registro del evento con imagen capturada.',
      'Validar lectura en condición de baja iluminación si aplica.',
    ],
  },
  facial: {
    id: 'facial',
    name: 'Cámara Facial',
    role: 'peripheral',
    phase: 2,
    phaseName: 'Fase 2: Periféricos y Accesos',
    icon: <UserCheck className="h-5 w-5" />,
    tests: [
      'Cámara encendida y conectada al controlador.',
      'Rostro registrado → acceso concedido.',
      'Verificar que, al conceder acceso por reconocimiento facial, abra el relé correspondiente.',
      'Rostro no registrado → acceso denegado.',
      'Prueba con iluminación baja.',
      'Prueba con accesorio, como mascarilla o lentes, según política configurada.',
      'Registro del evento en el sistema.',
      'Probar lectura de QR válido mediante el lector QR integrado → acceso concedido.',
      'Probar intento de acceso con screenshot/captura del QR → acceso denegado.',
      'Probar lectura de QR inválido → acceso denegado.',
      'Probar lectura de QR vencido → acceso denegado.',
      'Caso de borde: lectura de QR válido desde pantalla de celular con brillo bajo o mica reflectante.',
      'Verificar feedback del lector QR integrado: sonido, parpadeo o señal visual según configuración.',
    ],
  },
  // No es un periférico agregable a la topología (no aparece en "+ Agregar
  // dispositivo"): es un factor seleccionable solo dentro de Multivalidación,
  // para representar que el lector QR usado como segundo factor es el que ya
  // trae integrado la Cámara Facial, sin requerir un Lector QR físico aparte.
  facialQr: {
    id: 'facialQr',
    name: 'QR integrado (Facial)',
    role: 'multivalidationFactor',
    icon: <ScanLine className="h-5 w-5" />,
  },
  guardDesk: {
    id: 'guardDesk',
    name: 'Smartki Guard - DESK',
    role: 'peripheral',
    phase: 3,
    phaseName: 'Fase 3: Interfaces y Módulos Lógicos',
    icon: <MonitorSmartphone className="h-5 w-5" />,
    tests: [
      'Equipo encendido, pantalla operativa y comunidad correctamente configurada.',
      'Formulario de registro de visita solicita nombre, apellido, tipo de documento y patente (si aplica).',
      'Selección de departamento/destino disponible y correcta según la comunidad.',
      'Al confirmar la visita, se abre el modal con la información de la visita generada.',
      'Opción "Imprimir QR" genera e imprime correctamente el QR de la visita en papel.',
      'Panel de actividad en tiempo real refleja los accesos a medida que ocurren.',
      'Desplegable de puertas lista todas las puertas de la comunidad.',
      'Apertura remota de una puerta seleccionada desde el desplegable funciona correctamente.',
      'Verificar que, al abrir una puerta desde DESK, se active el relé correspondiente.',
      'Registro de visitas y aperturas remotas queda visible en el sistema.',
    ],
  },
  guardPda: {
    id: 'guardPda',
    name: 'Smartki Guard - PDA',
    role: 'peripheral',
    phase: 3,
    phaseName: 'Fase 3: Interfaces y Módulos Lógicos',
    icon: <Smartphone className="h-5 w-5" />,
    tests: [
      'Equipo encendido, pantalla operativa y comunidad correctamente configurada.',
      'Escaneo del carnet mediante el lector del dispositivo reconoce el carnet correctamente.',
      'Tras escanear, se solicita correctamente si la operación es Entrada o Salida.',
      'Destino (departamento) asociado al carnet escaneado se muestra correctamente.',
      'Selección de la puerta específica a abrir funciona correctamente.',
      'Opción "Registro sin apertura" deja el evento registrado sin accionar ninguna puerta.',
      'Verificar que, al abrir una puerta desde PDA, se active el relé correspondiente.',
      'Visita puede ingresar de forma autónoma usando el QR propio del carnet.',
      'Opción de rellenado manual (sin escanear carnet) permite registrar la visita correctamente.',
      'Registro del evento de acceso/visita visible en el sistema.',
    ],
  },
  remoto: {
    id: 'remoto',
    name: 'Control Remoto (App)',
    role: 'optionalModule',
    phase: 3,
    phaseName: 'Fase 3: Interfaces y Módulos Lógicos',
    icon: <Radio className="h-5 w-5" />,
    tests: [
      'Control remoto disponible en la aplicación del residente y/o administrador.',
      'Apertura de puerta/barrera desde control remoto → se ejecuta correctamente.',
      'Verificar que el relé configurado para control remoto se activa al accionarlo.',
      'Múltiples aperturas consecutivas desde la app → funcionan sin errores.',
      'Registro del evento en el sistema tras cada apertura remota.',
    ],
  },
  hardbutton: {
    id: 'hardbutton',
    name: 'Hard Button',
    role: 'peripheral',
    phase: 2,
    phaseName: 'Fase 2: Periféricos y Accesos',
    icon: <ToggleLeft className="h-5 w-5" />,
    tests: [
      'Pulsación del botón → apertura de puerta/barrera.',
      'Verificar que la pulsación active el relé correspondiente.',
      'Registro del evento en el sistema.',
      'Botón de emergencia/salida funciona correctamente.',
    ],
  },
  invitaciones: {
    id: 'invitaciones',
    name: 'App - Invitaciones',
    role: 'optionalModule',
    phase: 3,
    phaseName: 'Fase 3: Interfaces y Módulos Lógicos',
    icon: <Mail className="h-5 w-5" />,
    tests: [
      'Generación de invitación desde app por residente → invitado recibe código/QR de acceso.',
      'Probar tipos de invitación configurados para la comunidad (única, recurrente, por rango horario).',
      'Invitación recurrente: acceso fuera del rango horario → denegado; dentro del rango → concedido.',
      'Revocación de invitación desde la app → acceso bloqueado de inmediato.',
    ],
  },
  qrcarnet: {
    id: 'qrcarnet',
    name: 'Carnet / QR Cédula',
    role: 'optionalModule',
    phase: 3,
    phaseName: 'Fase 3: Interfaces y Módulos Lógicos',
    icon: <CreditCard className="h-5 w-5" />,
    description: 'No agrega una tarjeta propia: habilita las pruebas [Carnet] en los lectores QR y Facial conectados.',
    // Sin pruebas propias a propósito: este módulo solo habilita las
    // pruebas [Carnet] inyectadas en los lectores QR/Facial (ver
    // checklist.js). buildChecklistByPhases no genera tarjeta para un
    // módulo sin pruebas, así que no aparece como una tarjeta vacía.
    tests: [],
  },
};

export const PERIPHERALS = Object.values(DEVICE_CATALOG).filter(
  device => device.role === 'peripheral'
);

export const OPTIONAL_MODULES = Object.values(DEVICE_CATALOG).filter(
  device => device.role === 'optionalModule'
);

// Factores seleccionables para Multivalidación: los periféricos agregables
// normales, más factores "lógicos" como el QR integrado de la Cámara Facial,
// que no son un dispositivo aparte que se agregue a la topología.
export const MULTIVALIDATION_FACTORS = Object.values(DEVICE_CATALOG).filter(
  device => device.role === 'peripheral' || device.role === 'multivalidationFactor'
);

export const INITIAL_COMMUNITIES = [];
