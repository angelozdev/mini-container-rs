import { readFileSync } from "node:fs";
import { join } from "node:path";
import { builtFolder, listFiles } from "./support.mjs";

const groupAtRules = ["@media", "@supports", "@layer"];

function findClosingBrace(css, open) {
  let depth = 0;
  for (let position = open; position < css.length; position += 1) {
    if (css[position] === "{") depth += 1;
    if (css[position] === "}") depth -= 1;
    if (depth === 0) return position;
  }
  throw new Error("a block in the built stylesheet is never closed");
}

function readRules(css, conditions) {
  const rules = [];
  let position = 0;
  while (position < css.length) {
    const open = css.indexOf("{", position);
    if (open === -1) break;
    const close = findClosingBrace(css, open);
    const prelude = css.slice(position, open).split(";").pop().trim();
    const body = css.slice(open + 1, close);
    if (groupAtRules.some((name) => prelude.startsWith(name))) {
      rules.push(...readRules(body, [...conditions, prelude]));
    } else if (!prelude.startsWith("@")) {
      rules.push({ selector: prelude, body, conditions });
    }
    position = close + 1;
  }
  return rules;
}

export function readSiteCssRules() {
  const sheets = listFiles(join(builtFolder, "_astro")).filter((path) => path.endsWith(".css"));
  return sheets.flatMap((path) => readRules(readFileSync(path, "utf8"), []));
}

export function declares(rule, property, value) {
  return rule.body.split(";").some((declaration) => {
    const [name, ...rest] = declaration.split(":");
    return name.trim() === property && (value === undefined || rest.join(":").trim() === value);
  });
}
