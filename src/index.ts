// import { readdirSync, statSync } from "fs";
// import { join } from "path";
// import { fileURLToPath } from "url"; // 仅 ESM 需要

// // 确定当前执行文件的目录（兼容 CommonJS 和 ESM）
// const currentDir =
//   typeof __dirname !== "undefined"
//     ? __dirname // CommonJS
//     : fileURLToPath(new URL(".", import.meta.url)); // ESM

// /**
//  * 获取执行文件所在目录下的所有文件夹名称
//  * @returns 文件夹名称数组
//  */
// export function getDirectories(): string[] {
//   try {
//     return readdirSync(currentDir).filter((item) =>
//       statSync(join(currentDir, item)).isDirectory()
//     );
//   } catch (error) {
//     console.error(`读取目录失败: ${error}`);
//     return [];
//   }
// }

// // 使用示例
// const folders = getDirectories()
//   .map((name) => `export * from "./${name}";`)
//   .join("\n");
// console.log("当前目录下的文件夹:\n", folders);

// npm publish --tag beta

import "./index.less";
export * from "./Constant";

export * from "./Animate";
export * from "./Blob";
export * from "./Browser";
export * from "./Canvas/Axis";
export * from "./Canvas/TimeAxis";
export * from "./Element";
export * from "./File";
export * from "./Format";
export * from "./Math";
export * from "./Types";
export * from "./Utility";
export * from "./Valid";

type TipHandler = ((...args: any[]) => void) | undefined;
type TipType = "info" | "success" | "warning" | "error";

class TipFlow {
  protected resolve: TipHandler = undefined;
  protected reject: TipHandler = undefined;

  constructor(resolve?: TipHandler, reject?: TipHandler) {
    this.resolve = resolve;
    this.reject = reject;
  }

  run<T>(value: T) {
    if (value instanceof Promise) {
      value
        .then((val) => {
          this.resolve?.();
          return val;
        })
        .catch((err) => {
          this.reject?.();
          return Promise.reject(err);
        });
    } else {
      if (value) this.resolve?.();
      else this.reject?.();
    }
    return value;
  }
}
class ResolveTip extends TipFlow {
  constructor(resolve: TipHandler) {
    super();
    this.resolve = resolve;
  }

  warning(...args: any[]) {
    const reject = () => _Tip.tips.warning?.(...args);
    return new TipFlow(this.resolve, reject);
  }
  error(...args: any[]) {
    const reject = () => _Tip.tips.error?.(...args);
    return new TipFlow(this.resolve, reject);
  }
}
class RejectTip extends TipFlow {
  constructor(reject: TipHandler) {
    super();
    this.reject = reject;
  }

  info(...args: any[]) {
    const resolve = () => _Tip.tips.info?.(...args);
    return new TipFlow(resolve, this.reject);
  }
  success(...args: any[]) {
    const resolve = () => _Tip.tips.success?.(...args);
    return new TipFlow(resolve, this.reject);
  }
}

export class _Tip {
  static tips: Record<TipType, TipHandler> = {
    info: undefined,
    success: undefined,
    warning: undefined,
    error: undefined,
  };

  /**
   * 构造函数
   * @throws 如果尝试实例化该类，则抛出错误，因为应该使用静态方法
   */
  constructor() {
    if (new.target === _Tip) {
      throw new Error("请直接使用静态方法，而不是实例化此类");
    }
  }

  static register(type: TipType, handler: TipHandler) {
    if (typeof handler !== "function")
      return console.error("TipHandler must be a function");
    _Tip.tips[type] = handler;
  }

  private static resolveTip(type: "info" | "success") {
    return function (...args: any[]) {
      const tip = () => _Tip.tips[type]?.(...args);
      return new ResolveTip(tip);
    };
  }
  static info = _Tip.resolveTip("info");
  static success = _Tip.resolveTip("success");

  private static rejectTip(type: "warning" | "error") {
    return function (...args: any[]) {
      const tip = () => _Tip.tips[type]?.(...args);
      return new RejectTip(tip);
    };
  }
  static warning = _Tip.rejectTip("warning");
  static error = _Tip.rejectTip("error");
}

// /** 测试代码 */
// export const _Test = 22333;
// /** 测试代码 2 */
// export const _Test2 = 22333;

// const messageTypes = ["info", "warning", "success", "error"] as const;
// messageTypes.forEach((type) => {
//   /** @ts-ignore */
//   _Tip.register(type, (...args) => window.$message[type](...args));
// });
// console.log(_Tip.success("加载成功").error("加载失败").run(123));
// console.log(_Tip.error("加载失败").success("加载成功").run(0));
// console.log(_Tip.info("加载成功").warning("加载失败").run(123));
// console.log(_Tip.warning("加载失败").info("加载成功").run(0));
// _Tip
//   .info("加载成功")
//   .warning("加载失败")
//   .run(
//     new Promise((resolve, reject) => {
//       setTimeout(() => resolve("reject-22333"), 2000);
//     })
//   )
//   .then((val) => console.log(val))
//   .catch((err) => console.error(err));
