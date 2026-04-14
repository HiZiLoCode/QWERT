'use client';

import Slider from 'rc-slider';
import Tooltip from 'rc-tooltip';
import 'rc-tooltip/assets/bootstrap.css';
import raf from 'rc-util/lib/raf';
import * as React from 'react';


const HandleTooltip  = (props) => {
  const { showArrow, placement = 'bottom', value, children, visible, tipFormatter = (val) => `${val} %`, overlayInnerStyle, ...restProps } = props;

  const tooltipRef = React.useRef();
  const rafRef = React.useRef(null);

  function cancelKeepAlign() {
    raf.cancel(rafRef.current);
  }

  function keepAlign() {
    rafRef.current = raf(() => {
      tooltipRef.current?.forceAlign();
    });
  }

  React.useEffect(() => {
    if (visible) {
      keepAlign();
    } else {
      cancelKeepAlign();
    }

    return cancelKeepAlign;
  }, [value, visible]);

  return (
    <Tooltip
      placement={placement}
      align={{
        offset: props.offset || [0, 0],
      }}
      overlay={tipFormatter(value)}
      showArrow={showArrow}
      overlayInnerStyle={overlayInnerStyle}
      ref={tooltipRef}
      visible={visible}
      {...restProps}
    >
      {children}
    </Tooltip>
  );
};

export const handleRender = (node, props) => (
  <HandleTooltip value={props.value} visible={props.dragging}>
    {node}
  </HandleTooltip>
);


const TooltipSlider = ({ showArrow, tipFormatter, tipProps, placement, offset, overlayInnerStyle, ...props }) => {
  const tipHandleRender = (node, handleProps) => (
    <HandleTooltip
      value={handleProps.value}
      visible={props.visible || handleProps.dragging}
      tipFormatter={tipFormatter}
      placement={placement}
      showArrow={showArrow}
      offset={offset}
      overlayInnerStyle={overlayInnerStyle}
      {...tipProps}
    >
      {node}
    </HandleTooltip>
  );

  return <Slider {...props} handleRender={tipHandleRender} />;
};

export default TooltipSlider;