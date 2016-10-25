#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <linux/spi/spidev.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <stdint.h>
#include <sys/time.h>

#include "lib_png.h"
#include "lib_jpeg.h"
#include "lib_spi.h"
#include "lib_gpio.h"


int oled_init(void);
void oled_close(void);

void oled_power(uint8_t power);

void oled_fill(uint8_t r, uint8_t g, uint8_t b);
void oled_update(void);
void oled_png(const char* filename, uint8_t x, uint8_t y);
void oled_png_buf(uint8_t* buf, uint32_t len, uint8_t x, uint8_t y);
int oled_jpeg(char *jpegFile, uint8_t x, uint8_t y);
void oled_pixel(uint8_t x, uint8_t y, uint8_t r, uint8_t g, uint8_t b);
