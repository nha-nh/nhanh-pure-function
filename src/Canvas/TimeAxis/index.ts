import { _Animate_NumericTransition, _Format_Timestamp } from "../..";


class TimeAxisCanvasManager {
  /** Canvas DOM id（用于 `document.getElementById` 定位） */
  private id: string;
  /** 绑定到的 canvas 元素 */
  private canvas?: HTMLCanvasElement;
  /** Canvas 2D 绘制上下文（可能为 null） */
  private ctx: CanvasRenderingContext2D | null = null;
  /** 当前渲染像素宽度（会随尺寸变化更新） */
  private width: number = 0;
  /** 当前渲染像素高度（会随尺寸变化更新） */
  private height: number = 0;
  /** 尺寸变化监听器，用于驱动重绘 */
  private resizeObserver?: ResizeObserver;

  /** @param id canvas DOM id（通过 getElementById 定位） */
  constructor(id: string) {
    this.id = id;
  }

  /**
   * 初始化 canvas 引用/上下文，并同步画布像素尺寸与注册 resize 监听
   * @returns true 表示初始化成功；false 表示找不到 canvas 或上下文
   */
  init(onResize: () => void) {
    this.canvas = document.getElementById(this.id) as HTMLCanvasElement;
    if (!this.canvas) {
      console.error(`Canvas with id ${this.id} not found`);
      return false;
    }

    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) {
      console.error("Failed to get canvas context");
      return false;
    }

    this.syncCanvasSize();
    this.setupResizeListener(onResize);
    return true;
  }

  /** 获取当前 CanvasRenderingContext2D */
  getContext() {
    return this.ctx;
  }

  /** 获取当前 canvas DOM 元素 */
  getCanvas() {
    return this.canvas;
  }

  /** 获取当前画布像素尺寸 */
  getSize() {
    return { width: this.width, height: this.height };
  }

  /** 根据元素在页面中的尺寸同步 canvas.width/canvas.height */
  syncCanvasSize() {
    const { canvas } = this;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    canvas.width = width;
    canvas.height = height;
    this.width = width;
    this.height = height;
  }

  /** 注册 ResizeObserver，当尺寸变化时同步尺寸并触发外部重绘 */
  private setupResizeListener(onResize: () => void) {
    if (!this.canvas) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.syncCanvasSize();
      onResize();
    });
    this.resizeObserver.observe(this.canvas);
  }

  /** 销毁 ResizeObserver，释放资源 */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }
}

/**
 * 时间轴水平拖拽：按下 canvas 后移动鼠标修改 offset
 * mousemove / mouseup 绑定在 window 上，保证移出 canvas 仍可继续拖拽
 */
class TimeAxisOffsetDrag {
  /** 绑定事件的 canvas 元素 */
  private canvas: HTMLCanvasElement;
  /** 拖拽时的位移增量回调：单位为鼠标像素 dx */
  private onOffsetDelta: (dx: number) => void;
  /** 拖拽开始时的可选回调 */
  private onDragStart?: () => void;
  /** 是否处于拖拽状态 */
  private isDragging = false;
  /** 上一次鼠标按下/移动时的 clientX，用于计算 dx */
  private lastX = 0;

  /**
   * @param canvas 绑定 mousedown 的 canvas
   * @param onOffsetDelta 拖拽时的 dx 回调（由外部映射到时间偏移）
   * @param onDragStart 拖拽开始回调（可选，用于停止动画等）
   */
  constructor(
    canvas: HTMLCanvasElement,
    onOffsetDelta: (dx: number) => void,
    onDragStart?: () => void,
  ) {
    this.canvas = canvas;
    this.onOffsetDelta = onOffsetDelta;
    this.onDragStart = onDragStart;
    // mousedown 绑定在 canvas 上；mousemove/mouseup 绑定在 window 上以支持拖出 canvas 继续拖拽
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
  }

  /** 处理按下：开启拖拽并开始监听全局 mousemove/mouseup */
  private handleMouseDown = (e: MouseEvent) => {
    this.onDragStart?.();
    this.isDragging = true;
    this.lastX = e.clientX;
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  };

  /** 处理移动：根据 clientX 差值计算 dx 并回调给外部 */
  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.onOffsetDelta(dx);
  };

  /** 处理抬起：结束拖拽并移除全局事件监听 */
  private handleMouseUp = () => {
    this.isDragging = false;
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  };

  /** 销毁：移除 canvas 上的 mousedown，并移除全局监听 */
  destroy() {
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }
}

/**
 * 时间轴滚轮缩放：增减 timeSpacing
 * - 绑定在 canvas 上
 * - 缩放时保持画布中心时间不变（通过 setCenterTime 重新计算 currentTime）
 */
class TimeAxisWheelZoom {
  /** 绑定 wheel 事件的 canvas 元素 */
  private canvas: HTMLCanvasElement;
  /** 读取当前 timeSpacing（px 对应的时间间隔） */
  private getTimeSpacing: () => number;
  /** 缩放回调：参数为下一次 timeSpacing + 锚点像素 anchorX */
  private onTimeSpacing: (nextTimeSpacing: number, anchorX: number) => void;

  /** timeSpacing 的最小值（ms） */
  private readonly minTimeSpacingMs: number;
  /** timeSpacing 的最大值（ms） */
  private readonly maxTimeSpacingMs: number;

  /**
   * @param canvas 绑定 wheel 事件的 canvas
   * @param getTimeSpacing 读取当前 timeSpacing 的函数
   * @param onTimeSpacing 缩放结果回调（nextTimeSpacing + 锚点 anchorX）
   * @param options 限制 timeSpacing 的取值范围（可选）
   */
  constructor(
    canvas: HTMLCanvasElement,
    getTimeSpacing: () => number,
    onTimeSpacing: (nextTimeSpacing: number, anchorX: number) => void,
    options?: { minTimeSpacingMs?: number; maxTimeSpacingMs?: number },
  ) {
    this.canvas = canvas;
    this.getTimeSpacing = getTimeSpacing;
    this.onTimeSpacing = onTimeSpacing;

    this.minTimeSpacingMs = options?.minTimeSpacingMs ?? 30 * 1000; // 30s
    this.maxTimeSpacingMs = options?.maxTimeSpacingMs ?? 24 * 60 * 60 * 1000; // 24h

    this.canvas.addEventListener("wheel", this.handleWheel, {
      passive: false,
    });
  }

  /** 处理 wheel：计算缩放比例、限制范围，并以 anchorX 作为缩放锚点 */
  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const anchorX = Math.max(0, Math.min(rect.width, rawX));

    const current = this.getTimeSpacing();
    const direction = e.deltaY > 0 ? 1 : -1;
    // 向下滚：放大（timeSpacing 变大），向上滚：缩小（timeSpacing 变小）
    const factor = direction > 0 ? 2 : 0.5;

    const next = current * factor;
    const clamped = Math.ceil(
      Math.min(this.maxTimeSpacingMs, Math.max(this.minTimeSpacingMs, next)),
    );

    if (clamped !== current) {
      this.onTimeSpacing(clamped, anchorX);
    }
  };

  /** 销毁：移除 wheel 事件监听 */
  destroy() {
    this.canvas.removeEventListener("wheel", this.handleWheel as any);
  }
}

/**
 * 鼠标时间提示：仅负责计算鼠标位置对应的时间
 * - 监听 canvas 的 mousemove / mouseleave
 * - 通知外部：显示/隐藏、canvasX、time
 */
type TimeAxisMouseTimeInfo = {
  /** 是否显示指示线/时间提示 */
  visible: boolean;
  /** 鼠标在 canvas 内的 x（像素） */
  canvasX: number;
  /** 鼠标在 canvas 内的 y（像素） */
  canvasY: number;
  /** 鼠标位置对应的时间戳（ms） */
  time: number;
};
class TimeAxisMouseTimeReporter {
  /** 绑定 mouse 事件的 canvas 元素 */
  private canvas: HTMLCanvasElement;
  /** 把 canvas 内 x（像素）转换为时间戳（ms） */
  private getTimeAtX: (x: number) => number;
  /** 把计算结果通知给外部（显示/隐藏、canvasX/canvasY/time） */
  private onNotify: (info: TimeAxisMouseTimeInfo) => void;

  /**
   * 只负责计算鼠标所在 x/y 对应的时间，并把结果通知给 TimeAxis（不直接操作 DOM）。
   */
  constructor(
    canvas: HTMLCanvasElement,
    getTimeAtX: (x: number) => number,
    onNotify: (info: TimeAxisMouseTimeInfo) => void,
  ) {
    this.canvas = canvas;
    this.getTimeAtX = getTimeAtX;
    this.onNotify = onNotify;

    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseleave", this.handleMouseLeave);
  }

  /** mousemove：计算鼠标对应时间并回调 */
  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const canvasX = Math.max(0, Math.min(rect.width, rawX));
    const rawY = e.clientY - rect.top;
    const canvasY = Math.max(0, Math.min(rect.height, rawY));
    const time = this.getTimeAtX(canvasX);

    this.onNotify({
      visible: true,
      canvasX,
      canvasY,
      time,
    });
  };

  /** mouseleave：隐藏指示信息 */
  private handleMouseLeave = () => {
    this.onNotify({
      visible: false,
      canvasX: 0,
      canvasY: 0,
      time: 0,
    });
  };

  /** 销毁：移除 canvas 上的 mouse 事件监听 */
  destroy() {
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mouseleave", this.handleMouseLeave);
  }
}

/**
 * 时间轴动画曲线：入参 `t` 为 [0, 1]，返回 eased 后的进度（也应为 [0, 1]）
 */
type TimeAxisAnimationCurve = (t: number) => number;

/**
 * 内置动画曲线（可按需在 animateCenterTimeTo options.curve 中替换）
 * - linear: 匀速
 * - easeInCubic / easeOutCubic / easeInOutQuad: 常见缓动
 */
const TimeAxisAnimationCurves = {
  linear: (t: number) => t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutQuad: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
} satisfies Record<string, TimeAxisAnimationCurve>;

class TimeAxisBase {
  /** 负责 canvas 引用、2D context 获取与尺寸同步 */
  protected canvasManager: TimeAxisCanvasManager;
  /** 鼠标拖拽：把横向像素位移映射到 currentTime 偏移 */
  private offsetDrag?: TimeAxisOffsetDrag;
  /** 鼠标滚轮缩放：调整 timeSpacing，并保持缩放锚点时间不变 */
  private wheelZoom?: TimeAxisWheelZoom;
  /** 鼠标指示：把鼠标位置映射到时间并通知外部 UI */
  private mouseTimeReporter?: TimeAxisMouseTimeReporter;
  /** 外部回调：用于更新“鼠标时间提示/指示线”状态 */
  onMouseTimeChange?: (info: TimeAxisMouseTimeInfo) => void;
  /** centerTime 动画 runId：用于取消旧动画回调（拖拽开始时立即失效） */
  private centerTimeAnimationRunId = 0;

  /** 当前时间轴的“左移/右移”基准时间（与 centerTime、画布 x 共同决定可视区间） */
  private currentTime = 1780718400000;
  /** 时间轴主刻度间隔：单位 ms */
  private timeSpacing = 5 * 60 * 1000;
  /** timeSpacing 对应的像素距离：单位 px */
  private timeSpacingInPixels = 100;

  /** 背景与坐标轴绘制样式 */
  readonly styleConfig = {
    backgroundColor: "white",
    axisColor: "black",
    textFont: "bold 12px Arial",
  };
  /** 刻度绘制比例与文本基线偏移 */
  readonly tickConfig = {
    // 刻度高度：长刻度 = 2 * 短刻度（常见比例）
    heightMinor: 10,
    heightMajor: 20,
    // 长刻度标签 y 偏移（长刻度高度 + 额外间距）
    labelOffsetY: 25,
    // 主刻度间隔内的小刻度数（把一个 timeSpacing 划分为 N 个小步）
    minorTicksPerMajor: 10,
  };

  /**
   * 创建时间轴引擎：会在构造后 `requestAnimationFrame` 初始化并开始渲染。
   * @param id canvas DOM id
   * @param onMouseTimeChange 鼠标移动时回调（用于显示/更新鼠标时间提示）
   */
  constructor(
    id: string,
    onMouseTimeChange?: (info: TimeAxisMouseTimeInfo) => void,
  ) {
    this.canvasManager = new TimeAxisCanvasManager(id);
    this.onMouseTimeChange = onMouseTimeChange;
    requestAnimationFrame(() => this.init());
  }

  /**
   * 用户自定义绘制回调：在绘制背景之后、绘制刻度之前执行
   * 可用于叠加额外图形（如指示线、事件点等）
   */
  onDrawOverlay?: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => void;

  /** 初始化交互：拖拽平移、滚轮缩放、鼠标时间通知，并触发首次绘制 */
  private init() {
    const ok = this.canvasManager.init(() => this.render());
    if (!ok) return;

    const canvas = this.canvasManager.getCanvas();
    if (!canvas) return;

    this.offsetDrag = new TimeAxisOffsetDrag(
      canvas,
      (dx) => {
        this.currentTime -= Math.round(
          (dx / this.timeSpacingInPixels) * this.timeSpacing,
        );
        this.render();
      },
      () => {
        // 拖拽开始时立即停止中心时间动画
        this.stopCenterTimeAnimation();
      },
    );

    // 滚轮缩放：保持中心时间不变
    this.wheelZoom = new TimeAxisWheelZoom(
      canvas,
      () => this.timeSpacing,
      (nextTimeSpacing, anchorX) => {
        // 以“鼠标所在 x 的时间”为锚点：缩放后让该时间仍落在同一 x 上
        const anchorTime = this.getTimeAtCanvasX(anchorX);
        this.timeSpacing = nextTimeSpacing;
        this.setTimeAtCanvasX(anchorTime, anchorX);
        this.render();
      },
    );

    this.centerTime = Date.now();
    this.mouseTimeReporter = new TimeAxisMouseTimeReporter(
      canvas,
      (x) => this.getTimeAtCanvasX(x),
      (info) => this.onMouseTimeChange?.(info),
    );

    this.render();
  }
  /** 重绘：先清理并绘制背景/叠加层，再绘制刻度与文本 */
  private render() {
    const ctx = this.canvasManager.getContext();
    if (!ctx) return;

    this.renderBackground();

    const { width, height } = this.canvasManager.getSize();
    this.onDrawOverlay?.(ctx, width, height);

    this.renderAxis();
  }

  /** 绘制背景（清屏 + 填充背景色） */
  private renderBackground() {
    const ctx = this.canvasManager.getContext();
    const { width, height } = this.canvasManager.getSize();
    const { backgroundColor } = this.styleConfig;
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }
  /** 绘制刻度与时间标签（按当前可视区间计算 start/end） */
  private renderAxis() {
    const ctx = this.canvasManager.getContext();
    if (!ctx) return;

    const {
      timeSpacing,
      timeSpacingInPixels,
      styleConfig: { textFont, axisColor },
      tickConfig: {
        minorTicksPerMajor,
        heightMajor,
        heightMinor,
        labelOffsetY,
      },
    } = this;
    const { startTimeMs, startX, endX } = this.axisDrawingRange;

    ctx.fillStyle = axisColor;
    ctx.font = textFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const minorStep = timeSpacingInPixels / minorTicksPerMajor;

    let currentTime = startTimeMs;
    let tickIndex = 0;
    let x = startX;

    while (x <= endX) {
      const isMajor = tickIndex % minorTicksPerMajor === 0;
      const tickHeight = isMajor ? heightMajor : heightMinor;
      ctx.fillRect(x, 0, 1, tickHeight);
      if (isMajor) {
        const text = _Format_Timestamp(currentTime, "MM-DD hh:mm:ss");
        ctx.fillText(text, x, labelOffsetY);
        currentTime += timeSpacing;
      }
      x += minorStep;
      tickIndex++;
    }
  }

  /**
   * 计算当前视口需要绘制的时间范围与对应像素区间。
   * 返回值用于 `renderAxis()` 中的刻度循环。
   */
  private get axisDrawingRange() {
    // 当前时间轴起点：将 currentTime 对齐到 timeSpacing 的整数倍刻度
    // 并计算在当前画布宽度范围内需要绘制的起止时间/像素位置
    const { currentTime, timeSpacing, timeSpacingInPixels } = this;
    const { width } = this.canvasManager.getSize();

    // 当前时间相对刻度的偏移（ms）
    const tickOffsetMs = currentTime % timeSpacing;
    // 当前偏移对应的像素偏移（px）
    const tickOffsetPx = Math.round(
      (tickOffsetMs / timeSpacing) * timeSpacingInPixels,
    );

    // 当前左侧需要绘制的刻度时间（ms，已对齐到刻度）
    const startTimeMs = currentTime - tickOffsetMs;
    // 根据画布宽度推算右侧需要覆盖到的刻度时间（ms，向上取整确保覆盖）
    const visibleTickSteps = width / timeSpacingInPixels; // 当前画布内可显示的“刻度步数（像素单位换算）”
    const endTimeMs =
      Math.ceil((currentTime + visibleTickSteps * timeSpacing) / timeSpacing) *
      timeSpacing;

    // 起止像素：从起始像素 tickOffsetPx 出发，按时间跨度换算为像素
    const endX =
      -tickOffsetPx +
      ((endTimeMs - startTimeMs) / timeSpacing) * timeSpacingInPixels;

    return {
      startTimeMs,
      startX: -tickOffsetPx,
      endX,
    };
  }

  /** 获取当前画布中心点对应的时间戳（ms） */
  private get centerTime() {
    const { width } = this.canvasManager.getSize();
    return (
      this.currentTime +
      (width / 2 / this.timeSpacingInPixels) * this.timeSpacing
    );
  }
  /** 设置中心时间戳，并据此反推 currentTime 以保持时间视图正确 */
  private set centerTime(centerTime: number) {
    const { width } = this.canvasManager.getSize();
    const { timeSpacing, timeSpacingInPixels } = this;
    this.currentTime =
      centerTime - (width / 2 / timeSpacingInPixels) * timeSpacing;
  }

  /** 把画布内 x 像素换算为时间戳（ms） */
  getTimeAtCanvasX(x: number) {
    return this.currentTime + (x / this.timeSpacingInPixels) * this.timeSpacing;
  }

  /** 反向把时间与像素 x 绑定，调整 currentTime 使两者一致 */
  private setTimeAtCanvasX(time: number, x: number) {
    this.currentTime = time - (x / this.timeSpacingInPixels) * this.timeSpacing;
  }
  /** 把时间戳（ms）换算为画布内 x 像素 */
  getCanvasXAtTime(time: number) {
    return (
      ((time - this.currentTime) / this.timeSpacing) * this.timeSpacingInPixels
    );
  }

  /**
   * 以动画方式把时间轴中心时间移动到目标值。
   * 用户交互（拖拽/滚轮）会通过 runId 机制取消旧动画回调。
   */
  animateCenterTimeTo(
    targetCenterTime: number,
    options?: {
      /** 动画持续的帧数（数值越大越“慢”、越容易感受到快慢） */
      durationFrames?: number;
      /** 动画曲线：入参 t∈[0,1]，出参 easedT∈[0,1] */
      curve?: TimeAxisAnimationCurve;
    },
  ) {
    const startCenterTime = this.centerTime;
    // offset 的符号用于把 easedT 映射回 centerTime：easedT=0 -> start，easedT=1 -> target
    const offset = startCenterTime - targetCenterTime;
    if (!offset) return;

    const runId = ++this.centerTimeAnimationRunId;

    const durationFrames =
      options?.durationFrames ??
      (() => {
        // 默认时长：根据位移大小动态计算，并限制在 0.5s ~ 5s
        // 位移单位：timeSpacing（一个 timeSpacing 对应一段时间轴“主刻度”间隔）
        const offsetAbs = Math.abs(offset);
        const shiftUnits = offsetAbs / this.timeSpacing;

        // 每跨越 1 个 timeSpacing 增加 0.25s，避免动画过快或过慢
        const durationSecondsUnclamped = shiftUnits * 0.25;
        const durationSeconds = Math.min(
          5,
          Math.max(0.5, durationSecondsUnclamped),
        );

        // _Animate_NumericTransition 使用帧数作为时间参数（这里按 60fps 近似）
        return Math.max(1, Math.round(durationSeconds * 60));
      })();

    const curve = options?.curve ?? TimeAxisAnimationCurves.easeInOutQuad;

    _Animate_NumericTransition(
      0,
      1,
      durationFrames,
      (v) => {
        const easedT = curve(Math.min(1, Math.max(0, v)));

        if (runId !== this.centerTimeAnimationRunId) return;
        this.centerTime = startCenterTime - offset * easedT;

        this.render();
      },
      4,
    );
  }

  /** 递增 runId，使正在进行的中心时间动画回调失效 */
  private stopCenterTimeAnimation() {
    this.centerTimeAnimationRunId++;
  }

  /** 销毁：清理交互监听器与释放 canvas 资源 */
  destroy() {
    this.offsetDrag?.destroy();
    this.wheelZoom?.destroy();
    this.mouseTimeReporter?.destroy();
    this.canvasManager.destroy();
  }
}

/**
 * 给使用方的绘制辅助类（Overlay 绘制）
 * - 封装 time <-> x 的换算
 * - 提供常用图形绘制方法（如按时间范围画圆角矩形）
 */
export class _Canvas_TimeAxis extends TimeAxisBase {
  /**
   * 按时间范围绘制圆角矩形（常用于高亮某段时间区间）
   */
  drawTimeRangeRoundedRect(options: {
    /** 区间起点时间戳（ms） */
    startTimeMs: number;
    /** 区间终点时间戳（ms） */
    endTimeMs: number;
    /** 矩形 y 坐标（像素，默认 1） */
    y?: number;
    /** 矩形高度（像素，默认使用画布高度 - 1） */
    height?: number;
    /** 圆角半径：可为单值或 canvas roundRect 支持的数组（默认 10） */
    radius?: number | number[];
    /** 填充色：不传则不填充 */
    fillStyle?: string;
    /** 描边色：不传则不描边 */
    strokeStyle?: string;
    /** 描边线宽（默认 1） */
    lineWidth?: number;
  }) {
    const ctx = this.canvasManager.getContext();
    if (!ctx) return;
    const size = this.canvasManager.getSize();
    const {
      startTimeMs,
      endTimeMs,
      y = 1,
      height = size.height - 1,
      radius = 10,
      fillStyle = "#2080f029",
      strokeStyle = "#2080f0",
      lineWidth = 1,
    } = options;

    const x1 = this.getCanvasXAtTime(startTimeMs);
    const x2 = this.getCanvasXAtTime(endTimeMs);
    const w = x2 - x1;
    if (!w) return;

    if (fillStyle) ctx.fillStyle = fillStyle;
    if (strokeStyle) ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    // Canvas 2D 新接口，现代浏览器支持；不支持时退化为普通 rect
    if (typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(x1, y, w, height - y, radius);
    } else {
      ctx.rect(x1, y, w, height - y);
    }

    if (fillStyle) ctx.fill();
    if (strokeStyle) ctx.stroke();
  }
}

export default _Canvas_TimeAxis;


