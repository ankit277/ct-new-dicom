import OpenAI from "openai"; // DecXpert CT AI Engine Interface

const decxpertEngine = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ChestCTValidationResult {
  isChestCT: boolean;
  confidence: number;
  anatomicalRegion: string;
  reason: string;
}

export interface AnatomicalRegionResult {
  isChestRegion: boolean;
  anatomicalRegion: string;
  confidence: number;
  reason: string;
}

export interface SliceFilterResult {
  chestSlices: string[];
  rejectedSlices: Array<{
    index: number;
    anatomicalRegion: string;
    confidence: number;
    reason: string;
  }>;
  totalOriginalSlices: number;
  chestSliceCount: number;
}

export async function detectAnatomicalRegion(base64Image: string): Promise<AnatomicalRegionResult> {
  try {
    console.log("🫁 DecXpert CT: Identifying anatomical region for chest detection...");
    
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ DecXpert CT license key not found in environment variables");
      throw new Error("DecXpert CT license key not configured");
    }
    
    const response = await decxpertEngine.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are DecXpert CT AI v5.0 specializing in anatomical region identification for CT scans. Your task is to determine if a CT slice shows chest anatomy or other body regions."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this CT scan slice and determine the anatomical region:

CHEST ANATOMY includes:
- Lungs, pleural spaces
- Heart, mediastinal structures
- Ribs, thoracic spine
- Great vessels (aorta, pulmonary vessels)
- Chest wall, diaphragm
- Any axial slice from clavicles to upper abdomen

NON-CHEST REGIONS include:
- Head/brain CT
- Neck CT (cervical spine, thyroid region)
- Abdomen CT (below diaphragm)
- Pelvis CT
- Extremity CT (arms, legs)

Provide:
1. Is this chest anatomy? (true/false)
2. Specific anatomical region identified
3. Confidence level (0-100)
4. Brief reasoning for classification

Respond in JSON format:
{
  "isChestRegion": boolean,
  "anatomicalRegion": "specific region description",
  "confidence": number (0-100),
  "reason": "brief explanation of anatomical landmarks"
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    
    console.log("🫁 Anatomical region detection result:", {
      isChestRegion: result.isChestRegion,
      confidence: result.confidence,
      anatomicalRegion: result.anatomicalRegion
    });
    
    return result;
  } catch (error) {
    console.error("❌ Anatomical region detection failed:", error);
    throw new Error("Failed to detect anatomical region");
  }
}

export async function filterChestSlices(base64Images: string[]): Promise<SliceFilterResult> {
  console.log(`🔍 DecXpert CT: Filtering ${base64Images.length} slices to identify chest anatomy...`);
  
  const chestSlices: string[] = [];
  const rejectedSlices: SliceFilterResult['rejectedSlices'] = [];
  
  // Process slices in batches to avoid rate limits
  const batchSize = 5;
  const totalSlices = base64Images.length;
  
  for (let i = 0; i < totalSlices; i += batchSize) {
    const batch = base64Images.slice(i, i + batchSize);
    const batchPromises = batch.map(async (image, batchIndex) => {
      const sliceIndex = i + batchIndex;
      try {
        const regionResult = await detectAnatomicalRegion(image);
        
        if (regionResult.isChestRegion && regionResult.confidence >= 75) {
          return { type: 'chest', image, sliceIndex };
        } else {
          return { 
            type: 'rejected', 
            sliceIndex,
            anatomicalRegion: regionResult.anatomicalRegion || 'Unknown region',
            confidence: regionResult.confidence || 0,
            reason: regionResult.reason || 'Failed to identify region'
          };
        }
      } catch (error) {
        console.error(`❌ Failed to process slice ${sliceIndex}:`, error);
        return { 
          type: 'rejected', 
          sliceIndex,
          anatomicalRegion: 'Unknown region (processing error)',
          confidence: 0,
          reason: 'Failed to analyze slice'
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Process batch results
    batchResults.forEach(result => {
      if (result.type === 'chest') {
        chestSlices.push(result.image!);
      } else {
        rejectedSlices.push({
          index: result.sliceIndex,
          anatomicalRegion: result.anatomicalRegion || 'Unknown region',
          confidence: result.confidence || 0,
          reason: result.reason || 'Failed to identify region'
        });
      }
    });
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < totalSlices) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Processed batch ${Math.ceil((i + batchSize) / batchSize)} of ${Math.ceil(totalSlices / batchSize)}`);
  }
  
  console.log(`🫁 Chest slice filtering completed: ${chestSlices.length} chest slices identified out of ${totalSlices} total`);
  
  if (rejectedSlices.length > 0) {
    console.log("📋 Rejected slices breakdown:");
    rejectedSlices.forEach(rejected => {
      console.log(`  - Slice ${rejected.index}: ${rejected.anatomicalRegion} (${rejected.confidence}% confidence)`);
    });
  }
  
  return {
    chestSlices,
    rejectedSlices,
    totalOriginalSlices: totalSlices,
    chestSliceCount: chestSlices.length
  };
}

export async function validateChestCTContent(base64Image: string): Promise<ChestCTValidationResult> {
  try {
    console.log("🔍 DecXpert CT: Validating image content for CT modality...");
    
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ DecXpert CT license key not found in environment variables");
      throw new Error("DecXpert CT license key not configured");
    }
    
    const response = await decxpertEngine.chat.completions.create({
      model: "gpt-4o", // DecXpert CT proprietary AI engine
      messages: [
        {
          role: "system",
          content: "You are DecXpert CT AI v5.0 specializing in CT scan identification. Your task is to determine if an image shows CT (Computed Tomography) scan characteristics and reject any non-CT imaging modalities."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this medical image and determine:

1. Is this a CT (Computed Tomography) scan? Look for characteristic cross-sectional/axial slice appearance
2. What imaging modality does this represent?
3. Confidence level (0-100) that this is a CT scan
4. Brief explanation of your determination

IMPORTANT: ACCEPT only CT scans showing:
- Cross-sectional axial slices with CT window characteristics
- Grayscale appearance typical of CT imaging
- Hounsfield unit density variations
- Any anatomical region is acceptable if it's CT modality

REJECT any images showing:
- X-ray/radiograph images (2D projection)
- MRI scans (different contrast characteristics)
- Ultrasound images
- Endoscopy/photography
- Non-medical images
- Any non-CT imaging modality

Respond in JSON format:
{
  "isChestCT": boolean,
  "confidence": number (0-100),
  "anatomicalRegion": "CT scan of [region] or non-CT modality",
  "reason": "brief explanation focusing on modality identification"
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    console.log("✅ CT modality validation completed");
    const result = JSON.parse(response.choices[0].message.content!);
    
    console.log("🏥 CT modality validation result:", {
      isChestCT: result.isChestCT,
      confidence: result.confidence,
      anatomicalRegion: result.anatomicalRegion,
      reason: result.reason
    });
    
    return result;
  } catch (error) {
    console.error("❌ Error during CT validation:", error);
    // If validation fails, be conservative and allow the image
    return {
      isChestCT: true,
      confidence: 50,
      anatomicalRegion: "Unknown - validation error",
      reason: "Unable to validate due to technical error"
    };
  }
}