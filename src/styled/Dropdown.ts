import { styled } from "@mui/material";
import { Button } from "./Button";

// px -> rem 工具函数
const pxToRem = (px: number) => `${px / 16}rem`;

export const DropDownContainer = styled("div")<{ width: string }>`
  display: flex;
  align-items: center;
  position: relative;
  width: ${({ width }) => width};
  margin: auto;
  @media (max-width: 46.875rem) { // 46rem
    margin-right: 0;
  }
  .dropdown-button-content {
    display: flex;
    align-items: center;
    font-size: ${pxToRem(16)};

    .dropdown-arrow {
      font-size: ${pxToRem(18)}; // 1.125rem
      margin-left: ${pxToRem(4)};
      transform: rotate(90deg);
      color: var(--color_inside-accent);
    }
  }
  &:hover {
    .dropdown-arrow {
      transform: rotate(270deg);
    }
  }
`;

export const DropDown = styled("div")<{ position: string; selected?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: ${pxToRem(130)};
  background: ${({ selected }) =>
    selected ? "var(--key--color_inside-accent)" : "var(--key--color_accent)"};
  border-radius: ${pxToRem(5)};
  box-shadow: 0 ${pxToRem(2)} ${pxToRem(4)} 0 rgb(0 0 0 / 50%);
  z-index: 2000;
  position: absolute;
  top: ${pxToRem(45)};
  left: ${({ position }) => (position === "left" ? 0 : "auto")};
  right: ${({ position }) => (position === "right" ? 0 : "auto")};

  .dropdown-item {
    display: flex;
    align-items: center;
    width: 88%;
    height: ${pxToRem(24)};
    margin: ${pxToRem(3)} ${pxToRem(3)} ${pxToRem(4)};
    padding: 0 3%;
    font-size: ${pxToRem(14)};
    white-space: nowrap;
    border-radius: ${pxToRem(3)};
    cursor: pointer;
    &:hover {
      background: ${({ selected }) =>
        selected ? "var(--key--color_accent)" : "transparent"};
      color: var(--key--color_inside-accent);
    }
  }

  .pointerStyles {
    border-style: solid;
    border-color: transparent;
    border-left: ${pxToRem(6)} solid transparent;
    border-right: ${pxToRem(6)} solid transparent;
    border-top: ${pxToRem(6)} solid var(--color_accent);
    position: absolute;
    margin-left: ${pxToRem(-6)};
    width: 0;
    transform: rotate(180deg);
    right: ${pxToRem(20)};
    top: ${pxToRem(-9)};
  }

  .dropdown-separate {
    width: 88%;
    height: ${pxToRem(0.5)};
    border: solid ${pxToRem(0.5)}
      ${({ selected }) =>
        selected ? "var(--key--color_accent)" : "transparent"};
    margin: 0 6%;
  }
`;

export const CatgoryButton: any = styled(Button)<{ disabled: boolean }>`
  width: auto;
  line-height: ${pxToRem(18)};
  border-radius: ${pxToRem(64)};
  font-size: ${pxToRem(14)};
  border: none;
  margin: 0;
  box-shadow: none;
  position: relative;
  border-radius: ${pxToRem(10)};
  &:hover {
    border-color: var(--color_accent);
    transform: translate3d(0, ${pxToRem(-2)}, 0);
  }
  ${(props: any) =>
    props.disabled &&
    `
      cursor: not-allowed;
      filter: opacity(50%);
    `}
`;

export const DropDownLanguage = styled("span")`
  margin-left: ${pxToRem(5)};
`;

export const CategoryLanguage = styled("div")`
  color: var(--key--color_inside-accent);
`;
