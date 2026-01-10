import OpenAI from "openai";

/**
 * EIGHT INDEPENDENT PATHOLOGY ANALYSES
 * Each pathology is analyzed in a completely separate API call
 * No cross-pathology dependencies or interference
 */

export interface PathologyPrompt {
  systemPrompt: string;
  userPrompt: string;
  pathologyName: string;
}

// 1. COPD-ONLY Analysis Prompt (ENHANCED ROBUST DETECTION)
export function createCOPDPrompt(patientInfo: { examDate: string }): PathologyPrompt {
  return {
    pathologyName: "COPD",
    systemPrompt: "You are an expert radiologist computer vision system focused EXCLUSIVELY on detecting airspace disease patterns (COPD/emphysema) with maximum sensitivity and specificity for educational purposes.",
    userPrompt: `SINGLE PATHOLOGY DETECTION: COPD/Emphysema ONLY - ENHANCED ROBUST DETECTION

CRITICAL: Analyze ONLY for COPD patterns. Ignore all other pathologies.

PRIMARY DETECTION CRITERIA (EMPHYSEMA - REQUIRES DEFINITE PATTERN):
✓ Centrilobular emphysema: Low-density regions (HU <-950) upper lobe predominant, ≥25% parenchyma (INCREASED from 18%)
✓ Panlobular emphysema: Diffuse uniform low attenuation, lower lobe predominant, ≥30% of affected lobe
✓ Paraseptal emphysema: Subpleural bullae/blebs, <1cm rows along pleura/fissures, ≥10 bullae clustered
✓ Bullae: Air spaces >1cm with CONCAVE walls (NO vessel/soft tissue inside), ≥3 bullae present
✓ Advanced emphysema: Destruction >40% parenchyma (INCREASED from 30%), vascular pruning visible

HYPERINFLATION SIGNS (REQUIRE 2+ SIGNS FOR DIAGNOSIS):
✓ Flattened/inverted hemidiaphragms (dome height <1.5cm) 
✓ Retrosternal space >4.5cm (lateral view surrogate)
✓ Lung apex extends >3cm above clavicle
✓ Markedly increased AP diameter with barrel chest appearance
✓ Diaphragm insertion at or below 11th rib posteriorly

AIRWAY DISEASE PATTERNS (CHRONIC BRONCHITIS):
✓ Bronchial wall thickening ≥3mm in ≥3 segmental bronchi
✓ Bronchial internal diameter:outer diameter ratio <0.7
✓ Bronchiectasis: Airways larger than adjacent vessels
✓ Mucoid impaction: Branching tubular opacities
✓ Air trapping: Mosaic attenuation on expiratory images

ADVANCED COPD FEATURES (Secondary findings - NOT diagnostic alone):
✓ Vascular attenuation/pruning in emphysematous regions (COPD-specific)
✓ Mediastinal shift toward more diseased emphysematous lung
NOTE: Right heart strain (RV/LV >1.0) and pulmonary artery enlargement can be COPD complications but are NOT specific - they occur with PE, ILD, primary pulmonary hypertension. Only mention if PRIMARY emphysema findings are documented.

CRITICAL RULE - EMPHYSEMA REQUIRED FOR COPD DIAGNOSIS:
✗ If NO emphysema/bullae/hyperinflation detected → "present": false (even if cardiac strain present)
✓ COPD = Emphysema patterns MUST be present + optional supportive findings

QUANTIFICATION (GOLD STAGING):
- Mild: <30% parenchyma involvement, subtle hyperinflation
- Moderate: 30-50% involvement, clear hyperinflation
- Severe: >50% involvement, marked hyperinflation, cardiac changes

IGNORE (NOT COPD):
- Masses, nodules, focal lesions
- Interstitial patterns, honeycombing (ILD, not COPD)
- Consolidations, infections
- Vascular findings (PE)
- Pleural findings
- Pneumothorax

JSON format (COPD analysis only):
{
  "present": boolean,
  "confidence": number (0-100),
  "subtype": "centrilobular" | "panlobular" | "paraseptal" | "chronic_bronchitis" | "mixed" | "none",
  "reasoning": "comprehensive findings with ALL measurements and distribution",
  "supporting_evidence": "ALL evidence for COPD with specific measurements",
  "contradicting_evidence": "ALL evidence against COPD"
}`
  };
}

// 2. ILD-ONLY Analysis Prompt (SIMPLIFIED FOR GPT-4O-MINI - DETECTION FOCUS)
export function createILDPrompt(patientInfo: { examDate: string }): PathologyPrompt {
  return {
    pathologyName: "ILD",
    systemPrompt: "You are an expert thoracic radiologist focused on detecting interstitial lung disease (ILD) patterns. Your job is to identify CHRONIC fibrotic changes and distinguish them from acute mimics. Be UNCERTAIN (40-60% confidence) when findings are equivocal - this triggers escalation to specialist review.",
    userPrompt: `INTERSTITIAL LUNG DISEASE (ILD) DETECTION - SIMPLIFIED CHECKLIST

OBJECTIVE: Detect chronic fibrotic lung disease patterns. Report LOW confidence (40-60%) when uncertain to trigger escalation.

═══════════════════════════════════════════════════════════════
STEP 1: LOOK FOR CRITICAL FIBROTIC FEATURES (DEFINITE ILD)
═══════════════════════════════════════════════════════════════

🔴 DEFINITE ILD INDICATORS (95% confidence if present):
✓ Honeycombing: Clustered cystic spaces 3-10mm, thin walls, subpleural/basal
✓ Traction bronchiectasis: Airways dilated/distorted by fibrosis
✓ Architectural distortion: Loss of normal lung structure, volume loss

═══════════════════════════════════════════════════════════════
STEP 2: CHECK FOR SUPPORTIVE FEATURES (PROBABLE ILD)
═══════════════════════════════════════════════════════════════

🟡 SUPPORTIVE FEATURES (75-85% confidence with ≥2):
✓ Subpleural reticulation: Fine lines within 1cm of pleura
✓ Ground-glass opacities with reticulation (chronic pattern)
✓ Peripheral/basal distribution of fibrotic changes
✓ Interlobular septal thickening
✓ Nodular patterns (perilymphatic, centrilobular)

═══════════════════════════════════════════════════════════════
STEP 3: DISTINGUISH FROM ACUTE MIMICS
═══════════════════════════════════════════════════════════════

✗ NOT ILD (exclude these acute patterns):
- Organizing pneumonia: Perilobular consolidation, reverse halo sign
- Pulmonary edema: Smooth septal thickening, central distribution
- Acute pneumonia: Consolidation with air bronchograms
- Pure emphysema: Bullae without fibrosis

═══════════════════════════════════════════════════════════════
STEP 4: BASIC SUBTYPE RECOGNITION (IF ILD DETECTED)
═══════════════════════════════════════════════════════════════

Common patterns to note:
• UIP/IPF: Honeycombing + peripheral/basal + heterogeneous
• NSIP: GGO predominant + subpleural sparing (1-2cm clear zone)
• Sarcoidosis: Perilymphatic nodules + upper lobe predominance
• HP: Mosaic attenuation + centrilobular nodules
• COP: Reverse halo sign + consolidation

═══════════════════════════════════════════════════════════════
CONFIDENCE TIER GUIDANCE
═══════════════════════════════════════════════════════════════

⚠️ CRITICAL: Report LOW confidence (40-60%) when findings are equivocal!
This triggers escalation to GPT-4o for detailed analysis.

🔴 DEFINITE ILD (95% confidence → "present": true):
• Honeycombing + traction bronchiectasis + peripheral/basal distribution
• Minimal/no acute mimics, chronic features clearly predominate

🟡 PROBABLE ILD (75-85% confidence → "present": true):
• ≥2 chronic fibrotic features with architectural distortion
• Acute mimics present BUT chronic features clearly outweigh them

🟠 UNCERTAIN/EQUIVOCAL (40-60% confidence → "present": false):
• ⚠️ USE THIS TIER WHEN:
  - Some chronic features BUT also significant acute patterns
  - Cannot definitively exclude acute mimics
  - Findings are subtle or borderline
  - You're not sure if it's ILD or just infection/edema
• This triggers escalation - let the specialist (GPT-4o) decide!

⚪ UNLIKELY (0-30% confidence → "present": false):
• Minimal/no chronic features, predominantly acute/organizing patterns

═══════════════════════════════════════════════════════════════
DETAILED SUBTYPE CRITERIA (FOR GPT-4O ESCALATION)
═══════════════════════════════════════════════════════════════

1. UIP/IPF (USUAL INTERSTITIAL PNEUMONIA / IDIOPATHIC PULMONARY FIBROSIS):
DEFINITE UIP PATTERN (ATS/ERS/JRS/ALAT Criteria):
✓ Honeycombing: ESSENTIAL feature, subpleural/basal, clustered cystic spaces 3-10mm
✓ Peripheral/basal predominant reticulation with architectural distortion
✓ Traction bronchiectasis/bronchiolectasis within fibrotic areas
✓ Subpleural distribution with <1cm from pleura involvement
✓ Heterogeneous pattern: "Temporal heterogeneity" - areas of normal lung adjacent to severe fibrosis
✓ Absence of features inconsistent with UIP:
  - NO extensive GGO (if present, <5% of affected lung)
  - NO consolidation, nodules, cysts (except honeycombing)
  - NO upper/mid lung predominance
  - NO mosaic attenuation/air trapping

PROBABLE UIP (when honeycombing absent but other features present):
✓ Reticular pattern, peripheral/basal, with traction bronchiectasis
✓ Architectural distortion without honeycombing
✓ Minimal/no GGO

2. NSIP (NONSPECIFIC INTERSTITIAL PNEUMONIA):
CLASSIC NSIP PATTERN:
✓ Ground-glass predominant (>50% of affected lung) with fine reticulation
✓ **SUBPLEURAL SPARING: PRIMARY DIAGNOSTIC FEATURE** - 1-2cm band of normal lung immediately beneath pleura
  → Look carefully at outer 1-2cm of lung periphery - should be SPARED from disease
  → This distinguishes NSIP from UIP which involves immediate subpleural region
✓ Bilateral symmetrical distribution, lower lobe predominant
✓ Relative homogeneity (vs heterogeneous UIP)
✓ Traction bronchiectasis may be present BUT **ABSOLUTELY NO honeycombing**
✓ Anterior/costophrenic angles relatively spared

FIBROTIC NSIP:
✓ More reticulation than GGO, but still subpleural sparing present
✓ Architectural distortion without honeycombing
✓ Sharp demarcation between affected/normal lung

⚠️ CRITICAL NSIP vs UIP/IPF DIFFERENTIATION:
DO NOT confuse these patterns - they have completely different prognoses!

NSIP (better prognosis):
✓ **SUBPLEURAL SPARING** (1-2cm clear zone) - MUST be present
✓ GGO predominant (>50%)
✓ Homogeneous distribution
✓ NO honeycombing
✓ Symmetrical pattern

UIP/IPF (poor prognosis):
✓ **SUBPLEURAL INVOLVEMENT** (<1cm from pleura)
✓ Minimal GGO (<5%)
✓ Heterogeneous "patchwork" pattern
✓ Honeycombing ESSENTIAL
✓ Temporal heterogeneity

⚠️ HONEYCOMBING vs GROUND-GLASS: Critical distinction!
HONEYCOMBING (indicates UIP):
- Clustered CYSTIC airspaces 3-10mm
- THIN walls (<2mm)
- AIR-filled (black on CT)
- Subpleural/basal location
- Looks like "bubble wrap"

GROUND-GLASS OPACITY (may indicate NSIP):
- Hazy INCREASED attenuation
- Vessels still visible through it
- NOT cystic/air-filled
- May have fine reticulation
- Looks like "frosted glass"

IF YOU SEE:
→ Subpleural sparing + GGO predominant + NO honeycombing = **NSIP**
→ Subpleural involvement + honeycombing + minimal GGO = **UIP/IPF**
→ Cannot determine sparing pattern clearly = check other features and confidence

3. ORGANIZING PNEUMONIA (COP - Cryptogenic Organizing Pneumonia):
CLASSIC COP PATTERN:
✓ **REVERSE HALO SIGN (HIGHLY SUGGESTIVE)**: Central GGO surrounded by denser consolidation ring (atoll sign)
  → Highly characteristic when present (sensitivity ~20%, specificity ~92% when other causes excluded)
  → Look for ring-shaped consolidation with central ground-glass opacity
  → **MUST EXCLUDE**: Fungal infections (mucormycosis, aspergillosis), granulomatosis with polyangiitis, sarcoidosis
✓ Perilobular/peribronchial consolidation and GGO (patchy distribution)
✓ Migratory/changing opacities on serial scans (if follow-up available)
✓ Patchy, bilateral, peripheral or peribronchovascular distribution
✓ Lower lobe predominance
✓ Air bronchograms common within consolidation
✓ **ABSOLUTELY NO honeycombing**, NO significant reticulation (distinguishes from fibrotic ILD)
✓ Subpleural sparing may be present (similar to NSIP but with consolidation not GGO)

⚠️ CRITICAL COP vs NSIP vs PNEUMONIA vs FUNGAL INFECTION:
COP (Organizing Pneumonia):
✓ Reverse halo sign (highly suggestive, not pathognomonic)
✓ Consolidation predominant with GGO
✓ Perilobular pattern (around lobules)
✓ NO honeycombing, NO traction bronchiectasis
✓ Exclude fungal infection/vasculitis first

NSIP:
✓ GGO predominant (>50%) with fine reticulation
✓ Subpleural sparing (1-2cm)
✓ NO consolidation, NO reverse halo
✓ Bilateral symmetric, homogeneous

Acute Pneumonia:
✓ Lobar/segmental consolidation
✓ Air bronchograms
✓ NO reverse halo typically
✓ Clinical correlation: acute symptoms

Invasive Fungal (mucor/aspergillus):
✓ Reverse halo sign can occur
✓ Nodules, masses common
✓ Clinical: immunocompromised
✓ Angioinvasion features

4. HYPERSENSITIVITY PNEUMONITIS (HP):
ACUTE/SUBACUTE HP:
✓ **MOSAIC ATTENUATION (PRIMARY DIAGNOSTIC FEATURE)**: Three-density pattern on CT
  → Areas of normal lung (black) + GGO (gray) + air trapping (very black)
  → Creates "patchwork quilt" appearance
  → Becomes more pronounced on expiratory images if available
✓ **CENTRILOBULAR NODULES** 2-4mm (poorly defined, ground-glass appearance)
  → Centered on small airways, NOT perilymphatic (differentiates from Sarcoidosis)
✓ Ground-glass opacities, patchy/diffuse distribution
✓ Mid/upper lung predominance OR diffuse (spares lower lobes relatively)
✓ NO honeycombing in acute/subacute phase

CHRONIC/FIBROTIC HP:
✓ Upper/mid lobe fibrosis with architectural distortion
✓ Centrilobular nodules + fibrosis (mixed acute and chronic features)
✓ Mosaic attenuation PERSISTS (key feature distinguishing from UIP)
✓ **Cysts may be present (UNLIKE UIP** - important distinction)
✓ **HEADCHEESE SIGN**: Mosaic attenuation with GGO, normal lung, and air trapping all visible
  → Highly characteristic for HP when present (supports diagnosis strongly)

⚠️ CRITICAL HP vs UIP/IPF vs SARCOIDOSIS DIFFERENTIATION:
HP (Hypersensitivity Pneumonitis):
✓ **Mosaic attenuation** (three-density pattern)
✓ **Centrilobular nodules** (poorly defined)
✓ Upper/mid lung predominance
✓ Cysts + fibrosis allowed
✓ Headcheese sign

UIP/IPF:
✓ NO mosaic attenuation
✓ NO centrilobular nodules
✓ Lower/peripheral predominance
✓ NO cysts (only honeycombing)
✓ Honeycombing ESSENTIAL

Sarcoidosis:
✓ NO mosaic attenuation
✓ **PERILYMPHATIC nodules** (not centrilobular)
✓ Upper/mid lung predominance
✓ Beaded pattern along vessels/septa
✓ Lymphadenopathy common

5. SARCOIDOSIS (Stage II-IV with pulmonary involvement):
✓ **PERILYMPHATIC NODULES (PRIMARY DIAGNOSTIC FEATURE - HIGHLY CHARACTERISTIC)**:
  → Nodules distributed along LYMPHATIC pathways (highly specific for sarcoidosis when present)
  → Along bronchovascular bundles (beaded appearance along vessels)
  → Along interlobular septa (septal nodules)
  → Subpleural nodules (immediate pleural surface)
  → Peribronchovascular interstitial thickening
  → Creates "beads on a string" or "rosary pattern" along vessels/septa
  → **NOTE**: While highly characteristic, lymphangitic carcinomatosis can rarely mimic this pattern
✓ **UPPER/MID LUNG PREDOMINANCE** (80% of cases - distinguishes from lower lobe ILDs)
✓ Bilateral hilar/mediastinal lymphadenopathy (if visible - highly supportive)
✓ **NODULAR BEADING ALONG FISSURES** (galaxy sign/cluster sign)
✓ Stage IV: Fibrosis with upper lobe volume loss, traction bronchiectasis
✓ Conglomerate masses in advanced cases (central/perihilar)

⚠️ CRITICAL SARCOIDOSIS vs HP vs RANDOM NODULES DIFFERENTIATION:
SARCOIDOSIS:
✓ **PERILYMPHATIC distribution** (along vessels, septa, pleura)
✓ Upper/mid lung predominance
✓ "Beads on string" pattern
✓ Lymphadenopathy common (90%)
✓ Well-defined nodules

HYPERSENSITIVITY PNEUMONITIS (HP):
✓ **CENTRILOBULAR distribution** (airway-centered)
✓ Upper/mid lung predominance
✓ Poorly defined, ground-glass nodules
✓ Mosaic attenuation present
✓ NO lymphadenopathy

METASTASES/RANDOM NODULES:
✓ **RANDOM distribution** (no pattern)
✓ Lower lobe predominance often
✓ Varying sizes
✓ NO lymphatic pattern
✓ Clinical history of malignancy

6. CTD-ILD (CONNECTIVE TISSUE DISEASE-RELATED ILD):
General CTD-ILD Features:
✓ **ILD PATTERN VARIES by underlying disease** (key: look for associated systemic findings)
✓ NSIP pattern MOST COMMON (60-70%) in systemic sclerosis, polymyositis/dermatomyositis
✓ UIP pattern in rheumatoid arthritis (RA-ILD)
✓ Organizing pneumonia pattern in polymyositis/dermatomyositis

✓ **ASSOCIATED EXTRAPULMONARY FINDINGS (PRIMARY DIAGNOSTIC CLUES)**:
  → Esophageal dilatation >10mm (systemic sclerosis - HIGHLY SPECIFIC)
  → Pleural effusion/thickening (RA, lupus)
  → Pericardial effusion (lupus, systemic sclerosis)
  → Dilated pulmonary arteries >29mm (pulmonary hypertension)
  → Dilated esophagus + ILD = strong indicator of CTD-ILD

⚠️ CRITICAL CTD-ILD RECOGNITION:
Look for ILD pattern PLUS one or more:
✓ Esophageal dilatation (systemic sclerosis)
✓ Pleural disease (RA, lupus)
✓ Pericardial effusion (lupus)
✓ Pulmonary hypertension signs

Pattern by Disease:
- Systemic sclerosis → NSIP (most common) + esophageal dilatation
- Rheumatoid arthritis → UIP pattern + pleural thickening
- Polymyositis/dermatomyositis → NSIP or COP
- Lupus → Acute/organizing pneumonia + pleural effusion

7. RB-ILD (RESPIRATORY BRONCHIOLITIS-ILD):
✓ **SMOKING-RELATED + UPPER LOBE PREDOMINANCE** (primary diagnostic clue)
✓ **Centrilobular nodules** (poorly defined, ground-glass appearance)
  → Centered on small airways in upper/mid lobes
✓ Patchy ground-glass opacities, **UPPER/MID lobe predominant**
✓ Minimal reticulation (unlike fibrotic ILDs)
✓ Bronchial wall thickening (smoker's bronchitis)
✓ **Upper lobe emphysema often COEXISTS** (both smoking-related)
✓ **NO honeycombing, NO significant fibrosis** (non-fibrotic ILD)

⚠️ CRITICAL RB-ILD vs DIP vs HP DIFFERENTIATION (all can have GGO + nodules):
RB-ILD:
✓ **Upper/mid lobe** predominance
✓ Centrilobular nodules
✓ Minimal, patchy GGO
✓ Coexisting emphysema common
✓ Smoking-related

DIP (see below):
✓ **Lower/peripheral** predominance
✓ NO nodules (only GGO)
✓ Diffuse, bilateral GGO
✓ Subpleural sparing may occur
✓ Smoking-related

HP (Hypersensitivity Pneumonitis):
✓ Upper/mid lung predominance
✓ Centrilobular nodules (poorly defined)
✓ **Mosaic attenuation** (key difference)
✓ NO smoking history
✓ Exposure history (birds, mold)

8. DIP (DESQUAMATIVE INTERSTITIAL PNEUMONIA):
✓ **DIFFUSE BILATERAL GROUND-GLASS OPACITIES** (primary feature - "ground-glass lung")
  → Bilateral, symmetric, diffuse distribution
  → GGO is the DOMINANT pattern (>70% of affected lung)
✓ **LOWER/PERIPHERAL lung predominance** (vs RB-ILD upper) - KEY DISTINCTION
✓ Subpleural sparing may occur (similar to NSIP but more diffuse GGO)
✓ Minimal/no reticulation (pure GGO pattern)
✓ Cystic changes in 1/3 of cases (small, scattered cysts)
✓ **NO honeycombing** (non-fibrotic, potentially reversible if smoking cessation)
✓ **NO nodules** (vs RB-ILD which has centrilobular nodules)
✓ Smoking-related (like RB-ILD) but more severe/diffuse

9. LIP (LYMPHOCYTIC INTERSTITIAL PNEUMONIA):
✓ **CYSTS + NODULES + GGO TRIAD** (primary diagnostic pattern)
  → Thin-walled cysts (scattered, random distribution, 1-30mm)
  → Centrilobular nodules (well-defined, unlike HP's poorly defined nodules)
  → Diffuse ground-glass opacities (background pattern)
✓ **Cysts are KEY DISTINGUISHING FEATURE** (present in 80% of cases)
✓ Interlobular septal thickening
✓ Bronchovascular bundle thickening (perivascular lymphoid infiltrates)
✓ **Associated with autoimmune diseases** (Sjögren's syndrome most common) or HIV
✓ Diffuse/lower lung distribution

⚠️ CRITICAL LIP vs HP vs CYSTIC DISEASES:
LIP:
✓ **Thin-walled cysts** (random) + **well-defined nodules** + GGO
✓ Autoimmune association (Sjögren's)
✓ NO mosaic attenuation
✓ Diffuse distribution

HP (Chronic):
✓ Cysts (if present) + **poorly defined nodules** + GGO
✓ **Mosaic attenuation** present
✓ Environmental exposure
✓ Upper/mid lobe predominance

LAM/Langerhans:
✓ Cysts ONLY (no nodules, no GGO)
✓ Thin-walled, numerous
✓ Young women (LAM) or smokers (Langerhans)

10. ASBESTOSIS:
✓ **PLEURAL PLAQUES (STRONG EXPOSURE EVIDENCE)**:
  → Focal pleural thickening, often CALCIFIED (proves asbestos exposure)
  → Bilateral, symmetric, on diaphragm/chest wall
  → **IMPORTANT**: Plaques prove EXPOSURE only, not causation of ILD
  → Patients with RA-UIP, IPF, or other ILDs may also have plaques from prior exposure
✓ Basal/peripheral reticulation and fibrosis (UIP-like pattern)
✓ **Subpleural curvilinear opacities** 1-3cm from pleura (more characteristic for asbestosis)
✓ Diffuse pleural thickening (visceral and parietal pleura)
✓ Honeycombing in advanced cases (late stage)
✓ Lower lobe predominance (basal, peripheral)
✓ **Occupational exposure history** (construction, shipyard, insulation)

⚠️ CRITICAL ASBESTOSIS vs UIP/IPF (CHALLENGING - both have similar patterns):
ASBESTOSIS (consider when):
✓ **Pleural plaques** (calcified) + **occupational exposure** = strong evidence
✓ Diffuse pleural thickening
✓ **Subpleural curvilinear lines 1-3cm from pleura** (more suggestive of asbestosis)
✓ Lower lobe fibrosis UIP-like pattern
✓ **CORRELATION REQUIRED**: Parenchymal pattern + plaques + exposure history

UIP/IPF:
✓ May have pleural plaques from incidental exposure (plaques alone don't exclude IPF)
✓ Subpleural reticulation <1cm from pleura (immediately subpleural)
✓ No clear exposure history
✓ **If plaques present but pattern more consistent with UIP → may be IPF with incidental plaques**

**DECISION RULE**: Pleural plaques + occupational exposure + subpleural curvilinear opacities (1-3cm) = favor Asbestosis. Plaques alone insufficient without corroborating parenchymal features and exposure history.

11. PPFE (PLEUROPARENCHYMAL FIBROELASTOSIS):
✓ **UPPER LOBE FIBROSIS + PLEURAL THICKENING** (PRIMARY DIAGNOSTIC FEATURE - highly distinctive)
  → This upper lobe distribution distinguishes PPFE from most other ILDs
  → Subpleural fibrosis predominantly affecting upper lobes
  → Pleural thickening overlying the fibrotic areas
✓ Progressive upper lobe volume loss (flattening of chest)
✓ Architectural distortion with traction bronchiectasis in upper lobes
✓ **Lower lobes RELATIVELY SPARED** (opposite of UIP/IPF)
✓ Sharp demarcation between affected upper and spared lower lobes
✓ May have associated features (bone marrow transplant, chemotherapy history)

⚠️ CRITICAL PPFE vs UIP/IPF vs HP:
PPFE:
✓ **UPPER lobe** fibrosis + pleural thickening
✓ Lower lobes spared
✓ Subpleural distribution
✓ Pleural thickening present

UIP/IPF:
✓ **LOWER lobe** predominance
✓ Upper lobes spared
✓ Subpleural distribution
✓ NO pleural thickening

HP (Chronic):
✓ Upper/mid lobe fibrosis
✓ Mosaic attenuation present
✓ Centrilobular nodules
✓ NO pleural thickening

═══════════════════════════════════════════════════════════════
SUBTYPE DETERMINATION ALGORITHM
═══════════════════════════════════════════════════════════════

Step 1: DISTRIBUTION PATTERN
- Upper lobe → HP (fibrotic), Sarcoidosis, PPFE, smoking-related (RB-ILD)
- Lower lobe → UIP/IPF, NSIP, Asbestosis, CTD-ILD
- Peripheral → UIP, NSIP (with sparing), Asbestosis
- Peribronchovascular → Sarcoidosis, organizing pneumonia
- Diffuse → Advanced fibrosis, acute HP, DIP, LIP

Step 2: CHECK SUBPLEURAL REGION FIRST (CRITICAL FOR NSIP vs UIP)
⚠️ EXAMINE the outer 1-2cm of lung periphery carefully:
→ SUBPLEURAL SPARING (1-2cm clear zone) present? → Consider NSIP
→ SUBPLEURAL INVOLVEMENT (<1cm from pleura) present? → Consider UIP/IPF
→ This is the FIRST and MOST IMPORTANT distinguishing feature!

Step 3: DOMINANT PATTERN
- Honeycombing present → UIP/IPF (if basal/peripheral + subpleural involvement) or Advanced HP/Asbestosis
  ⚠️ But if subpleural sparing present → NOT UIP, reconsider diagnosis
- GGO predominant → NSIP (if subpleural sparing), DIP, acute HP, organizing pneumonia
  → If GGO + subpleural sparing + lower lobe → **NSIP is primary diagnosis**
- Perilymphatic nodules → Sarcoidosis
- Centrilobular nodules → HP, RB-ILD, LIP
- Consolidation + reverse halo → Organizing pneumonia

Step 4: KEY DISTINGUISHING FEATURES (DECISION TREE)
FIRST: Check subpleural sparing
- **Subpleural sparing (1-2cm clear zone) → NSIP (classic)** or organizing pneumonia
  → If also GGO predominant + lower lobe → **Definitely NSIP**
  → If consolidation dominant → organizing pneumonia
  
THEN: Check for UIP features if no sparing
- Subpleural involvement + honeycombing + heterogeneous → **UIP/IPF**
- **Pleural plaques + subpleural curvilinear opacities (1-3cm) + occupational exposure → favor Asbestosis**
  → Plaques alone insufficient (prove exposure only, not causation)
- Temporal heterogeneity (patchwork) → UIP/IPF
  
OTHER FEATURES:
- Cysts + fibrosis → Chronic HP, LIP
- Reverse halo sign → Organizing pneumonia (exclude fungal/vasculitis first)
- Headcheese sign → HP

⚠️ NEVER diagnose UIP/IPF if subpleural sparing is present!
⚠️ NEVER diagnose NSIP if honeycombing is present!
⚠️ NEVER diagnose Asbestosis on pleural plaques alone without corroborating parenchymal features!

Step 5: SELECT PRIMARY SUBTYPE
Priority order for lower lobe fibrotic disease:
1. Check subpleural sparing → If YES: NSIP (if GGO predominant)
2. Check honeycombing → If YES and no sparing: UIP/IPF
3. Check pleural plaques + subpleural curvilinear opacities + exposure → If ALL present: favor Asbestosis
   → If plaques present but other features point to UIP → may be IPF with incidental plaques
4. If multiple patterns → report as "Mixed" with description of components

QUANTIFICATION:
- Mild: <25% lung involvement, minimal traction
- Moderate: 25-50% involvement, clear architectural distortion
- Severe: >50% involvement, extensive honeycombing, respiratory compromise

COEXISTING PATHOLOGIES (CRITICAL - INDEPENDENT EVALUATION):
⚠️ ILD can COEXIST with COPD, pneumonia, TB, and other conditions
⚠️ Evaluate fibrotic patterns INDEPENDENTLY - do not automatically dismiss when other pathologies visible
⚠️ Distinguish CHRONIC fibrosis (ILD) from ACUTE/ORGANIZING patterns (infection mimics)

CHRONIC FIBROSIS (TRUE ILD) vs ACUTE MIMICS (NOT ILD):
✓ TRUE ILD: Honeycombing, traction bronchiectasis, architectural distortion, subpleural reticulation with CHRONIC morphology
✓ Chronic features: Well-defined cysts, irreversible distortion, peripheral/basal distribution, no air bronchograms
✗ ACUTE MIMICS: Organizing pneumonia (perilobular opacities), aspiration (dependent), interstitial edema (smooth septal thickening)
✗ Exclude if: predominantly consolidative, air bronchograms dominant, reverse halo sign, acute time-course suggested

DECISION LOGIC (for "present" Boolean - tied to confidence assessment):

Step 1: Identify chronic fibrotic features (honeycombing, traction bronchiectasis, subpleural reticulation, architectural distortion)
Step 2: Identify acute/organizing mimics (organizing pneumonia, interstitial edema, acute consolidation)  
Step 3: Assess confidence tier based on chronic vs acute balance:

CONFIDENCE TIERS (determines both confidence score AND "present" Boolean):
- DEFINITE ILD (95% confidence): 
  * Honeycombing + traction bronchiectasis + peripheral/basal distribution
  * Minimal/no acute mimics, or chronic features clearly predominate
  * "present": TRUE
  
- PROBABLE ILD (75-85% confidence):
  * ≥2 chronic fibrotic features with architectural distortion
  * Acute mimics present but chronic features clearly outweigh them
  * Can explain findings as chronic ILD with reasonable certainty
  * "present": TRUE
  
- POSSIBLE/UNCERTAIN (50-70% confidence):
  * Some chronic features present but significant acute patterns also visible
  * Cannot definitively exclude acute mimics as primary cause
  * Chronic and acute patterns roughly balanced or unclear predominance
  * "present": FALSE (insufficient confidence for positive diagnosis)
  
- UNLIKELY (40% confidence):
  * Minimal/no chronic features, predominantly acute/organizing patterns
  * "present": FALSE

COEXISTENCE HANDLING:
- ILD can coexist with organizing pneumonia, infections, COPD
- When BOTH chronic AND acute patterns present: assess which predominates
- Chronic must clearly OUTWEIGH acute for "present": true (PROBABLE tier or higher)
- Always document contradicting evidence even when "present": true
- If acute patterns cannot be reasonably excluded → "present": false (POSSIBLE tier)

IGNORE (NOT ILD - when patterns absent):
- Masses, nodules >10mm (unless perilymphatic pattern)
- Pure emphysema without interstitial changes (no reticulation/traction)
- Pure acute consolidation without any chronic fibrotic patterns
- Vascular findings
- Pleural findings
- Pneumothorax

⚠️⚠️⚠️ OUTPUT FORMAT INSTRUCTIONS - READ CAREFULLY ⚠️⚠️⚠️
In the "reasoning" field below, you MUST follow this EXACT format:

ILD SUBTYPE: [Full name - e.g., 'UIP/IPF (Usual Interstitial Pneumonia / Idiopathic Pulmonary Fibrosis)']

FINDINGS:
- Subpleural region: [Describe sparing present/absent with 1-2cm measurement]
- Pattern description: [Distinguish honeycombing from GGO, describe what you see]
- Distribution: [Lobe location and pattern distribution]
- Dominant pattern: [GGO vs reticulation vs honeycombing with %]
- Key diagnostic features: [Features that led to this subtype diagnosis]
- Algorithm confirmation: [For NSIP: confirm subpleural sparing + GGO + NO honeycombing] [For UIP/IPF: confirm subpleural involvement + honeycombing + minimal GGO]

❌ DO NOT include "MANDATORY REQUIREMENTS" header
❌ DO NOT include numbered requirements (1, 2, 3, etc.)
✅ START directly with "ILD SUBTYPE: [name]"
✅ Then follow with "FINDINGS:" section

JSON format (ILD analysis only):
{
  "present": boolean,
  "confidence": number (0-100),
  "subtype": "UIP/IPF" | "NSIP" | "COP" | "HP" | "Sarcoidosis" | "CTD-ILD" | "RB-ILD" | "DIP" | "LIP" | "Asbestosis" | "PPFE" | "Mixed" | "none",
  "reasoning": "Start directly with 'ILD SUBTYPE: [name]' then FINDINGS bullets as shown above",
  "supporting_evidence": "ALL evidence for ILD with specific anatomical locations, subtype-specific features, and SUBPLEURAL REGION findings",
  "contradicting_evidence": "ALL evidence against ILD and alternative diagnoses to consider"
}`
  };
}

// 3. MASS/NODULE-ONLY Analysis Prompt
export function createMassPrompt(patientInfo: { examDate: string }): PathologyPrompt {
  return {
    pathologyName: "Mass",
    systemPrompt: "You are a computer vision system focused EXCLUSIVELY on detecting focal lung masses and nodules for educational purposes.",
    userPrompt: `SINGLE PATHOLOGY DETECTION: Lung Masses/Nodules ONLY

CRITICAL: Analyze ONLY for focal masses and nodules. Ignore all other pathologies.

SYSTEMATIC ZONE-BY-ZONE SCANNING:
1. RIGHT upper zone: Any solid opacity ≥4mm?
2. RIGHT middle zone: Any solid opacity ≥4mm?
3. RIGHT lower zone: Any solid opacity ≥4mm?
4. LEFT upper zone: Any solid opacity ≥4mm?
5. LEFT lower zone: Any solid opacity ≥4mm?

DETECTION CRITERIA (HIGH SENSITIVITY - MISSING CANCER IS UNACCEPTABLE):
✓ ANY focal solid/part-solid opacity ≥4mm (Fleischner standard - DO NOT MISS)
✓ Solid nodules: Soft tissue attenuation (30-60 HU), round/oval shape
✓ Ground-glass nodules ≥6mm (lower threshold for GGNs)
✓ Part-solid nodules ≥4mm (ANY part-solid is concerning)
✓ WHEN UNCERTAIN → FLAG AS DETECTED for radiologist review (sensitivity priority)

CRITICAL VESSEL EXCLUSION (Must rule out BEFORE calling negative):
✗ VESSEL characteristics: Tubular shape, branching pattern, connects to other vessels
✗ VESSEL test: Follow structure through 3+ consecutive slices - vessels maintain tubular continuity
✗ VESSEL location: Along expected vascular distribution (hilar, segmental branches)
✓ NODULE characteristics: Round/oval, discrete margins, does NOT branch or connect

CRITICAL DISTINCTION:
✓ NODULE: Round/oval, discrete, soft tissue attenuation, does NOT extend tubularly
✗ HONEYCOMB CYST: Thin-walled, AIR attenuation (black), clustered
✗ VESSEL: Tubular, branching, continuous through slices - TRACE IT TO CONFIRM
✗ <4mm: Below Fleischner threshold (but note if multiple present)

IGNORE:
- Emphysema, bullae, airspace disease
- Interstitial patterns (distinguish from nodules!)
- Consolidations, infections
- Vascular findings
- Pleural findings
- Pneumothorax

JSON format (Mass analysis only):
{
  "present": boolean,
  "confidence": number (0-100),
  "reasoning": "ALL nodules found with location, size, features",
  "supporting_evidence": "evidence for nodules/masses",
  "contradicting_evidence": "evidence against nodules/masses"
}`
  };
}

// 4. PE-ONLY Analysis Prompt
export function createPEPrompt(patientInfo: { examDate: string }): PathologyPrompt {
  return {
    pathologyName: "PE",
    systemPrompt: "You are a computer vision system focused EXCLUSIVELY on detecting pulmonary embolism for educational purposes.",
    userPrompt: `SINGLE PATHOLOGY DETECTION: Pulmonary Embolism (PE) ONLY

CRITICAL: Analyze ONLY for PE. Ignore all other pathologies.

DETECTION CRITERIA (REQUIRES DEFINITE EVIDENCE):
✓ Intraluminal filling defect in pulmonary arteries (MOST SPECIFIC - central/saddle clot)
✓ Central filling defect outlined by contrast within vessel lumen
✓ Abrupt vessel termination/cutoff with truncation >2mm diameter
✓ RV/LV ratio >1.2 (INCREASED from 1.0) + corresponding pulmonary artery >30mm
✓ Peripheral wedge-shaped consolidation (Hampton's hump) + above findings
✓ Mosaic attenuation pattern ONLY if with other PE findings (not alone)

CRITICAL: RV/LV or mosaic attenuation ALONE are insufficient - require confirmation with intraluminal findings

IGNORE:
- Masses, nodules
- Emphysema, ILD
- Consolidations, infections
- Pleural findings
- Pneumothorax

JSON format (PE analysis only):
{
  "present": boolean,
  "confidence": number (0-100),
  "reasoning": "detailed PE findings",
  "supporting_evidence": "evidence for PE",
  "contradicting_evidence": "evidence against PE"
}`
  };
}

// 5. PNEUMONIA-ONLY Analysis Prompt
export function createPneumoniaPrompt(patientInfo: { examDate: string }): PathologyPrompt {
  return {
    pathologyName: "Pneumonia",
    systemPrompt: "You are a computer vision system focused EXCLUSIVELY on detecting pneumonia patterns for educational purposes.",
    userPrompt: `SINGLE PATHOLOGY DETECTION: Pneumonia ONLY

CRITICAL: Analyze ONLY for pneumonia. Ignore all other pathologies.

DETECTION CRITERIA (MUST HAVE DEFINITE ACUTE FEATURES):
✓ Consolidation with air bronchograms in lobar/segmental distribution (MOST SPECIFIC)
✓ Lobar/segmental consolidation with ACUTE appearance (not chronic fibrosis)
✓ Centrilobular nodules + branching opacities ONLY if in dependent segments + acute clinical context
✓ Acute ground-glass opacities with lobar/segmental distribution (NOT diffuse)

STRICT EXCLUSIONS - REPORT NEGATIVE IF:
- Any TB-specific features present (cavitation, necrotic nodes, upper lobe + tree-in-bud)
- Chronic/fibrotic changes without acute consolidation
- Isolated centrilobular nodules in upper lobes (favor TB over pneumonia)
- Basilar atelectasis or dependent airspace collapse (NOT pneumonia)

IGNORE:
- Masses, nodules
- Emphysema, ILD
- TB patterns (separate analysis)
- Vascular findings
- Pleural findings
- Pneumothorax

JSON format (Pneumonia analysis only):
{
  "present": boolean,
  "confidence": number (0-100),
  "reasoning": "detailed pneumonia findings",
  "supporting_evidence": "evidence for pneumonia",
  "contradicting_evidence": "evidence against pneumonia"
}`
  };
}

// 6. TB-ONLY Analysis Prompt (ENHANCED ROBUST DETECTION)
export function createTBPrompt(patientInfo: { examDate: string }): PathologyPrompt {
  return {
    pathologyName: "TB",
    systemPrompt: "You are an expert infectious disease radiologist computer vision system focused EXCLUSIVELY on detecting ACTIVE tuberculosis with high specificity to prevent false positives for educational purposes.",
    userPrompt: `SINGLE PATHOLOGY DETECTION: Tuberculosis (TB) ONLY - ENHANCED ROBUST DETECTION

CRITICAL: Analyze ONLY for TB patterns. Report "present": true ONLY for ACTIVE TB.

TIER 1 - DEFINITIVE TB COMBINATIONS (Sufficient alone for ACTIVE TB diagnosis):
✓ Thick-walled cavity >3mm + tree-in-bud pattern (combination highly specific for active TB)
✓ Thick-walled cavity >3mm upper lobe + centrilobular nodules (combination highly specific)
✓ Necrotic lymph nodes (central HU <20) + upper lobe consolidation/cavitation (combination highly specific)
✓ Miliary pattern (diffuse 1-3mm nodules ALL zones bilateral) + ANY upper lobe consolidation/cavity

TIER 2 - SUGGESTIVE TB PATTERNS (Require 2+ for diagnosis):
These patterns have differential diagnoses - need COMBINATION of 2+ patterns for TB diagnosis

CAVITARY PATTERNS:
✓ Thick-walled cavity >3mm in upper lobes (DDx: fungal, abscess, cancer)
✓ Multiple cavities bilateral upper lobe predominant
✓ Cavity with irregular inner wall, air-fluid level
✓ Ragged cavity surrounding consolidation/nodules

ENDOBRONCHIAL SPREAD:
✓ Tree-in-bud pattern: Centrilobular nodules + branching opacities (DDx: aspiration, bronchiolitis, atypical infections)
✓ Centrilobular nodules 2-4mm (DDx: aspiration, atypical infections)
✓ V/Y-shaped branching opacities from bronchiolar impaction
✓ Rosette sign: Clustered centrilobular nodules

MILIARY/DISSEMINATED PATTERN:
✓ Miliary pattern: Diffuse random 1-3mm micronodules bilateral (DDx: fungal, metastases, but highly suggestive TB)
✓ "Millet seed" nodules throughout all lung zones
✓ Bilateral symmetric uniform distribution

CONSOLIDATION:
✓ Upper lobe/apical segment consolidation (DDx: bacterial pneumonia, Klebsiella)
✓ Patchy/confluent consolidation, upper lobe predominant
✓ Mass-like consolidation >3cm (tuberculoma - DDx: cancer, fungal)

LYMPHADENOPATHY:
✓ Necrotic lymph nodes: Central low HU <20, rim enhancement (DDx: lymphoma, fungal, metastasis)
✓ Matted/conglomerate nodes >10mm (DDx: sarcoid, lymphoma)
✓ Hilar/mediastinal/paratracheal nodes >10mm with necrosis

DISTRIBUTION CLUES:
✓ Upper lobe/apical-posterior segment predominance (85% post-primary TB)
✓ Superior segment lower lobe involvement
✓ Bilateral symmetric involvement (active disseminated disease)

PLEURAL INVOLVEMENT (TB Pleurisy):
✓ Unilateral effusion + upper lobe consolidation/nodules
✓ Loculated effusion with pleural thickening/enhancement
✓ Effusion with lung parenchymal TB findings

CHRONIC/INACTIVE TB (Report as "present": false, mention in reasoning):
These indicate PRIOR TB, NOT active disease:
✓ Fibro-calcific scarring upper lobes WITHOUT active consolidation
✓ Calcified granulomas/lymph nodes WITHOUT active features
✓ Volume loss with bronchiectasis, stable appearance
✓ Pleural thickening with calcification, no active effusion

CRITICAL DECISION RULES WITH CONTRADICTORY EVIDENCE BALANCING:
1. Tier 1 definitive combination present → "present": true (high confidence 85-95%)
2. 2+ Tier 2 patterns in upper lobes + NO contradictory features → "present": true (moderate confidence 70-85%)
3. 2+ Tier 2 patterns BUT contradictory features present (fungal risk, aspiration, lower lobe) → "present": false (alternative diagnosis likely)
4. 1 Tier 2 pattern alone → "present": false (insufficient, note in reasoning as possible TB)
5. Chronic/inactive findings ONLY → "present": false (healed TB, mention in reasoning)
6. Non-specific consolidation without TB patterns → "present": false
7. Tree-in-bud in dependent/lower lobes → favor aspiration over TB unless upper lobe findings coexist

CONTRADICTORY EVIDENCE SUPPRESSION:
- Fungal pattern (immunocompromised, halo sign, angioinvasion) → suppresses TB unless cavity + tree-in-bud present
- Aspiration pattern (dependent segments, bilateral lower lobes) → suppresses TB unless upper lobe cavitation present
- Bacterial pneumonia (acute, lower lobe, lobar consolidation) → suppresses TB unless necrotic nodes or cavitation
- Cancer (single mass, older age, no tree-in-bud) → suppresses TB unless biopsy-proven

DIFFERENTIAL DIAGNOSES TO ACTIVELY EXCLUDE:
- Bacterial pneumonia: Lower/middle lobe predominant, acute, no cavitation
- Fungal (Aspergillus, Crypto): Immunocompromised host, halo sign, angioinvasion
- Nodule/Mass: Older age, single mass, spiculated, no tree-in-bud or miliary
- Sarcoidosis: Perilymphatic nodules, lymph nodes enlarged but NOT necrotic
- Aspiration: Tree-in-bud/centrilobular nodules in DEPENDENT segments (lower/posterior)

QUANTIFICATION (For confirmed active TB):
- Minimal: <2cm infiltrate, no cavitation, limited 1-2 segments
- Moderate: >2cm infiltrate OR cavity <4cm, ≤1 lobe
- Advanced: Large cavity >4cm OR bilateral extensive >1 lobe
- Miliary: Diffuse micronodular pattern all zones

IGNORE (NOT TB):
- Masses, nodules without TB-specific features
- Emphysema, ILD patterns
- Simple pneumonia lower lobes
- Vascular findings
- Pneumothorax

JSON format (TB analysis only):
{
  "present": boolean,
  "confidence": number (0-100),
  "reasoning": "comprehensive findings with TIER classification, PATTERN combinations, and activity assessment",
  "supporting_evidence": "ALL ACTIVE TB evidence with specific tier patterns",
  "contradicting_evidence": "ALL evidence against TB, alternative diagnoses, or inactive findings"
}`
  };
}

// 7. PLEURAL EFFUSION-ONLY Analysis Prompt (BALANCED SPECIFICITY - FALSE POSITIVE REDUCTION)
export function createPleuralPrompt(patientInfo: { examDate: string }): PathologyPrompt {
  return {
    pathologyName: "PleuralEffusion",
    systemPrompt: "You are an expert thoracic radiologist computer vision system focused EXCLUSIVELY on detecting pleural effusion with BALANCED accuracy. Carefully distinguish true pleural fluid from common mimickers while maintaining sensitivity for genuine effusions including small and loculated collections.",
    userPrompt: `SINGLE PATHOLOGY DETECTION: Pleural Effusion ONLY - BALANCED DETECTION

CRITICAL: Analyze ONLY for pleural effusion. Carefully distinguish TRUE pleural fluid from mimickers.

═══════════════════════════════════════════════════════════════════════════════
PRIMARY DETECTION SIGNS (Require at least ONE for positive diagnosis):
═══════════════════════════════════════════════════════════════════════════════

TIER 1 - HIGH CONFIDENCE SIGNS (Any one = confident positive):
✓ Meniscus sign: Concave curved fluid interface at costophrenic angle (GOLD STANDARD)
✓ Layering fluid: Gravity-dependent FLUID with water attenuation (0-20 HU) in pleural space
✓ Blunting with measurable fluid: Costophrenic angle blunting WITH visible fluid collection ≥8mm

TIER 2 - MODERATE CONFIDENCE SIGNS (Require 2+ for positive, or 1 + confirmatory sign):
✓ Posterior gutter fluid: Dependent collection in posterior thorax (supine imaging)
✓ Trace effusion: Measurable fluid 5-8mm with water attenuation confirmed
✓ Subpulmonic effusion: Fluid beneath lung base with lateral peak sign
✓ Interlobar effusion: Lenticular fluid collection in fissure (minor/major)

TIER 3 - LOCULATED/COMPLEX EFFUSION SIGNS (Confirm with clinical context):
✓ Split pleura sign: Separated, thickened visceral and parietal pleura with fluid between
✓ Lenticular/biconvex collection: Fixed position, doesn't layer with position change
✓ Septated collection: Internal linear densities (fibrinous strands) within fluid
✓ Pleural enhancement with fluid: Thickened enhancing pleura surrounding fluid

CONFIRMATORY SIGNS (Support diagnosis when primary signs present):
✓ Passive atelectasis: Adjacent lung compression/collapse from fluid mass effect
✓ Diaphragm displacement: Inferior displacement by fluid
✓ Homogeneous fluid attenuation: 0-20 HU throughout collection
✓ Smooth pleural margins conforming to pleural space anatomy

═══════════════════════════════════════════════════════════════════════════════
CRITICAL FALSE POSITIVE AVOIDANCE - MUST RULE OUT BEFORE CALLING POSITIVE:
═══════════════════════════════════════════════════════════════════════════════
✗ NORMAL DIAPHRAGM MUSCLE: Diaphragmatic crura appear as soft tissue density (30-50 HU) at lung bases - NOT EFFUSION
✗ NORMAL LIVER/SPLEEN DOME: Subdiaphragmatic organs visible through thin lung - higher attenuation than fluid
✗ DEPENDENT ATELECTASIS: Collapsed lung at bases (supine) - shows LUNG TISSUE architecture, not homogeneous fluid
✗ SUBPLEURAL FAT: Fat density (-50 to -100 HU) along chest wall - NOT EFFUSION (wrong attenuation)
✗ PERICARDIAL FAT PAD: Fat near heart at cardiophrenic angle - NOT EFFUSION
✗ PARTIAL VOLUME ARTIFACT: Apparent "fluid" at interfaces - verify on adjacent slices
✗ CONSOLIDATION AT BASE: Lung parenchymal disease - shows air bronchograms, NOT pure fluid
✗ ASCITES: Abdominal fluid BELOW diaphragm - NOT pleural effusion (diaphragm is boundary)
✗ CHEST WALL SOFT TISSUE: Normal intercostal muscles - NOT PLEURAL FLUID
✗ PLEURAL THICKENING ALONE: Thickened pleura without fluid collection ≠ effusion

HOW TO DISTINGUISH TRUE EFFUSION FROM MIMICKERS:
1. MEASURE ATTENUATION: True effusion = 0-20 HU. Muscle/organ = 30-60 HU. Fat = -50 to -100 HU. Lung = -700 to -900 HU
2. CHECK LOCATION: Must be IN pleural space (between chest wall/diaphragm and lung surface)
3. VERIFY MORPHOLOGY: True effusion has smooth margins conforming to pleural space; atelectasis shows lung architecture
4. TRACE BOUNDARIES: Diaphragm should be visible as SEPARATE structure; liver/spleen are BELOW diaphragm
5. LOOK FOR MASS EFFECT: True effusion compresses adjacent lung; mimickers don't cause mass effect

QUANTIFICATION (When effusion confirmed):
- Trace: 5-8mm thickness (water attenuation confirmed)
- Small: 8-25mm maximal thickness
- Moderate: 25-50mm thickness with partial lung compression
- Large: >50mm thickness with significant lung compression or mediastinal shift

LATERALITY: Right-sided, Left-sided, or Bilateral (symmetric vs asymmetric)

SPECIAL SITUATIONS:
⚠ Supine CT: Posterior layering is EXPECTED location - verify water attenuation to confirm
⚠ Lung bases: High false positive zone - carefully distinguish from diaphragm/subdiaphragmatic organs by attenuation
⚠ Anterior effusion: Less common but can occur, especially loculated - look for pleural space location
⚠ Complex effusion: May have higher attenuation (20-40 HU) if hemorrhagic/proteinaceous - still call positive if in pleural space

IGNORE (NOT PLEURAL EFFUSION):
- Masses, nodules, pleural-based tumors
- Emphysema, ILD patterns, ground-glass opacity
- Lung parenchymal consolidations (pneumonia)
- Vascular findings
- Pneumothorax (air, not fluid)
- Pericardial effusion (different compartment)

CONFIDENCE CALIBRATION:
- 90-100%: TIER 1 sign present with confirmed water attenuation
- 80-89%: TIER 2 signs (2+) or TIER 1 without attenuation confirmation
- 70-79%: TIER 2 (1) + confirmatory sign, or TIER 3 with clear fluid
- 60-69%: Uncertain but probable effusion - report as present with lower confidence
- <60%: Insufficient evidence - report as NEGATIVE with reasoning

JSON format (Pleural Effusion analysis only):
{
  "present": boolean,
  "confidence": number (0-100),
  "reasoning": "detailed description of specific signs seen (TIER classification), attenuation values, and how mimickers were ruled out",
  "supporting_evidence": "SPECIFIC signs confirming effusion: sign type, location, measured thickness, attenuation values, laterality",
  "contradicting_evidence": "ALL evidence against effusion including which mimickers were considered and ruled out"
}`
  };
}

// 8. PNEUMOTHORAX-ONLY Analysis Prompt
export function createPneumothoraxPrompt(patientInfo: { examDate: string }): PathologyPrompt {
  return {
    pathologyName: "Pneumothorax",
    systemPrompt: "You are a computer vision system focused EXCLUSIVELY on detecting pneumothorax for educational purposes.",
    userPrompt: `SINGLE PATHOLOGY DETECTION: Pneumothorax ONLY

CRITICAL: Analyze ONLY for pneumothorax. Ignore all other pathologies.

DETECTION CRITERIA (PRIORITY - EMERGENCY):
✓ Visceral pleural line: Clear separation from parietal pleura (MOST SPECIFIC)
✓ Absence of lung markings peripheral to pleural line
✓ Deep sulcus sign: Abnormally lucent costophrenic angle
✓ Collapsed lung with visible edge and retraction
✓ Mediastinal shift (tension pneumothorax)

CRITICAL DISTINCTION:
✓ Pneumothorax: CONVEX pleural line + NO vascular markings beyond
✗ Bullae/Emphysema: CONCAVE walls + WITHIN parenchyma

TRACE ENTIRE PLEURAL LINE:
1. Apex to base on every slice
2. Look for even subtle separation ≥1mm
3. Verify absence of lung markings peripherally

IGNORE:
- Masses, nodules
- Emphysema, bullae (distinguish carefully!)
- ILD patterns
- Consolidations, infections
- Vascular findings
- Pleural effusion

JSON format (Pneumothorax analysis only):
{
  "present": boolean,
  "confidence": number (0-100),
  "reasoning": "detailed pneumothorax findings with measurements",
  "supporting_evidence": "evidence for pneumothorax",
  "contradicting_evidence": "evidence against pneumothorax"
}`
  };
}

// Master function to get all 8 prompts
export function getAllPathologyPrompts(patientInfo: { examDate: string }): PathologyPrompt[] {
  return [
    createCOPDPrompt(patientInfo),
    createILDPrompt(patientInfo),
    createMassPrompt(patientInfo),
    createPEPrompt(patientInfo),
    createPneumoniaPrompt(patientInfo),
    createTBPrompt(patientInfo),
    createPleuralPrompt(patientInfo),
    createPneumothoraxPrompt(patientInfo)
  ];
}
