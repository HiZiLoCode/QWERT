/**
 * USB设备监控模块
 * 基于WebHID API监控USB设备的连接和断开事件
 */

// 定义HID设备事件类型，用于WebHID API的类型补充
interface HIDConnectionEvent extends Event {
  device: HIDDevice;
}

// 监控事件类型
type USBMonitorEvent = 'connect' | 'disconnect' | 'remove';

// 回调函数类型
type USBEventCallback = (device: HIDDevice) => void;

/**
 * USB设备检测类
 * 提供USB设备连接和断开事件的监控功能
 */
export class USBDetect {
  // 事件监听器容器
  private static _listeners: Record<USBMonitorEvent, Set<USBEventCallback>> = {
    connect: new Set(),
    disconnect: new Set(),
    remove: new Set() // 添加对'remove'事件的支持，用于向后兼容
  };

  // 监控状态
  private static _isMonitoring = false;
  private static _hasInitialized = false;

  /**
   * 开始监控USB设备事件
   * 注册WebHID API事件监听器
   */
  public static startMonitoring(): void {
    if (this._isMonitoring) return;
    
    this._isMonitoring = true;
    
    // 确保只初始化一次事件监听
    if (!this._hasInitialized && navigator.hid) {
      try {
        navigator.hid.addEventListener('connect', this.onConnect);
        navigator.hid.addEventListener('disconnect', this.onDisconnect);
        this._hasInitialized = true;
      } catch (error) {
        console.error('启动USB设备监控失败:', error);
        this._isMonitoring = false;
      }
    }
  }

  /**
   * 停止监控USB设备事件
   * 注意：这只会暂停事件分发，不会移除事件监听器
   */
  public static stopMonitoring(): void {
    this._isMonitoring = false;
  }

  /**
   * 完全清理所有资源
   * 移除所有事件监听器和回调
   */
  public static cleanup(): void {
    if (navigator.hid && this._hasInitialized) {
      try {
        // 移除WebHID API事件监听
        navigator.hid.removeEventListener('connect', this.onConnect);
        navigator.hid.removeEventListener('disconnect', this.onDisconnect);
        
        // 清空所有回调
        this._listeners.connect.clear();
        this._listeners.disconnect.clear();
        this._listeners.remove.clear();
        
        this._hasInitialized = false;
        this._isMonitoring = false;
      } catch (error) {
        console.error('清理USB设备监控资源失败:', error);
      }
    }
  }

  /**
   * 设备连接事件处理器
   */
  private static onConnect = (event: HIDConnectionEvent): void => {
    if (!this._isMonitoring) return;
    
    const { device } = event;
    this.dispatchEvent('connect', device);
  };

  /**
   * 设备断开事件处理器
   */
  private static onDisconnect = (event: HIDConnectionEvent): void => {
    if (!this._isMonitoring) return;
    
    const { device } = event;
    
    // 同时触发'disconnect'和'remove'事件，确保向后兼容
    this.dispatchEvent('disconnect', device);
    this.dispatchEvent('remove', device);
  };

  /**
   * 分发事件到所有注册的回调
   */
  private static dispatchEvent(eventName: USBMonitorEvent, device: HIDDevice): void {
    // 创建回调数组的副本进行遍历，避免在回调执行过程中修改集合导致问题
    const callbacks = Array.from(this._listeners[eventName]);
    
    if (callbacks.length === 0) {
      return;
    }
    
    callbacks.forEach((callback) => {
      try {
        callback(device);
      } catch (error) {
        console.error(`执行${eventName}事件回调时出错:`, error);
      }
    });
  }

  /**
   * 注册事件监听器
   * @param eventName 事件名称 ('connect' | 'disconnect' | 'remove')
   * @param callback 回调函数
   */
  public static on(eventName: USBMonitorEvent, callback: USBEventCallback): void {
    if (!callback || typeof callback !== 'function') {
      console.error('无效的回调函数');
      return;
    }
    
    // 检查事件类型是否有效
    if (!this._listeners[eventName]) {
      console.error(`不支持的事件类型: ${eventName}`);
      return;
    }
    
    // 添加回调到Set中，自动去重
    this._listeners[eventName].add(callback);
  }

  /**
   * 移除事件监听器
   * @param eventName 事件名称 ('connect' | 'disconnect' | 'remove')
   * @param callback 回调函数
   */
  public static off(eventName: USBMonitorEvent, callback: USBEventCallback): void {
    if (!callback) return;
    
    // 检查事件类型是否有效
    if (!this._listeners[eventName]) {
      console.error(`不支持的事件类型: ${eventName}`);
      return;
    }
    
    // 从Set中移除回调
    this._listeners[eventName].delete(callback);
  }

  /**
   * 检查是否正在监控
   * @returns 是否正在监控
   */
  public static isMonitoring(): boolean {
    return this._isMonitoring;
  }
}

// 为了向后兼容，保留原始类名的导出
export const usbDetect = USBDetect;
