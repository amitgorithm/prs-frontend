/**
 * =============================================
 * PRS MAIN APPLICATION
 * Main controller for the Patient Rating System
 * =============================================
 */

import * as StateManager from './stateManager.js';
import * as ScaleEngine from './scaleEngine.js';
import * as PDFGenerator from './pdfGenerator.js';

// ========================================
// APPLICATION STATE
// ========================================

let conditionMap = {};
let currentScale = null;
let scales = {};  // Cache loaded scales

// ========================================
// DOM ELEMENT REFERENCES
// ========================================

const elements = {
    // Screens
    screenPatient: document.getElementById('screenPatient'),
    screenCondition: document.getElementById('screenCondition'),
    screenAssessment: document.getElementById('screenAssessment'),
    screenResults: document.getElementById('screenResults'),
    
    // Patient Entry
    patientName: document.getElementById('patientName'),
    patientIdPreview: document.getElementById('patientIdPreview'),
    generatedPatientId: document.getElementById('generatedPatientId'),
    btnProceedToCondition: document.getElementById('btnProceedToCondition'),
    
    // Condition Selection (New Grid)
    displayPatientName: document.getElementById('displayPatientName'),
    displayPatientId: document.getElementById('displayPatientId'),
    conditionGrid: document.getElementById('conditionGrid'),
    selectedConditionPanel: document.getElementById('selectedConditionPanel'),
    selectedConditionName: document.getElementById('selectedConditionName'),
    selectedConditionDesc: document.getElementById('selectedConditionDesc'),
    scaleCount: document.getElementById('scaleCount'),
    scaleList: document.getElementById('scaleList'),
    btnChangeCondition: document.getElementById('btnChangeCondition'),
    btnStartAssessment: document.getElementById('btnStartAssessment'),
    
    // Assessment - New Layout
    scaleNavList: document.getElementById('scaleNavList'),
    progressPercent: document.getElementById('progressPercent'),
    currentScaleNumber: document.getElementById('currentScaleNumber'),
    totalScales: document.getElementById('totalScales'),
    scaleTitle: document.getElementById('scaleTitle'),
    scaleDescription: document.getElementById('scaleDescription'),
    recallPeriod: document.getElementById('recallPeriod'),
    scoringInfo: document.getElementById('scoringInfo'),
    estimatedTime: document.getElementById('estimatedTime'),
    answeredCount: document.getElementById('answeredCount'),
    totalQuestions: document.getElementById('totalQuestions'),
    scaleInstructions: document.getElementById('scaleInstructions'),
    questionsContainer: document.getElementById('questionsContainer'),
    completionStatus: document.getElementById('completionStatus'),
    btnPrevQuestion: document.getElementById('btnPrevQuestion'),
    btnNextQuestion: document.getElementById('btnNextQuestion'),
    btnDevPrefill: document.getElementById('btnDevPrefill'),
    validationMessage: document.getElementById('validationMessage'),
    
    // Results
    resultPatientId: document.getElementById('resultPatientId'),
    resultDate: document.getElementById('resultDate'),
    resultCondition: document.getElementById('resultCondition'),
    riskFlagsCard: document.getElementById('riskFlagsCard'),
    riskFlagsContent: document.getElementById('riskFlagsContent'),
    scaleResults: document.getElementById('scaleResults'),
    compositeSummary: document.getElementById('compositeSummary'),
    btnDownloadPDF: document.getElementById('btnDownloadPDF'),
    btnDownloadCSV: document.getElementById('btnDownloadCSV'),
    btnNewAssessment: document.getElementById('btnNewAssessment'),
    
    // Header
    btnNewSession: document.getElementById('btnNewSession'),
    btnSettings: document.getElementById('btnSettings'),
    
    // Settings Modal
    modalSettings: document.getElementById('modalSettings'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    settingAutoSave: document.getElementById('settingAutoSave'),
    settingShowNumbers: document.getElementById('settingShowNumbers')
};

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize the application
 */
async function init() {
    console.log('PRS Application Initializing...');
    
    // Load condition map
    await loadConditionMap();
    
    // Initialize state
    StateManager.initSession();
    
    // Setup event listeners
    setupEventListeners();
    
    // Show patient entry screen
    showScreen('patient');
    
    console.log('PRS Application Ready');
}

/**
 * Load condition map from JSON
 */
async function loadConditionMap() {
    try {
        const response = await fetch('data/conditionMap.json');
        conditionMap = await response.json();
        populateConditionGrid();
    } catch (error) {
        console.error('Failed to load condition map:', error);
        showError('Failed to load conditions. Please refresh the page.');
    }
}

/**
 * Generate a patient ID based on name
 * Format: PAT_{first 2-3 letters of name}_{random 6-digit number}
 * @param {string} patientName - The patient's name
 */
function generatePatientId(patientName) {
    // Extract first 2-3 letters from name (only alphabets)
    const letters = patientName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const prefix = letters.substring(0, Math.min(letters.length, 3));
    
    // Generate random 6-digit number
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    
    return `PAT_${prefix}_${randomNum}`;
}

/**
 * Populate condition grid with cards
 */
function populateConditionGrid() {
    elements.conditionGrid.innerHTML = '';
    
    // Icon mapping for conditions
    const iconMap = {
        'depression-anxiety': 'fa-brain',
        'chronic-pain': 'fa-bone',
        'neuropathic-pain': 'fa-bolt-lightning',
        'autonomic-dysfunction': 'fa-heart-pulse',
        'fibromyalgia': 'fa-person-dots-from-line',
        'migraine': 'fa-head-side-virus',
        'ataxia': 'fa-person-walking-with-cane',
        'stroke-tbi': 'fa-heart-pulse',
        'dementia': 'fa-head-side',
        'parkinsons': 'fa-hands-holding',
        'tinnitus': 'fa-ear-listen',
        'insomnia': 'fa-bed',
        'multiple-sclerosis': 'fa-person-cane',
        'adhd': 'fa-bolt',
        'als': 'fa-wheelchair',
        'ibd': 'fa-stomach',
        'autism': 'fa-puzzle-piece',
        'addiction': 'fa-pills',
        'cognitive-screening': 'fa-brain'
    };
    
    Object.entries(conditionMap.conditions || {}).forEach(([id, condition]) => {
        const icon = iconMap[id] || 'fa-stethoscope';
        const card = document.createElement('div');
        card.className = 'condition-card';
        card.dataset.conditionId = id;
        card.innerHTML = `
            <div class="condition-card-check">
                <i class="fas fa-check"></i>
            </div>
            <div class="condition-card-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="condition-card-title">${condition.label}</div>
            <div class="condition-card-scales">${condition.scales.length} scales</div>
        `;
        
        card.addEventListener('click', () => handleConditionCardClick(id, condition));
        elements.conditionGrid.appendChild(card);
    });
}

/**
 * Load a scale from JSON
 */
async function loadScale(scaleId) {
    // Check cache first
    if (scales[scaleId]) {
        return scales[scaleId];
    }
    
    try {
        const response = await fetch(`data/scales/${scaleId}.json`);
        const scale = await response.json();
        scales[scaleId] = scale;
        return scale;
    } catch (error) {
        console.error(`Failed to load scale ${scaleId}:`, error);
        throw error;
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Patient entry
    elements.patientName.addEventListener('input', handlePatientNameInput);
    elements.btnProceedToCondition.addEventListener('click', handleProceedToCondition);
    
    // Condition selection
    elements.btnChangeCondition.addEventListener('click', handleChangeCondition);
    elements.btnStartAssessment.addEventListener('click', handleStartAssessment);
    
    // Navigation
    elements.btnPrevQuestion.addEventListener('click', handlePreviousQuestion);
    elements.btnNextQuestion.addEventListener('click', handleNextQuestion);
    
    // Dev/Debug prefill button
    if (elements.btnDevPrefill) {
        elements.btnDevPrefill.addEventListener('click', devPrefillCurrentScale);
    }
    
    // Results
    elements.btnDownloadPDF.addEventListener('click', handleDownloadPDF);
    elements.btnDownloadCSV.addEventListener('click', handleDownloadCSV);
    elements.btnNewAssessment.addEventListener('click', handleNewAssessment);
    
    // Header actions
    elements.btnNewSession.addEventListener('click', handleNewAssessment);
    elements.btnSettings.addEventListener('click', () => showModal('settings'));
    
    // Settings modal
    elements.btnCloseSettings.addEventListener('click', () => hideModal('settings'));
    elements.settingAutoSave.addEventListener('change', handleSettingsChange);
    elements.settingShowNumbers.addEventListener('change', handleSettingsChange);
    
    // Close modal on overlay click
    elements.modalSettings.addEventListener('click', (e) => {
        if (e.target === elements.modalSettings) {
            hideModal('settings');
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
    
    // Enter key on patient name input
    elements.patientName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !elements.btnProceedToCondition.disabled) {
            handleProceedToCondition();
        }
    });
}

// ========================================
// EVENT HANDLERS
// ========================================

/**
 * Handle patient name input
 */
let currentPatientId = null;

function handlePatientNameInput(e) {
    const name = e.target.value.trim();
    
    if (name.length >= 2) {
        // Generate patient ID based on name (regenerate each time name changes)
        currentPatientId = generatePatientId(name);
        elements.generatedPatientId.textContent = currentPatientId;
        elements.patientIdPreview.classList.remove('hidden');
        elements.btnProceedToCondition.disabled = false;
    } else {
        currentPatientId = null;
        elements.patientIdPreview.classList.add('hidden');
        elements.btnProceedToCondition.disabled = true;
    }
}

/**
 * Handle proceed to condition selection
 */
function handleProceedToCondition() {
    const patientName = elements.patientName.value.trim();
    
    if (!patientName || !currentPatientId) {
        return;
    }
    
    // Store patient info in state
    StateManager.setPatientInfo(currentPatientId, patientName);
    
    // Update condition screen display
    elements.displayPatientName.textContent = patientName;
    elements.displayPatientId.textContent = currentPatientId;
    
    // Show condition screen
    showScreen('condition');
}

/**
 * Handle condition card click
 */
let selectedConditionId = null;

function handleConditionCardClick(conditionId, condition) {
    // Remove selection from all cards
    document.querySelectorAll('.condition-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Select clicked card
    const clickedCard = document.querySelector(`[data-condition-id="${conditionId}"]`);
    if (clickedCard) {
        clickedCard.classList.add('selected');
    }
    
    // Store selection
    selectedConditionId = conditionId;
    
    // Update panel info
    elements.selectedConditionName.textContent = condition.label;
    elements.selectedConditionDesc.textContent = condition.description || '';
    elements.scaleCount.textContent = condition.scales.length;
    
    // Populate scale list
    elements.scaleList.innerHTML = '';
    condition.scales.forEach(scaleId => {
        const li = document.createElement('li');
        const metadata = conditionMap.scaleMetadata?.[scaleId];
        li.textContent = metadata?.name || scaleId;
        elements.scaleList.appendChild(li);
    });
    
    // Show panel
    elements.selectedConditionPanel.classList.remove('hidden');
    
    // Scroll panel into view
    elements.selectedConditionPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Set condition in state
    StateManager.setCondition(conditionId, condition.label, condition.scales);
}

/**
 * Handle change condition button
 */
function handleChangeCondition() {
    // Remove selection from all cards
    document.querySelectorAll('.condition-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Hide panel
    elements.selectedConditionPanel.classList.add('hidden');
    selectedConditionId = null;
}
/**
 * Handle start assessment button click
 */
async function handleStartAssessment() {
    const state = StateManager.getState();
    
    if (!state.condition || state.scaleOrder.length === 0) {
        showError('Please select a condition first.');
        return;
    }
    
    // Load the first scale
    try {
        await loadCurrentScale();
        showScreen('assessment');
    } catch (error) {
        console.error('Failed to load assessment:', error);
        showError('Failed to load assessment. Please try again.');
    }
}

/**
 * Load and prepare current scale - renders ALL questions at once
 */
async function loadCurrentScale() {
    console.log('loadCurrentScale: Starting...');
    const state = StateManager.getState();
    console.log('loadCurrentScale: State:', state);
    const scaleId = state.scaleOrder[state.currentScaleIndex];
    console.log('loadCurrentScale: Loading scale:', scaleId);
    
    currentScale = await loadScale(scaleId);
    console.log('loadCurrentScale: Scale loaded:', currentScale?.name);
    
    // Update scale navigation sidebar
    renderScaleNavigation();
    console.log('loadCurrentScale: Navigation rendered');
    
    // Update scale header info
    elements.currentScaleNumber.textContent = state.currentScaleIndex + 1;
    elements.totalScales.textContent = `of ${state.scaleOrder.length}`;
    elements.scaleTitle.textContent = currentScale.name;
    elements.scaleDescription.textContent = currentScale.description || '';
    
    // Meta info
    elements.recallPeriod.textContent = currentScale.recallPeriod || 'Current';
    elements.scoringInfo.textContent = getScoringDescription(currentScale);
    elements.estimatedTime.textContent = currentScale.estimatedTime || currentScale.timeToComplete || '~5 min';
    elements.totalQuestions.textContent = currentScale.questions.length;
    console.log('loadCurrentScale: Header updated');
    
    // Instructions
    if (currentScale.instructions) {
        elements.scaleInstructions.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <p>${currentScale.instructions}</p>
        `;
        elements.scaleInstructions.style.display = 'flex';
    } else {
        elements.scaleInstructions.style.display = 'none';
    }
    
    // Render ALL questions for this scale
    renderAllQuestions();
    console.log('loadCurrentScale: Questions rendered');
    
    // Update progress
    updateProgress();
    console.log('loadCurrentScale: Complete');
}

/**
 * Get scoring description for display
 */
function getScoringDescription(scale) {
    const type = scale.scoringType || 'sum';
    const max = scale.maxScore;
    
    switch (type) {
        case 'sum':
            return `Sum scoring (0-${max || '?'})`;
        case 'subscale-sum':
            return 'Subscale scoring';
        case 'component-sum':
            return `${scale.componentCount || 7} component scoring`;
        case 'profile-and-vas':
            return 'Health profile + VAS';
        case 'weighted-binary':
            return 'Weighted binary scoring';
        case 'clinician':
            return 'Clinician-rated';
        default:
            return max ? `Score range: 0-${max}` : 'Standard scoring';
    }
}

/**
 * Render scale navigation sidebar
 */
function renderScaleNavigation() {
    const state = StateManager.getState();
    
    let html = '';
    state.scaleOrder.forEach((scaleId, index) => {
        const scaleMeta = conditionMap.scaleMetadata?.[scaleId] || { name: scaleId };
        const isActive = index === state.currentScaleIndex;
        const isCompleted = index < state.currentScaleIndex;
        const responses = StateManager.getScaleResponses(scaleId);
        const answeredCount = Object.keys(responses || {}).length;
        
        let status = 'pending';
        if (isCompleted) status = 'completed';
        else if (isActive) status = 'active';
        
        html += `
            <div class="scale-nav-item ${status}" data-scale-index="${index}">
                <div class="nav-item-indicator">
                    ${isCompleted ? '<i class="fas fa-check"></i>' : (index + 1)}
                </div>
                <div class="nav-item-content">
                    <span class="nav-item-name">${scaleId}</span>
                    <span class="nav-item-full">${scaleMeta.name}</span>
                </div>
            </div>
        `;
    });
    
    elements.scaleNavList.innerHTML = html;
    
    // Update progress percentage
    const progress = Math.round((state.currentScaleIndex / state.scaleOrder.length) * 100);
    elements.progressPercent.textContent = `${progress}%`;
}

/**
 * Render ALL questions for current scale
 */
function renderAllQuestions() {
    const state = StateManager.getState();
    const scaleId = state.scaleOrder[state.currentScaleIndex];
    const showNumbers = state.settings.showQuestionNumbers;
    
    let html = '';
    let currentGroup = null;
    
    currentScale.questions.forEach((question, index) => {
        const savedResponse = StateManager.getResponse(scaleId, index);
        const isAnswered = savedResponse !== undefined && savedResponse !== null && savedResponse !== '';
        
        // Group header if applicable
        if (question.groupLabel && question.group !== currentGroup) {
            currentGroup = question.group;
            html += `<div class="question-group-header">${question.groupLabel}</div>`;
        }
        
        // Get question text
        const questionText = question.question || question.text || question.label || 'Question';
        
        html += `
            <div class="question-card ${isAnswered ? 'answered' : ''}" data-question-index="${index}" id="question-${index}">
                <div class="question-header">
                    ${showNumbers ? `<span class="question-number">${index + 1}</span>` : ''}
                    <span class="question-text">${questionText}</span>
                    ${isAnswered ? '<i class="fas fa-check-circle answered-icon"></i>' : ''}
                </div>
                <div class="question-options">
                    ${renderQuestionOptions(question, savedResponse, scaleId, index)}
                </div>
            </div>
        `;
    });
    
    elements.questionsContainer.innerHTML = html;
    
    // Attach all event handlers
    attachAllHandlers();
    
    // Update answered count
    updateAnsweredCount();
}

/**
 * Render question options based on type
 */
function renderQuestionOptions(question, savedResponse, scaleId, questionIndex) {
    switch (question.type) {
        case 'time':
            return renderTimeInput(question, savedResponse, questionIndex);
        case 'number':
            return renderNumberInput(question, savedResponse, questionIndex);
        case 'text':
            return renderTextInput(question, savedResponse, questionIndex);
        case 'visual-analogue-scale':
            return renderVASInput(question, savedResponse, questionIndex);
        default:
            return renderOptionsGrid(question, savedResponse, scaleId, questionIndex);
    }
}

/**
 * Render options as a horizontal grid
 */
function renderOptionsGrid(question, savedResponse, scaleId, questionIndex) {
    if (!question.options) return '';
    
    const isCompact = question.options.length <= 5;
    
    let html = `<div class="options-grid ${isCompact ? 'compact' : 'expanded'}">`;
    
    question.options.forEach((option, optIndex) => {
        const value = option.value !== undefined ? option.value : optIndex;
        const label = option.label || option;
        const isSelected = savedResponse !== undefined && savedResponse == value;
        const points = option.points !== undefined ? option.points : value;
        
        html += `
            <label class="option-card ${isSelected ? 'selected' : ''}" data-value="${value}" data-question="${questionIndex}">
                <input type="radio" name="q${questionIndex}" value="${value}" ${isSelected ? 'checked' : ''}>
                <span class="option-label">${label}</span>
                ${currentScale.isClinician !== true && question.showScore !== false ? 
                    `<span class="option-score">${points}</span>` : ''}
            </label>
        `;
    });
    
    html += '</div>';
    return html;
}

/**
 * Attach event handlers for all questions
 */
function attachAllHandlers() {
    const state = StateManager.getState();
    const scaleId = state.scaleOrder[state.currentScaleIndex];
    
    // Option cards (radio buttons)
    document.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const questionIndex = parseInt(card.dataset.question);
            const value = card.dataset.value;
            
            // Update visual selection
            const questionCard = card.closest('.question-card');
            questionCard.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            card.querySelector('input').checked = true;
            
            // Mark question as answered
            questionCard.classList.add('answered');
            const answeredIcon = questionCard.querySelector('.answered-icon');
            if (!answeredIcon) {
                questionCard.querySelector('.question-header').insertAdjacentHTML('beforeend', 
                    '<i class="fas fa-check-circle answered-icon"></i>');
            }
            
            // Record response
            StateManager.recordResponse(scaleId, questionIndex, value);
            
            // Update count
            updateAnsweredCount();
        });
    });
    
    // Text/number/time inputs
    document.querySelectorAll('.question-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const questionIndex = parseInt(input.dataset.question);
            const value = input.value;
            
            const questionCard = input.closest('.question-card');
            if (value) {
                questionCard.classList.add('answered');
            } else {
                questionCard.classList.remove('answered');
            }
            
            StateManager.recordResponse(scaleId, questionIndex, value);
            updateAnsweredCount();
        });
    });
    
    // VAS sliders
    document.querySelectorAll('.vas-input').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const questionIndex = parseInt(slider.dataset.question);
            const value = slider.value;
            
            // Update display
            const display = slider.parentElement.querySelector('.vas-value');
            if (display) display.textContent = value;
            
            const questionCard = slider.closest('.question-card');
            questionCard.classList.add('answered');
            
            StateManager.recordResponse(scaleId, questionIndex, value);
            updateAnsweredCount();
        });
    });
}

/**
 * Update answered question count
 */
function updateAnsweredCount() {
    const state = StateManager.getState();
    const scaleId = state.scaleOrder[state.currentScaleIndex];
    const responses = StateManager.getScaleResponses(scaleId);
    const answeredCount = Object.keys(responses || {}).length;
    const totalQuestions = currentScale.questions.length;
    
    elements.answeredCount.textContent = answeredCount;
    
    // Update completion status
    if (answeredCount >= totalQuestions) {
        elements.completionStatus.innerHTML = `
            <span class="status-complete"><i class="fas fa-check-circle"></i> All questions answered</span>
        `;
        elements.btnNextQuestion.classList.remove('btn-disabled');
    } else {
        elements.completionStatus.innerHTML = `
            <span class="status-incomplete"><i class="fas fa-exclamation-circle"></i> ${totalQuestions - answeredCount} questions remaining</span>
        `;
    }
    
    // Update sidebar progress
    renderScaleNavigation();
}

/**
 * Update overall progress
 */
function updateProgress() {
    const state = StateManager.getState();
    const progress = Math.round((state.currentScaleIndex / state.scaleOrder.length) * 100);
    elements.progressPercent.textContent = `${progress}%`;
    
    updateNavigationButtons();
}

/**
 * Render the current question
 */
function renderCurrentQuestion() {
    const state = StateManager.getState();
    const question = currentScale.questions[state.currentQuestionIndex];
    
    if (!question) {
        console.error('Question not found');
        return;
    }
    
    const showNumbers = state.settings.showQuestionNumbers;
    const scaleId = state.scaleOrder[state.currentScaleIndex];
    const savedResponse = StateManager.getResponse(scaleId, state.currentQuestionIndex);
    
    // Determine question text - check 'question', 'text', and 'label' fields
    const questionText = question.question || question.text || question.label || 'Question text not available';
    
    // Check if this is part of a group and if it's the first in the group
    let groupHeader = '';
    if (question.groupLabel) {
        const prevQuestion = currentScale.questions[state.currentQuestionIndex - 1];
        if (!prevQuestion || prevQuestion.group !== question.group) {
            groupHeader = `<div class="question-group-label">${question.groupLabel}</div>`;
        }
    }
    
    let html = `
        ${groupHeader}
        <div class="question-text">
            ${showNumbers ? `<span class="question-number">${state.currentQuestionIndex + 1}</span>` : ''}
            ${questionText}
        </div>
    `;
    
    // Render based on question type
    switch (question.type) {
        case 'time':
            html += renderTimeInput(question, savedResponse);
            break;
        case 'number':
            html += renderNumberInput(question, savedResponse);
            break;
        case 'text':
            html += renderTextInput(question, savedResponse);
            break;
        case 'visual-analogue-scale':
            html += renderVASInput(question, savedResponse);
            break;
        case 'likert-with-text':
            html += renderLikertWithText(question, savedResponse, scaleId, state.currentQuestionIndex);
            break;
        default:
            // Default: likert, single-choice, binary, etc.
            html += renderOptionsInput(question, savedResponse, scaleId, state.currentQuestionIndex);
    }
    
    elements.questionContainer.innerHTML = html;
    
    // Attach event handlers based on question type
    attachInputHandlers(question, scaleId, state.currentQuestionIndex);
    
    // Update progress
    updateProgressBars();
    updateNavigationButtons();
}

/**
 * Render time input
 */
function renderTimeInput(question, savedResponse, questionIndex) {
    return `
        <div class="input-container">
            <input type="text" 
                   class="form-input question-input time-input" 
                   data-question="${questionIndex}"
                   placeholder="${question.placeholder || 'e.g., 11:00 PM'}"
                   value="${savedResponse || ''}"
                   autocomplete="off">
            <div class="input-hint">Enter time (e.g., 10:30 PM or 22:30)</div>
        </div>
    `;
}

/**
 * Render number input
 */
function renderNumberInput(question, savedResponse, questionIndex) {
    return `
        <div class="input-container">
            <div class="number-input-wrapper">
                <input type="number" 
                       class="form-input question-input number-input" 
                       data-question="${questionIndex}"
                       min="${question.min !== undefined ? question.min : ''}"
                       max="${question.max !== undefined ? question.max : ''}"
                       step="${question.step || 1}"
                       value="${savedResponse || ''}"
                       autocomplete="off">
                ${question.unit ? `<span class="input-unit">${question.unit}</span>` : ''}
            </div>
            ${question.min !== undefined || question.max !== undefined ? 
                `<div class="input-hint">Range: ${question.min || 0} - ${question.max || '∞'}</div>` : ''}
        </div>
    `;
}

/**
 * Render text input
 */
function renderTextInput(question, savedResponse, questionIndex) {
    return `
        <div class="input-container">
            <textarea class="form-input question-input text-input" 
                      data-question="${questionIndex}"
                      placeholder="${question.placeholder || 'Enter your response...'}"
                      rows="3">${savedResponse || ''}</textarea>
        </div>
    `;
}

/**
 * Render Visual Analogue Scale
 */
function renderVASInput(question, savedResponse, questionIndex) {
    const min = question.minValue || 0;
    const max = question.maxValue || 100;
    const value = savedResponse !== undefined ? savedResponse : 50;
    
    return `
        <div class="vas-input-container">
            <div class="vas-labels">
                <span class="vas-min-label">${question.minLabel || min}</span>
                <span class="vas-max-label">${question.maxLabel || max}</span>
            </div>
            <input type="range" 
                   class="vas-input" 
                   data-question="${questionIndex}"
                   min="${min}" 
                   max="${max}" 
                   value="${value}">
            <div class="vas-value-display">
                <span class="vas-value">${value}</span>
            </div>
        </div>
    `;
}

/**
 * Render likert with optional text field
 */
function renderLikertWithText(question, savedResponse, scaleId, questionIndex) {
    let html = renderOptionsInput(question, savedResponse?.value || savedResponse, scaleId, questionIndex);
    
    if (question.textField) {
        html += `
            <div class="additional-text-container">
                <label class="form-label">${question.textField.label || 'Please describe:'}</label>
                <textarea class="form-input text-input" 
                          id="additionalText"
                          placeholder="${question.textField.placeholder || 'Enter additional details...'}"
                          rows="2">${savedResponse?.text || ''}</textarea>
            </div>
        `;
    }
    
    return html;
}

/**
 * Render options (likert, single-choice, binary)
 */
function renderOptionsInput(question, savedResponse, scaleId, questionIndex) {
    if (!question.options) return '';
    
    let html = '<div class="response-options">';
    
    question.options.forEach((option, index) => {
        const value = option.value !== undefined ? option.value : index;
        const label = option.label || option;
        const isSelected = savedResponse !== undefined && savedResponse == value;
        const points = option.points !== undefined ? option.points : value;
        
        html += `
            <label class="response-option ${isSelected ? 'selected' : ''}" data-value="${value}">
                <input type="radio" name="response" value="${value}" ${isSelected ? 'checked' : ''}>
                <span class="radio-custom"></span>
                <span class="response-label">
                    <span class="response-text">${label}</span>
                    ${question.showScore !== false && currentScale.isClinician !== true ? 
                        `<span class="response-score">Score: ${points}</span>` : ''}
                </span>
            </label>
        `;
    });
    
    html += '</div>';
    return html;
}

/**
 * Attach event handlers for different input types
 */
function attachInputHandlers(question, scaleId, questionIndex) {
    const input = document.getElementById('responseInput');
    
    switch (question.type) {
        case 'time':
        case 'number':
        case 'text':
            if (input) {
                input.addEventListener('input', (e) => {
                    StateManager.recordResponse(scaleId, questionIndex, e.target.value);
                    elements.validationMessage.classList.add('hidden');
                });
                input.addEventListener('change', (e) => {
                    StateManager.recordResponse(scaleId, questionIndex, e.target.value);
                });
            }
            break;
            
        case 'visual-analogue-scale':
            if (input) {
                const valueDisplay = document.getElementById('vasCurrentValue');
                input.addEventListener('input', (e) => {
                    const value = e.target.value;
                    if (valueDisplay) valueDisplay.textContent = value;
                    StateManager.recordResponse(scaleId, questionIndex, value);
                    elements.validationMessage.classList.add('hidden');
                });
            }
            break;
            
        case 'likert-with-text':
            // Handle both likert options and text field
            const options = elements.questionContainer.querySelectorAll('.response-option');
            const additionalText = document.getElementById('additionalText');
            
            options.forEach(option => {
                option.addEventListener('click', () => {
                    options.forEach(o => o.classList.remove('selected'));
                    option.classList.add('selected');
                    option.querySelector('input').checked = true;
                    
                    const value = option.dataset.value;
                    const text = additionalText ? additionalText.value : '';
                    StateManager.recordResponse(scaleId, questionIndex, { value, text });
                    elements.validationMessage.classList.add('hidden');
                });
            });
            
            if (additionalText) {
                additionalText.addEventListener('input', (e) => {
                    const selectedOption = elements.questionContainer.querySelector('.response-option.selected');
                    const value = selectedOption ? selectedOption.dataset.value : null;
                    StateManager.recordResponse(scaleId, questionIndex, { value, text: e.target.value });
                });
            }
            break;
            
        default:
            // Standard options click handlers
            const standardOptions = elements.questionContainer.querySelectorAll('.response-option');
            standardOptions.forEach(option => {
                option.addEventListener('click', () => {
                    standardOptions.forEach(o => o.classList.remove('selected'));
                    option.classList.add('selected');
                    option.querySelector('input').checked = true;
                    
                    const value = option.dataset.value;
                    StateManager.recordResponse(scaleId, questionIndex, value);
                    elements.validationMessage.classList.add('hidden');
                });
            });
    }
}

/**
 * Update progress bars
 */
function updateProgressBars() {
    const state = StateManager.getState();
    
    // Overall progress (across all scales)
    const totalScales = state.scaleOrder.length;
    const completedScales = state.currentScaleIndex;
    const scaleProgress = currentScale ? state.currentQuestionIndex / currentScale.questions.length : 0;
    const overallProgress = ((completedScales + scaleProgress) / totalScales) * 100;
    elements.overallProgress.style.width = `${overallProgress}%`;
    
    // Question progress (within current scale)
    if (currentScale) {
        const questionProgress = ((state.currentQuestionIndex + 1) / currentScale.questions.length) * 100;
        elements.questionProgress.style.width = `${questionProgress}%`;
        elements.questionCounter.textContent = `Question ${state.currentQuestionIndex + 1} of ${currentScale.questions.length}`;
    }
}

/**
 * Update navigation button states
 */
function updateNavigationButtons() {
    const state = StateManager.getState();
    
    // Previous button
    const isFirstQuestion = state.currentScaleIndex === 0 && state.currentQuestionIndex === 0;
    elements.btnPrevQuestion.disabled = isFirstQuestion;
    
    // Next button text
    const isLastQuestion = currentScale && state.currentQuestionIndex >= currentScale.questions.length - 1;
    const isLastScale = state.currentScaleIndex >= state.scaleOrder.length - 1;
    
    if (isLastQuestion && isLastScale) {
        elements.btnNextQuestion.innerHTML = 'Complete <i class="fas fa-check"></i>';
    } else if (isLastQuestion) {
        elements.btnNextQuestion.innerHTML = 'Next Scale <i class="fas fa-arrow-right"></i>';
    } else {
        elements.btnNextQuestion.innerHTML = 'Next Scale <i class="fas fa-arrow-right"></i>';
    }
}

/**
 * Handle previous scale button
 */
function handlePreviousQuestion() {
    const state = StateManager.getState();
    
    if (state.currentScaleIndex > 0) {
        // Go to previous scale
        StateManager.updateState({
            currentScaleIndex: state.currentScaleIndex - 1
        });
        loadCurrentScale();
        // Scroll to top
        elements.questionsContainer.scrollTop = 0;
    }
}

/**
 * Handle next scale button
 */
async function handleNextQuestion() {
    try {
        const state = StateManager.getState();
        const scaleId = state.scaleOrder[state.currentScaleIndex];
        console.log('handleNextQuestion - current scale:', scaleId, 'index:', state.currentScaleIndex);
        
    // Check if all questions are answered
    const responses = StateManager.getScaleResponses(scaleId) || {};
    const answeredCount = Object.keys(responses).length;
    const totalQuestions = currentScale.questions.length;
    
    // Find unanswered questions (only required ones)
    const unansweredRequired = currentScale.questions.filter((q, idx) => {
        const isRequired = q.required !== false;
        return isRequired && responses[idx] === undefined;
    });
    
    if (unansweredRequired.length > 0) {
        // Show validation and scroll to first unanswered
        elements.validationMessage.classList.remove('hidden');
        setTimeout(() => elements.validationMessage.classList.add('hidden'), 3000);
        
        // Scroll to first unanswered question
        const firstUnanswered = document.querySelector(`.question-card:not(.answered)`);
        if (firstUnanswered) {
            firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstUnanswered.classList.add('highlight');
            setTimeout(() => firstUnanswered.classList.remove('highlight'), 2000);
        }
        return;
    }
    
    elements.validationMessage.classList.add('hidden');
    
    // Calculate score for current scale
    console.log('Calculating score for', scaleId);
    ScaleEngine.calculateScore(scaleId, responses, currentScale);
    console.log('Score calculated successfully');
    
    const isLastScale = state.currentScaleIndex >= state.scaleOrder.length - 1;
    
    if (isLastScale) {
        // Assessment complete - show results
        showResults();
    } else {
        // Move to next scale
        console.log('Moving to next scale...');
        StateManager.moveToNextScale();
        await loadCurrentScale();
        console.log('Next scale loaded successfully');
        // Scroll to top
        elements.questionsContainer.scrollTop = 0;
    }
    } catch (error) {
        console.error('Error in handleNextQuestion:', error);
        showError('Error moving to next scale: ' + error.message);
    }
}

/**
 * Handle keyboard navigation
 */
function handleKeyboardNavigation(e) {
    // Only handle in assessment screen
    if (!elements.screenAssessment.classList.contains('active')) return;
    
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNextQuestion();
    } else if (e.key === 'ArrowLeft') {
        handlePreviousQuestion();
    } else if (e.key >= '1' && e.key <= '9') {
        // Number key to select option
        const options = elements.questionContainer.querySelectorAll('.response-option');
        const index = parseInt(e.key) - 1;
        if (options[index]) {
            options[index].click();
        }
    }
}

/**
 * Show results screen
 */
function showResults() {
    const state = StateManager.getState();
    const scores = StateManager.getAllScores();
    const riskFlags = StateManager.getRiskFlags();
    
    // Patient info
    elements.resultPatientId.textContent = state.patient_id;
    elements.resultDate.textContent = new Date(state.session_start).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    elements.resultCondition.textContent = state.conditionLabel;
    
    // Risk flags - hidden per user request
    elements.riskFlagsCard.classList.add('hidden');
    
    // Scale results - render with enhanced display
    elements.scaleResults.innerHTML = Object.values(scores).map(score => {
        return renderScaleResultCard(score);
    }).join('');
    
    // Composite summary
    const summary = ScaleEngine.generateCompositeSummary(scores, conditionMap.conditions[state.condition]);
    elements.compositeSummary.innerHTML = `<p>${summary}</p>`;
    
    showScreen('results');
}

/**
 * Render a scale result card with appropriate visualization
 */
function renderScaleResultCard(score) {
    const scaleConfig = scales[score.scaleId] || null;
    const severityClass = `severity-${score.severity?.level || 'unknown'}`;
    const percentage = score.percentage || 0;
    
    // Build the score visualization
    let scoreVisualization = '';
    
    // Special handling for profile-based scales (EQ-5D-5L)
    if (score.isProfileBased) {
        scoreVisualization = renderProfileBasedScore(score);
    } else {
        scoreVisualization = `
            <div class="score-visual">
                <div class="score-circle ${severityClass}">
                    <span class="score-number">${formatScoreValue(score.total)}</span>
                    <span class="score-max-label">/ ${score.maxPossible}</span>
                </div>
                <span class="score-percentage">${percentage}%</span>
            </div>
        `;
    }
    
    // Severity badge
    const severityBadge = score.severity ? `
        <div class="severity-label ${severityClass}">
            <i class="fas fa-circle"></i>
            ${score.severity.label}
        </div>
    ` : '';
    
    // Severity description
    const severityDescription = score.severity?.description ? `
        <p class="severity-description">${score.severity.description}</p>
    ` : '';
    
    // Cutoff indicator for binary screening scales
    let cutoffIndicator = '';
    if (score.cutoff !== undefined && score.isPositive !== null) {
        cutoffIndicator = `
            <div class="cutoff-indicator ${score.isPositive ? 'cutoff-positive' : 'cutoff-negative'}">
                <i class="fas ${score.isPositive ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i>
                ${score.isPositive 
                    ? `Score ≥ ${score.cutoff}: Positive screening result` 
                    : `Score < ${score.cutoff}: Negative screening result`}
            </div>
        `;
    }
    
    // Component scores (PSQI)
    let componentScores = '';
    if (score.componentScores && Object.keys(score.componentScores).length > 0) {
        componentScores = `
            <div class="component-scores">
                <div class="component-title">Component Scores</div>
                <div class="component-grid">
                    ${Object.values(score.componentScores).map(comp => `
                        <div class="component-item">
                            <span class="component-name">${comp.name}</span>
                            <span class="component-value">${comp.score}/${comp.maxScore}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Domain scores (COMPASS-31)
    let domainScores = '';
    if (score.domainScores && Object.keys(score.domainScores).length > 0) {
        domainScores = `
            <div class="domain-scores">
                <div class="component-title">Domain Scores</div>
                ${Object.values(score.domainScores).map(domain => {
                    const pct = domain.maxWeighted > 0 ? (domain.weighted / domain.maxWeighted) * 100 : 0;
                    return `
                        <div class="domain-item">
                            <div class="domain-header">
                                <span class="domain-name">${domain.name}</span>
                                <span class="domain-value">${domain.weighted.toFixed(1)}</span>
                            </div>
                            <div class="domain-bar">
                                <div class="domain-bar-fill" style="width: ${pct}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // Subscale scores (DASS-21, BDI-II)
    let subscaleScores = '';
    if (score.subscaleScores && Object.keys(score.subscaleScores).length > 0) {
        const hasSubscaleSeverity = score.hasSubscaleSeverity;
        
        if (hasSubscaleSeverity) {
            subscaleScores = `
                <div class="subscale-scores">
                    <div class="subscale-title">Subscale Results</div>
                    ${Object.values(score.subscaleScores).map(sub => {
                        const subSeverityClass = sub.severity?.level ? `severity-${sub.severity.level}` : '';
                        return `
                            <div class="subscale-with-severity">
                                <div class="subscale-info">
                                    <div class="subscale-label">${sub.name}</div>
                                    <div class="subscale-score">Score: ${sub.score}</div>
                                </div>
                                ${sub.severity ? `
                                    <span class="subscale-severity-badge ${subSeverityClass}">
                                        ${sub.severity.label}
                                    </span>
                                ` : `
                                    <span class="subscale-value">${sub.score}</span>
                                `}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else {
            subscaleScores = `
                <div class="subscale-scores">
                    <div class="subscale-title">Subscales</div>
                    ${Object.values(score.subscaleScores).map(sub => `
                        <div class="subscale-item">
                            <span class="subscale-name">${sub.name}</span>
                            <span class="subscale-value">${sub.score || sub.weighted || sub.raw}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
    
    return `
        <div class="scale-result-card">
            <div class="scale-result-header">
                <span class="scale-result-name">${score.scaleName}</span>
                ${scaleConfig?.isClinician ? '<span class="scale-result-badge">Clinician-Rated</span>' : ''}
            </div>
            <div class="scale-result-body">
                ${scoreVisualization}
                ${severityBadge}
                ${severityDescription}
                ${cutoffIndicator}
                ${componentScores}
                ${domainScores}
                ${subscaleScores}
            </div>
        </div>
    `;
}

/**
 * Render profile-based score (EQ-5D-5L style)
 */
function renderProfileBasedScore(score) {
    let dimensionDisplay = '';
    
    if (score.dimensionScores) {
        dimensionDisplay = `
            <div class="dimension-scores">
                <div class="dimension-grid">
                    ${Object.values(score.dimensionScores).map(dim => {
                        const level = dim.level || 0;
                        let levelDots = '';
                        for (let i = 1; i <= 5; i++) {
                            const isActive = i <= level;
                            levelDots += `<span class="level-dot level-${i} ${isActive ? 'active' : ''}"></span>`;
                        }
                        return `
                            <div class="dimension-item">
                                <span class="dimension-label">${dim.label}</span>
                                <div class="dimension-level">
                                    ${levelDots}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    // Health state profile code
    const profileCode = score.healthStateProfile ? `
        <div class="health-state">
            <div class="health-state-label">Health State Profile</div>
            <div class="health-state-code">${score.healthStateProfile}</div>
        </div>
    ` : '';
    
    // VAS score
    const vasDisplay = score.vasScore !== null ? `
        <div class="vas-display">
            <div class="vas-label">Self-Rated Health (VAS)</div>
            <span class="vas-value">${score.vasScore}</span>
            <span class="vas-max">/100</span>
        </div>
    ` : '';
    
    return `
        ${dimensionDisplay}
        ${profileCode}
        ${vasDisplay}
    `;
}

/**
 * Format score value for display
 */
function formatScoreValue(value) {
    if (value === null || value === undefined) return '-';
    if (Number.isInteger(value)) return value;
    return value.toFixed(1);
}

/**
 * Handle PDF download
 */
async function handleDownloadPDF() {
    try {
        elements.btnDownloadPDF.disabled = true;
        elements.btnDownloadPDF.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        await PDFGenerator.downloadReport();
        
    } catch (error) {
        console.error('PDF generation failed:', error);
        showError('Failed to generate PDF. Please try again.');
    } finally {
        elements.btnDownloadPDF.disabled = false;
        elements.btnDownloadPDF.innerHTML = '<i class="fas fa-file-pdf"></i> Download PDF Report';
    }
}

/**
 * Handle CSV download
 */
function handleDownloadCSV() {
    try {
        elements.btnDownloadCSV.disabled = true;
        elements.btnDownloadCSV.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        const state = StateManager.getState();
        const scores = StateManager.getAllScores();
        const responses = state.responses;
        
        // Build CSV rows
        const rows = [];
        
        // Header row
        const headers = [
            'patient_id',
            'patient_name',
            'condition',
            'condition_label',
            'assessment_date',
            'scale_id',
            'scale_name',
            'question_num',
            'response_value',
            'total_score',
            'max_possible',
            'percentage',
            'severity_level',
            'severity_label'
        ];
        rows.push(headers.join(','));
        
        // Data rows - one per question/response
        const date = new Date(state.session_start).toISOString();
        
        Object.keys(responses).forEach(scaleId => {
            const scaleResponses = responses[scaleId];
            const score = scores[scaleId] || {};
            
            Object.keys(scaleResponses).forEach(qNum => {
                const row = [
                    escapeCSV(state.patient_id || ''),
                    escapeCSV(state.patient_name || ''),
                    escapeCSV(state.condition || ''),
                    escapeCSV(state.conditionLabel || ''),
                    escapeCSV(date),
                    escapeCSV(scaleId),
                    escapeCSV(score.scaleName || scaleId),
                    qNum,
                    scaleResponses[qNum],
                    score.total ?? '',
                    score.maxPossible ?? '',
                    score.percentage ?? '',
                    escapeCSV(score.severity?.level || ''),
                    escapeCSV(score.severity?.label || '')
                ];
                rows.push(row.join(','));
            });
        });
        
        // Create and download CSV
        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const filename = `${state.patient_id}_${(state.condition || 'assessment').replace(/\s+/g, '-')}_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('CSV generation failed:', error);
        showError('Failed to generate CSV. Please try again.');
    } finally {
        elements.btnDownloadCSV.disabled = false;
        elements.btnDownloadCSV.innerHTML = '<i class="fas fa-file-csv"></i> Download Data (CSV)';
    }
}

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * Handle new assessment
 */
function handleNewAssessment() {
    StateManager.initSession();
    StateManager.clearSavedState();
    currentScale = null;
    currentPatientId = null;
    selectedConditionId = null;
    
    // Reset patient entry form
    elements.patientName.value = '';
    elements.patientIdPreview.classList.add('hidden');
    elements.btnProceedToCondition.disabled = true;
    
    // Reset condition selection
    document.querySelectorAll('.condition-card').forEach(card => {
        card.classList.remove('selected');
    });
    elements.selectedConditionPanel.classList.add('hidden');
    
    showScreen('patient');
}

/**
 * DEV/DEBUG: Pre-fill all questions in current scale with default answers
 */
function devPrefillCurrentScale() {
    if (!currentScale || !currentScale.questions) {
        console.log('No scale loaded');
        return;
    }
    
    const state = StateManager.getState();
    const scaleId = state.scaleOrder[state.currentScaleIndex];
    
    currentScale.questions.forEach((question, index) => {
        let defaultValue;
        
        switch (question.type) {
            case 'time':
                defaultValue = '10:00 PM';
                break;
            case 'number':
                defaultValue = question.min !== undefined ? question.min : 1;
                break;
            case 'text':
                defaultValue = 'Test response';
                break;
            case 'visual-analogue-scale':
                defaultValue = 50;
                break;
            default:
                // For likert/options, pick the middle option or first option
                if (question.options && question.options.length > 0) {
                    const midIndex = Math.floor(question.options.length / 2);
                    defaultValue = question.options[midIndex].value !== undefined 
                        ? question.options[midIndex].value 
                        : midIndex;
                } else {
                    defaultValue = 1;
                }
        }
        
        StateManager.recordResponse(scaleId, index, defaultValue);
    });
    
    // Re-render to show filled answers
    renderAllQuestions();
    console.log(`Pre-filled ${currentScale.questions.length} questions for ${scaleId}`);
}

// Expose to window for console access
window.devPrefillCurrentScale = devPrefillCurrentScale;

/**
 * Handle settings change
 */
function handleSettingsChange() {
    StateManager.updateSettings({
        autoSave: elements.settingAutoSave.checked,
        showQuestionNumbers: elements.settingShowNumbers.checked
    });
}

// ========================================
// UI HELPERS
// ========================================

/**
 * Show a specific screen
 */
function showScreen(screenName) {
    // Hide all screens
    elements.screenPatient.classList.remove('active');
    elements.screenCondition.classList.remove('active');
    elements.screenAssessment.classList.remove('active');
    elements.screenResults.classList.remove('active');
    
    // Show requested screen
    switch (screenName) {
        case 'patient':
            elements.screenPatient.classList.add('active');
            break;
        case 'condition':
            elements.screenCondition.classList.add('active');
            break;
        case 'assessment':
            elements.screenAssessment.classList.add('active');
            break;
        case 'results':
            elements.screenResults.classList.add('active');
            break;
    }
}

/**
 * Show modal
 */
function showModal(modalName) {
    if (modalName === 'settings') {
        // Sync settings with state
        const state = StateManager.getState();
        elements.settingAutoSave.checked = state.settings.autoSave;
        elements.settingShowNumbers.checked = state.settings.showQuestionNumbers;
        elements.modalSettings.classList.remove('hidden');
    }
}

/**
 * Hide modal
 */
function hideModal(modalName) {
    if (modalName === 'settings') {
        elements.modalSettings.classList.add('hidden');
    }
}

/**
 * Show error message
 */
function showError(message) {
    // For now, use alert - could be replaced with custom modal
    alert(message);
}

// ========================================
// START APPLICATION
// ========================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Export for debugging
window.PRS = {
    StateManager,
    ScaleEngine,
    PDFGenerator,
    getState: () => StateManager.getState(),
    getScales: () => scales
};
