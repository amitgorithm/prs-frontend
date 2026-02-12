/**
 * Scale Validation Script
 * Validates all scale JSON files for proper structure and scoring compatibility
 */

const fs = require('fs');
const path = require('path');

const SCALES_DIR = path.join(__dirname, 'data', 'scales');

// Valid scoring types from scaleEngine.js
const VALID_SCORING_TYPES = [
    'sum', 'subscale-sum', 'weighted-binary', 'weighted-domain-sum',
    'component-sum', 'profile-and-vas', 'reverse-scored', 'subscale-severity',
    'clinician', 'average', 'fiqr-weighted', 'mean', 'vas', 'vas-mean',
    'nrs', 'sum-subscales', 'clinician-rating',
    // Scale-specific types that fall back to sum
    'asrs-screening', 'binary_cutoff', 'single-selection', 'weighted-sum',
    'sum-numeric', 'paindetect', 'ibs-sss', 'msq-transformed', 'pfs-dual',
    'subscale_average'
];

// Required fields for scales
const REQUIRED_FIELDS = ['id', 'name', 'questions'];
const RECOMMENDED_FIELDS = ['scoringType', 'maxScore', 'severityBands', 'description'];

// Results tracking
const results = {
    passed: [],
    warnings: [],
    errors: [],
    scoringTests: []
};

/**
 * Generate random response for a question
 */
function generateRandomResponse(question) {
    if (question.options && question.options.length > 0) {
        const randomIdx = Math.floor(Math.random() * question.options.length);
        return question.options[randomIdx].value;
    }
    if (question.type === 'visual-analogue-scale' || question.type === 'vas') {
        return Math.floor(Math.random() * 101); // 0-100
    }
    if (question.type === 'nrs' || question.type === 'numeric') {
        const max = question.maxValue || 10;
        const min = question.minValue || 0;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    // Default: return random 0-4
    return Math.floor(Math.random() * 5);
}

/**
 * Calculate score using simplified sum logic
 */
function calculateTestScore(scale, responses) {
    const scoringType = scale.scoringType || 'sum';
    let total = 0;
    
    if (scoringType === 'mean' || scoringType === 'average' || scoringType === 'vas-mean') {
        const values = Object.values(responses).filter(v => v !== undefined);
        const sum = values.reduce((acc, v) => acc + parseFloat(v), 0);
        return values.length > 0 ? Math.round((sum / values.length) * 100) / 100 : 0;
    }
    
    if (scoringType === 'profile-and-vas') {
        // Find VAS question
        const vasQ = scale.questions.find(q => q.type === 'visual-analogue-scale');
        if (vasQ) {
            const idx = scale.questions.indexOf(vasQ);
            return responses[idx] || 0;
        }
        return 0;
    }
    
    // Sum-based scoring
    scale.questions.forEach((question, index) => {
        if (question.scoredInTotal === false) return;
        const value = responses[index];
        if (value !== undefined) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                // Check for points override
                const option = question.options?.find(o => o.value == value);
                const points = option?.points !== undefined ? option.points : numValue;
                total += points;
            }
        }
    });
    
    return Math.round(total * 100) / 100;
}

/**
 * Get severity for a score
 */
function getSeverity(score, severityBands) {
    if (!severityBands) return null;
    
    // Handle object format (per-subscale) - return null for total
    if (!Array.isArray(severityBands)) return 'Per-subscale';
    
    for (const band of severityBands) {
        // Support min/max, minScore/maxScore, and range.min/range.max
        const min = band.min !== undefined ? band.min : 
                    (band.minScore !== undefined ? band.minScore : band.range?.min);
        const max = band.max !== undefined ? band.max : 
                    (band.maxScore !== undefined ? band.maxScore : band.range?.max);
        
        if (min !== undefined && max !== undefined) {
            if (score >= min && score <= max) {
                return band.label || band.name || band.id;
            }
        }
    }
    return 'Unknown';
}

/**
 * Validate a single scale
 */
function validateScale(scaleFile) {
    const filePath = path.join(SCALES_DIR, scaleFile);
    const scaleId = path.basename(scaleFile, '.json');
    const issues = { errors: [], warnings: [] };
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const scale = JSON.parse(content);
        
        // 1. Check required fields
        for (const field of REQUIRED_FIELDS) {
            if (!scale[field]) {
                issues.errors.push(`Missing required field: ${field}`);
            }
        }
        
        // 2. Check recommended fields
        for (const field of RECOMMENDED_FIELDS) {
            if (!scale[field]) {
                issues.warnings.push(`Missing recommended field: ${field}`);
            }
        }
        
        // 3. Validate scoring type
        const scoringType = scale.scoringType || 'sum';
        if (!VALID_SCORING_TYPES.includes(scoringType)) {
            issues.warnings.push(`Unrecognized scoring type: ${scoringType} (will default to 'sum')`);
        }
        
        // 4. Validate questions
        if (scale.questions) {
            if (!Array.isArray(scale.questions)) {
                issues.errors.push('questions is not an array');
            } else {
                scale.questions.forEach((q, idx) => {
                    // Check question has required structure
                    if (!q.question && !q.text && !q.label && !q.description) {
                        issues.errors.push(`Question ${idx + 1}: Missing question text`);
                    }
                    
                    // Check options have points or values
                    if (q.options) {
                        if (!Array.isArray(q.options)) {
                            issues.errors.push(`Question ${idx + 1}: options is not an array`);
                        } else {
                            q.options.forEach((opt, optIdx) => {
                                if (opt.value === undefined && opt.points === undefined) {
                                    issues.errors.push(`Question ${idx + 1}, Option ${optIdx + 1}: Missing value or points`);
                                }
                                if (!opt.label && opt.text === undefined) {
                                    issues.warnings.push(`Question ${idx + 1}, Option ${optIdx + 1}: Missing label`);
                                }
                            });
                        }
                    } else if (q.type !== 'visual-analogue-scale' && q.type !== 'vas' && 
                               q.type !== 'nrs' && q.type !== 'numeric' && q.type !== 'time') {
                        issues.warnings.push(`Question ${idx + 1}: No options defined`);
                    }
                });
            }
        }
        
        // 5. Validate severity bands (support both array and object formats)
        if (scale.severityBands) {
            if (Array.isArray(scale.severityBands)) {
                let prevMax = -Infinity;
                scale.severityBands.forEach((band, idx) => {
                    // Support min/max, minScore/maxScore, and range.min/range.max
                    const min = band.min !== undefined ? band.min : 
                                (band.minScore !== undefined ? band.minScore : band.range?.min);
                    const max = band.max !== undefined ? band.max : 
                                (band.maxScore !== undefined ? band.maxScore : band.range?.max);
                    
                    if (min === undefined || max === undefined) {
                        issues.errors.push(`Severity band ${idx + 1}: Missing min or max (checked min, minScore, range.min)`);
                    } else {
                        if (min > max) {
                            issues.errors.push(`Severity band ${idx + 1}: min (${min}) > max (${max})`);
                        }
                    }
                    
                    if (!band.label && !band.name && !band.id) {
                        issues.warnings.push(`Severity band ${idx + 1}: Missing label`);
                    }
                });
            } else if (typeof scale.severityBands === 'object') {
                // Object format for per-subscale severity - valid for subscale-based scales
                issues.warnings.push(`Severity bands is an object (per-subscale format) - ensure subscaleSeverityBands or add total severityBands array`);
            }
        }
        
        // 6. Validate subscales if present (support both array and object formats)
        if (scale.subscales) {
            if (Array.isArray(scale.subscales)) {
                scale.subscales.forEach((sub, idx) => {
                    if (!sub.id && !sub.name) {
                        issues.warnings.push(`Subscale ${idx + 1}: Missing id or name`);
                    }
                    if (!sub.items && !sub.questionIndices && !sub.questions) {
                        issues.warnings.push(`Subscale ${idx + 1}: No items/questionIndices/questions defined`);
                    }
                });
            } else if (typeof scale.subscales === 'object') {
                // Object format - valid alternative 
                const subscaleKeys = Object.keys(scale.subscales);
                if (subscaleKeys.length === 0) {
                    issues.warnings.push('subscales object is empty');
                }
            }
        }
        
        // 7. Test scoring with random responses
        if (scale.questions && Array.isArray(scale.questions)) {
            const responses = {};
            scale.questions.forEach((q, idx) => {
                responses[idx] = generateRandomResponse(q);
            });
            
            const testScore = calculateTestScore(scale, responses);
            const severity = getSeverity(testScore, scale.severityBands);
            
            results.scoringTests.push({
                scale: scaleId,
                scoringType: scale.scoringType || 'sum',
                questionCount: scale.questions.length,
                randomScore: testScore,
                maxScore: scale.maxScore || 'N/A',
                severity: severity || 'N/A',
                hasSubscales: !!scale.subscales,
                hasReferences: !!scale.references
            });
        }
        
        // 8. Check references
        if (!scale.references || (Array.isArray(scale.references) && scale.references.length === 0)) {
            issues.warnings.push('No references provided');
        }
        
        // Record results
        if (issues.errors.length > 0) {
            results.errors.push({ scale: scaleId, issues: issues.errors });
        }
        if (issues.warnings.length > 0) {
            results.warnings.push({ scale: scaleId, issues: issues.warnings });
        }
        if (issues.errors.length === 0) {
            results.passed.push(scaleId);
        }
        
        return { scaleId, scale, issues };
        
    } catch (e) {
        results.errors.push({ scale: scaleId, issues: [`Parse error: ${e.message}`] });
        return { scaleId, scale: null, issues: { errors: [e.message], warnings: [] } };
    }
}

/**
 * Main validation function
 */
function main() {
    console.log('='.repeat(70));
    console.log('SCALE VALIDATION REPORT');
    console.log('='.repeat(70));
    console.log(`Date: ${new Date().toISOString()}`);
    console.log(`Directory: ${SCALES_DIR}\n`);
    
    // Get all JSON files
    const files = fs.readdirSync(SCALES_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} scale files\n`);
    
    // Validate each file
    files.forEach(file => validateScale(file));
    
    // Summary
    console.log('-'.repeat(70));
    console.log('SUMMARY');
    console.log('-'.repeat(70));
    console.log(`Total scales: ${files.length}`);
    console.log(`Passed (no errors): ${results.passed.length}`);
    console.log(`With warnings: ${results.warnings.length}`);
    console.log(`With errors: ${results.errors.length}`);
    
    // List errors
    if (results.errors.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log('ERRORS (Must Fix)');
        console.log('='.repeat(70));
        results.errors.forEach(e => {
            console.log(`\n[${e.scale}]`);
            e.issues.forEach(issue => console.log(`  ❌ ${issue}`));
        });
    }
    
    // List warnings  
    if (results.warnings.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log('WARNINGS (Review Recommended)');
        console.log('='.repeat(70));
        results.warnings.forEach(w => {
            console.log(`\n[${w.scale}]`);
            w.issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
        });
    }
    
    // Scoring tests table
    console.log('\n' + '='.repeat(70));
    console.log('SCORING TESTS (Random Response Simulation)');
    console.log('='.repeat(70));
    console.log('\nScale                  | Type              | Questions | Random Score | Max    | Severity');
    console.log('-'.repeat(100));
    
    results.scoringTests.forEach(t => {
        const scaleName = t.scale.substring(0, 22).padEnd(22);
        const type = (t.scoringType || 'sum').substring(0, 17).padEnd(17);
        const count = String(t.questionCount).padStart(3);
        const score = String(t.randomScore).padStart(6);
        const max = String(t.maxScore).padStart(6);
        const severity = (t.severity || 'N/A').substring(0, 20);
        console.log(`${scaleName} | ${type} | ${count}       | ${score}       | ${max} | ${severity}`);
    });
    
    // References check
    console.log('\n' + '='.repeat(70));
    console.log('REFERENCES CHECK');
    console.log('='.repeat(70));
    const withRefs = results.scoringTests.filter(t => t.hasReferences).length;
    const withoutRefs = results.scoringTests.filter(t => !t.hasReferences).length;
    console.log(`Scales with references: ${withRefs}`);
    console.log(`Scales without references: ${withoutRefs}`);
    
    // Subscales check
    console.log('\n' + '='.repeat(70));
    console.log('SUBSCALES CHECK');
    console.log('='.repeat(70));
    const withSubs = results.scoringTests.filter(t => t.hasSubscales).length;
    console.log(`Scales with subscales: ${withSubs}`);
    console.log(`Scales without subscales: ${files.length - withSubs}`);
    
    // Final verdict
    console.log('\n' + '='.repeat(70));
    console.log('FINAL VERDICT');
    console.log('='.repeat(70));
    
    if (results.errors.length === 0) {
        console.log('✅ ALL SCALES PASS STRUCTURAL VALIDATION');
        console.log('   All JSON files can be parsed and have required fields.');
        console.log('   Random scoring simulation completed for all scales.');
    } else {
        console.log(`❌ ${results.errors.length} SCALES HAVE STRUCTURAL ERRORS`);
        console.log('   These need to be fixed before scoring will work correctly.');
    }
    
    console.log('\n');
}

main();
