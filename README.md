# nhanh-pure-function

JavaScript/TypeScript 工具库，提供纯函数、画布、格式化、校验等常用能力，适用于前端项目的数据处理与可视化场景。

## 安装

```bash
npm install nhanh-pure-function
```

## 模块概览

| 模块 | 说明 |
|------|------|
| **Constant** | 常量：扩展名与 MIME 映射、单位标签、纸张尺寸、窗口目标等 |
| **Animate** | 动画：进度调度、振荡器、数值过渡 |
| **Blob** | 数据转图像 URL（Base64、ArrayBuffer、File 等） |
| **Browser** | 浏览器：帧率、剪贴板、可打印区域、同源标签管理 |
| **Canvas/Axis** | 数学坐标轴画布 `_Canvas_Axis`：图层、覆盖物（点/线/多边形/圆弧）、视图适配、覆盖物创建交互 |
| **Canvas/TimeAxis** | 时间轴画布 `_Canvas_TimeAxis`：时间-像素换算、拖拽、缩放、时间范围绘制 |
| **Element** | DOM：滚动结束监听、点击外部关闭、拖拽等 |
| **File** | 文件：读取、下载（含进度）、创建并下载 |
| **Format** | 格式化：首字母大写、百分比、千位分隔符、文件大小、时间戳、链接名等 |
| **Math** | 数学：经纬度↔平面坐标、点到线段距离、圆弧点、中点、边界交点等 |
| **Types** | 类型工具：`RequiredBy`、`PartialBy`、`DeepPartial`、`Mutable` |
| **Utility** | 工具：空闲执行、等待条件、合并对象、防抖节流、UUID 等 |
| **Valid** | 校验：数组校验、误差范围、点在多边形内、线段与矩形相交、数据类型、安全上下文、文件类型等 |
| **_Tip** | 提示流：`info`/`success`/`warning`/`error` 链式注册与执行 |


## 许可证

[MIT](https://opensource.org/licenses/MIT)
