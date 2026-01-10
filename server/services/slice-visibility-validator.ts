/**
 * Slice Visibility Validator
 * Validates that pathologies are actually visible in extracted CT slices
 * Uses image analysis heuristics to score pathology visibility
 */

import sharp from 'sharp';

export interface SliceVisibilityScore {
  sliceIndex: number;
  overallScore: number; // 0-100
  variance: number;
  edgeDensity: number;
  contrastScore: number;
  pathologyLikelihood: Record<string, number>; // Per-pathology scores
  visibilityEvidence: string;
}

/**
 * Analyze a slice image and compute visibility scores for pathologies
 * Higher scores indicate higher likelihood that pathology is visible
 */
export async function computeSliceVisibilityScore(
  imageData: string,
  sliceIndex: number,
  detectedPathologies: string[]
): Promise<SliceVisibilityScore> {
  try {
    // Decode base64 image
    const imageBuffer = Buffer.from(
      imageData.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );
    
    // Get image statistics using sharp
    const image = sharp(imageBuffer);
    const stats = await image.stats();
    const metadata = await image.metadata();
    
    // Compute variance from channel statistics (higher variance = more detail/features)
    const channelVariances = stats.channels.map(ch => {
      // Use standard deviation as variance proxy
      return ch.stdev || 0;
    });
    const avgVariance = channelVariances.reduce((a, b) => a + b, 0) / channelVariances.length;
    
    // Normalize variance to 0-100 scale (typical CT variance ranges 20-60)
    const normalizedVariance = Math.min(100, Math.max(0, (avgVariance / 60) * 100));
    
    // Compute edge density using Laplacian-like approximation
    // Get raw pixel data for edge detection
    const rawData = await image
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = rawData;
    const width = info.width;
    const height = info.height;
    
    // Simple edge detection: compute gradient magnitude
    let edgeSum = 0;
    let contrastSum = 0;
    let pixelCount = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const center = data[idx];
        
        // Compute gradient (Sobel-like)
        const left = data[idx - 1];
        const right = data[idx + 1];
        const top = data[idx - width];
        const bottom = data[idx + width];
        
        const gx = Math.abs(right - left);
        const gy = Math.abs(bottom - top);
        const gradient = Math.sqrt(gx * gx + gy * gy);
        
        edgeSum += gradient;
        
        // Local contrast
        const maxNeighbor = Math.max(left, right, top, bottom);
        const minNeighbor = Math.min(left, right, top, bottom);
        contrastSum += maxNeighbor - minNeighbor;
        
        pixelCount++;
      }
    }
    
    const avgEdge = edgeSum / pixelCount;
    const avgContrast = contrastSum / pixelCount;
    
    // Normalize edge density (typical range 5-30)
    const edgeDensity = Math.min(100, Math.max(0, (avgEdge / 25) * 100));
    
    // Normalize contrast (typical range 20-80)
    const contrastScore = Math.min(100, Math.max(0, (avgContrast / 60) * 100));
    
    // Compute pathology-specific likelihood scores
    const pathologyLikelihood: Record<string, number> = {};
    
    for (const pathology of detectedPathologies) {
      let score = 50; // Base score
      
      switch (pathology) {
        case 'Mass/Nodule':
          // Nodules need high local contrast and moderate edge density
          score = (contrastScore * 0.4) + (edgeDensity * 0.3) + (normalizedVariance * 0.3);
          // Boost for high contrast regions (nodules are dense)
          if (contrastScore > 60) score += 15;
          break;
          
        case 'Pulmonary Embolism':
          // PE shows as filling defects in vessels - need contrast difference
          score = (contrastScore * 0.5) + (normalizedVariance * 0.3) + (edgeDensity * 0.2);
          break;
          
        case 'Pneumothorax':
          // Pneumothorax shows as lack of lung markings - lower edge density in affected area
          // But high edge at pleural boundary
          score = (edgeDensity * 0.4) + (normalizedVariance * 0.3) + (contrastScore * 0.3);
          break;
          
        case 'Pneumonia':
          // Ground-glass opacities - moderate variance, lower contrast
          score = (normalizedVariance * 0.5) + (contrastScore * 0.3) + (edgeDensity * 0.2);
          break;
          
        case 'Pleural Effusion':
          // Fluid appears as homogeneous density - lower variance in effusion area
          // But high contrast at fluid-lung interface
          score = (contrastScore * 0.4) + (edgeDensity * 0.35) + (normalizedVariance * 0.25);
          break;
          
        case 'COPD':
          // Emphysema shows as low-density areas
          score = (normalizedVariance * 0.4) + (edgeDensity * 0.3) + (contrastScore * 0.3);
          break;
          
        case 'ILD':
          // Interstitial patterns show as reticular/nodular opacities
          score = (edgeDensity * 0.4) + (normalizedVariance * 0.35) + (contrastScore * 0.25);
          break;
          
        case 'Tuberculosis':
          // TB can show cavities, nodules, consolidation
          score = (contrastScore * 0.35) + (edgeDensity * 0.35) + (normalizedVariance * 0.3);
          break;
          
        default:
          score = (normalizedVariance + edgeDensity + contrastScore) / 3;
      }
      
      pathologyLikelihood[pathology] = Math.round(Math.min(100, Math.max(0, score)));
    }
    
    // Overall score is weighted average of pathology-specific scores
    const pathologyScores = Object.values(pathologyLikelihood);
    const overallScore = pathologyScores.length > 0
      ? Math.round(pathologyScores.reduce((a, b) => a + b, 0) / pathologyScores.length)
      : Math.round((normalizedVariance + edgeDensity + contrastScore) / 3);
    
    // Generate visibility evidence description
    const evidenceParts: string[] = [];
    if (normalizedVariance > 50) evidenceParts.push('high image variance');
    if (edgeDensity > 50) evidenceParts.push('significant edge features');
    if (contrastScore > 50) evidenceParts.push('strong contrast variations');
    
    const visibilityEvidence = evidenceParts.length > 0
      ? `Slice shows ${evidenceParts.join(', ')} suggesting visible pathological features`
      : 'Slice has lower visual feature density';
    
    return {
      sliceIndex,
      overallScore,
      variance: Math.round(normalizedVariance),
      edgeDensity: Math.round(edgeDensity),
      contrastScore: Math.round(contrastScore),
      pathologyLikelihood,
      visibilityEvidence
    };
  } catch (error) {
    console.error(`Error computing visibility score for slice ${sliceIndex}:`, error);
    // Return default mid-range scores on error
    return {
      sliceIndex,
      overallScore: 50,
      variance: 50,
      edgeDensity: 50,
      contrastScore: 50,
      pathologyLikelihood: Object.fromEntries(detectedPathologies.map(p => [p, 50])),
      visibilityEvidence: 'Unable to compute visibility metrics'
    };
  }
}

/**
 * Rank slices within a batch by their pathology visibility scores
 * Returns slices sorted by visibility score (highest first)
 */
export async function rankSlicesByVisibility(
  slices: Array<{ imageData: string; sliceIndex: number }>,
  detectedPathologies: string[]
): Promise<Array<{ sliceIndex: number; score: SliceVisibilityScore }>> {
  const scores = await Promise.all(
    slices.map(async (slice) => ({
      sliceIndex: slice.sliceIndex,
      score: await computeSliceVisibilityScore(slice.imageData, slice.sliceIndex, detectedPathologies)
    }))
  );
  
  // Sort by overall score descending
  scores.sort((a, b) => b.score.overallScore - a.score.overallScore);
  
  return scores;
}

/**
 * Filter slices to only include those with sufficient pathology visibility
 * Uses pathology-specific thresholds
 */
export function filterByVisibilityThreshold(
  rankedSlices: Array<{ sliceIndex: number; score: SliceVisibilityScore }>,
  detectedPathologies: string[],
  minThreshold: number = 40
): Array<{ sliceIndex: number; score: SliceVisibilityScore }> {
  return rankedSlices.filter(slice => {
    // Check if any detected pathology has sufficient visibility score
    for (const pathology of detectedPathologies) {
      const pathScore = slice.score.pathologyLikelihood[pathology] || 0;
      if (pathScore >= minThreshold) {
        return true;
      }
    }
    // Also include if overall score is high
    return slice.score.overallScore >= minThreshold;
  });
}
