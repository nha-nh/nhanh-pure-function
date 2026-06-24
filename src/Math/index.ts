/** 提取固定值 */
const HALF_PI = Math.PI / 2;
const PI_OVER_180 = Math.PI / 180;
const EARTH_RADIUS = 6378137;
const MAX_LAT = 85.05112878;

/**
 * 将经纬度转换为平面坐标
 * @param lng 经度
 * @param lat 纬度
 * @returns 平面坐标 [x, y]（米）
 */
export function _Math_LngLatToPlane(
  lng: number,
  lat: number
): [number, number] {
  const clampedLng = Math.max(Math.min(lng, 180), -180);
  const clampedLat = Math.max(Math.min(lat, MAX_LAT), -MAX_LAT);

  const x = clampedLng * PI_OVER_180 * EARTH_RADIUS;
  const phi = clampedLat * PI_OVER_180;
  const y = Math.log(Math.tan(Math.PI / 4 + phi / 2)) * EARTH_RADIUS;
  return [x, y];
}

/**
 * 将平面坐标转换为经纬度
 * @param x 平面坐标 X 值（米）
 * @param y 平面坐标 Y 值（米）
 * @returns 经纬度 [lng, lat]（度）
 */
export function _Math_PlaneToLngLat(x: number, y: number): [number, number] {
  // 计算经度
  const lng = x / EARTH_RADIUS / PI_OVER_180;

  // 计算纬度
  const lat =
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - HALF_PI) / PI_OVER_180;

  return [lng, lat];
}

/**
 * 计算点到线段的距离
 * @param point 点击位置
 * @param lineStart 线段起点
 * @param lineEnd 线段终点
 * @returns 点到线段的距离
 */
export function _Math_PointToLineDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const [x0, y0] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2);

  let t = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));

  return Math.sqrt(
    (x0 - (x1 + t * (x2 - x1))) ** 2 + (y0 - (y1 + t * (y2 - y1))) ** 2
  );
}

/**
 * 计算圆弧的起点和终点坐标
 * @param x 圆心X坐标
 * @param y 圆心Y坐标
 * @param radius 圆弧半径
 * @param startAngle 起始角度（弧度制，0表示X轴正方向）
 * @param endAngle 结束角度（弧度制）
 * @param axisX X轴方向（1=正方向向右，-1=正方向向左）
 * @param axisY Y轴方向（1=正方向向上，-1=正方向向下）
 * @returns [起点坐标[x,y], 终点坐标[x,y]]
 */
export function _Math_GetArcPoints(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  axisX: number = 1,
  axisY: number = 1
): [[number, number], [number, number]] {
  // 计算起点坐标（考虑坐标轴方向）
  const startX = x + radius * Math.cos(startAngle) * axisX;
  const startY = y + radius * Math.sin(startAngle) * axisY;

  // 计算终点坐标（考虑坐标轴方向）
  const endX = x + radius * Math.cos(endAngle) * axisX;
  const endY = y + radius * Math.sin(endAngle) * axisY;

  return [
    [startX, startY],
    [endX, endY],
  ];
}

/**
 * 计算两个经纬度坐标之间的直线距离（单位：米）。
 *
 * 先将经纬度通过 Mercator 投影转换为平面坐标（米），
 * 再计算二维平面欧几里得距离，适用于短距离近似计算。
 *
 * @param lng1 第一个点的经度（度），范围 [-180, 180]
 * @param lat1 第一个点的纬度（度），范围 [-85.05, 85.05]
 * @param lng2 第二个点的经度（度），范围 [-180, 180]
 * @param lat2 第二个点的纬度（度），范围 [-85.05, 85.05]
 * @returns 两点间的距离（米）
 */
export function _Math_CalculateDistanceLngLat(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
) {
  const [x1, y1] = _Math_LngLatToPlane(lng1, lat1);
  const [x2, y2] = _Math_LngLatToPlane(lng2, lat2);
  return _Math_CalculateDistance2D(x1, y1, x2, y2);
}

/** 计算平面直角坐标系中两点的距离 */
export function _Math_CalculateDistance2D(
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  return Math.hypot(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

/** 获取两点的中点 */
export function _Math_GetMidpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return { x: midX, y: midY };
}

/**
 * 计算从起点沿方向向量延伸后与画布边界的交点
 * @param startPoint 线段起点坐标 [x, y]
 * @param direction 方向向量 [dx, dy]
 * @param canvasWidth 画布宽度
 * @param canvasHeight 画布高度
 * @returns 与边界的交点坐标
 */
export function _Math_GetBoundaryIntersection(
  startPoint: [number, number],
  direction: [number, number],
  canvasWidth: number,
  canvasHeight: number
): [number, number] {
  const [startX, startY] = startPoint;
  const [dirX, dirY] = direction;
  let minT = Infinity; // 存储到达边界的最小正比例系数

  // 检测左右边界（垂直边界）
  if (dirX !== 0) {
    const tToVerticalBoundary =
      dirX > 0
        ? (canvasWidth - startX) / dirX // 到达右边界
        : -startX / dirX; // 到达左边界

    if (tToVerticalBoundary > 0) {
      minT = Math.min(minT, tToVerticalBoundary);
    }
  }

  // 检测上下边界（水平边界）
  if (dirY !== 0) {
    const tToHorizontalBoundary =
      dirY > 0
        ? (canvasHeight - startY) / dirY // 到达下边界
        : -startY / dirY; // 到达上边界

    if (tToHorizontalBoundary > 0) {
      minT = Math.min(minT, tToHorizontalBoundary);
    }
  }

  // 当向量指向边界外时返回 null
  return minT === Infinity
    ? startPoint
    : [startX + dirX * minT, startY + dirY * minT];
}

// 仅对需要角度参数的三角函数进行处理
const trigonometricFunctions = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
]);

/**
 * 角度制数学工具代理
 * 对于三角函数：自动将输入的角度转换为弧度
 * 对于其他方法：直接调用原生Math方法
 */
export const _Math_Degree = new Proxy(Math, {
  get(target, prop: keyof Math) {
    // 处理三角函数：转换角度为弧度
    if (trigonometricFunctions.has(prop as string)) {
      return function (...args: number[]) {
        const convertedArgs = args.map((v) => (v / 180) * Math.PI);
        /** @ts-ignore */
        return target[prop](...convertedArgs);
      };
    }

    // 非三角函数：直接返回原生方法
    return target[prop];
  },

  // 禁止修改属性
  set() {
    throw new Error("DegreeMath 是只读的，不能修改属性");
  },

  // 禁止删除属性
  deleteProperty() {
    throw new Error("DegreeMath 是只读的，不能删除属性");
  },
});

/**
 * 根据控制点与参数 t，用 De Casteljau 计算 Bézier 曲线上的点和方向弧度。
 *
 * 【为什么可以这样获取方向】
 * 根据 De Casteljau 算法的特性，当循环降维到倒数第二层（只剩最后 2 个点）时，
 * 这两点连线的方向 [p1 - p0] 刚好就是曲线在该点处的切线向量。
 * 此时使用 Math.atan2 即可直接换算出切线方向的弧度，无需单独执行求导公式。
 *
 * @param nodes 控制点
 * @param progress 曲线参数，通常取 [0, 1]
 * @returns 曲线上的点和方向 [x, y, radian]
 */
export function _Math_GetBezierCurveNodes(
  nodes: [number, number][],
  progress: number
): [number, number, number] {
  const n = nodes.length;
  if (n === 0) return [0, 0, 0];
  if (n === 1) return [nodes[0][0], nodes[0][1], 0];

  const t = progress;
  let layer: [number, number][] = nodes.map((p) => [p[0], p[1]]);

  // 变更终止条件：循环到只剩下最后两个点时停止
  while (layer.length > 2) {
    const next: [number, number][] = [];
    for (let i = 0; i < layer.length - 1; i++) {
      next.push([
        (1 - t) * layer[i][0] + t * layer[i + 1][0],
        (1 - t) * layer[i][1] + t * layer[i + 1][1],
      ]);
    }
    layer = next;
  }

  // 此时 layer 包含且仅包含最后两个控制点 p0 和 p1
  const p0 = layer[0];
  const p1 = layer[1];

  // 1. 计算最终的曲线点位置
  const x = (1 - t) * p0[0] + t * p1[0];
  const y = (1 - t) * p0[1] + t * p1[1];

  // 2. 计算切线向量并转换为弧度（范围 -PI 到 PI）
  const dirX = p1[0] - p0[0];
  const dirY = p1[1] - p0[1];
  const radian = Math.atan2(dirY, dirX);

  return [x, y, radian];
}

/**
 * 根据宽高比与参数 progress，计算椭圆上的点（中心在原点）。
 * @param aspectRatio 宽高比（width / height），即 X 半轴与 Y 半轴之比
 * @param progress 曲线参数，通常取 [0, 1]，表示沿椭圆一周的位置
 * @param normalizeToUnitSquare 为 true 时将坐标归一化到 [0,1]×[0,1]（外接矩形内）
 * @returns 椭圆上的点 [x, y]
 */
export function _Math_GetEllipsePoints(
  aspectRatio: number,
  progress: number,
  normalizeToUnitSquare?: boolean
): [number, number] {
  const ratio = Math.abs(aspectRatio) || 1;
  const angle = progress * Math.PI * 2;

  const x = ratio * Math.cos(angle);
  const y = Math.sin(angle);

  if (normalizeToUnitSquare) return [(x + ratio) / (2 * ratio), (y + 1) / 2];
  return [x, y];
}

/**
 * 将数值钳制在指定区间内。
 * @param value 输入值
 * @param min 下限
 * @param max 上限
 * @returns 钳制后的值
 */
export function _Math_Clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 线性插值。
 * @param a 起始值
 * @param b 结束值
 * @param t 插值参数，[0, 1]
 * @returns 插值结果
 */
export function _Math_Lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 逆线性插值：计算 value 在 [a, b] 区间的位置比例。
 * @param a 区间下限
 * @param b 区间上限
 * @param value 当前值
 * @returns 比例 t，0 表示在 a，1 表示在 b
 */
export function _Math_InverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

/**
 * 将 value 从 [fromMin, fromMax] 区间映射到 [toMin, toMax] 区间。
 * @param value 输入值
 * @param fromMin 源区间下限
 * @param fromMax 源区间上限
 * @param toMin 目标区间下限
 * @param toMax 目标区间上限
 * @returns 映射后的值
 */
export function _Math_Remap(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number {
  const t = _Math_InverseLerp(fromMin, fromMax, value);
  return _Math_Lerp(toMin, toMax, t);
}

/**
 * 角度转弧度。
 * @param deg 角度（度）
 * @returns 弧度
 */
export function _Math_DegToRad(deg: number): number {
  return (deg / 180) * Math.PI;
}

/**
 * 弧度转角度。
 * @param rad 弧度
 * @returns 角度（度）
 */
export function _Math_RadToDeg(rad: number): number {
  return (rad / Math.PI) * 180;
}

/**
 * 将角度归一化到指定范围。
 * @param angle 输入角度（度）
 * @param signed 为 true 时归一化到 [-180, 180)，默认 false 归一化到 [0, 360)
 * @returns 归一化后的角度
 */
export function _Math_NormalizeAngle(
  angle: number,
  signed = false
): number {
  let a = angle % 360;
  if (a < 0) a += 360;
  if (signed && a >= 180) a -= 360;
  return a;
}

/**
 * 判断点是否在矩形内（含边界）。
 * @param px 点 X 坐标
 * @param py 点 Y 坐标
 * @param rx 矩形左上角 X
 * @param ry 矩形左上角 Y
 * @param rw 矩形宽度
 * @param rh 矩形高度
 * @returns true 表示点在矩形内
 */
export function _Math_IsPointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * 判断点是否在圆形内（含边界）。
 * @param px 点 X 坐标
 * @param py 点 Y 坐标
 * @param cx 圆心 X
 * @param cy 圆心 Y
 * @param radius 圆半径
 * @returns true 表示点在圆内
 */
export function _Math_IsPointInCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}
