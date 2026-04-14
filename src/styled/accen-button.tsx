import { styled } from "@mui/material";

type AccentButtonProps = {
  disabled?: boolean;
  onClick?: (...a: any[]) => void;
};
const AccentButtonBase = styled("button") <AccentButtonProps>`
  height: 2.5rem;
  padding: 0 0.9375rem;
  line-height: 2.5rem;
  min-width: 6.25rem;
  text-align: center;
  outline: none;
  font-size: 1.25rem;
  border-radius: 0.625rem;
  color: var(--key--color_accent);
  border: 0.0625rem solid var(--key--color_accent);
  display: inline-block;
  box-sizing: border-box;
  pointer-events: ${(props) => (props.disabled ? "none" : "auto")};
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};

  &:hover {
    border: 0.0625rem solid var(--key--color_accent);
  }
`;

export const AccentButton = styled(AccentButtonBase)`
  &:hover {
    filter: brightness(0.7);
  }
`;
export const AccentButtonLarge = styled(AccentButton)`
  font-size: 1.5rem;
  line-height: 3.75rem;
  height: 3.75rem;
`;
export const AccreditButton = styled("button") <AccentButtonProps>`
  padding: 0.1rem 0.125rem;
  width: 12.775rem;
  height: 3.875rem;
  background-color: #fff;
  border: 0.08em solid  #212121;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
`;
export const AccreditButtonSpan = styled("span")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  bottom: 0.5rem;
  width: 12.5rem;
  height: 3.75rem;
  background-color: var(--key--color_accent);
  border-radius: 0.5rem;
  font-size: 1rem;
  color: #fff;
  border: 0.08em solid #fff;
  box-shadow: 0 0.4em 0.1.25rem 0.019em #fff;

  &:hover {
    transition: all 0.5s;
    transform: translate(0, 0.4em);
    box-shadow: 0 0 0 0 #fff;
  }

  &:not(:hover) {
    transition: all 1s;
  }
`;
