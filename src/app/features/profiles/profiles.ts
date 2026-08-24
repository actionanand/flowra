import { CUSTOM_ELEMENTS_SCHEMA, Component, inject, signal } from '@angular/core';
import { Profile, ReproductiveStage } from '../../core/models/app.models';
import { AppStore } from '../../core/services/app-store.service';
import { TranslatePipe } from '@ngx-translate/core';
import { ProfileForm } from '../../shared/components/profile-form/profile-form';
import {
  SelectPicker,
  SelectPickerOption,
} from '../../shared/components/select-picker/select-picker';

@Component({
  selector: 'app-profiles',
  imports: [ProfileForm, SelectPicker, TranslatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './profiles.html',
  styleUrls: ['./profiles.scss', './profiles.fields.scss'],
})
export class ProfilesPage {
  protected readonly store = inject(AppStore);
  protected readonly adding = signal(false);
  protected readonly editing = signal<Profile | undefined>(undefined);
  protected readonly stages: readonly SelectPickerOption[] = [
    'PRE_MENARCHE',
    'EARLY_POST_MENARCHE',
    'ADOLESCENT',
    'ADULT_REPRODUCTIVE',
    'PREGNANT',
    'POSTPARTUM',
    'BREASTFEEDING_POSTPARTUM',
    'PERIMENOPAUSE',
    'MENOPAUSE',
    'POST_MENOPAUSE',
    'SURGICAL_MENOPAUSE',
    'CUSTOM',
    'UNKNOWN',
  ].map((value) => ({
    value,
    label: `i18n.profilesStages.${value.toLowerCase()}`,
  }));
  protected async updateStage(profile: Profile, value: string): Promise<void> {
    const stage = value as ReproductiveStage;
    const predictionEpoch =
      stage === 'POSTPARTUM' || stage === 'BREASTFEEDING_POSTPARTUM'
        ? 'POSTPARTUM_1'
        : stage === 'PREGNANT'
          ? 'PRE_PREGNANCY'
          : profile.predictionEpoch;
    await this.store.updateProfile({ ...profile, reproductiveStage: stage, predictionEpoch });
  }
  protected async toggle(
    profile: Profile,
    key: 'hiddenFromPreviews' | 'requiresAuthentication',
  ): Promise<void> {
    await this.store.updateProfile({ ...profile, [key]: !profile[key] });
  }

  protected closeModal(): void {
    this.adding.set(false);
    this.editing.set(undefined);
  }
}
