import { Tooltip, styled, tooltipClasses } from "@mui/material";


const HtmlTooltip = styled(({ className, ...props }: any) => (
    <Tooltip {...props} classes={{ popper: className }} />
  ))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
      backgroundColor: '#fff',
      borderRadius: '0.1875rem',
      color: '#151515',
      maxWidth: 160,
      fontWeight: 'normal',
      fontSize: theme.typography.pxToRem(12),
      padding: '0.75rem',
      boxShadow: theme.shadows[5]
    },
    [`& .${tooltipClasses.arrow}`]: {
      color: '#fff'
    },
  }));

export default HtmlTooltip;
