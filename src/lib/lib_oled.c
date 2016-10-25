#include "lib_oled.h"

void _oledCmd(unsigned char cmd);
void _oledData(unsigned char data);
void _oledSetPos(unsigned char x_pos, unsigned char y_pos);
void _oledWriteMemStart();

#define SET_OLED_DATA() gpio_set_output(SUNXI_PORT_D_BASE, SUNXI_PIO_06)
#define SET_OLED_COMMAND() gpio_clear_output(SUNXI_PORT_D_BASE, SUNXI_PIO_06)

#define SET_RES() gpio_set_output(SUNXI_PORT_D_BASE, SUNXI_PIO_05)
#define CLEAR_RES() gpio_clear_output(SUNXI_PORT_D_BASE, SUNXI_PIO_05)

#define PWR_ON() gpio_set_output(SUNXI_PORT_D_BASE, SUNXI_PIO_07)
#define PWR_OFF() gpio_clear_output(SUNXI_PORT_D_BASE, SUNXI_PIO_07)

#define FLIP_SCREEN 1

uint8_t screenBuffer[(128*160*3*6)/8];

int spi_fd;

void _oledCmd(unsigned char cmd) {
    SET_OLED_COMMAND();
    
    write(spi_fd, &cmd, 1);
}

void _oledData(unsigned char data) {
    SET_OLED_DATA();
    write(spi_fd, &data, 1);
}

int _hardwareInit() {
    if(spi_fd) return 0; // already open

    gpio_init();

    gpio_cfg_output(SUNXI_PORT_D_BASE, SUNXI_PIO_06_IDX); // OLED_DC
    gpio_cfg_output(SUNXI_PORT_D_BASE, SUNXI_PIO_05_IDX); // OLED_RESET
    gpio_cfg_output(SUNXI_PORT_D_BASE, SUNXI_PIO_07_IDX); // OLED_PWR_EN

    spi_config_t config = {0};

    /* Set default values */
    config.mode = 0;
    config.bits_per_word = 8;
    config.speed = 64000000;
    config.delay = 0;

    spi_fd = spi_open("/dev/spidev32766.0", config);
    
    if(spi_fd < 0)
    {
        printf("Error opening SPI\n");
        return -1;
    }
}

int oled_init() {
    _hardwareInit();
    
    SET_OLED_COMMAND();
    CLEAR_RES();
    usleep(500000);
    SET_RES();
    usleep(500000);

    _oledCmd(0x04);// Set Normal Driving Current
    _oledData(0x03);// Disable Oscillator Power Down
    usleep(2000);
    _oledCmd(0x04); // Enable Power Save Mode
    _oledData(0x00); // Set Normal Driving Current
    usleep(2000); // Disable Oscillator Power Down
    _oledCmd(0x3B);
    _oledData(0x00);
    _oledCmd(0x02);
    _oledData(0x01); // Set EXPORT1 Pin at Internal Clock
    // Oscillator operates with external resister.
    // Internal Oscillator On
    _oledCmd(0x03);
    _oledData(0x90); // Set Frame Rate as 120Hz
    _oledCmd(0x80);
    _oledData(0x01); // Set Reference Voltage Controlled by External Resister
    _oledCmd(0x08);// Set Pre-Charge Time of Red
    _oledData(0x04);
    _oledCmd(0x09);// Set Pre-Charge Time of Green
    _oledData(0x05);
    _oledCmd(0x0A);// Set Pre-Charge Time of Blue
    _oledData(0x05);
    _oledCmd(0x0B);// Set Pre-Charge Current of Red
    _oledData(0x9D);
    _oledCmd(0x0C);// Set Pre-Charge Current of Green
    _oledData(0x8C);
    _oledCmd(0x0D);// Set Pre-Charge Current of Blue
    _oledData(0x57);
    _oledCmd(0x10);// Set Driving Current of Red
    _oledData(0x56);
    _oledCmd(0x11);// Set Driving Current of Green
    _oledData(0x4D);
    _oledCmd(0x12);// Set Driving Current of Blue
    _oledData(0x46);
    _oledCmd(0x13);
    _oledData(0xa0); // Set Color Sequence
    _oledCmd(0x14);
    _oledData(0x01); // Set MCU Interface Mode
    _oledCmd(0x16);
    _oledData(0x76);
    _oledCmd(0x20);
    _oledData(0x00); // Shift Mapping RAM Counter
    _oledCmd(0x21);
    _oledData(0x00); // Shift Mapping RAM Counter
    _oledCmd(0x28);
    _oledData(0x7F); // 1/128 Duty (0x0F~0x7F)
    _oledCmd(0x29);
    _oledData(0x00); // Set Mapping RAM Display Start Line (0x00~0x7F)

    _oledCmd(0x06);
    _oledData(0x01); // Display On (0x00/0x01)
    _oledCmd(0x05); // Disable Power Save Mode
    _oledData(0x00); // Set All Internal Register Value as Normal Mode
    _oledCmd(0x15);
    _oledData(0x00); // Set RGB Interface Polarity as Active Low

    _oledCmd(0x17); //set column start address
    _oledData(0x00); //
    _oledCmd(0x18); //set column end address
    _oledData(0x9F); //
    _oledCmd(0x19); //set row start address
    _oledData(0x00); //
    _oledCmd(0x1A); //set row end address
    _oledData(0x7F); //

    oled_fill(0, 0, 0); // clear screen
    oled_update();
    
    PWR_ON();

    printf("oled initialized\n");

    return 0;
}

void oled_close()
{
    if(spi_fd) spi_close(spi_fd);
}

void oled_power(uint8_t power)
{
    _hardwareInit();
    if(power)
    {
        PWR_ON();
    }
    else
    {
        PWR_OFF();
    }
}

void _oledSetPos(unsigned char x_pos, unsigned char y_pos)    // set x,y address
{
    _oledCmd(0x20);
    _oledData(x_pos);
    _oledCmd(0x21);
    _oledData(y_pos);
}

void _oledWriteMemStart()    // write to RAM command
{
    _oledCmd(0x22);
}

void oled_pixel(uint8_t x, uint8_t y, uint8_t r, uint8_t g, uint8_t b)
{
    uint8_t d[3];
    d[0] = r;
    d[1] = g;
    d[2] = b;
    uint32_t bitIndex, byteIndex;
    uint8_t i, mask, bitOffset, data;

    if(y > 127) return;
    if(x > 159) return;

#if FLIP_SCREEN
    y = 127 - y;
    x = 159 - x;
#endif

    for(i = 0; i < 3; i++)
    {
        bitIndex = ((uint32_t)x + (uint32_t)y * 160UL) * 3UL * 6UL + (2UL - (uint32_t)i) * 6UL;
        byteIndex = bitIndex / 8UL;
        bitOffset = (uint8_t)(bitIndex % 8UL);

        mask = 0b11111100>>bitOffset;
        data = d[i]>>bitOffset;

        screenBuffer[byteIndex] &= ~(mask);
        screenBuffer[byteIndex] |= (mask & data);
        if(bitOffset > 2)
        {
            mask = 0b11111100<<(8-bitOffset);
            data = d[i]<<(8-bitOffset);
            screenBuffer[byteIndex + 1] &= ~(mask);
            screenBuffer[byteIndex + 1] |= (mask & data);
        }
    }
}

void oled_fill(uint8_t r, uint8_t g, uint8_t b)    // fill screen with a given color
{
    int x, y, t = 0;
    for(y = 0; y < 128; y++)
    {
        for(x = 0; x < 160; x++)
        {
            oled_pixel(x, y, r, g, b);
        }
    }
}

void oled_update() {
    _hardwareInit();
    _oledSetPos(0,0);
    _oledWriteMemStart();

    SET_OLED_DATA();
    write(spi_fd, ((uint8_t *)screenBuffer), sizeof(screenBuffer));
}

void oled_png(const char* filename, uint8_t x, uint8_t y)
{
    unsigned int error;
    unsigned char* image;
    unsigned int width, height;

    unsigned int w, h, ox, oy, s;

    error = lodepng_decode32_file(&image, &width, &height, filename);
    if(error)
    {
        printf("error %u: %s\n", error, lodepng_error_text(error));
        if(image) free(image);
        return;
    }

    if(width > 160) w = 160; else w = width;
    if(height > 128) h = 128; else h = height;

    s = width * height * 4;
    uint32_t i;
    for(oy = 0; oy < h; oy++) {
        for(ox = 0; ox < w; ox++) {
            i = s - ((oy * width + ox) * 4);
            oled_pixel(ox + x, (h - oy - 1) + y, image[i - 4], image[i - 3], image[i - 2]);
        }
    }

    free(image);
}

void oled_png_buf(uint8_t* buf, uint32_t len, uint8_t x, uint8_t y)
{
    unsigned int error;
    unsigned char* image;
    unsigned int width, height;

    unsigned int w, h, ox, oy, s;

    error = lodepng_decode32(&image, &width, &height, buf, len);
    if(error)
    {
        printf("error %u: %s\n", error, lodepng_error_text(error));
        if(image) free(image);
        return;
    }

    if(width > 160) w = 160; else w = width;
    if(height > 128) h = 128; else h = height;

    s = width * height * 4;
    uint32_t i;
    for(oy = 0; oy < h; oy++) {
        for(ox = 0; ox < w; ox++) {
            i = s - ((oy * width + ox) * 4);
            oled_pixel(ox + x, (h - oy - 1) + y, image[i - 4], image[i - 3], image[i - 2]);
        }
    }

    free(image);
}

int oled_jpeg(char *jpegFile, uint8_t x, uint8_t y)
{
    int size;
    char *buf;
    FILE *f;

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

    uint8_t w = 160;
    uint8_t h = 128;

    if(w > jw) w = jw;
    if(h > jh) h = jh;

    for(oy = 0; oy < h; oy++)
    {
        for(ox = 0; ox < w; ox++)
        {
            uint16_t i = (uint16_t)oy * jw * 3 + (uint16_t)ox * 3;
            oled_pixel((w - ox) + x, oy + y, img[i + 0], img[i + 1], img[i + 2]);
        }
    }
    njDone();
    return 0;
}
