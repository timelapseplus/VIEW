#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <stdint.h>
#include <unistd.h>
#include <fcntl.h>
#include <linux/fb.h>
#include <sys/mman.h>
#include <sys/ioctl.h>

#include "lib_jpeg.h"

struct fb_var_screeninfo vinfo;
struct fb_fix_screeninfo finfo;
int fbfd = 0;
char *fbp = 0;
long int screensize = 0;


int open_raw_fb()
{
    int xMax = 0, yMax = 0;

    // Open the file for reading and writing
    fbfd = open("/dev/fb0", O_RDWR);
    if (fbfd == -1) {
        perror("Error: cannot open framebuffer device");
        exit(1);
    }
    printf("The framebuffer device was opened successfully.\n");

    // Get fixed screen information
    if (ioctl(fbfd, FBIOGET_FSCREENINFO, &finfo) == -1) {
        perror("Error reading fixed information");
        exit(2);
    }

    // Get variable screen information
    if (ioctl(fbfd, FBIOGET_VSCREENINFO, &vinfo) == -1) {
        perror("Error reading variable information");
        exit(3);
    }

    printf("%dx%d, %dbpp\n", vinfo.xres, vinfo.yres, vinfo.bits_per_pixel);

    // Figure out the size of the screen in bytes
    screensize = vinfo.xres * vinfo.yres * vinfo.bits_per_pixel / 8;

    // Map the device to memory
    fbp = (char *)mmap(0, screensize, PROT_READ | PROT_WRITE, MAP_SHARED, fbfd, 0);
    if ((int)fbp == -1) {
        perror("Error: failed to map framebuffer device to memory");
        exit(4);
    }
    printf("The framebuffer device was mapped to memory successfully.\n");

    return 0;
}

int close_raw_fb()
{
    munmap(fbp, screensize);
    close(fbfd);
    fbp = 0;
    return 0;
}

int write_fb_jpeg(char *jpegFile, uint8_t xPos, uint8_t yPos)
{
    int size;
    char *buf;
    FILE *f;
    long int location = 0;

    if(!fbp) open_raw_fb();

    f = fopen(jpegFile, "rb");
    if (!f) {
        printf("Error opening the input file: %s.\n", jpegFile);
        return 1;
    }
    fseek(f, 0, SEEK_END);
    size = (int) ftell(f);
    buf = malloc(size);
    fseek(f, 0, SEEK_SET);
    size = (int) fread(buf, 1, size, f);
    fclose(f);

    njInit();
    if (njDecode(buf, size)) {
        printf("Error decoding the input file.\n");
        return 1;
    }

    uint8_t *img = njGetImage();
    uint16_t jw = njGetWidth();
    uint16_t jh = njGetHeight();
    uint16_t js = njGetImageSize();
    uint16_t jx, jy;
    uint8_t ox, oy;

    int w = vinfo.xres;
    int h = vinfo.yres;

    if(w > jw) w = jw;
    if(h > jh) h = jh;

    for(oy = 0; oy < h - yPos; oy++)
    {
        for(ox = 0; ox < w - xPos; ox++)
        {
            uint16_t i = (uint16_t)oy * jw * 3 + (uint16_t)ox * 3;

            location = (ox+vinfo.xoffset+xPos) * (vinfo.bits_per_pixel/8) +
                       (oy+vinfo.yoffset+yPos) * finfo.line_length;

            int b = img[i + 2]>>3;
            int g = img[i + 1]>>3;
            int r = img[i + 0]>>3;
            unsigned short int t = r<<11 | g << 5 | b;
            //16 15 14 13 12 11 10 09 08 07 06 05 04 03 02 01
            *((unsigned short int*)(fbp + location)) = t;
        }
    }
    njDone();

    return 0;
}

int main() 
{
    write_fb_jpeg("/root/time-lapse/tl-270/img00001.jpg", 0, 0);
}
