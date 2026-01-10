# Determinism Test Plan

## Purpose
Verify that identical CT slices uploaded multiple times produce 100% identical pathology detection results.

## Root Cause (Fixed)
The system had two sources of non-determinism:
1. **Unstable variance sorting**: When slices had equal variance, sort order was unpredictable
2. **Object.keys() iteration**: Pathology vote counting order varied across runs

## Fixes Applied
1. **Line 179-183** in `server/services/medical-analysis.ts`: Added stable tie-breaker to variance sorting
2. **Line 366-369**: Replaced Object.keys() with explicit pathologyKeys array

## Test Procedure

### Step 1: Prepare Test CT Slices
1. Choose a set of CT slices (e.g., 10-20 slices from a single study)
2. Save them to your local machine

### Step 2: First Upload
1. Upload the CT slices to DecXpert CT
2. Wait for analysis to complete
3. **Save the Analysis ID** from the URL (e.g., `b1a2d887-779e-4027-8612-43197a66d083`)
4. Open browser DevTools > Network tab
5. Find the GET request to `/api/ct-analysis/{id}`
6. Copy the **full JSON response** and save to `test-run-1.json`

### Step 3: Second Upload (Same Slices)
1. Upload the **exact same CT slices** again
2. Wait for analysis to complete  
3. **Save the new Analysis ID**
4. Copy the **full JSON response** and save to `test-run-2.json`

### Step 4: Third Upload (Verify Consistency)
1. Upload the **exact same CT slices** a third time
2. Wait for analysis to complete
3. **Save the Analysis ID**
4. Copy the **full JSON response** and save to `test-run-3.json`

### Step 5: Compare Results
Use a JSON diff tool to compare the files:

```bash
# Using jq to extract only the medical findings (ignore timestamps, IDs, etc.)
jq '.findings' test-run-1.json > findings-1.json
jq '.findings' test-run-2.json > findings-2.json
jq '.findings' test-run-3.json > findings-3.json

# Compare findings
diff findings-1.json findings-2.json
diff findings-2.json findings-3.json
```

## Expected Results ✅

### All 3 runs should have IDENTICAL:
- ✅ `primaryDiagnosis` (e.g., "Tuberculosis")
- ✅ `findings.copdDetected` (true/false)
- ✅ `findings.ildDetected` (true/false)  
- ✅ `findings.pulmonaryEmbolismDetected` (true/false)
- ✅ `findings.pneumoniaDetected` (true/false)
- ✅ `findings.tuberculosisDetected` (true/false)
- ✅ `findings.massDetected` (true/false)
- ✅ `findings.pleuralEffusionDetected` (true/false)
- ✅ `findings.pneumothoraxDetected` (true/false)
- ✅ `findings.massFindings` (exact text)
- ✅ `findings.vascularFindings` (exact text)
- ✅ `findings.infectiousFindings` (exact text)
- ✅ `findings.pleuralFindings` (exact text)
- ✅ `findings.copdFindings` (exact text if COPD detected)
- ✅ `findings.ildFindings` (exact text if ILD detected)
- ✅ `differentialDiagnoses` (same diagnoses with same probabilities and reasoning)

### These MAY differ (expected):
- ❌ `id` (unique analysis ID per upload)
- ❌ `timestamp` (upload time)
- ❌ `processingTime` (slight variations in API latency)

## Quick Test Command Line

```bash
# Compare pathology detections (should be identical)
diff <(jq -S '.findings | {copdDetected, ildDetected, pulmonaryEmbolismDetected, pneumoniaDetected, tuberculosisDetected, massDetected, pleuralEffusionDetected, pneumothoraxDetected}' test-run-1.json) \
     <(jq -S '.findings | {copdDetected, ildDetected, pulmonaryEmbolismDetected, pneumoniaDetected, tuberculosisDetected, massDetected, pleuralEffusionDetected, pneumothoraxDetected}' test-run-2.json)

# Compare findings text (should be identical)
diff <(jq -S '.findings | {massFindings, vascularFindings, infectiousFindings, pleuralFindings, copdFindings, ildFindings}' test-run-1.json) \
     <(jq -S '.findings | {massFindings, vascularFindings, infectiousFindings, pleuralFindings, copdFindings, ildFindings}' test-run-2.json)

# Compare differential diagnoses (should be identical)
diff <(jq -S '.differentialDiagnoses' test-run-1.json) \
     <(jq -S '.differentialDiagnoses' test-run-2.json)
```

## Success Criteria
**PASS**: All pathology detections and findings text are byte-for-byte identical across all 3 runs  
**FAIL**: Any pathology detection or findings text differs between runs

## If Test Fails
If results differ:
1. Check server logs for any errors during analysis
2. Verify all 3 uploads used the EXACT same slices in the EXACT same order
3. Report the differences with analysis IDs for debugging
