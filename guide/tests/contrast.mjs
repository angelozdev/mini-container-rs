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

export function readTokenUse(css, selector, property) {
  const use = blockOf(css, selector).match(new RegExp(`(?:^|[\\s;])${property}:\\s*var\\((--n-[a-z-]+)\\)`));
  if (!use) throw new Error(`${selector} sets no ${property} from an --n token`);
  return use[1];
}
