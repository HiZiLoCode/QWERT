import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/system';
export const NoHoverIconButton = styled(IconButton)`
  padding: 0.5rem;
  &:hover {
    background-color: transparent;  // 禁用 hover 背景颜色变化
  }

  & svg {
    transition: none; // 禁用图标的过渡效果
  }
`;