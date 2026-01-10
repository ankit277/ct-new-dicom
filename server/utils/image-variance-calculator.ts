import sharp from 'sharp';

/**
 * Calculate pixel variance from base64 PNG image
 * Handles PNG images produced by the universal image converter (which converts DICOM → PNG)
 * @param base64Image - Base64 encoded PNG image (without data:image/png;base64, prefix)
 * @returns Variance value (higher = more complex/pathological)
 */
export async function calculateImageVarianceFromBase64(base64Image: string): Promise<number> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    
    // Resize to 100x100 for faster processing (matching client-side)
    const resizedImage = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = resizedImage;
    const { channels } = info;
    
    // Calculate grayscale variance
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < data.length; i += channels) {
      // Calculate grayscale value (average of RGB)
      const gray = channels >= 3 
        ? (data[i] + data[i + 1] + data[i + 2]) / 3 
        : data[i];
      sum += gray;
      count++;
    }
    
    const mean = sum / count;
    let varianceSum = 0;
    
    for (let i = 0; i < data.length; i += channels) {
      const gray = channels >= 3 
        ? (data[i] + data[i + 1] + data[i + 2]) / 3 
        : data[i];
      varianceSum += Math.pow(gray - mean, 2);
    }
    
    const variance = varianceSum / count;
    return variance;
    
  } catch (error) {
    console.warn(`⚠️ Failed to calculate variance:`, error);
    // Fallback to 0 variance if calculation fails
    return 0;
  }
}

/**
 * Calculate hybrid selection indices based on variance scores
 * 💰 COST OPTIMIZED: Uses regional coverage + similarity deduplication + high-variance priority
 * @param varianceScores - Array of variance scores with their original indices
 * @param maxSlices - Maximum number of slices to select (default 200 for balanced cost reduction + coverage)
 * @returns Array of selected indices
 */
export function selectIndicesWithHybridVariance(
  varianceScores: Array<{ index: number; variance: number }>,
  maxSlices: number = 200
): number[] {
  const totalCount = varianceScores.length;
  
  // If <= maxSlices, use all indices
  if (totalCount <= maxSlices) {
    return varianceScores.map(v => v.index);
  }
  
  // 💰 COST OPTIMIZATION: Regional coverage ensures diagnostic completeness with fewer slices
  // Divide study into 5 anatomical regions: Apex, Upper, Mid, Lower, Base
  const REGIONS = 5;
  const regionSize = Math.ceil(totalCount / REGIONS);
  const regionsData: Array<{ index: number; variance: number }>[] = [];
  
  for (let r = 0; r < REGIONS; r++) {
    const start = r * regionSize;
    const end = Math.min(start + regionSize, totalCount);
    regionsData.push(varianceScores.filter(v => v.index >= start && v.index < end));
  }
  
  // Allocate slices per region based on variance density
  // High-variance regions get more slices (pathology-focused)
  const regionVarianceSums = regionsData.map(region => 
    region.reduce((sum, v) => sum + v.variance, 0) / Math.max(1, region.length)
  );
  const totalVariance = regionVarianceSums.reduce((sum, v) => sum + v, 0);
  
  // Base allocation: minimum 10% per region, rest weighted by variance
  const BASE_PER_REGION = Math.floor(maxSlices * 0.10); // 10% guaranteed per region
  const REMAINING = maxSlices - (BASE_PER_REGION * REGIONS);
  
  const regionAllocations = regionVarianceSums.map(variance => {
    const weighted = totalVariance > 0 ? Math.floor((variance / totalVariance) * REMAINING) : Math.floor(REMAINING / REGIONS);
    return BASE_PER_REGION + weighted;
  });
  
  // Adjust to exactly match maxSlices
  let totalAllocated = regionAllocations.reduce((sum, a) => sum + a, 0);
  while (totalAllocated < maxSlices) {
    const maxIdx = regionVarianceSums.indexOf(Math.max(...regionVarianceSums));
    regionAllocations[maxIdx]++;
    totalAllocated++;
  }
  while (totalAllocated > maxSlices) {
    const minIdx = regionVarianceSums.indexOf(Math.min(...regionVarianceSums));
    if (regionAllocations[minIdx] > 1) {
      regionAllocations[minIdx]--;
      totalAllocated--;
    } else {
      break;
    }
  }
  
  // Select from each region: prioritize high-variance, deduplicate similar slices
  const selectedIndices: number[] = [];
  const SIMILARITY_THRESHOLD = 0.15; // Skip slices with < 15% variance difference from neighbors
  
  for (let r = 0; r < REGIONS; r++) {
    const regionSlices = regionsData[r];
    const regionAllocation = regionAllocations[r];
    
    if (regionSlices.length === 0) continue;
    
    // Sort by variance (highest first)
    const sortedRegion = [...regionSlices].sort((a, b) => b.variance - a.variance);
    
    // Select top variance slices with similarity deduplication
    const regionSelected: number[] = [];
    let lastVariance = -Infinity;
    
    for (const slice of sortedRegion) {
      if (regionSelected.length >= regionAllocation) break;
      
      // Skip if too similar to last selected (similarity deduplication)
      const varianceDiff = Math.abs(slice.variance - lastVariance) / Math.max(1, lastVariance);
      if (regionSelected.length > 0 && varianceDiff < SIMILARITY_THRESHOLD) {
        continue; // Skip similar slices
      }
      
      regionSelected.push(slice.index);
      lastVariance = slice.variance;
    }
    
    // If we didn't fill allocation, add uniform samples
    if (regionSelected.length < regionAllocation) {
      const remaining = regionAllocation - regionSelected.length;
      const unselected = regionSlices
        .filter(s => !regionSelected.includes(s.index))
        .sort((a, b) => a.index - b.index);
      
      const interval = Math.max(1, Math.floor(unselected.length / remaining));
      for (let i = 0; i < remaining && i * interval < unselected.length; i++) {
        regionSelected.push(unselected[i * interval].index);
      }
    }
    
    selectedIndices.push(...regionSelected);
  }
  
  // Sort by original index to maintain anatomical order (apex → base)
  selectedIndices.sort((a, b) => a - b);
  
  console.log(`💰 COST-OPTIMIZED selection: ${selectedIndices.length} slices from ${totalCount} total (${((1 - selectedIndices.length/totalCount) * 100).toFixed(0)}% reduction)`);
  console.log(`📊 Regional allocation: ${regionAllocations.join(', ')} (apex → base)`);
  console.log(`📊 Variance stats: min=${Math.min(...varianceScores.map(v => v.variance)).toFixed(2)}, max=${Math.max(...varianceScores.map(v => v.variance)).toFixed(2)}`);
  
  return selectedIndices;
}
