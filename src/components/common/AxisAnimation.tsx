import { Box, Slider, Typography } from "@mui/material";
import { useEffect } from "react";
export default function AxisAnimation({
  pressDz,
  releaseDz,
  actuationPercent
}) {
  useEffect(() => {
    console.log('AxisAnimation', actuationPercent);
    console.log('pressDz', pressDz);
  }, [actuationPercent, pressDz, releaseDz]);
  return (
    <Box display="flex">
      <Box width={240} display={'flex'} alignItems={'center'} justifyContent={'center'}>
        <Box width={160} height={161} alignSelf={'center'}>
          <img src="/svgs/axis.svg" alt="axis_animation" />
        </Box>
      </Box>
      <Box display="flex" flexDirection="column" alignItems="flex-end" justifyContent="center" mt={'0.125rem'}>
        {new Array(40).fill(0).map((_, index) => (
          <Typography key={index} sx={{
            display: 'flex',
            alignItems: 'center',
            height: '0.3125rem'
          }}>
            {((index) % 5 === 0) && (
              <Typography sx={{ fontSize: '0.75rem', marginRight: '0.25rem' }}>
                {((index) * 0.1).toFixed(2)}
              </Typography>
            )}
            <Box
              key={"grid" + index}
              sx={{
                width: `${index % 5 === 0 ? 8 : 5}px`,
                height: '0.0625rem',
                backgroundColor: 'customed1.main',
                marginBottom: '4.0.375rem'
              }}
            ></Box>
          </Typography>
        ))}
      </Box>
      <Box height={200} ml={-1}>
        <Box width={24} height={pressDz / 2} sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          marginLeft: '13px',
          borderRadius: 1,
        }}></Box>
        <Slider
          value={actuationPercent}
          orientation="vertical"
          min={pressDz}
          max={390 - releaseDz}
          disabled
          aria-labelledby="vertical-slider"
          valueLabelDisplay="on"
          onChange={(event) => event.stopPropagation()}
          valueLabelFormat={(value) => `${(value * 0.01).toFixed(2)}mm`}
          sx={{
            width: 24,
            height: 200 - releaseDz/2 - pressDz/2,
            borderRadius: 0,
            transform: 'scaleY(-1)',
            '& .MuiSlider-rail': {
              borderRadius: 1,
            },
            '& .MuiSlider-thumb': {
              width: 0,
              height: 0,
            },
            '& .MuiSlider-valueLabel': {
              transform: 'scaleY(-1)',
              right: -90,
              top: -12,
              fontSize: '0.75rem',
              backgroundColor: 'transparent',
              color: 'customed1.main',
            },
            '& .MuiSlider-track': {
              display: 'none'
            },
          }}
        />
        <Box width={24} height={releaseDz / 2} sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          marginLeft: '13px',
          borderRadius: 1,
          marginTop: '-0.375rem',
        }}></Box>
      </Box>
      <Box display="flex" flexDirection="column" alignItems="flex-start" justifyContent="center" ml={'-0.5rem'} mt={'0.125rem'}>
        {new Array(40).fill(0).map((_, index) => (
          <Typography key={index} sx={{
            display: 'flex',
            alignItems: 'center',
            height: '0.3125rem'
          }}>
            <Box
              key={"grid" + index}
              sx={{
                width: `${index % 5 === 0 ? 8 : 5}px`,
                height: '0.0625rem',
                backgroundColor: 'customed1.main',
                marginBottom: '4.0.375rem'
              }}
            ></Box>
          </Typography>
        ))}
      </Box>
    </Box>
  )
}