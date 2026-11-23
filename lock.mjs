// Encrypts seed.json into seed.enc.js so the public site holds no readable personal data.
// Usage:  node lock.mjs            (prompts for a password, hidden)
//         PASS='long passphrase' node lock.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import readline from 'node:readline';

const ITER = 250000;

function ask(q) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); res(a); });
  });
}

const pass = process.env.PASS || await ask('Choose a password (12+ characters, a few random words is best): ');
if (pass.length < 12) { console.error('Use at least 12 characters: this password is the only protection for the data.'); process.exit(1); }

const plain = Buffer.from(JSON.stringify(JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'))), 'utf8');
const salt = randomBytes(16), iv = randomBytes(12);
const key = pbkdf2Sync(pass, salt, ITER, 32, 'sha256');
const c = createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]); // WebCrypto expects the tag appended
const out = { iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), data: enc.toString('base64') };
writeFileSync(new URL('./seed.enc.js', import.meta.url), 'window.SEED_ENC = ' + JSON.stringify(out) + ';\n');
console.log('Wrote seed.enc.js (' + enc.length + ' bytes encrypted).');
