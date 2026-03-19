/** 默认中心点 */

export type DefaultCenter = Partial<{
  top: number | `${number}%` | "top" | "middle" | "bottom";
  bottom: number | `${number}%`;
  left: number | `${number}%` | "left" | "center" | "right";
  right: number | `${number}%`;
}>;

export type KnownStyleKeys = "light" | "dark";

/** 文本样式 */
export type TextStyleType = {
  /** 颜色 */
  color: string;
  /** secondary颜色 */
  secondary: string;
  /** 描边色 */
  stroke: string;
  /** 字体大小 */
  size: number;
  /** 字体族 */
  family: string;
  /** 是否加粗 */
  bold: boolean;
};

/** 网格样式 */
export type GridStyleType = {
  axis: string;
  grid: string;
  innerGrid: string;
};

/** 点位样式 */
export type PointStyleType = {
  /** 半径 */
  radius: number;
  /** 边框颜色 */
  stroke: string;
  /** 边框大小 */
  width: number;
  /** 填充颜色 */
  fill: string;
};

/** 基础线样式 */
export type BaseLineStyle = {
  /** 颜色 */
  color: string;
  /** 颜色 - hover */
  color_hover: string;
  /** 宽度 */
  width: number;
  /** 虚线 */
  dash: boolean;
  /** 虚线间隔 */
  dashGap: number[];
  /** 偏移虚线 */
  dashOffset: number;
  /** 末端的形状 */
  cap: "butt" | "round" | "square";
  /** 路径中的相连部分的形状 */
  join: "bevel" | "round" | "miter";
};

/** 线样式 */
export type LineStyleType = {
  /** 描边 */
  stroke: BaseLineStyle;
  /** 点位样式 */
  point: PointStyleType;
};

/** 圆弧样式 */
export type ArcStyleType = {
  /** 填充色 */
  fill: string;
  /** 填充色 - hover */
  fill_hover: string;
  /** 描边 */
  stroke: BaseLineStyle;
  /** 点位样式 */
  point: PointStyleType;
};
/** 圆角样式 */
export type ArcToStyleType = {
  /** 描边 */
  stroke: BaseLineStyle;
  /** 点位样式 */
  point: PointStyleType;
};

/** 面样式 */
export type PolygonStyleType = {
  /** 填充色 */
  fill: string;
  /** 填充色 - hover */
  fill_hover: string;
  /** 描边 */
  stroke: BaseLineStyle;
  /** 点位样式 */
  point: PointStyleType;
};

/** 主题样式 */
export type StyleItemType = {
  /** 背景色 */
  background: string;
  /** 文本样式 */
  text: TextStyleType;
  /** 网格样式 */
  grid: GridStyleType;
  /** 点位样式 */
  point: PointStyleType;
  /** 线样式 */
  line: LineStyleType;
  /** 圆弧样式 */
  arc: ArcStyleType;
  /** 圆角样式 */
  arcTo: ArcToStyleType;
  /** 面样式 */
  polygon: PolygonStyleType;
};

/** 主题样式 */
export type StyleType = Record<KnownStyleKeys, StyleItemType> &
  Record<string, StyleItemType>;

// 递归定义任意层级的OverlayType嵌套数组
export type DeepArray<T> = T | T[] | DeepArray<T>[];
