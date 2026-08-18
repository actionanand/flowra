import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, inject, signal } from '@angular/core';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { AppStore } from '../../core/services/app-store.service';
import { RouterLink } from '@angular/router';
import { DailyLog } from '../../core/models/app.models';
import {
  calendarDaysBetween,
  displayDate,
  todayCalendarDate,
} from '../../core/utils/calendar-date';

interface CalendarDay {
  readonly date: string;
  readonly day: string;
  readonly inMonth: boolean;
  readonly today: boolean;
  readonly recorded: boolean;
  readonly predicted: boolean;
  readonly spotting: boolean;
  readonly hasMood: boolean;
  readonly hasSymptoms: boolean;
  readonly cycleDay?: number;
}

@Component({
  selector: 'app-calendar',
  imports: [RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class CalendarPage {
  protected readonly store = inject(AppStore);
  protected readonly viewMonth = signal(startOfMonth(new Date()));
  protected readonly selectedDate = signal(todayCalendarDate());
  protected readonly monthLabel = computed(() => format(this.viewMonth(), 'MMMM yyyy'));
  protected readonly days = computed<readonly CalendarDay[]>(() => {
    const month = this.viewMonth();
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const prediction = this.store.prediction();
    return eachDayOfInterval({ start, end }).map((date) => {
      const value = format(date, 'yyyy-MM-dd');
      const period = this.store
        .profilePeriods()
        .find(
          (item) =>
            value >= item.startDate &&
            value <= (item.endDate ?? (item.startDate === value ? value : '')),
        );
      const lastStart = [...this.store.profilePeriods()]
        .reverse()
        .find((item) => item.startDate <= value);
      const log = this.store
        .dailyLogs()
        .find((item) => item.profileId === this.store.activeProfileId() && item.date === value);
      return {
        date: value,
        day: format(date, 'd'),
        inMonth: date.getMonth() === month.getMonth(),
        today: value === todayCalendarDate(),
        recorded: Boolean(period),
        predicted: Boolean(
          prediction && value >= prediction.windowStart && value <= prediction.windowEnd,
        ),
        spotting: log?.flow === 'SPOTTING',
        hasMood: Boolean(log?.moods.length),
        hasSymptoms: Boolean(log?.symptoms.length),
        cycleDay: lastStart ? calendarDaysBetween(lastStart.startDate, value) + 1 : undefined,
      };
    });
  });
  protected readonly selectedLog = computed(() =>
    this.store
      .dailyLogs()
      .find(
        (log) => log.profileId === this.store.activeProfileId() && log.date === this.selectedDate(),
      ),
  );
  protected readonly selectedDay = computed(() =>
    this.days().find((day) => day.date === this.selectedDate()),
  );
  protected previous(): void {
    this.viewMonth.update((date) => subMonths(date, 1));
  }
  protected next(): void {
    this.viewMonth.update((date) => addMonths(date, 1));
  }
  protected today(): void {
    this.viewMonth.set(startOfMonth(new Date()));
    this.selectedDate.set(todayCalendarDate());
  }
  protected displayDate = displayDate;
  protected symptomNames(log: DailyLog): string {
    return log.symptoms.map((symptom) => symptom.name).join(', ') || 'None';
  }
}
