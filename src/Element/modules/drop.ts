/** 自定义拖拽校验与提取器 */
export interface CustomDropValidator {
  /**
   * 悬停拦截：拖拽进入/悬停时触发。
   * 此时出于安全策略无法读取文件内容，仅能通过暴露的 types 判断是否允许拖入。
   */
  matchTypes: (types: readonly string[]) => boolean;
  /**
   * 精确提取：拖拽放下（drop）时触发。
   * 遍历 dataTransfer.items 的每一项，返回 true 代表将该项提取并交由回调处理。
   */
  matchItem: (item: DataTransferItem) => boolean;
}

/** 拖放区接受的拖拽数据类型 */
export type DropTargetType =
  | "text"
  | "file"
  | "image"
  | "video"
  | "audio"
  | "application"
  // 保留单一下拉提示
  | `.${string}`
  | `${string}/${string}`
  // 支持逗号拼接混合类型，例如 ".xml,.bpmn,text/xml,image/*"
  | (string & {})
  | CustomDropValidator;

/** 单一拖放规则配置 */
export interface DropZoneRule {
  /** 允许传入单一类型或多种类型组合的数组 */
  targetType?: DropTargetType | DropTargetType[];
  /** 拖放回调 */
  dropCallback: (data: any[]) => void;
  /** 当前规则匹配成功时的激活回调 */
  activeCallback?: (active: boolean) => void;
}

/** 注册拖放区时的配置 */
export type DropZoneOption = {
  /** 拖放区元素 */
  dom: HTMLElement | string;
  /** 拖放区全局激活回调（只要有任意规则匹配就会触发） */
  activeCallback?: (active: boolean) => void;
} & (
  | DropZoneRule // 兼容单一规则配置
  | {
      /** 多规则配置（允许对不同类型独立处理） */
      rules: DropZoneRule[];
    }
);

/** 内部维护的拖放区状态实体 */
interface DropZoneEntry {
  dom: HTMLElement;
  rules: DropZoneRule[];
  globalActiveCallback?: (active: boolean) => void;
  dragDepth: number;
  isActive: boolean;
  activeRules: Set<DropZoneRule>;
}

const FILE_MIME_PREFIX: Record<
  "image" | "video" | "audio" | "application",
  string
> = {
  image: "image/",
  video: "video/",
  audio: "audio/",
  application: "application/",
};

function getElement(dom: HTMLElement | string): HTMLElement | null {
  return typeof dom === "string"
    ? document.querySelector<HTMLElement>(dom)
    : dom;
}

function isTextDrag(types: readonly string[]): boolean {
  return types.some(
    (type) => type === "text/plain" || type.startsWith("text/"),
  );
}

function isFileDrag(types: readonly string[]): boolean {
  return types.includes("Files");
}

/**
 * 判断是否为包含特殊匹配符（如点号后缀或斜杠 MIME）的匹配字符串
 */
function isAcceptString(type: DropTargetType): type is string {
  return typeof type === "string" && (type.includes(".") || type.includes("/"));
}

/**
 * 校验文件，支持后缀名、精准 MIME type 以及泛 MIME type (如 image/*)
 * @param acceptString 例如 ".xml, .bpmn, text/xml, image/*"
 */
function fileMatchesAccept(file: File, acceptString: string): boolean {
  if (!acceptString) return true;

  const accepts = acceptString.split(",").map((a) => a.trim().toLowerCase());
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return accepts.some((accept) => {
    // 1. 后缀名匹配 (例如 ".xml", ".bpmn")
    if (accept.startsWith(".")) {
      return fileName.endsWith(accept);
    }
    // 2. 泛 MIME 类型匹配 (例如 "image/*", "video/*")
    if (accept.endsWith("/*")) {
      const mimeClass = accept.replace("/*", "/");
      return fileType.startsWith(mimeClass);
    }
    // 3. 精确 MIME 类型匹配 (例如 "text/xml", "application/xml")
    return fileType === accept;
  });
}

/**
 * 综合类型的拦截判断，完全解耦 DragEvent，仅依赖 DataTransfer.types
 */
function acceptsTarget(
  targetType: DropTargetType | DropTargetType[] | undefined,
  types: readonly string[],
): boolean {
  if (!targetType) return true;

  const targetTypes = Array.isArray(targetType) ? targetType : [targetType];

  return targetTypes.some((type) => {
    if (typeof type === "object" && type !== null && "matchTypes" in type) {
      return type.matchTypes(types);
    }
    if (type === "text") return isTextDrag(types);
    if (isAcceptString(type) || type === "file" || type in FILE_MIME_PREFIX) {
      return isFileDrag(types);
    }
    return false;
  });
}

/**
 * 解析并提取拖拽数据，对 DataTransferItem 和 File 进行去重与分类提取
 */
async function getTarget(
  targetType: DropTargetType | DropTargetType[] | undefined,
  dataTransfer: DataTransfer | null,
): Promise<unknown[]> {
  if (!dataTransfer) return [];

  const files = Array.from(dataTransfer.files);
  const items = Array.from(dataTransfer.items);

  if (!targetType) return [...files, ...items];

  const targetTypes = Array.isArray(targetType) ? targetType : [targetType];
  const resultFiles = new Set<File>();
  const textItemsToExtract = new Set<DataTransferItem>();

  // 1. 遍历规则并精准过滤对应数据项
  for (const type of targetTypes) {
    if (typeof type === "object" && type !== null && "matchItem" in type) {
      items.forEach((item) => {
        if (type.matchItem(item)) {
          if (item.kind === "file") {
            const f = item.getAsFile();
            if (f) resultFiles.add(f);
          } else if (item.kind === "string") {
            textItemsToExtract.add(item);
          }
        }
      });
    } else if (type === "text") {
      items.forEach((item) => {
        if (item.type === "text/plain" || item.type.startsWith("text/")) {
          textItemsToExtract.add(item);
        }
      });
    } else if (type === "file") {
      files.forEach((f) => resultFiles.add(f));
    } else if (isAcceptString(type)) {
      files.forEach((f) => {
        if (fileMatchesAccept(f, type)) resultFiles.add(f);
      });
    } else if (type in FILE_MIME_PREFIX) {
      const prefix = FILE_MIME_PREFIX[type as keyof typeof FILE_MIME_PREFIX];
      files.forEach((f) => {
        if (f.type.startsWith(prefix)) resultFiles.add(f);
      });
    }
  }

  const results: unknown[] = Array.from(resultFiles);

  // 2. 统一并发读取文本数据
  if (textItemsToExtract.size > 0) {
    const textPromises = Array.from(textItemsToExtract).map(
      (item) => new Promise<string>((resolve) => item.getAsString(resolve)),
    );
    const texts = await Promise.all(textPromises);
    results.push(...texts);
  }

  return results;
}

export class _Element_DropZoneManager {
  private entries = new Map<HTMLElement, DropZoneEntry>();

  private extractRules(config: DropZoneOption): DropZoneRule[] {
    if ("rules" in config && Array.isArray(config.rules)) {
      return config.rules;
    }
    const singleRule = config as DropZoneRule;
    return [
      {
        targetType: singleRule.targetType,
        dropCallback: singleRule.dropCallback,
        activeCallback: singleRule.activeCallback,
      },
    ];
  }

  add(config: DropZoneOption) {
    const dom = getElement(config.dom);
    if (!dom || this.entries.has(dom)) return;

    const rules = this.extractRules(config);

    dom.addEventListener("dragenter", this.onDragEnter);
    dom.addEventListener("dragleave", this.onDragLeave);
    dom.addEventListener("dragover", this.onDragOver);
    dom.addEventListener("drop", this.onDrop);

    this.entries.set(dom, {
      dom,
      rules,
      globalActiveCallback: config.activeCallback,
      dragDepth: 0,
      isActive: false,
      activeRules: new Set(),
    });
  }

  delete(dom: HTMLElement | string) {
    const element = getElement(dom);
    if (!element || !this.entries.has(element)) return;

    element.removeEventListener("dragenter", this.onDragEnter);
    element.removeEventListener("dragleave", this.onDragLeave);
    element.removeEventListener("dragover", this.onDragOver);
    element.removeEventListener("drop", this.onDrop);

    this.entries.delete(element);
  }

  destroy() {
    this.entries.keys().forEach((dom) => this.delete(dom));
  }

  private onDragEnter = (event: DragEvent) => {
    const dom = event.currentTarget as HTMLElement;
    const entry = this.entries.get(dom);
    if (!entry) return;

    const types = event.dataTransfer
      ? Array.from(event.dataTransfer.types)
      : [];
    const matchingRules = entry.rules.filter((rule) =>
      acceptsTarget(rule.targetType, types),
    );

    if (matchingRules.length === 0) return;

    entry.dragDepth += 1;
    if (entry.dragDepth === 1) {
      entry.isActive = true;
      entry.globalActiveCallback?.(true);

      matchingRules.forEach((rule) => {
        entry.activeRules.add(rule);
        rule.activeCallback?.(true);
      });
    }
  };

  private onDragLeave = (event: DragEvent) => {
    const dom = event.currentTarget as HTMLElement;
    const entry = this.entries.get(dom);
    if (!entry) return;

    entry.dragDepth = Math.max(0, entry.dragDepth - 1);

    if (entry.dragDepth === 0 && entry.isActive) {
      entry.isActive = false;
      entry.globalActiveCallback?.(false);
      entry.activeRules.forEach((rule) => rule.activeCallback?.(false));
      entry.activeRules.clear();
    }
  };

  private onDragOver = (event: DragEvent) => {
    const dom = event.currentTarget as HTMLElement;
    const entry = this.entries.get(dom);
    if (!entry) return;

    const types = event.dataTransfer
      ? Array.from(event.dataTransfer.types)
      : [];
    const hasMatching = entry.rules.some((rule) =>
      acceptsTarget(rule.targetType, types),
    );
    if (!hasMatching) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };

  private onDrop = async (event: DragEvent) => {
    const dom = event.currentTarget as HTMLElement;
    const entry = this.entries.get(dom);
    if (!entry) return;

    const types = event.dataTransfer
      ? Array.from(event.dataTransfer.types)
      : [];
    const matchingRules = entry.rules.filter((rule) =>
      acceptsTarget(rule.targetType, types),
    );
    if (matchingRules.length === 0) return;

    event.preventDefault();

    entry.dragDepth = 0;
    entry.isActive = false;
    entry.globalActiveCallback?.(false);
    entry.activeRules.forEach((rule) => rule.activeCallback?.(false));
    entry.activeRules.clear();

    matchingRules.forEach(async (rule) => {
      const data = await getTarget(rule.targetType, event.dataTransfer);
      rule.dropCallback(data);
    });
  };
}
