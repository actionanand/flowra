import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AppSnapshot, CyclePrediction, NotificationSettings, Profile } from '../models/app.models';
import { addCalendarDays, parseCalendarDate } from '../utils/calendar-date';
import { PredictionEngine } from '../cycle-engine/prediction-engine';
import { NativeIntegrationService } from './native-integration.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly predictionEngine = inject(PredictionEngine);
  private readonly native = inject(NativeIntegrationService);

  async requestPermission(): Promise<boolean> {
    if (!this.isAndroid()) return false;
    try {
      if (this.native.notificationPermissionGranted()) return true;
      return await this.native.requestNotificationPermission();
    } catch {
      return false;
    }
  }

  async reschedule(
    profile: Profile,
    prediction: CyclePrediction | undefined,
    settings: NotificationSettings,
  ): Promise<void> {
    if (!this.isAndroid()) return;
    const id = this.notificationId(profile.id);
    this.native.cancelReminders([id]);
    if (!settings.enabled || !prediction) return;
    if (!this.native.notificationPermissionGranted()) return;
    this.native.ensureNotificationChannel();
    const date = addCalendarDays(prediction.mostLikelyDate, -settings.daysBefore);
    const schedule = parseCalendarDate(date);
    schedule.setHours(9, 0, 0, 0);
    if (schedule.getTime() <= Date.now()) return;
    const privateText = 'Upcoming health reminder';
    const uncertainText =
      settings.daysBefore === 0
        ? 'Your next period may begin today.'
        : `Your next period may begin in about ${settings.daysBefore} days.`;
    this.native.scheduleReminder(
      id,
      settings.privacyMode ? 'Flowra' : `${profile.name}'s cycle reminder`,
      settings.privacyMode ? privateText : uncertainText,
      schedule.getTime(),
    );
  }

  async rescheduleSnapshot(snapshot: AppSnapshot): Promise<void> {
    if (!this.isAndroid()) return;
    for (const profile of snapshot.profiles) {
      const prediction = this.predictionEngine.predict(
        profile.id,
        snapshot.periods,
        profile.reproductiveStage,
      ).prediction;
      const settings = snapshot.notificationSettings.find(
        (item) => item.profileId === profile.id,
      ) ?? {
        id: profile.id,
        profileId: profile.id,
        enabled: false,
        daysBefore: 3,
        privacyMode: true,
      };
      await this.reschedule(profile, prediction, settings);
    }
  }

  async rebuildAfterRestore(
    previousProfiles: readonly Profile[],
    snapshot: AppSnapshot,
  ): Promise<void> {
    if (!this.isAndroid()) return;
    try {
      const profileIds = new Set([
        ...previousProfiles.map((profile) => profile.id),
        ...snapshot.profiles.map((profile) => profile.id),
      ]);
      if (profileIds.size)
        this.native.cancelReminders(
          [...profileIds].map((profileId) => this.notificationId(profileId)),
        );
      await this.rescheduleSnapshot(snapshot);
    } catch {
      // Restored health data remains valid if Android declines a scheduling operation.
    }
  }

  private notificationId(profileId: string): number {
    let hash = 17;
    for (const character of profileId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
    return Math.abs(hash % 2_000_000_000) + 1000;
  }

  private isAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }
}
