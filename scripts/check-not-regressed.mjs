#!/usr/bin/env node
// Refuses to publish if package.json's version isn't strictly newer than
// whatever npm currently serves as "latest" — the exact failure mode that
// let a stale checkout republish 0.2.4 over 0.4.18 and silently downgrade
// every consumer's `latest` dist-tag.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { name, version: localVersion } = JSON.parse(readFileSync('package.json', 'utf8'));

function parse(v) {
  const [core] = v.split('-');
  const [major, minor, patch] = core.split('.').map(Number);
  return { major, minor, patch };
}

function isNewer(a, b) {
  const pa = parse(a), pb = parse(b);
  if (pa.major !== pb.major) return pa.major > pb.major;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor;
  return pa.patch > pb.patch;
}

let remoteVersion;
try {
  remoteVersion = execSync(`npm view ${name} version`, { encoding: 'utf8' }).trim();
} catch {
  // Package has never been published — nothing to regress against.
  process.exit(0);
}

if (!isNewer(localVersion, remoteVersion)) {
  console.error(
    `\nRefusing to publish: local version ${localVersion} is not newer than ` +
    `the registry's current latest (${remoteVersion}).\n` +
    `Did you check out an old commit, or forget to bump package.json?\n`
  );
  process.exit(1);
}

console.log(`OK: ${localVersion} > registry latest (${remoteVersion})`);
