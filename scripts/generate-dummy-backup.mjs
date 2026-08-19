import { mkdir, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const PASSWORD = '12345678';
const OUTPUT = 'test-data/flowra-notification-demo.flowra';
const ITERATIONS = 310_000;

function calendarDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return calendarDate(date);
}

function periodsFor(profileId, targetDate, cycleLength, count = 10) {
  const latestStart = addDays(targetDate, -cycleLength);
  return Array.from({ length: count }, (_, index) => {
    const startDate = addDays(latestStart, -(count - index - 1) * cycleLength);
    return {
      id: `${profileId}-period-${index + 1}`,
      profileId,
      startDate,
      endDate: addDays(startDate, 4 + (index % 2)),
      confirmed: true,
      excludedFromPrediction: false,
      predictionEpoch: 'NORMAL',
      createdAt: `${startDate}T08:00:00.000Z`,
      updatedAt: `${startDate}T08:00:00.000Z`,
    };
  });
}

function logsFor(profileId, periods) {
  const flows = ['HEAVY', 'MEDIUM', 'MEDIUM', 'LIGHT', 'SPOTTING'];
  const symptoms = [
    ['Cramps', 'MODERATE'],
    ['Backache', 'MILD'],
    ['Fatigue', 'MODERATE'],
    ['Headache', 'MILD'],
    ['Bloating', 'MILD'],
  ];
  const moods = ['Calm', 'Sensitive', 'Tired', 'Hopeful', 'Energetic'];
  return periods.flatMap((period, periodIndex) =>
    flows.map((flow, dayIndex) => {
      const date = addDays(period.startDate, dayIndex);
      const [symptom, severity] = symptoms[(periodIndex + dayIndex) % symptoms.length];
      return {
        id: `${profileId}-log-${date}`,
        profileId,
        date,
        flow,
        products: dayIndex < 3 ? ['Pad'] : ['Liner'],
        productCount: dayIndex < 2 ? 4 : 2,
        symptoms: [{ name: symptom, severity }],
        moods: [moods[(periodIndex + dayIndex) % moods.length]],
        overallMood: ((periodIndex + dayIndex) % 5) + 1,
        notes: dayIndex === 0 ? 'Demo cycle entry for charts and trends.' : '',
        updatedAt: `${date}T18:30:00.000Z`,
      };
    }),
  );
}

function comparisonPredictions(profileId, periods, cycleLength) {
  return periods.slice(2, -1).map((period, index) => {
    const actual = periods[index + 3].startDate;
    const error = [-1, 0, 1, 0, 2, -1][index % 6];
    const predicted = addDays(actual, -error);
    return {
      id: `${profileId}-prediction-${index + 1}`,
      profileId,
      basedOnPeriodId: period.id,
      generatedAt: `${period.startDate}T09:00:00.000Z`,
      mostLikelyDate: predicted,
      windowStart: addDays(predicted, -3),
      windowEnd: addDays(predicted, 3),
      predictedCycleLength: cycleLength,
      confidence: index > 3 ? 'HIGH' : 'MODERATE',
      modelUsed: 'Demo weighted median',
      algorithmVersion: 'cycle-predictor-v1',
      usableCycleCount: index + 3,
      historicalMAE: 0.8,
      historicalMedianAE: 1,
      modelScores: [],
      actualStartDate: actual,
      predictionErrorDays: error,
    };
  });
}

function bytesToBase64(value) {
  return Buffer.from(value).toString('base64');
}

async function encrypt(value) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(PASSWORD),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    format: 'flowra-backup',
    salt: bytesToBase64(salt),
    iterations: ITERATIONS,
  };
}

async function decrypt(envelope) {
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(PASSWORD),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: envelope.iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    Buffer.from(envelope.ciphertext, 'base64'),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

const today = calendarDate(new Date());
const tomorrow = addDays(today, 1);
const dayAfterTomorrow = addDays(today, 2);
const profileDefinitions = [
  {
    id: 'demo-meera',
    name: 'Meera — tomorrow',
    relationship: 'SELF',
    cycleLength: 28,
    predictedDate: tomorrow,
    daysBefore: 0,
    privacyMode: false,
  },
  {
    id: 'demo-ananya',
    name: 'Ananya — day after tomorrow',
    relationship: 'CHILD',
    cycleLength: 30,
    predictedDate: addDays(dayAfterTomorrow, 1),
    daysBefore: 1,
    privacyMode: false,
  },
  {
    id: 'demo-lakshmi',
    name: 'Lakshmi — private tomorrow',
    relationship: 'RELATIVE',
    cycleLength: 31,
    predictedDate: addDays(tomorrow, 3),
    daysBefore: 3,
    privacyMode: true,
  },
];
const createdAt = new Date().toISOString();
const profiles = profileDefinitions.map((profile, index) => ({
  id: profile.id,
  name: profile.name,
  relationship: profile.relationship,
  birthYear: 1992 - index * 8,
  agePrecision: 'BIRTH_YEAR',
  menstruationStarted: 'YES',
  menarcheYear: 2005 - index * 2,
  reproductiveStage: index === 2 ? 'PERIMENOPAUSE' : 'ADULT_REPRODUCTIVE',
  predictionEpoch: 'NORMAL',
  hiddenFromPreviews: false,
  requiresAuthentication: false,
  createdAt,
  updatedAt: createdAt,
}));
const periodSets = profileDefinitions.map((profile) =>
  periodsFor(profile.id, profile.predictedDate, profile.cycleLength),
);
const periods = periodSets.flat();
const dailyLogs = periodSets.flatMap((profilePeriods, index) =>
  logsFor(profileDefinitions[index].id, profilePeriods),
);
const predictions = periodSets.flatMap((profilePeriods, index) =>
  comparisonPredictions(
    profileDefinitions[index].id,
    profilePeriods,
    profileDefinitions[index].cycleLength,
  ),
);
const snapshot = {
  profiles,
  periods,
  dailyLogs,
  healthEvents: profiles.flatMap((profile, index) => [
    {
      id: `${profile.id}-event-1`,
      profileId: profile.id,
      date: addDays(today, -(20 + index * 5)),
      type: 'MEDICATION',
      notes: 'Demo health event for restore testing.',
      createdAt,
    },
  ]),
  predictions,
  notificationSettings: profileDefinitions.map((profile) => ({
    id: profile.id,
    profileId: profile.id,
    enabled: true,
    daysBefore: profile.daysBefore,
    privacyMode: profile.privacyMode,
  })),
  appSettings: {
    id: 'app-settings',
    theme: 'AUTOMATIC',
    pinEnabled: false,
    biometricEnabled: false,
    autoLockMinutes: 5,
    lockWhenBackgrounded: true,
    screenshotBlocking: false,
    hideRecentPreview: true,
    language: 'en',
    languageConfirmed: true,
  },
};
const backup = {
  format: 'flowra-data',
  schemaVersion: 1,
  createdAt,
  data: snapshot,
};

const encryptedBackup = await encrypt(backup);
const verifiedBackup = await decrypt(encryptedBackup);
if (
  verifiedBackup.format !== 'flowra-data' ||
  verifiedBackup.data.profiles.length !== 3 ||
  verifiedBackup.data.periods.length !== 30 ||
  verifiedBackup.data.dailyLogs.length !== 150
) {
  throw new Error('Generated demo backup failed its round-trip validation.');
}
const reminderDates = profileDefinitions.map((profile) =>
  addDays(profile.predictedDate, -profile.daysBefore),
);
if (!reminderDates.includes(tomorrow) || !reminderDates.includes(dayAfterTomorrow))
  throw new Error('Generated demo reminder dates are incorrect.');

await mkdir('test-data', { recursive: true });
await writeFile(OUTPUT, JSON.stringify(encryptedBackup), 'utf8');
await writeFile(
  'test-data/README.md',
  `# Flowra notification demo backup\n\n- File: \`flowra-notification-demo.flowra\`\n- Password: \`12345678\`\n- Generated: ${createdAt}\n- Expected notification dates: ${tomorrow} and ${dayAfterTomorrow}, at 9:00 AM device time.\n- Profiles: three, with reminder offsets of 0, 1, and 3 days.\n\nRegenerate relative to the current date with \`npm run demo:backup\`. Restore replaces current Flowra data, so create a backup of real data first.\n`,
  'utf8',
);
console.log(`Created ${OUTPUT}`);
console.log(`Password: ${PASSWORD}`);
console.log(`Expected notifications: ${tomorrow} and ${dayAfterTomorrow} at 09:00`);
