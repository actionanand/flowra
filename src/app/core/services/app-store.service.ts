import { computed, inject, Injectable, signal } from '@angular/core';
import { PredictionEngine } from '../cycle-engine/prediction-engine';
import {
  AppSettings,
  CyclePrediction,
  DailyLog,
  DEFAULT_APP_SETTINGS,
  HealthEvent,
  NotificationSettings,
  Period,
  Profile,
  Relationship,
} from '../models/app.models';
import { LOCAL_RECORD_REPOSITORY } from '../repositories/repository.contracts';
import { calendarDaysBetween, todayCalendarDate } from '../utils/calendar-date';
import { NotificationService } from './notification.service';
import { ThemeService } from './theme.service';

@Injectable({ providedIn: 'root' })
export class AppStore {
  private readonly repository = inject(LOCAL_RECORD_REPOSITORY);
  private readonly engine = inject(PredictionEngine);
  private readonly themeService = inject(ThemeService);
  private readonly notifications = inject(NotificationService);
  readonly ready = signal(false);
  readonly profiles = signal<readonly Profile[]>([]);
  readonly periods = signal<readonly Period[]>([]);
  readonly dailyLogs = signal<readonly DailyLog[]>([]);
  readonly healthEvents = signal<readonly HealthEvent[]>([]);
  readonly savedPredictions = signal<readonly CyclePrediction[]>([]);
  readonly notificationSettings = signal<readonly NotificationSettings[]>([]);
  readonly settings = signal<AppSettings>(DEFAULT_APP_SETTINGS);
  readonly activeProfileId = signal('');
  readonly activeProfile = computed(() =>
    this.profiles().find((profile) => profile.id === this.activeProfileId()),
  );
  readonly profilePeriods = computed(() =>
    this.periods()
      .filter((period) => period.profileId === this.activeProfileId())
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  );
  readonly activePeriod = computed(() =>
    [...this.profilePeriods()].reverse().find((period) => !period.endDate),
  );
  readonly predictionResult = computed(() => {
    const profile = this.activeProfile();
    return profile
      ? this.engine.predict(profile.id, this.profilePeriods(), profile.reproductiveStage)
      : undefined;
  });
  readonly prediction = computed(() => this.predictionResult()?.prediction);
  readonly currentCycleDay = computed(() => {
    const last = this.profilePeriods().at(-1);
    return last ? calendarDaysBetween(last.startDate, todayCalendarDate()) + 1 : undefined;
  });

  async initialize(): Promise<void> {
    const [profiles, periods, logs, events, predictions, reminderSettings, settings] =
      await Promise.all([
        this.repository.list<Profile>('profiles'),
        this.repository.list<Period>('periods'),
        this.repository.list<DailyLog>('daily_logs'),
        this.repository.list<HealthEvent>('health_events'),
        this.repository.list<CyclePrediction>('cycle_predictions'),
        this.repository.list<NotificationSettings>('notification_settings'),
        this.repository.list<AppSettings>('app_settings'),
      ]);
    this.profiles.set(profiles);
    this.periods.set(periods);
    this.dailyLogs.set(logs);
    this.healthEvents.set(events);
    this.savedPredictions.set(predictions);
    this.notificationSettings.set(reminderSettings);
    this.settings.set(settings[0] ?? DEFAULT_APP_SETTINGS);
    this.themeService.setPreference(this.settings().theme);
    this.activeProfileId.set(profiles[0]?.id ?? '');
    this.ready.set(true);
  }

  async createProfile(input: {
    name: string;
    relationship: Relationship;
    agePrecision: Profile['agePrecision'];
    dateOfBirth?: string;
    birthYear?: number;
    approximateAge?: number;
    ageRange?: string;
    menstruationStarted: Profile['menstruationStarted'];
    menarcheDate?: string;
    menarcheYear?: number;
    approximateMenarcheAge?: number;
  }): Promise<Profile> {
    const now = new Date().toISOString();
    const rangeAge =
      input.ageRange === 'Under 10'
        ? 9
        : input.ageRange
          ? Number.parseInt(input.ageRange, 10)
          : undefined;
    const approximateAge =
      input.approximateAge ??
      rangeAge ??
      (input.birthYear
        ? new Date().getFullYear() - input.birthYear
        : input.dateOfBirth
          ? new Date().getFullYear() - Number(input.dateOfBirth.slice(0, 4))
          : undefined);
    const menarcheYear =
      input.menarcheYear ??
      (input.menarcheDate
        ? Number(input.menarcheDate.slice(0, 4))
        : input.approximateMenarcheAge && approximateAge
          ? new Date().getFullYear() - (approximateAge - input.approximateMenarcheAge)
          : undefined);
    const gynecologicAge = menarcheYear ? new Date().getFullYear() - menarcheYear : undefined;
    const stage =
      input.menstruationStarted === 'NO'
        ? 'PRE_MENARCHE'
        : gynecologicAge !== undefined && gynecologicAge <= 5
          ? 'EARLY_POST_MENARCHE'
          : (approximateAge ?? 20) < 20
            ? 'ADOLESCENT'
            : 'ADULT_REPRODUCTIVE';
    const profile: Profile = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      relationship: input.relationship,
      dateOfBirth: input.dateOfBirth,
      birthYear: input.birthYear,
      approximateAge: input.approximateAge,
      ageRange: input.ageRange,
      agePrecision: input.agePrecision,
      menstruationStarted: input.menstruationStarted,
      menarcheDate: input.menarcheDate,
      menarcheYear: input.menarcheYear,
      approximateMenarcheAge: input.approximateMenarcheAge,
      reproductiveStage: stage,
      predictionEpoch: 'NORMAL',
      hiddenFromPreviews: false,
      requiresAuthentication: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.put('profiles', profile);
    this.profiles.update((profiles) => [...profiles, profile]);
    this.activeProfileId.set(profile.id);
    const reminder: NotificationSettings = {
      id: profile.id,
      profileId: profile.id,
      enabled: false,
      daysBefore: 3,
      privacyMode: true,
    };
    await this.repository.put('notification_settings', reminder);
    this.notificationSettings.update((settings) => [...settings, reminder]);
    return profile;
  }

  selectProfile(id: string): void {
    this.activeProfileId.set(id);
  }

  async updateProfile(profile: Profile): Promise<void> {
    const updated = { ...profile, updatedAt: new Date().toISOString() };
    await this.repository.put('profiles', updated);
    this.profiles.update((profiles) =>
      profiles.map((item) => (item.id === updated.id ? updated : item)),
    );
    if (updated.id === this.activeProfileId()) await this.syncReminder();
  }

  async startPeriod(date = todayCalendarDate()): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) return;
    const now = new Date().toISOString();
    const existingPrediction = this.prediction();
    if (existingPrediction) {
      const resolved: CyclePrediction = {
        ...existingPrediction,
        actualStartDate: date,
        predictionErrorDays: calendarDaysBetween(existingPrediction.mostLikelyDate, date),
      };
      await this.repository.put('cycle_predictions', resolved);
      this.savedPredictions.update((items) => [...items, resolved]);
    }
    const period: Period = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      startDate: date,
      confirmed: true,
      excludedFromPrediction: false,
      predictionEpoch: profile.predictionEpoch,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.put('periods', period);
    this.periods.update((periods) => [...periods, period]);
    if (profile.menstruationStarted === 'NO') {
      await this.updateProfile({
        ...profile,
        menstruationStarted: 'YES',
        reproductiveStage: 'EARLY_POST_MENARCHE',
      });
    }
    await this.syncReminder();
  }

  async endPeriod(date = todayCalendarDate()): Promise<void> {
    const period = this.activePeriod();
    if (!period) return;
    const updated = { ...period, endDate: date, updatedAt: new Date().toISOString() };
    await this.repository.put('periods', updated);
    this.periods.update((periods) =>
      periods.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  async saveDailyLog(log: DailyLog): Promise<void> {
    await this.repository.put('daily_logs', log);
    this.dailyLogs.update((logs) => [...logs.filter((item) => item.id !== log.id), log]);
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    await this.repository.put('app_settings', settings);
    this.settings.set(settings);
    this.themeService.setPreference(settings.theme);
  }

  async updateReminder(settings: NotificationSettings): Promise<void> {
    await this.repository.put('notification_settings', settings);
    this.notificationSettings.update((items) => [
      ...items.filter((item) => item.profileId !== settings.profileId),
      settings,
    ]);
    await this.syncReminder();
  }

  reminderFor(profileId: string): NotificationSettings {
    return (
      this.notificationSettings().find((setting) => setting.profileId === profileId) ?? {
        id: profileId,
        profileId,
        enabled: false,
        daysBefore: 3,
        privacyMode: true,
      }
    );
  }

  private async syncReminder(): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) return;
    await this.notifications.reschedule(profile, this.prediction(), this.reminderFor(profile.id));
  }
}
