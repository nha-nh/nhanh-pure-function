/**
 * 视图适配工具：根据内容尺寸与容器尺寸计算默认缩放与居中位置，供画布/图像适配使用。
 */
export default class ViewFit {
  /**
   * 计算默认缩放比例，使图像适配视图容器
   * @param naturalWidth 图像原始宽度
   * @param naturalHeight 图像原始高度
   * @param viewWidth 容器宽度
   * @param viewHeight 容器高度
   * @param step 缩放步长
   * @param factor 每翻一倍对应的增量（factor / step = 10）
   * @returns 缩放比例（步长 0.02），小于1表示缩小，大于1表示放大
   */
  static computeDefaultScale(
    naturalWidth: number,
    naturalHeight: number,
    viewWidth: number,
    viewHeight: number,
    step = 0.02,
    factor = 0.2,
  ): number {
    const widthRatio = naturalWidth / viewWidth;
    const heightRatio = naturalHeight / viewHeight;

    // 需要缩小的情况：至少一个方向超出容器
    if (widthRatio > 1 || heightRatio > 1) {
      // 取较紧张的方向作为基准
      const ratio = Math.max(widthRatio, heightRatio);
      const k = Math.floor(Math.log2(ratio)); // 翻倍次数（向下取整）
      const t = (k + ratio / Math.pow(2, k) - 1) * factor; // 累计增量
      const steps = Math.ceil(t / step); // 向上取整，确保图像不超出
      return 1 - steps * step;
    }

    // 需要放大的情况：图像小于容器
    const ratio = Math.min(viewWidth / naturalWidth, viewHeight / naturalHeight);
    const k = Math.floor(Math.log2(ratio));
    const t = (k + ratio / Math.pow(2, k) - 1) * factor;
    const steps = Math.floor(t / step); // 向下取整，同样确保不超出
    return 1 + steps * step;
  }

  /**
   * 计算默认居中偏移，使内容在视图中居中
   * @param naturalWidth 图像/内容原始宽度
   * @param naturalHeight 图像/内容原始高度
   * @param viewWidth 容器宽度
   * @param viewHeight 容器高度
   * @returns 居中时的 left、top 偏移
   */
  static computeDefaultCenter(
    naturalWidth: number,
    naturalHeight: number,
    viewWidth: number,
    viewHeight: number,
  ): { left: number; top: number } {
    return {
      left: (naturalWidth - viewWidth) / -2,
      top: (naturalHeight - viewHeight) / -2,
    };
  }
}
