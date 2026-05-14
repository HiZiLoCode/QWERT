import { Tooltip, styled, tooltipClasses } from "@mui/material";


const HtmlTooltip = styled(({ className, ...props }: any) => (
    <Tooltip {...props} classes={{ popper: className }} />
  ))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
      backgroundColor: '#fff',
      borderRadius: '3px',
      color: '#151515',
      maxWidth: 160,
      fontWeight: 'normal',
      fontSize: '12px',
      padding: '12px',
      boxShadow: theme.shadows[5]
    },
    [`& .${tooltipClasses.arrow}`]: {
      color: '#fff'
    },
  }));

export default HtmlTooltip;
