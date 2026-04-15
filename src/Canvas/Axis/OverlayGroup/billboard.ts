import _Canvas_Axis from "..";
import Overlay from "./public/overlay";
import { type OverlayType } from "./index";
import type { EventHandler } from "../public/eventController";
import { _Utility_MergeObjects, _Valid_IsNumberArray } from "../../..";
import { _Number } from "../public/tools";
import { BillboardStyleType } from "../common.type";

type ObjectFit = "fill" | "contain" | "cover" | "scale-down";
type ConstructorOption = ConstructorParameters<
  typeof Overlay<BillboardStyleType, [number, number][]>
>[0] & {
  url?: string;
  objectFit?: ObjectFit;
};

abstract class BillboardBase extends Overlay<
  BillboardStyleType,
  [number, number][]
> {
  private _ready = false;
  get ready() {
    return this._ready;
  }
  set ready(value: boolean) {
    if (this._ready != value) {
      this._ready = value;
      this.notifyReload?.();
    }
  }

  protected image = new Image();
  private _url?: string;
  get url(): string | undefined {
    return this._url;
  }
  set url(url: string | undefined) {
    if (this._url != url) {
      this._url = url;
      this.updateBaseData();
    }
  }

  private _objectFit: ObjectFit = "fill";
  get objectFit() {
    return this._objectFit;
  }
  set objectFit(value: ObjectFit) {
    if (this._objectFit != value) {
      this._objectFit = value;
      this.notifyReload?.();
    }
  }

  /** 当前广告牌绘制矩形（左上角坐标 + 宽高） */
  protected get drawRect(): {
    x: number;
    y: number;
    w: number;
    h: number;
    sx?: number;
    sy?: number;
    sw?: number;
    sh?: number;
  } {
    const { mainCanvas, finalDynamicPosition, value, image, objectFit } = this;
    const [x, y] = finalDynamicPosition[0];

    let areaWidth = image.naturalWidth;
    let areaHeight = image.naturalHeight;

    if (mainCanvas && value && value.length > 1) {
      const deltaValue = [
        value[1][0] - value[0][0],
        value[1][1] - value[0][1],
      ] as const;
      const axisSize = mainCanvas.getAxisPointByValue(
        deltaValue[0],
        deltaValue[1],
      );
      areaWidth = axisSize.x;
      areaHeight = axisSize.y;
    }

    const areaRect = {
      x,
      y,
      w: areaWidth,
      h: areaHeight,
    };

    const imageW = image.naturalWidth;
    const imageH = image.naturalHeight;

    if (imageW <= 0 || imageH <= 0 || areaRect.w <= 0 || areaRect.h <= 0)
      return areaRect;

    const areaRatio = areaRect.w / areaRect.h;
    const imageRatio = imageW / imageH;

    if (objectFit === "fill") return areaRect;

    if (objectFit === "contain" || objectFit === "scale-down") {
      const containScale = Math.min(areaRect.w / imageW, areaRect.h / imageH);
      const scale =
        objectFit === "scale-down" ? Math.min(1, containScale) : containScale;
      const w = imageW * scale;
      const h = imageH * scale;
      return {
        x: areaRect.x + (areaRect.w - w) / 2,
        y: areaRect.y + (areaRect.h - h) / 2,
        w,
        h,
      };
    }

    // cover: 目标区域固定为允许区域，通过裁剪源图实现覆盖且不超出边界
    if (imageRatio > areaRatio) {
      const sw = imageH * areaRatio;
      const sx = (imageW - sw) / 2;
      return {
        ...areaRect,
        sx,
        sy: 0,
        sw,
        sh: imageH,
      };
    }

    const sh = imageW / areaRatio;
    const sy = (imageH - sh) / 2;
    return {
      ...areaRect,
      sx: 0,
      sy,
      sw: imageW,
      sh,
    };
  }

  private loadImage() {
    this.ready = false;

    if (!this.url) return;
    this.image.onload = () => {
      this.ready = true;
    };
    this.image.onerror = () => {
      this.ready = false;
      console.error("图片加载失败");
    };
    this.image.src = this.url;
  }

  protected updateBaseData() {
    if (!this.mainCanvas) return;

    this.loadImage();

    this.handleValuePosition("array2D", 1);
  }
}

export default class Billboard extends BillboardBase {
  constructor(option: ConstructorOption) {
    super(option);

    const { url, objectFit } = option;
    Object.assign(this, { url, objectFit });

    this.addEventListener("dragg", this.defaultDragg);
  }

  defaultDragg: EventHandler<"dragg"> = (event, mouseEvent) => {
    const { offsetX, offsetY } = event.data;
    const { x, y } = this.calculateOffset(offsetX, offsetY);

    this.value!.forEach((_, index) => {
      this.value![index] = [
        _Number.add(this.value![index][0], x.value),
        _Number.add(this.value![index][1], y.value),
      ];
      this.position![index] = [
        _Number.add(this.position![index][0], x.position),
        _Number.add(this.position![index][1], y.position),
      ];
      this.dynamicPosition![index] = [
        _Number.add(this.dynamicPosition![index][0], x.dynamicPosition),
        _Number.add(this.dynamicPosition![index][1], y.dynamicPosition),
      ];
    });

    this.notifyReload?.();
    this.updateValueScope();
  };

  protected updateValueScope() {
    this.initValueScope();
  }

  isPointInPath(x: number, y: number) {
    if (this.path) return Overlay.ctx.isPointInPath(this.path, x, y);
    return false;
  }
  isPointInStroke(x: number, y: number) {
    return false;
  }

  /** 设置样式 */
  protected setOverlayStyles(ctx: CanvasRenderingContext2D) {
    const mainCanvas = this.mainCanvas!;

    const defaultStyle = mainCanvas.style[mainCanvas.theme].billboard;
    let style = {} as BillboardStyleType;
    if (typeof this.style == "string") {
      style = mainCanvas.style[this.style]?.billboard || defaultStyle;
    } else if (typeof this.style == "object") {
      style = _Utility_MergeObjects(
        JSON.parse(JSON.stringify(defaultStyle)),
        this.style,
      );
    } else {
      style = defaultStyle;
    }

    if (ctx) {
      this.setBaseLineStyle(ctx, style.stroke);
    }

    return style;
  }
  protected get computedValueScopeStyles() {
    return {};
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { mainCanvas, ready, image, isHover } = this;
    if (!mainCanvas || !ready) return;
    this.setGlobalAlpha(ctx);
    this.setOverlayStyles(ctx);

    const { x, y, w, h, sx, sy, sw, sh } = this.drawRect;

    if (
      typeof sx === "number" &&
      typeof sy === "number" &&
      typeof sw === "number" &&
      typeof sh === "number"
    ) {
      ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
    } else {
      ctx.drawImage(image, x, y, w, h);
    }
    if (isHover) ctx.strokeRect(x, y, w, h);

    // 使用 Path2D 绘制文本路径
    this.path = new Path2D();
    this.path.rect(x, y, w, h);
  }
  getDraw(): [(ctx: CanvasRenderingContext2D) => void, OverlayType] | void {
    if (this.isNeedRender) {
      if (this.isRecalculate) {
        const { position, mainCanvas } = this;
        this.internalUpdate({
          dynamicPosition: mainCanvas!.transformPosition(position!),
        });
      }

      return [this.draw, this];
    }
  }
}
