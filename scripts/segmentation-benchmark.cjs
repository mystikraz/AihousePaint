const fs = require('node:fs');
const path = require('node:path');

function findBoundary(mask, width, height) {
  const boundary = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      if (
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        !mask[pixel - 1] || !mask[pixel + 1] ||
        !mask[pixel - width] || !mask[pixel + width]
      ) boundary[pixel] = 1;
    }
  }
  return boundary;
}

function dilate(mask, width, height, radius) {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
            result[nextY * width + nextX] = 1;
          }
        }
      }
    }
  }
  return result;
}

function calculateMaskMetrics(prediction, reference, width, height, protectedMask, boundaryTolerance = 2) {
  const size = width * height;
  for (const [label, mask] of [['prediction', prediction], ['reference', reference]]) {
    if (mask.length !== size) throw new RangeError(`${label} mask size does not match ${width}x${height}.`);
  }
  if (protectedMask && protectedMask.length !== size) {
    throw new RangeError(`Protected mask size does not match ${width}x${height}.`);
  }

  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let protectedLeakage = 0;
  for (let pixel = 0; pixel < size; pixel++) {
    const predicted = prediction[pixel] !== 0;
    const expected = reference[pixel] !== 0;
    if (predicted && expected) truePositive++;
    else if (predicted) falsePositive++;
    else if (expected) falseNegative++;
    if (predicted && protectedMask?.[pixel]) protectedLeakage++;
  }

  const predictedBoundary = findBoundary(prediction, width, height);
  const referenceBoundary = findBoundary(reference, width, height);
  const nearReference = dilate(referenceBoundary, width, height, boundaryTolerance);
  const nearPrediction = dilate(predictedBoundary, width, height, boundaryTolerance);
  let predictedBoundaryCount = 0;
  let matchedPredictedBoundary = 0;
  let referenceBoundaryCount = 0;
  let matchedReferenceBoundary = 0;
  for (let pixel = 0; pixel < size; pixel++) {
    if (predictedBoundary[pixel]) {
      predictedBoundaryCount++;
      if (nearReference[pixel]) matchedPredictedBoundary++;
    }
    if (referenceBoundary[pixel]) {
      referenceBoundaryCount++;
      if (nearPrediction[pixel]) matchedReferenceBoundary++;
    }
  }
  const precision = truePositive + falsePositive
    ? truePositive / (truePositive + falsePositive)
    : truePositive + falseNegative === 0 ? 1 : 0;
  const recall = truePositive + falseNegative
    ? truePositive / (truePositive + falseNegative)
    : truePositive + falsePositive === 0 ? 1 : 0;
  const boundaryPrecision = predictedBoundaryCount
    ? matchedPredictedBoundary / predictedBoundaryCount
    : referenceBoundaryCount === 0 ? 1 : 0;
  const boundaryRecall = referenceBoundaryCount
    ? matchedReferenceBoundary / referenceBoundaryCount
    : predictedBoundaryCount === 0 ? 1 : 0;

  return {
    iou: truePositive + falsePositive + falseNegative
      ? truePositive / (truePositive + falsePositive + falseNegative)
      : 1,
    precision,
    recall,
    boundaryPrecision,
    boundaryRecall,
    boundaryF1: boundaryPrecision + boundaryRecall
      ? 2 * boundaryPrecision * boundaryRecall / (boundaryPrecision + boundaryRecall)
      : 1,
    protectedLeakagePixels: protectedLeakage,
    protectedLeakageRate: truePositive + falsePositive
      ? protectedLeakage / (truePositive + falsePositive)
      : 0,
    manualCorrectionPixels: falsePositive + falseNegative,
    manualCorrectionRate: truePositive + falseNegative
      ? (falsePositive + falseNegative) / (truePositive + falseNegative)
      : falsePositive ? 1 : 0,
  };
}

function loadBinaryMask(value, baseDir, expectedPixels, description) {
  if (!value || typeof value !== 'string') {
    throw new Error(`${description} must reference a raw one-byte-per-pixel binary mask.`);
  }
  const filePath = path.resolve(baseDir, value);
  const bytes = fs.readFileSync(filePath);
  if (bytes.length !== expectedPixels) {
    throw new RangeError(`${description} ${filePath} has ${bytes.length} pixels; expected ${expectedPixels}.`);
  }
  return bytes;
}

function runBenchmark(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return {
      status: 'blocked',
      message: `No benchmark manifest or manually verified reference masks found at ${manifestPath}.`,
      results: [],
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    return {
      status: 'blocked',
      message: 'Benchmark manifest has no annotated cases; accuracy scores are not available.',
      results: [],
    };
  }
  const results = [];
  for (const sample of manifest.cases) {
    if (sample.referenceVerified !== true) {
      throw new Error(`Reference mask for ${sample.id} is not marked manually verified.`);
    }
    const pixels = sample.width * sample.height;
    const reference = loadBinaryMask(sample.referenceMask, path.dirname(manifestPath), pixels, `${sample.id} reference`);
    const protectedMask = sample.protectedMask
      ? loadBinaryMask(sample.protectedMask, path.dirname(manifestPath), pixels, `${sample.id} protected`)
      : undefined;
    for (const candidate of sample.predictions ?? []) {
      const prediction = loadBinaryMask(candidate.mask, path.dirname(manifestPath), pixels, `${sample.id}/${candidate.name}`);
      results.push({
        sample: sample.id,
        image: sample.image,
        surface: sample.surface,
        lighting: sample.lighting,
        candidate: candidate.name,
        thresholds: candidate.thresholds,
        ...calculateMaskMetrics(
          prediction,
          reference,
          sample.width,
          sample.height,
          protectedMask,
          manifest.boundaryTolerance ?? 2
        ),
        latencyMs: candidate.latencyMs,
        manualCorrectionActions: candidate.manualCorrectionActions,
      });
    }
  }
  return {
    status: results.length ? 'complete' : 'blocked',
    message: results.length
      ? 'Scores compare only against explicitly manually verified reference masks.'
      : 'Reference masks exist, but no prediction masks are recorded.',
    results,
  };
}

if (require.main === module) {
  const manifestPath = path.resolve(process.argv[2] ?? 'samplehouses/segmentation-benchmark.json');
  try {
    const result = runBenchmark(manifestPath);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'blocked') process.exitCode = 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { calculateMaskMetrics, runBenchmark };
