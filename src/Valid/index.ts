import { EXTENSION_TO_MIME, FILE_EXTENSIONS, FileType } from "../Constant";
import { _Format_HrefName } from "../Format";
import { DataType, Point } from "./type";

/**
 * 检查单个一维数组参数是否合法（元素为有限数字）
 * @param arr - 待检查的数组
 * @param minLength - 数组最小长度 (默认2)
 * @returns 参数合法返回 true，否则返回 false
 */
export function _Valid_IsNumberArray(
  arr: unknown,
  minLength: number = 2,
): boolean {
  const isArr = Array.isArray(arr) && arr.length >= minLength;

  if (isArr) {
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] != "number" || !Number.isFinite(arr[i])) return false;
    }
  } else return false;
  return true;
}

/**
 * 检查二维数组结构是否合法（每个元素都是有效的一维数组）
 * @param arr - 待检查的二维数组
 * @param minLength - 外层数组最小长度 (默认1)
 * @param innerMinLength - 内层数组最小长度 (默认2)
 * @returns 所有元素都合法返回 true，否则返回 false
 */
export function _Valid_Is2DNumberArray(
  arr: unknown,
  minLength: number = 1,
  innerMinLength: number = 2,
) {
  const isArr = Array.isArray(arr) && arr.length >= minLength;
  if (isArr) {
    for (let i = 0; i < arr.length; i++) {
      if (!_Valid_IsNumberArray(arr[i], innerMinLength)) return false;
    }
  } else return false;
  return true;
}

/**
 * 误差范围
 * @param value 需要判断的数字
 * @param target 目标数字
 * @param errorMargin 正负误差范围
 * @returns 是否在误差内
 */
export function _Valid_IsInMargin(
  value: number,
  target: number,
  errorMargin: number,
): boolean {
  return Math.abs(value - target) <= errorMargin;
}

/**
 * 判断点是否在多边形内
 * @param point - 待检测的点，包含 x 和 y 坐标
 * @param polygon - 多边形的点集，数组形式，每个点包含 x 和 y 坐标
 * @returns boolean - 点是否在多边形内
 */
export function _Valid_IsPointInPolygon(
  point: Point,
  polygon: Point[],
): boolean {
  let isInside = false;

  const { x, y } = point;
  const len = polygon.length;

  for (let i = 0, j = len - 1; i < len; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) isInside = !isInside;
  }

  return isInside;
}

/**
 * 判断无限延伸的直线是否与矩形区域相交
 * @param rectCorner1 矩形对角顶点1 [x, y]
 * @param rectCorner2 矩形对角顶点2 [x, y]
 * @param linePointA 直线上一点A [x, y]
 * @param linePointB 直线上一点B [x, y]
 * @returns 直线是否与矩形相交
 */
export function _Valid_DoesInfiniteLineIntersectRectangle(
  rectCorner1: [number, number],
  rectCorner2: [number, number],
  linePointA: [number, number],
  linePointB: [number, number],
): boolean {
  // 计算矩形边界范围
  const rectMinX = Math.min(rectCorner1[0], rectCorner2[0]);
  const rectMaxX = Math.max(rectCorner1[0], rectCorner2[0]);
  const rectMinY = Math.min(rectCorner1[1], rectCorner2[1]);
  const rectMaxY = Math.max(rectCorner1[1], rectCorner2[1]);

  // 矩形四个顶点（顺时针顺序）
  const rectVertices: [number, number][] = [
    [rectMinX, rectMinY], // 左上
    [rectMaxX, rectMinY], // 右上
    [rectMaxX, rectMaxY], // 右下
    [rectMinX, rectMaxY], // 左下
  ];

  // 计算直线方程系数: Ax + By + C = 0
  const coefA = linePointB[1] - linePointA[1];
  const coefB = linePointA[0] - linePointB[0];
  const coefC = linePointB[0] * linePointA[1] - linePointA[0] * linePointB[1];

  // 处理两点重合的退化情况
  if (coefA === 0 && coefB === 0) {
    const [pointX, pointY] = linePointA;
    return (
      pointX >= rectMinX &&
      pointX <= rectMaxX &&
      pointY >= rectMinY &&
      pointY <= rectMaxY
    );
  }

  // 检测矩形顶点在直线的分布情况
  const FLOAT_EPSILON = 1e-10; // 浮点计算容差
  let hasPositiveSidePoint = false;
  let hasNegativeSidePoint = false;

  for (const [vertexX, vertexY] of rectVertices) {
    const positionValue = coefA * vertexX + coefB * vertexY + coefC;

    // 顶点落在直线上（直接判定相交）
    if (Math.abs(positionValue) < FLOAT_EPSILON) {
      return true;
    }
    // 顶点在直线正侧
    else if (positionValue > FLOAT_EPSILON) {
      hasPositiveSidePoint = true;
    }
    // 顶点在直线负侧
    else {
      hasNegativeSidePoint = true;
    }

    // 当检测到直线穿过矩形时提前退出
    if (hasPositiveSidePoint && hasNegativeSidePoint) {
      return true;
    }
  }

  // 当矩形顶点分居直线两侧时判定相交
  return hasPositiveSidePoint && hasNegativeSidePoint;
}

/**
 * 数据类型
 * @param {any} value
 * @returns string
 */
export function _Valid_DataType(value: any) {
  return Object.prototype.toString
    .call(value)
    .slice(8, -1)
    .toLowerCase() as DataType;
}

/**
 * 判断给定URL是否指向一个安全上下文
 *
 * 安全上下文是指通过一系列安全协议访问的资源，这些协议提供了数据的加密传输和身份验证
 * 本函数通过检查URL的协议前缀来判断是否属于安全上下文
 *
 * @param {string} url - 待检查的URL字符串
 * @returns {boolean} - 如果URL指向安全上下文，则返回true；否则返回false
 */
export function _Valid_IsSecureContext(url: string) {
  // 定义一个包含安全协议前缀的数组
  // 这里列出的协议代表了数据在传输过程中是加密的，从而保护了数据的机密性和完整性
  const secureProtocols = [
    "https:", // HTTPS协议，用于安全地浏览网页
    "wss:", // WebSocket Secure协议，用于安全的WebSocket通信
    "ftps:", // FTP Secure协议，用于安全的文件传输
    "sftp:", // SSH File Transfer Protocol，通过SSH安全地传输文件
    "smpts:", // Secure SMTP协议，用于安全地发送邮件
    "smtp+tls:", // SMTP协议结合STARTTLS扩展，用于升级到安全连接
    "imap+tls:", // IMAP协议结合STARTTLS扩展，用于安全地访问邮件
    "pop3+tls:", // POP3协议结合STARTTLS扩展，用于安全地接收邮件
    "rdp:", // Remote Desktop Protocol，用于安全的远程桌面连接
    "vpn:", // VPN协议，用于创建安全的网络连接
  ];

  // 遍历安全协议数组，检查给定URL是否以任一安全协议前缀开始
  // 使用startsWith方法来判断URL是否使用了安全协议
  // 如果找到匹配的安全协议前缀，则返回true，表示URL指向安全上下文；否则返回false
  return secureProtocols.some((protocol) => url.startsWith(protocol));
}

/**
 * 使用 XMLHttpRequest 检查指定 URL 的连接状态
 *
 * 此函数通过发送一个 HEAD 请求来检查给定 URL 是否可访问 HEAD 请求仅请求文档头部信息，
 * 而不是整个页面，因此比 GET 或 POST 请求更快此方法常用于检查 URL 是否有效，以及服务器的响应时间等
 *
 * @param {string} url - 需要检查连接的 URL 地址
 * @returns {Promise} - 返回一个 Promise 对象，该对象在连接成功时解析，在连接失败时拒绝
 */
export function _Valid_CheckConnectionWithXHR(url: string) {
  return new Promise((resolve, reject) => {
    // 前置校验：确保 URL 合法
    if (typeof url !== "string" || url.trim() === "" || !url.includes("://")) {
      reject(new Error("Invalid URL: Must be a non-empty string"));
      return;
    }

    // 显式处理浏览器兼容性错误（如无效协议或非法字符）
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("HEAD", url, true);
    } catch (error) {
      reject(new Error(`Invalid URL format: ${(error as Error).message}`));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("HEAD", url, true);

    // 统一错误处理逻辑
    const handleError = (event: ProgressEvent<EventTarget>) => {
      reject(new Error(`Request failed: ${event.type}`));
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        // 兼容性处理：status=0 可能是跨域或网络错误
        if (xhr.status === 0) {
          reject(new Error("Network error or CORS blocked"));
        } else if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          reject(new Error(`HTTP Error: ${xhr.status}`));
        }
      }
    };

    // 绑定所有可能的错误事件
    xhr.onerror = handleError; // 网络层错误（如 DNS 解析失败）
    xhr.onabort = handleError; // 请求被中止
    xhr.ontimeout = handleError; // 超时

    try {
      xhr.send();
    } catch (error) {
      reject(new Error(`Request send failed: ${(error as Error).message}`));
    }
  });
}

/**
 * 文件类型检查器类
 * 用于检查文件URL的类型
 */
export class _Valid_FileTypeChecker {
  // 缓存文件扩展名的条目，以提高性能
  private static cachedEntries = Object.entries(FILE_EXTENSIONS) as [
    FileType,
    string[],
  ][];

  private constructor() {}

  /**
   * 检查给定URL的文件类型
   * @param {string} url - 文件的URL
   * @param {string} [type] - 可选参数，指定要检查的文件类型
   * @returns {string} - 如果URL与指定类型或任何已知类型匹配，则返回文件类型，否则返回"unknown"
   */
  static check(url: string): FileType | "unknown";
  static check(url: string, type: FileType): boolean;
  static check(url: string, type?: FileType) {
    // 确保提供的URL是字符串且非空
    if (!url || typeof url !== "string") {
      console.error("Invalid URL provided");
      return type ? false : "unknown";
    }

    // 将URL转换为小写，以确保文件扩展名匹配不区分大小写
    const lowerCaseUrl = _Format_HrefName(url).toLowerCase();

    // 如果指定了文件类型，则检查URL是否具有该类型的任何文件扩展名
    if (type) {
      // 确保指定的文件类型是已知的
      if (!FILE_EXTENSIONS.hasOwnProperty(type)) {
        console.error(`Unknown file type: ${type}`);
        return "unknown";
      }
      const extensions = FILE_EXTENSIONS[type];
      return _Valid_FileTypeChecker._checkExtension(lowerCaseUrl, extensions);
    }

    // 如果未指定文件类型，则检测URL属于哪种文件类型
    return _Valid_FileTypeChecker._detectFileType(lowerCaseUrl);
  }

  /**
   * 静态方法，用于解析地址信息
   * 该方法接受一个URL字符串，将其解析为一个包含地址详情的对象数组
   * 主要用于批量处理以逗号分隔的URL列表，为每个URL生成相应的名称和类型
   *
   * @param {string} url - 以逗号分隔的URL字符串，每个URL代表一个资源的位置
   * @returns {Array} - 包含每个URL及其相关信息（名称和类型）的对象数组
   */
  static parseAddresses(url: string) {
    // 确保提供的URL是字符串且非空
    if (!url || typeof url !== "string") {
      console.error("Invalid URL provided");
      return [];
    }

    // 分割URL字符串并映射每个URL到包含其详细信息的对象
    return url.split(",").map((url) => {
      // 从URL中提取名称
      const name = _Format_HrefName(url);
      // 检查URL的类型
      const type = this.check(url);
      // 返回包含URL、名称和类型的对象
      return { url, name, type };
    });
  }

  /**
   * 检查 MIME 类型是否与指定的模式匹配
   * @param {string} type - 要检查的 MIME 类型（如 "image/png"）
   * @param {string} [accept] - 可接受的 MIME 类型模式（如 "image/*, text/plain"）
   * @returns {boolean} - 如果类型匹配，则返回 true，否则返回 false
   */
  static matchesMimeType(type: string, accept?: string) {
    /** 如果 accept 为空，则默认为 true */
    if (!accept) return true;
    if (typeof type !== "string" || typeof accept !== "string") return false;

    // 标准化类型和接受模式
    const normalizedType = _Valid_FileTypeChecker._normalizeType(type);
    const mimePatterns = accept
      .split(",")
      .map((pattern) => _Valid_FileTypeChecker._normalizeType(pattern.trim()));

    // 拆分主/子类型
    const [typeMain, typeSub = "*"] = normalizedType.split("/");

    return mimePatterns.some((pattern) => {
      const [patternMain, patternSub = "*"] = pattern.split("/");

      // 主类型匹配逻辑
      const mainMatch =
        patternMain === "*" || typeMain === "*" || patternMain === typeMain;

      // 子类型匹配逻辑
      const subMatch =
        patternSub === "*" || typeSub === "*" || patternSub === typeSub;

      return mainMatch && subMatch;
    });
  }

  /**
   * 类型标准化函数
   * 该函数旨在将文件类型或MIME类型字符串转换为标准格式
   * 主要处理三种情况：带扩展名的字符串、简写格式的类型以及已标准格式的类型
   *
   * @param {string} type - 文件类型或MIME类型字符串
   * @returns {string} 标准化的MIME类型字符串，如果无法识别则返回原始输入
   */
  static _normalizeType(type: string) {
    // 处理扩展名（如 .mp3）
    if (type.startsWith(".") && !type.includes("/")) {
      return EXTENSION_TO_MIME[type.toLowerCase() as ".mp3"] || type;
    }

    // 处理简写格式（如 "image" 转换为 "image/*"）
    if (!type.includes("/")) {
      return `${type}/*`;
    }

    // 返回原始输入，因为它已经是标准格式
    return type;
  }

  /**
   * 检查URL是否具有任何指定的文件扩展名
   * @param {string} url - 文件的URL
   * @param {string[]} validExtensions - 有效文件扩展名的数组
   * @returns {boolean} - 如果URL具有任何指定的文件扩展名，则返回true，否则返回false
   */
  static _checkExtension(url: string, validExtensions: string[]) {
    return validExtensions.some((extension) => url.endsWith(extension));
  }

  /**
   * 检测文件URL的类型
   * @param {string} url - 文件的URL
   * @returns {string} - 如果URL与任何已知类型匹配，则返回文件类型，否则返回"unknown"
   */
  static _detectFileType(url: string) {
    for (const [type, extensions] of _Valid_FileTypeChecker.cachedEntries) {
      if (extensions.some((extension) => url.endsWith(extension))) {
        return type;
      }
    }
    return "unknown";
  }
}
