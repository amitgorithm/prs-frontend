/**
 * =============================================
 * PDF GENERATOR
 * Generates clinical assessment PDF reports
 * using jsPDF library
 * =============================================
 */

import * as StateManager from './stateManager.js';

// jsPDF will be loaded from CDN
let jsPDF = null;

// Scales where higher score = better outcome
const HIGHER_IS_BETTER_SCALES = [
    'ALSFRS-R', 'AMTS', 'Barthel-Index', 'IADL', 'KPS', 'MRC', 
    'SS-QOL', 'MSQ', 'EQ-5D-5L', 'GPCOG'
];

/**
 * Check if higher score is better for a scale
 */
function isHigherBetter(scaleId) {
    return HIGHER_IS_BETTER_SCALES.includes(scaleId);
}

/**
 * Initialize jsPDF from global scope (loaded via CDN)
 */
function initJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) {
        jsPDF = window.jspdf.jsPDF;
        return true;
    }
    console.error('jsPDF not loaded. Please ensure the library is included.');
    return false;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get severity color for PDF
 */
function getSeverityColor(level) {
    const colors = {
        minimal: [34, 197, 94],      // Green
        mild: [132, 204, 22],        // Light green
        moderate: [234, 179, 8],     // Yellow
        'moderately-severe': [249, 115, 22], // Orange
        severe: [239, 68, 68],       // Red
        unknown: [148, 163, 184]     // Gray
    };
    return colors[level] || colors.unknown;
}

/**
 * Generate the PDF report
 * 
 * @param {Object} options - Generation options
 * @returns {Promise<Blob>} PDF blob
 */
export async function generateReport(options = {}) {
    if (!initJsPDF()) {
        throw new Error('PDF library not available');
    }
    
    const state = StateManager.getState();
    const scores = StateManager.getAllScores();
    const riskFlags = StateManager.getRiskFlags();
    
    // Create PDF document
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;
    
    // ========================================
    // HEADER
    // ========================================
    
    // Sozo orange header bar
    doc.setFillColor(244, 121, 32);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PRS Assessment Report', margin, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sozo Brain Center — Patient Rating System', margin, 27);
    
    y = 50;
    
    // ========================================
    // PATIENT INFORMATION
    // ========================================
    
    doc.setTextColor(30, 41, 59); // Gray-800
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Information', margin, y);
    y += 8;
    
    // Info box
    doc.setDrawColor(226, 232, 240); // Gray-200
    doc.setFillColor(248, 250, 252); // Gray-50
    doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'FD');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Gray-500
    
    const col1 = margin + 5;
    const col2 = margin + 70;
    
    y += 8;
    doc.text('Patient ID:', col1, y);
    doc.text('Assessment Date:', col2, y);
    
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    y += 5;
    doc.text(state.patient_id || 'N/A', col1, y);
    doc.text(formatDate(state.session_start), col2, y);
    
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Condition:', col1, y);
    
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    y += 5;
    doc.text(state.conditionLabel || state.condition || 'N/A', col1, y);
    
    y += 15;
    
    // ========================================
    // SCALES ADMINISTERED
    // ========================================
    
    const scaleIds = Object.keys(scores);
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Scales Administered', margin, y);
    y += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // Gray-600
    
    // List scale names in a comma-separated format
    const scaleNames = scaleIds.map(id => scores[id].scaleName || id);
    const scaleListText = scaleNames.join(', ');
    
    // Wrap text if too long
    const splitText = doc.splitTextToSize(scaleListText, contentWidth);
    doc.text(splitText, margin, y);
    y += splitText.length * 4 + 8;
    
    // ========================================
    // SCALE RESULTS - 2-COLUMN GRID LAYOUT
    // ========================================
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Assessment Results', margin, y);
    y += 10;
    
    // scaleIds already declared above for "Scales Administered" section
    const colWidth = (contentWidth - 5) / 2; // Two columns with 5mm gap
    const boxHeight = 28;
    let col = 0; // 0 = left, 1 = right
    let rowStartY = y;
    
    scaleIds.forEach((scaleId, index) => {
        const score = scores[scaleId];
        
        // Check if we need a new page
        if (rowStartY > pageHeight - 45) {
            doc.addPage();
            rowStartY = margin;
            y = margin;
            col = 0;
        }
        
        // Calculate box position
        const boxX = margin + (col * (colWidth + 5));
        const boxY = rowStartY;
        
        // Draw box
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(boxX, boxY, colWidth, boxHeight, 2, 2, 'FD');
        
        // Scale name (truncate if too long)
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        let scaleName = score.scaleName || scaleId;
        if (scaleName.length > 30) scaleName = scaleName.substring(0, 28) + '...';
        doc.text(scaleName, boxX + 4, boxY + 7);
        
        // Score - large and prominent
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const scoreText = `${score.total}`;
        const scoreTextWidth = doc.getTextWidth(scoreText); // Measure at font size 16
        doc.text(scoreText, boxX + 4, boxY + 18);
        
        // Max score
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        const maxText = `/ ${score.maxPossible}`;
        doc.text(maxText, boxX + 4 + scoreTextWidth + 1, boxY + 18);
        
        // Score direction indicator (higher = better or worse)
        const maxTextWidth = doc.getTextWidth(maxText);
        const directionX = boxX + 4 + scoreTextWidth + 1 + maxTextWidth + 3;
        doc.setFontSize(7);
        if (isHigherBetter(scaleId)) {
            doc.setTextColor(34, 197, 94); // Green
            doc.text('(↑ better)', directionX, boxY + 18);
        } else {
            doc.setTextColor(239, 68, 68); // Red
            doc.text('(↑ worse)', directionX, boxY + 18);
        }
        
        // Severity badge on the right side
        const severityColor = getSeverityColor(score.severity?.level);
        doc.setFillColor(...severityColor);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        
        const severityLabel = score.severity?.label || 'N/A';
        const badgeWidth = Math.min(doc.getTextWidth(severityLabel) + 6, colWidth - 10);
        doc.roundedRect(boxX + colWidth - badgeWidth - 4, boxY + 4, badgeWidth, 5, 1.5, 1.5, 'F');
        doc.text(severityLabel, boxX + colWidth - badgeWidth - 1, boxY + 7.5);
        
        // Percentage bar
        const barWidth = colWidth - 8;
        const barHeight = 3;
        const barY = boxY + 22;
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(boxX + 4, barY, barWidth, barHeight, 1, 1, 'F');
        
        const fillWidth = (score.percentage / 100) * barWidth;
        doc.setFillColor(...severityColor);
        doc.roundedRect(boxX + 4, barY, fillWidth, barHeight, 1, 1, 'F');
        
        // Percentage text
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`${score.percentage}%`, boxX + colWidth - 4 - doc.getTextWidth(`${score.percentage}%`), barY + 2.5);
        
        // Move to next column or next row
        col++;
        if (col >= 2) {
            col = 0;
            rowStartY += boxHeight + 4;
        }
    });
    
    // Reset y position after grid
    if (col === 1) {
        y = rowStartY + boxHeight + 10;
    } else {
        y = rowStartY + 10;
    }
    
    // ========================================
    // FOOTER
    // ========================================
    
    // Add footer to all pages
    const totalPages = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer line
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
        
        // Disclaimer
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
            'This report is generated for clinical reference only. All assessments should be interpreted by qualified healthcare professionals.',
            margin,
            pageHeight - 14
        );
        
        // Page number
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth - margin - 20,
            pageHeight - 14
        );
        
        // Generation timestamp
        doc.text(
            `Generated: ${formatDate(new Date().toISOString())}`,
            margin,
            pageHeight - 9
        );
    }
    
    return doc;
}

/**
 * Download the PDF report
 * 
 * @param {Object} options - Download options
 */
export async function downloadReport(options = {}) {
    try {
        const doc = await generateReport(options);
        const state = StateManager.getState();
        
        // Generate filename using patient ID (which already contains name prefix)
        const date = new Date().toISOString().split('T')[0];
        const patientId = state.patient_id || 'unknown';
        const condition = (state.condition || 'assessment').replace(/\s+/g, '-').toLowerCase();
        const filename = options.filename || `${patientId}_${condition}_${date}.pdf`;
        
        // Download
        doc.save(filename);
        
        return true;
    } catch (error) {
        console.error('Failed to generate PDF:', error);
        throw error;
    }
}

/**
 * Get PDF as blob for preview or other uses
 * 
 * @param {Object} options - Generation options
 * @returns {Promise<Blob>} PDF blob
 */
export async function getReportBlob(options = {}) {
    const doc = await generateReport(options);
    return doc.output('blob');
}

/**
 * Get PDF as data URI
 * 
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Data URI
 */
export async function getReportDataUri(options = {}) {
    const doc = await generateReport(options);
    return doc.output('datauristring');
}

// Export PDF generator
export default {
    generateReport,
    downloadReport,
    getReportBlob,
    getReportDataUri
};
