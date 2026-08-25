import { describe, expect, it } from 'vitest';
import { inferReproductiveStage, reproductiveStageFactorsChanged } from './reproductive-stage';

const baseProfile = {
  agePrecision: 'APPROXIMATE_AGE' as const,
  approximateAge: 30,
  menstruationStarted: 'YES' as const,
};

describe('reproductive stage inference', () => {
  const referenceDate = new Date(2026, 7, 25);

  it('classifies a 13-year-old whose periods have started as adolescent', () => {
    expect(inferReproductiveStage({ ...baseProfile, approximateAge: 13 }, referenceDate)).toBe(
      'ADOLESCENT',
    );
  });

  it('uses early post-menarche for the first five gynecologic years', () => {
    expect(
      inferReproductiveStage(
        { ...baseProfile, approximateAge: 13, approximateMenarcheAge: 11 },
        referenceDate,
      ),
    ).toBe('EARLY_POST_MENARCHE');
  });

  it('uses pre-menarche when periods have not started', () => {
    expect(
      inferReproductiveStage(
        { ...baseProfile, approximateAge: 13, menstruationStarted: 'NO' },
        referenceDate,
      ),
    ).toBe('PRE_MENARCHE');
  });

  it('detects stage-factor edits without treating a name edit as a factor edit', () => {
    expect(reproductiveStageFactorsChanged(baseProfile, baseProfile)).toBe(false);
    expect(
      reproductiveStageFactorsChanged(baseProfile, { ...baseProfile, approximateAge: 13 }),
    ).toBe(true);
  });
});
