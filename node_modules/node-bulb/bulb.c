#include "bulb.h"

#define AUX_TIP_SET() gpio_set_output(SUNXI_PORT_D_BASE, SUNXI_PIO_15)
#define AUX_TIP_CLR() gpio_clear_output(SUNXI_PORT_D_BASE, SUNXI_PIO_15)

#define SHUTTER_TIP_SET() gpio_set_output(SUNXI_PORT_D_BASE, SUNXI_PIO_20)
#define SHUTTER_RING_SET() gpio_set_output(SUNXI_PORT_D_BASE, SUNXI_PIO_19)
#define SHUTTER_TIP_CLR() gpio_clear_output(SUNXI_PORT_D_BASE, SUNXI_PIO_20)
#define SHUTTER_RING_CLR() gpio_clear_output(SUNXI_PORT_D_BASE, SUNXI_PIO_19)

#define PC_SYNC_READ() (gpio_get_input(SUNXI_PORT_B_BASE, SUNXI_PIO_02) ? 1 : 0)
#define AUX_TIP_READ() (gpio_get_input(SUNXI_PORT_B_BASE, SUNXI_PIO_03) ? 1 : 0)

uint8_t _bulb_init()
{
    gpio_init();

    gpio_cfg_output(SUNXI_PORT_D_BASE, SUNXI_PIO_15_IDX);
    gpio_cfg_output(SUNXI_PORT_D_BASE, SUNXI_PIO_20_IDX);
    gpio_cfg_output(SUNXI_PORT_D_BASE, SUNXI_PIO_19_IDX);

    gpio_cfg_input(SUNXI_PORT_B_BASE, SUNXI_PIO_02_IDX);
    gpio_cfg_input(SUNXI_PORT_B_BASE, SUNXI_PIO_03_IDX);

    return 0;
}

uint8_t _bulb_cleanup(uint8_t passthrough_error)
{
    SHUTTER_RING_CLR();
    SHUTTER_TIP_CLR();
    return passthrough_error;
}

int64_t _microSecondDiff(struct timeval *t1, struct timeval *t0)
{
    if(t1 && t0)
    {
        int64_t seconds = t1->tv_sec - t0->tv_sec;
        int64_t micros = t1->tv_usec - t0->tv_usec;
        return micros + (seconds * 1000000);
    }
    else
    {
        return 0;
    }
}

uint8_t bulb_read_aux() {
    return AUX_TIP_READ();
}

uint8_t bulb_read_sync() {
    return PC_SYNC_READ();
}

uint8_t bulb_set_shutter(uint8_t status) {
    if(status)
    {
        return SHUTTER_TIP_SET();
    }
    else
    {
        return SHUTTER_TIP_CLR();
    }
}

uint8_t bulb_set_aux(uint8_t status) {
    if(status)
    {
        return AUX_TIP_SET();
    }
    else
    {
        return AUX_TIP_CLR();
    }
}

uint8_t bulb(bulb_config_t config, bulb_result_t *result)
{
    struct timeval startTime, syncInTime, stopTime, syncOutTime, now;
    uint8_t state = ST_START;

    if(config.runTest)
    {
        config.runTest = 1;
        config.bulbMicroSeconds = 0;
        config.startLagMicroSeconds = 0;
        config.endLagMicroSeconds = 0;
        config.expectSync = 1;
    }

    if(_bulb_init())
    {
        return _bulb_cleanup(ERROR_FAILED_TO_INIT);
    }

    if(!PC_SYNC_READ())
    {
        return _bulb_cleanup(ERROR_INVALID_PC_STATE);
    }

    SHUTTER_RING_SET();

    usleep(config.preFocusMs * 1000);

    gettimeofday(&startTime, 0);
    SHUTTER_TIP_SET();
    state = ST_SYNCIN;

    uint8_t sync, lastSync = 1;
    while(state != ST_ERROR && state != ST_END)
    {
        sync = PC_SYNC_READ();
        if(sync != lastSync)
        {
            if(state == ST_SYNCIN && sync == 0)
            {
                gettimeofday(&syncInTime, 0);
                state = ST_STOP;
            }
            else if(state == ST_SYNCOUT && sync == 1)
            {
                gettimeofday(&syncOutTime, 0);
                state = ST_END;
            }
            else
            {
                state = ST_ERROR;
            }
            lastSync = sync;
        }
        if(state == ST_STOP)
        {
            gettimeofday(&now, 0);
            if(_microSecondDiff(&now, &syncInTime) >= config.bulbMicroSeconds - config.endLagMicroSeconds)
            {
                gettimeofday(&stopTime, 0);
                SHUTTER_TIP_CLR();
                SHUTTER_RING_CLR();
                state = ST_SYNCOUT;
            }
        }
        else
        {
            gettimeofday(&now, 0);
            int64_t diff = _microSecondDiff(&now, &startTime);
            if((!config.expectSync && state == ST_SYNCIN && (diff > config.bulbMicroSeconds + config.startLagMicroSeconds - config.endLagMicroSeconds)) || diff > TIMEOUT_US + config.bulbMicroSeconds)
            {
                state = ST_ERROR;
                return _bulb_cleanup(ERROR_PC_TIMEOUT);
            }
        }
    }

    if(state != ST_ERROR)
    {
        result->startDiff = _microSecondDiff(&syncInTime, &startTime);
        result->stopDiff = _microSecondDiff(&syncOutTime, &stopTime);
        result->actualTime = _microSecondDiff(&syncOutTime, &syncInTime);
        if(!config.runTest)
        {
            result->errPercent = (float)(100.0 - (((double)config.bulbMicroSeconds / (double)result->actualTime) * 100.0));
            if(result->errPercent < 0.0) result->errPercent = 0.0 - result->errPercent;
        }
    }
    else
    {
        return _bulb_cleanup(ERROR_STATE_SEQUENCE);
    }

    SHUTTER_TIP_CLR();
    SHUTTER_RING_CLR();
    
    return _bulb_cleanup(0);
}


