import _Canvas_Axis from "..";
import EventController from "../public/eventController";

import Text from "./text";
import Point from "./point";
import Line from "./line";
import Polygon from "./polygon";
import Custom from "./custom";
import Arc from "./arc";
import ArcTo from "./arcTo";
import Billboard from "./billboard";
// import Ellipse from "./ellipse";
// import BezierCurve from "./bezierCurve";

type ConstructorOption = ConstructorParameters<typeof EventController>[0];

export type OverlayType =
  | Text
  | Point
  | Line
  | Arc
  | ArcTo
  | Polygon
  | Billboard
  | Custom<any>;

export default class OverlayGroup extends EventController {
  /** 覆盖物集合 */
  overlays = new Set<OverlayType>();
  private oldOverlaysSize = 0;
  private get overlaysSizeChange() {
    const oldSize = this.oldOverlaysSize;
    this.oldOverlaysSize = this.overlays.size;
    return this.overlays.size !== oldSize;
  }

  constructor(option: ConstructorOption) {
    super(option);
    this.setNotifyReload(option.notifyReload);
  }
  /** 设置主画布 */
  setMainCanvas(mainCanvas?: _Canvas_Axis) {
    super.setMainCanvas(mainCanvas);
    this.overlays.forEach((overlay) => {
      overlay.setMainCanvas(mainCanvas);
      overlay.parent = this;
    });
    if (mainCanvas && this.overlays.size) this.notifyReload?.();
  }
  /** 设置覆盖物重新绘制方法 */
  setNotifyReload(notifyReload?: () => void) {
    this.notifyReload = notifyReload
      ? (needForceExecute?: boolean) => {
          if (needForceExecute) this.isRecalculate = true;
          if (
            needForceExecute ||
            this.overlaysSizeChange ||
            (this.shouldRender() && this.overlays.size)
          ) {
            notifyReload();
          }
        }
      : undefined;

    this.overlays.forEach((overlay) =>
      overlay.setNotifyReload(this.notifyReload),
    );
  }
  /** 添加覆盖物 */
  addOverlay(overlays: OverlayType[] | OverlayType) {
    [overlays].flat().forEach((overlay) => {
      overlay.setNotifyReload(this.notifyReload);
      overlay.setMainCanvas(this.mainCanvas);
      overlay.parent = this;
      this.overlays.add(overlay);
    });
    this.notifyReload?.();
  }
  /** 是否包含覆盖物 */
  hasOverlay(overlay: OverlayType) {
    return this.overlays.has(overlay);
  }
  /** 移除覆盖物 */
  removeOverlay(overlays: OverlayType[] | OverlayType) {
    [overlays].flat().forEach((overlay) => {
      this.overlays.delete(overlay);
      overlay.setNotifyReload();
      overlay.setMainCanvas();
      overlay.parent = undefined;
    });
    this.notifyReload?.();
  }
  /** 清空覆盖物 */
  clearOverlay() {
    this.notifyReload?.();
    this.overlays.forEach((overlay) => {
      overlay.setNotifyReload();
      overlay.setMainCanvas();
      overlay.parent = undefined;
    });
    this.overlays.clear();
  }

  /** 获取覆盖物的绘制方法 */
  getOverlaysDrawingMethod() {
    const groupArr: [
      number,
      [(ctx: CanvasRenderingContext2D) => void, OverlayType],
    ][] = [];

    if (this.shouldRender() && this.overlays.size) {
      Array.from(this.overlays.values())
        .sort((a, b) => a.zIndex - b.zIndex)
        .forEach((overlay) => {
          if (overlay.equalsMainCanvas(this.mainCanvas)) {
            const drawConfig = overlay.getDraw();
            if (drawConfig)
              groupArr.push([Number(overlay.zIndex) || 0, drawConfig]);
          } else {
            this.overlays.delete(overlay);
          }
        });
    }

    return groupArr;
  }
}
