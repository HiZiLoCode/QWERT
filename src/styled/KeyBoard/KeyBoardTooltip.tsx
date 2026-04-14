import { styled } from "@mui/material";
export const KeyBoradTooltipBorder=styled('div')`
    transform: perspective(6.25rem) translateZ(0rem);
    border-radius: 0.25rem;
    background: rgba(var(--key--color_accent),.8);
    box-shadow: inset -0.0625rem -0.0625rem 0 rgb(0 0 0 / 20%), inset 0.0625rem 0.0625rem 0 rgb(255 255 255 / 10%);
    height: 100%;
    white-space: pre-line;
    display: grid;
    align-content: space-around;
    box-sizing: border-box;
    animation: initial;
    font-size: 0.75rem;
    > *:nth-child(1),
    > *:nth-child(2) {
      text-align: left;
      margin-left: 0.1875rem;
    }
    >*:nth-child(2) {
      text-align: left;
    }
  `
export const KeyBoradContainerCenter=styled('div')`
    text-align: center;
`
export const KeyBoradContainerBorder=styled('div')`
    box-shadow:inset -0.375rem -0.5625rem 0 rgb(0 0 0 / 24%), inset 0rem 0rem 0 rgb(255 255 255 / 24%);
    padding: 0.0625rem 0.375rem 0.625rem 0.1875rem;   
    box-sizing: border-box;
     border-radius: 0.1875rem;
     transition: transform 0.2s ease-out;
    margin:  0 0.125rem;
    min-width: 4.0625rem;
    height: 4.0625rem;
    transform: perspective(6.25rem) translateZ(0rem);
    border-radius: 0.1875rem;
`
export const KeyBoradTooltipSpan=styled('div')`
  margin-top: 0.25rem;
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
      transform: scale(1) translateY(0rem);
      opacity: 1;
    }
  }
  .tooltip {
    transform: translateY(0.3125rem) scale(0.6);
    opacity: 0;
  }
`;
