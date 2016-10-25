#!/bin/sh
gcc ../inputs.c ../lib/lib_gpio.c -I../lib/ -std=gnu11 -o ../inputs && mv ../inputs ../../bin/