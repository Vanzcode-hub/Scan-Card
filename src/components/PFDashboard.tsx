import React from 'react';
import { motion } from 'motion/react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { BillData } from '@/src/services/gemini';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts';
import { Zap, Info, ArrowUpRight, ArrowDownRight, Activity, User, CreditCard, Gauge, TrendingUp, FileDigit, Percent, AlertCircle, Settings2, Calculator, CheckCircle2, ShoppingCart, IndianRupee, Edit3, Save, FileText, TableProperties } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import { calculateKVArCorrection, getNearestStandardPF, TARGET_PF_OPTIONS } from '@/src/lib/pfMath';

import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle, 
  VerticalAlign,
  Header,
  Footer,
  type ITableCellOptions
} from 'docx';

interface PFDashboardProps {
  data: BillData;
}

const CATALOG = [
  { rating: 30, price: 51800 },
  { rating: 60, price: 74000 },
  { rating: 80, price: 89400 },
  { rating: 85, price: 91700 },
  { rating: 150, price: 168700 },
];

function estimatePrice(kvar: number): number {
  if (kvar <= 0) return 0;
  const sorted = [...CATALOG].sort((a, b) => a.rating - b.rating);
  
  if (kvar <= sorted[0].rating) return sorted[0].price;
  if (kvar >= sorted[sorted.length - 1].rating) {
     const last = sorted[sorted.length - 1];
     const unitRate = last.price / last.rating;
     return Math.round(kvar * unitRate);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    if (kvar >= p1.rating && kvar <= p2.rating) {
      const ratio = (kvar - p1.rating) / (p2.rating - p1.rating);
      return Math.round(p1.price + ratio * (p2.price - p1.price));
    }
  }
  return sorted[sorted.length - 1].price;
}


export const PFDashboard: React.FC<PFDashboardProps> = ({ data }) => {
  const [targetPF, setTargetPF] = React.useState(0.99);
  
  const primaryPF = data.calculated_pf;
  const meterPF = data.meter_pf?.toFixed(3);
  
  // Logic Step 1: Match with nearest Standard PF from "Chart Column"
  const nearestStandardPF = getNearestStandardPF(primaryPF);
  
  const isLeading = data.load_type === 'leading';
  const isLagging = data.load_type === 'lagging';

  // Path 1: Lagging (Deterministic Math)
  const sanctionedLoad = data.sanctioned_load_kw || 0;
  const { factorF, requiredKVAr: calculatedKVAr } = calculateKVArCorrection(nearestStandardPF, targetPF, sanctionedLoad);

  // Path 2: Leading (AI Analytical Inference)
  // Use the AI recommended rating if leading, otherwise use calculated
  const finalKVArRating = isLeading ? data.recommended_kvar_rating : calculatedKVAr;

  // Commercial Advisor Logic
  const initialKvar = Math.ceil(finalKVArRating);
  
  const [selectedRating, setSelectedRating] = React.useState(initialKvar);
  const [selectedPrice, setSelectedPrice] = React.useState(estimatePrice(initialKvar));
  const [pricingStatus, setPricingStatus] = React.useState<'AI Estimated' | 'User Defined'>('AI Estimated');
  const [isEditing, setIsEditing] = React.useState(false);
  
  // Dynamic Tariff Rate Logic: (Total Bill Amount - Demand Charges) / Total kWh
  const totalBill = data.bill_amount || 0;
  const demandCharges = data.demand_charges || 0;
  const totalKWh = data.kWh || 1; // Prevent div by zero
  const calculatedTariffRate = totalBill > 0 ? (totalBill - demandCharges) / totalKWh : 14.58;

  // Saving Analysis Calculations (Rows 1-6)
  const row1_targetedPF = 0.99;
  const row2_savingKVAhMonth = Math.max(0, (data.kVAh - data.kWh) * row1_targetedPF);
  const row3_tariffRate = calculatedTariffRate;
  const row4_savingRsMonth = data.kVAh * row3_tariffRate;
  const row5_savingRsYear = (data.kVAh * 12) * row3_tariffRate;
  
  const totalInvestmentWithInstall = selectedPrice + 20000;

  // Row 6: Payback (Months) = (Total Investment / Row 5) * 12
  const paybackMonths = row5_savingRsYear > 0 ? (totalInvestmentWithInstall / row5_savingRsYear) * 12 : 0;

  const formatIN = (num: number, decimals: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  };

  const createTableCell = (text: string, options: { bold?: boolean, alignment?: any, width?: any, children?: Paragraph[] } = {}) => {
    return new TableCell({
      children: options.children || [
        new Paragraph({
          children: [new TextRun({ text, size: 20, bold: options.bold })],
          alignment: options.alignment || AlignmentType.LEFT,
        })
      ],
      verticalAlign: VerticalAlign.CENTER,
      width: options.width,
    });
  };

    const handleDownloadQuote = async () => {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
    const quoteNo = `SEE/25-26/${Math.floor(1000 + Math.random() * 9000)}`;

    const doc = new Document({
      sections: [{
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                   new TextRun({ text: "SEE-Tech Solutions Pvt. Ltd.", bold: true, size: 40, font: "Calibri" }),
                ],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [
                   new TextRun({ text: "11/5, MIDC Infotech Park, South Ambazari Road, Nagpur-440022", bold: true, size: 20, font: "Calibri" }),
                ],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "QUOTATION", bold: true, size: 32, underline: {}, font: "Calibri" }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 },
              }),
            ],
          }),
        },
        children: [
          // Header Table (Date, To, etc)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createTableCell("Date:", { width: { size: 20, type: WidthType.PERCENTAGE } }), createTableCell(today)] }),
              new TableRow({ children: [createTableCell("Quotation No.:"), createTableCell(quoteNo)] }),
              new TableRow({ children: [createTableCell("To:"), createTableCell("", { children: [new Paragraph({ children: [new TextRun({ text: data.customer_name || "VALUED CUSTOMER", bold: true })] })] })] }),
              new TableRow({ children: [createTableCell(""), createTableCell(data.customer_address || "ADDRESS NOT DETECTED")] }),
              new TableRow({ children: [createTableCell("Activity:"), createTableCell(data.activity || "NOT DETECTED")] }),
              new TableRow({ children: [createTableCell("Ref."), createTableCell("as per enquiry")] }),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
              insideVertical: { style: BorderStyle.SINGLE, size: 1 },
            }
          }),

          new Paragraph({ children: [new TextRun({ text: "Dear Sir,", break: 1 })], spacing: { before: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "We thank you for your inquiry for Power Factor Improvement Project" })] }),
          new Paragraph({ children: [new TextRun({ text: "SEE-Tech's offer is as follows:", bold: true })], spacing: { after: 100 } }),

          // Offer Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("Sr.", { bold: true, width: { size: 5, type: WidthType.PERCENTAGE } }),
                  createTableCell("Particular", { bold: true }),
                  createTableCell("Rate", { bold: true, alignment: AlignmentType.RIGHT }),
                  createTableCell("Qty", { bold: true, alignment: AlignmentType.CENTER }),
                  createTableCell("Amount", { bold: true, alignment: AlignmentType.RIGHT }),
                ]
              }),
              new TableRow({
                children: [
                  createTableCell("1"),
                  createTableCell("Power Factor Improvement APFC Panel upto 0.99"),
                  createTableCell(formatIN(selectedPrice), { alignment: AlignmentType.RIGHT }),
                  createTableCell("1", { alignment: AlignmentType.CENTER }),
                  createTableCell(formatIN(selectedPrice), { alignment: AlignmentType.RIGHT }),
                ]
              }),
              new TableRow({
                children: [
                  createTableCell("2"),
                  createTableCell("Installation and commissioning Charges"),
                  createTableCell(formatIN(20000), { alignment: AlignmentType.RIGHT }),
                  createTableCell("1", { alignment: AlignmentType.CENTER }),
                  createTableCell(formatIN(20000), { alignment: AlignmentType.RIGHT }),
                ]
              }),
              new TableRow({
                children: [
                  createTableCell(""),
                  createTableCell("Amount, Rs.", { bold: true }),
                  createTableCell(""),
                  createTableCell(""),
                  createTableCell(formatIN(totalInvestmentWithInstall), { bold: true, alignment: AlignmentType.RIGHT }),
                ]
              }),
            ],
          }),

          new Paragraph({ children: [new TextRun({ text: "Technical Specifications", bold: true, break: 1 })], spacing: { before: 200, after: 100 } }),
          // Technical Specifications Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createTableCell("Sr.", { width: { size: 5, type: WidthType.PERCENTAGE } }), createTableCell("Technical Specifications"), createTableCell("", { width: { size: 30, type: WidthType.PERCENTAGE } })] }),
              new TableRow({ children: [createTableCell("1"), createTableCell("Total Panel kVAr"), createTableCell(`${selectedRating} kVAr`)] }),
              new TableRow({ children: [createTableCell("2"), createTableCell("Relay stage"), createTableCell("")] }),
              new TableRow({ children: [createTableCell("3"), createTableCell("Relay Model"), createTableCell("Entes RGP12")] }),
            ],
          }),

          new Paragraph({ children: [new TextRun({ text: "Scope of Work", bold: true, break: 1 })], spacing: { before: 200, after: 100 } }),
          // Scope of Work Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createTableCell("1"), createTableCell("Monitoring of APFC for 2 billing cycle")] }),
              new TableRow({ children: [createTableCell("2"), createTableCell("Energy monitoring, power factor review for 12 months & taking actions")] }),
              new TableRow({ children: [createTableCell("3"), createTableCell("Installation and commissioning")] }),
            ],
          }),

          new Paragraph({ children: [new TextRun({ text: "Saving Analysis", bold: true, break: 1 })], spacing: { before: 200, after: 100 } }),
          // Saving Analysis Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("1"),
                  createTableCell(`Targeted PF (kWh/kVAh, Present PF= ${primaryPF.toFixed(3)})`),
                  createTableCell("0.99", { alignment: AlignmentType.RIGHT })
                ]
              }),
              new TableRow({
                children: [
                  createTableCell("2"),
                  createTableCell("Saving after PF improvement, kVAh/month (Line 13)"),
                  createTableCell(formatIN(row2_savingKVAhMonth), { alignment: AlignmentType.RIGHT })
                ]
              }),
              new TableRow({
                children: [
                  createTableCell("3"),
                  createTableCell("Calculated Tariff Rate, Rs./kVAh"),
                  createTableCell(formatIN(row3_tariffRate, 2), { alignment: AlignmentType.RIGHT })
                ]
              }),
              new TableRow({
                children: [
                  createTableCell("4"),
                  createTableCell("Saving after PF improvement, Rs./month (Line 15)"),
                  createTableCell(formatIN(row4_savingRsMonth), { alignment: AlignmentType.RIGHT })
                ]
              }),
              new TableRow({
                children: [
                  createTableCell("5"),
                  createTableCell("Saving after PF improvement, Rs./year (Line 16)"),
                  createTableCell(formatIN(row5_savingRsYear), { alignment: AlignmentType.RIGHT })
                ]
              }),
              new TableRow({
                children: [
                  createTableCell("6"),
                  createTableCell("Payback, months"),
                  createTableCell(formatIN(paybackMonths, 1), { alignment: AlignmentType.RIGHT })
                ]
              }),
            ],
          }),

          new Paragraph({ children: [new TextRun({ text: "Terms & Conditions:", bold: true, break: 1 })], spacing: { before: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "1. GST extra:- 18%" })] }),
          new Paragraph({ children: [new TextRun({ text: "2. Payment term:- 100% Advance" })] }),
          new Paragraph({ children: [new TextRun({ text: "3. It may take 2 billing cycle to achieve the targeted PF" })] }),
          new Paragraph({ children: [new TextRun({ text: "4. If extra cable is required, the same is to be provided by you/ charged separately" })] }),
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `ElectraPF_Quotation_${data.customer_name?.replace(/\s+/g, '_') || 'Quote'}.docx`);
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    
    // Formatting Helpers
    const thinBorder = { style: 'thin' as ExcelJS.BorderStyle };
    const allBorders: Partial<ExcelJS.Borders> = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E9E9' } }; // Lighter grey for headers

    const todayFixed = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
    const quoteNoStr = `SEE/2026-27/${Math.floor(10 + Math.random() * 89)}`;

    // 1. THE MAIN QUOTATION SHEET
    const sheetQuote = workbook.addWorksheet('Quotation');
    
    // Column Widths (A-J)
    sheetQuote.columns = [
      { width: 18 },  // A - Sr. / Label
      { width: 30 },  // B
      { width: 15 },  // C
      { width: 10 },  // D
      { width: 10 },  // E
      { width: 12 },  // F - Rate
      { width: 8 },   // G - Qty
      { width: 15 },  // H - Amount
      { width: 2 },   // I - Separator
      { width: 15 }   // J - Extra
    ];

    const applyTableStyle = (rowNum: number, startCol: number, endCol: number, isHeader = false) => {
      const row = sheetQuote.getRow(rowNum);
      for (let i = startCol; i <= endCol; i++) {
        const cell = row.getCell(i);
        cell.border = allBorders;
        if (isHeader) {
          cell.font = { bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = headerFill;
        } else if (i === 1) {
          // Center Serial numbers
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }
    };

    // --- 1. HEADER SECTION ---
    sheetQuote.getColumn(1).width = 20;
    sheetQuote.getRow(1).height = 60; 
    sheetQuote.getRow(2).height = 25;
    
    // Logo Merged A1:A2
    sheetQuote.mergeCells('A1:A2');
    sheetQuote.getCell('A1').border = allBorders;

    // Logo Image from provided URL
    try {
      const logoUrl = 'https://media.licdn.com/dms/image/v2/D560BAQGPrhM6hKO7cQ/company-logo_200_200/B56Zt5SLwyJsAM-/0/1767266369121/seetecholutions_logo?e=2147483647&v=beta&t=v785q5S3-bw2ttBjKDqEa8aZ-khovuzsEQ_UB5yewmg';
      const response = await fetch(logoUrl);
      const blob = await response.blob();
      
      const toBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const base64WithHeader = await toBase64(blob);
      const base64Data = base64WithHeader.split(',')[1];

      const imageId = workbook.addImage({
        base64: base64Data,
        extension: 'png',
      });
      sheetQuote.addImage(imageId, {
        tl: { col: 0.05, row: 0.05 },
        ext: { width: 130, height: 80 },
        editAs: 'oneCell'
      });
    } catch (e) {
      console.error('Logo Error:', e);
      sheetQuote.getCell('A1').value = 'SEE-TECH';
      sheetQuote.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Company Name & Address (B1:H1)
    sheetQuote.mergeCells('B1:H1');
    const headerCell = sheetQuote.getCell('B1');
    headerCell.value = {
      richText: [
        { font: { bold: true, size: 20, name: 'Calibri' }, text: 'SEE-Tech Solutions Pvt. Ltd.\n' },
        { font: { bold: true, size: 10, name: 'Calibri' }, text: '11/5, MIDC Infotech Park, South Ambazari Road, Nagpur-440022' }
      ]
    };
    headerCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerCell.border = allBorders;

    // QUOTATION (B2:H2)
    sheetQuote.mergeCells('B2:H2');
    const qTitleCell = sheetQuote.getCell('B2');
    qTitleCell.value = 'QUOTATION';
    qTitleCell.font = { name: 'Calibri', bold: true, size: 16 };
    qTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    qTitleCell.border = allBorders;

    // --- 2. CUSTOMER META DATA ---
    const addMetaBorder = (rowNum: number) => {
      for (let i = 1; i <= 8; i++) sheetQuote.getRow(rowNum).getCell(i).border = allBorders;
    };

    const metaItems = [
      ['Date:', todayFixed],
      ['Quotation No.:', quoteNoStr],
      ['To,', data.customer_name || 'VALUED CUSTOMER'],
      ['Mobile Number:', data.customer_mobile || '-'],
      ['Email ID:', data.customer_email || '-'],
      ['Kind Attn.', '']
    ];

    metaItems.forEach((it) => {
      const r = sheetQuote.addRow([it[0], it[1]]);
      sheetQuote.mergeCells(`B${r.number}:H${r.number}`);
      addMetaBorder(r.number);
      r.getCell(1).font = { size: 10, bold: false };
      r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    });

    const sp1 = sheetQuote.addRow([]);
    sp1.height = 10;
    sheetQuote.mergeCells(`A${sp1.number}:H${sp1.number}`);

    const refRow = sheetQuote.addRow(['Ref.', 'As per enquiry']);
    sheetQuote.mergeCells(`B${refRow.number}:H${refRow.number}`);
    addMetaBorder(refRow.number);
    refRow.getCell(1).font = { size: 10 };

    const sp2 = sheetQuote.addRow([]);
    sp2.height = 10;
    sheetQuote.mergeCells(`A${sp2.number}:H${sp2.number}`);
    
    const dsRow = sheetQuote.addRow(['Dear Sir,']);
    sheetQuote.mergeCells(`A${dsRow.number}:H${dsRow.number}`);
    dsRow.getCell(1).font = { size: 10 };
    dsRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    const thkRow = sheetQuote.addRow(['We thank you for your inquiry for Power Factor Improvement Project']);
    sheetQuote.mergeCells(`A${thkRow.number}:H${thkRow.number}`);
    thkRow.getCell(1).font = { size: 10 };
    thkRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    const offRow = sheetQuote.addRow(['SEE-Tech\'s offer is as follows:']);
    sheetQuote.mergeCells(`A${offRow.number}:H${offRow.number}`);
    offRow.getCell(1).font = { size: 10 };
    offRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    // --- 3. OFFER TABLE ---
    const hOff = sheetQuote.addRow(['Sr.', 'Particular', '', '', '', 'Rate', 'Qty', 'Amount']);
    sheetQuote.mergeCells(`B${hOff.number}:E${hOff.number}`);
    applyTableStyle(hOff.number, 1, 8, true);
    hOff.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    const rowItems = [
      [1, 'Power Factor Improvement APFC Panel upto 0.99', '', '', '', selectedPrice, 1, selectedPrice],
      [2, 'Installation and commissioning Charges', '', '', '', 20000, 1, 20000],
    ];

    rowItems.forEach(it => {
      const r = sheetQuote.addRow(it);
      sheetQuote.mergeCells(`B${r.number}:E${r.number}`);
      applyTableStyle(r.number, 1, 8);
      r.getCell(6).numFmt = '#,##,##0';
      r.getCell(8).numFmt = '#,##,##0';
    });

    const totalRow = sheetQuote.addRow(['', 'Amount, Rs.', '', '', '', '', '', totalInvestmentWithInstall]);
    sheetQuote.mergeCells(`B${totalRow.number}:G${totalRow.number}`);
    applyTableStyle(totalRow.number, 1, 8);
    totalRow.getCell(2).font = { bold: true };
    totalRow.getCell(2).alignment = { horizontal: 'left' };
    totalRow.getCell(8).font = { bold: true };
    totalRow.getCell(8).numFmt = '#,##,##0';

    const sp3 = sheetQuote.addRow([]);
    sp3.height = 10;
    sheetQuote.mergeCells(`A${sp3.number}:H${sp3.number}`);

    // --- 4. TECHNICAL SPECIFICATIONS ---
    const techH = sheetQuote.addRow(['Sr.', 'Technical Specifications', '', '', '', '', '', 'Value']);
    sheetQuote.mergeCells(`B${techH.number}:G${techH.number}`);
    applyTableStyle(techH.number, 1, 8, true);
    techH.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    const techSpecs = [
      [1, 'Total Panel kVAr', '', '', '', '', '', `${selectedRating} kVAr`],
      [2, 'Relay stage', '', '', '', '', '', ''],
      [3, 'Entes Relay RGP12', '', '', '', '', '', '3 CT'],
    ];

    techSpecs.forEach(it => {
      const r = sheetQuote.addRow(it);
      sheetQuote.mergeCells(`B${r.number}:G${r.number}`);
      applyTableStyle(r.number, 1, 8);
      r.getCell(8).alignment = { horizontal: 'right' };
    });

    const sp4 = sheetQuote.addRow([]);
    sp4.height = 10;
    sheetQuote.mergeCells(`A${sp4.number}:H${sp4.number}`);

    // --- 5. SCOPE OF WORK ---
    const scopeH = sheetQuote.addRow(['Sr.', 'Scope of Work', '', '', '', '', '', '']);
    sheetQuote.mergeCells(`B${scopeH.number}:H${scopeH.number}`);
    applyTableStyle(scopeH.number, 1, 8, true);
    scopeH.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    const scopeLines = [
      [1, 'Monitoring of APFC for 2 billing cycle'],
      [2, 'Energy monitoring, power factor review for 12 months and taking corrective actions if any'],
      [3, 'Installation and commissioning'],
    ];

    scopeLines.forEach(it => {
      const r = sheetQuote.addRow([it[0], it[1]]);
      sheetQuote.mergeCells(`B${r.number}:H${r.number}`);
      applyTableStyle(r.number, 1, 8);
    });

    const sp5 = sheetQuote.addRow([]);
    sp5.height = 10;
    sheetQuote.mergeCells(`A${sp5.number}:H${sp5.number}`);

    // --- 6. SAVING ANALYSIS ---
    const savH = sheetQuote.addRow(['Sr.', 'Saving Analysis', '', '', '', '', '', 'Value']);
    sheetQuote.mergeCells(`B${savH.number}:G${savH.number}`);
    applyTableStyle(savH.number, 1, 8, true);
    savH.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    const savData = [
      [1, `Targeted PF (kWh/kVAh, Present PF= ${primaryPF.toFixed(3)})`, 0.99],
      [2, 'Saving after PF improvement, kVAh/month', row2_savingKVAhMonth],
      [3, 'Tariff Rate, Rs./kVAh', row3_tariffRate],
      [4, 'Saving after PF improvement, Rs./month', row4_savingRsMonth],
      [5, 'Saving after PF improvement, Rs./year', row5_savingRsYear],
      [6, 'Payback, months', paybackMonths],
    ];

    savData.forEach(it => {
      const r = sheetQuote.addRow([it[0], it[1], '', '', '', '', '', it[2]]);
      sheetQuote.mergeCells(`B${r.number}:G${r.number}`);
      applyTableStyle(r.number, 1, 8);
      r.getCell(8).numFmt = it[0] === 3 ? '0.00' : (it[0] === 6 ? '0.00' : '#,##,##0');
    });

    const s6 = sheetQuote.addRow([]);
    s6.height = 15;
    sheetQuote.mergeCells(`A${s6.number}:H${s6.number}`);

    // --- 7. TERMS & CONDITIONS ---
    const tcTitle = sheetQuote.addRow(['Terms & Conditions:']);
    sheetQuote.mergeCells(`A${tcTitle.number}:H${tcTitle.number}`);
    tcTitle.getCell(1).font = { bold: true };
    tcTitle.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    for (let i = 1; i <= 8; i++) tcTitle.getCell(i).border = { top: thinBorder, left: i === 1 ? thinBorder : undefined, right: i === 8 ? thinBorder : undefined };

    const tcs = [
      '1. GST extra:- 18%',
      '2. Payment term:- 100% Advance',
      '3. If may take 2 billing cycle to achieve the targeted PF',
      '4. If extra cable is required, the same is to be provided by you/ charged seperately'
    ];

    tcs.forEach((line, idx) => {
      const r = sheetQuote.addRow([line]);
      sheetQuote.mergeCells(`A${r.number}:H${r.number}`);
      for (let i = 1; i <= 8; i++) {
        r.getCell(i).border = { 
          left: i === 1 ? thinBorder : undefined, 
          right: i === 8 ? thinBorder : undefined,
          bottom: idx === tcs.length - 1 ? thinBorder : undefined
        };
      }
    });

    // Set row height of 15.00 for row 3 onwards
    sheetQuote.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber >= 3) {
        row.height = 15;
      }
    });

    // --- 8. FINAL STRUCTURAL LINES ---
    // User requested: horizontal line at row 42, vertical line between H & J till row 42
    for (let i = 1; i <= 42; i++) {
      const row = sheetQuote.getRow(i);
      
      // Vertical line between H and J (Setting border on column 9 - I)
      const cellI = row.getCell(9);
      cellI.border = { 
        ...cellI.border,
        left: thinBorder 
      };

      // Outer border for the entire workspace (A-H) up to row 42
      if (i === 1) {
        for (let j = 1; j <= 8; j++) {
          const cell = row.getCell(j);
          cell.border = { ...cell.border, top: thinBorder };
        }
      }
      
      // Left border of column A
      const cellA = row.getCell(1);
      cellA.border = { ...cellA.border, left: thinBorder };
      
      // Horizontal line at row 42
      if (i === 42) {
        for (let j = 1; j <= 8; j++) {
           const cell = row.getCell(j);
           cell.border = { ...cell.border, bottom: thinBorder };
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `ElectraPF_Quotation_${data.customer_name?.replace(/\s+/g, '_') || 'Report'}.xlsx`);
  };


  // Re-calculate price if rating changes, UNLESS it's user defined
  React.useEffect(() => {
    if (pricingStatus === 'AI Estimated' && !isEditing) {
      const newKvar = Math.ceil(finalKVArRating);
      setSelectedRating(newKvar);
      setSelectedPrice(estimatePrice(newKvar));
    }
  }, [finalKVArRating, pricingStatus, isEditing]);

  const handleRatingChange = (val: number) => {
    setSelectedRating(val);
    if (pricingStatus === 'AI Estimated') {
      setSelectedPrice(estimatePrice(val));
    }
  };

  const handlePriceChange = (val: number) => {
    setSelectedPrice(val);
    setPricingStatus('User Defined');
  };

  const displayPF = primaryPF.toFixed(3);

  const chartData = [
    { name: 'Active (kWh)', value: data.kWh, fill: '#7C3AED' }, // Accent Purple
    { name: 'Lag (kVARh)', value: data.kVARh_lag, fill: '#EF4444' }, // Error Red
    { name: 'Lead (kVARh)', value: data.kVARh_lead, fill: '#10B981' }, // Success Green
    { name: 'Apparent (kVAh)', value: data.kVAh, fill: '#6B7280' }, // Slate
  ];

  const getStatusColor = () => {
    if (data.load_type === 'lagging') return 'text-error border-error bg-error/5';
    if (data.load_type === 'leading') return 'text-success border-success bg-success/5';
    return 'text-accent border-accent bg-accent/5';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-6xl mx-auto mt-16 px-4 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-8"
    >
      {/* Panel 02: Account & Demand Analysis */}
      <div id="account-panel" className="panel lg:col-span-2">
        <div className="panel-header">
           <User className="w-4 h-4" />
           02. Account & Demand Profile
        </div>
        <div className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-12 gap-x-10">
            {/* Row 1: Primary Account Info */}
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-accent/10 rounded-2xl">
                <User className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="data-label">Account Holder</span>
                <span className="font-display text-lg font-bold text-text truncate block">{data.customer_name || 'Not Detected'}</span>
                <div className="mt-1 space-y-0.5">
                  {data.customer_address && (
                    <span className="text-[10px] text-text-dim block leading-tight">{data.customer_address}</span>
                  )}
                  {data.customer_mobile && (
                    <span className="text-[10px] text-accent block font-medium">Mob: {data.customer_mobile}</span>
                  )}
                  {data.customer_email && (
                    <span className="text-[10px] text-indigo-500 block font-medium">Email: {data.customer_email}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-indigo-500/10 rounded-2xl">
                <Activity className="w-6 h-6 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="data-label">Activity / Tariff</span>
                <span className="font-display text-lg font-bold text-text truncate block">{data.activity || 'Not Detected'}</span>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-success/10 rounded-2xl">
                <CreditCard className="w-6 h-6 text-success" />
              </div>
              <div>
                <span className="data-label">Amount Payable</span>
                <span className="font-mono text-lg font-bold text-text block">
                  {data.bill_amount ? `₹${data.bill_amount.toLocaleString()}` : 'Not Detected'}
                </span>
                {data.tariff_rate && (
                  <span className="text-[10px] text-text-dim block mt-1 tracking-tight">Tariff: ₹{data.tariff_rate}/kVAh</span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-purple/10 rounded-2xl">
                <Gauge className="w-6 h-6 text-purple" />
              </div>
              <div>
                <span className="data-label">Contract Demand</span>
                <span className="font-mono text-lg font-bold text-text block">
                  {data.sanctioned_demand_kva ? `${data.sanctioned_demand_kva} kVA` : 'Not Detected'}
                </span>
              </div>
            </div>

            {/* Row 2: Specialized Demand Info */}
            <div className="flex items-center gap-5 p-5 bg-bg rounded-2xl border border-border/50 transition-transform hover:scale-[1.02]">
              <div className="p-3.5 bg-white rounded-xl shadow-sm border border-border/20">
                <TrendingUp className="w-6 h-6 text-amber" />
              </div>
              <div>
                <span className="data-label !text-amber">Actual Demand</span>
                <span className="font-mono text-lg font-bold text-text block">
                  {data.billing_demand_kva ? `${data.billing_demand_kva} kVA` : 'Not Detected'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-5 p-5 bg-bg rounded-2xl border border-border/50 transition-transform hover:scale-[1.02]">
              <div className="p-3.5 bg-white rounded-xl shadow-sm border border-border/20">
                <Percent className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <span className="data-label !text-indigo-500">Minimum Demand</span>
                <span className="font-mono text-lg font-bold text-text block">
                  {data.min_demand_kva ? `${data.min_demand_kva} kVA` : 'Not Detected'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-5 p-5 bg-bg rounded-2xl border border-border/50 transition-transform hover:scale-[1.02]">
              <div className="p-3.5 bg-white rounded-xl shadow-sm border border-border/20">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <div>
                <span className="data-label !text-accent">Sanctioned Load</span>
                <span className="font-mono text-lg font-bold text-text block">
                  {data.sanctioned_load_kw ? `${data.sanctioned_load_kw} kW` : 'Not Detected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel 03: Data & Analysis */}
      <div id="data-panel" className="panel">
        <div className="panel-header">
           <Activity className="w-4 h-4" />
           03. Energy Consumption Log
        </div>
        <div id="analysis-grid" className="p-8 grid grid-cols-2 gap-6">
          <div className="metric-card">
            <span className="data-label">Active (kWh)</span>
            <span className="font-mono text-2xl text-text block leading-none">{data.kWh.toLocaleString()}</span>
          </div>
          <div className="metric-card">
            <span className="data-label">Apparent (kVAh)</span>
            <span className="font-mono text-2xl text-text block leading-none">{data.kVAh.toLocaleString()}</span>
          </div>
          <div className="metric-card">
            <span className="data-label">Lag Reactive</span>
            <span className="font-mono text-2xl text-error/80 block leading-none">{data.kVARh_lag.toLocaleString()}</span>
          </div>
          <div className="metric-card">
            <span className="data-label">Lead Reactive</span>
            <span className="font-mono text-2xl text-success/80 block leading-none">{data.kVARh_lead.toLocaleString()}</span>
          </div>
        </div>

        <div className="px-8 pb-8">
          <div className="flex justify-between items-end mb-6 px-2">
             <div className="flex flex-col">
               <span className="text-[10px] text-text-dim uppercase tracking-widest font-black mb-1">Meter PF</span>
               <span className="font-mono text-xl text-text/40">{meterPF || 'N/A'}</span>
             </div>
             <motion.div 
               initial={{ scale: 0.9 }}
               animate={{ scale: 1 }}
               className="flex flex-col text-right"
              >
               <span className="text-[10px] text-accent font-black uppercase tracking-[2px] mb-1">Analyzer PF</span>
               <span className="font-mono text-3xl font-black text-accent drop-shadow-sm">{displayPF}</span>
             </motion.div>
          </div>
          <div className="h-[180px] w-full bg-slate-50 border border-border p-5 rounded-2xl shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(124,58,237,0.04)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white border border-border p-4 rounded-xl shadow-2xl">
                          <p className="text-[10px] font-black text-text-dim uppercase mb-2 tracking-widest">{payload[0].payload.name}</p>
                          <p className="text-xl font-mono font-bold text-accent">{payload[0].value.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Panel 04: Result */}
      <div id="result-panel" className="panel relative overflow-visible">
        <div className="panel-header">
           <Zap className="w-4 h-4" />
           04. Load Characterization
        </div>
        <div className="p-10 flex flex-col items-center justify-center text-center">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-48 h-48 rounded-[40px] bg-linear-to-br from-accent to-indigo-600 p-[1px] mb-10 shadow-2xl shadow-accent/20"
          >
            <div className="w-full h-full bg-white rounded-[39px] flex flex-col items-center justify-center">
              <span className="font-display text-5xl font-black tracking-tight text-text leading-none mb-2">{displayPF}</span>
              <span className="text-[10px] uppercase text-accent tracking-[3px] font-black">Pulse Score</span>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn("px-8 py-3 rounded-2xl text-[12px] font-black uppercase tracking-[3px] border-2 mb-8 shadow-sm", getStatusColor())}
          >
            {data.load_type}
          </motion.div>
          
          {meterPF && Math.abs(primaryPF - parseFloat(meterPF)) > 0.05 && (
            <div className="mb-8 p-4 bg-error/10 border border-error/20 rounded-xl text-[10px] text-error font-black uppercase tracking-[2px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Drift Alert: Check Meter Calibration
            </div>
          )}
          
          <div className="flex items-center gap-3 text-text-dim">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", data.load_type === 'lagging' ? 'bg-error' : 'bg-success')}></div>
            <p className="text-sm font-medium tracking-tight">
              {data.load_type === 'lagging' ? 'Dominant Inductive Signature' : 'Capacitive Leading Phase'}
            </p>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-border mt-auto">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="text-[11px] uppercase font-black text-text tracking-[2px]">Field Insight</h3>
            <div className="ml-auto px-2 py-0.5 bg-accent-soft rounded border border-accent/10">
              <span className="text-[8px] text-accent font-black uppercase tracking-tighter">{data.analysis_method}</span>
            </div>
          </div>
          <div className="text-[13px] text-text-dim leading-relaxed font-sans scrollbar-hide overflow-y-auto max-h-[140px] prose prose-blue">
             <ReactMarkdown>{data.explanation}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Panel 05: Correction Planner */}
      <div id="correction-panel" className="panel lg:col-span-2 shadow-xl shadow-accent/5 border-accent/20">
        <div className="panel-header bg-accent-soft/30 border-accent/20 text-accent">
          <Settings2 className="w-4 h-4" />
          05. Optimisation & Capacitor Planner
        </div>
        
        <div className="p-10 grid grid-cols-1 xl:grid-cols-12 gap-12">
          {/* Left Side: Goal Setting */}
          <div className="xl:col-span-7">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Calculator className="w-4 h-4 text-accent" />
              </div>
              <h3 className="font-display text-xl font-bold text-text">Correction Strategy</h3>
            </div>

            <div className="space-y-10">
              {/* Step 1: Matching */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">1</span>
                  <span className="text-xs uppercase font-black tracking-widest text-text-dim">Match Current Baseline</span>
                </div>
                <div className="p-6 bg-bg rounded-2xl border border-border/50 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-text-dim block mb-1">Detected P.F</span>
                    <span className="font-mono text-2xl font-bold text-text leading-none">{displayPF}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-px bg-border my-2"></div>
                    <span className="text-[10px] uppercase font-bold text-accent tracking-tighter">Chart Lookup Value</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-text-dim block mb-1">Standard Reference</span>
                    <span className="font-mono text-2xl font-bold text-accent leading-none">{nearestStandardPF.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Step 2: Goal Selection */}
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">2</span>
                  <span className="text-xs uppercase font-black tracking-widest text-text-dim">Define Efficiency Goal (Target P.F)</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2">
                  {TARGET_PF_OPTIONS.map((val) => (
                    <button
                      key={val}
                      onClick={() => setTargetPF(val)}
                      className={cn(
                        "py-3 rounded-xl border-2 font-mono text-xs font-bold transition-all duration-300",
                        targetPF === val 
                          ? "bg-accent border-accent text-white shadow-lg shadow-accent/20 scale-105" 
                          : "bg-white border-border/60 text-text-dim hover:border-accent/40 hover:text-accent"
                      )}
                    >
                      {val.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Results */}
          <div className="xl:col-span-5 flex flex-col justify-center">
            <div className="bg-accent rounded-[2rem] p-10 text-white shadow-2xl shadow-accent/30 relative overflow-hidden group">
              {/* Decorative Pulse */}
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="w-5 h-5 text-accent-soft fill-current" />
                  <span className="text-[10px] uppercase font-black tracking-[4px] text-accent-soft">Calculation Output</span>
                </div>
                
                <div className="mb-8">
                  <span className="text-6xl font-display font-black leading-none block mb-2">
                    {finalKVArRating.toFixed(2)}
                  </span>
                  <span className="text-xl font-display font-bold opacity-80 uppercase tracking-widest">Required kVAr Rating</span>
                </div>

                <div className="space-y-4">
                  {isLagging ? (
                    <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">Factor F (Design Value)</span>
                        <span className="font-mono font-bold tracking-tighter">
                          {factorF.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-1 opacity-60">
                        <span className="text-[10px] uppercase font-bold tracking-widest">Standard Reference</span>
                        <span className="font-mono font-bold text-[10px]">{nearestStandardPF.toFixed(2)} → {targetPF.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">Calculation</span>
                        <span className="font-mono font-bold text-[10px]">
                          {sanctionedLoad}kW × {factorF.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">Analysis Method</span>
                        <span className="font-mono font-bold text-[10px]">AI Reactive Imbalance</span>
                      </div>
                      <div className="flex justify-between items-center mb-1 opacity-60">
                        <span className="text-[10px] uppercase font-bold tracking-widest">Status</span>
                        <span className="font-mono font-bold text-[10px] text-success-light">Over-compensation Detected</span>
                      </div>
                      <p className="text-[9px] uppercase tracking-tight opacity-50 mt-2">
                        Neutralization strategy generated via capacitive load profile profiling.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-4 bg-white text-accent rounded-2xl shadow-xl">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="text-[11px] font-bold leading-tight uppercase">
                      Recommended: Install a {Math.ceil(finalKVArRating)} kVAr {isLeading ? 'Dynamic' : 'Automatic'} APFC Panel
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-start gap-3 p-4 bg-amber/5 border border-amber/10 rounded-2xl">
              <Info className="w-4 h-4 text-amber shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-normal font-medium">
                <strong>Important:</strong> {isLagging ? 'Correction steps are calculated using the Standard Tan Phi Displacement Matrix.' : 'Neutralization strategy is determined by AI Analytical Inference of capacitive surges.'} Always consult with a licensed electrical engineer before physical installation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel 06: Commercial Proposal */}
      <div id="commercial-panel" className="panel lg:col-span-2 border-amber/20 bg-amber-50/10">
        <div className="panel-header text-amber bg-amber-50/30 border-amber-100 italic">
           <ShoppingCart className="w-4 h-4" />
           06. Commercial Proposal & Investment Analysis
        </div>
        
        <div className="p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left side: Product Recommendation */}
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
                    <IndianRupee className="w-4 h-4 text-amber" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-text">Investment Summary</h3>
                </div>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white border border-border/80 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-accent hover:text-accent shadow-sm transition-all active:scale-95"
                >
                  {isEditing ? <Save className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                  {isEditing ? 'Save Adjustment' : 'Manual Override'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className={cn(
                  "p-8 rounded-[2rem] transition-all",
                  isEditing ? "bg-white border-2 border-amber shadow-xl" : "bg-bg border border-border/50"
                )}>
                  <span className="data-label">Selected System Rating</span>
                  {isEditing ? (
                    <div className="flex items-baseline gap-2">
                       <input 
                         type="number" 
                         value={selectedRating}
                         onChange={(e) => handleRatingChange(Number(e.target.value))}
                         className="w-full font-mono text-3xl font-black bg-transparent border-b-2 border-amber focus:outline-none"
                       />
                       <span className="font-display font-black text-xl opacity-40 uppercase">kVAr</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-4xl font-black text-text">{selectedRating}</span>
                      <span className="font-display font-black text-xl opacity-30 uppercase">kVAr</span>
                    </div>
                  )}
                  <p className="text-[10px] text-text-dim mt-4 uppercase font-bold tracking-tight">
                    {isEditing ? 'Custom Input Enabled' : `Regressive Mode: ₹${(selectedPrice / (selectedRating || 1)).toFixed(0)}/unit`}
                  </p>
                </div>

                <div className={cn(
                  "p-8 rounded-[2rem] transition-all",
                  isEditing ? "bg-white border-2 border-amber shadow-xl" : "bg-bg border border-border/50"
                )}>
                  <span className="data-label">Unit List Price (APFC)</span>
                  {isEditing ? (
                    <div className="flex items-baseline gap-2">
                       <span className="font-display font-black text-2xl opacity-40">₹</span>
                       <input 
                         type="number" 
                         value={selectedPrice}
                         onChange={(e) => handlePriceChange(Number(e.target.value))}
                         className="w-full font-mono text-3xl font-black bg-transparent border-b-2 border-amber focus:outline-none"
                       />
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-black text-2xl opacity-30">₹</span>
                      <span className="font-mono text-4xl font-black text-text">{selectedPrice.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[10px] text-text-dim uppercase font-bold tracking-tight">
                      Estimated ROI: 6-11 months
                    </p>
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                      pricingStatus === 'AI Estimated' ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {pricingStatus}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventory dropdown when not editing and not custom */}
              {!isEditing && (
                <div className="mt-8 grid grid-cols-5 gap-2">
                  {CATALOG.map(p => (
                    <button
                      key={p.rating}
                      onClick={() => {
                        setSelectedRating(p.rating);
                        setSelectedPrice(p.price);
                        setPricingStatus('AI Estimated');
                      }}
                      className={cn(
                        "py-3 px-1 rounded-xl border text-[10px] font-black transition-all",
                        selectedRating === p.rating 
                          ? "bg-amber border-amber text-white shadow-lg" 
                          : "bg-white border-border text-text-dim hover:border-amber/40"
                      )}
                    >
                      {p.rating}K
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right side: Final Quote */}
            <div className="lg:col-span-5">
               <div className="bg-text rounded-[2rem] p-10 text-white shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-6 opacity-60">
                      <FileDigit className="w-4 h-4" />
                      <span className="text-[10px] uppercase font-black tracking-[4px]">Investment Total</span>
                    </div>
                    
                    <div className="mb-4">
                      <span className="text-2xl font-display font-bold opacity-40 block mb-1">Estimated Cost</span>
                      <span className="text-6xl font-mono font-black italic tracking-tighter">
                        ₹{selectedPrice.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-4 bg-white/10 rounded-2xl border border-white/10 mt-6">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] uppercase font-bold opacity-60">Panel Size</span>
                          <span className="font-mono font-bold">{selectedRating} kVAr</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-bold opacity-60">Configuration</span>
                          <span className="font-mono font-bold">{data.load_type === 'leading' ? 'Static/Dynamic Mixed' : 'Automatic Steps'}</span>
                       </div>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-4">
                    <button 
                      onClick={handleDownloadQuote}
                      className="w-full py-5 bg-white text-text rounded-[1.5rem] font-display font-black uppercase tracking-[3px] shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 group"
                    >
                      <FileText className="w-5 h-5 text-accent group-hover:scale-110 transition-transform" />
                      Generate Quote
                    </button>
                    <button 
                      onClick={handleExportExcel}
                      className="w-full py-5 bg-accent text-white rounded-[1.5rem] font-display font-black uppercase tracking-[3px] shadow-xl hover:shadow-2xl shadow-accent/20 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 group"
                    >
                      <TableProperties className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                      Excel Analytics
                    </button>
                    <p className="text-center text-[10px] uppercase opacity-40 font-bold tracking-[2px] mt-2">
                      *Taxes and Installation extra
                    </p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel 07: Saving Analysis */}
      <div id="saving-panel" className="panel lg:col-span-2 border-success/20 bg-success-50/5">
        <div className="panel-header text-success bg-success-50/30 border-success-100">
           <TrendingUp className="w-4 h-4" />
           07. Projected Financial Saving Analysis
        </div>
        <div className="p-10">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="p-6 bg-white border border-border rounded-3xl">
                 <span className="data-label block mb-2">Saving Summary</span>
                 <div className="flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-bold text-success">{row2_savingKVAhMonth.toFixed(0)}</span>
                    <span className="text-xs font-bold text-text-dim uppercase">kVAh/mo</span>
                 </div>
                 <p className="text-[10px] text-text-dim mt-2 uppercase font-black tracking-tighter">Efficiency Gain</p>
              </div>

              <div className="p-6 bg-white border border-border rounded-3xl">
                 <span className="data-label block mb-2">Monthly Saving</span>
                 <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-success/40">₹</span>
                    <span className="font-mono text-3xl font-bold text-success">{row4_savingRsMonth.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                 </div>
                 <p className="text-[10px] text-text-dim mt-2 uppercase font-black tracking-tighter">Recovery Rate</p>
              </div>

              <div className="p-6 bg-white border border-border rounded-3xl">
                 <span className="data-label block mb-2">Annual Saving</span>
                 <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-success/40">₹</span>
                    <span className="font-mono text-3xl font-bold text-success">{row5_savingRsYear.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                 </div>
                 <p className="text-[10px] text-text-dim mt-2 uppercase font-black tracking-tighter">Yearly Impact</p>
              </div>

              <div className="p-6 bg-text text-white rounded-3xl shadow-xl">
                 <span className="text-[10px] uppercase font-black tracking-widest opacity-60 block mb-2">Payback Period</span>
                 <div className="flex items-baseline gap-1">
                    <span className="font-mono text-4xl font-black">{paybackMonths.toFixed(1)}</span>
                    <span className="text-sm font-bold opacity-40 uppercase">Months</span>
                 </div>
                 <p className="text-[10px] opacity-40 mt-2 uppercase font-black tracking-tighter">ROI Velocity</p>
              </div>
           </div>

           <div className="mt-8 p-6 bg-bg border border-border/50 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                    <Percent className="w-6 h-6 text-accent" />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-text mb-1">Mathematical Verification</h4>
                    <p className="text-[11px] text-text-dim">Actual kVAh vs kWh Discrepancy Correction @ 0.99 Target PF</p>
                 </div>
              </div>
              <div className="font-mono text-[11px] text-text-dim bg-white px-6 py-3 rounded-full border border-border text-center">
                 Tariff formula: (₹{totalBill.toLocaleString()} - ₹{demandCharges.toLocaleString()}) ÷ {totalKWh} kWh = ₹{row3_tariffRate.toFixed(2)}/unit
              </div>
           </div>
        </div>
      </div>

    </motion.div>
  );
};
