import { useState } from "react";
import TooltipSlider from "./TooltipSlider";

export default function StrongSlider({
  max,
  min,
  curVal,
  setCurVal,
  onAfterChange,
  tipFormatter,
  disabled
}) {
  
  return (
    <div className="h-[184px]">
      <TooltipSlider
        tipFormatter={tipFormatter}
        vertical
        value={curVal}
        visible
        placement={'right'}
        offset={[15, 0]}
        className="w-full mx-2"
        overlayInnerStyle={{ minHeight: 'auto', background: '#0066ff' }}
        disabled={disabled}
        onChange={(value) => {
          setCurVal(value);
        }}
        onAfterChange={(value) => {
          if (onAfterChange) {
            onAfterChange(value);
          }
        }}
        styles={{
          handle: {
            borderColor: '#D7DEE3',
            height: 20,
            width: 20,
            opacity: 0,
            marginLeft: -7,
            backgroundColor: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
          },
          track: {
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            borderBottomRightRadius: 6,
            borderBottomLeftRadius: 6,
            backgroundColor: '#0066FF',
            width: 32,
          },
          rail: {
            backgroundColor: '#E5E9F0',
            overflow: 'hidden',
            width: 32,
          }
        }}
        min={min}  // 确保传入的最小值
        max={max}
      />
    </div>
  );
}