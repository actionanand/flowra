import { mean, median } from 'simple-statistics';

export type CandidateModelName =
  'Recent median' | 'Recency weighted mean' | 'EWMA' | 'Robust median blend' | 'Trend';

export interface CandidateModel {
  readonly name: CandidateModelName;
  readonly minimumCycles: number;
  predict(values: readonly number[]): number;
}

function recent(values: readonly number[], size: number): readonly number[] {
  return values.slice(-Math.min(size, values.length));
}

export const RECENT_MEDIAN_MODEL: CandidateModel = {
  name: 'Recent median',
  minimumCycles: 2,
  predict: (values) => median(recent(values, 6)),
};

export const WEIGHTED_MEAN_MODEL: CandidateModel = {
  name: 'Recency weighted mean',
  minimumCycles: 2,
  predict: (values) => {
    const sample = recent(values, 6);
    const denominator = sample.reduce((total, _, index) => total + index + 1, 0);
    return sample.reduce((total, value, index) => total + value * (index + 1), 0) / denominator;
  },
};

export const createEwmaModel = (alpha = 0.45): CandidateModel => ({
  name: 'EWMA',
  minimumCycles: 2,
  predict: (values) =>
    values.slice(1).reduce((result, value) => alpha * value + (1 - alpha) * result, values[0]),
});

export const ROBUST_BLEND_MODEL: CandidateModel = {
  name: 'Robust median blend',
  minimumCycles: 3,
  predict: (values) =>
    0.5 * median(recent(values, 3)) +
    0.3 * median(recent(values, 6)) +
    0.2 * median(recent(values, 12)),
};

export const TREND_MODEL: CandidateModel = {
  name: 'Trend',
  minimumCycles: 8,
  predict: (values) => {
    const recentValues = recent(values, 12);
    const xMean = (recentValues.length - 1) / 2;
    const yMean = mean(recentValues);
    const numerator = recentValues.reduce(
      (total, value, index) => total + (index - xMean) * (value - yMean),
      0,
    );
    const denominator = recentValues.reduce((total, _, index) => total + (index - xMean) ** 2, 0);
    const slope = Math.max(-1.5, Math.min(1.5, numerator / denominator));
    return yMean + slope * (recentValues.length - xMean);
  },
};

export function candidateModels(alpha = 0.45): readonly CandidateModel[] {
  return [
    RECENT_MEDIAN_MODEL,
    WEIGHTED_MEAN_MODEL,
    createEwmaModel(alpha),
    ROBUST_BLEND_MODEL,
    TREND_MODEL,
  ];
}
