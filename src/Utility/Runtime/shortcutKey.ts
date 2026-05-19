type ShortcutKey = "Ctrl" | "Shift" | "Alt" | "Meta";

interface BindOptions {
  callback: (event: KeyboardEvent) => void;
  /** 用于分隔按键序列 (例如：',' 或 ';') */
  sequenceDelimiter?: string;
  /** 用于分隔组合键内部 (例如：'+' 或 '-') */
  chordDelimiter?: string;
}

export class _Utility_ShortcutKey {
  private static lastClickDom?: HTMLElement;
  private static lastHoverDom?: HTMLElement;
  private constructor() {
    window.addEventListener("mousemove", _Utility_ShortcutKey.handleMouseMove);
    window.addEventListener("click", _Utility_ShortcutKey.handleClick);
    window.addEventListener("keydown", _Utility_ShortcutKey.handleKeyDown);
    window.addEventListener("keyup", _Utility_ShortcutKey.handleKeyUp);
  }

  private static handleMouseMove(event: MouseEvent) {
    this.lastHoverDom = event.target as HTMLElement;
  }
  private static handleClick(event: MouseEvent) {
    this.lastClickDom = event.target as HTMLElement;
  }
  private static handleKeyDown(event: KeyboardEvent) {}
  private static handleKeyUp(event: KeyboardEvent) {}

  static bind(key: string, options: BindOptions) {
    // 使用解构赋默认值，保持逻辑内聚
    const { sequenceDelimiter = ",", chordDelimiter = "+" } = options;

    const keySequence = key
      .split(sequenceDelimiter)
      .map((chord) => chord.split(chordDelimiter));

    console.log(keySequence);
  }
  static unbind(key: string) {}
}
