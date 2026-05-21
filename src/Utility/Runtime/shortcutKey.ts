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
  /**
   * 是否允许长按按键时重复触发回调，默认 `false`。
   * 适用于如 `+`、`-`、方向键等需要连续操作的场景。
   */
  allowRepeat?: boolean;
  /**
   * 允许重复触发时的最小时间间隔（毫秒）。
   * 由于操作系统的原生长按触发频率不可控且通常极高，利用该属性对重复事件进行节流。
   */
  repeatInterval?: number;
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
  /** 上次成功触发回调的时间戳。用于长按重复触发时的节流控制 */
  lastFiredAt?: number;
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
    const isKeyRepeat = event.repeat;

    if (this.downKeys.includes(key)) {
      // 为什么拦截：系统在长按时会不断派发重复的 keydown，此时该键已在追踪序列内。
      // 如果这不是系统的原生重发（极为罕见的异常），则丢弃。
      if (!isKeyRepeat) return;
    } else {
      this.downKeys.push(key);
    }

    if (this.debug) {
      console.log(
        `[Shortcut Debug] 📥 keydown -> "${key}" ${isKeyRepeat ? "(repeat)" : ""} | 当前按压序列: [${this.downKeys.join(", ")}]`,
      );
    }

    this.checkBindings(event, isKeyRepeat);
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

    // 为什么在这里重置：
    // 对于允许连续触发的配置（allowRepeat = true），其触发后状态会保留以匹配后续的 repeat 事件。
    // 当该组合键中的任意按键被物理松开时，说明长按操作已结束，必须显式重置以迎接下次全新操作。
    this.bindings.forEach((binding) => {
      if (
        binding.allowRepeat &&
        binding.currentIndex === binding.sequence.length - 1
      ) {
        const lastExpectedChord = binding.sequence[binding.currentIndex];
        if (lastExpectedChord.includes(key)) {
          this.resetBinding(binding);
        }
      }
    });
  };

  /**
   * 遍历所有绑定：校验作用域与输入上下文后，用数组匹配当前步骤；
   * 完全匹配则推进序列或触发回调，前缀匹配则等待，否则重置。
   */
  private checkBindings(event: KeyboardEvent, isKeyRepeat: boolean) {
    let shouldPreventDefault = false;
    const activeElement = document.activeElement as HTMLElement;
    const now = Date.now();

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

      if (!this.isValidContext(binding, activeElement)) {
        return;
      }

      if (this.isExactMatch(this.downKeys, currentExpectedChord)) {
        shouldPreventDefault = true;

        if (binding.currentIndex === binding.sequence.length - 1) {
          // 当前为序列最后一步。如果是由长按产生的事件，则校验重发限制
          if (isKeyRepeat) {
            if (!binding.allowRepeat) return;

            if (binding.repeatInterval && binding.lastFiredAt) {
              if (now - binding.lastFiredAt < binding.repeatInterval) {
                return; // 节流控制：未达冷却时间，阻断本次触发
              }
            }
          }

          if (this.debug) {
            console.log(
              `[Shortcut Debug] 🎉 成功触发快捷键: "${shortcutText}"`,
            );
          }

          binding.callback(event);
          binding.lastFiredAt = now;

          // 为什么在此分叉：
          // 如果允许重复触发，则保持当前 currentIndex 进度，以便下一个 native repeat 能继续匹配本步骤。
          // 否则，视为单次触发结束，立即清零。
          if (!binding.allowRepeat) {
            this.resetBinding(binding);
          }
        } else {
          // 当前为多步序列的中间阶段。
          // 为什么做此限制：长按产生的重复事件不应推进序列进度（如 "g, i" 序列长按 'g' 是无意义的）。
          if (!isKeyRepeat) {
            if (this.debug) {
              console.log(
                `[Shortcut Debug] ⏳ 序列匹配中进度: (${binding.currentIndex + 1}/${binding.sequence.length})，等待下一步...`,
              );
            }
            binding.currentIndex++;
            this.startSequenceTimer(binding);
          }
        }
      } else if (this.isPrefixMatch(this.downKeys, currentExpectedChord)) {
        // 符合前缀，不做重置，等待完整键入
      } else {
        // 为什么在此重置：按键存在冲突（错误组合或序列断链），立刻放弃现有累计匹配进度。
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

    if (shouldPreventDefault) {
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
    binding.lastFiredAt = undefined;
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
