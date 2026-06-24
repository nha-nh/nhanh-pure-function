/**
 * 颜色转换工具。
 * 支持输入：hex/rgb/hsl/hsv，统一解析后输出指定格式。
 */
export class _Utility_ColorConverter {
  private constructor() {}

  private static readonly DEFAULT_ALPHA = 1;

  /**
   * 数值钳制，确保在合法区间内。
   */
  private static clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  private static normalizeHue(hue: number) {
    return ((hue % 360) + 360) % 360;
  }

  /**
   * 根据色相分段与色度参数生成 RGB（0-255）。
   */
  private static chromaToRgb(h: number, c: number, m: number) {
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));

    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (h < 60) [r1, g1, b1] = [c, x, 0];
    else if (h < 120) [r1, g1, b1] = [x, c, 0];
    else if (h < 180) [r1, g1, b1] = [0, c, x];
    else if (h < 240) [r1, g1, b1] = [0, x, c];
    else if (h < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];

    return {
      r: (r1 + m) * 255,
      g: (g1 + m) * 255,
      b: (b1 + m) * 255,
    };
  }

  private static resolveAlpha(alpha: number | undefined, fallback: number) {
    return Number.isFinite(alpha) ? this.clamp(alpha!, 0, 1) : fallback;
  }

  private static toRoundedRgbString(r: number, g: number, b: number) {
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  /**
   * HSL 转 RGB。
   * h: 0-360, s/l: 0-100
   */
  private static hslToRgb(h: number, s: number, l: number) {
    const hh = this.normalizeHue(h);
    const ss = this.clamp(s, 0, 100) / 100;
    const ll = this.clamp(l, 0, 100) / 100;

    const c = (1 - Math.abs(2 * ll - 1)) * ss;
    const m = ll - c / 2;
    return this.chromaToRgb(hh, c, m);
  }

  /**
   * HSV 转 RGB。
   * h: 0-360, s/v: 0-100
   */
  private static hsvToRgb(h: number, s: number, v: number) {
    const hh = this.normalizeHue(h);
    const ss = this.clamp(s, 0, 100) / 100;
    const vv = this.clamp(v, 0, 100) / 100;

    const c = vv * ss;
    const m = vv - c;
    return this.chromaToRgb(hh, c, m);
  }

  /**
   * 解析任意受支持的颜色格式并标准化为 RGBA。
   */
  private static parseColor(color: string) {
    const normalized = color.trim().toLowerCase();

    if (normalized.startsWith("#")) {
      const hex = normalized.slice(1);

      if (hex.length === 3 || hex.length === 4) {
        const [r, g, b, a = "f"] = hex.split("");
        return {
          r: parseInt(`${r}${r}`, 16),
          g: parseInt(`${g}${g}`, 16),
          b: parseInt(`${b}${b}`, 16),
          a: parseInt(`${a}${a}`, 16) / 255,
        };
      }

      if (hex.length === 6 || hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a =
          hex.length === 8
            ? parseInt(hex.slice(6, 8), 16) / 255
            : this.DEFAULT_ALPHA;
        return { r, g, b, a };
      }
    }

    const matched = normalized.match(/^rgba?\(([^)]+)\)$/);
    if (matched) {
      const parts = matched[1].split(",").map((part) => part.trim());
      if (parts.length >= 3) {
        const r = this.clamp(Number(parts[0]), 0, 255);
        const g = this.clamp(Number(parts[1]), 0, 255);
        const b = this.clamp(Number(parts[2]), 0, 255);
        const a =
          parts.length >= 4
            ? this.clamp(Number(parts[3]), 0, 1)
            : this.DEFAULT_ALPHA;
        return { r, g, b, a };
      }
    }

    const hslMatched = normalized.match(/^hsl\(([^)]+)\)$/);
    if (hslMatched) {
      const parts = hslMatched[1]
        .split(",")
        .map((part) => part.trim().replace("%", ""));
      if (parts.length >= 3) {
        const h = Number(parts[0]);
        const s = Number(parts[1]);
        const l = Number(parts[2]);
        const rgb = this.hslToRgb(h, s, l);
        return { ...rgb, a: this.DEFAULT_ALPHA };
      }
    }

    const hsvMatched = normalized.match(/^hsv\(([^)]+)\)$/);
    if (hsvMatched) {
      const parts = hsvMatched[1]
        .split(",")
        .map((part) => part.trim().replace("%", ""));
      if (parts.length >= 3) {
        const h = Number(parts[0]);
        const s = Number(parts[1]);
        const v = Number(parts[2]);
        const rgb = this.hsvToRgb(h, s, v);
        return { ...rgb, a: this.DEFAULT_ALPHA };
      }
    }

    console.error("Invalid color format", color);
    return { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };
  }

  /**
   * 十进制颜色分量转两位十六进制字符串。
   */
  private static toHexPart(value: number) {
    return Math.round(this.clamp(value, 0, 255)).toString(16).padStart(2, "0");
  }

  /**
   * RGB 转 HSL。
   * 返回 h:0-360, s/l:0-100
   */
  private static rgbToHsl(r: number, g: number, b: number) {
    const rr = this.clamp(r, 0, 255) / 255;
    const gg = this.clamp(g, 0, 255) / 255;
    const bb = this.clamp(b, 0, 255) / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === rr) h = 60 * (((gg - bb) / delta) % 6);
      else if (max === gg) h = 60 * ((bb - rr) / delta + 2);
      else h = 60 * ((rr - gg) / delta + 4);
    }
    if (h < 0) h += 360;

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return { h, s: s * 100, l: l * 100 };
  }

  /**
   * RGB 转 HSV。
   * 返回 h:0-360, s/v:0-100
   */
  private static rgbToHsv(r: number, g: number, b: number) {
    const rr = this.clamp(r, 0, 255) / 255;
    const gg = this.clamp(g, 0, 255) / 255;
    const bb = this.clamp(b, 0, 255) / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === rr) h = 60 * (((gg - bb) / delta) % 6);
      else if (max === gg) h = 60 * ((bb - rr) / delta + 2);
      else h = 60 * ((rr - gg) / delta + 4);
    }
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return { h, s: s * 100, v: v * 100 };
  }

  /**
   * 转换为 HEX（#RRGGBB）。
   */
  static toHex(color: string) {
    const { r, g, b } = this.parseColor(color);
    return `#${this.toHexPart(r)}${this.toHexPart(g)}${this.toHexPart(b)}`;
  }

  /**
   * 转换为 HEXA（#RRGGBBAA）。
   * alpha 不传时保留输入颜色中的透明度（默认 1）。
   */
  static toHexa(color: string, alpha?: number) {
    const { r, g, b, a } = this.parseColor(color);
    const finalAlpha = this.resolveAlpha(alpha, a);
    return `#${this.toHexPart(r)}${this.toHexPart(g)}${this.toHexPart(
      b
    )}${this.toHexPart(finalAlpha * 255)}`;
  }

  /**
   * 转换为 RGB（rgb(r, g, b)）。
   */
  static toRgb(color: string) {
    const { r, g, b } = this.parseColor(color);
    return this.toRoundedRgbString(r, g, b);
  }

  /**
   * 转换为 RGBA（rgba(r, g, b, a)）。
   * alpha 不传时保留输入颜色中的透明度（默认 1）。
   */
  static toRgba(color: string, alpha?: number) {
    const parsed = this.parseColor(color);
    const finalAlpha = this.resolveAlpha(alpha, parsed.a);
    return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(
      parsed.b
    )}, ${finalAlpha})`;
  }

  /**
   * 转换为 HSL（hsl(h, s%, l%)）。
   */
  static toHsl(color: string) {
    const { r, g, b } = this.parseColor(color);
    const { h, s, l } = this.rgbToHsl(r, g, b);
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  }

  /**
   * 转换为 HSLA（hsla(h, s%, l%, a)）。
   * alpha 不传时保留输入颜色中的透明度（默认 1）。
   */
  static toHsla(color: string, alpha?: number) {
    const parsed = this.parseColor(color);
    const { h, s, l } = this.rgbToHsl(parsed.r, parsed.g, parsed.b);
    const finalAlpha = this.resolveAlpha(alpha, parsed.a);
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(
      l
    )}%, ${finalAlpha})`;
  }

  /**
   * 转换为 HSV（hsv(h, s%, v%)）。
   */
  static toHsv(color: string) {
    const { r, g, b } = this.parseColor(color);
    const { h, s, v } = this.rgbToHsv(r, g, b);
    return `hsv(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(v)}%)`;
  }

  /**
   * 转换为 HSVA（hsva(h, s%, v%, a)）。
   * alpha 不传时保留输入颜色中的透明度（默认 1）。
   */
  static toHsva(color: string, alpha?: number) {
    const parsed = this.parseColor(color);
    const { h, s, v } = this.rgbToHsv(parsed.r, parsed.g, parsed.b);
    const finalAlpha = this.resolveAlpha(alpha, parsed.a);
    return `hsva(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(
      v
    )}%, ${finalAlpha})`;
  }

  /**
   * 返回解析后的 RGBA 对象。
   * @param color 任意受支持的颜色字符串（hex/rgb/hsl/hsv）
   * @returns {{ r: number; g: number; b: number; a: number }} RGBA 分量，r/g/b 范围 0-255，a 范围 0-1
   */
  static toRgbaObject(color: string) {
    return this.parseColor(color);
  }

  /**
   * 判断两个颜色是否在允许的色差范围内（基于 RGB 欧几里得距离）。
   * @param colorA 第一个颜色字符串
   * @param colorB 第二个颜色字符串
   * @param threshold 允许的最大色差值，范围约 0（完全相同）到 442（黑白最大距离），含 alpha 时上限约 510
   * @param includeAlpha 是否将 alpha 差值纳入计算，默认 true；启用时 alpha 差值会缩放到 0-255 参与距离
   * @returns true 表示在允许色差内
   */
  static isWithinColorDifference(
    colorA: string,
    colorB: string,
    threshold: number,
    includeAlpha = true
  ): boolean {
    const a = this.parseColor(colorA);
    const b = this.parseColor(colorB);
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    let sum = dr * dr + dg * dg + db * db;
    if (includeAlpha) {
      const da = (a.a - b.a) * 255;
      sum += da * da;
    }
    return Math.sqrt(sum) <= threshold;
  }

  /**
   * 混合两个颜色（在 RGBA 空间线性插值）。
   * @param colorA 起始颜色
   * @param colorB 终点颜色
   * @param ratio 混合比例，0 = 完全 A，1 = 完全 B
   * @returns 混合后的 rgba 字符串
   */
  static mix(colorA: string, colorB: string, ratio: number): string {
    const t = this.clamp(ratio, 0, 1);
    const a = this.parseColor(colorA);
    const b = this.parseColor(colorB);
    const r = a.r + (b.r - a.r) * t;
    const g = a.g + (b.g - a.g) * t;
    const bl = a.b + (b.b - a.b) * t;
    const alpha = a.a + (b.a - a.a) * t;
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bl)}, ${alpha})`;
  }

  /**
   * 转换为灰度（基于 ITU-R BT.709 权重）。
   * @param color 任意受支持的颜色字符串
   * @returns 灰度 rgb 字符串
   */
  static toGrayscale(color: string): string {
    const { r, g, b } = this.parseColor(color);
    const gray = Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722);
    return this.toRoundedRgbString(gray, gray, gray);
  }

  /**
   * 计算 WCAG 2.0 相对亮度。
   * @param color 任意受支持的颜色字符串
   * @returns 相对亮度值，范围 [0, 1]
   */
  static luminance(color: string): number {
    const { r, g, b } = this.parseColor(color);
    const linearize = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return (
      linearize(r) * 0.2126 + linearize(g) * 0.7152 + linearize(b) * 0.0722
    );
  }

  /**
   * 计算 WCAG 2.0 对比度。
   * @param colorA 第一个颜色
   * @param colorB 第二个颜色
   * @returns 对比度值，范围 [1, 21]
   */
  static contrastRatio(colorA: string, colorB: string): number {
    const l1 = this.luminance(colorA);
    const l2 = this.luminance(colorB);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * 设置透明度并返回 rgba 字符串。
   * @param color 任意受支持的颜色字符串
   * @param alpha 目标透明度，范围 [0, 1]
   * @returns rgba 字符串
   */
  static withAlpha(color: string, alpha: number): string {
    const { r, g, b } = this.parseColor(color);
    const a = this.clamp(alpha, 0, 1);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
  }
}
