import type LayerGroup from "./LayerGroup";
import OverlayGroup, { type OverlayType } from "./OverlayGroup";
import type Layer from "./LayerGroup/layer";
import type Point from "./OverlayGroup/point";
import type Text from "./OverlayGroup/text";
import type Line from "./OverlayGroup/line";
import type Polygon from "./OverlayGroup/polygon";
import type Axis from "./core/axis";
import type Custom from "./OverlayGroup/custom";
import type Arc from "./OverlayGroup/arc";
import type ArcTo from "./OverlayGroup/arcTo";
import type OverlayCreatorByAxisValue from "./OverlayCreator";
import type ViewFit from "./public/viewFit";
import type { EventHandler } from "./public/eventController";
import type Overlay from "./OverlayGroup/public/overlay";
// import type  Ellipse from "./OverlayGroup/ellipse";
// import type  BezierCurve from "./OverlayGroup/bezierCurve";

// class b {
//   b = 2;
// }
// class c {
//   static B = b;
//   c = 3;
// }
// const arr: InstanceType<(typeof c)["B"]>[] = [];
// const b1 = new c.B();
// arr.push(b1);

// let a :Overlay
export type {
  //#region 集合
  LayerGroup,
  OverlayGroup,
  Layer,
  //#endregion

  //#region 覆盖物
  OverlayType,
  Overlay,
  Point,
  Text,
  Line,
  Polygon,
  Axis,
  Custom,
  Arc,
  ArcTo,
  OverlayCreatorByAxisValue,
  ViewFit,
  // Ellipse,
  // BezierCurve,
  //#endregion

  //#region 事件
  EventHandler,
  //#endregion
};
