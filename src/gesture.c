/****************************************************************
GestureTest.ino
APDS-9960 RGB and Gesture Sensor
Shawn Hymel @ SparkFun Electronics
May 30, 2014
https://github.com/sparkfun/APDS-9960_RGB_and_Gesture_Sensor

Tests the gesture sensing abilities of the APDS-9960. Configures
APDS-9960 over I2C and waits for gesture events. Calculates the
direction of the swipe (up, down, left, right) and displays it
on a serial console. 

To perform a NEAR gesture, hold your hand
far above the sensor and move it close to the sensor (within 2
inches). Hold your hand there for at least 1 second and move it
away.

To perform a FAR gesture, hold your hand within 2 inches of the
sensor for at least 1 second and then move it above (out of
range) of the sensor.

Hardware Connections:

IMPORTANT: The APDS-9960 can only accept 3.3V!
 
 Arduino Pin  APDS-9960 Board  Function
 
 3.3V         VCC              Power
 GND          GND              Ground
 A4           SDA              I2C Data
 A5           SCL              I2C Clock
 2            INT              Interrupt

Resources:
Include Wire.h and SparkFun_APDS-9960.h

Development environment specifics:
Written in Arduino 1.0.5
Tested with SparkFun Arduino Pro Mini 3.3V

This code is beerware; if you see me (or any other SparkFun 
employee) at the local, and you've found our code helpful, please
buy us a round!

Distributed as-is; no warranty is given.
****************************************************************/

#include "lib_gesture.h"

void setup() {
    setvbuf(stdout, NULL, _IOLBF, 0);
 
    // Initialize interrupt service routine
    //attachInterrupt(0, interruptRoutine, FALLING);

    // Initialize APDS-9960 (configure I2C and initial values)
    if ( gesture_init() ) {
        printf("APDS-9960 initialization complete\n");
    } else {
        printf("Something went wrong during APDS-9960 init!\n");
    }

    // Start running the APDS-9960 gesture sensor engine
    if ( gesture_enableGestureSensor(true) ) {
        printf("Gesture sensor is now running\n");
    } else {
        printf("Something went wrong during gesture sensor init!\n");
    }
}

void handleGesture() {
    //printf("********************************************************************************************************************\n");
    if ( gesture_isGestureAvailable() ) {
    switch ( gesture_readGesture() ) {
      case DIR_UP:
        printf("G=U\n");
        break;
      case DIR_DOWN:
        printf("G=D\n");
        break;
      case DIR_LEFT:
        printf("G=L\n");
        break;
      case DIR_RIGHT:
        printf("G=R\n");
        break;
      case DIR_NEAR:
        printf("G=N\n");
        break;
      case DIR_FAR:
        printf("G=F\n");
        break;
      //default:
        //printf("************** NONE **************\n");
    }
  }
}

int kbhit()
{
    struct timeval tv;
    fd_set fds;
    tv.tv_sec = 0;
    tv.tv_usec = 0;
    FD_ZERO(&fds);
    FD_SET(STDIN_FILENO, &fds); //STDIN_FILENO is 0
    select(STDIN_FILENO+1, &fds, NULL, NULL, &tv);
    return FD_ISSET(STDIN_FILENO, &fds);
}

int main(int argc, char **argv) {
    setup();
    uint16_t i;
    uint8_t dial, button, pressed = 0;
    while(!kbhit()) {
        handleGesture();
        usleep(150000);
    }
    printf("Powering down...");
    gesture_disableGestureSensor();
    gesture_disablePower();
    char buffer[32];
    read(STDIN_FILENO, buffer, 32);
    printf("done.\n");
    return 0;
}
