import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/services/app-store.service';
import { AgePrecision, Profile, Relationship } from '../../../core/models/app.models';
import { SelectPicker, SelectPickerOption } from '../select-picker/select-picker';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-profile-form',
  imports: [ReactiveFormsModule, SelectPicker, TranslatePipe],
  templateUrl: './profile-form.html',
  styleUrl: './profile-form.scss',
})
export class ProfileForm {
  private readonly store = inject(AppStore);
  readonly profile = input<Profile | undefined>();
  readonly saved = output<void>();
  readonly busy = signal(false);
  readonly relationshipOptions: readonly SelectPickerOption[] = [
    { value: 'SELF', label: 'i18n.profile.self', icon: 'person-outline' },
    { value: 'CHILD', label: 'i18n.profile.child', icon: 'happy-outline' },
    { value: 'PARTNER', label: 'i18n.profile.partner', icon: 'heart-outline' },
    { value: 'RELATIVE', label: 'i18n.profile.relative', icon: 'people-outline' },
    { value: 'FRIEND', label: 'i18n.profile.friend', icon: 'sparkles-outline' },
    { value: 'OTHER', label: 'i18n.profile.other', icon: 'ellipsis-horizontal-outline' },
  ];
  readonly statusOptions: readonly SelectPickerOption[] = [
    { value: 'YES', label: 'i18n.profile.yes' },
    { value: 'NO', label: 'i18n.profile.no' },
    { value: 'UNKNOWN', label: 'i18n.profile.notSure' },
    { value: 'PREFER_NOT_TO_SAY', label: 'i18n.profile.preferNot' },
  ];
  readonly agePrecisionOptions: readonly SelectPickerOption[] = [
    { value: 'EXACT_DOB', label: 'i18n.profile.exactDob' },
    { value: 'BIRTH_YEAR', label: 'i18n.profile.birthYearOnly' },
    { value: 'APPROXIMATE_AGE', label: 'i18n.profile.approximateAge' },
    { value: 'AGE_RANGE', label: 'i18n.profile.ageRange' },
  ];
  readonly ageRangeOptions: readonly SelectPickerOption[] = [
    ['Under 10', 'i18n.profile.under10'],
    ['10–12', 'i18n.profile.age10to12'],
    ['13–15', 'i18n.profile.age13to15'],
    ['16–19', 'i18n.profile.age16to19'],
    ['20–29', 'i18n.profile.age20to29'],
    ['30–39', 'i18n.profile.age30to39'],
    ['40–44', 'i18n.profile.age40to44'],
    ['45–49', 'i18n.profile.age45to49'],
    ['50–55', 'i18n.profile.age50to55'],
    ['56+', 'i18n.profile.age56Plus'],
  ].map(([value, label]) => ({ value, label }));
  readonly menarcheOptions: readonly SelectPickerOption[] = [
    { value: 'EXACT', label: 'i18n.profile.exactFirstPeriodDate' },
    { value: 'YEAR', label: 'i18n.profile.firstPeriodYear' },
    { value: 'APPROXIMATE_AGE', label: 'i18n.profile.approximateFirstPeriodAge' },
    { value: 'UNKNOWN', label: 'i18n.profile.unknown' },
  ];
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(40)],
    }),
    relationship: new FormControl<Relationship>('SELF', { nonNullable: true }),
    agePrecision: new FormControl<AgePrecision>('APPROXIMATE_AGE', { nonNullable: true }),
    dateOfBirth: new FormControl('', { nonNullable: true }),
    birthYear: new FormControl<number | null>(null, [
      Validators.min(1900),
      Validators.max(new Date().getFullYear()),
    ]),
    approximateAge: new FormControl<number | null>(null, [Validators.min(1), Validators.max(120)]),
    ageRange: new FormControl('20–29', { nonNullable: true }),
    menstruationStarted: new FormControl<'YES' | 'NO' | 'UNKNOWN' | 'PREFER_NOT_TO_SAY'>('YES', {
      nonNullable: true,
    }),
    menarchePrecision: new FormControl<'EXACT' | 'YEAR' | 'APPROXIMATE_AGE' | 'UNKNOWN'>(
      'UNKNOWN',
      { nonNullable: true },
    ),
    menarcheDate: new FormControl('', { nonNullable: true }),
    menarcheYear: new FormControl<number | null>(null, [
      Validators.min(1900),
      Validators.max(new Date().getFullYear()),
    ]),
    approximateMenarcheAge: new FormControl<number | null>(null, [
      Validators.min(5),
      Validators.max(30),
    ]),
  });

  constructor() {
    effect(() => this.applyProfile(this.profile()));
  }

  canSave(): boolean {
    return this.form.valid && !this.busy();
  }

  setRelationship(value: string): void {
    this.form.controls.relationship.setValue(value as Relationship);
  }
  setStatus(value: string): void {
    this.form.controls.menstruationStarted.setValue(
      value as 'YES' | 'NO' | 'UNKNOWN' | 'PREFER_NOT_TO_SAY',
    );
  }
  setAgePrecision(value: string): void {
    this.form.controls.agePrecision.setValue(value as AgePrecision);
  }
  setAgeRange(value: string): void {
    this.form.controls.ageRange.setValue(value);
  }
  setMenarchePrecision(value: string): void {
    this.form.controls.menarchePrecision.setValue(
      value as 'EXACT' | 'YEAR' | 'APPROXIMATE_AGE' | 'UNKNOWN',
    );
  }
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    const existing = this.profile();
    const value = this.profilePayload();
    if (existing) await this.store.updateProfile({ ...existing, ...value });
    else await this.store.createProfile(value);
    this.busy.set(false);
    if (!existing) this.resetForm();
    this.saved.emit();
  }

  private profilePayload(): {
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
  } {
    const value = this.form.getRawValue();
    const periodsStarted = value.menstruationStarted === 'YES';
    return {
      name: value.name.trim(),
      relationship: value.relationship,
      agePrecision: value.agePrecision,
      dateOfBirth: value.agePrecision === 'EXACT_DOB' ? value.dateOfBirth || undefined : undefined,
      birthYear: value.agePrecision === 'BIRTH_YEAR' ? (value.birthYear ?? undefined) : undefined,
      approximateAge:
        value.agePrecision === 'APPROXIMATE_AGE' ? (value.approximateAge ?? undefined) : undefined,
      ageRange: value.agePrecision === 'AGE_RANGE' ? value.ageRange : undefined,
      menstruationStarted: value.menstruationStarted,
      menarcheDate:
        periodsStarted && value.menarchePrecision === 'EXACT'
          ? value.menarcheDate || undefined
          : undefined,
      menarcheYear:
        periodsStarted && value.menarchePrecision === 'YEAR'
          ? (value.menarcheYear ?? undefined)
          : undefined,
      approximateMenarcheAge:
        periodsStarted && value.menarchePrecision === 'APPROXIMATE_AGE'
          ? (value.approximateMenarcheAge ?? undefined)
          : undefined,
    };
  }

  private applyProfile(profile: Profile | undefined): void {
    if (!profile) {
      this.resetForm();
      return;
    }
    this.form.reset({
      name: profile.name,
      relationship: profile.relationship,
      agePrecision: profile.agePrecision,
      dateOfBirth: profile.dateOfBirth ?? '',
      birthYear: profile.birthYear ?? null,
      approximateAge: profile.approximateAge ?? null,
      ageRange: profile.ageRange ?? '20–29',
      menstruationStarted: profile.menstruationStarted,
      menarchePrecision: profile.menarcheDate
        ? 'EXACT'
        : profile.menarcheYear
          ? 'YEAR'
          : profile.approximateMenarcheAge
            ? 'APPROXIMATE_AGE'
            : 'UNKNOWN',
      menarcheDate: profile.menarcheDate ?? '',
      menarcheYear: profile.menarcheYear ?? null,
      approximateMenarcheAge: profile.approximateMenarcheAge ?? null,
    });
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      relationship: 'SELF',
      agePrecision: 'APPROXIMATE_AGE',
      dateOfBirth: '',
      birthYear: null,
      approximateAge: null,
      ageRange: '20–29',
      menstruationStarted: 'YES',
      menarchePrecision: 'UNKNOWN',
      menarcheDate: '',
      menarcheYear: null,
      approximateMenarcheAge: null,
    });
  }
}
