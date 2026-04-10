import { PAPER_SIZE_DEFINITIONS, PaperType, WindowTarget } from "../Constant";
import { _Utility_GenerateUUID, _Utility_WaitForCondition } from "../Utility";
import { ChannelMessage, ChannelMessageType } from "./type";

export * from "./Runtime";

/**
 * 获取帧率
 * @param {(fps , frameTime)=>void} callback callback( 帧率 , 每帧时间 )
 * @param {Number} referenceNode 参考节点数量
 */
export function _Browser_GetFrameRate(
  callback: (fps: number, frameTime: number) => void,
  referenceNode = 10
) {
  let t = 0,
    l = referenceNode;
  function loop() {
    if (l > 0) {
      l--;
      requestAnimationFrame(loop);
    } else {
      const time = Date.now() - t;
      const frameTime = time / referenceNode;
      const fps = 1000 / frameTime;
      callback(Number(fps.toFixed(2)), Number(frameTime.toFixed(2)));
    }
  }
  requestAnimationFrame(() => {
    t = Date.now();
    loop();
  });
}

/**
 * 复制到剪贴板
 * @param {string} text
 */
export function _Browser_CopyToClipboard(text: string) {
  const handleSuccess = () => Promise.resolve();
  const handleError = (error: string) => {
    console.error(error);
    return Promise.reject(error);
  };

  /** 最新方式 */
  function writeText() {
    return navigator.clipboard
      .writeText(text)
      .then(handleSuccess)
      .catch(handleError);
  }
  /** 旧方式 - createRange */
  function createRange() {
    const div = document.createElement("div");
    div.innerText = text;
    document.body.appendChild(div);

    const range = document.createRange();
    range.selectNodeContents(div);
    const selection = window.getSelection();

    let isFinished = false;
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);

      isFinished = document.execCommand("copy");
    }
    document.body.removeChild(div);
    return isFinished ? Promise.resolve() : Promise.reject();
  }
  /** 旧方式 - execCommand */
  function execCommand() {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);

    textarea.select();
    textarea.setSelectionRange(0, text.length); // 对于移动设备

    let isFinished = false;

    /** aria-hidden 及 tabindex 可能会影响聚焦元素 */
    if (document.activeElement === textarea)
      isFinished = document.execCommand("Copy", true);

    document.body.removeChild(textarea);
    return isFinished ? Promise.resolve() : Promise.reject();
  }

  function old() {
    return createRange()
      .then(handleSuccess)
      .catch(() => {
        execCommand()
          .then(handleSuccess)
          .catch(() => handleError("复制方式尽皆失效"));
      });
  }

  if (navigator.clipboard) return writeText().catch(old);
  return old();
}

/**
 * 计算纸张内容可用宽高及边距（考虑设备DPI）
 * 确保：contentWidth + 2*paddingPx = 纸张宽度像素
 * @param type 纸张类型
 * @param padding 边距（毫米）
 * @returns {
 *   contentWidth: number;  // 内容可用宽度(px)
 *   contentHeight: number; // 内容可用高度(px)
 *   paddingPx: number;     // 边距(px) - 单边值
 *   paperWidthPx: number;  // 纸张总宽度(px)
 *   paperHeightPx: number; // 纸张总高度(px)
 * }
 */
export function _Browser_CalculatePrintableArea(
  type: PaperType,
  padding: number
) {
  // 获取纸张基础尺寸
  const paper = PAPER_SIZE_DEFINITIONS[type];
  if (!paper) return console.error(`未知纸张类型: ${type}`);

  const { width: paperWidthMM, height: paperHeightMM } = paper;

  // 毫米转英寸（1英寸=25.4毫米）
  const mmToInch = (mm: number) => mm / 25.4;

  // 获取设备DPI
  const getDeviceDPI = () => {
    if (typeof window !== "undefined") {
      return window.devicePixelRatio * 96;
    }
    return 300; // Node.js/打印环境
  };

  const dpi = getDeviceDPI();

  // 辅助函数：毫米转像素（带四舍五入）
  const mmToPx = (mm: number) => Math.round(mmToInch(mm) * dpi);

  // 1. 先计算整个纸张的像素尺寸
  const paperWidthPx = mmToPx(paperWidthMM);
  const paperHeightPx = mmToPx(paperHeightMM);

  // 2. 计算边距像素值（单边）
  const paddingPx = mmToPx(padding);

  // 3. 基于纸张像素尺寸计算内容区域（确保没有累积误差）
  const contentWidth = Math.max(0, paperWidthPx - 2 * paddingPx);
  const contentHeight = Math.max(0, paperHeightPx - 2 * paddingPx);

  return {
    /** 内容宽度（像素） */
    contentWidth,
    /** 内容高度（像素） */
    contentHeight,
    /** 边距（像素） */
    paddingPx,
    /** 纸张宽度（像素） */
    paperWidthPx,
    /** 纸张高度（像素） */
    paperHeightPx,
  };
}


/** 同源标签页管理器类 */
export class _Browser_SameOriginTabManager {
  /** 初始化完成标志 */
  private static initFinish = false;
  /** 频道 */
  private static channel = new BroadcastChannel("nhanh-pure-function");

  /** 等待回执消息时间上限（上限） */
  static timeout = 150;

  /**
   * 待处理查询
   * @param key 回执消息key
   * @param callback 匹配标签页的回调函数
   */
  private static pendingQueries = new Map<
    string,
    ((tabName: string) => void)[]
  >();

  private constructor() { }

  /** 初始化标签页管理器 */
  static init(name: string) {
    if (!name) return console.error("标签页名称不能为空");
    if (!this.initFinish) {
      this.setupEventListeners();
      this.initFinish = true;
    }
    window.name = name;
  }

  /** 设置事件监听器 */
  private static setupEventListeners() {
    this.channel.addEventListener(
      "message",
      (event: MessageEvent<ChannelMessage>) => {
        this.handleChannelMessage(event);
      }
    );
  }

  /** 处理BroadcastChannel消息 */
  private static handleChannelMessage(
    event: MessageEvent<ChannelMessage>
  ): void {
    const { type, responseKey, name } = event.data;

    if (type === ChannelMessageType.RESPONSE) {
      const queryCallbacks = this.pendingQueries.get(responseKey);
      queryCallbacks?.forEach((callback) => callback(name));
    } else if (type === ChannelMessageType.QUERY) {
      if (this.pendingQueries.has(responseKey)) return;
      if (name != "*" && name != window.name) return;

      const message: ChannelMessage = {
        type: ChannelMessageType.RESPONSE,
        responseKey,
        name: window.name,
      };
      this.channel.postMessage(message);
    }
  }

  /**
   * 获取已经打开的指定名称的标签页
   * @param name 标签页名称
   */
  static getWindow(name: string) {
    if (!this.initFinish) {
      const msg = "请先初始化标签页管理器";
      console.error(msg);
      return Promise.reject(msg);
    }

    const responseKey = _Utility_GenerateUUID();

    let isReplied = false;

    const queryCallbacks = this.pendingQueries.get(responseKey) || [];
    queryCallbacks.push(() => (isReplied = true));

    this.pendingQueries.set(responseKey, queryCallbacks);

    const message: ChannelMessage = {
      type: ChannelMessageType.QUERY,
      responseKey,
      name,
    };

    this.channel.postMessage(message);

    return _Utility_WaitForCondition(() => isReplied, this.timeout).finally(
      () => this.pendingQueries.delete(responseKey)
    );
  }

  /** 打开标签页 */
  static openWindow(
    name: string,
    url: string,
    target: WindowTarget = "_blank",
    windowFeatures?: string
  ) {
    if (!this.initFinish) {
      const msg = "请先初始化标签页管理器";
      console.error(msg);
      return Promise.reject(msg);
    }

    return this.getWindow(name)
      ?.then(() => window.open("javascript:;", name))
      .catch(() => {
        const win = window.open(url, target, windowFeatures);
        if (!win) console.error("无法打开标签页");
        return win;
      });
  }

  /** 获取所有已经打开的标签页 */
  static getAllWindows(): Promise<string[]> {
    if (!this.initFinish) {
      const msg = "请先初始化标签页管理器";
      console.error(msg);
      return Promise.reject(msg);
    }

    const responseKey = _Utility_GenerateUUID();

    const tabs: string[] = [];

    const queryCallbacks = this.pendingQueries.get(responseKey) || [];
    queryCallbacks.push((tab) => tabs.push(tab));

    this.pendingQueries.set(responseKey, queryCallbacks);

    const message: ChannelMessage = {
      type: ChannelMessageType.QUERY,
      responseKey,
      name: "*",
    };

    this.channel.postMessage(message);

    return new Promise((reslove) => {
      setTimeout(() => {
        this.pendingQueries.delete(responseKey);
        reslove(tabs);
      }, this.timeout);
    });
  }
}

/**
 * 无操作（闲置）检测类
 * 监听用户键盘、鼠标操作，更新用户活跃状态
 * 支持注册/触发活跃/闲置状态的回调通知
 */
export class _Browser_IdleDetection {
  /** 用户状态：active(活跃) / idle(闲置) */
  status: "active" | "idle" = "active";

  /** 活跃状态回调通知集合（key: 回调标识，value: 回调函数） */
  readonly activeCallbacks = new Map<string, () => void>();

  /** 闲置状态回调通知集合（key: 回调标识，value: 回调函数） */
  readonly idleCallbacks = new Map<string, () => void>();

  /** 闲置时间（分钟） */
  idleTime = 5;
  /** 闲置判定定时器（5分钟无操作触发闲置状态） */
  private timeoutTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // 监听用户操作事件，触发活跃状态
    window.addEventListener("keypress", this.activate);
    window.addEventListener("mousemove", this.activate);
    window.addEventListener("mousedown", this.activate);
    window.addEventListener("wheel", this.activate);

    // 初始化定时器（页面加载后开始计时）
    this.resetTimeoutTimer();
  }

  /**
   * 重置闲置判定定时器
   * 每次用户操作时重置，重新开始5分钟计时
   */
  resetTimeoutTimer() {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(this.markAsIdle, 1000 * 60 * this.idleTime);
  }

  /**
   * 激活为活跃状态
   * 触发活跃回调，并重置定时器
   */
  private activate = () => {
    if (this.status === "idle") {
      this.status = "active";
      console.log(
        "%c已进入活跃状态",
        "background: #4CAF50; color: white; padding: 2px 4px; border-radius: 4px; font-weight: bold;",
      );
      this.activeCallbacks.forEach((callback) => callback());
    }
    this.resetTimeoutTimer();
  };

  /**
   * 标记为闲置状态
   * 触发闲置回调，并清除定时器
   */
  private markAsIdle = () => {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    if (this.status === "active") {
      this.status = "idle";
      console.log(
        "%c已进入闲置状态",
        "background: #9E9E9E; color: white; padding: 2px 4px; border-radius: 4px; font-weight: bold;",
      );
      this.idleCallbacks.forEach((callback) => callback());
    }
  };
}