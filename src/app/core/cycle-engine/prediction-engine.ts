import { Injectable } from '@angular/core';
import { quantileSorted } from 'simple-statistics';
import {
  CyclePrediction,
  ModelScore,
  Period,
  PredictionConfidence,
  ReproductiveStage,
} from '../models/app.models';
import { addCalendarDays } from '../utils/calendar-date';
import { backtestModel, BacktestResult } from './backtesting';
import { normalizeCycles } from './cycle-normalizer';
import { calculateCycleStatistics } from './cycle-statistics';
import { candidateModels } from './models/candidate-models';

export const PREDICTION_ALGORITHM_VERSION = 'cycle-predictor-v1';

export interface PredictionDebug {
  readonly cyclesUsed: readonly number[];
  readonly cyclesExcluded: readonly { readonly periodId: string; readonly reason: string }[];
  readonly candidateOutputs: Readonly<Record<string, number>>;
  readonly modelScores: readonly ModelScore[];
  readonly winner: string;
  readonly windowRadius: number;
}

export interface PredictionResult {
  readonly prediction?: CyclePrediction;
  readonly message?: string;
  readonly debug: PredictionDebug;
}

@Injectable({ providedIn: 'root' })
export class PredictionEngine {
  predict(
    profileId: string,
    periods: readonly Period[],
    stage: ReproductiveStage,
  ): PredictionResult {
    const normalized = normalizeCycles(periods.filter((period) => period.profileId === profileId));
    const emptyDebug: PredictionDebug = {
      cyclesUsed: normalized.lengths,
      cyclesExcluded: normalized.excluded,
      candidateOutputs: {},
      modelScores: [],
      winner: '',
      windowRadius: 0,
    };
    if (this.predictionsPaused(stage, normalized.lengths.length)) {
      return { message: this.pausedMessage(stage), debug: emptyDebug };
    }
    if (normalized.lengths.length < 2) {
      return { message: 'Not enough history for a reliable prediction.', debug: emptyDebug };
    }
    const orderedPeriods = periods
      .filter((period) => period.profileId === profileId && period.confirmed)
      .sort((left, right) => left.startDate.localeCompare(right.startDate));
    const latest = orderedPeriods.at(-1);
    if (!latest) return { message: 'No recorded period yet.', debug: emptyDebug };

    const models = candidateModels();
    const eligible = models.filter((model) => normalized.lengths.length >= model.minimumCycles);
    const outputs = Object.fromEntries(
      eligible.map((model) => [model.name, model.predict(normalized.lengths)]),
    );
    const backtests = eligible.flatMap((model) => {
      const result = backtestModel(normalized.lengths, model);
      return result ? [{ model, result }] : [];
    });
    const ranked = [...backtests].sort(
      (left, right) => this.combinedScore(left.result) - this.combinedScore(right.result),
    );
    const fallback = eligible[0];
    const best = ranked[0]?.model ?? fallback;
    const second = ranked[1];
    let cycleLength = best.predict(normalized.lengths);
    let modelUsed: string = best.name;
    if (ranked[0] && second && this.canEnsemble(ranked[0].result, second.result)) {
      const bestError = Math.max(0.25, ranked[0].result.score.mae);
      const secondError = Math.max(0.25, second.result.score.mae);
      const bestWeight = 1 / bestError / (1 / bestError + 1 / secondError);
      cycleLength =
        bestWeight * cycleLength + (1 - bestWeight) * second.model.predict(normalized.lengths);
      modelUsed = `Ensemble: ${best.name} + ${second.model.name}`;
    }
    cycleLength = Math.round(Math.max(10, Math.min(180, cycleLength)));
    const statistics = calculateCycleStatistics(normalized.lengths);
    const historicalErrors = ranked[0]?.result.errors.map(Math.abs) ?? [];
    const windowRadius = this.windowRadius(
      normalized.lengths.length,
      statistics?.standardDeviation ?? 0,
      historicalErrors,
      stage,
    );
    const confidence = this.confidence(
      normalized.lengths.length,
      windowRadius,
      stage,
      normalized.epoch,
    );
    const mostLikelyDate = addCalendarDays(latest.startDate, cycleLength);
    const modelScores = ranked.map((entry) => entry.result.score);
    return {
      prediction: {
        id: crypto.randomUUID(),
        profileId,
        basedOnPeriodId: latest.id,
        generatedAt: new Date().toISOString(),
        mostLikelyDate,
        windowStart: addCalendarDays(mostLikelyDate, -windowRadius),
        windowEnd: addCalendarDays(mostLikelyDate, windowRadius),
        predictedCycleLength: cycleLength,
        confidence,
        modelUsed,
        algorithmVersion: PREDICTION_ALGORITHM_VERSION,
        usableCycleCount: normalized.lengths.length,
        historicalMAE: ranked[0]?.result.score.mae,
        historicalMedianAE: ranked[0]?.result.score.medianAbsoluteError,
        modelScores,
      },
      debug: {
        cyclesUsed: normalized.lengths,
        cyclesExcluded: normalized.excluded,
        candidateOutputs: outputs,
        modelScores,
        winner: modelUsed,
        windowRadius,
      },
    };
  }

  private predictionsPaused(stage: ReproductiveStage, usableCycles: number): boolean {
    if ((stage === 'POSTPARTUM' || stage === 'BREASTFEEDING_POSTPARTUM') && usableCycles > 0)
      return false;
    return [
      'PRE_MENARCHE',
      'PREGNANT',
      'POSTPARTUM',
      'BREASTFEEDING_POSTPARTUM',
      'MENOPAUSE',
      'POST_MENOPAUSE',
      'SURGICAL_MENOPAUSE',
    ].includes(stage);
  }

  private pausedMessage(stage: ReproductiveStage): string {
    if (stage === 'POSTPARTUM' || stage === 'BREASTFEEDING_POSTPARTUM')
      return 'Prediction unavailable. Periods after childbirth can return at different times.';
    if (stage === 'PREGNANT') return 'Period predictions are paused during pregnancy.';
    if (stage === 'PRE_MENARCHE') return 'Predictions begin after a first period is recorded.';
    return 'Ordinary period predictions are paused for this life stage.';
  }

  private combinedScore(result: BacktestResult): number {
    return result.score.mae + result.score.medianAbsoluteError;
  }

  private canEnsemble(best: BacktestResult, second: BacktestResult): boolean {
    return (
      second.score.predictions >= 2 && this.combinedScore(second) - this.combinedScore(best) <= 0.75
    );
  }

  private windowRadius(
    count: number,
    deviation: number,
    errors: readonly number[],
    stage: ReproductiveStage,
  ): number {
    const empirical =
      errors.length >= 4
        ? quantileSorted(
            [...errors].sort((a, b) => a - b),
            0.8,
          )
        : 0;
    let radius = Math.max(2, Math.ceil(empirical), Math.ceil(deviation * 0.8));
    if (count < 3) radius = Math.max(radius, 8);
    else if (count < 6) radius = Math.max(radius, 4);
    if (stage === 'ADOLESCENT' || stage === 'EARLY_POST_MENARCHE') radius += 3;
    if (stage === 'PERIMENOPAUSE') radius += 5;
    return Math.min(21, radius);
  }

  private confidence(
    count: number,
    radius: number,
    stage: ReproductiveStage,
    epoch: string,
  ): PredictionConfidence {
    if (count <= 2 || epoch.startsWith('POSTPARTUM')) return 'VERY_LOW';
    if (count < 6 || radius >= 5 || stage === 'PERIMENOPAUSE') return 'LOW';
    if (radius <= 3 && count >= 8 && stage !== 'ADOLESCENT' && stage !== 'EARLY_POST_MENARCHE')
      return 'HIGH';
    return 'MODERATE';
  }
}
