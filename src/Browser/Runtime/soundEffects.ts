/** 资源映射类型 */
type Resource<T extends string> = Record<T, string>;

/** 播放配置 */
interface PlayOptions {
  /** 是否无限循环播放 */
  loop?: boolean;
  /** 循环次数（优先级高于 loop，最少为 1 次） */
  loopCount?: number;
}

/** 构造选项 */
interface SoundEffectsOptions<T extends string> {
  /**
   * 初始化时即 fetch 下载为 Blob，并将 `soundSources` 中对应 key 的地址替换为 blob URL
   */
  holdKeys?: readonly T[];
}

/**
 * 音效管理类
 * 负责音效的加载与播放
 */
export class _Browser_SoundEffects<T extends string> {
  /** 音效资源地址映射（preload 成功后对应项会替换为 blob: URL） */
  private soundSources: Resource<T>;

  /** 各 key 下载任务，避免重复发起 */
  private readonly preloadTasks = new Map<T, Promise<void>>();

  constructor(resource: Resource<T>, options?: SoundEffectsOptions<T>) {
    this.soundSources = { ...resource };
    const holdKeys = options?.holdKeys;
    if (holdKeys?.length) {
      for (const key of holdKeys) {
        void this.fetchAndReplaceSource(key);
      }
    }
  }

  /**
   * 下载指定 key 的音频为 Blob，并将 `soundSources[key]` 替换为 `URL.createObjectURL` 结果（与 holdKeys 同一逻辑）
   */
  preload(key: T): Promise<void>;
  preload(keys: readonly T[]): Promise<void>;
  preload(keyOrKeys: T | readonly T[]): Promise<void> {
    const keys = (Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) as T[];
    return Promise.all(keys.map((k) => this.fetchAndReplaceSource(k))).then(
      () => undefined,
    );
  }

  private fetchAndReplaceSource(key: T): Promise<void> {
    const cached = this.preloadTasks.get(key);
    if (cached) return cached;

    const url = this.soundSources[key];
    if (!url) {
      return Promise.reject(new Error(`未找到对应音效资源: ${String(key)}`));
    }

    if (url.startsWith("blob:")) {
      const done = Promise.resolve();
      this.preloadTasks.set(key, done);
      return done;
    }

    const task = fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`音效下载失败: ${res.status} ${url}`);
        }
        return res.blob();
      })
      .then((blob) => {
        const prev = this.soundSources[key];
        const objectUrl = URL.createObjectURL(blob);
        this.soundSources[key] = objectUrl;
        if (prev.startsWith("blob:") && prev !== objectUrl) {
          URL.revokeObjectURL(prev);
        }
      })
      .catch((err) => {
        this.preloadTasks.delete(key);
        throw err instanceof Error ? err : new Error(String(err));
      });

    this.preloadTasks.set(key, task);
    return task;
  }

  /**
   * 根据 key 播放音效
   * @param key 资源 key
   * @param options 播放配置（循环等）
   */
  play(key: T, options?: PlayOptions) {
    const source = this.soundSources[key];

    if (!source) {
      console.warn(`未找到对应音效资源: ${String(key)}`);
      return () => { };
    }

    return this.playUrl(source, options);
  }

  /**
   * 根据 URL 播放音效
   * @param url 音频地址
   * @param options 播放配置（循环等）
   * @returns 停止播放的方法
   */
  playUrl(url: string, options?: PlayOptions) {
    if (!url) {
      console.error("音效资源地址为空");
      return;
    }

    // 创建音频实例
    const audio = new Audio(url);

    // 处理循环参数
    const normalizedLoopCount =
      options?.loopCount !== undefined && options.loopCount > 0
        ? options.loopCount
        : undefined;
    const isInfiniteLoop = options?.loop && normalizedLoopCount === undefined;

    let playedCount = 0;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener("ended", handleEnded);
      audio.onerror = null;
    };

    const handleEnded = () => {
      if (stopped) return;

      // 无限循环
      if (isInfiniteLoop) {
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn("循环音效再次播放失败:", err);
          stop();
        });
        return;
      }

      // 按次数循环
      if (
        normalizedLoopCount !== undefined &&
        playedCount + 1 < normalizedLoopCount
      ) {
        playedCount += 1;
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn("循环音效再次播放失败:", err);
          stop();
        });
        return;
      }

      stop();
    };

    audio.addEventListener("ended", handleEnded);

    // 音频加载失败回调
    audio.onerror = () => {
      if (stopped) return;
      console.error(`音效资源加载失败: ${url}`);
      stop();
    };

    // 处理自动播放策略限制
    audio.play().catch((playError) => {
      if (stopped) return;
      console.warn(`音效播放失败（可能是自动播放策略限制）:`, playError);
      stop();
    });

    return stop;
  }
}
