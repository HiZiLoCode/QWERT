import { styled } from "@mui/material";
export const BackBtn = styled("button")`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 45px;
  height: 45px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition-duration: 0.3s;
  box-shadow: 0.125rem0.125rem10px rgba(0, 0, 0, 0.199);
  background-color: rgb(255, 65, 65);

  &:hover {
    width: 125px;
    border-radius: 40px;
  }

  &:active {
    transform: translate(2px, 2px);
  }
  &:hover .sign {
    width: 30%;
    transition-duration: 0.3s;
    padding-left: 20px;
  }
  &:hover .text {
    opacity: 1;
    width: 70%;
    transition-duration: 0.3s;
    padding-right: 10px;
  }
`;

export const BackSign = styled("div")`
  width: 100%;
  transition-duration: 2s;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 17px;
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
  font-size: 20px;
  font-weight: 600;
  transition-duration: 0.3s;
`;
