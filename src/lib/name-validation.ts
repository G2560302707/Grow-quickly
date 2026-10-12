/**
 * 错题本/标签名字编码校验。
 *
 * 背景：错误题本名字混入乱码（如 GBK 源被按 UTF-8 解码时，中文字符会变成
 * U+FFFD 替换符，字节 EF BF BD）。这类名字一旦写入再想识别/修复都很麻烦，
 * 因此在所有写入入口统一拦截。
 *
 * 拒绝规则：
 *  - 含 U+FFFD 替换符 (�)——解码损坏的典型标记
 *  - 含控制字符（\u0000-\u001F、\u007F）——前端输入框基本不会产生，视为脏数据
 */
const INVALID_NAME_RE = /[�\u0000-\u001F\u007F]/;

/** 名字是否能安全写入（非空、不含解码损坏标记或控制字符） */
export function isValidNotebookName(name: unknown): name is string {
    return typeof name === "string" && name.trim().length > 0 && !INVALID_NAME_RE.test(name);
}

/** 用可读说明名字为何被拒；合法时返回 null */
export function notebookNameError(name: unknown): string | null {
    if (typeof name !== "string" || name.trim().length === 0) {
        return "notebook name is required";
    }
    if (INVALID_NAME_RE.test(name)) {
        return "notebook name contains invalid encoding";
    }
    return null;
}