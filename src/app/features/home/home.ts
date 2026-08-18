import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { calculateCycleStatistics } from '../../core/cycle-engine/cycle-statistics';
import { AppStore } from '../../core/services/app-store.service';
import { TranslatePipe } from '@ngx-translate/core';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  calendarDaysBetween,
  displayDate,
  todayCalendarDate,
} from '../../core/utils/calendar-date';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DecimalPipe, TranslatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.html',
  styleUrls: ['./home.scss', './home.flags.scss'],
})
export class Home {
  protected readonly store = inject(AppStore);
  private readonly i18n = inject(I18nService);
  protected readonly today = todayCalendarDate();
  protected readonly cycleLengths = computed(() => {
    const periods = this.store.profilePeriods();
    return periods
      .slice(0, -1)
      .map((period, index) => calendarDaysBetween(period.startDate, periods[index + 1].startDate));
  });
  protected readonly statistics = computed(() => calculateCycleStatistics(this.cycleLengths()));
  protected readonly daysUntil = computed(() =>
    this.store.prediction()
      ? calendarDaysBetween(this.today, this.store.prediction()!.mostLikelyDate)
      : undefined,
  );
  protected readonly recentLog = computed(
    () =>
      this.store
        .dailyLogs()
        .filter((log) => log.profileId === this.store.activeProfileId())
        .sort((a, b) => b.date.localeCompare(a.date))[0],
  );
  protected readonly healthNotice = computed(() => {
    const profile = this.store.activeProfile();
    const latest = this.store.profilePeriods().at(-1);
    if (!profile || !latest) return undefined;
    if (['MENOPAUSE', 'POST_MENOPAUSE'].includes(profile.reproductiveStage))
      return 'Bleeding recorded after a confirmed menopause stage is worth discussing with a healthcare professional.';
    if (
      this.store
        .dailyLogs()
        .some((log) => log.profileId === profile.id && log.flow === 'VERY_HEAVY')
    )
      return 'Very heavy flow was recorded. If this feels concerning or continues, consider professional medical advice.';
    if (latest.endDate && calendarDaysBetween(latest.startDate, latest.endDate) + 1 > 7)
      return 'This recorded period lasted more than 7 days. If that is unexpected or concerning, consider professional advice.';
    if (
      !['PREGNANT', 'POSTPARTUM', 'BREASTFEEDING_POSTPARTUM'].includes(profile.reproductiveStage) &&
      calendarDaysBetween(latest.startDate, this.today) >= 365
    )
      return 'No period has been recorded for 12 months. If menopause has been confirmed or matches the situation, update the profile stage.';
    return undefined;
  });
  protected predictionMessage(): string {
    const message = this.store.predictionResult()?.message;
    if (message === 'Not enough history for a reliable prediction.') return 'home.notEnoughHistory';
    if (message === 'No recorded period yet.') return 'home.noRecordedPeriod';
    return message ?? 'home.noHistory';
  }
  protected displayDate = (value: string, pattern = 'd MMM yyyy') =>
    displayDate(value, pattern, this.i18n.language());
  protected async primaryPeriodAction(): Promise<void> {
    if (this.store.activePeriod()) await this.store.endPeriod();
    else await this.store.startPeriod();
  }
}
