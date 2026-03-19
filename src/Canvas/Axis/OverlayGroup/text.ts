import _Canvas_Axis from "..";
import Overlay from "./public/overlay";
import { type OverlayType } from "./index";
import type { EventHandler } from "../public/eventController";
import { _Valid_IsNumberArray } from "../../../";
import { _Number } from "../public/tools";
import { TextStyleType } from "../common.type";

type ConstructorOption = ConstructorParameters<
  typeof Overlay<TextStyleType, [number, number]>
>[0] & {
  /** 文字 */
  text?: string;
};

export default class Text extends Overlay<TextStyleType, [number, number]> {
  /** 文字偏差 */
  private textOffset = { x: 0, y: 0 };

  private _text?: string;
  /** 文字 */
  get text(): string | undefined {
    return this._text;
  }
  set text(text: string | undefined) {
    if (this._text != text) {
      this._text = text;
      this.updateBaseData();
      this.notifyReload?.();
    }
  }

  constructor(option: ConstructorOption) {
    super(option);

    const { text } = option;
    Object.assign(this, { text });

    this.addEventListener("dragg", this.defaultDragg);
  }

  defaultDragg: EventHandler<"dragg"> = (event, mouseEvent) => {
    const { offsetX, offsetY } = event.data;
    const { x, y } = this.calculateOffset(offsetX, offsetY);

    this.internalUpdate(
      {
        value: [
          _Number.add(this.value![0], x.value),
          _Number.add(this.value![1], y.value),
        ],
        position: [
          _Number.add(this.position![0], x.position),
          _Number.add(this.position![1], y.position),
        ],
        dynamicPosition: [
          _Number.add(this.dynamicPosition![0], x.dynamicPosition),
          _Number.add(this.dynamicPosition![1], y.dynamicPosition),
        ],
      },
      true
    );

    this.notifyReload?.();
  };

  protected updateValueScope() {
    this.initValueScope();
    const textOffset = this.textOffset;
    this.setExtraScope({
      top: textOffset.y,
      bottom: textOffset.y,
      left: textOffset.x,
      right: textOffset.x,
    });
  }

  isPointInPath(x: number, y: number) {
    if (this.path) return Overlay.ctx.isPointInPath(this.path, x, y);
    return false;
  }
  isPointInStroke(x: number, y: number) {
    return false;
  }

  protected updateBaseData() {
    if (!this.mainCanvas) return;

    if (!this.text || this.text.length == 0)
      return this.internalUpdate({ dynamicPosition: undefined });

    const ctx = Overlay.ctx;
    this.setOverlayStyles(ctx);
    const textMetrics = ctx.measureText(this.text);
    this.textOffset = {
      x: textMetrics.width / 2,
      y: textMetrics.actualBoundingBoxAscent / 2,
    };

    this.handleValuePosition("array1D");
  }

  /** 设置样式 */
  setOverlayStyles(ctx: CanvasRenderingContext2D) {
    const mainCanvas = this.mainCanvas!;

    const defaultStyle = mainCanvas.style[mainCanvas.theme].text;
    let style = {} as TextStyleType;
    if (typeof this.style == "string") {
      style = mainCanvas.style[this.style]?.text || defaultStyle;
    } else if (typeof this.style == "object") {
      style = Object.assign({}, defaultStyle, this.style as any);
    } else {
      style = defaultStyle;
    }

    // 设置画布的字体样式，包括是否加粗、字体大小和字体家族
    ctx.font = `${style.bold ? "bold" : ""} ${style.size}px ${style.family}`;
    /** 设置文本的描边宽度为2px */
    ctx.lineWidth = 2;
    // // 设置文本的描边颜色为背景色，并绘制文本的描边
    ctx.strokeStyle = style.stroke;
    // 根据是否是次要颜色，选择相应的文本填充颜色，并填充文本
    ctx.fillStyle = style[this.isHover ? "secondary" : "color"];

    return style;
  }
  protected get computedValueScopeStyles() {
    return {};
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { text, textOffset, finalDynamicPosition } = this;
    if (!this.mainCanvas || !text) return;
    this.setGlobalAlpha(ctx);

    this.setOverlayStyles(ctx);

    const x = finalDynamicPosition[0] - textOffset.x;
    const y = finalDynamicPosition[1] + textOffset.y;

    // 绘制文本的描边
    ctx.strokeText(text, x, y);
    // 填充文本
    ctx.fillText(text, x, y);

    // 获取文本的路径 使用 Path2D 绘制文本路径
    this.path = new Path2D();
    this.path.rect(
      x,
      finalDynamicPosition[1] - textOffset.y,
      textOffset.x * 2,
      textOffset.y * 2
    );
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

// 待实现

// 绘制文本时文本的对齐方式
// ctx.textAlign = "center";
// 绘制文本时使用的文本基线
// ctx.textBaseline = "middle";
// 自定义单词间距：10px
// ctx.wordSpacing = "10px";
// 绘制文本时，描述当前文本方向。
// ctx.direction = "rtl";

/** 换行绘制文字 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineSpacing = 1.1 // 行间距倍数（1.1表示增加10%间距）
) {
  if (!text) return;

  // 循环查找当前行最大可显示长度（非递归版本，避免栈溢出）
  let currentY = y;
  let remainingText = text;

  while (remainingText) {
    let splitIndex = remainingText.length;

    // 找到最大可显示的子串长度
    for (let i = splitIndex; i > 0; i--) {
      const subText = remainingText.substring(0, i);
      const { width } = ctx.measureText(subText);

      if (width <= maxWidth || i == 1) {
        splitIndex = i;
        break;
      }
    }

    // 绘制当前行
    const currentText = remainingText.substring(0, splitIndex);
    ctx.strokeText(currentText, x, currentY);
    ctx.fillText(currentText, x, currentY);

    // 计算下一行Y坐标
    const { fontBoundingBoxAscent, fontBoundingBoxDescent } =
      ctx.measureText(currentText);
    const lineHeight =
      (fontBoundingBoxAscent + fontBoundingBoxDescent) * lineSpacing;
    currentY += lineHeight;

    // 处理剩余文本
    remainingText = remainingText.substring(splitIndex);
  }
}
