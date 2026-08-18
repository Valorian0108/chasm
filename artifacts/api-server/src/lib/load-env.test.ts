import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnvFiles } from "./load-env";

const trackedKeys = [
  "LOAD_ENV_PLAIN",
  "LOAD_ENV_EXPORTED",
  "LOAD_ENV_QUOTED",
  "LOAD_ENV_SINGLE_QUOTED",
  "LOAD_ENV_EMPTY",
  "LOAD_ENV_WITH_EQUALS",
  "LOAD_ENV_OVERRIDDEN",
  "LOAD_ENV_PRESET",
  "LOAD_ENV_COMMENT",
  "LOAD_ENV_NO_EQUALS",
];

let workdir: string;

beforeEach(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), "load-env-"));
  for (const key of trackedKeys) {
    delete process.env[key];
  }
});

afterEach(() => {
  fs.rmSync(workdir, { recursive: true, force: true });
  for (const key of trackedKeys) {
    delete process.env[key];
  }
});

describe("loadEnvFiles", () => {
  it("parses plain, exported, quoted and value-with-equals entries", () => {
    fs.writeFileSync(
      path.join(workdir, ".env"),
      [
        "# a comment",
        "LOAD_ENV_COMMENT_ONLY",
        "",
        "LOAD_ENV_PLAIN=plain",
        "export LOAD_ENV_EXPORTED=exported",
        'LOAD_ENV_QUOTED="double quoted"',
        "LOAD_ENV_SINGLE_QUOTED='single quoted'",
        "LOAD_ENV_EMPTY=",
        "LOAD_ENV_WITH_EQUALS=postgres://user:pass@host:5432/db?a=b",
        "LOAD_ENV_NO_EQUALS",
        "=no-key",
      ].join("\n"),
    );

    loadEnvFiles(workdir);

    expect(process.env.LOAD_ENV_PLAIN).toBe("plain");
    expect(process.env.LOAD_ENV_EXPORTED).toBe("exported");
    expect(process.env.LOAD_ENV_QUOTED).toBe("double quoted");
    expect(process.env.LOAD_ENV_SINGLE_QUOTED).toBe("single quoted");
    expect(process.env.LOAD_ENV_EMPTY).toBe("");
    expect(process.env.LOAD_ENV_WITH_EQUALS).toBe(
      "postgres://user:pass@host:5432/db?a=b",
    );
    expect(process.env.LOAD_ENV_NO_EQUALS).toBeUndefined();
    expect(process.env.LOAD_ENV_COMMENT).toBeUndefined();
  });

  it("lets .env.local override .env", () => {
    fs.writeFileSync(
      path.join(workdir, ".env"),
      "LOAD_ENV_OVERRIDDEN=from-env\nLOAD_ENV_PLAIN=plain",
    );
    fs.writeFileSync(
      path.join(workdir, ".env.local"),
      "LOAD_ENV_OVERRIDDEN=from-local",
    );

    loadEnvFiles(workdir);

    expect(process.env.LOAD_ENV_OVERRIDDEN).toBe("from-local");
    expect(process.env.LOAD_ENV_PLAIN).toBe("plain");
  });

  it("never overwrites an existing process env value", () => {
    process.env.LOAD_ENV_PRESET = "already-set";
    fs.writeFileSync(path.join(workdir, ".env"), "LOAD_ENV_PRESET=from-file");

    loadEnvFiles(workdir);

    expect(process.env.LOAD_ENV_PRESET).toBe("already-set");
  });

  it("is a no-op when no env files exist", () => {
    expect(() => loadEnvFiles(workdir)).not.toThrow();
    expect(process.env.LOAD_ENV_PLAIN).toBeUndefined();
  });
});
