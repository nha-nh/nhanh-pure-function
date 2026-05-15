import { _Valid_DataType } from "../Valid";
import {
  _parsePathSegments,
  ARRAY_PART_REGEX,
  ARRAY_PATH_REGEX,
  INDEX_EXTRACT_REGEX,
} from "./type";

/**
 * 寻找空闲时机执行传入方法
 * @param callback  需执行的方法
 * @param timeout 超时时间
 */
export function _Utility_ExecuteWhenIdle(
  callback: (deadline?: IdleDeadline) => void,
  timeout = 3000,
) {
  if (typeof callback !== "function")
    return console.error("非函数：", callback);

  const requestIdleCallback = window.requestIdleCallback;
  const loop = function (deadline: IdleDeadline) {
    if (deadline.timeRemaining() <= 0 && !deadline.didTimeout)
      requestIdleCallback(loop, { timeout });
    else callback(deadline);
  };

  if (requestIdleCallback) requestIdleCallback(loop, { timeout });
  else requestAnimationFrame(() => callback());
}

/**
 * 等待条件满足
 * @param conditionChecker 条件检查器
 * @param timeoutMillis 超时毫秒数
 * @returns Promise<number> 耗时
 */
export function _Utility_WaitForCondition(
  conditionChecker: () => boolean,
  timeoutMillis: number,
): Promise<number> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const checkCondition = () => {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= timeoutMillis) return reject(elapsedTime);
      if (conditionChecker()) return resolve(elapsedTime);

      requestAnimationFrame(checkCondition);
    };
    checkCondition();
  });
}

/**
 * 合并对象  注意: 本函数会直接操作 A
 * @param {Object | Array} A
 * @param {Object | Array} B
 * @returns (A & B) | A | B | undefined
 */
export function _Utility_MergeObjects<T, T1>(
  A: T,
  B: T1,
  visitedObjects: [any, any][] = [],
  outTime = Date.now(),
): (T & T1) | T | T1 | undefined {
  /** 疑似死循环 */
  if (outTime < Date.now() - 50) {
    console.error("_MergeObjects 合并异常：疑似死循环");
    return undefined;
  }

  const TA = _Valid_DataType(A);
  const TB = _Valid_DataType(B);

  if (TA != TB) return B;

  if (TA == "object" || TA == "array") {
    if (visitedObjects.some(([a, b]) => a == A && b == B)) return A;
    visitedObjects.push([A, B]);

    if (TA == "object") {
      for (const key in B) {
        if (Object.prototype.hasOwnProperty.call(B, key)) {
          const BC = B[key];
          /** @ts-ignore */
          const AC = A[key];
          const fianlValue = _Utility_MergeObjects(
            AC,
            BC,
            visitedObjects,
            outTime,
          );
          /** @ts-ignore */
          A[key] = fianlValue;
        }
      }
      return A;
    } else if (TA == "array") {
      /** @ts-ignore */
      B.forEach((item, index) => {
        const BC = item;
        /** @ts-ignore */
        const AC = A[index];
        const fianlValue = _Utility_MergeObjects(
          AC,
          BC,
          visitedObjects,
          outTime,
        );
        /** @ts-ignore */
        A[index] = fianlValue;
      });
      return A;
    }
  } else return B;
}

/**
 * 生成一个UUID（通用唯一标识符）字符串
 * 可以选择性地在UUID前面添加前缀
 *
 * @param {string} prefix - 可选参数，要添加到UUID前面的前缀
 * @returns {string} 一个带有可选前缀的UUID字符串
 */
export function _Utility_GenerateUUID(prefix = "") {
  return (
    prefix +
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0; // 随机生成一个0到15的数
      const v = c === "x" ? r : (r & 0x3) | 0x8; // 对于'y'位, v = (r & 0x3 | 0x8) 确保变体正确
      return v.toString(16); // 将数字转换为16进制
    })
  );
}

/**
 * 防抖
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function _Utility_Debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined; // 清除后重置为 null
    }, delay);
  };
}

/**
 * 节流
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function _Utility_Throttle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let lastCallTime = -Infinity;

  return function (...args) {
    const now = performance.now();
    if (now - lastCallTime > delay) {
      lastCallTime = now;
      try {
        fn(...args);
      } catch (error) {
        console.error("Throttled function execution failed:", error);
      }
    }
  };
}

/**
 * 根据路径从对象中获取目标值
 * @param rootObject - 根对象
 * @param path - 访问路径，支持点号和数组索引语法（如 "a1.b2[0].c3"）
 * @returns 目标值，如果路径无效则返回根对象
 */
export function _Utility_GetTargetByPath(rootObject: any, path: string): any {
  if (!rootObject || !path) return rootObject;

  const pathSegments = _parsePathSegments(path);
  if (!pathSegments.length) return rootObject;

  // 遍历路径段，逐层访问对象属性
  return pathSegments.reduce((currentObj, segment, segmentIndex) => {
    const isFinalSegment = segmentIndex === pathSegments.length - 1;

    // 处理数组路径段（包含索引的路径段）
    if (ARRAY_PATH_REGEX.test(segment)) {
      const pathParts = segment.match(ARRAY_PART_REGEX) || [];

      // 遍历路径段内的各个部分（属性名和索引）
      return pathParts.reduce((currentPart, part, partIndex) => {
        // 处理属性名部分 (如 "items")
        if (/^\w+$/.test(part)) {
          return (
            currentPart[part] || (partIndex < pathParts.length - 1 ? [] : {})
          );
        }

        // 处理数组索引 (如 "[0]")
        const indexMatch = part.match(INDEX_EXTRACT_REGEX);
        const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;
        const isFinalPart = partIndex === pathParts.length - 1;

        if (isFinalPart && isFinalSegment) {
          return currentPart[index]; // 最终值直接返回
        }

        // 初始化中间结构
        return currentPart[index] || (isFinalPart ? {} : []);
      }, currentObj);
    }

    // 处理普通属性路径段
    return isFinalSegment
      ? currentObj[segment] // 最终值
      : currentObj[segment] || {}; // 中间对象
  }, rootObject);
}

/**
 * 根据路径设置对象中的目标值
 * @param rootObject - 根对象
 * @param path - 访问路径，支持点号和数组索引语法（如 "a1.b2[0].c3"）
 * @param value - 要设置的值
 * @param skipIfExists - 如果为true，当目标位置已有值时跳过设置
 * @returns 设置后的根对象
 */
export function _Utility_SetTargetByPath(
  rootObject: any,
  path: string,
  value: any,
  skipIfExists?: boolean,
): any {
  if (!rootObject || !path) return value;

  const pathSegments = _parsePathSegments(path);
  if (!pathSegments.length) return value;

  // 遍历路径段，逐层创建对象结构并设置值
  return pathSegments.reduce((currentObj, segment, segmentIndex) => {
    const isFinalSegment = segmentIndex === pathSegments.length - 1;

    // 处理数组路径段（包含索引的路径段）
    if (ARRAY_PATH_REGEX.test(segment)) {
      const pathParts = segment.match(ARRAY_PART_REGEX) || [];

      // 遍历路径段内的各个部分（属性名和索引）
      return pathParts.reduce((currentPart, part, partIndex) => {
        const isFinalPart = partIndex === pathParts.length - 1;

        // 处理属性名部分
        if (/^\w+$/.test(part)) {
          if (!currentPart.hasOwnProperty(part)) {
            currentPart[part] = []; // 初始化数组
          }
          return currentPart[part];
        }

        // 处理数组索引
        const indexMatch = part.match(INDEX_EXTRACT_REGEX);
        const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;
        const shouldSetValue = isFinalPart && isFinalSegment;

        // 初始化或设置值
        if (!currentPart.hasOwnProperty(index)) {
          currentPart[index] = shouldSetValue ? value : isFinalPart ? {} : [];
        } else if (shouldSetValue && !skipIfExists) {
          currentPart[index] = value;
        }

        return currentPart[index];
      }, currentObj);
    }

    // 处理普通属性路径段
    if (isFinalSegment) {
      if (!skipIfExists || !currentObj.hasOwnProperty(segment)) {
        currentObj[segment] = value;
      }
      return currentObj[segment];
    }

    if (!currentObj.hasOwnProperty(segment)) {
      currentObj[segment] = {};
    }
    return currentObj[segment];
  }, rootObject);
}

/**
 * 旋转列表函数
 *
 * 该函数接受一个列表作为参数，并返回一个二维数组，其中每个内部数组都是原列表的一种旋转形式
 * 旋转列表的原理是将原列表分割成两部分，并将这两部分重新组合，形成一个新的列表
 *
 * @param list T[] - 需要旋转的列表，列表元素类型为泛型T
 * @returns T[][] - 返回一个二维数组，每个内部数组代表原列表的一种旋转形式
 */
export function _Utility_RotateList<T>(list: T[]) {
  // 使用map函数遍历列表，对于列表中的每个元素（这里不需要元素本身，所以用_表示）
  // i表示当前元素的索引，利用这个索引对列表进行分割和重组
  return list.map((_, i) => {
    // 将当前索引i之后的元素与从列表开头到索引i之前的元素拼接成一个新的列表
    // 这样做可以实现列表的旋转效果
    return list.slice(i).concat(list.slice(0, i));
  });
}

/**
 * 克隆给定值的函数
 * 该函数尝试使用window.structuredClone方法进行深克隆，如果失败则使用自定义方法
 * @param {any} val - 需要克隆的值
 * @returns {any} - 克隆后的值
 */
export function _Utility_Clone<T>(val: T) {
  // 保存原始的structuredClone方法引用
  const oldClone = window.structuredClone;

  // 深度克隆函数
  const deepClone = <T>(_value: T, referenceMap = new WeakMap()): T => {
    const value: any = _value;
    // 基本类型直接返回
    if (value === null || typeof value !== "object") {
      return value;
    }

    // 处理循环引用
    if (referenceMap.has(value)) {
      return referenceMap.get(value);
    }

    const dataType = _Valid_DataType(value);

    switch (dataType) {
      case "array": {
        const newArray: any[] = [];
        referenceMap.set(value, newArray);
        for (const item of value) {
          newArray.push(deepClone(item, referenceMap));
        }
        return newArray as T;
      }

      case "object": {
        // 处理 null（虽然前面已处理，但确保类型安全）
        if (value === null) return value;

        const newObj: Record<any, any> = {};
        referenceMap.set(value, newObj);
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            newObj[key] = deepClone(value[key], referenceMap);
          }
        }
        return newObj as T;
      }

      case "date": {
        const newDate = new Date(value.getTime());
        referenceMap.set(value, newDate);
        return newDate as T;
      }

      case "regexp": {
        const regex = value;
        const newRegex = new RegExp(regex.source, regex.flags);
        newRegex.lastIndex = regex.lastIndex;
        referenceMap.set(value, newRegex);
        return newRegex as T;
      }

      case "map": {
        const newMap = new Map();
        referenceMap.set(value, newMap);
        (value as Map<any, any>).forEach((val, key) => {
          newMap.set(
            deepClone(key, referenceMap),
            deepClone(val, referenceMap),
          );
        });
        return newMap as T;
      }

      case "set": {
        const newSet = new Set();
        referenceMap.set(value, newSet);
        (value as Set<any>).forEach((val) => {
          newSet.add(deepClone(val, referenceMap));
        });
        return newSet as T;
      }

      // 处理其他可克隆对象类型
      case "arraybuffer":
      case "dataview":
      case "int8array":
      case "uint8array":
      case "uint8clampedarray":
      case "int16array":
      case "uint16array":
      case "int32array":
      case "uint32array":
      case "float32array":
      case "float64array":
      case "bigint64array":
      case "biguint64array": {
        const typedArray = value as ArrayBufferView;
        const constructor = typedArray.constructor as new (
          buffer: ArrayBuffer,
          byteOffset?: number,
          length?: number,
        ) => typeof typedArray;

        // 克隆底层ArrayBuffer
        const buffer = typedArray.buffer.slice(
          typedArray.byteOffset,
          typedArray.byteOffset + typedArray.byteLength,
        );

        const cloned = new constructor(
          buffer as ArrayBuffer,
          typedArray.byteOffset,
          typedArray.byteLength / (typedArray as any).BYTES_PER_ELEMENT,
        );

        referenceMap.set(value, cloned);
        return cloned as T;
      }

      // 处理特殊对象类型
      case "error": {
        const error = value as Error;
        const newError = new (error.constructor as any)(error.message);
        newError.stack = error.stack;
        newError.name = error.name;
        referenceMap.set(value, newError);
        return newError as T;
      }

      // 处理不可克隆对象（直接返回原值）
      case "function":
      case "promise":
      case "weakmap":
      case "weakset":
      case "file":
      default: {
        return value;
      }
    }
  };

  // 尝试使用原始的structuredClone方法或自定义的deepClone方法进行克隆
  try {
    // 如果oldClone存在，则使用oldClone方法进行克隆，否则使用deepClone方法
    return oldClone ? oldClone(val) : deepClone(val);
  } catch (error) {
    // 使用日志系统或其他方式记录错误信息
    console.warn("structuredClone error:", error);
    // @ts-ignore 如果oldClone存在且之前的尝试失败，则再次使用deepClone方法尝试克隆
    return oldClone && deepClone(val);
  }
}

/**
 * 函数装饰器：精准测量并记录目标函数的执行耗时（单位：毫秒）
 *
 * @template T - 泛型参数，约束为任意函数类型，保证装饰器返回值类型与原函数一致
 * @param {T} func - 待测量执行时间的目标函数
 * @param {Object} [config] - 可选配置对象，用于自定义耗时测量规则
 * @param {Array<[number, string]>} [config.level] - 耗时阈值（毫秒）与控制台输出颜色的映射数组
 *                                                   规则：当函数耗时（ms）≥ level[n][0] 时，使用 level[n][1] 指定的颜色输出
 * @param {number} [config.maxHistory=30] - 执行耗时历史记录的最大保留条数，默认值为30
 * @param {string} [config.prefix] - 控制台输出耗时日志时的自定义前缀文本（可选）
 * @returns {T | void} 包装后的函数（保留原函数所有功能，新增耗时测量/记录/日志输出逻辑）；若入参非法则返回 void
 */
export function _Utility_TimeConsumption<T extends Function>(
  func: T,
  config?: {
    level?: [number, string][];
    maxHistory?: number;
    prefix?: string;
  },
): T | void {
  const defaultLevel: [number, string][] = [
    [11, "#d03050"],
    [8, "#f0a020"],
    [5, "#2080f0"],
    [2, "#18a058"],
  ];
  const { level = defaultLevel, maxHistory = 30, prefix = "" } = config || {};

  level.sort((a, b) => b[0] - a[0]);

  // 检查参数类型
  if (typeof func !== "function") {
    return console.error("第一个参数必须是一个函数。");
  }
  if (!Array.isArray(level)) {
    return console.error("第二个参数必须是一个数组。");
  }

  // 在类中添加属性
  let drawTimes: number[] = [];
  // 保留最近x次的耗时数据
  /** 平均耗时 */
  let avgTime: number = 0;

  // 定义一个辅助函数来确定颜色
  const getColor = (elapsedTime: number, level: [number, string][]) => {
    for (const [time, color] of level) {
      if (elapsedTime >= time) {
        return color;
      }
    }
    return "black"; // 默认颜色
  };

  // 返回一个闭包函数，用于执行原始函数并测量其执行时间
  const fun = (...args: any[]) => {
    // 记录开始时间
    const startTime = performance.now();

    // 执行函数
    const result = func(...args);

    // 记录结束时间并计算本次重绘的耗时
    const elapsedTime = performance.now() - startTime;

    // 将本次耗时添加到 drawTimes 数组中
    drawTimes.push(elapsedTime);

    // 如果 drawTimes 数组的长度超过最大历史记录数，移除最早的记录
    if (drawTimes.length > maxHistory) drawTimes.shift();

    // 计算平均耗时
    avgTime =
      drawTimes.reduce((sum, time) => sum + time, 0) / drawTimes.length || 0;

    // 根据单次耗时确定颜色
    const singleColor = getColor(elapsedTime, level);

    // 根据平均耗时确定颜色
    const avgColor = getColor(avgTime, level);

    // 输出带样式的日志，包含单次耗时和平均耗时
    console.log(
      `%c${prefix ? prefix + " - " : ""}单次耗时：${elapsedTime.toFixed(
        2,
      )}ms\n%c平均耗时（${drawTimes.length}次）：${avgTime.toFixed(2)}ms`,
      `color: ${singleColor}; padding: 2px 0;`,
      `color: ${avgColor}; padding: 2px 0;`,
    );

    return result;
  };
  return fun as unknown as T;
}

/**
 * 暂停执行指定毫秒数的操作
 * 此函数通过 busy-wait（忙等待）的方式实现，它会持续执行一些无用的操作以消耗时间
 * 这种方法虽然简单，但会占用CPU资源，因此不推荐在实际应用中使用
 *
 * @param ms 暂停的毫秒数
 * @returns 实际暂停的毫秒数
 */
export function _Utility_Sleep(ms: number) {
  // 记录开始时间
  const start = Date.now();
  // 初始化一个用于防优化的变量
  let dummy = performance.now();

  // 当前时间未达到指定的暂停时间时，继续执行循环
  while (Date.now() - start < ms) {
    // 复合型防优化操作
    // 通过数学运算和条件判断，防止JavaScript引擎优化掉这段无用的循环
    dummy = Math.sin(dummy) * 1e6;
    if (dummy > 1e6 || dummy < -1e6) dummy = 0;
    try {
      // 进一步的防优化操作
      // 将dummy的值转换为字符串并试图修改URL的hash值，以防止被优化
      const str = dummy.toString().substring(0, 8);
      history.replaceState(null, "", `#${str}`);
    } catch {}
  }

  // 返回实际暂停的时间
  return Date.now() - start;
}

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
    return Math.round(this.clamp(value, 0, 255))
      .toString(16)
      .padStart(2, "0");
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
    return `#${this.toHexPart(r)}${this.toHexPart(g)}${this.toHexPart(b)}${this.toHexPart(finalAlpha * 255)}`;
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
    return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${finalAlpha})`;
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
    return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${finalAlpha})`;
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
    return `hsva(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(v)}%, ${finalAlpha})`;
  }
}

/** 历史快照记录。 */
export interface _Utility_CursorHistoryRecord<T> {
  /** 快照值。 */
  readonly value: T;
  /** 写入时的时间戳（`Date.now()`）。 */
  readonly time: number;
}

/** `_Utility_CursorHistory` 的构造参数。 */
export interface _Utility_CursorHistoryConfig<T> {
  /** 可选的初始值。 */
  value?: T;
  /** 存储上限（默认 `50`）。`0` 或负数表示无限制。 */
  maxSize?: number;
  /** 游标变动 / 写入新值 / 清空时的回调。 */
  onChange?: (
    current: _Utility_CursorHistoryRecord<T> | undefined,
    all: _Utility_CursorHistoryRecord<T>[],
  ) => void;
}

/**
 * 带游标的值序列：写入会丢弃当前位置之后的「前进」分支（与撤销/重做栈语义一致），
 * 可通过 `prev` / `next` 在快照间移动。
 *
 * @typeParam T - 快照值的类型。
 */
export class _Utility_CursorHistory<T> {
  private records: _Utility_CursorHistoryRecord<T>[] = [];
  private _index = 0;
  private _maxSize = 0;

  /** 存储上限；`0` 表示无限制。超出时自动淘汰最早的记录。 */
  get maxSize() {
    return this._maxSize;
  }
  set maxSize(value: number) {
    const v = value > 0 ? Math.floor(value) : 0;
    if (this._maxSize === v) return;
    this._maxSize = v;
    this.trimOverflow();
  }

  /**
   * 统一的游标更新入口：钳位、触发回调。
   * 所有索引变动都经此处，保证 `onChange` 只在这里调用。
   */
  private get index() {
    return this._index;
  }
  private set index(value: number) {
    this._index = Math.max(0, Math.min(value, this.records.length - 1));
    this.onChange?.(this.records[this._index], this.records);
  }

  /** 游标变动 / 写入新值 / 清空时的回调。 */
  onChange?: _Utility_CursorHistoryConfig<T>["onChange"];

  constructor(config: _Utility_CursorHistoryConfig<T> = {}) {
    const { maxSize = 50, onChange, value } = config;
    this.maxSize = maxSize;
    if (onChange) this.onChange = onChange;
    if (value !== undefined) this.value = value;
  }

  /** 当前游标处的值；序列为空时为 `undefined`。 */
  get value(): T | undefined {
    return this.records[this.index]?.value;
  }

  /**
   * 在当前游标之后追加新值（深拷贝），并丢弃原「重做」分支。
   * 若超出 `maxSize`，自动丢弃最早的记录。
   */
  set value(value: T) {
    this.records.splice(this.index + 1);
    this.records.push({ value: _Utility_Clone(value), time: Date.now() });
    this.trimOverflow();
    this.index = this.records.length - 1;
  }

  /** 已保存的快照个数。 */
  get length(): number {
    return this.records.length;
  }

  /** 当前游标下标（`0` ～ `length - 1`）。序列为空时为 `0`。 */
  get position(): number {
    return this.index;
  }

  /** 序列是否为空。 */
  get isEmpty(): boolean {
    return this.records.length === 0;
  }

  /** 是否可以后退（`prev`）。 */
  get canPrev(): boolean {
    return this.index > 0;
  }

  /** 是否可以前进（`next`）。 */
  get canNext(): boolean {
    return this.index < this.records.length - 1;
  }

  /** 游标后退一步；已在起点则返回 `false`。 */
  prev(): boolean {
    if (!this.canPrev) return false;
    this.index--;
    return true;
  }

  /** 游标前进一步；已在末尾则返回 `false`。 */
  next(): boolean {
    if (!this.canNext) return false;
    this.index++;
    return true;
  }

  /** 跳到指定下标；越界则返回 `false`。 */
  jump(index: number): boolean {
    if (index < 0 || index >= this.records.length) return false;
    this.index = index;
    return true;
  }

  /** 跳到第一项。 */
  first(): boolean {
    if (this.isEmpty) return false;
    this.index = 0;
    return true;
  }

  /** 跳到最后一项。 */
  last(): boolean {
    if (this.isEmpty) return false;
    this.index = this.records.length - 1;
    return true;
  }

  /** 返回当前序列的浅拷贝（便于调试或序列化）。 */
  snapshot(): readonly _Utility_CursorHistoryRecord<T>[] {
    return this.records.slice();
  }

  /** 清空所有记录并重置游标。 */
  clear(): void {
    this.records = [];
    this.index = 0;
  }

  /** 若超出 `maxSize`，丢弃最早的记录并同步调整游标（绕过 setter 避免重复触发）。 */
  private trimOverflow(): void {
    if (this._maxSize <= 0 || this.records.length <= this._maxSize) return;
    const excess = this.records.length - this._maxSize;
    this.records.splice(0, excess);
    this._index = Math.max(0, this._index - excess);
  }
}
