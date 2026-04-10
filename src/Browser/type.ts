
/** 定义消息类型枚举，避免硬编码字符串 */
export enum ChannelMessageType {
    /** 回执消息 */
    RESPONSE = "response",
    /** 询问消息 */
    QUERY = "query",
}

/** 基础消息结构 */
export interface ChannelMessage {
    /** 消息类型 */
    type: ChannelMessageType;
    /** 消息关联的标识键 */
    responseKey: string;
    /** 标签页名称 "*" 表示所有标签页 */
    name: string;
}