import { EN_TRANSLATIONS } from './en';
import { HI_TRANSLATIONS } from './hi';
import { TA_TRANSLATIONS } from './ta';
import { KN_TRANSLATIONS } from './kn';
import { TE_TRANSLATIONS } from './te';
import { MR_TRANSLATIONS } from './mr';
import { ML_TRANSLATIONS } from './ml';
import { GU_TRANSLATIONS } from './gu';
import { BN_TRANSLATIONS } from './bn';
import { UR_TRANSLATIONS } from './ur';
import { OR_TRANSLATIONS } from './or';
import { PA_TRANSLATIONS } from './pa';
import { SI_TRANSLATIONS } from './si';
import { ZH_HANS_TRANSLATIONS } from './zh-hans';
import { ZH_HANT_TRANSLATIONS } from './zh-hant';
import { FR_TRANSLATIONS } from './fr';
import { ES_TRANSLATIONS } from './es';
import { AR_TRANSLATIONS } from './ar';
import { CS_TRANSLATIONS } from './cs';
import { PT_TRANSLATIONS } from './pt';
import { DE_TRANSLATIONS } from './de';
import { RU_TRANSLATIONS } from './ru';
import { ID_TRANSLATIONS } from './id';
import { JA_TRANSLATIONS } from './ja';
import { KO_TRANSLATIONS } from './ko';
import { SA_TRANSLATIONS } from './sa';
import { INTERACTION_TRANSLATIONS } from './interaction-translations';
import { PERIOD_CONFIRMATION_TRANSLATIONS } from './period-confirmation-translations';

export const TRANSLATIONS = {
  en: {
    ...EN_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.en,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.en,
  },
  hi: {
    ...HI_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.hi,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.hi,
  },
  ta: {
    ...TA_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.ta,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.ta,
  },
  kn: {
    ...KN_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.kn,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.kn,
  },
  te: {
    ...TE_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.te,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.te,
  },
  mr: {
    ...MR_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.mr,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.mr,
  },
  ml: {
    ...ML_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.ml,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.ml,
  },
  gu: {
    ...GU_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.gu,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.gu,
  },
  bn: {
    ...BN_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.bn,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.bn,
  },
  ur: {
    ...UR_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.ur,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.ur,
  },
  or: {
    ...OR_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.or,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.or,
  },
  pa: {
    ...PA_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.pa,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.pa,
  },
  si: {
    ...SI_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.si,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.si,
  },
  'zh-Hans': {
    ...ZH_HANS_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS['zh-Hans'],
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS['zh-Hans'],
  },
  'zh-Hant': {
    ...ZH_HANT_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS['zh-Hant'],
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS['zh-Hant'],
  },
  fr: {
    ...FR_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.fr,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.fr,
  },
  es: {
    ...ES_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.es,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.es,
  },
  ar: {
    ...AR_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.ar,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.ar,
  },
  cs: {
    ...CS_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.cs,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.cs,
  },
  pt: {
    ...PT_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.pt,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.pt,
  },
  de: {
    ...DE_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.de,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.de,
  },
  ru: {
    ...RU_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.ru,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.ru,
  },
  id: {
    ...ID_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.id,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.id,
  },
  ja: {
    ...JA_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.ja,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.ja,
  },
  ko: {
    ...KO_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.ko,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.ko,
  },
  sa: {
    ...SA_TRANSLATIONS,
    interaction: INTERACTION_TRANSLATIONS.sa,
    periodConfirmation: PERIOD_CONFIRMATION_TRANSLATIONS.sa,
  },
} as const;
