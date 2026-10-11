import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { calculateCycleStatistics } from '../../core/cycle-engine/cycle-statistics';
import { AppStore } from '../../core/services/app-store.service';
import { TranslatePipe } from '@ngx-translate/core';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  addCalendarDays,
  calendarDaysBetween,
  displayDate,
  todayCalendarDate,
} from '../../core/utils/calendar-date';
import { SnackbarService } from '../../core/services/snackbar.service';
import { ConfirmationDialog } from '../../shared/components/confirmation-dialog/confirmation-dialog';
import {
  HistoricalPeriodRange,
  PeriodHistoryDialog,
} from '../../shared/components/period-history-dialog/period-history-dialog';

const PERIOD_HISTORY_ERROR_KEYS: Readonly<Record<string, string>> = {
  REQUIRED: 'periodHistory.errors.REQUIRED',
  INVALID_DATE: 'periodHistory.errors.INVALID_DATE',
  START_NOT_EARLIER: 'periodHistory.errors.START_NOT_EARLIER',
  FUTURE_DATE: 'periodHistory.errors.FUTURE_DATE',
  INVALID_RANGE: 'periodHistory.errors.INVALID_RANGE',
  OVERLAP: 'periodHistory.errors.OVERLAP',
};

@Component({
  selector: 'app-home',
  imports: [RouterLink, DecimalPipe, ConfirmationDialog, PeriodHistoryDialog, TranslatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.html',
  styleUrls: ['./home.scss', './home.flags.scss'],
})
export class Home {
  protected readonly store = inject(AppStore);
  private readonly i18n = inject(I18nService);
  private readonly snackbar = inject(SnackbarService);
  protected readonly periodConfirmationOpen = signal(false);
  protected readonly periodHistoryOpen = signal(false);
  protected readonly periodHistorySaving = signal(false);
  protected readonly periodHistoryErrorKey = signal('');
  private readonly periodActionButton =
    viewChild<ElementRef<HTMLButtonElement>>('periodActionButton');
  private readonly periodEarlierButton =
    viewChild<ElementRef<HTMLButtonElement>>('periodEarlierButton');
  protected readonly today = todayCalendarDate();
  protected readonly latestHistoricalStartDate = addCalendarDays(this.today, -1);
  protected readonly overlayOpen = computed(
    () => this.periodConfirmationOpen() || this.periodHistoryOpen(),
  );
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
  protected requestPeriodAction(): void {
    this.snackbar.dismiss();
    this.periodConfirmationOpen.set(true);
  }
  protected cancelPeriodAction(): void {
    this.periodConfirmationOpen.set(false);
    globalThis.setTimeout(() => this.periodActionButton()?.nativeElement.focus());
  }
  protected async primaryPeriodAction(): Promise<void> {
    const endingPeriod = !!this.store.activePeriod();
    this.periodConfirmationOpen.set(false);
    try {
      if (endingPeriod) await this.store.endPeriod();
      else await this.store.startPeriod();
      const action = this.i18n.text(endingPeriod ? 'home.endPeriod' : 'home.startPeriod');
      this.snackbar.show(`${action} — ${this.i18n.text('log.saved')}`);
    } catch (error) {
      this.snackbar.show(
        error instanceof Error ? error.message : 'The period was not changed.',
        'WARNING',
      );
    } finally {
      globalThis.setTimeout(() => this.periodActionButton()?.nativeElement.focus());
    }
  }

  protected openPeriodHistory(): void {
    this.snackbar.dismiss();
    this.periodHistoryErrorKey.set('');
    this.periodHistoryOpen.set(true);
  }

  protected cancelPeriodHistory(): void {
    if (this.periodHistorySaving()) return;
    this.periodHistoryOpen.set(false);
    this.periodHistoryErrorKey.set('');
    globalThis.setTimeout(() => this.periodEarlierButton()?.nativeElement.focus());
  }

  protected clearPeriodHistoryError(): void {
    this.periodHistoryErrorKey.set('');
  }

  protected async saveHistoricalPeriod(range: HistoricalPeriodRange): Promise<void> {
    this.periodHistorySaving.set(true);
    this.periodHistoryErrorKey.set('');
    try {
      await this.store.saveHistoricalPeriod(range.startDate, range.endDate);
      this.periodHistoryOpen.set(false);
      this.snackbar.show(this.i18n.text('periodHistory.saved'));
      globalThis.setTimeout(() => this.periodEarlierButton()?.nativeElement.focus());
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      this.periodHistoryErrorKey.set(
        PERIOD_HISTORY_ERROR_KEYS[code] ?? 'periodHistory.errors.SAVE_FAILED',
      );
    } finally {
      this.periodHistorySaving.set(false);
    }
  }
}
