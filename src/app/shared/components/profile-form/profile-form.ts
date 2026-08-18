import { Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/services/app-store.service';
import { AgePrecision, Relationship } from '../../../core/models/app.models';
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
    { value: 'YES', label: 'Yes' },
    { value: 'NO', label: 'No' },
    { value: 'UNKNOWN', label: 'Not sure' },
    { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
  ];
  readonly agePrecisionOptions: readonly SelectPickerOption[] = [
    { value: 'EXACT_DOB', label: 'Exact date of birth' },
    { value: 'BIRTH_YEAR', label: 'Birth year only' },
    { value: 'APPROXIMATE_AGE', label: 'Approximate current age' },
    { value: 'AGE_RANGE', label: 'Age range' },
  ];
  readonly ageRangeOptions: readonly SelectPickerOption[] = [
    'Under 10',
    '10–12',
    '13–15',
    '16–19',
    '20–29',
    '30–39',
    '40–44',
    '45–49',
    '50–55',
    '56+',
  ].map((label) => ({ value: label, label }));
  readonly menarcheOptions: readonly SelectPickerOption[] = [
    { value: 'EXACT', label: 'Exact first-period date' },
    { value: 'YEAR', label: 'First-period year' },
    { value: 'APPROXIMATE_AGE', label: 'Approximate age at first period' },
    { value: 'UNKNOWN', label: 'Unknown' },
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
    const value = this.form.getRawValue();
    await this.store.createProfile({
      name: value.name,
      relationship: value.relationship,
      agePrecision: value.agePrecision,
      dateOfBirth: value.agePrecision === 'EXACT_DOB' ? value.dateOfBirth || undefined : undefined,
      birthYear: value.agePrecision === 'BIRTH_YEAR' ? (value.birthYear ?? undefined) : undefined,
      approximateAge:
        value.agePrecision === 'APPROXIMATE_AGE' ? (value.approximateAge ?? undefined) : undefined,
      ageRange: value.agePrecision === 'AGE_RANGE' ? value.ageRange : undefined,
      menstruationStarted: value.menstruationStarted,
      menarcheDate:
        value.menarchePrecision === 'EXACT' ? value.menarcheDate || undefined : undefined,
      menarcheYear:
        value.menarchePrecision === 'YEAR' ? (value.menarcheYear ?? undefined) : undefined,
      approximateMenarcheAge:
        value.menarchePrecision === 'APPROXIMATE_AGE'
          ? (value.approximateMenarcheAge ?? undefined)
          : undefined,
    });
    this.busy.set(false);
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
    this.saved.emit();
  }
}
