import { Button, Switch, Slider } from '@mui/material';
import { styled } from '@mui/system';
export const SwitchRem = styled(Switch)`
    width:58px;
    height:38px;
    padding:12px;
    >.MuiButtonBase-root {
        padding:9px;
    }
    .Mui-checked{
        transform: translateX(20px) !important;
    }
    .MuiSwitch-thumb{
        width:20px;
        height:20px;
    }
    .MuiSwitch-track{
        border-radius:7px;
    }
`;
export const ButtonRem = styled(Button)`
    padding:6px 20px;
    min-width:64px;
    border-radius:4px;
`
export const SliderRem = styled(Slider)`
    height:4px;
    border-radius:12px;
    padding:13px 0;
    margin-bottom:4px;
    .MuiSlider-thumb{
        width:20px;
        height:20px;
    }
    .MuiSlider-thumb::after{
        width: 42px;
        height:42px;
    }
    .MuiSlider-track{
        border:1px solid currentColor;
    }
    .MuiSlider-mark{
        width:2px;
        height:2px;
    }
    .MuiSlider-markLabel{
        top: 30px;
    }
`   