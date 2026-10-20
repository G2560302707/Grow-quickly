/**
 * 微信小程序全局对象声明
 *
 * @dcloudio/types 未提供 `wx` 全局声明，而分享图落盘（wx.getFileSystemManager / wx.env）
 * 与数据导出（wx.shareFileMessage）必须用到它。这些调用都包在 `#ifdef MP-WEIXIN` 内，
 * H5 构建不会执行，因此仅做宽松声明避免类型检查报错。
 */
declare const wx: any;
