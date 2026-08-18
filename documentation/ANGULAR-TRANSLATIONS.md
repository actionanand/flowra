# Adding Translations to the Flowra Angular App

This guide explains how Flowra translations are organized and how to add another language without changing the app's stored health data.

## Architecture

Flowra uses `@ngx-translate/core` with dictionaries bundled into the application. Translation data is local, so the app does not need a network request and works offline.

Each language has its own file:

- `src/app/core/i18n/en.ts`
- `src/app/core/i18n/hi.ts`
- `src/app/core/i18n/ta.ts`

The registry at `src/app/core/i18n/translations.ts` imports the dictionaries and exposes them to `I18nService`.

The language service is responsible for:

- registering dictionaries with ngx-translate
- selecting the active language
- persisting the selection in `localStorage` under `flowra-language`
- restoring the previous language on startup

## Add a New Language

Assume the new language is Telugu with the code `te`.

1. Create `src/app/core/i18n/te.ts`.
2. Copy the structure from `en.ts`.
3. Translate every key while keeping the key names unchanged.
4. Export the dictionary as `TE_TRANSLATIONS`.
5. Import and register it in `translations.ts`.
6. Add `te` to the `AppLanguage` union in `i18n.service.ts`.
7. Register the dictionary in the `I18nService` constructor.
8. Add the language to the language picker in `app.ts` and `settings.ts`.
9. Add the language name to each dictionary's `app` section if it should be displayed in the user's current language.

Example registry change:

```ts
import { TE_TRANSLATIONS } from './te';

export const TRANSLATIONS = {
  en: EN_TRANSLATIONS,
  hi: HI_TRANSLATIONS,
  ta: TA_TRANSLATIONS,
  te: TE_TRANSLATIONS,
} as const;
```

Example service changes:

```ts
export type AppLanguage = 'en' | 'hi' | 'ta' | 'te';

translate.setTranslation('te', TRANSLATIONS.te);
```

Also update `readLanguage()` so the new value is accepted when it is already stored:

```ts
return value === 'hi' || value === 'ta' || value === 'te' ? value : 'en';
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

Calendar labels are formatted with `date-fns`. When adding a language, check whether `date-fns/locale` provides a matching locale. Add it to the date formatting helper and calendar component so month names, weekdays, and formatted dates use the selected language.

If a date-fns locale does not exist, keep the numeric date format and add translated surrounding labels rather than manually translating date strings.

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
