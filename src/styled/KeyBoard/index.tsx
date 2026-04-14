import { styled } from "@mui/material";
export const BackBtn = styled("button")`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 2.8125rem;
  height: 2.8125rem;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition-duration: 0.3s;
  box-shadow: 0.125rem0.125rem0.625rem rgba(0, 0, 0, 0.199);
  background-color: rgb(255, 65, 65);

  &:hover {
    width: 7.8125rem;
    border-radius: 2.5rem;
  }

  &:active {
    transform: translate(0.125rem, 0.125rem);
  }
  &:hover .sign {
    width: 30%;
    transition-duration: 0.3s;
    padding-left: 1.25rem;
  }
  &:hover .text {
    opacity: 1;
    width: 70%;
    transition-duration: 0.3s;
    padding-right: 0.625rem;
  }
`;

export const BackSign = styled("div")`
  width: 100%;
  transition-duration: 2s;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 1.0625rem;
    transform: rotate(180deg);
  }

  svg path {
    fill: white;
  }
`;

export const BackText = styled("span")`
  position: absolute;
  right: 0%;
  width: 0%;
  opacity: 0;
  color: white;
  font-size: 1.25rem;
  font-weight: 600;
  transition-duration: 0.3s;
`;
