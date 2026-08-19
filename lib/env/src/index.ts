import fs from "node:fs";
import path from "node:path";

function parseEnvFile(content: string) {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const equalsIndex = normalized.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = normalized.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }

    let value = normalized.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function loadEnvFiles(cwd = process.cwd()) {
  const root = path.resolve(cwd);
  const baseEnvPath = path.join(root, ".env");
  const localEnvPath = path.join(root, ".env.local");

  const merged = {
    ...(fs.existsSync(baseEnvPath) ? parseEnvFile(fs.readFileSync(baseEnvPath, "utf8")) : {}),
    ...(fs.existsSync(localEnvPath) ? parseEnvFile(fs.readFileSync(localEnvPath, "utf8")) : {}),
  };

  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
