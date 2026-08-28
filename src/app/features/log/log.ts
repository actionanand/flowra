import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DailyLog, FlowLevel, Severity } from '../../core/models/app.models';
import { AppStore } from '../../core/services/app-store.service';
import { TranslatePipe } from '@ngx-translate/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { displayDate, todayCalendarDate } from '../../core/utils/calendar-date';
import {
  SelectPicker,
  SelectPickerOption,
} from '../../shared/components/select-picker/select-picker';
import { SnackbarService } from '../../core/services/snackbar.service';
import { ConfirmationDialog } from '../../shared/components/confirmation-dialog/confirmation-dialog';

@Component({
  selector: 'app-log',
  imports: [ReactiveFormsModule, SelectPicker, ConfirmationDialog, TranslatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './log.html',
  styleUrl: './log.scss',
})
export class LogPage {
  protected readonly store = inject(AppStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackbar = inject(SnackbarService);
  protected readonly today = todayCalendarDate();
  protected readonly date = new FormControl(this.initialDate(), { nonNullable: true });
  private readonly selectedDate = toSignal(this.date.valueChanges, {
    initialValue: this.date.value,
  });
  protected readonly notes = new FormControl('', { nonNullable: true });
  protected readonly customSymptom = new FormControl('', { nonNullable: true });
  protected readonly flow = signal<FlowLevel | ''>('');
  protected readonly severity = signal<Severity>('MILD');
  protected readonly symptoms = signal<readonly string[]>([]);
  protected readonly moods = signal<readonly string[]>([]);
  protected readonly products = signal<readonly string[]>([]);
  protected readonly overallMood = signal<1 | 2 | 3 | 4 | 5 | undefined>(undefined);
  protected readonly saved = signal(false);
  protected readonly editing = signal(false);
  protected readonly editConfirmationOpen = signal(false);
  protected readonly dateUnavailable = computed(() => {
    const date = this.selectedDate();
    return !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > this.today;
  });
  protected readonly selectedLog = computed(() => {
    const profileId = this.store.activeProfileId();
    const date = this.selectedDate();
    return this.store.dailyLogs().find((log) => log.profileId === profileId && log.date === date);
  });
  protected readonly formLocked = computed(() => !!this.selectedLog() && !this.editing());
  private readonly editButton = viewChild<ElementRef<HTMLButtonElement>>('editButton');
  private readonly entryFields = viewChild<ElementRef<HTMLFieldSetElement>>('entryFields');
  protected readonly flowOptions: readonly SelectPickerOption[] = [
    { value: '', label: 'i18n.log.noFlow' },
    { value: 'SPOTTING', label: 'i18n.log.spotting' },
    { value: 'LIGHT', label: 'i18n.log.light' },
    { value: 'MEDIUM', label: 'i18n.log.medium' },
    { value: 'HEAVY', label: 'i18n.log.heavy' },
    { value: 'VERY_HEAVY', label: 'i18n.log.veryHeavy' },
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
  protected readonly dateLabel = computed(() =>
    displayDate(this.selectedDate() || this.today, 'EEEE, d MMMM', this.i18n.language()),
  );
  constructor() {
    let loadedVersion = '';
    effect(() => {
      const log = this.selectedLog();
      const version = `${this.store.activeProfileId()}:${this.selectedDate()}:${log?.updatedAt ?? ''}`;
      if (version === loadedVersion) return;
      loadedVersion = version;
      this.load(log);
    });
  }
  protected logLabel(kind: 'mood' | 'product' | 'symptom' | 'symptomGroup', value: string): string {
    const key = value.toLowerCase().replaceAll(' ', '').replaceAll('&', 'and');
    return `logLabels.${kind}.${key}`;
  }

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
    if (!profile || this.dateUnavailable()) return;
    const existing = this.selectedLog();
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
    this.editing.set(false);
    this.saved.set(true);
    this.snackbar.show(this.i18n.text('log.saved'));
    globalThis.setTimeout(() => this.saved.set(false), 2200);
  }
  protected cancel(): void {
    const storedLog = this.selectedLog();
    if (this.editing() && storedLog) {
      this.load(storedLog);
      this.editing.set(false);
      queueMicrotask(() => this.editButton()?.nativeElement.focus());
      return;
    }
    void this.router.navigate(['/home']);
  }
  protected requestEdit(): void {
    if (this.selectedLog()) this.editConfirmationOpen.set(true);
  }
  protected confirmEdit(): void {
    this.editConfirmationOpen.set(false);
    this.editing.set(true);
    queueMicrotask(() => this.entryFields()?.nativeElement.focus());
  }
  protected cancelEditConfirmation(): void {
    this.editConfirmationOpen.set(false);
    queueMicrotask(() => this.editButton()?.nativeElement.focus());
  }
  private load(log: DailyLog | undefined): void {
    this.flow.set(log?.flow ?? '');
    this.products.set(log?.products ?? []);
    this.symptoms.set(log?.symptoms.map((symptom) => symptom.name) ?? []);
    this.moods.set(log?.moods ?? []);
    this.overallMood.set(log?.overallMood);
    this.severity.set(log?.symptoms[0]?.severity ?? 'MILD');
    this.notes.setValue(log?.notes ?? '');
    this.customSymptom.setValue('');
    this.saved.set(false);
    this.editing.set(false);
  }
  protected displayDate = displayDate;

  private initialDate(): string {
    const requestedDate = this.route.snapshot.queryParamMap.get('date');
    return requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : this.today;
  }
}
