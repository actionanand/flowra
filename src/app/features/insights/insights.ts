import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, inject } from '@angular/core';
import { DecimalPipe, JsonPipe } from '@angular/common';
import { calculateCycleStatistics } from '../../core/cycle-engine/cycle-statistics';
import { AppStore } from '../../core/services/app-store.service';
import { TranslatePipe } from '@ngx-translate/core';
import { calendarDaysBetween, displayDate } from '../../core/utils/calendar-date';
import { environment } from '../../../environments/environment';
import { FileExportService } from '../../core/services/file-export.service';

@Component({
  selector: 'app-insights',
  imports: [DecimalPipe, JsonPipe, TranslatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './insights.html',
  styleUrls: ['./insights.scss', './insights.export.scss'],
})
export class InsightsPage {
  protected readonly store = inject(AppStore);
  private readonly fileExport = inject(FileExportService);
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
  protected async exportCsv(): Promise<void> {
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
    await this.fileExport.exportCsv(
      `flowra-period-history-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.join('\n'),
      'Flowra period history',
    );
  }
  protected async exportPdf(): Promise<void> {
    const periods = this.store.profilePeriods();
    const rows = periods.map((period, index) => ({
      start: period.startDate,
      end: period.endDate ?? '',
      duration: period.endDate
        ? String(calendarDaysBetween(period.startDate, period.endDate) + 1)
        : '',
      cycle: periods[index + 1]
        ? String(calendarDaysBetween(period.startDate, periods[index + 1].startDate))
        : '',
      excluded: period.excludedFromPrediction ? 'Yes' : 'No',
    }));
    const title = 'Flowra period history';
    const profile = this.store.activeProfile()?.name ?? '';
    const escaped = (value: string): string =>
      value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const tableRows = rows
      .map(
        (row) =>
          `<tr><td>${escaped(row.start)}</td><td>${escaped(row.end)}</td><td>${row.duration}</td><td>${row.cycle}</td><td>${row.excluded}</td></tr>`,
      )
      .join('');
    const html = `<!doctype html><html><head><title>${title}</title><style>body{font:14px system-ui;padding:24px;color:#2d1823}h1{color:#c72f68}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ead9e1;text-align:left}</style></head><body><h1>${title}</h1><p>${escaped(profile)}</p><table><thead><tr><th>Start</th><th>End</th><th>Duration</th><th>Cycle</th><th>Excluded</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
    await this.fileExport.exportPdf(
      `flowra-period-history-${new Date().toISOString().slice(0, 10)}.pdf`,
      JSON.stringify({ title, profile, generatedAt: new Date().toISOString(), rows }),
      html,
      title,
    );
  }
  protected displayDate = displayDate;
}
