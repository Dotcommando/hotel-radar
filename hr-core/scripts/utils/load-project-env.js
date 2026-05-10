const fs = require('node:fs');
const path = require('node:path');

function expandEnvValue(value) {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (match, key) => {
    return process.env[key] ?? match;
  });
}

function normalizeEnvValue(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (match === null) {
      continue;
    }

    const key = match[1];

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = expandEnvValue(normalizeEnvValue(match[2]));
  }
}

function loadProjectEnv() {
  loadEnvFile(path.resolve(__dirname, '../../..', '.env'));
  loadEnvFile(path.resolve(__dirname, '../..', '.env'));
}

module.exports = {
  loadProjectEnv,
};

