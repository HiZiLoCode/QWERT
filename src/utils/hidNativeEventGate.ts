let suspendDepth = 0;

/**
 * requestDevice 弹窗期间标记为「暂停 HID 原生事件分发」。
 * 实际移除 connect/disconnect 监听器由 WebHid.requestDevice 负责。
 */
export function suspendNavigatorHidNativeEvents() {
  suspendDepth += 1;
}

export function resumeNavigatorHidNativeEvents() {
  suspendDepth = Math.max(0, suspendDepth - 1);
}

export function areNavigatorHidNativeEventsSuspended(): boolean {
  return suspendDepth > 0;
}
