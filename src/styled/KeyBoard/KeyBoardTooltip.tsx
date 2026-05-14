import { styled } from "@mui/material";
export const KeyBoradTooltipBorder=styled('div')`
    transform: perspective(100px) translateZ(0px);
    border-radius: 4px;
    background: rgba(var(--key--color_accent),.8);
    box-shadow: inset -1px -1px 0 rgb(0 0 0 / 20%), inset 1px 1px 0 rgb(255 255 255 / 10%);
    height: 100%;
    white-space: pre-line;
    display: grid;
    align-content: space-around;
    box-sizing: border-box;
    animation: initial;
    font-size: 12px;
    > *:nth-child(1),
    > *:nth-child(2) {
      text-align: left;
      margin-left: 3px;
    }
    >*:nth-child(2) {
      text-align: left;
    }
  `
export const KeyBoradContainerCenter=styled('div')`
    text-align: center;
`
export const KeyBoradContainerBorder=styled('div')`
    box-shadow:inset -6px -9px 0 rgb(0 0 0 / 24%), inset 0px 0px 0 rgb(255 255 255 / 24%);
    padding: 1px 6px 10px 3px;   
    box-sizing: border-box;
     border-radius: 3px;
     transition: transform 0.2s ease-out;
    margin:  0 2px;
    min-width: 65px;
    height: 65px;
    transform: perspective(100px) translateZ(0px);
    border-radius: 3px;
`
export const KeyBoradTooltipSpan=styled('div')`
  margin-top: 4px;
`
export const TooltipContainer = styled('div')`
  position: absolute;
  transform: rotate(-0rad);
  width: 100%;
  height: 100%;
  bottom: 0;
`;
export const KeyBoradContainer = styled('div')<{ keyItem?: unknown }>`
  &:hover {
    z-index: 1;
    & .tooltip {
      transform: scale(1) translateY(0px);
      opacity: 1;
    }
  }
  .tooltip {
    transform: translateY(5px) scale(0.6);
    opacity: 0;
  }
`;
