# PRS - Patient Rating System

A production-ready, JSON-driven clinical assessment web application for Sozo Brain Center.

## Overview

The PRS (Patient Rating System) is a clinical assistant tool used for structured patient assessments. It allows clinical assistants to:

- Select a condition
- Administer ordered scales section-by-section
- Record patient responses
- Auto-calculate scores with deterministic scoring
- Identify clinical risk flags
- Generate professional PDF reports

## Architecture

```
/prs
├── index.html              # Main application entry point
├── css/
│   └── styles.css          # Sozo-branded styles
├── js/
│   ├── app.js              # Main application controller
│   ├── stateManager.js     # Centralized state management
│   ├── scaleEngine.js      # Scoring engine
│   └── pdfGenerator.js     # PDF report generation
├── data/
│   ├── conditionMap.json   # Condition → Scale mappings
│   └── scales/             # Individual scale definitions
│       ├── PHQ-9.json
│       ├── GAD-7.json
│       ├── THI.json
│       ├── AUDIT.json
│       ├── GPCOG.json
│       ├── EDSS.json
│       ├── BDI-II.json
│       └── MADRS.json
└── README.md
```

## Quick Start

1. **Open** `index.html` in a web browser (use a local server for best results)
2. **Select** a condition from the dropdown
3. **Complete** all questions for each scale
4. **Review** results and risk flags
5. **Download** PDF report

### Local Development Server

```bash
# Using Python 3
cd prs
python -m http.server 8080

# Using Node.js (npx)
npx serve .
```

Then open: `http://localhost:8080`

## Adding New Scales

### Step 1: Create Scale JSON

Create a new file in `/data/scales/YOUR-SCALE.json`:

```json
{
    "id": "YOUR-SCALE",
    "name": "Full Scale Name",
    "shortName": "SHORT",
    "description": "Brief description",
    "version": "1.0",
    "recallPeriod": "Past 2 weeks",
    "scoringType": "sum",
    "maxScore": 27,
    
    "questions": [
        {
            "index": 0,
            "label": "Question text here?",
            "type": "likert",
            "required": true,
            "options": [
                { "value": 0, "label": "Not at all" },
                { "value": 1, "label": "Several days" },
                { "value": 2, "label": "More than half the days" },
                { "value": 3, "label": "Nearly every day" }
            ]
        }
        // ... more questions
    ],
    
    "severityBands": [
        { "min": 0, "max": 4, "level": "minimal", "label": "Minimal" },
        { "min": 5, "max": 9, "level": "mild", "label": "Mild" },
        { "min": 10, "max": 14, "level": "moderate", "label": "Moderate" },
        { "min": 15, "max": 27, "level": "severe", "label": "Severe" }
    ],
    
    "riskRules": [
        {
            "questionIndex": 8,
            "operator": ">=",
            "threshold": 2,
            "type": "suicide_risk",
            "severity": "high",
            "message": "Risk flag message"
        }
    ]
}
```

### Step 2: Add to Condition Map

Update `/data/conditionMap.json`:

```json
{
    "conditions": {
        "your-condition": {
            "label": "Your Condition Name",
            "description": "Description",
            "scales": ["YOUR-SCALE", "OTHER-SCALE"]
        }
    }
}
```

## Scoring Types

The system supports multiple scoring methods:

| Type | Description |
|------|-------------|
| `sum` | Simple sum of all response values |
| `average` | Average of all response values |
| `subscale_sum_multiply` | Sum with subscale weights/multipliers |
| `reverse_scored` | Sum with reverse-coded items |
| `domain_weighted_sum` | Weighted average across domains |
| `clinician_range_scale` | Single clinician-rated value (e.g., EDSS) |
| `binary_cutoff` | Count of positive responses vs threshold |

### Custom Scoring

Register custom scoring handlers in `scaleEngine.js`:

```javascript
import { registerScoringHandler } from './scaleEngine.js';

registerScoringHandler('custom_type', (responses, scaleConfig) => {
    // Your scoring logic here
    return {
        total: calculatedScore,
        maxPossible: scaleConfig.maxScore
    };
});
```

## Risk Flag Configuration

Risk flags are defined per-scale in the JSON:

```json
"riskRules": [
    {
        "questionIndex": 8,       // 0-based question index
        "operator": ">=",         // >=, >, <=, <, ==
        "threshold": 2,           // Trigger value
        "type": "suicide_risk",   // Flag type identifier
        "severity": "high",       // high, moderate, low
        "message": "Clinical message to display"
    }
]
```

### Built-in Risk Types

- `suicide_risk` - High priority suicide risk flag
- `suicide_ideation_present` - Suicidal thoughts detected
- `alcohol_dependence_flag` - AUDIT elevated score
- `cognitive_impairment_flag` - Cognitive screening positive

## State Management

State is persisted in `localStorage` and managed centrally:

```javascript
{
    patient_id: "uuid",
    session_start: "ISO timestamp",
    condition: "condition-id",
    conditionLabel: "Human-readable name",
    scaleOrder: ["PHQ-9", "GAD-7"],
    currentScaleIndex: 0,
    currentQuestionIndex: 0,
    responses: {
        "PHQ-9": { 0: 2, 1: 1, 2: 3 }
    },
    scores: {
        "PHQ-9": { total: 15, severity: {...} }
    },
    riskFlags: [],
    settings: {
        autoSave: true,
        showQuestionNumbers: true
    }
}
```

## PDF Reports

Reports are generated using jsPDF and include:

- Patient ID and assessment date
- Condition assessed
- All scale results with severity classifications
- Risk flags (if any)
- Clinical summary

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` or `Enter` | Next question |
| `←` | Previous question |
| `1-9` | Select option by number |

## Customization

### Branding

Update CSS variables in `styles.css`:

```css
:root {
    --sozo-orange: rgb(244, 121, 32);
    --sozo-orange-dark: rgb(202, 65, 12);
    /* ... */
}
```

### PDF Styling

Modify `pdfGenerator.js` to customize:
- Header/footer content
- Color scheme
- Layout structure

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Technical Requirements

- No backend required
- All calculations client-side
- Works offline after initial load
- JSON-driven configuration
- ES6+ JavaScript modules

## Development

### Debug Mode

Access debug tools via browser console:

```javascript
// Get current state
PRS.getState()

// Get loaded scales
PRS.getScales()

// Access state manager
PRS.StateManager.getAllScores()
```

## License

© 2024 Sozo Brain Center. All rights reserved.

---

**Version:** 1.0.0  
**Last Updated:** January 2024
