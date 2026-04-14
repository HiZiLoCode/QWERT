import { styled } from "@mui/material";
export const Button = styled('div')`
    display: flex;
    transition: transform 0.2s ease-out;
    user-select: none;
    color: #717070;
    border: 0.0625rem #717070 solid;
    width: 2.8125rem;
    height: 2.8125rem;
    padding: 0.125rem;
    margin: 0.125rem;
    text-overflow: ellipsis;
    overflow: hidden;
    cursor: pointer;
    font-size: 0.75rem;
    text-align: center;
    border-radius: 0.25rem;
    justify-content: center;
    align-items: center;
    white-space: pre-wrap;
    box-shadow: #8c8c8c 0 0.0625rem 0 0;
    &:hover {
    transform: translate3d(0, -0.125rem, 0);
}
`
export default Button;