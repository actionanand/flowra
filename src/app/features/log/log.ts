import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DailyLog, FlowLevel, Severity } from '../../core/models/app.models';
import { AppStore } from '../../core/services/app-store.service';
import { TranslatePipe } from '@ngx-translate/core';
import { displayDate, todayCalendarDate } from '../../core/utils/calendar-date';
import {
  SelectPicker,
  SelectPickerOption,
} from '../../shared/components/select-picker/select-picker';

@Component({
  selector: 'app-log',
  imports: [ReactiveFormsModule, SelectPicker, TranslatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './log.html',
  styleUrl: './log.scss',
})
export class LogPage {
  protected readonly store = inject(AppStore);
  protected readonly date = new FormControl(todayCalendarDate(), { nonNullable: true });
  protected readonly notes = new FormControl('', { nonNullable: true });
  protected readonly customSymptom = new FormControl('', { nonNullable: true });
  protected readonly flow = signal<FlowLevel | ''>('');
  protected readonly severity = signal<Severity>('MILD');
  protected readonly symptoms = signal<readonly string[]>([]);
  protected readonly moods = signal<readonly string[]>([]);
  protected readonly products = signal<readonly string[]>([]);
  protected readonly overallMood = signal<1 | 2 | 3 | 4 | 5 | undefined>(undefined);
  protected readonly saved = signal(false);
  protected readonly flowOptions: readonly SelectPickerOption[] = [
    { value: '', label: 'No flow' },
    { value: 'SPOTTING', label: 'Spotting' },
    { value: 'LIGHT', label: 'Light' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HEAVY', label: 'Heavy' },
    { value: 'VERY_HEAVY', label: 'Very heavy' },
  ];
  protected readonly symptomGroups = [
    {
      name: 'Pain',
      items: [
        'Cramps',
        'Lower abdominal pain',
        'Back pain',
        'Pelvic discomfort',
        'Headache',
        'Migraine',
      ],
    },
    {
      name: 'Physical',
      items: [
        'Bloating',
        'Breast tenderness',
        'Acne',
        'Fatigue',
        'Dizziness',
        'Nausea',
        'Constipation',
        'Diarrhoea',
        'Cravings',
        'Appetite change',
      ],
    },
    {
      name: 'Sleep & reproductive',
      items: [
        'Good sleep',
        'Poor sleep',
        'Insomnia',
        'Excessive sleepiness',
        'Spotting',
        'Discharge',
        'Dryness',
        'Hot flashes',
        'Night sweats',
      ],
    },
  ];
  protected readonly moodOptions = [
    'Happy',
    'Calm',
    'Energetic',
    'Focused',
    'Sensitive',
    'Irritable',
    'Angry',
    'Anxious',
    'Sad',
    'Low',
    'Stressed',
    'Emotional',
    'Tired',
  ];
  protected readonly productOptions = [
    'Pad',
    'Tampon',
    'Menstrual cup',
    'Period underwear',
    'Other',
  ];
  protected readonly dateLabel = computed(() => displayDate(this.date.value, 'EEEE, d MMMM'));

  protected setFlow(value: string): void {
    this.flow.set(value as FlowLevel | '');
  }
  protected toggle(collection: 'symptoms' | 'moods' | 'products', value: string): void {
    const state =
      collection === 'symptoms'
        ? this.symptoms
        : collection === 'moods'
          ? this.moods
          : this.products;
    state.update((values) =>
      values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
    );
  }
  protected addCustomSymptom(): void {
    const value = this.customSymptom.value.trim();
    if (value && !this.symptoms().includes(value))
      this.symptoms.update((items) => [...items, value]);
    this.customSymptom.setValue('');
  }
  protected async save(): Promise<void> {
    const profile = this.store.activeProfile();
    if (!profile) return;
    const existing = this.store
      .dailyLogs()
      .find((log) => log.profileId === profile.id && log.date === this.date.value);
    const log: DailyLog = {
      id: existing?.id ?? crypto.randomUUID(),
      profileId: profile.id,
      date: this.date.value,
      flow: this.flow() || undefined,
      products: this.products(),
      symptoms: this.symptoms().map((name) => ({ name, severity: this.severity() })),
      moods: this.moods(),
      overallMood: this.overallMood(),
      notes: this.notes.value.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    await this.store.saveDailyLog(log);
    this.saved.set(true);
    globalThis.setTimeout(() => this.saved.set(false), 2200);
  }
  protected displayDate = displayDate;
}
