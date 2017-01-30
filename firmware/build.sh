#!/bin/sh

avr-gcc -g -Os -mmcu=attiny841 -c mcu.c
avr-gcc -g -mmcu=attiny841 -o mcu.elf mcu.o
avr-objcopy -j .text -j .data -O ihex mcu.elf mcu.hex
rm mcu.o
rm mcu.elf

