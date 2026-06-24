/**
 * 将类型 T 中指定的属性 K 改为必填，其他属性保持原有状态（必填/可选）
 * @template T - 原始类型
 * @template K - 需要改为必填的属性集合（必须是 T 的属性键）
 * @returns 新类型，其中 K 对应的属性为必填，其他属性保持 T 中原有的状态
 * @example
 * type User = { name?: string; age?: number; id: string }
 * type RequiredName = RequiredBy<User, 'name'>
 * // 结果：{ name: string; age?: number; id: string }
 */
export type _Type_RequiredBy<T, K extends keyof T> = Required<Pick<T, K>> &
  Omit<T, K>;

/**
 * 将类型 T 中指定的属性 K 改为可选，其他属性保持原有状态（必填/可选）
 * @template T - 原始类型
 * @template K - 需要改为可选的属性集合（必须是 T 的属性键）
 * @returns 新类型，其中 K 对应的属性为可选，其他属性保持 T 中原有的状态
 * @example
 * type User = { name: string; age: number; id?: string }
 * type OptionalAge = PartialBy<User, 'age'>
 * // 结果：{ name: string; age?: number; id?: string }
 */
export type _Type_PartialBy<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 * 递归将类型T的所有属性（包括嵌套对象的属性）转为可选
 * @template T - 要处理的基础类型
 * @description 与TypeScript内置的Partial不同，DeepPartial会对嵌套对象进行递归处理，
 *              使所有层级的属性都变为可选。适用于需要部分更新对象且允许深层属性缺失的场景
 */
export type _Type_DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? _Type_DeepPartial<T[P]> : T[P];
};

/**
 * @template T - 要处理的对象类型
 * @description 创建一个对象类型，将所有属性变为可变（mutable）。
 *              适用于需要修改对象属性的场景，但需要确保对象不会被其他地方引用
 */
export type _Type_Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
