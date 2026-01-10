# DecXpert CT - Imaging Protocol Guidelines

## Optimal CT Scanner and Acquisition Parameters

This document provides technical specifications for CT imaging protocols to achieve optimal diagnostic accuracy with DecXpert CT analysis system.

---

## 1. Scanner and Acquisition Parameters

### **Scanner Requirements**
- **Minimum**: 16-slice MDCT (Multi-Detector Computed Tomography)
- **Recommended**: 64-slice or higher MDCT
- **Optimal**: 128-256 slice CT scanner with advanced reconstruction capabilities

### **Tube Voltage (kVp)**
- **Standard patients** (BMI < 30): **120 kVp**
- **Large patients** (BMI > 30): **140 kVp**
- **Pediatric/small adults**: **100-110 kVp**
- **Low-dose protocols**: As low as 80-100 kVp with iterative reconstruction

### **Tube Current (mAs)**
- **Standard dose**: 200-300 mAs
- **Low-dose screening**: 40-80 mAs
- **High-resolution diagnostic**: 300-400 mAs
- **Automatic tube current modulation (ATCM)**: ENABLED (recommended for dose optimization)

### **Rotation Time**
- **Standard**: 0.5-0.8 seconds
- **High-speed imaging**: 0.3-0.4 seconds (for motion reduction)

### **Pitch**
- **Standard volumetric**: 0.9-1.2
- **High-resolution**: 0.6-0.9
- **Helical pitch factor**: ≤1.5 (to avoid slice gaps)

---

## 2. Scan Range and Coverage

### **Anatomical Coverage**
- **Starting point**: Lung apices (above clavicles, C7-T1 level)
- **End point**: Posterior costophrenic angles (below diaphragm, T12-L1 level)
- **Include**: Entire thoracic cavity from lung apices to adrenal glands

### **Field of View (FOV)**
- **Display FOV**: 320-400 mm (standard adult chest)
- **Reconstruction FOV**: Match to patient size
  - Small adults: 300-350 mm
  - Standard adults: 350-400 mm
  - Large patients: 400-450 mm

### **Coverage Completeness**
- ✅ **Full lung fields**: Ensure complete bilateral lung coverage
- ✅ **Mediastinum**: Include entire heart and great vessels
- ✅ **Chest wall**: Include ribs and pleural spaces
- ✅ **Upper abdomen**: Capture lung bases and adrenal glands

---

## 3. Image Acquisition Mode

### **Scanning Technique**
**Helical/Spiral CT (Recommended)**
- Continuous data acquisition with table movement
- Optimal for volumetric reconstruction
- Better for multiplanar reformatting (MPR)
- Reduces motion artifacts

**Sequential/Axial CT (Alternative)**
- Step-and-shoot acquisition
- Acceptable for standard chest imaging
- May have slice gaps - ensure minimal or no gap

### **Breath-Hold Technique**
- **Inspiratory phase**: FULL INSPIRATION (preferred)
  - Optimal lung expansion
  - Better visualization of parenchymal details
- **Single breath-hold**: 5-15 seconds
- **Patient coaching**: Essential for consistent results

### **Contrast Enhancement**
**Non-Contrast (Standard for DecXpert CT)**
- Preferred for COPD, ILD, pneumothorax, pleural effusion analysis
- No contrast required for most pulmonary pathologies

**Contrast-Enhanced (Optional, for specific indications)**
- **Pulmonary Embolism (PE) protocol**: 
  - 80-100 mL iodinated contrast
  - Injection rate: 4-5 mL/sec
  - Scan delay: 20-25 seconds (pulmonary arterial phase)
- **Lung mass characterization**:
  - Dual-phase: Arterial (25-30s) + Venous (60-70s)

---

## 4. Reconstruction Parameters

### **Slice Thickness**
| **Application** | **Slice Thickness** | **DecXpert CT Performance** |
|-----------------|---------------------|------------------------------|
| **Optimal (Recommended)** | **1.0-1.25 mm** | ⭐⭐⭐⭐⭐ Excellent - Detects all pathologies including small nodules (<4mm) |
| **High-Resolution** | **0.5-0.75 mm** | ⭐⭐⭐⭐⭐ Excellent - Ultra-high detail for ILD patterns |
| **Standard Diagnostic** | **2.0-3.0 mm** | ⭐⭐⭐⭐ Good - Adequate for most pathologies |
| **Screening/Low-Dose** | **5.0 mm** | ⭐⭐⭐ Acceptable - May miss small lesions |

### **Reconstruction Interval**
- **Thin-slice (1mm)**: Reconstruct every 0.5-1.0 mm
- **Standard (2-3mm)**: Reconstruct every 1.5-2.0 mm
- **Overlapping slices**: 50% overlap recommended for 3D post-processing

### **Reconstruction Kernels/Algorithms**

**Lung Parenchyma (High-Resolution)**
- **Siemens**: B70f (very sharp), B60f (sharp)
- **GE**: BONE, LUNG
- **Philips**: D, C
- **Canon/Toshiba**: FC50, FC51
- **Purpose**: Enhances edge detail, detects subtle nodules and ILD patterns

**Mediastinum (Soft Tissue)**
- **Siemens**: B30f, B40f (medium smooth)
- **GE**: STANDARD, SOFT
- **Philips**: B
- **Canon/Toshiba**: FC03, FC08
- **Purpose**: Evaluates masses, lymphadenopathy, cardiac structures

### **Iterative Reconstruction (IR)**
✅ **Strongly Recommended** for dose reduction without quality loss
- **ASIR (GE)**: 40-60% blending
- **SAFIRE/ADMIRE (Siemens)**: Strength 3-4
- **iDose (Philips)**: Level 4-6
- **AIDR 3D (Canon)**: Standard or Mild
- **Benefits**: Reduces noise, maintains spatial resolution, lowers radiation dose by 30-50%

### **Matrix Size**
- **Standard**: 512 × 512 pixels
- **High-resolution**: 768 × 768 or 1024 × 1024 (if available)

---

## 5. Image Format and Quality

### **DICOM Export Settings**
- ✅ **File format**: DICOM (.dcm) - native format (preferred)
- ✅ **Alternative formats**: PNG, JPEG (acceptable)
- ✅ **Bit depth**: 12-bit or 16-bit preferred
- ✅ **Compression**: Lossless JPEG 2000 or uncompressed

### **Window Settings for Export**
**Lung Window**
- Width: 1500 HU
- Level: -600 HU

**Mediastinal Window**
- Width: 350-400 HU
- Level: 40-50 HU

### **Metadata Preservation**
Ensure DICOM files include:
- Patient demographics (anonymized if needed)
- Acquisition parameters (kVp, mAs, slice thickness)
- Series description
- Study date/time

---

## 6. Radiation Dose Optimization

### **Dose Reference Levels (DRL)**
- **Standard chest CT**: 10-15 mGy (CTDIvol)
- **Low-dose screening**: 1-3 mGy (CTDIvol)
- **High-resolution diagnostic**: 15-20 mGy (CTDIvol)

### **Dose Reduction Techniques**
1. ✅ **Automatic Exposure Control (AEC)**: Enable tube current modulation
2. ✅ **Iterative Reconstruction**: Reduce dose by 30-50%
3. ✅ **Optimal kVp selection**: Use lower kVp for smaller patients
4. ✅ **Bismuth shielding**: Protect radiosensitive organs (thyroid, breast)

---

## 7. Quality Assurance Checklist

### **Pre-Scan Verification**
- [ ] Patient properly positioned (supine, arms raised)
- [ ] Scan range includes lung apices to costophrenic angles
- [ ] Breath-hold instructions provided
- [ ] Correct protocol selected (contrast vs. non-contrast)

### **Post-Acquisition Check**
- [ ] No motion artifacts (patient movement)
- [ ] Complete anatomical coverage
- [ ] Adequate image quality (low noise, sharp edges)
- [ ] Correct reconstruction kernels applied
- [ ] DICOM metadata complete and accurate

---

## 8. DecXpert CT System Capabilities

### **What the System Analyzes**
✅ **Accepts**: Any slice thickness (1mm to 5mm+)  
✅ **Processes**: Up to 400 selected slices per study  
✅ **Formats**: DICOM, PNG, JPEG, ZIP archives  
✅ **File limit**: Up to 727 slices (auto-selects best 400)  

### **Intelligent Slice Selection**
The DecXpert CT system automatically:
- Calculates variance scores for all uploaded slices
- Selects 250 high-variance slices (likely pathology)
- Selects 150 uniformly-spaced slices (full coverage)
- Ensures comprehensive analysis across entire chest

### **Pathologies Detected**
1. **COPD** (with GOLD staging)
2. **Interstitial Lung Disease** (11 ILD subtypes)
3. **Lung Cancer/Masses** (with TNM staging)
4. **Pulmonary Embolism**
5. **Pneumonia** (with CURB-65 severity)
6. **Tuberculosis**
7. **Pleural Effusion**
8. **Pneumothorax**

---

## 9. Recommended Protocols by Clinical Indication

### **Protocol 1: COPD/Emphysema Assessment**
- Slice thickness: 1.0-1.25 mm
- Reconstruction: Lung kernel (high-resolution)
- Breath-hold: Full inspiration
- Contrast: Not required
- Additional: Expiratory phase optional (air trapping)

### **Protocol 2: Interstitial Lung Disease (ILD)**
- Slice thickness: 1.0 mm (high-resolution CT)
- Reconstruction: Sharp lung kernel
- Breath-hold: Full inspiration
- Contrast: Not required
- Position: Supine + prone (if UIP suspected)

### **Protocol 3: Pulmonary Embolism**
- Slice thickness: 1.0-1.25 mm
- Reconstruction: Standard + lung kernels
- Breath-hold: Inspiration
- **Contrast: REQUIRED** (pulmonary arterial phase)
- Scan delay: 20-25 seconds

### **Protocol 4: Lung Cancer Screening**
- Slice thickness: 1.0-1.25 mm
- Reconstruction: Lung kernel
- Breath-hold: Full inspiration
- Contrast: Not required
- Dose: Low-dose protocol (1-3 mGy)

### **Protocol 5: Pneumonia/Infection**
- Slice thickness: 2.0-3.0 mm (acceptable)
- Reconstruction: Standard + lung kernels
- Breath-hold: Inspiration
- Contrast: Optional (if complications suspected)

---

## 10. Troubleshooting Common Issues

### **Issue: Motion Artifacts**
**Solution**: 
- Use faster rotation time (0.3-0.4s)
- Re-coach patient on breath-hold
- Consider sedation for uncooperative patients

### **Issue: Incomplete Coverage**
**Solution**:
- Extend scan range to include entire lung fields
- Use scout image to verify coverage before scanning

### **Issue: Poor Image Quality**
**Solution**:
- Increase mAs for larger patients
- Enable iterative reconstruction
- Use appropriate reconstruction kernel

### **Issue: Excessive Radiation Dose**
**Solution**:
- Enable automatic tube current modulation
- Reduce kVp for smaller patients
- Use iterative reconstruction for dose reduction

---

## 11. Summary of Optimal Settings

| **Parameter** | **Optimal Value** |
|---------------|-------------------|
| **Scanner** | 64-slice or higher MDCT |
| **kVp** | 120 kVp (standard adults) |
| **mAs** | 200-300 mAs with ATCM |
| **Slice Thickness** | **1.0-1.25 mm** |
| **Reconstruction Interval** | 0.5-1.0 mm (50% overlap) |
| **Pitch** | 0.9-1.2 |
| **Reconstruction Kernel** | Lung (sharp) + Mediastinum (soft) |
| **Iterative Reconstruction** | Enabled (40-60% strength) |
| **FOV** | 350-400 mm |
| **Matrix** | 512 × 512 pixels |
| **Breath-Hold** | Full inspiration |
| **Dose** | 10-15 mGy (CTDIvol) |

---

## 12. Contact and Support

For technical questions about CT protocol optimization for DecXpert CT:
- Consult your institution's radiology physics team
- Review manufacturer-specific protocol guidelines
- Ensure compliance with local radiation safety regulations

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-21  
**Intended Audience**: Radiologists, CT Technologists, Medical Physicists  

---

## Appendix: Vendor-Specific Protocol Names

### **Siemens**
- Standard Chest: "THORAX_STANDARD"
- High-Resolution: "THORAX_HR"
- PE Protocol: "CT_Angio_Chest"

### **GE Healthcare**
- Standard Chest: "Chest Routine"
- High-Resolution: "Chest HRCT"
- PE Protocol: "PE with Contrast"

### **Philips**
- Standard Chest: "Thorax Standard"
- High-Resolution: "Lung HRCT"
- PE Protocol: "CTA Pulmonary"

### **Canon/Toshiba**
- Standard Chest: "Chest Standard"
- High-Resolution: "Lung Detail"
- PE Protocol: "Chest Angio"

---

**Note**: These guidelines are recommendations for optimal performance. DecXpert CT will analyze CT scans acquired with varying parameters, but adherence to these specifications ensures the highest diagnostic accuracy.
