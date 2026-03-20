import { UNIT_LABELS } from "../Constant";

/**
 * 首字母大写
 * @param str
 * @returns string
 */
export function _Format_CapitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * 转为百分比字符串
 * @param value 分子
 * @param totalValue 分母
 * @param decimalPlaces 保留小数位
 * @returns 10.00%
 */
export function _Format_Percentage(
  value: number,
  totalValue: number,
  decimalPlaces = 2,
): string {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(totalValue) ||
    !Number.isFinite(decimalPlaces)
  ) {
    console.error("所有参数必须是有限的数字");
    return "";
  }

  if (totalValue === 0) {
    console.error("分母不能为零");
    return "";
  }

  if (decimalPlaces < 0) {
    console.error("小数位数不能为负数");
    return "";
  }

  const percentage = (value / totalValue) * 100;
  return percentage.toFixed(decimalPlaces) + "%";
}

/**
 * 格式化数字，给数字加上千位分隔符。
 * @param {number} number - 要格式化的数字。
 * @returns {string} - 格式化后的字符串。
 */
export function _Format_NumberWithCommas(number: number): string {
  // 将数字转换为字符串
  const numStr = number.toString();
  // 按小数点分割字符串
  const parts = numStr.split(".");
  // 处理整数部分
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (parts.length > 1) {
    // 如果有小数部分，拼接整数部分和小数部分
    return integerPart + "." + parts[1];
  }
  // 如果没有小数部分，直接返回处理后的整数部分
  return integerPart;
}

/**
 * 将纯数字转换为带单位的数字格式
 *
 * @param value - 要转换的数字或字符串形式的数字
 * @param config - 配置对象
 * @param config.join - 是否将数字和单位拼接成一个字符串，默认为 `false`
 * @param config.suffix - 单位后缀，默认为 `万`
 * @param config.decimalPlaces - 保留的小数位数，默认为 `2`
 *
 * @returns 返回转换后的结果：
 * - 如果 `config.join` 为 `true`，返回拼接后的字符串，如 "12.34万"
 * - 如果 `config.join` 为 `false`，返回一个数组，如 [ 12.34, '万' ]
 */
export function _Format_NumberWithUnit(
  value: string | number,
  config?: {
    join?: boolean;
    suffix?: string;
    decimalPlaces?: number;
  },
) {
  // 默认配置
  const defaultConfig = {
    join: true,
    suffix: "",
    decimalPlaces: 2,
  };

  // 合并配置
  const { join, suffix, decimalPlaces } = {
    ...defaultConfig,
    ...(config || {}),
  };

  const number = Number(value);
  if (isNaN(number)) return join ? `${0}${suffix}` : [0, suffix];

  const absNumber = Math.abs(number);
  const plus = number >= 0;

  // 计算位数
  const digits = Math.max(0, Math.floor(Math.log10(absNumber) / 4));

  // 计算单位转换因子
  const unitFactor = Math.pow(10000, digits);
  const dividedNumber = absNumber / unitFactor;
  const formattedNumber =
    (plus ? 1 : -1) *
    parseFloat(dividedNumber.toFixed(Math.max(0, decimalPlaces)));

  // 返回结果
  return join
    ? `${formattedNumber}${UNIT_LABELS[digits]}${suffix}`
    : [formattedNumber, UNIT_LABELS[digits] + suffix];
}

/**
 * 格式化文件大小
 * @param {number} size
 * @returns string
 */
export function _Format_FileSize(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let unitIndex = 0;
  while (size > 1024) {
    size /= 1024;
    unitIndex++;
  }
  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
}

/**
 * 时间戳转换字符串
 * @param {Number | Date} time 时间戳或Date对象
 * @param {String} template 完整模板 -->  YYYY MM DD hh mm ss ms
 * @param {Boolean} pad 补0
 */
export function _Format_Timestamp(
  time: number | Date,
  template = "YYYY-MM-DD hh:mm:ss",
  pad = true,
) {
  const date = new Date(time);

  if (isNaN(date.getTime())) {
    console.error("Invalid date");
    return "";
  }

  const dictionary = {
    YYYY: (date: Date) => date.getFullYear(),
    MM: (date: Date) => date.getMonth() + 1, // Adjust for 0-based month
    DD: (date: Date) => date.getDate(),
    hh: (date: Date) => date.getHours(),
    mm: (date: Date) => date.getMinutes(),
    ss: (date: Date) => date.getSeconds(),
    ms: (date: Date) => date.getMilliseconds(),
  };

  return template.replace(/YYYY|MM|DD|hh|mm|ss|ms/g, (match) => {
    const value = dictionary[match as "ss"](date);
    return pad ? String(value).padStart(2, "0") : String(value);
  });
}

/**
 * 从给定的href中提取名称部分
 * 该函数旨在处理URL字符串，并返回URL路径的最后一部分，去除查询参数
 *
 * @param {string} href - 待处理的URL字符串
 * @param {string} [defaultName="file"] - 默认的文件名，当无法提取时使用
 * @returns {string} URL路径的最后一部分，不包括查询参数
 */
export function _Format_HrefName(href: string, defaultName = "file") {
  // 简单检查空值和其他假值
  if (!href) return defaultName;

  // 将 href 转换为字符串以防止其他类型输入
  href = String(href).trim();

  // 如果 href 是空字符串，直接返回空字符串
  if (href === "") return defaultName;

  // 分割路径部分并获取最后一部分
  const pathParts = href.split("/");
  const lastPart = pathParts[pathParts.length - 1];

  // 分割查询参数并获取基础名称
  const name = lastPart.split("?")[0];

  // 返回处理后的名称部分
  return name;
}

/**
 * 驼峰命名
 * @param {字符串} str
 * @param {是否删除分割字符} isRemoveDelimiter
 * @returns 'wq1wqw-qw2qw' -> 'wq1Wqw-Qw2Qw' / 'wqWqwQwQw'
 */
export function _Format_CamelCase(str: string, isRemoveDelimiter?: boolean) {
  str = str.replace(/([^a-zA-Z][a-z])/g, (match) => match.toUpperCase());
  if (isRemoveDelimiter) return str.replace(/[^a-zA-Z]+/g, "");
  return str;
}

/**
 * 排除子串
 * @param inputString 需裁剪字符串
 * @param substringToDelete 被裁减字符串
 * @param delimiter 分隔符
 * @returns 裁减后的字符串
 */
export function _Format_ExcludeSubstring(
  inputString: string,
  substringToDelete: string,
  delimiter = ",",
) {
  const regex = new RegExp(
    `(^|${delimiter})${substringToDelete}(${delimiter}|$)`,
    "g",
  );
  return inputString.replace(regex, function ($0, $1, $2) {
    return $1 === $2 ? delimiter : "";
  });
}

/**
 * 处理不可见字符的转义和还原
 * @param {string} str - 要处理的字符串
 * @param {boolean} escape - true表示转义（默认），false表示还原
 * @returns {string} 处理后的字符串
 */
export function _Format_ToggleInvisibleChars(str: string, escape = true) {
  // 转义映射表
  const escapeMap = {
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\v": "\\v",
    "\f": "\\f",
    "\r": "\\r",
    " ": "\\s",
  } as const;

  // 还原映射表（反转转义映射）
  const unescapeMap = Object.fromEntries(
    Object.entries(escapeMap).map(([key, value]) => [value, key]),
  );

  if (escape) {
    // 转义模式：将不可见字符转为转义序列
    return str.replace(
      /[\b\t\n\v\f\r ]/g,
      (match) => escapeMap[match as keyof typeof escapeMap],
    );
  } else {
    // 还原模式：将转义序列转为实际字符
    return str.replace(/\\[btnvfrs]/g, (match) => {
      return unescapeMap[match] || match; // 找不到对应项则保留原字符
    });
  }
}

// 时间单位配置：[单位名称, 1单位对应的毫秒数]，按从大到小排序
const UnitConfigs = [
  ["年", 365 * 24 * 60 * 60 * 1000],
  ["月", 30 * 24 * 60 * 60 * 1000],
  ["周", 7 * 24 * 60 * 60 * 1000],
  ["天", 24 * 60 * 60 * 1000],
  ["时", 60 * 60 * 1000],
  ["分", 60 * 1000],
  ["秒", 1000],
  ["毫秒", 1],
] as const;

// 提取单位名称类型，用于参数约束
type UnitName = (typeof UnitConfigs)[number][0];

/**
 * 格式化毫秒数为易读的时间单位（基于固定换算规则）
 * @param ms 待格式化的毫秒数（需为非负数）
 * @param maxUnit 最大单位限制（可选，如传入"天"则最大只显示到天，不显示年/月/周）
 *                可选值："年"|"月"|"周"|"天"|"时"|"分"|"秒"|"毫秒"
 * @returns 格式化后的时间字符串（如 1.3秒、300毫秒、1,234年）
 * @description
 *  1. 单位换算规则（固定值，非自然时间）：
 *     - 1年 = 365天（忽略闰年差异）
 *     - 1月 = 30天（忽略实际月份天数差异）
 *     - 1周 = 7天，1天 = 24小时，1小时 = 60分钟，1分钟 = 60秒，1秒 = 1000毫秒
 *  2. 格式化逻辑：
 *     - 自动匹配不超过最大单位限制的最优单位（数值≥单位阈值时使用该单位）
 *     - 非整数数值保留1位小数（如1.3秒），整数自动去除末尾.0（如1秒而非1.0秒）
 *     - "年"单位数值会自动应用千分位格式化（如1,234年）
 *  3. 输入校验：负数会返回"0毫秒"
 */
export function _Format_MillisecondToReadable(ms: number, maxUnit?: UnitName) {
  // 校验输入：若为负数，返回0毫秒
  if (!Number.isFinite(ms) || ms < 0) return "0毫秒";

  ms = Math.round(ms);

  // 找到最大单位的索引（无限制时为0，有则取对应单位索引）
  const maxIndex = maxUnit
    ? UnitConfigs.findIndex(([name]) => name === maxUnit)
    : 0;

  // 如果传入的最大单位不存在，默认不限制
  const effectiveMaxIndex = maxIndex === -1 ? 0 : maxIndex;

  // 遍历单位，从最大允许单位开始匹配（不超过限制的最大单位）
  for (let i = effectiveMaxIndex; i < UnitConfigs.length; i++) {
    const [unitName, unitMs] = UnitConfigs[i];
    if (ms >= unitMs) {
      // 计算单位数值：毫秒单位取整数，其他单位保留1位小数（四舍五入）
      const value = unitMs === 1 ? ms : Math.round((ms / unitMs) * 10) / 10;

      // 格式化数值：移除末尾.0，年单位使用千分位
      let formattedValue: string | number = Number.isInteger(value)
        ? value
        : value.toFixed(1).replace(/\.0$/, "");

      if (unitName === UnitConfigs[effectiveMaxIndex][0]) {
        formattedValue = _Format_NumberWithCommas(Number(formattedValue));
      }

      return `${formattedValue}${unitName}`;
    }
  }

  // 兜底返回（理论上不会触发）
  return "0毫秒";
}

/**
 * 将数组按指定长度分割成多个子数组
 * @param arr 要分割的原始数组
 * @param size 每个子数组的长度
 * @returns 分割后的二维数组
 * @throws 当size小于1时抛出错误
 */
export function _Format_ChunkArray<T>(arr: T[], size: number): T[][] {
  // 校验参数合法性
  if (size < 1) {
    console.error("分割大小必须大于0");
    return [];
  }

  // 初始化结果数组
  const result: T[][] = [];

  // 遍历原始数组，按size分割
  for (let i = 0; i < arr.length; i += size) {
    // 从当前索引开始，截取size长度的子数组
    const chunk = arr.slice(i, i + size);
    result.push(chunk);
  }

  return result;
}
