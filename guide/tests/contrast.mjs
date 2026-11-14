const hexColor = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const rgbaColor = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

export function parseColor(value) {
  const text = value.trim();
  const hex = text.match(hexColor);
  if (hex) return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16), a: 1 };
  const rgba = text.match(rgbaColor);
  if (rgba) return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  throw new Error(`cannot read the color ${value}`);
}

function blend(foreground, background) {
  const mix = (top, bottom) => top * foreground.a + bottom * (1 - foreground.a);
  return { r: mix(foreground.r, background.r), g: mix(foreground.g, background.g), b: mix(foreground.b, background.b), a: 1 };
}

export function layerColors(top, bottom) {
  return blend(top, blend(bottom, { r: 255, g: 255, b: 255, a: 1 }));
}

function luminance({ r, g, b }) {
  const linear = (channel) => {
    const share = channel / 255;
    return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(foreground, background) {
  const opaqueBackground = blend(background, { r: 255, g: 255, b: 255, a: 1 });
  const lighter = Math.max(luminance(blend(foreground, opaqueBackground)), luminance(opaqueBackground));
  const darker = Math.min(luminance(blend(foreground, opaqueBackground)), luminance(opaqueBackground));
  return (lighter + 0.05) / (darker + 0.05);
}

const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function blockOf(css, selector) {
  const block = css.match(new RegExp(`(?:^|\\n)${escapeForRegExp(selector)}\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`no rule for ${selector}`);
  return block[1];
}

export function readTokens(css, selector) {
  const tokens = new Map();
  for (const [, name, value] of blockOf(css, selector).matchAll(/(--n-[a-z-]+):\s*([^;]+);/g)) tokens.set(name, value.trim());
  return tokens;
}

function tokenUseIn(block, property) {
  return block.match(new RegExp(`(?:^|[\\s;])${property}:\\s*var\\((--n-[a-z-]+)\\)`))?.[1];
}

export function readTokenUse(css, selector, property) {
  const use = tokenUseIn(blockOf(css, selector), property);
  if (!use) throw new Error(`${selector} sets no ${property} from an --n token`);
  return use;
}

function listedBlockOf(css, selector) {
  for (const [, prelude, body] of css.matchAll(/(?:^|\n)([^{}]+)\{([^}]*)\}/g)) {
    if (prelude.split(",").some((part) => part.trim() === selector)) return body;
  }
  throw new Error(`no rule lists ${selector}`);
}

export function readListedTokenUse(css, selector, property) {
  const use = tokenUseIn(listedBlockOf(css, selector), property);
  if (!use) throw new Error(`${selector} sets no ${property} from an --n token`);
  return use;
}

export function readCascadedTokenUse(css, selectors, property) {
  for (const selector of selectors) {
    const use = tokenUseIn(blockOf(css, selector), property);
    if (use) return use;
  }
  throw new Error(`${selectors.join(" and ")} set no ${property} from an --n token`);
}

export function readThemes(tokensCss) {
  const darkTokens = readTokens(tokensCss, ":root");
  return [
    ["dark", darkTokens],
    ["light", new Map([...darkTokens, ...readTokens(tokensCss, ':root[data-theme="light"]')])],
  ];
}
