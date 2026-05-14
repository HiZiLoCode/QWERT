import { styled } from "@mui/material";

type AccentButtonProps = {
  disabled?: boolean;
  onClick?: (...a: any[]) => void;
};
const AccentButtonBase = styled("button") <AccentButtonProps>`
  height: 40px;
  padding: 0 15px;
  line-height: 40px;
  min-width: 100px;
  text-align: center;
  outline: none;
  font-size: 20px;
  border-radius: 10px;
  color: var(--key--color_accent);
  border: 1px solid var(--key--color_accent);
  display: inline-block;
  box-sizing: border-box;
  pointer-events: ${(props) => (props.disabled ? "none" : "auto")};
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};

  &:hover {
    border: 1px solid var(--key--color_accent);
  }
`;

export const AccentButton = styled(AccentButtonBase)`
  &:hover {
    filter: brightness(0.7);
  }
`;
export const AccentButtonLarge = styled(AccentButton)`
  font-size: 24px;
  line-height: 60px;
  height: 60px;
`;
export const AccreditButton = styled("button") <AccentButtonProps>`
  padding: 1.6px 2px;
  width: 204.4px;
  height: 62px;
  background-color: #fff;
  border: 0.08em solid  #212121;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
`;
export const AccreditButtonSpan = styled("span")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  bottom: 8px;
  width: 200px;
  height: 60px;
  background-color: var(--key--color_accent);
  border-radius: 8px;
  font-size: 16px;
  color: #fff;
  border: 0.08em solid #fff;
  box-shadow: 0 0.4em 0.20px 0.019em #fff;

  &:hover {
    transition: all 0.5s;
    transform: translate(0, 0.4em);
    box-shadow: 0 0 0 0 #fff;
  }

  &:not(:hover) {
    transition: all 1s;
  }
`;
