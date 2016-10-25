#!/bin/sh
gcc ../gesture.c ../lib/lib_gesture.c -I../lib/ -std=gnu11 -o ../gesture && mv ../gesture ../../bin/