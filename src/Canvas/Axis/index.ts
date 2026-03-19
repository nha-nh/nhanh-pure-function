import "./index.less";
export type * from "./index.types";
import QuickMethod from "./core/quikmethod";
import LayerGroup from "./LayerGroup";
import OverlayGroup, { type OverlayType } from "./OverlayGroup";
import Layer from "./LayerGroup/layer";
import Point from "./OverlayGroup/point";
import Text from "./OverlayGroup/text";
import Line from "./OverlayGroup/line";
import Polygon from "./OverlayGroup/polygon";
import Axis from "./core/axis";
import Custom from "./OverlayGroup/custom";
import Arc from "./OverlayGroup/arc";
import ArcTo from "./OverlayGroup/arcTo";
import OverlayCreator from "./OverlayCreator";
import ViewFit from "./public/viewFit";
import { DeepArray } from "./common.type";
// import Ellipse from "./OverlayGroup/ellipse";
// import BezierCurve from "./OverlayGroup/bezierCurve";

type ConstructorOption = ConstructorParameters<typeof QuickMethod>[0] & {
  /** 轴线显示属性 */
  axisShow?: Parameters<_Canvas_Axis["toggleAxis"]>[0];
};

function FlattenAll<T>(arr: any): T[] {
  return [arr].flat(Infinity) as T[];
}

/**
 * 你好啊你好的画布工具类
 * 提供图形绘制、动态渲染等画布相关功能，支持复杂场景下的可视化展示
 *
 * 使用示例:
 * - GitHub演示:
 *   - 基础画布: https://nha-nh.github.io/canvas/_Canvas_Axis
 *   - 动态图表(月牙定理): https://nha-nh.github.io/math/DynamicDiagram/%E6%9C%88%E7%89%99%E5%AE%9A%E7%90%86
 */
export class _Canvas_Axis extends QuickMethod {
  /** 视图适配工具：默认缩放、居中计算 */
  static ViewFit = ViewFit;


  /** 图层群组 */
  static LayerGroup = LayerGroup;
  /** 图层 */
  static Layer = Layer;
  /** 覆盖物群组 */
  static OverlayGroup = OverlayGroup;

  /** 文字 */
  static Text = Text;
  /** 点位 */
  static Point = Point;
  /** 线段 */
  static Line = Line;
  /** 多边形 */
  static Polygon = Polygon;
  /** 自定义绘制 */
  static Custom = Custom;
  /** 圆弧 */
  static Arc = Arc;
  /** 圆角 */
  static ArcTo = ArcTo;
  /** 按坐标轴值创建覆盖物（多边形/线）的交互管理 */
  overlayCreator: OverlayCreator;

  constructor(option: ConstructorOption) {
    super(option);

    this.drawAxis = new Axis(this);

    if ("axisShow" in option) this.toggleAxis(option.axisShow);

    this.overlayCreator = new OverlayCreator(this);
    this.initLayerGroups();
    this.updateCenter();
  }

  private initLayerGroups() {
    const layer_polygon = new Layer({ name: "多边形图层", zIndex: 1 });
    layer_polygon.addGroup(new OverlayGroup({ name: "多边形覆盖物群组" }));

    const layer_line = new Layer({ name: "线段图层", zIndex: 2 });
    layer_line.addGroup(new OverlayGroup({ name: "线段覆盖物群组" }));

    const layer_point = new Layer({ name: "点位图层", zIndex: 3 });
    layer_point.addGroup(new OverlayGroup({ name: "点位覆盖物群组" }));

    const layer_text = new Layer({ name: "文字图层", zIndex: 4 });
    layer_text.addGroup(new OverlayGroup({ name: "文字覆盖物群组" }));

    const layer_custom = new Layer({ name: "自定义绘制图层", zIndex: 5 });
    layer_custom.addGroup(new OverlayGroup({ name: "自定义绘制覆盖物群组" }));

    const layerGroup = new LayerGroup({ name: "默认图层群组" });
    layerGroup.addLayer([
      layer_text,
      layer_point,
      layer_line,
      layer_polygon,
      layer_custom,
    ]);

    this.setLayerGroup(layerGroup);


  }
  /** 获取图层群组 集合 */
  gteLayerGroups(key = "默认图层群组") {
    return this.layerGroups.get(key);
  }
  /** 设置图层群组 */
  setLayerGroup(layerGroup: LayerGroup) {
    if (layerGroup instanceof LayerGroup) {
      this.layerGroups.set(layerGroup.name, layerGroup);
      layerGroup.setNotifyReload(() => this.redrawOnce());
      layerGroup.setMainCanvas(this);
      layerGroup.parent = this;
    }
  }
  /** 移除图层群组 */
  removeLayerGroup(layerGroup: LayerGroup) {
    if (layerGroup instanceof LayerGroup) {
      this.layerGroups.delete(layerGroup.name);
      layerGroup.setNotifyReload();
      layerGroup.setMainCanvas();
      layerGroup.parent = undefined;
      this.redrawOnce();
    }
  }
  /** 添加图层 */
  addLayer(layers: DeepArray<Layer>) {
    const layerGroup = this.layerGroups.get("默认图层群组");
    if (!layerGroup) return;
    layerGroup.addLayer(FlattenAll(layers));
  }
  /** 移除图层 */
  removeLayer(layers: DeepArray<Layer>) {
    const layerGroup = this.layerGroups.get("默认图层群组");
    if (!layerGroup) return;
    layerGroup.removeLayer(FlattenAll(layers));
  }
  /** 添加覆盖物 */
  addOverlay(overlays: DeepArray<OverlayType>) {
    const {
      overlays_text,
      overlays_point,
      overlays_line,
      overlays_polygon,
      overlays_custom,
    } = this.getDefaultOverlayGroup() || {};

    FlattenAll<OverlayType>(overlays).forEach((overlay) => {
      if (overlay instanceof Text) overlays_text?.addOverlays(overlay);
      else if (overlay instanceof Point) overlays_point?.addOverlays(overlay);
      else if (
        overlay instanceof Line ||
        overlay instanceof Arc ||
        overlay instanceof ArcTo
      )
        overlays_line?.addOverlays(overlay);
      else if (overlay instanceof Polygon)
        overlays_polygon?.addOverlays(overlay);
      else if (overlay instanceof Custom) overlays_custom?.addOverlays(overlay);
    });
  }
  /** 移除覆盖物 */
  removeOverlay(overlays: DeepArray<OverlayType>) {
    const {
      overlays_text,
      overlays_point,
      overlays_line,
      overlays_polygon,
      overlays_custom,
    } = this.getDefaultOverlayGroup() || {};
    FlattenAll<OverlayType>(overlays).forEach((overlay) => {
      if (overlay instanceof Text) overlays_text?.removeOverlays(overlay);
      else if (overlay instanceof Point)
        overlays_point?.removeOverlays(overlay);
      else if (overlay instanceof Line) overlays_line?.removeOverlays(overlay);
      else if (overlay instanceof Polygon)
        overlays_polygon?.removeOverlays(overlay);
      else if (overlay instanceof Custom) overlays_custom?.addOverlays(overlay);
    });
  }

  /** 销毁 */
  destroy() {
    super.destroy();
  }
}

export default _Canvas_Axis;

