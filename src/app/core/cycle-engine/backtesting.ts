import { mean, median } from 'simple-statistics';
import { ModelScore } from '../models/app.models';
import type { CandidateModel } from './models/candidate-models';

export interface BacktestResult {
  readonly score: ModelScore;
  readonly errors: readonly number[];
}

export function backtestModel(
  values: readonly number[],
  model: CandidateModel,
): BacktestResult | undefined {
  const errors: number[] = [];
  for (
    let targetIndex = Math.max(3, model.minimumCycles);
    targetIndex < values.length;
    targetIndex += 1
  ) {
    const training = values.slice(0, targetIndex);
    if (training.length < model.minimumCycles) continue;
    errors.push(model.predict(training) - values[targetIndex]);
  }
  if (errors.length === 0) return undefined;
  const absolute = errors.map(Math.abs);
  return {
    errors,
    score: {
      model: model.name,
      mae: mean(absolute),
      medianAbsoluteError: median(absolute),
      rmse: Math.sqrt(mean(errors.map((error) => error ** 2))),
      withinOneDay: absolute.filter((error) => error <= 1).length / errors.length,
      withinTwoDays: absolute.filter((error) => error <= 2).length / errors.length,
      withinThreeDays: absolute.filter((error) => error <= 3).length / errors.length,
      bias: mean(errors),
      predictions: errors.length,
    },
  };
}
