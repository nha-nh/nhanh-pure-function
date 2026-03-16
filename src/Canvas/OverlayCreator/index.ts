import _Canvas from "..";
import Line from "../OverlayGroup/line";
import Polygon from "../OverlayGroup/polygon";
import type { EventHandler } from "../public/eventController";

/**
 * 管理单次「创建覆盖物」的交互（从开始绘制到完成/取消）。
 * 覆盖物有两种定位方式：value = 坐标轴上的值 [x,y][]，position = 画布上的位置 px；本类通过 overlay.value 定位。
 */
export default class OverlayCreator {
  /** 绑定的画布实例 */
  private canvas: _Canvas;
  private layerGroup = new _Canvas.LayerGroup({ name: "创建覆盖物图层群组" });
  /** 创建中覆盖物的绘制层（置顶以保证可见） */
  private overlayLayer = new _Canvas.Layer({
    name: "creator-layer",
    zIndex: 9999,
  });
  /** 该层内的覆盖物分组，便于统一增删 */
  private overlayGroup = new _Canvas.OverlayGroup({ name: "creator-group" });

  /** 当前正在创建的覆盖物（多边形或线），其顶点通过 overlay.value 即坐标轴上的值表示 */
  private overlay?: Polygon | Line;
  /** 已确定的顶点在坐标轴上的值列表 [x, y][]，对应 overlay.value */
  private axisValueList?: [number, number][];

  /** 创建时暂存的其他图层群组的 isInteractive，编辑完成后用于复原 */
  private savedLayerGroupInteractive = new Map<
    InstanceType<typeof _Canvas.LayerGroup>,
    boolean
  >();

  /**
   * 用户自定义限位器：传入原始 value [x, y]（坐标轴上的值），约束到合法范围后返回。
   */
  axisValueLimiter?: (value: [number, number]) => [number, number];

  constructor(canvas: _Canvas) {
    this.canvas = canvas;

    this.overlayLayer.addGroup(this.overlayGroup);
    this.layerGroup.addLayer(this.overlayLayer);
    canvas.setLayerGroup(this.layerGroup);

    canvas.addEventListener("click", this.handleClick);
    canvas.addEventListener("contextmenu", this.handleContextmenu);
    canvas.canvas.addEventListener("mousemove", this.handleMousemove);
  }

  /** 按类型开始创建：多边形或线 */
  create(type: "polygon" | "line") {
    if (type === "polygon") return this.createPolygon();
    else if (type === "line") return this.createLine();
  }
  /** 禁用除创建层外的其他图层群组交互，并记录原始 isInteractive 以便复原 */
  private disableOtherLayerGroups() {
    this.canvas.layerGroups.forEach((layerGroup) => {
      if (this.layerGroup !== layerGroup) {
        if (!this.savedLayerGroupInteractive.has(layerGroup)) {
          this.savedLayerGroupInteractive.set(
            layerGroup,
            layerGroup.isInteractive,
          );
        }
        layerGroup.isInteractive = false;
      }
    });
  }

  /** 复原此前禁用的图层群组的 isInteractive */
  private restoreLayerGroupsInteractive() {
    this.savedLayerGroupInteractive.forEach((value, layerGroup) => {
      layerGroup.isInteractive = value;
    });
    this.savedLayerGroupInteractive.clear();
  }

  createLine() {
    this.disableOtherLayerGroups();
    if (this.overlay) this.overlayGroup.removeOverlays(this.overlay);
    this.axisValueList = [];
    this.overlay = new _Canvas.Line({});
    this.overlayGroup.addOverlays(this.overlay);
    return this.overlay;
  }
  createPolygon() {
    this.disableOtherLayerGroups();
    if (this.overlay) this.overlayGroup.removeOverlays(this.overlay);
    this.axisValueList = [];
    this.overlay = new _Canvas.Polygon({});
    this.overlayGroup.addOverlays(this.overlay);
    return this.overlay;
  }

  finish?: (overlay?: Polygon | Line) => void;

  /** 从创建层中移除指定覆盖物，不传则清空该层全部 */
  removeOverlays(overlay?: Polygon | Line) {
    if (overlay) this.overlayGroup.removeOverlays(overlay);
    else this.overlayGroup.clearOverlays();
  }

  /** 清空创建层并重置当前创建状态 */
  clear() {
    this.restoreLayerGroupsInteractive();
    this.overlayGroup.clearOverlays();
    this.overlay = undefined;
    this.axisValueList = undefined;
  }

  /** 销毁实例：清空覆盖物并移除所有事件监听 */
  destroy() {
    this.clear();
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.removeEventListener("contextmenu", this.handleContextmenu);
    this.canvas.canvas.removeEventListener("mousemove", this.handleMousemove);
  }

  /** 当前类型完成绘制所需的最少顶点数（多边形 3，线 2） */
  private get minPointCount() {
    if (this.overlay instanceof _Canvas.Polygon) {
      return 3;
    } else if (this.overlay instanceof _Canvas.Line) {
      return 2;
    } else {
      return 0;
    }
  }

  /** 从鼠标事件得到坐标轴上的 [x, y]，若设置了限位器则先限位再返回 */
  private getAxisValueFromEvent(event: MouseEvent) {
    const point = this.canvas.getMousePositionOnAxis(event);
    if (point) {
      const { xV, yV } = this.canvas.getAxisValueByPoint(point.x, point.y);
      let axisValue: [number, number] = [xV, yV];
      if (this.axisValueLimiter) {
        axisValue = this.axisValueLimiter(axisValue);
      }
      return axisValue;
    }
  }

  /** 鼠标移动：用已确定顶点 + 当前鼠标的坐标轴值更新 overlay.value 预览（至少有一个确定点后才生效） */
  private handleMousemove = (event: MouseEvent) => {
    if (!this.overlay || !event || (this.axisValueList?.length ?? 0) === 0)
      return;
    const cursorAxisValue = this.getAxisValueFromEvent(event);

    if (cursorAxisValue) {
      const previewAxisValues = [
        ...(this.axisValueList || []),
        cursorAxisValue,
      ];
      const padCount = this.minPointCount - previewAxisValues.length;
      Array.from({ length: padCount }).forEach(() =>
        previewAxisValues.push(cursorAxisValue),
      );
      this.overlay.value = previewAxisValues;
    }
  };

  /** 左键点击：将当前坐标轴值追加为顶点并刷新 overlay.value 预览 */
  private handleClick: EventHandler<"click"> = (event, mouse) => {
    if (!this.overlay || !mouse) return;
    const axisValue = this.getAxisValueFromEvent(mouse);
    if (axisValue) {
      this.axisValueList = [...(this.axisValueList || []), axisValue];
      this.handleMousemove(mouse);
    }
  };

  /** 右键：若顶点数达标则写回 overlay.value 并回调完成，否则移除当前覆盖物并取消创建 */
  private handleContextmenu: EventHandler<"contextmenu"> = (event, mouse) => {
    if (!this.overlay) return;

    const vertexCount = this.axisValueList?.length ?? 0;
    if (vertexCount >= this.minPointCount) {
      this.overlay.value = this.axisValueList;
      this.finish?.(this.overlay);
    } else {
      this.overlayGroup.removeOverlays(this.overlay);
    }

    this.overlay = undefined;
    this.axisValueList = undefined;
    this.restoreLayerGroupsInteractive();
  };
}
