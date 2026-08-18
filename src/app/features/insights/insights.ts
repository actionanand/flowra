import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, inject } from '@angular/core';
import { DecimalPipe, JsonPipe } from '@angular/common';
import { calculateCycleStatistics } from '../../core/cycle-engine/cycle-statistics';
import { AppStore } from '../../core/services/app-store.service';
import { calendarDaysBetween, displayDate } from '../../core/utils/calendar-date';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-insights',
  imports: [DecimalPipe, JsonPipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './insights.html',
  styleUrls: ['./insights.scss', './insights.export.scss'],
})
export class InsightsPage {
  protected readonly store = inject(AppStore);
  protected readonly development = !environment.production;
  protected readonly cycleLengths = computed(() => {
    const periods = this.store.profilePeriods();
    return periods
      .slice(0, -1)
      .map((period, index) => calendarDaysBetween(period.startDate, periods[index + 1].startDate));
  });
  protected readonly statistics = computed(() => calculateCycleStatistics(this.cycleLengths()));
  protected readonly maxCycle = computed(() => Math.max(1, ...this.cycleLengths()));
  protected readonly periodDurations = computed(() =>
    this.store
      .profilePeriods()
      .filter((period) => period.endDate)
      .map((period) => calendarDaysBetween(period.startDate, period.endDate!) + 1),
  );
  protected readonly averagePeriodDuration = computed(() =>
    this.periodDurations().length
      ? this.periodDurations().reduce((total, value) => total + value, 0) /
        this.periodDurations().length
      : undefined,
  );
  protected readonly commonSymptoms = computed(() => {
    const counts = new Map<string, number>();
    for (const log of this.store
      .dailyLogs()
      .filter((item) => item.profileId === this.store.activeProfileId()))
      for (const symptom of log.symptoms)
        counts.set(symptom.name, (counts.get(symptom.name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  });
  protected readonly recentErrors = computed(() =>
    this.store
      .savedPredictions()
      .filter(
        (prediction) =>
          prediction.profileId === this.store.activeProfileId() &&
          prediction.predictionErrorDays !== undefined,
      )
      .slice(-6),
  );
  protected exportCsv(): void {
    const rows = ['Start,End,Duration,Cycle,Excluded'];
    const periods = this.store.profilePeriods();
    periods.forEach((period, index) =>
      rows.push(
        [
          period.startDate,
          period.endDate ?? '',
          period.endDate ? calendarDaysBetween(period.startDate, period.endDate) + 1 : '',
          periods[index + 1]
            ? calendarDaysBetween(period.startDate, periods[index + 1].startDate)
            : '',
          period.excludedFromPrediction ? 'Yes' : 'No',
        ].join(','),
      ),
    );
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `flowra-period-history-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  protected exportPdf(): void {
    globalThis.print();
  }
  protected displayDate = displayDate;
}
