import { mean, median, quantileSorted, sampleStandardDeviation } from 'simple-statistics';
import { CyclePattern, CycleStatistics } from '../models/app.models';

function weightedMean(values: readonly number[]): number {
  const weights = values.map((_, index) => index + 1);
  const weightTotal = weights.reduce((total, value) => total + value, 0);
  return values.reduce((total, value, index) => total + value * weights[index], 0) / weightTotal;
}

function weightedMedian(values: readonly number[]): number {
  const weighted = values.map((value, index) => ({ value, weight: index + 1 }));
  const ordered = [...weighted].sort((left, right) => left.value - right.value);
  const threshold = ordered.reduce((total, item) => total + item.weight, 0) / 2;
  let running = 0;
  for (const item of ordered) {
    running += item.weight;
    if (running >= threshold) return item.value;
  }
  return ordered.at(-1)?.value ?? 0;
}

function recentMedian(values: readonly number[], size: number): number {
  return median(values.slice(-size));
}

function trendSlope(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const xMean = (values.length - 1) / 2;
  const yMean = mean(values);
  const numerator = values.reduce(
    (total, value, index) => total + (index - xMean) * (value - yMean),
    0,
  );
  const denominator = values.reduce((total, _, index) => total + (index - xMean) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

function patternFor(count: number, mad: number, iqr: number, deviation: number): CyclePattern {
  if (count < 3) return 'INSUFFICIENT_DATA';
  const variability = Math.max(mad * 1.4826, iqr / 1.35, deviation);
  if (variability <= 2.5) return 'STABLE';
  if (variability <= 6) return 'VARIABLE';
  return 'HIGHLY_VARIABLE';
}

export function calculateCycleStatistics(values: readonly number[]): CycleStatistics | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = median(values);
  const deviations = values.map((value) => Math.abs(value - middle));
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const standardDeviation = values.length > 1 ? sampleStandardDeviation(values) : 0;
  const medianAbsoluteDeviation = median(deviations);
  return {
    count: values.length,
    values: [...values],
    mean: mean(values),
    median: middle,
    weightedMean: weightedMean(values),
    weightedMedian: weightedMedian(values),
    minimum: sorted[0],
    maximum: sorted.at(-1) ?? sorted[0],
    range: (sorted.at(-1) ?? sorted[0]) - sorted[0],
    standardDeviation,
    medianAbsoluteDeviation,
    interquartileRange: q3 - q1,
    q1,
    q3,
    recent3Median: recentMedian(values, 3),
    recent6Median: recentMedian(values, 6),
    recent12Median: recentMedian(values, 12),
    trend: trendSlope(values),
    pattern: patternFor(values.length, medianAbsoluteDeviation, q3 - q1, standardDeviation),
  };
}
