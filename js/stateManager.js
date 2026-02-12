/**
 * =============================================
 * STATE MANAGER
 * Centralized state management for PRS application
 * =============================================
 */

const STORAGE_KEY = 'prs_session_state';

/**
 * Initial state structure
 */
const initialState = {
    // Session identification
    patient_id: '',
    patient_name: '',
    session_start: null,
    
    // Selected condition and scale order
    condition: '',
    conditionLabel: '',
    scaleOrder: [],
    
    // Current position in the assessment
    currentScaleIndex: 0,
    currentQuestionIndex: 0,
    
    // Responses stored per scale: { "PHQ-9": { 1: 2, 2: 1, ... }, ... }
    responses: {},
    
    // Calculated scores per scale
    scores: {},
    
    // Risk flags detected during assessment
    riskFlags: [],
    
    // Settings
    settings: {
        autoSave: true,
        showQuestionNumbers: true
    }
};

/**
 * Current state object
 */
let state = { ...initialState };

/**
 * State change listeners
 */
const listeners = new Set();

/**
 * Generate a random UUID for patient identification
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Initialize a new session
 */
export function initSession() {
    state = {
        ...initialState,
        patient_id: generateUUID(),
        patient_name: '',
        session_start: new Date().toISOString(),
        responses: {},
        scores: {},
        riskFlags: [],
        settings: { ...initialState.settings }
    };
    saveToLocalStorage();
    notifyListeners();
    return state;
}

/**
 * Set patient information
 * @param {string} patientId - The generated patient ID (PAT_XXXXXXXXXX)
 * @param {string} patientName - The patient's name
 */
export function setPatientInfo(patientId, patientName) {
    updateState({
        patient_id: patientId,
        patient_name: patientName
    });
}

/**
 * Get current state
 */
export function getState() {
    return { ...state };
}

/**
 * Update state with partial updates
 * @param {Object} updates - Partial state updates
 */
export function updateState(updates) {
    state = { ...state, ...updates };
    if (state.settings.autoSave) {
        saveToLocalStorage();
    }
    notifyListeners();
}

/**
 * Set the selected condition and its scale order
 * @param {string} conditionId - Condition identifier
 * @param {string} conditionLabel - Human-readable condition name
 * @param {Array} scaleOrder - Ordered array of scale IDs
 */
export function setCondition(conditionId, conditionLabel, scaleOrder) {
    updateState({
        condition: conditionId,
        conditionLabel: conditionLabel,
        scaleOrder: scaleOrder,
        currentScaleIndex: 0,
        currentQuestionIndex: 0,
        responses: {},
        scores: {},
        riskFlags: []
    });
}

/**
 * Record a response for the current question
 * @param {string} scaleId - Scale identifier
 * @param {number} questionIndex - Question index (0-based)
 * @param {*} value - Response value
 */
export function recordResponse(scaleId, questionIndex, value) {
    const responses = { ...state.responses };
    if (!responses[scaleId]) {
        responses[scaleId] = {};
    }
    responses[scaleId][questionIndex] = value;
    updateState({ responses });
}

/**
 * Get response for a specific question
 * @param {string} scaleId - Scale identifier
 * @param {number} questionIndex - Question index
 * @returns {*} Response value or undefined
 */
export function getResponse(scaleId, questionIndex) {
    return state.responses[scaleId]?.[questionIndex];
}

/**
 * Get all responses for a scale
 * @param {string} scaleId - Scale identifier
 * @returns {Object} All responses for the scale { questionIndex: value, ... }
 */
export function getScaleResponses(scaleId) {
    return state.responses[scaleId] || {};
}

/**
 * Check if all questions for a scale are answered
 * @param {string} scaleId - Scale identifier
 * @param {number} totalQuestions - Total number of questions
 * @returns {boolean}
 */
export function isScaleComplete(scaleId, totalQuestions) {
    const scaleResponses = state.responses[scaleId];
    if (!scaleResponses) return false;
    
    const answeredCount = Object.keys(scaleResponses).length;
    return answeredCount >= totalQuestions;
}

/**
 * Store calculated score for a scale
 * @param {string} scaleId - Scale identifier
 * @param {Object} scoreData - Score data including total, severity, subscales, etc.
 */
export function storeScore(scaleId, scoreData) {
    const scores = { ...state.scores };
    scores[scaleId] = scoreData;
    updateState({ scores });
}

/**
 * Add a risk flag
 * @param {Object} flag - Risk flag object { type, severity, message, source }
 */
export function addRiskFlag(flag) {
    const riskFlags = [...state.riskFlags];
    // Avoid duplicates
    const exists = riskFlags.some(f => f.type === flag.type && f.source === flag.source);
    if (!exists) {
        riskFlags.push(flag);
        updateState({ riskFlags });
    }
}

/**
 * Navigate to next question or scale
 */
export function navigateNext() {
    updateState({
        currentQuestionIndex: state.currentQuestionIndex + 1
    });
}

/**
 * Navigate to previous question
 */
export function navigatePrevious() {
    if (state.currentQuestionIndex > 0) {
        updateState({
            currentQuestionIndex: state.currentQuestionIndex - 1
        });
    }
}

/**
 * Move to next scale
 */
export function moveToNextScale() {
    updateState({
        currentScaleIndex: state.currentScaleIndex + 1,
        currentQuestionIndex: 0
    });
}

/**
 * Check if we're on the last scale
 * @returns {boolean}
 */
export function isLastScale() {
    return state.currentScaleIndex >= state.scaleOrder.length - 1;
}

/**
 * Update settings
 * @param {Object} settings - Settings updates
 */
export function updateSettings(settings) {
    updateState({
        settings: { ...state.settings, ...settings }
    });
}

/**
 * Save state to localStorage
 */
function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Failed to save state to localStorage:', error);
    }
}

/**
 * Load state from localStorage
 * @returns {boolean} True if state was restored
 */
export function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state = { ...initialState, ...parsed };
            notifyListeners();
            return true;
        }
    } catch (error) {
        console.warn('Failed to load state from localStorage:', error);
    }
    return false;
}

/**
 * Clear saved state
 */
export function clearSavedState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to clear localStorage:', error);
    }
}

/**
 * Subscribe to state changes
 * @param {Function} listener - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
    listeners.forEach(listener => {
        try {
            listener(state);
        } catch (error) {
            console.error('Listener error:', error);
        }
    });
}

/**
 * Get all responses for report generation
 * @returns {Object} All responses
 */
export function getAllResponses() {
    return { ...state.responses };
}

/**
 * Get all scores for report generation
 * @returns {Object} All scores
 */
export function getAllScores() {
    return { ...state.scores };
}

/**
 * Get all risk flags
 * @returns {Array} Risk flags
 */
export function getRiskFlags() {
    return [...state.riskFlags];
}

// Export state manager as default
export default {
    initSession,
    getState,
    updateState,
    setCondition,
    recordResponse,
    getResponse,
    isScaleComplete,
    storeScore,
    addRiskFlag,
    navigateNext,
    navigatePrevious,
    moveToNextScale,
    isLastScale,
    updateSettings,
    loadFromLocalStorage,
    clearSavedState,
    subscribe,
    getAllResponses,
    getAllScores,
    getRiskFlags
};
