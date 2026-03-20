/**
 * 鼠标时间提示信息
 */
export type TimeAxisMouseTimeInfo = {
  /** 是否显示指示线/时间提示 */
  visible: boolean;
  /** 鼠标在 canvas 内的 x（像素） */
  canvasX: number;
  /** 鼠标在 canvas 内的 y（像素） */
  canvasY: number;
  /** 鼠标位置对应的时间戳（ms） */
  time: number;
};

/** 矩形区域（像素坐标） */
export type TimeAxisRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 渐变颜色停靠点 */
export type TimeAxisGradientColorStop = {
  color: string;
  offset: number;
};

/** 线性渐变配置：x1/y1/x2/y2 为相对矩形的比例 [0,1]，表示渐变起止方向 */
export type TimeAxisGradientFillStyle = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  colorStops: TimeAxisGradientColorStop[];
};

/** 填充样式：纯色或线性渐变 */
export type TimeAxisFillStyle = string | TimeAxisGradientFillStyle;

/**
 * 时间轴动画曲线：入参 `t` 为 [0, 1]，返回 eased 后的进度（也应为 [0, 1]）
 */
export type TimeAxisAnimationCurve = (t: number) => number;
