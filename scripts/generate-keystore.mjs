import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const target = 'release-keystore.jks';
if (existsSync(target))
  throw new Error(`${target} already exists. Move it before generating another signing identity.`);
const result = spawnSync(
  'keytool',
  [
    '-genkeypair',
    '-v',
    '-keystore',
    target,
    '-storetype',
    'PKCS12',
    '-alias',
    'flowra',
    '-keyalg',
    'RSA',
    '-keysize',
    '4096',
    '-validity',
    '10000',
  ],
  { stdio: 'inherit' },
);
if (result.status !== 0) throw new Error('keytool could not create the Flowra release keystore.');
console.log(`Created ${target}. Keep it and its password outside the repository.`);
