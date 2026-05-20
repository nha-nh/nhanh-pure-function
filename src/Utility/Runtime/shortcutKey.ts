/**
 * 全局快捷键管理：支持组合键、多步序列、作用域与输入框上下文过滤。
 *
 * @example
 * ```ts
 * const shortcuts = new _Utility_ShortcutManager();
 * shortcuts.bind("control+s,control+shift+s", {
 *   callback: (e) => { e.preventDefault(); save(); },
 *   sequenceDelimiter: ",",
 *   chordDelimiter: "+",
 * });
 * ```
 */

/** `bind` 时传入的配置项 */
interface ShortcutOptions {
  /** 匹配成功后的回调 */
  callback: (event: KeyboardEvent) => void;
  /** 多步序列之间的分隔符，默认 `","` */
  sequenceDelimiter?: string;
  /** 单步组合键内各键的分隔符，默认 `"+"` */
  chordDelimiter?: string;
  /** CSS 选择器，仅在匹配元素内生效；未设置则全局生效 */
  scope?: string;
  /** `scope` 的判定依据：`click` 用最近点击目标，`hover` 用最近悬停目标 */
  scopeType?: "click" | "hover";
  /** 多步序列中，相邻两步之间的最大间隔（毫秒），默认 `5000` */
  timeout?: number;
  /** 为 `true` 时，在 input / textarea / contentEditable 内也响应快捷键 */
  enableInInput?: boolean;
}

/**
 * 配置串 / 常用写法 → `KeyboardEvent.key` 小写形式。
 * 未列出的键名经 `toLowerCase()` 后与 `event.key` 直接对齐。
 */
const KEY_ALIASES: Readonly<Record<string, string>> = {
  // 修饰键
  ctrl: "control",
  ctl: "control",
  cmd: "meta",
  command: "meta",
  win: "meta",
  super: "meta",
  windows: "meta",
  os: "meta",
  opt: "alt",
  option: "alt",
  alternate: "alt",
  // 空格（`event.key` 为 `" "`）
  " ": "space",
  spacebar: "space",
  // 编辑 / 功能键
  esc: "escape",
  return: "enter",
  del: "delete",
  bs: "backspace",
  ins: "insert",
  pgup: "pageup",
  pgdn: "pagedown",
  // 方向键（`event.key` 为 `ArrowUp` 等）
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
};

/** 内部运行时状态，由 `bind` 解析 `key` 后生成 */
interface ShortcutBinding extends ShortcutOptions {
  /**
   * 解析后的按键序列。外层为步骤顺序，内层为单步组合键及按下顺序。
   * @example `[["control", "a"], ["control", "shift", "s"]]`
   */
  sequence: string[][];
  /** 当前匹配到的步骤下标（0-based） */
  currentIndex: number;
  /** 多步序列超时定时器 ID */
  timerId?: number;
}

/**
 * 全局快捷键管理器
 *
 * ⚠️ **注意**：本组件会在全局 `window` 上绑定多个事件监听器。
 * 为了防止内存泄漏及非预期的快捷键触发，**在组件卸载或页面关闭时，必须显式调用 `.destroy()` 方法**。
 *
 * @example
 * const manager = new _Utility_ShortcutManager();
 * // 离开页面时
 * manager.destroy();
 */
export class _Utility_ShortcutManager {
  // 静态计数器：记录当前活跃的实例数量
  private static activeInstances = 0;

  /** 最近一次 `mousedown` 的目标，供 `scopeType: "click"` 使用 */
  private lastClickDom?: HTMLElement;
  /** 最近一次 `mouseover` 的目标，供 `scopeType: "hover"` 使用 */
  private lastHoverDom?: HTMLElement;

  /** 当前仍按下的键（已 normalize），顺序与物理按下顺序一致 */
  private downKeys: string[] = [];
  /** 注册表：`bind` 时的原始 `key` 字符串 → 运行时绑定 */
  private bindings = new Map<string, ShortcutBinding>();

  /** 为 `true` 时在控制台输出 keydown / keyup 日志 */
  private debug = false;

  constructor(debug?: boolean) {
    this.debug = !!debug;

    // 提醒策略 A：当发现存在多个未销毁的实例时，发出警告
    _Utility_ShortcutManager.activeInstances++;
    if (_Utility_ShortcutManager.activeInstances > 1) {
      console.warn(
        `[_Utility_ShortcutManager] 检测到当前页面存在 ${_Utility_ShortcutManager.activeInstances} 个活跃实例。` +
          `请确保不再使用的实例已显式调用 \`destroy()\` 以释放全局 window 监听器，避免内存泄漏。`,
      );
    }

    window.addEventListener("mouseover", this.handleMouseOver);
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.clearKeys);
  }

  /**
   * 注册快捷键。
   * @param key 配置字符串，如 `"control+a"` 或 `"g,i"`（两步序列）
   * @param options 回调与其它选项
   */
  bind(key: string | string[], options: ShortcutOptions) {
    if (Array.isArray(key)) {
      key.forEach((k) => this.bind(k, options));
      return;
    }

    const { sequenceDelimiter = ",", chordDelimiter = "+" } = options;

    const sequence = key
      .split(sequenceDelimiter)
      .filter(Boolean)
      .map((chord) =>
        chord.split(chordDelimiter).filter(Boolean).map(this.normalizeKey),
      );

    this.bindings.set(key, { ...options, sequence, currentIndex: 0 });
  }

  /** 移除指定 `key` 的绑定并清理其超时定时器 */
  unbind(key: string) {
    const binding = this.bindings.get(key);
    if (binding?.timerId) window.clearTimeout(binding.timerId);
    this.bindings.delete(key);
  }

  /**
   * 彻底销毁当前实例，清空所有快捷键绑定，并移除全局 window 事件监听器。
   *
   * ⚠️ **调用时机**：在单页应用（如 Vue/React 组件卸载）或不需要快捷键时**务必调用**。
   */
  destroy() {
    this.bindings.forEach((b) => b.timerId && window.clearTimeout(b.timerId));
    this.bindings.clear();
    this.downKeys = [];
    this.lastClickDom = undefined;
    this.lastHoverDom = undefined;

    window.removeEventListener("mouseover", this.handleMouseOver);
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.clearKeys);

    _Utility_ShortcutManager.activeInstances = Math.max(
      0,
      _Utility_ShortcutManager.activeInstances - 1,
    );
  }

  private handleMouseOver = (event: MouseEvent) => {
    this.lastHoverDom = event.target as HTMLElement;
  };

  private handleMouseDown = (event: MouseEvent) => {
    this.lastClickDom = event.target as HTMLElement;
  };

  /** 窗口失焦时清空按下状态，避免 `keyup` 未触发导致的状态残留 */
  private clearKeys = () => {
    this.downKeys = [];
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    const key = this.normalizeKey(event.key);
    if (this.downKeys.includes(key)) return;

    if (this.debug) {
      console.log(
        `[Shortcut Debug] 📥 keydown -> "${key}" | 当前按压序列: [${[...this.downKeys, key].join(", ")}]`,
      );
    }

    this.downKeys.push(key);
    this.checkBindings(event);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const key = this.normalizeKey(event.key);
    const index = this.downKeys.indexOf(key);
    if (index !== -1) {
      this.downKeys.splice(index, 1);

      if (this.debug) {
        console.log(
          `[Shortcut Debug] 📤 keyup -> "${key}" | 剩余按压序列: [${this.downKeys.join(", ")}]`,
        );
      }
    }
  };

  /**
   * 遍历所有绑定：校验作用域与输入上下文后，用数组匹配当前步骤；
   * 完全匹配则推进序列或触发回调，前缀匹配则等待，否则重置。
   */
  private checkBindings(event: KeyboardEvent) {
    let preventDefaultFlag = false;
    const activeElement = document.activeElement as HTMLElement;

    this.bindings.forEach((binding, shortcutText) => {
      const currentExpectedChord = binding.sequence[binding.currentIndex];

      if (!this.isValidScope(binding)) {
        if (
          this.debug &&
          this.isPrefixMatch(this.downKeys, currentExpectedChord)
        ) {
          console.warn(
            `[Shortcut Debug] ⚠️ 快捷键 "${shortcutText}" 匹配成功但由于作用域限制(scope: ${binding.scope})未触发`,
          );
        }
        return;
      }

      if (
        !this.isValidScope(binding) ||
        !this.isValidContext(binding, activeElement)
      ) {
        return;
      }

      if (this.isExactMatch(this.downKeys, currentExpectedChord)) {
        preventDefaultFlag = true;

        if (binding.currentIndex === binding.sequence.length - 1) {
          if (this.debug) {
            console.log(
              `[Shortcut Debug] 🎉 成功触发快捷键: "${shortcutText}"`,
            );
          }
          binding.callback(event);
          this.resetBinding(binding);
        } else {
          if (this.debug) {
            console.log(
              `[Shortcut Debug] ⏳ 序列匹配中进度: (${binding.currentIndex}/${binding.sequence.length})，等待下一步...`,
            );
          }
          binding.currentIndex++;
          this.startSequenceTimer(binding);
        }
      } else if (this.isPrefixMatch(this.downKeys, currentExpectedChord)) {
        // 符合前缀，不做重置
      } else {
        // 如果当前绑定有进度，但是按错了，通知重置
        if (binding.currentIndex > 0) {
          if (this.debug) {
            console.log(
              `[Shortcut Debug] 🛑 按键序列不匹配，重置快捷键 "${shortcutText}" 的进度`,
            );
          }
          this.resetBinding(binding);
        }
      }
    });

    if (preventDefaultFlag) {
      event.preventDefault();
    }
  }

  /** 启动多步序列超时；超时未按下一步则重置 `currentIndex` */
  private startSequenceTimer(binding: ShortcutBinding) {
    if (binding.timerId) window.clearTimeout(binding.timerId);
    binding.timerId = window.setTimeout(() => {
      this.resetBinding(binding);
    }, binding.timeout ?? 5000);
  }

  private resetBinding(binding: ShortcutBinding) {
    binding.currentIndex = 0;
    if (binding.timerId) {
      window.clearTimeout(binding.timerId);
      binding.timerId = undefined;
    }
  }

  private isValidScope(binding: ShortcutBinding): boolean {
    if (!binding.scope) return true;
    if (binding.scopeType === "click") {
      const target =
        document.activeElement !== document.body
          ? document.activeElement
          : this.lastClickDom;
      return !!target?.closest(binding.scope);
    } else {
      return !!this.lastHoverDom?.closest(binding.scope);
    }
  }

  /**
   * 默认在可编辑控件内禁用快捷键，避免与浏览器/输入法默认行为冲突。
   */
  private isValidContext(
    binding: ShortcutBinding,
    activeElement: HTMLElement,
  ): boolean {
    if (binding.enableInInput) return true;
    if (!activeElement) return true;

    const tagName = activeElement.tagName.toLowerCase();
    const isInput =
      tagName === "input" ||
      tagName === "textarea" ||
      activeElement.isContentEditable;
    return !isInput;
  }

  /**
   * 将配置串与 `KeyboardEvent.key` 统一为小写别名，便于与 `event.key` 比较。
   * 例如 `ctrl` → `control`，`cmd` → `meta`。
   */
  private normalizeKey(key: string): string {
    const lower = key.toLowerCase();
    return KEY_ALIASES[lower] ?? lower;
  }

  /** 当前按下键与预期组合键在长度与顺序上完全一致 */
  private isExactMatch(pressed: string[], expected: string[]): boolean {
    if (pressed.length !== expected.length) return false;
    return pressed.every((key, i) => key === expected[i]);
  }

  /**
   * 当前按下键是预期组合键的有序前缀（尚缺后续键）。
   * 使用逐元素比较，避免字符串 `startsWith` 误匹配（如 `"S"` 匹配 `"Shift,a"`）。
   */
  private isPrefixMatch(pressed: string[], expected: string[]): boolean {
    if (pressed.length > expected.length) return false;
    return pressed.every((key, i) => key === expected[i]);
  }
}
