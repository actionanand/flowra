# Adding Translations to the Flowra Angular App

This guide explains how Flowra translations are organized and how to add another language without changing the app's stored health data.

## Architecture

Flowra uses `@ngx-translate/core` with dictionaries bundled into the application. Translation data is local, so the app does not need a network request and works offline.

Each language has its own file:

- `src/app/core/i18n/en.ts`
- `src/app/core/i18n/hi.ts`
- `src/app/core/i18n/ta.ts`
- `src/app/core/i18n/kn.ts`
- `src/app/core/i18n/te.ts`
- `src/app/core/i18n/mr.ts`
- `src/app/core/i18n/ml.ts`
- `src/app/core/i18n/gu.ts`
- `src/app/core/i18n/bn.ts`
- `src/app/core/i18n/ur.ts`
- `src/app/core/i18n/or.ts`
- `src/app/core/i18n/pa.ts`
- `src/app/core/i18n/si.ts`
- `src/app/core/i18n/zh-hans.ts`
- `src/app/core/i18n/zh-hant.ts`
- `src/app/core/i18n/fr.ts`
- `src/app/core/i18n/es.ts`
- `src/app/core/i18n/ar.ts`
- `src/app/core/i18n/cs.ts`
- `src/app/core/i18n/pt.ts`
- `src/app/core/i18n/de.ts`
- `src/app/core/i18n/ru.ts`
- `src/app/core/i18n/id.ts`
- `src/app/core/i18n/ja.ts`
- `src/app/core/i18n/ko.ts`
- `src/app/core/i18n/sa.ts`

The registry at `src/app/core/i18n/translations.ts` imports the dictionaries and exposes them to `I18nService`.

The language service is responsible for:

- registering dictionaries with ngx-translate
- selecting the active language
- applying the language stored in the IndexedDB/SQLite-backed `AppSettings` record
- keeping the first-run language confirmation alongside the rest of the app settings
- updating the document language and switching to right-to-left layout for Urdu and Arabic

## Add a New Language

Assume the new language uses the code `xx`.

1. Create `src/app/core/i18n/xx.ts`.
2. Copy the structure from `en.ts`.
3. Translate every key while keeping the key names unchanged.
4. Export the dictionary as `XX_TRANSLATIONS`.
5. Import and register it in `translations.ts`.
6. Add `xx` to the `AppLanguage` union in `app.models.ts`.
7. Add its code and native name to `LANGUAGE_OPTIONS` in `i18n.service.ts`.
8. The shared options automatically update both language pickers and dictionary registration.
9. Add the language name to each dictionary's `app` section if it should be displayed in the user's current language.

Example registry change:

```ts
import { XX_TRANSLATIONS } from './xx';

export const TRANSLATIONS = {
  en: EN_TRANSLATIONS,
  hi: HI_TRANSLATIONS,
  ta: TA_TRANSLATIONS,
  xx: XX_TRANSLATIONS,
} as const;
```

Example model change:

```ts
export type AppLanguage =
  'en' | 'hi' | 'ta' | 'kn' | 'te' | 'mr' | 'ml' | 'gu' | 'bn' | 'ur' | 'or' | 'xx';
```

Add the matching native-language picker label:

```ts
{ code: 'xx', nativeName: 'Language name' }
```

## Use a Translation in a Template

Import `TranslatePipe` in the standalone component:

```ts
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  imports: [TranslatePipe],
})
```

Use the key in the template:

```html
<h1>{{ 'settings.title' | translate }}</h1>
```

For interpolation, pass parameters using ngx-translate syntax:

```ts
// Dictionary
hello: 'Hello, {{name}}';
```

```html
<p>{{ 'home.hello' | translate: { name: profile.name } }}</p>
```

Do not use single-brace placeholders such as `{name}`. They render literally.

## Translate Select Options

Stored values must remain stable because they are used by the database. Translate only the display label.

Flowra uses an `i18n.` marker for option labels:

```ts
{ value: 'LIGHT', label: 'i18n.settings.light' }
```

The shared select picker removes the marker and resolves the remainder through ngx-translate. Keep the `value` unchanged across languages.

## Date Formatting

Calendar arithmetic uses `date-fns`, while visible dates use the browser's `Intl.DateTimeFormat`. Add the language's BCP 47 locale tag to `LANGUAGE_TAGS` in `calendar-date.ts`; this localizes month and weekday names without adding another package.

## Translation Rules

- Keep all language dictionaries structurally aligned.
- Do not remove keys from one language to hide missing translations.
- Use English as the fallback language for missing keys.
- Preserve interpolation names such as `{{name}}`, `{{count}}`, `{{date}}`, and `{{start}}`.
- Keep stored enum values in English identifiers such as `VERY_HEAVY` and translate their display labels.
- Translate accessible labels, placeholders, picker titles, empty states, and error messages as well as visible headings.
- Prefer polite, natural instructions for the target language rather than literal word-for-word translation.
- Avoid translating product names, technical names, or health terms when a local user would recognize the established term more easily.

## Flowra Translation Decisions

The following product-specific decisions are recorded so later language edits remain consistent:

- Tamil uses the compact `சுழற்சி நாள்` for “cycle day”; avoid the longer `சுழற்சியின் நாள்` in compact badges and pills.
- Tamil action labels prefer polite imperative forms such as `மூடுக`, `ரத்துசெய்க`, `தேர்ந்தெடுக்குக`, and `மீட்டெடுக்குக`.
- CSV and PDF export buttons include a localized caption in Tamil (`CSV கோப்பு`, `PDF கோப்பு`) while retaining the standard file-format abbreviations.
- Severity values are translated through dictionary keys (`mild`, `moderate`, `severe`) rather than rendering the stored enum names directly.
- Health-data enum values and profile values remain stable in storage; only their display labels are translated.
- When a translated label wraps on mobile, icons remain separate flex items so the icon does not move into the text line.
- Sanskrit preserves visarga (`ः`) on grammatically applicable forms such as masculine nominative singular nouns (`लयः`, `ऋतुस्रावः`, `इतिहासः`) and the indeclinable `सद्यः`. Do not append visarga to neuter forms ending in `म्` (`चक्रम्`, `मित्रम्`), feminine forms (`वेदना`, `रूपरेखा`), or imperative verbs.
- `npm run i18n:check` includes a Sanskrit-specific visarga regression check in addition to key and interpolation parity.

## Verification Checklist

1. Start the app and choose the new language in the first-run language screen.
2. Visit Home, Calendar, Log, Insights, Profiles, and Settings.
3. Open every select picker and verify both the selected value and the option list.
4. Check onboarding, lock screen, backup dialogs, error states, and empty states.
5. Verify interpolated values show actual names and counts instead of `{name}` or a translation key.
6. Check month names and weekdays in Calendar.
7. Run the project diagnostics or the normal Angular test command from WSL2.
8. Check narrow mobile layouts for text wrapping and button overflow.

## Adding More Languages Later

For approximately twenty languages, keep one file per language and use the same registry pattern. If the dictionaries become large, you can move to lazy-loaded language files, but keep the same translation key structure and fallback behavior. Since Flowra is privacy-first and offline-capable, any lazy-loaded dictionaries should be bundled as local application assets rather than fetched from a remote translation service.
