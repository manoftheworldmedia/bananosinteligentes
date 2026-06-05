import { mkdir, readFile, writeFile } from "node:fs/promises";

const tokens = JSON.parse(await readFile(new URL("../tokens/brand.json", import.meta.url), "utf8"));

const lines = [":root {"];

function flatten(prefix, value) {
  if (typeof value === "string") {
    lines.push(`  --bi-${prefix}: ${value};`);
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    flatten(`${prefix}-${key}`, child);
  }
}

for (const [key, value] of Object.entries(tokens)) {
  flatten(key, value);
}

lines.push("}");
lines.push("");

await mkdir(new URL("../dist", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/tokens.css", import.meta.url), lines.join("\n"));
