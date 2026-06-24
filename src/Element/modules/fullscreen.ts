/** 获取元素 */
function GetElement(element?: HTMLElement | string) {
    if (typeof element === "string") {
        const dom = document.querySelector(element) as HTMLElement;
        if (dom) {
            return dom;
        } else {
            console.error(`Element "${element}" not found`);
        }
    } else {
        return element || document.documentElement;
    }
}
/** 进入全屏模式 */
export function _Element_EnterFullscreen(
    element?: HTMLElement | string
): Promise<void> {
    const ts_element = GetElement(element) as any;

    if (!ts_element) return Promise.reject("No Element");

    if (ts_element.requestFullscreen) {
        return ts_element.requestFullscreen();
    } else if (ts_element.mozRequestFullScreen) {
        // Firefox
        return ts_element.mozRequestFullScreen();
    } else if (ts_element.webkitRequestFullscreen) {
        // Chrome, Safari and Opera
        return ts_element.webkitRequestFullscreen();
    } else if (ts_element.msRequestFullscreen) {
        // IE/Edge
        return ts_element.msRequestFullscreen();
    }
    return Promise.reject("No Fullscreen API");
}
/** 退出全屏模式 */
export function _Element_ExitFullscreen(): Promise<void> {
    const ts_document = document as any;

    if (document.exitFullscreen) {
        return document.exitFullscreen();
    } else if (ts_document.mozCancelFullScreen) {
        // Firefox
        return ts_document.mozCancelFullScreen();
    } else if (ts_document.webkitExitFullscreen) {
        // Chrome, Safari and Opera
        return ts_document.webkitExitFullscreen();
    } else if (ts_document.msExitFullscreen) {
        // IE/Edge
        return ts_document.msExitFullscreen();
    }
    return Promise.reject("No ExitFullscreen API");
}
/** 判断是否处于全屏模式 */
export function _Element_IsFullscreen(element?: HTMLElement | string) {
    const ts_element = GetElement(element) as any;
    const ts_document = document as any;

    const fullTarget =
        document.fullscreenElement ||
        ts_document.webkitFullscreenElement ||
        ts_document.mozFullScreenElement ||
        ts_document.msFullscreenElement;

    return (
        ts_element == fullTarget ||
        (!element &&
            window.innerWidth == screen.width &&
            window.innerHeight == screen.height)
    );
}
/**
 * 返回一个用于切换全屏模式的函数
 * @param {HTMLElement} content - 需要进入全屏的元素
 * 该函数通过检查不同浏览器的特定方法来实现全屏切换
 */
export function _Element_Fullscreen(element?: HTMLElement | string) {
    element = GetElement(element);
    if (!element) return;
    return function () {
        if (_Element_IsFullscreen(element)) _Element_ExitFullscreen();
        else _Element_EnterFullscreen(element);
    };
}
/**
 * 元素全屏状态观察器
 * 监听元素的全屏状态变化，并通过回调函数通知状态改变
 * @param notify - 全屏状态变化回调函数，接收一个布尔值参数表示当前是否为全屏状态
 * @param selectors - 要观察的元素或元素选择器，默认为document.documentElement
 * @returns 返回一个清理函数，调用后可移除所有事件监听器
 */
export function _Element_FullscreenObserver(
    notify: (isFull: boolean) => void,
    selectors?: HTMLElement | string
) {
    const element = GetElement(selectors);

    if (!element) return;

    // 使用全屏事件监听而非ResizeObserver，更准确
    const handleChange = () => {
        notify(_Element_IsFullscreen(element));
    };

    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    document.addEventListener("mozfullscreenchange", handleChange);
    document.addEventListener("MSFullscreenChange", handleChange);

    // 初始状态通知
    handleChange();

    return () => {
        document.removeEventListener("fullscreenchange", handleChange);
        document.removeEventListener("webkitfullscreenchange", handleChange);
        document.removeEventListener("mozfullscreenchange", handleChange);
        document.removeEventListener("MSFullscreenChange", handleChange);
    };
}

/**
 * 全屏控制：绑定目标元素，提供进入 / 退出 / 切换；在 document 上监听各厂商全屏事件并回调当前是否以该元素全屏。
 * 构造时即注册监听；务必在不再使用时调用 {@link destroy}，避免泄漏。
 */
export class _Element_FullscreenController {
    /** 要全屏展示的目标元素 */
    private targetElement?: HTMLElement;
    /**
     * 全屏状态变化回调。参数为 `true` 表示当前全屏元素为本实例的目标元素。
     */
    onFullscreenChange?: (isFullscreen: boolean) => void;
    /** 解除 {@link attachFullscreenChangeListeners} 注册的 document 监听 */
    private detachFullscreenListeners?: () => void;

    constructor(
        targetOrSelector?: HTMLElement | string,
        onFullscreenChange?: (isFullscreen: boolean) => void,
    ) {
        this.init(targetOrSelector);
        this.onFullscreenChange = onFullscreenChange;
        this.attachFullscreenChangeListeners();
    }

    /**
     * 设置或更新目标元素（`HTMLElement` 或 CSS 选择器；未传时内部会回退到 `document.documentElement`）
     */
    init(targetOrSelector?: HTMLElement | string) {
        this.targetElement = GetElement(targetOrSelector);
    }

    /** 使目标元素进入浏览器全屏 */
    enter() {
        if (!this.targetElement) return;
        _Element_EnterFullscreen(this.targetElement);
    }

    /** 退出浏览器全屏（不区分由哪个元素进入） */
    exit() {
        if (!this.targetElement) return;
        _Element_ExitFullscreen();
    }

    /** 若当前已为该目标全屏则退出，否则进入全屏 */
    toggle() {
        if (!this.targetElement) return;
        if (_Element_IsFullscreen(this.targetElement)) this.exit();
        else this.enter();
    }

    private attachFullscreenChangeListeners() {
        const onFullscreenChangeEvent = () => {
            if (!this.targetElement || !this.onFullscreenChange) return;
            this.onFullscreenChange(_Element_IsFullscreen(this.targetElement));
        };

        document.addEventListener("fullscreenchange", onFullscreenChangeEvent);
        document.addEventListener(
            "webkitfullscreenchange",
            onFullscreenChangeEvent,
        );
        document.addEventListener(
            "mozfullscreenchange",
            onFullscreenChangeEvent,
        );
        document.addEventListener("MSFullscreenChange", onFullscreenChangeEvent);

        // 同步一次初始状态
        onFullscreenChangeEvent();

        this.detachFullscreenListeners = () => {
            document.removeEventListener(
                "fullscreenchange",
                onFullscreenChangeEvent,
            );
            document.removeEventListener(
                "webkitfullscreenchange",
                onFullscreenChangeEvent,
            );
            document.removeEventListener(
                "mozfullscreenchange",
                onFullscreenChangeEvent,
            );
            document.removeEventListener(
                "MSFullscreenChange",
                onFullscreenChangeEvent,
            );
        };
    }

    /** 移除全屏事件监听，实例不应再使用 */
    destroy() {
        this.detachFullscreenListeners?.();
        this.detachFullscreenListeners = undefined;
        this.targetElement = undefined;
        this.onFullscreenChange = undefined;
    }
}
