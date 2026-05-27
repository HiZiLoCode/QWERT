export type WebHIDUnsupportedReason = "no_api" | "insecure_context" | "in_app_browser";

export type WebHIDSupportInfo = {
  isSupported: boolean;
  browserName: string;
  reason?: WebHIDUnsupportedReason;
};

/** Desktop browsers with stable WebHID (Chrome 89+, Edge 89+, Opera 76+). */
export const WEBHID_RECOMMENDED_BROWSERS =
  "Google Chrome 89+, Microsoft Edge 89+, Opera 76+";

/** App 内置 WebView（含微信）即使用 Chromium 内核也不支持完整 WebHID。 */
function isInAppBrowserWithoutWebHID(userAgent: string): boolean {
  return (
    /MicroMessenger/i.test(userAgent) ||
    /QQ\//i.test(userAgent) ||
    /AlipayClient/i.test(userAgent) ||
    /Weibo/i.test(userAgent) ||
    /DingTalk/i.test(userAgent) ||
    /Lark|Feishu/i.test(userAgent)
  );
}

function detectBrowserName(userAgent: string): string {
  if (/MicroMessenger/i.test(userAgent)) return "微信内置浏览器";
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/OPR\//.test(userAgent) || /Opera/i.test(userAgent)) return "Opera";
  if (/Chrome\//.test(userAgent)) return "Google Chrome";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "Unknown";
}

/**
 * Whether the current environment can use the WebHID API for device connection.
 * Requires a real desktop browser with `navigator.hid` and a secure context.
 */
export function checkWebHIDSupport(): WebHIDSupportInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browserName = detectBrowserName(ua);

  if (isInAppBrowserWithoutWebHID(ua)) {
    return { isSupported: false, browserName, reason: "in_app_browser" };
  }

  if (typeof navigator === "undefined" || !("hid" in navigator)) {
    return { isSupported: false, browserName, reason: "no_api" };
  }

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { isSupported: false, browserName, reason: "insecure_context" };
  }

  return { isSupported: true, browserName };
}

export function isWebHIDAvailable(): boolean {
  return checkWebHIDSupport().isSupported;
}

export function getWebHIDUnsupportedMessageKey(
  reason?: WebHIDUnsupportedReason,
): string {
  if (reason === "in_app_browser") return "2857";
  if (reason === "insecure_context") return "2853";
  return "2803";
}
