import { spawnSync } from 'node:child_process';

const target = process.argv[2] ?? 'release-keystore.jks';
const result = spawnSync('keytool', ['-list', '-keystore', target], { stdio: 'inherit' });
if (result.status !== 0) throw new Error(`Unable to inspect ${target}.`);
