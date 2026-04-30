import { _Format_HrefName } from "../Format";

/**
 * 读取文件
 * @param src 文件地址
 * @returns 文件的字符串内容
 */
export function _File_Read(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch(src)
      .then((response) => resolve(response.text()))
      .catch((error) => {
        console.error("Error fetching :", error);
        reject(error);
      });
  });
}

/**
 * 选择文件
 * @param options 选择文件的配置
 * @returns 选择的文件列表
 */
export function _File_Select(options?: {
  accept?: string;
  multiple?: boolean;
}): Promise<File[]> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = options?.accept || "";
  input.multiple = options?.multiple || false;

  return new Promise((resolve, reject) => {
    input.addEventListener("change", (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files) resolve(Array.from(files));
      else reject();
    });
    input.click();
  });
}

/**
 * 下载文件并支持进度监控、超时控制和主动中止
 *
 * @param {Object} options - 下载配置选项
 * @param {string} options.href - 文件的 URL 路径或下载地址，需确保跨域权限或同源
 * @param {string} [options.fileName] - 可选，指定导出的文件名（不含扩展名时会自动从 href 提取）
 * @param {Function} [options.onProgress] - 可选，下载进度回调函数
 * @param {number} [options.onProgress.progress] - 进度百分比（0-100）
 * @param {number} [options.timeout=30000] - 可选，超时时间（毫秒），默认 30 秒
 * @param {boolean} [options.autoDownload=true] - 可选，是否自动执行下载操作，默认 true
 * @returns {Object} 返回包含以下属性的对象：
 *   - promise: Promise 对象，成功时 resolve 下载的 Blob 数据，失败时 reject 错误信息
 *   - abort: 中止下载的函数，调用后会触发 abort 错误
 *   - download: 手动执行下载的函数（当 autoDownload 为 false 时使用）
 */
export function _File_Download(options: {
  href: string;
  fileName?: string;
  onProgress?: (progress: number) => void;
  timeout?: number;
  autoDownload?: boolean;
}) {
  const {
    href,
    fileName,
    onProgress,
    timeout = 30000,
    autoDownload = true,
  } = options;

  let xhr: XMLHttpRequest;
  let isAborted = false;
  let responseBlob: Blob | null = null;
  let decodedFileName: string;

  // 处理文件名
  const processedFileName =
    fileName || _Format_HrefName(href, "downloaded_file");
  decodedFileName = decodeURIComponent(processedFileName);

  // 执行下载操作的内部方法
  const executeDownload = () => {
    if (!responseBlob) return;

    const url = URL.createObjectURL(responseBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = decodedFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const promise = new Promise<Blob>((resolve, reject) => {
    try {
      xhr = new XMLHttpRequest();
      xhr.open("GET", href);
      xhr.responseType = "blob";
      xhr.timeout = timeout;

      // 超时处理
      xhr.ontimeout = () => {
        if (!isAborted) {
          reject(new Error(`请求超时（已超过${timeout / 1000}秒）`));
        }
      };

      // 进度监控
      xhr.addEventListener("progress", (event) => {
        if (event.lengthComputable && !isAborted) {
          const progress = (event.loaded / event.total) * 100;
          onProgress?.(Number(progress.toFixed(2)));
        }
      });

      // 下载完成
      xhr.addEventListener("load", () => {
        if (isAborted) return;

        if (xhr.status >= 200 && xhr.status < 300) {
          responseBlob = xhr.response;
          // 自动下载
          if (autoDownload) {
            executeDownload();
          }
          resolve(xhr.response);
        } else {
          reject(new Error(`下载失败，状态码: ${xhr.status}`));
        }
      });

      // 错误处理
      xhr.addEventListener("error", () => {
        if (!isAborted) {
          reject(new Error("网络错误，下载失败"));
        }
      });

      // 中止处理
      xhr.addEventListener("abort", () => {
        if (!isAborted) {
          isAborted = true;
          reject(new Error("下载已被中止"));
        }
      });

      xhr.send();
    } catch (error) {
      if (!isAborted) {
        reject(error);
      }
    }
  });

  // 中止函数
  const abort = () => !isAborted && xhr.abort();

  // 手动执行下载的函数
  const download = () => {
    if (!isAborted && responseBlob) {
      executeDownload();
    }
  };

  return { promise, abort, download };
}

/**
 * 创建文件并下载
 * @param {BlobPart[]} content 文件内容
 * @param {string} fileName 文件名称
 * @param {BlobPropertyBag} options Blob 配置
 */
export function _File_CreateAndDownload(
  content: BlobPart[],
  fileName: string,
  options?: BlobPropertyBag,
) {
  if (!options) {
    let type = fileName.replace(/^[^.]+./, "");
    type = type == fileName ? "text/plain" : "application/" + type;
    options = { type };
  }
  const bolb = new Blob(content, options);
  // 创建一个 URL，该 URL 可以用于在浏览器中引用 Blob 对象（例如，在 <a> 标签的 href 属性中）
  const href = URL.createObjectURL(bolb);

  _File_Download({ href, fileName });
}
