#include "lib_gesture.h"

/* Members */
gesture_data_type gesture_data_;
int16_t gesture_ud_delta_;
int16_t gesture_lr_delta_;
int16_t gesture_ud_count_;
int16_t gesture_lr_count_;
int16_t gesture_near_count_;
int16_t gesture_far_count_;
int16_t gesture_state_;
int16_t gesture_motion_;

int i2c_dev;
/**
 * @brief Configures I2C communications and initializes registers to defaults
 *
 * @return True if initialized successfully. False otherwise.
 */
bool gesture_init()
{
    gesture_ud_delta_ = 0;
    gesture_lr_delta_ = 0;
    
    gesture_ud_count_ = 0;
    gesture_lr_count_ = 0;
    
    gesture_near_count_ = 0;
    gesture_far_count_ = 0;
    
    gesture_state_ = 0;
    gesture_motion_ = DIR_NONE;

    uint8_t id;

    /* Initialize I2C */
    gesture_wireInitialize("/dev/i2c-2", APDS9960_I2C_ADDR);
     
    /* Read ID register and check against known values for APDS-9960 */
    if( !gesture_wireReadDataByte(APDS9960_ID, &id) ) {
        return false;
    }
    if( !(id == APDS9960_ID_1 || id == APDS9960_ID_2) ) {
        return false;
    }
     
    /* Set ENABLE register to 0 (disable all features) */
    if( !gesture_setMode(ALL, OFF) ) {
        return false;
    }
    
    /* Set default values for ambient light and proximity registers */
    if( !gesture_wireWriteDataByte(APDS9960_ATIME, DEFAULT_ATIME) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_WTIME, DEFAULT_WTIME) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_PPULSE, DEFAULT_PROX_PPULSE) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_POFFSET_UR, DEFAULT_POFFSET_UR) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_POFFSET_DL, DEFAULT_POFFSET_DL) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_CONFIG1, DEFAULT_CONFIG1) ) {
        return false;
    }
    if( !gesture_setLEDDrive(DEFAULT_LDRIVE) ) {
        return false;
    }
    if( !gesture_setProximityGain(DEFAULT_PGAIN) ) {
        return false;
    }
    if( !gesture_setAmbientLightGain(DEFAULT_AGAIN) ) {
        return false;
    }
    if( !gesture_setProxIntLowThresh(DEFAULT_PILT) ) {
        return false;
    }
    if( !gesture_setProxIntHighThresh(DEFAULT_PIHT) ) {
        return false;
    }
    if( !gesture_setLightIntLowThreshold(DEFAULT_AILT) ) {
        return false;
    }
    if( !gesture_setLightIntHighThreshold(DEFAULT_AIHT) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_PERS, DEFAULT_PERS) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_CONFIG2, DEFAULT_CONFIG2) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_CONFIG3, DEFAULT_CONFIG3) ) {
        return false;
    }
    
    /* Set default values for gesture sense registers */
    if( !gesture_setGestureEnterThresh(DEFAULT_GPENTH) ) {
        return false;
    }
    if( !gesture_setGestureExitThresh(DEFAULT_GEXTH) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_GCONF1, DEFAULT_GCONF1) ) {
        return false;
    }
    if( !gesture_setGestureGain(DEFAULT_GGAIN) ) {
        return false;
    }
    if( !gesture_setGestureLEDDrive(DEFAULT_GLDRIVE) ) {
        return false;
    }
    if( !gesture_setGestureWaitTime(DEFAULT_GWTIME) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_GOFFSET_U, DEFAULT_GOFFSETU) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_GOFFSET_D, DEFAULT_GOFFSETD) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_GOFFSET_L, DEFAULT_GOFFSETL) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_GOFFSET_R, DEFAULT_GOFFSETR) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_GPULSE, DEFAULT_GPULSE) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_GCONF3, DEFAULT_GCONF3) ) {
        return false;
    }
    if( !gesture_setGestureIntEnable(DEFAULT_GIEN) ) {
        return false;
    }
    
    return true;
}

/*******************************************************************************
 * Public methods for controlling the APDS-9960
 ******************************************************************************/

/**
 * @brief Reads and returns the contents of the ENABLE register
 *
 * @return Contents of the ENABLE register. 0xFF if error.
 */
uint8_t gesture_getMode()
{
    uint8_t enable_value;
    
    /* Read current ENABLE register */
    if( !gesture_wireReadDataByte(APDS9960_ENABLE, &enable_value) ) {
        return ERROR;
    }
    
    return enable_value;
}

/**
 * @brief Enables or disables a feature in the APDS-9960
 *
 * @param[in] mode which feature to enable
 * @param[in] enable ON (1) or OFF (0)
 * @return True if operation success. False otherwise.
 */
bool gesture_setMode(uint8_t mode, uint8_t enable)
{
    uint8_t reg_val;

    /* Read current ENABLE register */
    reg_val = gesture_getMode();
    if( reg_val == ERROR ) {
        return false;
    }
    
    /* Change bit(s) in ENABLE register */
    enable = enable & 0x01;
    if( mode >= 0 && mode <= 6 ) {
        if (enable) {
            reg_val |= (1 << mode);
        } else {
            reg_val &= ~(1 << mode);
        }
    } else if( mode == ALL ) {
        if (enable) {
            reg_val = 0x7F;
        } else {
            reg_val = 0x00;
        }
    }
        
    /* Write value back to ENABLE register */
    if( !gesture_wireWriteDataByte(APDS9960_ENABLE, reg_val) ) {
        return false;
    }
        
    return true;
}

/**
 * @brief Starts the light (R/G/B/Ambient) sensor on the APDS-9960
 *
 * @param[in] interrupts true to enable hardware interrupt on high or low light
 * @return True if sensor enabled correctly. False on error.
 */
bool gesture_enableLightSensor(bool interrupts)
{
    
    /* Set default gain, interrupts, enable power, and enable sensor */
    if( !gesture_setAmbientLightGain(DEFAULT_AGAIN) ) {
        return false;
    }
    if( interrupts ) {
        if( !gesture_setAmbientLightIntEnable(1) ) {
            return false;
        }
    } else {
        if( !gesture_setAmbientLightIntEnable(0) ) {
            return false;
        }
    }
    if( !gesture_enablePower() ){
        return false;
    }
    if( !gesture_setMode(AMBIENT_LIGHT, 1) ) {
        return false;
    }
    
    return true;

}

/**
 * @brief Ends the light sensor on the APDS-9960
 *
 * @return True if sensor disabled correctly. False on error.
 */
bool gesture_disableLightSensor()
{
    if( !gesture_setAmbientLightIntEnable(0) ) {
        return false;
    }
    if( !gesture_setMode(AMBIENT_LIGHT, 0) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Starts the proximity sensor on the APDS-9960
 *
 * @param[in] interrupts true to enable hardware external interrupt on proximity
 * @return True if sensor enabled correctly. False on error.
 */
bool gesture_enableProximitySensor(bool interrupts)
{
    /* Set default gain, LED, interrupts, enable power, and enable sensor */
    if( !gesture_setProximityGain(DEFAULT_PGAIN) ) {
        return false;
    }
    if( !gesture_setLEDDrive(DEFAULT_LDRIVE) ) {
        return false;
    }
    if( interrupts ) {
        if( !gesture_setProximityIntEnable(1) ) {
            return false;
        }
    } else {
        if( !gesture_setProximityIntEnable(0) ) {
            return false;
        }
    }
    if( !gesture_enablePower() ){
        return false;
    }
    if( !gesture_setMode(PROXIMITY, 1) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Ends the proximity sensor on the APDS-9960
 *
 * @return True if sensor disabled correctly. False on error.
 */
bool gesture_disableProximitySensor()
{
	if( !gesture_setProximityIntEnable(0) ) {
		return false;
	}
	if( !gesture_setMode(PROXIMITY, 0) ) {
		return false;
	}

	return true;
}

/**
 * @brief Starts the gesture recognition engine on the APDS-9960
 *
 * @param[in] interrupts true to enable hardware external interrupt on gesture
 * @return True if engine enabled correctly. False on error.
 */
bool gesture_enableGestureSensor(bool interrupts)
{
    
    /* Enable gesture mode
       Set ENABLE to 0 (power off)
       Set WTIME to 0xFF
       Set AUX to LED_BOOST_300
       Enable PON, WEN, PEN, GEN in ENABLE 
    */
    gesture_resetGestureParameters();
    if( !gesture_wireWriteDataByte(APDS9960_WTIME, 0xFF) ) {
        return false;
    }
    if( !gesture_wireWriteDataByte(APDS9960_PPULSE, DEFAULT_GESTURE_PPULSE) ) {
        return false;
    }
    if( !gesture_setLEDBoost(LED_BOOST_300) ) {
        return false;
    }
    if( interrupts ) {
        if( !gesture_setGestureIntEnable(1) ) {
            return false;
        }
    } else {
        if( !gesture_setGestureIntEnable(0) ) {
            return false;
        }
    }
    if( !gesture_setGestureMode(1) ) {
        return false;
    }
    if( !gesture_enablePower() ){
        return false;
    }
    if( !gesture_setMode(WAIT, 1) ) {
        return false;
    }
    if( !gesture_setMode(PROXIMITY, 1) ) {
        return false;
    }
    if( !gesture_setMode(GESTURE, 1) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Ends the gesture recognition engine on the APDS-9960
 *
 * @return True if engine disabled correctly. False on error.
 */
bool gesture_disableGestureSensor()
{
    gesture_resetGestureParameters();
    if( !gesture_setGestureIntEnable(0) ) {
        return false;
    }
    if( !gesture_setGestureMode(0) ) {
        return false;
    }
    if( !gesture_setMode(GESTURE, 0) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Determines if there is a gesture available for reading
 *
 * @return True if gesture available. False otherwise.
 */
bool gesture_isGestureAvailable()
{
    uint8_t val;
    
    /* Read value from GSTATUS register */
    if( !gesture_wireReadDataByte(APDS9960_GSTATUS, &val) ) {
        return false;//ERROR;
    }
    
    /* Shift and mask out GVALID bit */
    val &= APDS9960_GVALID;
    
    /* Return true/false based on GVALID bit */
    if( val == 1) {
        return true;
    } else {
        return false;
    }
}

/**
 * @brief Processes a gesture event and returns best guessed gesture
 *
 * @return Number corresponding to gesture. -1 on error.
 */
int16_t gesture_readGesture()
{
    uint8_t fifo_level = 0;
    uint8_t bytes_read = 0;
    uint8_t fifo_data[128];
    uint8_t gstatus;
    int motion;
    int i;
    
    /* Make sure that power and gesture is on and data is valid */
    if( !gesture_isGestureAvailable() || !(gesture_getMode() & 0b01000001) ) {
        return DIR_NONE;
    }
    
    /* Keep looping as long as gesture data is valid */
    while(1) {
    
        /* Wait some time to collect next batch of FIFO data */
        usleep(FIFO_PAUSE_TIME * 1000);
        
        /* Get the contents of the STATUS register. Is data still valid? */
        if( !gesture_wireReadDataByte(APDS9960_GSTATUS, &gstatus) ) {
            return ERROR;
        }
        
        /* If we have valid data, read in FIFO */
        if( (gstatus & APDS9960_GVALID) == APDS9960_GVALID ) {
        
            /* Read the current FIFO level */
            if( !gesture_wireReadDataByte(APDS9960_GFLVL, &fifo_level) ) {
                return ERROR;
            }

#if DEBUG
            printf("FIFO Level: ");
            printf("%d", fifo_level);
            printf("\n");
#endif

            /* If there's stuff in the FIFO, read it into our data block */
            if( fifo_level > 0) {
                bytes_read = gesture_wireReadDataBlock(  APDS9960_GFIFO_U, 
                                                (uint8_t*)fifo_data, 
                                                (fifo_level * 4) );
                if( bytes_read == -1 ) {
                    return ERROR;
                }
#if DEBUG
                printf("FIFO Dump: ");
                for ( i = 0; i < bytes_read; i++ ) {
                    printf("%d", fifo_data[i]);
                    printf(" ");
                }
                printf("\n");
#endif

                /* If at least 1 set of data, sort the data into U/D/L/R */
                if( bytes_read >= 4 ) {
                    for( i = 0; i < bytes_read; i += 4 ) {
                        gesture_data_.u_data[gesture_data_.index] = \
                                                            fifo_data[i + 0];
                        gesture_data_.d_data[gesture_data_.index] = \
                                                            fifo_data[i + 1];
                        gesture_data_.l_data[gesture_data_.index] = \
                                                            fifo_data[i + 2];
                        gesture_data_.r_data[gesture_data_.index] = \
                                                            fifo_data[i + 3];
                        gesture_data_.index++;
                        gesture_data_.total_gestures++;
                    }
                    
#if DEBUG
                printf("Up Data: ");
                for ( i = 0; i < gesture_data_.total_gestures; i++ ) {
                    printf("%d", gesture_data_.u_data[i]);
                    printf(" ");
                }
                printf("\n");
#endif

                    /* Filter and process gesture data. Decode near/far state */
                    if( gesture_processGestureData() ) {
                        if( gesture_decodeGesture() ) {
                            //***TODO: U-Turn Gestures
#if DEBUG
                            //printf("%d", gesture_motion_);
#endif
                        }
                    }
                    
                    /* Reset data */
                    gesture_data_.index = 0;
                    gesture_data_.total_gestures = 0;
                }
            }
        } else {
    
            /* Determine best guessed gesture and clean up */
            usleep(FIFO_PAUSE_TIME * 1000);
            gesture_decodeGesture();
            motion = gesture_motion_;
#if DEBUG
            printf("END: ");
            printf("%d", gesture_motion_);
            printf("\n");
#endif
            gesture_resetGestureParameters();
            return motion;
        }
    }
}

/**
 * Turn the APDS-9960 on
 *
 * @return True if operation successful. False otherwise.
 */
bool gesture_enablePower()
{
    if( !gesture_setMode(POWER, 1) ) {
        return false;
    }
    
    return true;
}

/**
 * Turn the APDS-9960 off
 *
 * @return True if operation successful. False otherwise.
 */
bool gesture_disablePower()
{
    if( !gesture_setMode(POWER, 0) ) {
        return false;
    }
    
    return true;
}

/*******************************************************************************
 * Ambient light and color sensor controls
 ******************************************************************************/

/**
 * @brief Reads the ambient (clear) light level as a 16-bit value
 *
 * @param[out] val value of the light sensor.
 * @return True if operation successful. False otherwise.
 */
bool gesture_readAmbientLight(uint16_t *val)
{
    uint8_t val_byte;
    *val = 0;
    
    /* Read value from clear channel, low byte register */
    if( !gesture_wireReadDataByte(APDS9960_CDATAL, &val_byte) ) {
        return false;
    }
    *val = val_byte;
    
    /* Read value from clear channel, high byte register */
    if( !gesture_wireReadDataByte(APDS9960_CDATAH, &val_byte) ) {
        return false;
    }
    *val = *val + ((uint16_t)val_byte << 8);
    
    return true;
}

/**
 * @brief Reads the red light level as a 16-bit value
 *
 * @param[out] val value of the light sensor.
 * @return True if operation successful. False otherwise.
 */
bool gesture_readRedLight(uint16_t *val)
{
    uint8_t val_byte;
    *val = 0;
    
    /* Read value from clear channel, low byte register */
    if( !gesture_wireReadDataByte(APDS9960_RDATAL, &val_byte) ) {
        return false;
    }
    *val = val_byte;
    
    /* Read value from clear channel, high byte register */
    if( !gesture_wireReadDataByte(APDS9960_RDATAH, &val_byte) ) {
        return false;
    }
    *val = *val + ((uint16_t)val_byte << 8);
    
    return true;
}
 
/**
 * @brief Reads the green light level as a 16-bit value
 *
 * @param[out] val value of the light sensor.
 * @return True if operation successful. False otherwise.
 */
bool gesture_readGreenLight(uint16_t *val)
{
    uint8_t val_byte;
    *val = 0;
    
    /* Read value from clear channel, low byte register */
    if( !gesture_wireReadDataByte(APDS9960_GDATAL, &val_byte) ) {
        return false;
    }
    *val = val_byte;
    
    /* Read value from clear channel, high byte register */
    if( !gesture_wireReadDataByte(APDS9960_GDATAH, &val_byte) ) {
        return false;
    }
    *val = *val + ((uint16_t)val_byte << 8);
    
    return true;
}

/**
 * @brief Reads the red light level as a 16-bit value
 *
 * @param[out] val value of the light sensor.
 * @return True if operation successful. False otherwise.
 */
bool gesture_readBlueLight(uint16_t *val)
{
    uint8_t val_byte;
    *val = 0;
    
    /* Read value from clear channel, low byte register */
    if( !gesture_wireReadDataByte(APDS9960_BDATAL, &val_byte) ) {
        return false;
    }
    *val = val_byte;
    
    /* Read value from clear channel, high byte register */
    if( !gesture_wireReadDataByte(APDS9960_BDATAH, &val_byte) ) {
        return false;
    }
    *val = *val + ((uint16_t)val_byte << 8);
    
    return true;
}

/*******************************************************************************
 * Proximity sensor controls
 ******************************************************************************/

/**
 * @brief Reads the proximity level as an 8-bit value
 *
 * @param[out] val value of the proximity sensor.
 * @return True if operation successful. False otherwise.
 */
bool gesture_readProximity(uint8_t *val)
{
    *val = 0;
    
    /* Read value from proximity data register */
    if( !gesture_wireReadDataByte(APDS9960_PDATA, val) ) {
        return false;
    }
    
    return true;
}

/*******************************************************************************
 * High-level gesture controls
 ******************************************************************************/

/**
 * @brief Resets all the parameters in the gesture data member
 */
void gesture_resetGestureParameters()
{
    gesture_data_.index = 0;
    gesture_data_.total_gestures = 0;
    
    gesture_ud_delta_ = 0;
    gesture_lr_delta_ = 0;
    
    gesture_ud_count_ = 0;
    gesture_lr_count_ = 0;
    
    gesture_near_count_ = 0;
    gesture_far_count_ = 0;
    
    gesture_state_ = 0;
    gesture_motion_ = DIR_NONE;
}

/**
 * @brief Processes the raw gesture data to determine swipe direction
 *
 * @return True if near or far state seen. False otherwise.
 */
bool gesture_processGestureData()
{
    uint8_t u_first = 0;
    uint8_t d_first = 0;
    uint8_t l_first = 0;
    uint8_t r_first = 0;
    uint8_t u_last = 0;
    uint8_t d_last = 0;
    uint8_t l_last = 0;
    uint8_t r_last = 0;
    int ud_ratio_first;
    int lr_ratio_first;
    int ud_ratio_last;
    int lr_ratio_last;
    int ud_delta;
    int lr_delta;
    int i;

    /* If we have less than 4 total gestures, that's not enough */
    if( gesture_data_.total_gestures <= 4 ) {
        return false;
    }
    
    /* Check to make sure our data isn't out of bounds */
    if( (gesture_data_.total_gestures <= 32) && \
        (gesture_data_.total_gestures > 0) ) {
        
        /* Find the first value in U/D/L/R above the threshold */
        for( i = 0; i < gesture_data_.total_gestures; i++ ) {
            if( (gesture_data_.u_data[i] > GESTURE_THRESHOLD_OUT) &&
                (gesture_data_.d_data[i] > GESTURE_THRESHOLD_OUT) &&
                (gesture_data_.l_data[i] > GESTURE_THRESHOLD_OUT) &&
                (gesture_data_.r_data[i] > GESTURE_THRESHOLD_OUT) ) {
                
                u_first = gesture_data_.u_data[i];
                d_first = gesture_data_.d_data[i];
                l_first = gesture_data_.l_data[i];
                r_first = gesture_data_.r_data[i];
                break;
            }
        }
        
        /* If one of the _first values is 0, then there is no good data */
        if( (u_first == 0) || (d_first == 0) || \
            (l_first == 0) || (r_first == 0) ) {
            
            return false;
        }
        /* Find the last value in U/D/L/R above the threshold */
        for( i = gesture_data_.total_gestures - 1; i >= 0; i-- ) {
#if DEBUG
            printf("Finding last: ");
            printf("U:");
            printf("%d", gesture_data_.u_data[i]);
            printf(" D:");
            printf("%d", gesture_data_.d_data[i]);
            printf(" L:");
            printf("%d", gesture_data_.l_data[i]);
            printf(" R:");
            printf("%d", gesture_data_.r_data[i]);
            printf("\n");
#endif
            if( (gesture_data_.u_data[i] > GESTURE_THRESHOLD_OUT) &&
                (gesture_data_.d_data[i] > GESTURE_THRESHOLD_OUT) &&
                (gesture_data_.l_data[i] > GESTURE_THRESHOLD_OUT) &&
                (gesture_data_.r_data[i] > GESTURE_THRESHOLD_OUT) ) {
                
                u_last = gesture_data_.u_data[i];
                d_last = gesture_data_.d_data[i];
                l_last = gesture_data_.l_data[i];
                r_last = gesture_data_.r_data[i];
                break;
            }
        }
    }
    
    /* Calculate the first vs. last ratio of up/down and left/right */
    ud_ratio_first = ((u_first - d_first) * 100) / (u_first + d_first);
    lr_ratio_first = ((l_first - r_first) * 100) / (l_first + r_first);
    ud_ratio_last = ((u_last - d_last) * 100) / (u_last + d_last);
    lr_ratio_last = ((l_last - r_last) * 100) / (l_last + r_last);
       
#if DEBUG
    printf("Last Values: ");
    printf("U:");
    printf("%d", u_last);
    printf(" D:");
    printf("%d", d_last);
    printf(" L:");
    printf("%d", l_last);
    printf(" R:");
    printf("%d", r_last);
    printf("\n");

    printf("Ratios: ");
    printf("UD Fi: ");
    printf("%d", ud_ratio_first);
    printf(" UD La: ");
    printf("%d", ud_ratio_last);
    printf(" LR Fi: ");
    printf("%d", lr_ratio_first);
    printf(" LR La: ");
    printf("%d", lr_ratio_last);
    printf("\n");
#endif
       
    /* Determine the difference between the first and last ratios */
    ud_delta = ud_ratio_last - ud_ratio_first;
    lr_delta = lr_ratio_last - lr_ratio_first;
    
#if DEBUG
    printf("Deltas: ");
    printf("UD: ");
    printf("%d", ud_delta);
    printf(" LR: ");
    printf("%d", lr_delta);
    printf("\n");
#endif

    /* Accumulate the UD and LR delta values */
    gesture_ud_delta_ += ud_delta;
    gesture_lr_delta_ += lr_delta;
    
#if DEBUG
    printf("Accumulations: ");
    printf("UD: ");
    printf("%d", gesture_ud_delta_);
    printf(" LR: ");
    printf("%d", gesture_lr_delta_);
    printf("\n");
#endif
    
    /* Determine U/D gesture */
    if( gesture_ud_delta_ >= GESTURE_SENSITIVITY_1 ) {
        gesture_ud_count_ = 1;
    } else if( gesture_ud_delta_ <= -GESTURE_SENSITIVITY_1 ) {
        gesture_ud_count_ = -1;
    } else {
        gesture_ud_count_ = 0;
    }
    
    /* Determine L/R gesture */
    if( gesture_lr_delta_ >= GESTURE_SENSITIVITY_1 ) {
        gesture_lr_count_ = 1;
    } else if( gesture_lr_delta_ <= -GESTURE_SENSITIVITY_1 ) {
        gesture_lr_count_ = -1;
    } else {
        gesture_lr_count_ = 0;
    }
    
    /* Determine Near/Far gesture */
    if( (gesture_ud_count_ == 0) && (gesture_lr_count_ == 0) ) {
        if( (abs(ud_delta) < GESTURE_SENSITIVITY_2) && \
            (abs(lr_delta) < GESTURE_SENSITIVITY_2) ) {
            
            if( (ud_delta == 0) && (lr_delta == 0) ) {
                gesture_near_count_++;
            } else if( (ud_delta != 0) || (lr_delta != 0) ) {
                gesture_far_count_++;
            }
            
            if( (gesture_near_count_ >= 10) && (gesture_far_count_ >= 2) ) {
                if( (ud_delta == 0) && (lr_delta == 0) ) {
                    gesture_state_ = NEAR_STATE;
                } else if( (ud_delta != 0) && (lr_delta != 0) ) {
                    gesture_state_ = FAR_STATE;
                }
                return true;
            }
        }
    } else {
        if( (abs(ud_delta) < GESTURE_SENSITIVITY_2) && \
            (abs(lr_delta) < GESTURE_SENSITIVITY_2) ) {
                
            if( (ud_delta == 0) && (lr_delta == 0) ) {
                gesture_near_count_++;
            }
            
            if( gesture_near_count_ >= 10 ) {
                gesture_ud_count_ = 0;
                gesture_lr_count_ = 0;
                gesture_ud_delta_ = 0;
                gesture_lr_delta_ = 0;
            }
        }
    }
    
#if DEBUG
    printf("UD_CT: ");
    printf("%d", gesture_ud_count_);
    printf(" LR_CT: ");
    printf("%d", gesture_lr_count_);
    printf(" NEAR_CT: ");
    printf("%d", gesture_near_count_);
    printf(" FAR_CT: ");
    printf("%d", gesture_far_count_);
    printf("\n");
    printf("----------\n");
#endif
    
    return false;
}

/**
 * @brief Determines swipe direction or near/far state
 *
 * @return True if near/far event. False otherwise.
 */
bool gesture_decodeGesture()
{
    /* Return if near or far event is detected */
    if( gesture_state_ == NEAR_STATE ) {
        gesture_motion_ = DIR_NEAR;
        return true;
    } else if ( gesture_state_ == FAR_STATE ) {
        gesture_motion_ = DIR_FAR;
        return true;
    }
    
    /* Determine swipe direction */
    if( (gesture_ud_count_ == -1) && (gesture_lr_count_ == 0) ) {
        gesture_motion_ = DIR_UP;
    } else if( (gesture_ud_count_ == 1) && (gesture_lr_count_ == 0) ) {
        gesture_motion_ = DIR_DOWN;
    } else if( (gesture_ud_count_ == 0) && (gesture_lr_count_ == 1) ) {
        gesture_motion_ = DIR_RIGHT;
    } else if( (gesture_ud_count_ == 0) && (gesture_lr_count_ == -1) ) {
        gesture_motion_ = DIR_LEFT;
    } else if( (gesture_ud_count_ == -1) && (gesture_lr_count_ == 1) ) {
        if( abs(gesture_ud_delta_) > abs(gesture_lr_delta_) ) {
            gesture_motion_ = DIR_UP;
        } else {
            gesture_motion_ = DIR_RIGHT;
        }
    } else if( (gesture_ud_count_ == 1) && (gesture_lr_count_ == -1) ) {
        if( abs(gesture_ud_delta_) > abs(gesture_lr_delta_) ) {
            gesture_motion_ = DIR_DOWN;
        } else {
            gesture_motion_ = DIR_LEFT;
        }
    } else if( (gesture_ud_count_ == -1) && (gesture_lr_count_ == -1) ) {
        if( abs(gesture_ud_delta_) > abs(gesture_lr_delta_) ) {
            gesture_motion_ = DIR_UP;
        } else {
            gesture_motion_ = DIR_LEFT;
        }
    } else if( (gesture_ud_count_ == 1) && (gesture_lr_count_ == 1) ) {
        if( abs(gesture_ud_delta_) > abs(gesture_lr_delta_) ) {
            gesture_motion_ = DIR_DOWN;
        } else {
            gesture_motion_ = DIR_RIGHT;
        }
    } else {
        return false;
    }
    
    return true;
}

/*******************************************************************************
 * Getters and setters for register values
 ******************************************************************************/

/**
 * @brief Returns the lower threshold for proximity detection
 *
 * @return lower threshold
 */
uint8_t gesture_getProxIntLowThresh()
{
    uint8_t val;
    
    /* Read value from PILT register */
    if( !gesture_wireReadDataByte(APDS9960_PILT, &val) ) {
        val = 0;
    }
    
    return val;
}

/**
 * @brief Sets the lower threshold for proximity detection
 *
 * @param[in] threshold the lower proximity threshold
 * @return True if operation successful. False otherwise.
 */
bool gesture_setProxIntLowThresh(uint8_t threshold)
{
    if( !gesture_wireWriteDataByte(APDS9960_PILT, threshold) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Returns the high threshold for proximity detection
 *
 * @return high threshold
 */
uint8_t gesture_getProxIntHighThresh()
{
    uint8_t val;
    
    /* Read value from PIHT register */
    if( !gesture_wireReadDataByte(APDS9960_PIHT, &val) ) {
        val = 0;
    }
    
    return val;
}

/**
 * @brief Sets the high threshold for proximity detection
 *
 * @param[in] threshold the high proximity threshold
 * @return True if operation successful. False otherwise.
 */
bool gesture_setProxIntHighThresh(uint8_t threshold)
{
    if( !gesture_wireWriteDataByte(APDS9960_PIHT, threshold) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Returns LED drive strength for proximity and ALS
 *
 * Value    LED Current
 *   0        100 mA
 *   1         50 mA
 *   2         25 mA
 *   3         12.5 mA
 *
 * @return the value of the LED drive strength. 0xFF on failure.
 */
uint8_t gesture_getLEDDrive()
{
    uint8_t val;
    
    /* Read value from CONTROL register */
    if( !gesture_wireReadDataByte(APDS9960_CONTROL, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out LED drive bits */
    val = (val >> 6) & 0b00000011;
    
    return val;
}

/**
 * @brief Sets the LED drive strength for proximity and ALS
 *
 * Value    LED Current
 *   0        100 mA
 *   1         50 mA
 *   2         25 mA
 *   3         12.5 mA
 *
 * @param[in] drive the value (0-3) for the LED drive strength
 * @return True if operation successful. False otherwise.
 */
bool gesture_setLEDDrive(uint8_t drive)
{
    uint8_t val;
    
    /* Read value from CONTROL register */
    if( !gesture_wireReadDataByte(APDS9960_CONTROL, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    drive &= 0b00000011;
    drive = drive << 6;
    val &= 0b00111111;
    val |= drive;
    
    /* Write register value back into CONTROL register */
    if( !gesture_wireWriteDataByte(APDS9960_CONTROL, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Returns receiver gain for proximity detection
 *
 * Value    Gain
 *   0       1x
 *   1       2x
 *   2       4x
 *   3       8x
 *
 * @return the value of the proximity gain. 0xFF on failure.
 */
uint8_t gesture_getProximityGain()
{
    uint8_t val;
    
    /* Read value from CONTROL register */
    if( !gesture_wireReadDataByte(APDS9960_CONTROL, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out PDRIVE bits */
    val = (val >> 2) & 0b00000011;
    
    return val;
}

/**
 * @brief Sets the receiver gain for proximity detection
 *
 * Value    Gain
 *   0       1x
 *   1       2x
 *   2       4x
 *   3       8x
 *
 * @param[in] drive the value (0-3) for the gain
 * @return True if operation successful. False otherwise.
 */
bool gesture_setProximityGain(uint8_t drive)
{
    uint8_t val;
    
    /* Read value from CONTROL register */
    if( !gesture_wireReadDataByte(APDS9960_CONTROL, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    drive &= 0b00000011;
    drive = drive << 2;
    val &= 0b11110011;
    val |= drive;
    
    /* Write register value back into CONTROL register */
    if( !gesture_wireWriteDataByte(APDS9960_CONTROL, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Returns receiver gain for the ambient light sensor (ALS)
 *
 * Value    Gain
 *   0        1x
 *   1        4x
 *   2       16x
 *   3       64x
 *
 * @return the value of the ALS gain. 0xFF on failure.
 */
uint8_t gesture_getAmbientLightGain()
{
    uint8_t val;
    
    /* Read value from CONTROL register */
    if( !gesture_wireReadDataByte(APDS9960_CONTROL, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out ADRIVE bits */
    val &= 0b00000011;
    
    return val;
}

/**
 * @brief Sets the receiver gain for the ambient light sensor (ALS)
 *
 * Value    Gain
 *   0        1x
 *   1        4x
 *   2       16x
 *   3       64x
 *
 * @param[in] drive the value (0-3) for the gain
 * @return True if operation successful. False otherwise.
 */
bool gesture_setAmbientLightGain(uint8_t drive)
{
    uint8_t val;
    
    /* Read value from CONTROL register */
    if( !gesture_wireReadDataByte(APDS9960_CONTROL, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    drive &= 0b00000011;
    val &= 0b11111100;
    val |= drive;
    
    /* Write register value back into CONTROL register */
    if( !gesture_wireWriteDataByte(APDS9960_CONTROL, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Get the current LED boost value
 * 
 * Value  Boost Current
 *   0        100%
 *   1        150%
 *   2        200%
 *   3        300%
 *
 * @return The LED boost value. 0xFF on failure.
 */
uint8_t gesture_getLEDBoost()
{
    uint8_t val;
    
    /* Read value from CONFIG2 register */
    if( !gesture_wireReadDataByte(APDS9960_CONFIG2, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out LED_BOOST bits */
    val = (val >> 4) & 0b00000011;
    
    return val;
}

/**
 * @brief Sets the LED current boost value
 *
 * Value  Boost Current
 *   0        100%
 *   1        150%
 *   2        200%
 *   3        300%
 *
 * @param[in] drive the value (0-3) for current boost (100-300%)
 * @return True if operation successful. False otherwise.
 */
bool gesture_setLEDBoost(uint8_t boost)
{
    uint8_t val;
    
    /* Read value from CONFIG2 register */
    if( !gesture_wireReadDataByte(APDS9960_CONFIG2, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    boost &= 0b00000011;
    boost = boost << 4;
    val &= 0b11001111;
    val |= boost;
    
    /* Write register value back into CONFIG2 register */
    if( !gesture_wireWriteDataByte(APDS9960_CONFIG2, val) ) {
        return false;
    }
    
    return true;
}    
   
/**
 * @brief Gets proximity gain compensation enable
 *
 * @return 1 if compensation is enabled. 0 if not. 0xFF on error.
 */
uint8_t gesture_getProxGainCompEnable()
{
    uint8_t val;
    
    /* Read value from CONFIG3 register */
    if( !gesture_wireReadDataByte(APDS9960_CONFIG3, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out PCMP bits */
    val = (val >> 5) & 0b00000001;
    
    return val;
}

/**
 * @brief Sets the proximity gain compensation enable
 *
 * @param[in] enable 1 to enable compensation. 0 to disable compensation.
 * @return True if operation successful. False otherwise.
 */
 bool gesture_setProxGainCompEnable(uint8_t enable)
{
    uint8_t val;
    
    /* Read value from CONFIG3 register */
    if( !gesture_wireReadDataByte(APDS9960_CONFIG3, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    enable &= 0b00000001;
    enable = enable << 5;
    val &= 0b11011111;
    val |= enable;
    
    /* Write register value back into CONFIG3 register */
    if( !gesture_wireWriteDataByte(APDS9960_CONFIG3, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the current mask for enabled/disabled proximity photodiodes
 *
 * 1 = disabled, 0 = enabled
 * Bit    Photodiode
 *  3       UP
 *  2       DOWN
 *  1       LEFT
 *  0       RIGHT
 *
 * @return Current proximity mask for photodiodes. 0xFF on error.
 */
uint8_t gesture_getProxPhotoMask()
{
    uint8_t val;
    
    /* Read value from CONFIG3 register */
    if( !gesture_wireReadDataByte(APDS9960_CONFIG3, &val) ) {
        return ERROR;
    }
    
    /* Mask out photodiode enable mask bits */
    val &= 0b00001111;
    
    return val;
}

/**
 * @brief Sets the mask for enabling/disabling proximity photodiodes
 *
 * 1 = disabled, 0 = enabled
 * Bit    Photodiode
 *  3       UP
 *  2       DOWN
 *  1       LEFT
 *  0       RIGHT
 *
 * @param[in] mask 4-bit mask value
 * @return True if operation successful. False otherwise.
 */
bool gesture_setProxPhotoMask(uint8_t mask)
{
    uint8_t val;
    
    /* Read value from CONFIG3 register */
    if( !gesture_wireReadDataByte(APDS9960_CONFIG3, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    mask &= 0b00001111;
    val &= 0b11110000;
    val |= mask;
    
    /* Write register value back into CONFIG3 register */
    if( !gesture_wireWriteDataByte(APDS9960_CONFIG3, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the entry proximity threshold for gesture sensing
 *
 * @return Current entry proximity threshold.
 */
uint8_t gesture_getGestureEnterThresh()
{
    uint8_t val;
    
    /* Read value from GPENTH register */
    if( !gesture_wireReadDataByte(APDS9960_GPENTH, &val) ) {
        val = 0;
    }
    
    return val;
}

/**
 * @brief Sets the entry proximity threshold for gesture sensing
 *
 * @param[in] threshold proximity value needed to start gesture mode
 * @return True if operation successful. False otherwise.
 */
bool gesture_setGestureEnterThresh(uint8_t threshold)
{
    if( !gesture_wireWriteDataByte(APDS9960_GPENTH, threshold) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the exit proximity threshold for gesture sensing
 *
 * @return Current exit proximity threshold.
 */
uint8_t gesture_getGestureExitThresh()
{
    uint8_t val;
    
    /* Read value from GEXTH register */
    if( !gesture_wireReadDataByte(APDS9960_GEXTH, &val) ) {
        val = 0;
    }
    
    return val;
}

/**
 * @brief Sets the exit proximity threshold for gesture sensing
 *
 * @param[in] threshold proximity value needed to end gesture mode
 * @return True if operation successful. False otherwise.
 */
bool gesture_setGestureExitThresh(uint8_t threshold)
{
    if( !gesture_wireWriteDataByte(APDS9960_GEXTH, threshold) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the gain of the photodiode during gesture mode
 *
 * Value    Gain
 *   0       1x
 *   1       2x
 *   2       4x
 *   3       8x
 *
 * @return the current photodiode gain. 0xFF on error.
 */
uint8_t gesture_getGestureGain()
{
    uint8_t val;
    
    /* Read value from GCONF2 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF2, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out GGAIN bits */
    val = (val >> 5) & 0b00000011;
    
    return val;
}

/**
 * @brief Sets the gain of the photodiode during gesture mode
 *
 * Value    Gain
 *   0       1x
 *   1       2x
 *   2       4x
 *   3       8x
 *
 * @param[in] gain the value for the photodiode gain
 * @return True if operation successful. False otherwise.
 */
bool gesture_setGestureGain(uint8_t gain)
{
    uint8_t val;
    
    /* Read value from GCONF2 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF2, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    gain &= 0b00000011;
    gain = gain << 5;
    val &= 0b10011111;
    val |= gain;
    
    /* Write register value back into GCONF2 register */
    if( !gesture_wireWriteDataByte(APDS9960_GCONF2, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the drive current of the LED during gesture mode
 *
 * Value    LED Current
 *   0        100 mA
 *   1         50 mA
 *   2         25 mA
 *   3         12.5 mA
 *
 * @return the LED drive current value. 0xFF on error.
 */
uint8_t gesture_getGestureLEDDrive()
{
    uint8_t val;
    
    /* Read value from GCONF2 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF2, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out GLDRIVE bits */
    val = (val >> 3) & 0b00000011;
    
    return val;
}

/**
 * @brief Sets the LED drive current during gesture mode
 *
 * Value    LED Current
 *   0        100 mA
 *   1         50 mA
 *   2         25 mA
 *   3         12.5 mA
 *
 * @param[in] drive the value for the LED drive current
 * @return True if operation successful. False otherwise.
 */
bool gesture_setGestureLEDDrive(uint8_t drive)
{
    uint8_t val;
    
    /* Read value from GCONF2 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF2, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    drive &= 0b00000011;
    drive = drive << 3;
    val &= 0b11100111;
    val |= drive;
    
    /* Write register value back into GCONF2 register */
    if( !gesture_wireWriteDataByte(APDS9960_GCONF2, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the time in low power mode between gesture detections
 *
 * Value    Wait time
 *   0          0 ms
 *   1          2.8 ms
 *   2          5.6 ms
 *   3          8.4 ms
 *   4         14.0 ms
 *   5         22.4 ms
 *   6         30.8 ms
 *   7         39.2 ms
 *
 * @return the current wait time between gestures. 0xFF on error.
 */
uint8_t gesture_getGestureWaitTime()
{
    uint8_t val;
    
    /* Read value from GCONF2 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF2, &val) ) {
        return ERROR;
    }
    
    /* Mask out GWTIME bits */
    val &= 0b00000111;
    
    return val;
}

/**
 * @brief Sets the time in low power mode between gesture detections
 *
 * Value    Wait time
 *   0          0 ms
 *   1          2.8 ms
 *   2          5.6 ms
 *   3          8.4 ms
 *   4         14.0 ms
 *   5         22.4 ms
 *   6         30.8 ms
 *   7         39.2 ms
 *
 * @param[in] the value for the wait time
 * @return True if operation successful. False otherwise.
 */
bool gesture_setGestureWaitTime(uint8_t time)
{
    uint8_t val;
    
    /* Read value from GCONF2 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF2, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    time &= 0b00000111;
    val &= 0b11111000;
    val |= time;
    
    /* Write register value back into GCONF2 register */
    if( !gesture_wireWriteDataByte(APDS9960_GCONF2, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the low threshold for ambient light interrupts
 *
 * @param[out] threshold current low threshold stored on the APDS-9960
 * @return True if operation successful. False otherwise.
 */
bool gesture_getLightIntLowThreshold(uint16_t *threshold)
{
    uint8_t val_byte;
    *threshold = 0;
    
    /* Read value from ambient light low threshold, low byte register */
    if( !gesture_wireReadDataByte(APDS9960_AILTL, &val_byte) ) {
        return false;
    }
    *threshold = val_byte;
    
    /* Read value from ambient light low threshold, high byte register */
    if( !gesture_wireReadDataByte(APDS9960_AILTH, &val_byte) ) {
        return false;
    }
    *threshold = *threshold + ((uint16_t)val_byte << 8);
    
    return true;
}

/**
 * @brief Sets the low threshold for ambient light interrupts
 *
 * @param[in] threshold low threshold value for interrupt to trigger
 * @return True if operation successful. False otherwise.
 */
bool gesture_setLightIntLowThreshold(uint16_t threshold)
{
    uint8_t val_low;
    uint8_t val_high;
    
    /* Break 16-bit threshold into 2 8-bit values */
    val_low = threshold & 0x00FF;
    val_high = (threshold & 0xFF00) >> 8;
    
    /* Write low byte */
    if( !gesture_wireWriteDataByte(APDS9960_AILTL, val_low) ) {
        return false;
    }
    
    /* Write high byte */
    if( !gesture_wireWriteDataByte(APDS9960_AILTH, val_high) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the high threshold for ambient light interrupts
 *
 * @param[out] threshold current low threshold stored on the APDS-9960
 * @return True if operation successful. False otherwise.
 */
bool gesture_getLightIntHighThreshold(uint16_t *threshold)
{
    uint8_t val_byte;
    *threshold = 0;
    
    /* Read value from ambient light high threshold, low byte register */
    if( !gesture_wireReadDataByte(APDS9960_AIHTL, &val_byte) ) {
        return false;
    }
    *threshold = val_byte;
    
    /* Read value from ambient light high threshold, high byte register */
    if( !gesture_wireReadDataByte(APDS9960_AIHTH, &val_byte) ) {
        return false;
    }
    *threshold = *threshold + ((uint16_t)val_byte << 8);
    
    return true;
}

/**
 * @brief Sets the high threshold for ambient light interrupts
 *
 * @param[in] threshold high threshold value for interrupt to trigger
 * @return True if operation successful. False otherwise.
 */
bool gesture_setLightIntHighThreshold(uint16_t threshold)
{
    uint8_t val_low;
    uint8_t val_high;
    
    /* Break 16-bit threshold into 2 8-bit values */
    val_low = threshold & 0x00FF;
    val_high = (threshold & 0xFF00) >> 8;
    
    /* Write low byte */
    if( !gesture_wireWriteDataByte(APDS9960_AIHTL, val_low) ) {
        return false;
    }
    
    /* Write high byte */
    if( !gesture_wireWriteDataByte(APDS9960_AIHTH, val_high) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets the low threshold for proximity interrupts
 *
 * @param[out] threshold current low threshold stored on the APDS-9960
 * @return True if operation successful. False otherwise.
 */
bool gesture_getProximityIntLowThreshold(uint8_t *threshold)
{
    *threshold = 0;
    
    /* Read value from proximity low threshold register */
    if( !gesture_wireReadDataByte(APDS9960_PILT, threshold) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Sets the low threshold for proximity interrupts
 *
 * @param[in] threshold low threshold value for interrupt to trigger
 * @return True if operation successful. False otherwise.
 */
bool gesture_setProximityIntLowThreshold(uint8_t threshold)
{
    
    /* Write threshold value to register */
    if( !gesture_wireWriteDataByte(APDS9960_PILT, threshold) ) {
        return false;
    }
    
    return true;
}
    
/**
 * @brief Gets the high threshold for proximity interrupts
 *
 * @param[out] threshold current low threshold stored on the APDS-9960
 * @return True if operation successful. False otherwise.
 */
bool gesture_getProximityIntHighThreshold(uint8_t *threshold)
{
    *threshold = 0;
    
    /* Read value from proximity low threshold register */
    if( !gesture_wireReadDataByte(APDS9960_PIHT, threshold) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Sets the high threshold for proximity interrupts
 *
 * @param[in] threshold high threshold value for interrupt to trigger
 * @return True if operation successful. False otherwise.
 */
bool gesture_setProximityIntHighThreshold(uint8_t threshold)
{
    
    /* Write threshold value to register */
    if( !gesture_wireWriteDataByte(APDS9960_PIHT, threshold) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets if ambient light interrupts are enabled or not
 *
 * @return 1 if interrupts are enabled, 0 if not. 0xFF on error.
 */
uint8_t gesture_getAmbientLightIntEnable()
{
    uint8_t val;
    
    /* Read value from ENABLE register */
    if( !gesture_wireReadDataByte(APDS9960_ENABLE, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out AIEN bit */
    val = (val >> 4) & 0b00000001;
    
    return val;
}

/**
 * @brief Turns ambient light interrupts on or off
 *
 * @param[in] enable 1 to enable interrupts, 0 to turn them off
 * @return True if operation successful. False otherwise.
 */
bool gesture_setAmbientLightIntEnable(uint8_t enable)
{
    uint8_t val;
    
    /* Read value from ENABLE register */
    if( !gesture_wireReadDataByte(APDS9960_ENABLE, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    enable &= 0b00000001;
    enable = enable << 4;
    val &= 0b11101111;
    val |= enable;
    
    /* Write register value back into ENABLE register */
    if( !gesture_wireWriteDataByte(APDS9960_ENABLE, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets if proximity interrupts are enabled or not
 *
 * @return 1 if interrupts are enabled, 0 if not. 0xFF on error.
 */
uint8_t gesture_getProximityIntEnable()
{
    uint8_t val;
    
    /* Read value from ENABLE register */
    if( !gesture_wireReadDataByte(APDS9960_ENABLE, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out PIEN bit */
    val = (val >> 5) & 0b00000001;
    
    return val;
}

/**
 * @brief Turns proximity interrupts on or off
 *
 * @param[in] enable 1 to enable interrupts, 0 to turn them off
 * @return True if operation successful. False otherwise.
 */
bool gesture_setProximityIntEnable(uint8_t enable)
{
    uint8_t val;
    
    /* Read value from ENABLE register */
    if( !gesture_wireReadDataByte(APDS9960_ENABLE, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    enable &= 0b00000001;
    enable = enable << 5;
    val &= 0b11011111;
    val |= enable;
    
    /* Write register value back into ENABLE register */
    if( !gesture_wireWriteDataByte(APDS9960_ENABLE, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Gets if gesture interrupts are enabled or not
 *
 * @return 1 if interrupts are enabled, 0 if not. 0xFF on error.
 */
uint8_t gesture_getGestureIntEnable()
{
    uint8_t val;
    
    /* Read value from GCONF4 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF4, &val) ) {
        return ERROR;
    }
    
    /* Shift and mask out GIEN bit */
    val = (val >> 1) & 0b00000001;
    
    return val;
}

/**
 * @brief Turns gesture-related interrupts on or off
 *
 * @param[in] enable 1 to enable interrupts, 0 to turn them off
 * @return True if operation successful. False otherwise.
 */
bool gesture_setGestureIntEnable(uint8_t enable)
{
    uint8_t val;
    
    /* Read value from GCONF4 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF4, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    enable &= 0b00000001;
    enable = enable << 1;
    val &= 0b11111101;
    val |= enable;
    
    /* Write register value back into GCONF4 register */
    if( !gesture_wireWriteDataByte(APDS9960_GCONF4, val) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Clears the ambient light interrupt
 *
 * @return True if operation completed successfully. False otherwise.
 */
bool gesture_clearAmbientLightInt()
{
    uint8_t throwaway;
    if( !gesture_wireReadDataByte(APDS9960_AICLEAR, &throwaway) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Clears the proximity interrupt
 *
 * @return True if operation completed successfully. False otherwise.
 */
bool gesture_clearProximityInt()
{
    uint8_t throwaway;
    if( !gesture_wireReadDataByte(APDS9960_PICLEAR, &throwaway) ) {
        return false;
    }
    
    return true;
}

/**
 * @brief Tells if the gesture state machine is currently running
 *
 * @return 1 if gesture state machine is running, 0 if not. 0xFF on error.
 */
uint8_t gesture_getGestureMode()
{
    uint8_t val;
    
    /* Read value from GCONF4 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF4, &val) ) {
        return ERROR;
    }
    
    /* Mask out GMODE bit */
    val &= 0b00000001;
    
    return val;
}

/**
 * @brief Tells the state machine to either enter or exit gesture state machine
 *
 * @param[in] mode 1 to enter gesture state machine, 0 to exit.
 * @return True if operation successful. False otherwise.
 */
bool gesture_setGestureMode(uint8_t mode)
{
    uint8_t val;
    
    /* Read value from GCONF4 register */
    if( !gesture_wireReadDataByte(APDS9960_GCONF4, &val) ) {
        return false;
    }
    
    /* Set bits in register to given value */
    mode &= 0b00000001;
    val &= 0b11111110;
    val |= mode;
    
    /* Write register value back into GCONF4 register */
    if( !gesture_wireWriteDataByte(APDS9960_GCONF4, val) ) {
        return false;
    }
    
    return true;
}

/*******************************************************************************
 * Raw I2C Reads and Writes
 ******************************************************************************/

/**
 * @brief Initializes Linux i2c device
 *
 * @param[in] dev the path to the I2C device
 * @return True if successful. False otherwise.
 */
bool gesture_wireInitialize(const char *dev, int addr)
{
    i2c_dev = open(dev, O_RDWR);
    if (i2c_dev < 0) {
        return false;
    }
    if (ioctl(i2c_dev, I2C_SLAVE, addr) < 0) {
        return false;
    }
    return true;
}

/**
 * @brief Writes a single byte to the I2C device and specified register
 *
 * @param[in] reg the register in the I2C device to write to
 * @param[in] val the 1-byte value to write to the I2C device
 * @return True if successful write operation. False otherwise.
 */
bool gesture_wireWriteDataByte(uint8_t reg, uint8_t val)
{
    if(i2c_smbus_write_byte_data(i2c_dev, reg, val) < 0) {
        return false;
    }
    return true;
}

/**
 * @brief Writes a block (array) of bytes to the I2C device and register
 *
 * @param[in] reg the register in the I2C device to write to
 * @param[in] val pointer to the beginning of the data byte array
 * @param[in] len the length (in bytes) of the data to write
 * @return True if successful write operation. False otherwise.
 */
bool gesture_wireWriteDataBlock(  uint8_t reg, 
                                        uint8_t *val, 
                                        uint16_t len)
{
    if(i2c_smbus_write_block_data(i2c_dev, reg, len, val) < 0) {
        return false;
    }
    
    return true;
}

/**
 * @brief Reads a single byte from the I2C device and specified register
 *
 * @param[in] reg the register to read from
 * @param[out] the value returned from the register
 * @return True if successful read operation. False otherwise.
 */
bool gesture_wireReadDataByte(uint8_t reg, uint8_t *val)
{
    int tmp = i2c_smbus_read_byte_data(i2c_dev, reg);
    if(tmp < 0) {
        return false;
    }
    
    memcpy(val, &tmp, 1);

    return true;
}

/**
 * @brief Reads a block (array) of bytes from the I2C device and register
 *
 * @param[in] reg the register to read from
 * @param[out] val pointer to the beginning of the data
 * @param[in] len number of bytes to read
 * @return Number of bytes read. -1 on read error.
 */
int16_t gesture_wireReadDataBlock(   uint8_t reg, 
                                        uint8_t *val, 
                                        uint16_t len)
{
    uint16_t i = 0;
    int tmp = i2c_smbus_read_byte_data(i2c_dev, reg);
    if(tmp < 0) {
        return -1;
    }
    memcpy(&val[i], &tmp, 1);
    for(i = 1; i < len; i++) {        
        tmp = i2c_smbus_read_byte(i2c_dev);
        if(tmp < 0) {
            break;
        }
        reg++;
        memcpy(&val[i], &tmp, 1);
    }
    
    return i;
}
