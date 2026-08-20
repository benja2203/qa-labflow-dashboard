import { jsPDF } from 'jspdf';
import { DEVICE_CATALOG } from '../data/deviceCatalog.jsx';
import { TEST_STATUS } from '../constants/testStatus.js';
import { PROCESS_SCOPE, resolveObservationScopeLabel } from '../constants/observationScopes.js';
import { OBSERVATION_STATUS, resolveObservationStatus } from '../constants/observationStatus.js';
import {
  getApprovalSummaryText,
  getFullReportTasks,
  getReportIssues,
  getTechnicalDeviceReport,
  hasChecklistFailuresWithoutComment,
} from './report.js';

const PAGE = {
  width: 210,
  height: 297,
  margin: 14,
};

const COLORS = {
  slate900: [15, 23, 42],
  slate800: [30, 41, 59],
  slate700: [51, 65, 85],
  slate500: [100, 116, 139],
  slate300: [203, 213, 225],
  slate100: [241, 245, 249],
  blue600: [37, 99, 235],
  blue50: [239, 246, 255],
  green600: [22, 163, 74],
  green50: [240, 253, 244],
  red600: [220, 38, 38],
  red50: [254, 242, 242],
  yellow600: [202, 138, 4],
  yellow50: [254, 252, 232],
  purple600: [147, 51, 234],
  purple50: [250, 245, 255],
  orange600: [234, 88, 12],
  orange50: [255, 247, 237],
  indigo600: [79, 70, 229],
  indigo50: [238, 242, 255],
  white: [255, 255, 255],
};

const SEVERITY_RANK = { 'NO APTO': 0, BLOQUEADO: 1, 'EN PROGRESO': 2, APTO: 3 };

const OBSERVATION_STATUS_COLORS = {
  pending: COLORS.yellow600,
  in_review: COLORS.indigo600,
  resolved: COLORS.green600,
};

const STATUS_COLORS = {
  pass: { fill: COLORS.green50, text: COLORS.green600 },
  fail: { fill: COLORS.red50, text: COLORS.red600 },
  blocked: { fill: COLORS.yellow50, text: COLORS.yellow600 },
  pending: { fill: COLORS.slate100, text: COLORS.slate700 },
  na: { fill: COLORS.slate100, text: COLORS.slate500 },
};

function cleanText(value) {
  return String(value ?? '')
    .replace(/→/g, '->')
    .replace(/[–—]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function preserveLineBreaks(value) {
  return String(value ?? '')
    .replace(/→/g, '->')
    .replace(/[–—]/g, '-')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

function sanitizeFileName(value) {
  return (value || 'comunidad')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'comunidad';
}

function formatDateTime(value) {
  if (!value) return 'Sin actualización';

  try {
    return new Date(value).toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return cleanText(value);
  }
}

function getStatusLabel(status) {
  return TEST_STATUS[status]?.shortLabel || TEST_STATUS.pending.shortLabel;
}

function setTextColor(doc, color) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFillColor(doc, color) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(doc, color) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function createPdfWriter(doc) {
  let y = PAGE.margin;
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const bottomLimit = PAGE.height - PAGE.margin;

  function addPageHeader() {
    setTextColor(doc, COLORS.slate500);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('QA LabFlow - Reporte de Validación', PAGE.margin, 9);
    setDrawColor(doc, COLORS.slate300);
    doc.line(PAGE.margin, 11, PAGE.width - PAGE.margin, 11);
    y = PAGE.margin + 2;
  }

  function ensurePage(requiredHeight = 10) {
    if (y + requiredHeight <= bottomLimit) return;

    doc.addPage();
    addPageHeader();
  }

  function addGap(size = 4) {
    y += size;
  }

  function addSectionTitle(title) {
    ensurePage(14);
    addGap(2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setTextColor(doc, COLORS.slate900);
    doc.text(cleanText(title).toUpperCase(), PAGE.margin, y);
    y += 5;
    setDrawColor(doc, COLORS.slate300);
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
    y += 6;
  }

  function addParagraph(text, options = {}) {
    const fontSize = options.fontSize || 9;
    const lineHeight = options.lineHeight || 4.5;
    const fontStyle = options.fontStyle || 'normal';
    const color = options.color || COLORS.slate700;
    const x = options.x || PAGE.margin;
    const width = options.width || contentWidth;

    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    setTextColor(doc, color);

    const normalizedText = preserveLineBreaks(text) || 'Sin información';
    const paragraphs = normalizedText.split('\n');

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const lines = doc.splitTextToSize(paragraph || ' ', width);

      lines.forEach(line => {
        ensurePage(lineHeight + 1);
        doc.text(line, x, y);
        y += lineHeight;
      });

      if (paragraphIndex < paragraphs.length - 1) {
        y += lineHeight / 2;
      }
    });
  }

  function addLabelValue(label, value, options = {}) {
    const width = options.width || contentWidth;
    const x = options.x || PAGE.margin;
    const rawValue = preserveLineBreaks(value) || options.emptyText || 'Sin información';

    ensurePage(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.slate500);
    doc.text(cleanText(label).toUpperCase(), x, y);
    y += 4;

    addParagraph(rawValue, {
      x,
      width,
      fontSize: options.fontSize || 8.5,
      lineHeight: options.lineHeight || 4.2,
      color: options.color || COLORS.slate700,
      fontStyle: options.fontStyle || 'normal',
    });
  }

  function addStatusPill(status, x, pillY) {
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.pending;
    const label = getStatusLabel(status);
    const width = Math.max(20, doc.getTextWidth(label) + 8);

    setFillColor(doc, statusColor.fill);
    setDrawColor(doc, COLORS.slate300);
    doc.roundedRect(x - width, pillY - 4.4, width, 6.5, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setTextColor(doc, statusColor.text);
    doc.text(label, x - width + 4, pillY);
  }

  function addMetricRow(metrics) {
    const gap = 4;
    const cardWidth = (contentWidth - gap * (metrics.length - 1)) / metrics.length;
    const cardHeight = 18;

    ensurePage(cardHeight + 4);

    metrics.forEach((metric, index) => {
      const x = PAGE.margin + index * (cardWidth + gap);
      setFillColor(doc, metric.fill || COLORS.white);
      setDrawColor(doc, COLORS.slate300);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setTextColor(doc, metric.color || COLORS.blue600);
      doc.text(cleanText(metric.value), x + 4, y + 7);

      doc.setFontSize(7);
      setTextColor(doc, COLORS.slate500);
      doc.text(cleanText(metric.label).toUpperCase(), x + 4, y + 13);
    });

    y += cardHeight + 5;
  }

  function addBarRow(label, value, maxValue, options = {}) {
    const labelWidth = 45;
    const valueWidth = 12;
    const barHeight = 5;
    const barX = PAGE.margin + labelWidth + 3;
    const barWidth = contentWidth - labelWidth - valueWidth - 6;
    const barColor = options.color || COLORS.red600;
    const widthRatio = maxValue > 0 ? Math.max(0.04, value / maxValue) : 0;

    ensurePage(barHeight + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setTextColor(doc, COLORS.slate700);
    const truncatedLabel = doc.splitTextToSize(cleanText(label), labelWidth)[0];
    doc.text(truncatedLabel, barX - 3, y + barHeight - 1, { align: 'right' });

    setFillColor(doc, COLORS.slate100);
    doc.roundedRect(barX, y, barWidth, barHeight, 1, 1, 'F');
    setFillColor(doc, barColor);
    doc.roundedRect(barX, y, barWidth * widthRatio, barHeight, 1, 1, 'F');

    doc.setFontSize(8);
    setTextColor(doc, COLORS.slate700);
    doc.text(String(value), barX + barWidth + valueWidth - 2, y + barHeight - 1, { align: 'right' });

    y += barHeight + 3;
  }

  function addDivider() {
    ensurePage(4);
    setDrawColor(doc, COLORS.slate300);
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
    y += 4;
  }

  function addTask(task) {
    ensurePage(18);

    setFillColor(doc, COLORS.white);
    setDrawColor(doc, COLORS.slate300);
    doc.roundedRect(PAGE.margin, y, contentWidth, 10, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setTextColor(doc, COLORS.slate500);
    doc.text(`PRUEBA #${task.order}`, PAGE.margin + 3, y + 6.2);
    addStatusPill(task.status, PAGE.width - PAGE.margin - 3, y + 6.2);
    y += 14;

    addParagraph(task.description, {
      fontSize: 9,
      lineHeight: 4.4,
      fontStyle: 'bold',
      color: COLORS.slate800,
    });

    y += 2;
    addLabelValue('Observación', task.comment, {
      emptyText: 'Sin observación',
      fontSize: 8,
      lineHeight: 4,
    });

    y += 1;
    addLabelValue('Evidencia', task.evidence, {
      emptyText: 'Sin evidencia',
      fontSize: 8,
      lineHeight: 4,
    });

    y += 1;
    addLabelValue('Última actualización', formatDateTime(task.updatedAt), {
      fontSize: 8,
      lineHeight: 4,
    });

    y += 3;
    addDivider();
  }

  function addCoverageRow(row) {
    ensurePage(18);

    setFillColor(doc, COLORS.white);
    setDrawColor(doc, COLORS.slate300);
    doc.roundedRect(PAGE.margin, y, contentWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setTextColor(doc, COLORS.slate900);
    const nameLines = doc.splitTextToSize(cleanText(row.deviceName), 88);
    doc.text(nameLines.slice(0, 2), PAGE.margin + 3, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setTextColor(doc, COLORS.slate500);
    doc.text(cleanText(row.phaseName), PAGE.margin + 3, y + 13);

    const x = PAGE.margin + 98;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.green600);
    doc.text(`Pass ${row.counts.pass}`, x, y + 5);
    setTextColor(doc, COLORS.red600);
    doc.text(`Fail ${row.counts.fail}`, x + 24, y + 5);
    setTextColor(doc, COLORS.yellow600);
    doc.text(`Blocked ${row.counts.blocked}`, x + 47, y + 5);
    setTextColor(doc, COLORS.slate500);
    doc.text(`N/A ${row.counts.na}`, x, y + 11);
    setTextColor(doc, COLORS.slate700);
    doc.text(`Pending ${row.counts.pending}`, x + 24, y + 11);
    setTextColor(doc, COLORS.slate900);
    doc.text(`Total ${row.counts.total}`, x + 62, y + 11);

    y += 20;
  }

  function addDoorCard(door) {
    const deviceCount = door.devices.length;
    const boxHeight = deviceCount === 0 ? 18 : 12 + deviceCount * 9;

    ensurePage(boxHeight + 6);

    setFillColor(doc, COLORS.white);
    setDrawColor(doc, COLORS.slate300);
    doc.roundedRect(PAGE.margin, y, contentWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextColor(doc, COLORS.slate900);
    doc.text(cleanText(door.name), PAGE.margin + 3, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setTextColor(doc, COLORS.slate500);
    const metaText = [door.zone, door.type].filter(Boolean).join(' . ');
    doc.text(cleanText(metaText), PAGE.width - PAGE.margin - 3, y + 6, { align: 'right' });

    let rowY = y + 13;

    if (deviceCount === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      setTextColor(doc, COLORS.slate500);
      doc.text('Sin dispositivos conectados.', PAGE.margin + 3, rowY);
    } else {
      door.devices.forEach(device => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        setTextColor(doc, COLORS.slate800);
        doc.text(cleanText(`${device.typeName} - ${device.label}${device.directionLabel ? ` (${device.directionLabel})` : ''}`), PAGE.margin + 3, rowY);

        doc.setFont('helvetica', 'bold');
        setTextColor(doc, COLORS.yellow600);
        const relayText = `${device.relayLabel || 'Sin rele'}${device.actionSeconds ? ` - ${device.actionSeconds}s` : ''}`;
        doc.text(cleanText(relayText), PAGE.width - PAGE.margin - 3, rowY, { align: 'right' });

        rowY += 4.5;
        doc.setFont('helvetica', 'normal');
        setTextColor(doc, COLORS.slate500);
        const detail = [
          device.portLabel ? `Puerto: ${device.portLabel}` : null,
          device.ip ? `IP: ${device.ip}` : null,
        ].filter(Boolean).join(' . ');
        doc.text(cleanText(detail || 'Sin puerto/IP registrado'), PAGE.margin + 3, rowY);

        rowY += 4.5;
      });
    }

    y += boxHeight + 4;
  }

  function addUnassignedDeviceRow(device) {
    ensurePage(16);

    setFillColor(doc, COLORS.yellow50);
    setDrawColor(doc, COLORS.slate300);
    doc.roundedRect(PAGE.margin, y, contentWidth, 13, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.slate800);
    doc.text(cleanText(`${device.typeName} - ${device.label} [${device.controllerLabel}]`), PAGE.margin + 3, y + 5.5);

    doc.setFont('helvetica', 'bold');
    setTextColor(doc, COLORS.yellow600);
    const relayText = `${device.relayLabel || 'Sin rele'}${device.actionSeconds ? ` - ${device.actionSeconds}s` : ''}`;
    doc.text(cleanText(relayText), PAGE.width - PAGE.margin - 3, y + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    setTextColor(doc, COLORS.slate500);
    const detail = [
      device.portLabel ? `Puerto: ${device.portLabel}` : null,
      device.ip ? `IP: ${device.ip}` : null,
    ].filter(Boolean).join(' . ');
    doc.text(cleanText(detail || 'Sin puerto/IP'), PAGE.margin + 3, y + 10.5);

    y += 16;
  }

  function addFooterPages() {
    const totalPages = doc.getNumberOfPages();

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setTextColor(doc, COLORS.slate500);
      doc.text(
        `Página ${pageNumber} de ${totalPages}`,
        PAGE.width - PAGE.margin,
        PAGE.height - 7,
        { align: 'right' }
      );
    }
  }

  function setY(nextY) {
    y = nextY;
  }

  function addImage(dataUrl, { width = 50, height = 18, label = '' } = {}) {
    if (!dataUrl) return;

    ensurePage(height + (label ? 7 : 3));

    if (label) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      setTextColor(doc, COLORS.slate500);
      doc.text(cleanText(label).toUpperCase(), PAGE.margin, y);
      y += 4;
    }

    try {
      doc.addImage(dataUrl, 'PNG', PAGE.margin, y, width, height);
    } catch {
      // Data URL inválida (no debería pasar, pero no vale la pena romper el PDF por esto).
    }
    y += height + 3;
  }

  return {
    addGap,
    addSectionTitle,
    addParagraph,
    addLabelValue,
    addMetricRow,
    addBarRow,
    addTask,
    addCoverageRow,
    addDoorCard,
    addUnassignedDeviceRow,
    addFooterPages,
    addImage,
    ensurePage,
    setY,
  };
}

function getPeripheralsCount(selectedCommunity) {
  return selectedCommunity.nodes?.reduce((acc, node) => {
    return acc + (node.peripherals || []).reduce((peripheralAcc, peripheral) => {
      return peripheralAcc + Number(peripheral.qty || peripheral.instances?.length || 0);
    }, 0);
  }, 0) || 0;
}

function getPeripheralLabelList(peripheral) {
  const catalogName = DEVICE_CATALOG[peripheral.type]?.name || peripheral.type;
  const qty = Number(peripheral.qty) || peripheral.instances?.length || 1;
  const instances = Array.isArray(peripheral.instances) ? peripheral.instances : [];

  if (!instances.length) {
    return [`${qty}x ${catalogName}`];
  }

  return instances.slice(0, qty).map((instance, index) => {
    const label = instance.label?.trim() || `${catalogName} #${index + 1}`;
    return `${catalogName} #${index + 1}: ${label}`;
  });
}

function getModuleNames(selectedCommunity) {
  const moduleIds = Array.isArray(selectedCommunity.modules) ? selectedCommunity.modules : [];

  return moduleIds
    .map(id => DEVICE_CATALOG[id]?.name)
    .filter(Boolean);
}

function getObservationScopeLabels(scope) {
  if (!scope || scope.length === 0) return ['General'];
  return scope.map(id => resolveObservationScopeLabel(id, DEVICE_CATALOG));
}

function getDeviceCoverageRows(fullChecklistResults) {
  return fullChecklistResults.flatMap(phase => (
    phase.devices.map(device => {
      const counts = {
        total: device.tasks.length,
        pass: 0,
        fail: 0,
        blocked: 0,
        na: 0,
        pending: 0,
      };

      device.tasks.forEach(task => {
        if (counts[task.status] !== undefined) {
          counts[task.status] += 1;
        } else {
          counts.pending += 1;
        }
      });

      return {
        phaseName: phase.phaseName,
        deviceName: device.deviceName,
        counts,
      };
    })
  ));
}

export function downloadStructuredPdfReport({
  selectedCommunity,
  checklistByPhases,
  taskResults,
  summary,
  finalLabStatus,
  reportMode = 'compact',
  generalObservations = [],
  deliveryException = null,
  closedProject = null,
  deviceNotes = {},
}) {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  const writer = createPdfWriter(doc);
  const generatedAt = new Date();
  const issues = getReportIssues(checklistByPhases, taskResults, deviceNotes);
  const fullChecklistResults = getFullReportTasks(checklistByPhases, taskResults);
  const coverageRows = getDeviceCoverageRows(fullChecklistResults);
  const hasInvalidFailures = hasChecklistFailuresWithoutComment(checklistByPhases, taskResults, deviceNotes);
  const today = new Date().toISOString().slice(0, 10);
  const isFullReport = reportMode === 'full';
  const reportModeLabel = isFullReport ? 'completo' : 'compacto';
  const filename = `QA-LabFlow-${sanitizeFileName(selectedCommunity?.name)}-${reportModeLabel}-${today}.pdf`;

  const responsibleParts = [
    selectedCommunity.technicianName ? `Configurado por: ${selectedCommunity.technicianName}` : null,
    selectedCommunity.installerName ? `Instalado por: ${selectedCommunity.installerName}` : null,
  ].filter(Boolean);
  const headerHeight = responsibleParts.length > 0 ? 42 : 36;

  setFillColor(doc, COLORS.slate800);
  doc.rect(0, 0, PAGE.width, headerHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setTextColor(doc, COLORS.white);
  doc.text(cleanText(selectedCommunity.name), PAGE.margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setTextColor(doc, COLORS.slate300);
  doc.text(
    `Generado: ${generatedAt.toLocaleString('es-CL')} | Estado final: ${finalLabStatus}${deliveryException?.active ? ' (entregado bajo excepcion)' : ''}${closedProject?.closed ? ' (proyecto cerrado)' : ''} | Tipo: ${reportModeLabel}`,
    PAGE.margin,
    29
  );

  if (responsibleParts.length > 0) {
    doc.text(cleanText(responsibleParts.join(' | ')), PAGE.margin, 35);
  }

  writer.setY(headerHeight + 8);

  if (deliveryException?.active) {
    writer.addSectionTitle('Entregado bajo excepción');
    writer.addLabelValue('Autorizado por', deliveryException.authorizedBy);
    writer.addLabelValue('Motivo', deliveryException.reason);
    writer.addLabelValue('Registrado', formatDateTime(deliveryException.updatedAt), { emptyText: 'Sin fecha' });
    writer.addImage(deliveryException.signatureDataUrl, { width: 50, height: 18, label: 'Firma' });
    writer.addGap(4);
  }

  if (hasInvalidFailures) {
    writer.addSectionTitle('Advertencia');
    writer.addParagraph(
      'Hay pruebas en Fail o Blocked sin observación técnica. El reporte puede revisarse, pero no debería cerrarse formalmente hasta completar esos comentarios.',
      { color: COLORS.yellow600, fontStyle: 'bold' }
    );
    writer.addGap(4);
  }

  writer.addSectionTitle('Objetivo del reporte');
  writer.addParagraph(
    isFullReport
      ? 'Dejar trazabilidad completa de cada prueba ejecutada, su estado, observación y evidencia. Este modo incluye el detalle completo de todas las pruebas.'
      : 'Dejar trazabilidad ejecutiva de la validación. Este modo muestra resumen, cobertura por equipo, observaciones/fallas/evidencia relevante y topología. Para auditoría completa, usar el PDF completo o el JSON exportado.'
  );

  writer.addSectionTitle('Alcance de validación QA');
  writer.addParagraph(
  'Se ejecutaron las pruebas correspondientes según la topología configurada para la comunidad, considerando controlador, periféricos asociados, reglas de acceso activas y módulos habilitados. Además de los casos definidos en el checklist, se realizó una validación exploratoria complementaria sobre los flujos principales de acceso, revisando el comportamiento general del sistema, la apertura del relé correspondiente, el registro de eventos y la consistencia entre dispositivo, aplicación y dashboard.'
  );
  writer.addSectionTitle('Resumen ejecutivo');
  writer.addMetricRow([
    { value: String(selectedCommunity.nodes?.length || 0), label: 'Controladores' },
    { value: String(getPeripheralsCount(selectedCommunity)), label: 'Periféricos' },
    { value: String(summary.total), label: 'Puntos de control' },
    { value: String(issues.length), label: 'Observaciones', color: COLORS.red600 },
    { value: String(generalObservations.length), label: 'Obs. generales', color: COLORS.purple600 },
  ]);

  writer.addMetricRow([
    { value: String(summary.pass), label: 'Pass', color: COLORS.green600, fill: COLORS.green50 },
    { value: String(summary.fail), label: 'Fail', color: COLORS.red600, fill: COLORS.red50 },
    { value: String(summary.blocked), label: 'Blocked', color: COLORS.yellow600, fill: COLORS.yellow50 },
    { value: String(summary.na), label: 'N/A', color: COLORS.slate500, fill: COLORS.slate100 },
    { value: String(summary.pending), label: 'Pending', color: COLORS.slate700, fill: COLORS.slate100 },
  ]);

  writer.addLabelValue(
    'Estado final',
    `${finalLabStatus}${deliveryException?.active ? ' (entregado bajo excepcion)' : ''}`,
    {
      fontSize: 10,
      fontStyle: 'bold',
      color: finalLabStatus === 'APTO' ? COLORS.green600 : finalLabStatus === 'NO APTO' ? COLORS.red600 : COLORS.slate700,
    }
  );

  writer.addSectionTitle('Módulo de aprobación');
  writer.addParagraph(getApprovalSummaryText(summary, finalLabStatus), { fontStyle: 'bold' });

  const processObservations = generalObservations.filter(observation => (
    Array.isArray(observation.scope) && observation.scope.includes(PROCESS_SCOPE.id)
  ));

  if (processObservations.length > 0) {
    writer.addSectionTitle('Instalación no lista para QA');
    writer.addParagraph(
      `${processObservations.length} observación(es) de Proceso/Documentación registradas — no son fallas de equipo.`,
      { fontStyle: 'bold', color: COLORS.purple600 }
    );
    processObservations.forEach((observation, index) => {
      writer.ensurePage(14);
      writer.addParagraph(`${index + 1}. ${observation.title}`, { fontStyle: 'bold' });
      writer.addLabelValue('Registrada', formatDateTime(observation.createdAt), { emptyText: 'Sin fecha' });
      writer.addGap(2);
    });
    writer.addGap(3);
  }

  if (generalObservations.length > 0) {
    writer.addSectionTitle('Observaciones generales (para mejora)');
    generalObservations.forEach((observation, index) => {
      writer.ensurePage(20);
      const status = resolveObservationStatus(observation);
      writer.addParagraph(`${index + 1}. ${observation.title} (${OBSERVATION_STATUS[status].label})`, {
        fontStyle: 'bold',
        color: OBSERVATION_STATUS_COLORS[status],
      });
      writer.addLabelValue('Alcance', getObservationScopeLabels(observation.scope).join(', '));
      writer.addLabelValue('Detalle', observation.description);
      writer.addLabelValue('Registrada', formatDateTime(observation.createdAt), { emptyText: 'Sin fecha' });
      writer.addGap(3);
    });
  }

  writer.addSectionTitle('Observaciones, fallas y evidencia relevante');
  if (!issues.length) {
    writer.addParagraph('No se registraron incidencias, comentarios ni evidencias específicas durante la ejecución del checklist.');
  } else {
    issues.forEach((issue, index) => {
      writer.ensurePage(18);
      writer.addParagraph(`${index + 1}. ${issue.phaseName} / ${issue.deviceName}`, {
        fontStyle: 'bold',
        color: (STATUS_COLORS[issue.status] || STATUS_COLORS.pending).text,
      });
      if (issue.isDeviceNote) {
        writer.addLabelValue('Nota de dispositivo', `Aplica a ${issue.taskCount} prueba(s)`);
      } else {
        writer.addLabelValue('Prueba', issue.taskDescription);
      }
      writer.addLabelValue('Estado', getStatusLabel(issue.status));
      writer.addLabelValue('Observación', issue.comment, { emptyText: 'Sin observación' });
      if (!issue.isDeviceNote) {
        writer.addLabelValue('Evidencia', issue.evidence, { emptyText: 'Sin evidencia' });
      }
      writer.addLabelValue('Registrado', formatDateTime(issue.updatedAt), { emptyText: 'Sin fecha' });
      writer.addGap(3);
    });
  }

  if (isFullReport) {
    writer.addSectionTitle('Detalle completo de pruebas ejecutadas');
    fullChecklistResults.forEach(phase => {
      writer.ensurePage(14);
      writer.addParagraph(`${phase.phaseNumber}. ${phase.phaseName}`, {
        fontStyle: 'bold',
        fontSize: 11,
        color: COLORS.blue600,
      });
      writer.addGap(2);

      phase.devices.forEach(device => {
        writer.ensurePage(14);
        writer.addParagraph(device.deviceName, {
          fontStyle: 'bold',
          fontSize: 10,
          color: COLORS.slate900,
        });
        writer.addGap(2);

        device.tasks.forEach(task => {
          writer.addTask(task);
        });

        writer.addGap(2);
      });
    });
  } else {
    writer.addSectionTitle('Cobertura por equipo evaluado');
    writer.addParagraph(
      'Esta sección resume cuántas pruebas quedaron en cada estado por equipo. Las pruebas con Fail, Blocked, observación o evidencia se detallan en la sección anterior.',
      { fontSize: 8.5, color: COLORS.slate500 }
    );
    writer.addGap(3);
    coverageRows.forEach(row => writer.addCoverageRow(row));
  }

  writer.addSectionTitle('Ficha tecnica: puertas, reles, puertos e IP');
  writer.addParagraph(
    'Mapa de referencia para tecnicos de terreno: que dispositivo abre cada puerta, por cual rele del controlador y con que puerto/IP quedo configurado.',
    { fontSize: 8.5, color: COLORS.slate500 }
  );
  writer.addGap(2);

  const { controllers, unassignedDevices } = getTechnicalDeviceReport(selectedCommunity);

  controllers.forEach(controller => {
    writer.ensurePage(12);
    writer.addParagraph(controller.nodeLabel, { fontStyle: 'bold', fontSize: 9.5, color: COLORS.slate900 });
    writer.addGap(1);

    if (controller.doors.length === 0) {
      writer.addParagraph('Sin puertas registradas en este controlador.', { fontSize: 8, color: COLORS.slate500 });
    } else {
      controller.doors.forEach(door => writer.addDoorCard(door));
    }

    writer.addGap(2);
  });

  if (unassignedDevices.length > 0) {
    writer.addParagraph('Dispositivos sin puerta asignada', { fontStyle: 'bold', fontSize: 9, color: COLORS.yellow600 });
    writer.addGap(1);
    unassignedDevices.forEach(device => writer.addUnassignedDeviceRow(device));
  }

  writer.addFooterPages();
  doc.save(filename);
}

export function downloadTechnicalSheetPdf({ selectedCommunity }) {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  const writer = createPdfWriter(doc);
  const generatedAt = new Date();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `QA-LabFlow-${sanitizeFileName(selectedCommunity?.name)}-ficha-tecnica-${today}.pdf`;
  const { controllers, unassignedDevices } = getTechnicalDeviceReport(selectedCommunity);

  const responsibleParts = [
    selectedCommunity?.technicianName ? `Configurado por: ${selectedCommunity.technicianName}` : null,
    selectedCommunity?.installerName ? `Instalado por: ${selectedCommunity.installerName}` : null,
  ].filter(Boolean);
  const headerHeight = responsibleParts.length > 0 ? 48 : 42;

  setFillColor(doc, COLORS.slate800);
  doc.rect(0, 0, PAGE.width, headerHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setTextColor(doc, COLORS.white);
  doc.text('QA LabFlow - Ficha Tecnica', PAGE.margin, 17);

  doc.setFontSize(12);
  doc.text(cleanText(selectedCommunity?.name), PAGE.margin, 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setTextColor(doc, COLORS.slate300);
  doc.text(`Generado: ${generatedAt.toLocaleString('es-CL')}`, PAGE.margin, 35);

  if (responsibleParts.length > 0) {
    doc.text(cleanText(responsibleParts.join(' | ')), PAGE.margin, 41);
  }

  writer.setY(headerHeight + 8);

  writer.addSectionTitle('Mapa de puertas, reles, puertos e IP');
  writer.addParagraph(
    'Referencia para tecnicos de terreno: que dispositivo abre cada puerta, por cual rele del controlador y con que puerto/IP quedo configurado.',
    { fontSize: 8.5, color: COLORS.slate500 }
  );
  writer.addGap(2);

  if (controllers.length === 0) {
    writer.addParagraph('Esta comunidad no tiene controladores configurados.');
  }

  controllers.forEach(controller => {
    writer.ensurePage(12);
    writer.addParagraph(controller.nodeLabel, { fontStyle: 'bold', fontSize: 10.5, color: COLORS.slate900 });
    writer.addGap(1);

    if (controller.doors.length === 0) {
      writer.addParagraph('Sin puertas registradas en este controlador.', { fontSize: 8.5, color: COLORS.slate500 });
    } else {
      controller.doors.forEach(door => writer.addDoorCard(door));
    }

    writer.addGap(3);
  });

  if (unassignedDevices.length > 0) {
    writer.addSectionTitle('Dispositivos sin puerta asignada');
    unassignedDevices.forEach(device => writer.addUnassignedDeviceRow(device));
  }

  writer.addFooterPages();
  doc.save(filename);
}

export function downloadGeneralReportPdf({ report }) {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  const writer = createPdfWriter(doc);
  const generatedAt = new Date();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `QA-LabFlow-reporte-general-${today}.pdf`;
  const headerHeight = 42;

  setFillColor(doc, COLORS.slate800);
  doc.rect(0, 0, PAGE.width, headerHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setTextColor(doc, COLORS.white);
  doc.text('QA LabFlow - Reporte General', PAGE.margin, 17);

  doc.setFontSize(11);
  doc.text(
    cleanText(`${report.communitiesCount} comunidades - ${report.totals.total} pruebas evaluadas`),
    PAGE.margin,
    27
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setTextColor(doc, COLORS.slate300);
  doc.text(`Generado: ${generatedAt.toLocaleString('es-CL')}`, PAGE.margin, 35);

  writer.setY(headerHeight + 8);

  writer.addSectionTitle('Resumen ejecutivo');
  const noAptoLine = report.noAptoCount === 0
    ? `De ${report.communitiesCount} proyecto(s) probados, ninguno quedo NO APTO.`
    : `De ${report.communitiesCount} proyecto(s) probados, ${report.noAptoCount} quedaron NO APTO` +
      (report.noAptoWithProcessObservationCount > 0
        ? ` - y ${report.noAptoWithProcessObservationCount} de ${report.noAptoCount} tienen observaciones de instalacion no lista registradas, no solo fallas tecnicas.`
        : '.');
  writer.addParagraph(noAptoLine, { fontStyle: 'bold', color: COLORS.slate800, fontSize: 10 });
  writer.addGap(2);
  writer.addMetricRow([
    { value: String(report.communitiesCount), label: 'Proyectos' },
    { value: `${report.approvalRate}%`, label: 'Aprobacion', color: COLORS.green600, fill: COLORS.green50 },
    { value: String(report.deliveredUnderExceptionCount), label: 'Bajo excepcion', color: COLORS.orange600, fill: COLORS.orange50 },
    { value: String(report.installationNotReadyCount), label: 'Obs. instalacion', color: COLORS.purple600, fill: COLORS.purple50 },
  ]);

  writer.addSectionTitle('Instalacion no lista vs. falla tecnica real');
  writer.addMetricRow([
    { value: String(report.installationNotReadyCount), label: 'Observaciones de instalacion', color: COLORS.purple600, fill: COLORS.purple50 },
    { value: String(report.technicalFailureCount), label: 'Fallas tecnicas confirmadas', color: COLORS.red600, fill: COLORS.red50 },
  ]);

  writer.addSectionTitle('Estado final por proyecto');
  writer.addMetricRow(
    Object.entries(report.statusDistribution).map(([status, count]) => ({
      value: String(count),
      label: status,
    }))
  );

  if (report.installerBreakdown.length > 0) {
    writer.addSectionTitle('Incidencias por instalador');
    const maxInstallerIncidents = report.installerBreakdown.reduce((max, entry) => Math.max(max, entry.incidentCount), 0);
    report.installerBreakdown.forEach(entry => {
      writer.addBarRow(entry.name, entry.incidentCount, maxInstallerIncidents, { color: COLORS.red600 });
    });
    writer.addGap(2);
  }

  writer.addSectionTitle('Defectos por tipo de dispositivo');
  const defectiveDevices = report.deviceBreakdown.filter(device => (device.fail || 0) + (device.blocked || 0) > 0);
  if (defectiveDevices.length === 0) {
    writer.addParagraph('Sin defectos registrados por tipo de dispositivo todavia.');
  } else {
    const maxDeviceDefects = defectiveDevices.reduce((max, device) => Math.max(max, (device.fail || 0) + (device.blocked || 0)), 0);
    defectiveDevices.forEach(device => {
      writer.addBarRow(device.label, (device.fail || 0) + (device.blocked || 0), maxDeviceDefects, { color: COLORS.red600 });
    });
  }
  writer.addGap(2);

  writer.addSectionTitle('Pruebas que más se repiten como Fail/Blocked');
  if (report.topFailingTests.length === 0) {
    writer.addParagraph('Sin fallas ni bloqueos registrados todavía.');
  } else {
    report.topFailingTests.forEach((item, index) => {
      writer.ensurePage(14);
      writer.addParagraph(`${index + 1}. ${item.description}`, {
        fontStyle: 'bold',
        fontSize: 9,
        color: COLORS.slate900,
      });
      writer.addParagraph(
        `${item.count} ${item.count === 1 ? 'vez' : 'veces'} (Fail: ${item.fail}, Blocked: ${item.blocked})`,
        { fontSize: 8, color: COLORS.slate500 }
      );
      writer.addGap(2);
    });
  }

  writer.addSectionTitle('Detalle por proyecto - peor estado primero');
  const sortedCommunitySummaries = [...report.communitySummaries].sort(
    (a, b) => SEVERITY_RANK[a.finalLabStatus] - SEVERITY_RANK[b.finalLabStatus]
  );
  sortedCommunitySummaries.forEach(entry => {
    writer.ensurePage(14);
    writer.addParagraph(
      `${entry.name} - ${entry.finalLabStatus}${entry.deliveredUnderException ? ' (entregado bajo excepcion)' : ''}${entry.isClosed ? ' (cerrado)' : ''}`,
      { fontStyle: 'bold', color: COLORS.slate900 }
    );
    writer.addParagraph(
      `${entry.installerName ? `${entry.installerName} - ` : ''}${entry.summary.completed}/${entry.summary.total} evaluadas - Pass ${entry.summary.pass}, Fail ${entry.summary.fail}, Blocked ${entry.summary.blocked}, N/A ${entry.summary.na}, Pending ${entry.summary.pending}`,
      { fontSize: 8, color: COLORS.slate500 }
    );
    writer.addGap(2);
  });

  writer.addFooterPages();
  doc.save(filename);
}
