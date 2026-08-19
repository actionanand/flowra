import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CyclePrediction, NotificationSettings, Profile } from '../models/app.models';
import { NotificationService } from './notification.service';

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
    TestBed.configureTestingModule({});
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.spyOn(LocalNotifications, 'checkPermissions').mockResolvedValue({ display: 'granted' });
    vi.spyOn(LocalNotifications, 'cancel').mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('schedules the selected number of days before the prediction at 9 AM', async () => {
    let pendingId = 0;
    const schedule = vi
      .spyOn(LocalNotifications, 'schedule')
      .mockImplementation(async ({ notifications }) => {
        pendingId = notifications[0].id;
        return { notifications: notifications.map(({ id }) => ({ id })) };
      });
    vi.spyOn(LocalNotifications, 'getPending').mockImplementation(async () => ({
      notifications: [{ id: pendingId, title: 'Flowra', body: 'Upcoming health reminder' }],
    }));

    await TestBed.inject(NotificationService).reschedule(profile, prediction, settings);

    const notification = schedule.mock.calls[0][0].notifications[0];
    const at = notification.schedule?.at;
    expect(at).toBeDefined();
    expect(at?.getFullYear()).toBe(2026);
    expect(at?.getMonth()).toBe(7);
    expect(at?.getDate()).toBe(20);
    expect(at?.getHours()).toBe(9);
    expect(notification.title).toBe('Flowra');
    expect(notification.body).toBe('Upcoming health reminder');
  });

  it('cancels the stable profile notification when reminders are disabled', async () => {
    const cancel = vi.spyOn(LocalNotifications, 'cancel');
    const schedule = vi.spyOn(LocalNotifications, 'schedule');

    await TestBed.inject(NotificationService).reschedule(profile, prediction, {
      ...settings,
      enabled: false,
    });

    expect(cancel).toHaveBeenCalledOnce();
    expect(schedule).not.toHaveBeenCalled();
  });
});
