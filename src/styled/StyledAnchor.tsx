import { styled } from "@mui/material";
import { Anchor } from "rc-anchor";

const StyledAnchor = styled(Anchor)(({ theme }) => ({
  "& .rc-title-item-active": {
    color: theme.palette.primary.main,
    fontWeight: "bold",
  },
  "& .rc-title-item-active::after": {
    backgroundColor: theme.palette.primary.main,
  },
}));

export default StyledAnchor;