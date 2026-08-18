import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CyclePrediction, NotificationSettings, Profile } from '../models/app.models';
import { addCalendarDays, parseCalendarDate } from '../utils/calendar-date';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  async requestPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  }

  async reschedule(
    profile: Profile,
    prediction: CyclePrediction | undefined,
    settings: NotificationSettings,
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const id = this.notificationId(profile.id);
    await LocalNotifications.cancel({ notifications: [{ id }] });
    if (!settings.enabled || !prediction) return;
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    const date = addCalendarDays(prediction.mostLikelyDate, -settings.daysBefore);
    const schedule = parseCalendarDate(date);
    schedule.setHours(9, 0, 0, 0);
    if (schedule.getTime() <= Date.now()) return;
    const privateText = 'Upcoming health reminder';
    const uncertainText =
      settings.daysBefore === 0
        ? 'Your next period may begin today.'
        : `Your next period may begin in about ${settings.daysBefore} days.`;
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: settings.privacyMode ? 'Flowra' : `${profile.name}'s cycle reminder`,
          body: settings.privacyMode ? privateText : uncertainText,
          schedule: { at: schedule, allowWhileIdle: true },
          channelId: 'flowra-cycle-reminders',
          smallIcon: 'ic_stat_flowra',
        },
      ],
    });
  }

  private notificationId(profileId: string): number {
    let hash = 17;
    for (const character of profileId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
    return Math.abs(hash % 2_000_000_000) + 1000;
  }
}
