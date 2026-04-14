import React, { useEffect, useRef, useState } from 'react';
import { Tooltip, Badge } from 'element-react';

export default function DeviceName({ content, children, widthClass = 'max-w-[180px]' }) {
  const [isOverflow, setIsOverflow] = useState(false);
  const textRef = useRef(null); // 引用 p 标签的 DOM 元素

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        setIsOverflow(textRef.current.scrollWidth > textRef.current.clientWidth);
      }
    };
    
    checkOverflow(); // 组件挂载时检查是否溢出

    window.addEventListener('resize', checkOverflow); // 窗口大小改变时重新检查
    return () => {
      window.removeEventListener('resize', checkOverflow); // 组件卸载时清理事件监听器
    };
  }, [content]);

  return (
    <div>
      {isOverflow ? (
        <Tooltip className="item" content={content} placement="top">
          <p
            ref={textRef}
            className={`block pt-1 ${widthClass} overflow-hidden text-ellipsis whitespace-nowrap ${widthClass}`}
          >
            {children}
          </p>
        </Tooltip>
      ) : (
        <p
          ref={textRef}
          className="block pt-1 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {children}
        </p>
      )}
    </div>
  );
}
