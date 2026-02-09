/*
 * CI helper: reads JSON from stdin (Supabase keystore export response) and writes
 * - android-upload-keystore.p12
 * - credentials.json (EAS local credentials format)
 *
 * Never prints raw secrets.
 */

const fs = require('fs');
const { Buffer } = require('buffer');

function mask(s) {
  if (!s) return '';
  const str = typeof s === 'string' ? s : String(s);
  if (str.length <= 6) return '***';
  return str.slice(0, 2) + '***' + str.slice(-2);
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch (e) {
  die('❌ Failed to read stdin for keystore export response');
}

let resp;
try {
  resp = JSON.parse(raw);
} catch (e) {
  die('❌ Keystore export response is not valid JSON');
}

if (!resp || resp.ok !== true) {
  const err = resp && (resp.error || resp.message) ? (resp.error || resp.message) : 'unknown error';
  die('❌ Keystore export failed: ' + err);
}

if (!resp.keystoreBase64) die('❌ Missing keystoreBase64 in export response');
if (!resp.keystorePassword) die('❌ Missing keystorePassword in export response');
if (!resp.alias) die('❌ Missing alias in export response');
if (!resp.keyPassword) die('❌ Missing keyPassword in export response');

fs.writeFileSync('android-upload-keystore.p12', Buffer.from(resp.keystoreBase64, 'base64'), { mode: 0o600 });

const creds = {
  android: {
    keystore: {
      keystorePath: 'android-upload-keystore.p12',
      keystorePassword: resp.keystorePassword,
      keyAlias: resp.alias,
      keyPassword: resp.keyPassword,
    },
  },
};

fs.writeFileSync('credentials.json', JSON.stringify(creds, null, 2), { mode: 0o600 });
console.log(
  `✅ wrote signing files (alias=${resp.alias || 'unknown'}, keystorePassword=${mask(resp.keystorePassword)})`
);
