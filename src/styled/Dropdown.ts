import { styled } from "@mui/material";
import { Button } from "./Button";

/** 内联尺寸统一为 px */
const u = (px: number) => `${px}px`;

export const DropDownContainer = styled("div")<{ width: string }>`
  display: flex;
  align-items: center;
  position: relative;
  width: ${({ width }) => width};
  margin: auto;
  @media (max-width: 750px) {
    margin-right: 0;
  }
  .dropdown-button-content {
    display: flex;
    align-items: center;
    font-size: 16px;

    .dropdown-arrow {
      font-size: 18px;
      margin-left: ${u(4)};
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
  min-width: ${u(130)};
  background: ${({ selected }) =>
    selected ? "var(--key--color_inside-accent)" : "var(--key--color_accent)"};
  border-radius: ${u(5)};
  box-shadow: 0 ${u(2)} ${u(4)} 0 rgb(0 0 0 / 50%);
  z-index: 2000;
  position: absolute;
  top: ${u(45)};
  left: ${({ position }) => (position === "left" ? 0 : "auto")};
  right: ${({ position }) => (position === "right" ? 0 : "auto")};

  .dropdown-item {
    display: flex;
    align-items: center;
    width: 88%;
    height: ${u(24)};
    margin: ${u(3)} ${u(3)} ${u(4)};
    padding: 0 3%;
    font-size: 14px;
    white-space: nowrap;
    border-radius: ${u(3)};
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
    border-left: ${u(6)} solid transparent;
    border-right: ${u(6)} solid transparent;
    border-top: ${u(6)} solid var(--color_accent);
    position: absolute;
    margin-left: ${u(-6)};
    width: 0;
    transform: rotate(180deg);
    right: ${u(20)};
    top: ${u(-9)};
  }

  .dropdown-separate {
    width: 88%;
    height: ${u(0.5)};
    border: solid ${u(0.5)}
      ${({ selected }) =>
        selected ? "var(--key--color_accent)" : "transparent"};
    margin: 0 6%;
  }
`;

export const CatgoryButton: any = styled(Button)<{ disabled: boolean }>`
  width: auto;
  line-height: 18px;
  border-radius: ${u(64)};
  font-size: 14px;
  border: none;
  margin: 0;
  box-shadow: none;
  position: relative;
  border-radius: ${u(10)};
  &:hover {
    border-color: var(--color_accent);
    transform: translate3d(0, ${u(-2)}, 0);
  }
  ${(props: any) =>
    props.disabled &&
    `
      cursor: not-allowed;
      filter: opacity(50%);
    `}
`;

export const DropDownLanguage = styled("span")`
  margin-left: ${u(5)};
`;

export const CategoryLanguage = styled("div")`
  color: var(--key--color_inside-accent);
`;
