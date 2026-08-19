import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const cache = new Map();

function loadTypeScriptModule(filename) {
  const resolvedFilename = resolve(filename);
  const cached = cache.get(resolvedFilename);
  if (cached) return cached.exports;

  const module = { exports: {} };
  cache.set(resolvedFilename, module);
  const source = readFileSync(resolvedFilename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: resolvedFilename,
  }).outputText;
  const localRequire = (specifier) => {
    if (!specifier.startsWith('.')) throw new Error(`Unexpected import: ${specifier}`);
    return loadTypeScriptModule(resolve(dirname(resolvedFilename), `${specifier}.ts`));
  };
  Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    output,
  )(module.exports, localRequire, module, resolvedFilename, dirname(resolvedFilename));
  return module.exports;
}

function flatten(value, prefix = '', result = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') result.set(path, child);
    else flatten(child, path, result);
  }
  return result;
}

function placeholders(value) {
  return [...value.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((match) => match[1]).sort();
}

const { TRANSLATIONS } = loadTypeScriptModule('src/app/core/i18n/translations.ts');
const reference = flatten(TRANSLATIONS.en);
let failed = false;

const SANSKRIT_VISARGA_KEYS = [
  'app.yourRhythm',
  'app.deviceData',
  'app.pinMismatch',
  'nav.log',
  'settings.reminderTiming',
  'settings.newPin',
  'settings.currentPin',
  'settings.biometricSetupFailed',
  'settings.notificationDenied',
  'settings.incorrectBackupPassword',
  'profile.relationship',
  'profile.exactDob',
  'profile.periodsStarted',
  'profile.firstPeriodDate',
  'profile.child',
  'profile.partner',
  'profile.relative',
  'profile.exactFirstPeriodDate',
  'profile.privacyNote',
  'log.entryDate',
  'log.flow',
  'log.flowToday',
  'log.mood',
  'log.noFlow',
  'log.spotting',
  'log.light',
  'log.medium',
  'log.heavy',
  'log.veryHeavy',
  'log.cup',
  'logLabels.symptom.migraine',
  'logLabels.symptom.fatigue',
  'logLabels.symptom.dizziness',
  'logLabels.symptom.nausea',
  'logLabels.symptom.constipation',
  'logLabels.symptom.diarrhoea',
  'logLabels.symptom.cravings',
  'logLabels.symptom.spotting',
  'logLabels.symptom.discharge',
  'logLabels.symptom.nightsweats',
  'profilesStages.menopause',
  'profilesStages.surgical_menopause',
  'home.currentPeriod',
  'home.periodProgress',
  'home.expected',
  'home.startPeriod',
  'home.endPeriod',
  'home.periodEarlier',
  'home.moodFlow',
  'home.nextPeriod',
  'home.latestCheckin',
  'home.noMood',
  'home.notEnoughHistory',
  'home.noRecordedPeriod',
  'periodConfirmation.startWarning',
  'periodConfirmation.endWarning',
  'calendar.previous',
  'calendar.next',
  'calendar.spotting',
  'calendar.mood',
  'calendar.flow',
  'insights.typicalPeriod',
  'insights.readable',
  'insights.recentRhythm',
];

for (const [language, dictionary] of Object.entries(TRANSLATIONS)) {
  const entries = flatten(dictionary);
  const missing = [...reference.keys()].filter((key) => !entries.has(key));
  const extra = [...entries.keys()].filter((key) => !reference.has(key));
  const invalidPlaceholders = [...reference.entries()]
    .filter(([key, value]) =>
      entries.has(key)
        ? placeholders(value).join('|') !== placeholders(entries.get(key)).join('|')
        : false,
    )
    .map(([key]) => key);
  const sameAsEnglish = [...reference.entries()].filter(
    ([key, value]) => language !== 'en' && entries.get(key) === value,
  ).length;
  console.log(
    `${language}: ${entries.size} keys, ${missing.length} missing, ${extra.length} extra, ${invalidPlaceholders.length} placeholder errors, ${sameAsEnglish} English fallbacks`,
  );
  if (missing.length || extra.length || invalidPlaceholders.length) {
    failed = true;
    if (missing.length) console.error(`  Missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  Extra: ${extra.join(', ')}`);
    if (invalidPlaceholders.length)
      console.error(`  Placeholder errors: ${invalidPlaceholders.join(', ')}`);
  }
}

const sanskrit = flatten(TRANSLATIONS.sa);
const missingSanskritVisarga = SANSKRIT_VISARGA_KEYS.filter(
  (key) => !sanskrit.get(key)?.includes('ः'),
);
console.log(
  `sa visarga: ${SANSKRIT_VISARGA_KEYS.length} required forms checked, ${missingSanskritVisarga.length} errors`,
);
if (missingSanskritVisarga.length) {
  failed = true;
  console.error(`  Missing visarga: ${missingSanskritVisarga.join(', ')}`);
}

if (failed) process.exitCode = 1;
