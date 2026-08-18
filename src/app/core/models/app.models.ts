export type Relationship = 'SELF' | 'CHILD' | 'PARTNER' | 'RELATIVE' | 'FRIEND' | 'OTHER';
export type AgePrecision = 'EXACT_DOB' | 'BIRTH_YEAR' | 'APPROXIMATE_AGE' | 'AGE_RANGE';
export type MenstruationStatus = 'YES' | 'NO' | 'UNKNOWN' | 'PREFER_NOT_TO_SAY';
export type ReproductiveStage =
  | 'PRE_MENARCHE'
  | 'EARLY_POST_MENARCHE'
  | 'ADOLESCENT'
  | 'ADULT_REPRODUCTIVE'
  | 'PREGNANT'
  | 'POSTPARTUM'
  | 'BREASTFEEDING_POSTPARTUM'
  | 'PERIMENOPAUSE'
  | 'MENOPAUSE'
  | 'POST_MENOPAUSE'
  | 'SURGICAL_MENOPAUSE'
  | 'CUSTOM'
  | 'UNKNOWN';
export type PredictionEpoch = 'PRE_PREGNANCY' | 'POSTPARTUM_1' | 'POSTPARTUM_2' | 'NORMAL';
export type ThemePreference = 'LIGHT' | 'DARK' | 'AUTOMATIC';

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly relationship: Relationship;
  readonly avatar?: string;
  readonly notes?: string;
  readonly dateOfBirth?: string;
  readonly birthYear?: number;
  readonly approximateAge?: number;
  readonly ageRange?: string;
  readonly agePrecision: AgePrecision;
  readonly menstruationStarted: MenstruationStatus;
  readonly menarcheDate?: string;
  readonly menarcheYear?: number;
  readonly approximateMenarcheAge?: number;
  readonly reproductiveStage: ReproductiveStage;
  readonly predictionEpoch: PredictionEpoch;
  readonly hiddenFromPreviews: boolean;
  readonly requiresAuthentication: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Period {
  readonly id: string;
  readonly profileId: string;
  readonly startDate: string;
  readonly endDate?: string;
  readonly confirmed: boolean;
  readonly excludedFromPrediction: boolean;
  readonly exclusionReason?: string;
  readonly predictionEpoch: PredictionEpoch;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type FlowLevel = 'SPOTTING' | 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'VERY_HEAVY';
export type Severity = 'MILD' | 'MODERATE' | 'SEVERE';

export interface SymptomEntry {
  readonly name: string;
  readonly severity: Severity;
}

export interface DailyLog {
  readonly id: string;
  readonly profileId: string;
  readonly date: string;
  readonly flow?: FlowLevel;
  readonly products: readonly string[];
  readonly productCount?: number;
  readonly symptoms: readonly SymptomEntry[];
  readonly moods: readonly string[];
  readonly overallMood?: 1 | 2 | 3 | 4 | 5;
  readonly notes?: string;
  readonly updatedAt: string;
}

export interface HealthEvent {
  readonly id: string;
  readonly profileId: string;
  readonly date: string;
  readonly type: string;
  readonly notes?: string;
  readonly createdAt: string;
}

export type PredictionConfidence = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH';
export type CyclePattern = 'INSUFFICIENT_DATA' | 'STABLE' | 'VARIABLE' | 'HIGHLY_VARIABLE';

export interface ModelScore {
  readonly model: string;
  readonly mae: number;
  readonly medianAbsoluteError: number;
  readonly rmse: number;
  readonly withinOneDay: number;
  readonly withinTwoDays: number;
  readonly withinThreeDays: number;
  readonly bias: number;
  readonly predictions: number;
}

export interface CyclePrediction {
  readonly id: string;
  readonly profileId: string;
  readonly basedOnPeriodId: string;
  readonly generatedAt: string;
  readonly mostLikelyDate: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly predictedCycleLength: number;
  readonly confidence: PredictionConfidence;
  readonly modelUsed: string;
  readonly algorithmVersion: string;
  readonly usableCycleCount: number;
  readonly historicalMAE?: number;
  readonly historicalMedianAE?: number;
  readonly modelScores: readonly ModelScore[];
  readonly actualStartDate?: string;
  readonly predictionErrorDays?: number;
}

export interface CycleStatistics {
  readonly count: number;
  readonly values: readonly number[];
  readonly mean: number;
  readonly median: number;
  readonly weightedMean: number;
  readonly weightedMedian: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly range: number;
  readonly standardDeviation: number;
  readonly medianAbsoluteDeviation: number;
  readonly interquartileRange: number;
  readonly q1: number;
  readonly q3: number;
  readonly recent3Median: number;
  readonly recent6Median: number;
  readonly recent12Median: number;
  readonly trend: number;
  readonly pattern: CyclePattern;
}

export interface NotificationSettings {
  readonly id: string;
  readonly profileId: string;
  readonly enabled: boolean;
  readonly daysBefore: number;
  readonly privacyMode: boolean;
}

export interface AppSettings {
  readonly id: 'app-settings';
  readonly theme: ThemePreference;
  readonly pinEnabled: boolean;
  readonly pinSalt?: string;
  readonly pinVerifier?: string;
  readonly biometricEnabled: boolean;
  readonly autoLockMinutes: number;
  readonly lockWhenBackgrounded: boolean;
  readonly screenshotBlocking: boolean;
  readonly hideRecentPreview: boolean;
}

export type RecordKind =
  | 'profiles'
  | 'periods'
  | 'daily_logs'
  | 'health_events'
  | 'cycle_predictions'
  | 'notification_settings'
  | 'app_settings';

export interface AppSnapshot {
  readonly profiles: readonly Profile[];
  readonly periods: readonly Period[];
  readonly dailyLogs: readonly DailyLog[];
  readonly healthEvents: readonly HealthEvent[];
  readonly predictions: readonly CyclePrediction[];
  readonly notificationSettings: readonly NotificationSettings[];
  readonly appSettings: AppSettings;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app-settings',
  theme: 'AUTOMATIC',
  pinEnabled: false,
  biometricEnabled: false,
  autoLockMinutes: 5,
  lockWhenBackgrounded: true,
  screenshotBlocking: false,
  hideRecentPreview: true,
};
