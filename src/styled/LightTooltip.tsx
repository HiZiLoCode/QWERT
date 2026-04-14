import { Tooltip, styled, tooltipClasses } from "@mui/material";

const LightTooltip = styled(({ className, ...props }) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    padding: '0.625rem 1rem',
    backgroundColor: theme.palette.common.white,
    color: 'rgba(0, 0, 0, 0.87)',
    boxShadow: theme.shadows[6],
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: theme.palette.common.white,
    fontSize: 11,
  },
}));
export default LightTooltip;
