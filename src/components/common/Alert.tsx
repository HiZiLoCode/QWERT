import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

export default function AlertComponent({open, onClose, message, severity}) {

  return (
    <Snackbar
      open={open}
      autoHideDuration={3000} // 自动隐藏时间（毫秒）
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }} // 位置
    >
      <Alert
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12.0049" cy="12.0059" r="10.375" fill="#0066FF"/>
            <path d="M7.5 11.5L11 15L16.5 9.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        }
        sx={{
          width: '100%',
          background: '#ECF5FE',
          border: '0.0625rem solid rgba(0, 102, 255, 0.20)',
          borderRadius: '0.25rem',
          boxShadow: '0px 0.1875rem 0.375rem 0px rgba(12, 33, 63, 0.12)'
        }}>
        {message}
      </Alert>
    </Snackbar>
  );
}