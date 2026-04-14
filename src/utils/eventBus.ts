// 事件总线模块，用于组件间通信

// 导航事件
export const NavigationEvents = {
  // 导航到固件升级页面
  navigateToUpgrade: () => {
    // 创建并触发自定义事件
    const event = new CustomEvent('navigateToUpgrade');
    document.dispatchEvent(event);
  }
};

// 监听导航事件
export const listenToUpgradeNavigation = (callback: () => void): (() => void) => {
  const handler = () => {
    callback();
  };
  
  document.addEventListener('navigateToUpgrade', handler);
  
  // 返回取消监听函数
  return () => {
    document.removeEventListener('navigateToUpgrade', handler);
  };
}; 