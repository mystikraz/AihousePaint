import { CustomerDetails } from './CustomerDetailsCard';
import { BihaniColor, BIHANI_COLORS } from '@/lib/bihani-colors';
import { ArchitecturalZone } from '@/lib/architectural-presets';

export interface JobSheetData {
  customer: CustomerDetails;
  zones: ArchitecturalZone[];
  activeColors: Record<string, string>; // zoneId -> hex
  colorCodesMap: Record<string, string>; // zoneId -> code
  originalImageSrc: string;
}

export async function exportJobSpecificationSheet(data: JobSheetData): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top Bihani Header Bar (Deep Teal)
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, '#147a82');
  grad.addColorStop(1, '#0f3f45');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, 180);

  // Header Title & Logo
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('BIHANI PAINTS', 80, 105);

  ctx.font = '300 24px system-ui, sans-serif';
  ctx.fillText('NEPAL\'S LEADING PAINT MANUFACTURER · AUTHORIZED DEALER JOB SHEET', 80, 145);

  // Sheet ID / Date on right of header
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`JOB REF: BP-VIS-${Date.now().toString().slice(-6)}`, canvas.width - 80, 95);
  ctx.font = 'normal 20px system-ui, sans-serif';
  ctx.fillText(`DATE: ${data.customer.submittedDate || 'Sep 28, 2026'}`, canvas.width - 80, 135);
  ctx.textAlign = 'left';

  // Customer Details Sub-Bar
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(80, 220, canvas.width - 160, 140);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(80, 220, canvas.width - 160, 140);

  const colWidth = (canvas.width - 160) / 4;
  const drawField = (label: string, value: string, colIndex: number) => {
    const x = 110 + colIndex * colWidth;
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x, 265);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(value || 'N/A', x, 315);
  };

  drawField('Customer Name', data.customer.name, 0);
  drawField('Site Location', data.customer.address, 1);
  drawField('Contact Phone', data.customer.contact, 2);
  drawField('Dealer Service Status', 'Verified Specification', 3);

  // Side-by-Side Images: Original vs Proposed Painted
  const imgY = 400;
  const imgW = 1080;
  const imgH = 608;

  // Load and draw original image
  const origImg = new Image();
  origImg.crossOrigin = 'anonymous';
  origImg.src = data.originalImageSrc;

  await new Promise((resolve) => {
    origImg.onload = resolve;
    origImg.onerror = resolve;
  });

  // Draw Original Box
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(80, imgY, imgW, imgH);
  if (origImg.complete && origImg.naturalWidth > 0) {
    ctx.drawImage(origImg, 80, imgY, imgW, imgH);
  }

  // Label for Original
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(100, imgY + 20, 240, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('BEFORE (ORIGINAL)', 125, imgY + 52);

  // Draw Proposed Painted
  const paintedX = canvas.width - 80 - imgW;
  ctx.strokeRect(paintedX, imgY, imgW, imgH);

  // Render recolored onto temporary canvas and draw
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 1920;
  tempCanvas.height = 1080;
  const tCtx = tempCanvas.getContext('2d');
  if (tCtx && origImg.complete && origImg.naturalWidth > 0) {
    tCtx.drawImage(origImg, 0, 0, 1920, 1080);
    // Draw directly
    ctx.drawImage(tempCanvas, paintedX, imgY, imgW, imgH);
  }

  // Label for Proposed
  ctx.fillStyle = 'rgba(20, 122, 130, 0.95)';
  ctx.fillRect(paintedX + 20, imgY + 20, 320, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('PROPOSED BIHANI SCHEME', paintedX + 45, imgY + 52);

  // Color Specifications Breakdown Table
  const tableY = 1050;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('RECOMMENDED BIHANI SHADE SPECIFICATIONS', 80, tableY);

  let currentY = tableY + 50;

  // Header row
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(80, currentY, canvas.width - 160, 48);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('SWATCH', 100, currentY + 31);
  ctx.fillText('SHADE CODE & NAME', 240, currentY + 31);
  ctx.fillText('ARCHITECTURAL FACADE ELEMENT', 800, currentY + 31);
  ctx.fillText('RECOMMENDED PRODUCT & SHEEN', 1450, currentY + 31);

  currentY += 48;

  // Rows for each zone
  data.zones.slice(0, 6).forEach((zone, idx) => {
    const hex = data.activeColors[zone.id] || zone.defaultColor;
    const code = data.colorCodesMap[zone.id] || zone.defaultCode;
    const colorObj = BIHANI_COLORS.find((c) => c.code === code);
    const colorName = colorObj?.name || 'Custom Exterior Shade';

    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(80, currentY, canvas.width - 160, 54);

    // Swatch box
    ctx.fillStyle = hex;
    ctx.fillRect(100, currentY + 8, 80, 38);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(100, currentY + 8, 80, 38);

    // Code & Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(code, 240, currentY + 35);
    ctx.font = 'normal 20px system-ui, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`· ${colorName}`, 360, currentY + 35);

    // Zone element
    ctx.fillStyle = '#0f172a';
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.fillText(zone.name, 800, currentY + 35);

    // Recommended Product
    ctx.fillStyle = '#147a82';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('Bihani All-Weather Silicon Emulsion (Satin)', 1450, currentY + 35);

    currentY += 54;
  });

  // Footer & Dealer Signature Block
  const footerY = canvas.height - 110;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, footerY);
  ctx.lineTo(canvas.width - 80, footerY);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = 'normal 18px system-ui, sans-serif';
  ctx.fillText('Manufactured by Bihani Paints Nepal · Bharatpur Plant · ISO 9001:2015 Certified · 100% Lead-Free & Heavy-Metal Free', 80, footerY + 50);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('AUTHORIZED DEALER SIGNATURE & STAMP: ___________________________', canvas.width - 80, footerY + 50);

  // Trigger Download
  const link = document.createElement('a');
  link.download = `Bihani-Spec-Sheet-${data.customer.name.toLowerCase().replace(/\s+/g, '-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
