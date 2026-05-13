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
  lat: number,
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
  lineEnd: [number, number],
): number {
  const [x0, y0] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2);

  let t = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));

  return Math.sqrt(
    (x0 - (x1 + t * (x2 - x1))) ** 2 + (y0 - (y1 + t * (y2 - y1))) ** 2,
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
  axisY: number = 1,
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

/** 计算平面直角坐标系中两点的距离 */
export function _Math_CalculateDistance2D(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  return Math.hypot(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

/** 获取两点的中点 */
export function _Math_GetMidpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
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
  canvasHeight: number,
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
 * 根据控制点与参数 t，用 De Casteljau 计算 Bézier 曲线上的点。
 * @param nodes 控制点
 * @param progress 曲线参数，通常取 [0, 1]
 * @returns 曲线上的点
 */
export function _Math_GetBezierCurveNodes(
  nodes: [number, number][],
  progress: number,
): [number, number] {
  const n = nodes.length;
  if (n === 0) return [0, 0];
  if (n === 1) return [nodes[0][0], nodes[0][1]];

  const t = progress;
  let layer: [number, number][] = nodes.map((p) => [p[0], p[1]]);
  while (layer.length > 1) {
    const next: [number, number][] = [];
    for (let i = 0; i < layer.length - 1; i++) {
      next.push([
        (1 - t) * layer[i][0] + t * layer[i + 1][0],
        (1 - t) * layer[i][1] + t * layer[i + 1][1],
      ]);
    }
    layer = next;
  }
  return layer[0];
}
