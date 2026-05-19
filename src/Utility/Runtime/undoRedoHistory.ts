interface _Utility_UndoRedoConfig<T> {
  /** 存储上限；`0` 或负数表示无限制。超出时自动淘汰最早的记录。默认为 50 */
  maxSize?: number;
  /** 自定义克隆/结构共享函数。若不传，则默认直接引用赋值 */
  clone?: (value: T) => T;
  /** 初始状态快照 */
  initialState?: T;
}

interface _Utility_UndoRedoRecord<T> {
  /** 历史快照数据 */
  state: T;
  /** 记录产生的时间戳 */
  timestamp: number;
}

/** 订阅者回调函数类型 */
type _Utility_UndoRedoListener<T> = (current: Readonly<T> | undefined) => void;

/**
 * 通用历史记录状态机
 */
export class _Utility_UndoRedoHistory<T> {
  private stack: _Utility_UndoRedoRecord<T>[] = [];
  private _index = 0;
  private _maxSize = 0;
  private cloneFn: (value: T) => T;
  private listeners: Set<_Utility_UndoRedoListener<T>> = new Set();

  constructor(config: _Utility_UndoRedoConfig<T> = {}) {
    const { maxSize = 50, clone, initialState } = config;
    this._maxSize = maxSize > 0 ? Math.floor(maxSize) : 0;
    this.cloneFn = clone ?? ((v) => v);

    if (initialState !== undefined) {
      this.push(initialState);
    }
  }

  /** 获取最大存储上限 */
  get maxSize(): number {
    return this._maxSize;
  }

  /** 动态调整最大存储上限，超出时自动裁剪 */
  set maxSize(value: number) {
    const v = value > 0 ? Math.floor(value) : 0;
    if (this._maxSize === v) return;
    this._maxSize = v;
    this.trimOverflow();
    this.notify();
  }

  /** 当前所处的历史记录索引位置 */
  get index(): number {
    return this._index;
  }

  /** 历史栈中的总记录数 */
  get length(): number {
    return this.stack.length;
  }

  /** 历史栈是否为空 */
  get isEmpty(): boolean {
    return this.stack.length === 0;
  }

  /** 当前游标处的只读状态快照；栈为空时返回 `undefined` */
  get current(): Readonly<T> | undefined {
    return this.stack[this._index]?.state;
  }

  /** 是否可以执行撤销（Undo） */
  get canUndo(): boolean {
    return this.stack.length > 0 && this._index > 0;
  }

  /** 是否可以执行重做（Redo） */
  get canRedo(): boolean {
    return this.stack.length > 0 && this._index < this.stack.length - 1;
  }

  /** 剩余可撤销的步数 */
  get undoCount(): number {
    return this.stack.length === 0 ? 0 : this._index;
  }

  /** 剩余可重做的步数 */
  get redoCount(): number {
    return this.stack.length === 0 ? 0 : this.stack.length - 1 - this._index;
  }

  /**
   * 记录一个新状态。
   * 会自动裁剪掉当前索引之后的“未来（Redo）”分支，并处理容量超限。
   */
  push(state: T): void {
    // 如果当前不在末尾（即执行过Undo），写入新值时裁剪掉后面的Redo分支
    if (!this.isEmpty) {
      this.stack.splice(this._index + 1);
    }

    this.stack.push({
      state: this.cloneFn(state),
      timestamp: Date.now(),
    });

    this.trimOverflow();
    this._index = this.stack.length - 1;
    this.notify();
  }

  /**
   * 仅更新当前位置的快照，不产生新的历史节点，不裁剪未来分支。
   * 常用于高频连续变更的中间状态同步
   */
  replace(state: T): void {
    if (this.isEmpty) {
      this.push(state);
      return;
    }
    this.stack[this._index] = {
      state: this.cloneFn(state),
      timestamp: Date.now(),
    };
    this.notify();
  }

  /**
   * 撤销一步
   * @returns 是否撤销成功
   */
  undo(): boolean {
    if (!this.canUndo) return false;
    this._index--;
    this.notify();
    return true;
  }

  /**
   * 重进一步
   * @returns 是否重进成功
   */
  redo(): boolean {
    if (!this.canRedo) return false;
    this._index++;
    this.notify();
    return true;
  }

  /**
   * 跳转到指定的历史索引位置
   */
  jump(index: number): boolean {
    if (index < 0 || index >= this.stack.length) return false;
    if (this._index === index) return true;
    this._index = index;
    this.notify();
    return true;
  }

  /**
   * 清空所有历史记录并重置状态
   */
  clear(): void {
    this.stack = [];
    this._index = 0;
    this.notify();
  }

  /**
   * 支持多重事件监听。返回一个取消订阅的函数，便于在组件销毁时规避内存泄漏。
   */
  subscribe(listener: _Utility_UndoRedoListener<T>): () => void {
    this.listeners.add(listener);
    // 订阅时立即同步激活一次当前状态
    listener(this.current);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 返回整个历史栈的外部只读镜像，专门用于调试、分析或序列化暂存，防止内部数据被篡改。
   */
  snapshot(): readonly Readonly<_Utility_UndoRedoRecord<T>>[] {
    return this.stack;
  }

  /** 内部超出容量时的核心裁剪逻辑 */
  private trimOverflow(): void {
    if (this._maxSize <= 0 || this.stack.length <= this._maxSize) return;
    const excess = this.stack.length - this._maxSize;
    this.stack.splice(0, excess);
    this._index = Math.max(0, this._index - excess);
  }

  /** 统一通知所有订阅者 */
  private notify(): void {
    const currentRecord = this.stack[this._index];
    const currentState = currentRecord?.state;
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }
}
