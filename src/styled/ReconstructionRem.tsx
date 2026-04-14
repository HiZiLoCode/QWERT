import { Button, Switch, Slider } from '@mui/material';
import { styled } from '@mui/system';
export const SwitchRem = styled(Switch)`
    width:3.625rem;
    height:2.375rem;
    padding:0.75rem;
    >.MuiButtonBase-root {
        padding:0.5625rem;
    }
    .Mui-checked{
        transform: translateX(1.25rem) !important;
    }
    .MuiSwitch-thumb{
        width:1.25rem;
        height:1.25rem;
    }
    .MuiSwitch-track{
        border-radius:0.4375rem;
    }
`;
export const ButtonRem = styled(Button)`
    padding:0.375rem 1.25rem;
    min-width:4rem;
    border-radius:.25rem;
`
export const SliderRem = styled(Slider)`
    height:0.25rem;
    border-radius:0.75rem;
    padding:0.8125rem 0;
    margin-bottom:.25rem;
    .MuiSlider-thumb{
        width:1.25rem;
        height:1.25rem;
    }
    .MuiSlider-thumb::after{
        width: 2.625rem;
        height:2.625rem;
    }
    .MuiSlider-track{
        border:0.0625rem solid currentColor;
    }
    .MuiSlider-mark{
        width:0.125rem;
        height:0.125rem;
    }
    .MuiSlider-markLabel{
        top: 1.875rem;
    }
`   