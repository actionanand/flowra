import { Profile, ReproductiveStage } from '../models/app.models';

export type ReproductiveStageFactors = Pick<
  Profile,
  | 'agePrecision'
  | 'dateOfBirth'
  | 'birthYear'
  | 'approximateAge'
  | 'ageRange'
  | 'menstruationStarted'
  | 'menarcheDate'
  | 'menarcheYear'
  | 'approximateMenarcheAge'
>;

const STAGE_FACTOR_KEYS: readonly (keyof ReproductiveStageFactors)[] = [
  'agePrecision',
  'dateOfBirth',
  'birthYear',
  'approximateAge',
  'ageRange',
  'menstruationStarted',
  'menarcheDate',
  'menarcheYear',
  'approximateMenarcheAge',
];

export function inferReproductiveStage(
  profile: ReproductiveStageFactors,
  referenceDate = new Date(),
): ReproductiveStage {
  if (profile.menstruationStarted === 'NO') return 'PRE_MENARCHE';

  const age = currentAge(profile, referenceDate);
  const gynecologicAge = yearsSinceMenarche(profile, age, referenceDate);

  if (gynecologicAge !== undefined && gynecologicAge <= 5) return 'EARLY_POST_MENARCHE';
  if (age !== undefined && age < 20) return 'ADOLESCENT';
  return 'ADULT_REPRODUCTIVE';
}

export function reproductiveStageFactorsChanged(
  previous: ReproductiveStageFactors,
  next: ReproductiveStageFactors,
): boolean {
  return STAGE_FACTOR_KEYS.some((key) => previous[key] !== next[key]);
}

function currentAge(profile: ReproductiveStageFactors, referenceDate: Date): number | undefined {
  if (profile.agePrecision === 'EXACT_DOB' && profile.dateOfBirth) {
    return ageFromDate(profile.dateOfBirth, referenceDate);
  }
  if (profile.agePrecision === 'BIRTH_YEAR' && profile.birthYear) {
    return referenceDate.getFullYear() - profile.birthYear;
  }
  if (profile.agePrecision === 'APPROXIMATE_AGE') return profile.approximateAge;
  if (profile.agePrecision === 'AGE_RANGE' && profile.ageRange) {
    if (profile.ageRange === 'Under 10') return 9;
    const lowerBound = Number.parseInt(profile.ageRange, 10);
    return Number.isNaN(lowerBound) ? undefined : lowerBound;
  }
  return undefined;
}

function yearsSinceMenarche(
  profile: ReproductiveStageFactors,
  age: number | undefined,
  referenceDate: Date,
): number | undefined {
  if (profile.menarcheDate) return ageFromDate(profile.menarcheDate, referenceDate);
  if (profile.menarcheYear) return referenceDate.getFullYear() - profile.menarcheYear;
  if (profile.approximateMenarcheAge !== undefined && age !== undefined) {
    return Math.max(0, age - profile.approximateMenarcheAge);
  }
  return undefined;
}

function ageFromDate(value: string, referenceDate: Date): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthdayPassed =
    referenceDate.getMonth() + 1 > month ||
    (referenceDate.getMonth() + 1 === month && referenceDate.getDate() >= day);
  return referenceDate.getFullYear() - year - (birthdayPassed ? 0 : 1);
}
