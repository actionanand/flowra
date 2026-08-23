import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { CyclePrediction, NotificationSettings, Profile } from '../models/app.models';
import { NotificationService } from './notification.service';
import { NativeIntegrationService } from './native-integration.service';

describe('NotificationService', () => {
  const profile: Profile = {
    id: 'profile-reminder',
    name: 'Meera',
    relationship: 'SELF',
    agePrecision: 'BIRTH_YEAR',
    birthYear: 1992,
    menstruationStarted: 'YES',
    reproductiveStage: 'ADULT_REPRODUCTIVE',
    predictionEpoch: 'NORMAL',
    hiddenFromPreviews: false,
    requiresAuthentication: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const prediction: CyclePrediction = {
    id: 'prediction-reminder',
    profileId: profile.id,
    basedOnPeriodId: 'period-reminder',
    generatedAt: '2026-08-19T00:00:00.000Z',
    mostLikelyDate: '2026-08-23',
    windowStart: '2026-08-20',
    windowEnd: '2026-08-26',
    predictedCycleLength: 28,
    confidence: 'HIGH',
    modelUsed: 'test',
    algorithmVersion: 'cycle-predictor-v1',
    usableCycleCount: 8,
    modelScores: [],
  };
  const settings: NotificationSettings = {
    id: profile.id,
    profileId: profile.id,
    enabled: true,
    daysBefore: 3,
    privacyMode: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T08:00:00.000+05:30'));
    TestBed.configureTestingModule({});
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    const native = TestBed.inject(NativeIntegrationService);
    vi.spyOn(native, 'notificationPermissionGranted').mockReturnValue(true);
    vi.spyOn(native, 'ensureNotificationChannel').mockReturnValue(undefined);
    vi.spyOn(native, 'cancelReminders').mockReturnValue(undefined);
    vi.spyOn(native, 'scheduleReminder').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses the guarded native Android permission bridge', async () => {
    const native = TestBed.inject(NativeIntegrationService);
    vi.mocked(native.notificationPermissionGranted).mockReturnValue(false);
    const request = vi.spyOn(native, 'requestNotificationPermission').mockResolvedValue(true);

    await expect(TestBed.inject(NotificationService).requestPermission()).resolves.toBe(true);

    expect(request).toHaveBeenCalledOnce();
  });

  it('returns denied instead of propagating native permission errors', async () => {
    const native = TestBed.inject(NativeIntegrationService);
    vi.mocked(native.notificationPermissionGranted).mockReturnValue(false);
    vi.spyOn(native, 'requestNotificationPermission').mockRejectedValue(
      new Error('OEM permission activity failed'),
    );

    await expect(TestBed.inject(NotificationService).requestPermission()).resolves.toBe(false);
  });

  it('schedules the selected number of days before the prediction at 9 AM', async () => {
    const native = TestBed.inject(NativeIntegrationService);

    await TestBed.inject(NotificationService).reschedule(profile, prediction, settings);

    const atMillis = vi.mocked(native.scheduleReminder).mock.calls[0][3];
    const at = new Date(atMillis);
    expect(at.getFullYear()).toBe(2026);
    expect(at.getMonth()).toBe(7);
    expect(at.getDate()).toBe(20);
    expect(at.getHours()).toBe(9);
    expect(native.scheduleReminder).toHaveBeenCalledWith(
      expect.any(Number),
      'Flowra',
      'Upcoming health reminder',
      atMillis,
    );
    expect(native.ensureNotificationChannel).toHaveBeenCalled();
  });

  it('cancels the stable profile notification when reminders are disabled', async () => {
    const native = TestBed.inject(NativeIntegrationService);

    await TestBed.inject(NotificationService).reschedule(profile, prediction, {
      ...settings,
      enabled: false,
    });

    expect(native.cancelReminders).toHaveBeenCalledOnce();
    expect(native.scheduleReminder).not.toHaveBeenCalled();
  });
});
