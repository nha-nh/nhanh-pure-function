/** 仅将 source 中非 undefined 的属性写入 target */
function assignDefined<T extends object>(target: T, source: Partial<T>): void {
  for (const key of Object.keys(source) as (keyof T)[]) {
    if (source[key] !== undefined) {
      (target as Record<keyof T, unknown>)[key] = source[key];
    }
  }
}

/** ping 配置 */
interface WebSocketClientPingConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 间隔（毫秒） */
  interval?: number;
  /** 发送内容 */
  content?: string;
}

/** WebSocket 客户端配置 */
interface WebSocketClientConfig {
  url?: string;
  /** true 启用并采用默认参数，或传入具体配置 */
  ping?: boolean | WebSocketClientPingConfig;
  /** 最大重试次数，默认 3 */
  maxRetryCount?: number;
  /** 重试间隔（毫秒），默认 1000 */
  retryInterval?: number;
}

/** WebSocket客户端 */
export class _Browser_WebSocketClient {
  /** WebSocket地址 */
  url?: string;
  /** WebSocket实例 */
  private socket?: WebSocket;
  /** 连接回调 */
  onopen?: (ev: Event) => any;
  /** 接收消息回调 */
  onmessage?: (ev: MessageEvent) => any;
  /** 错误回调 */
  onerror?: (ev: Event) => any;
  /** 关闭回调 */
  onclose?: (ev: CloseEvent) => any;

  /** ping 配置 */
  readonly pingConfig = {
    /** 是否启用 */
    enabled: false,
    /** 间隔（毫秒） */
    interval: 1000 * 30,
    /** 发送内容 */
    content: "ping",
  };
  /** ping 定时器 */
  private pingTimer?: ReturnType<typeof setInterval>;

  /** 重试配置 */
  readonly retryConfig = {
    /** 最大次数 */
    maxCount: 3,
    /** 当前次数 */
    currentCount: 0,
    /** 间隔（毫秒） */
    interval: 1000,
  };

  /** 是否准备完毕 */
  get ready() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  constructor(config?: WebSocketClientConfig) {
    if (!config) return;
    const { url, ping, maxRetryCount, retryInterval } = config;
    if (ping !== undefined) {
      if (typeof ping === "boolean") this.pingConfig.enabled = ping;
      else assignDefined(this.pingConfig, ping);
    }
    assignDefined(this.retryConfig, {
      maxCount: maxRetryCount,
      interval: retryInterval,
    });
    if (url) this.start(url);
  }

  /** 开始ping */
  private startPing() {
    const { interval, content, enabled } = this.pingConfig;
    if (!enabled) return;
    this.pingTimer = setInterval(() => {
      if (this.ready) {
        this.socket?.send(content);
      } else {
        console.warn("WebSocket未就绪，无法发送ping");
      }
    }, interval);
  }
  /** 开始重试 */
  private startRetry() {
    const { maxCount, interval, currentCount } = this.retryConfig;
    if (maxCount <= currentCount) {
      console.error("WebSocket重试次数已用完");
      this.retryConfig.currentCount = 0;
      return;
    }
    this.retryConfig.currentCount++;
    setTimeout(() => this.start(this.url!), interval);
  }
  /** 开始 */
  start(url: string) {
    const socket = new WebSocket(url);
    this.socket = socket;
    this.url = url;

    socket.onopen = (ev) => {
      console.log("WebSocket已连接");
      this.startPing();
      this.retryConfig.currentCount = 0;
      this.onopen?.(ev);
    };

    socket.onmessage = (ev) => {
      this.onmessage?.(ev);
    };

    socket.onerror = (err) => {
      console.error("WebSocket错误:", err);
      clearInterval(this.pingTimer);
      this.startRetry();
      this.onerror?.(err);
    };

    socket.onclose = (ev) => {
      console.log("WebSocket已关闭");
      clearInterval(this.pingTimer);
      this.onclose?.(ev);
    };
  }
  /** 停止 */
  stop() {
    this.socket?.close();
    this.socket = undefined;
  }
  /** 发送信息 */
  send: WebSocket["send"] = (data) => {
    if (!this.ready) return false;
    this.socket?.send(data);
    return true;
  };
}
