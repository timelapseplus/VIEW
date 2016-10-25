#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <cairo.h>

#include "lib_oled.h"

#define FILE_TYPE_PNG 0
#define FILE_TYPE_JPG 1

#define MAX_MENU 32
#define MAX_LIST 64

void rounded_rectangle(cairo_t *cr, float x, float y, float w, float h, float r);
void write_surface_to_oled(cairo_surface_t *surface, int x, int y);
void play_video(char *pathFormat, uint8_t fileType, uint16_t frames, uint8_t framerate);
void play_sound(char *path);
void drawMenu(char list[32][32], uint8_t list_length, float selected, uint8_t action);
void drawValue(char param[32], char value[32], uint8_t action);
int displayJpeg(char *jpegFile, uint8_t x, uint8_t y);
int displayPng(char *pngFile, uint8_t x, uint8_t y);
void newScreen();
void writeScreen();

cairo_surface_t *screen;
char status[64];
uint8_t status_present = 0;

int main (int argc, char *argv[])
{
    setvbuf(stdout, NULL, _IOLBF, 0);
    oled_init();
    uint8_t *buf = malloc(1024 * 96);

    char menu[MAX_MENU][32];
    char value[32];
    char param[32];

    uint8_t count = 0, value_present = 0;
    uint8_t menu_selected = 0;

    size_t size;
    char *line = NULL;
    int pos;

    for(;;)
    {
        usleep(10);
        if(line)
        {
            free(line);
            line = NULL;
        }

        if(getline(&line, &size, stdin) == -1) continue;

        int line_len = strlen(line);
        if(line_len < size) size = line_len;
        //printf("line_len: %d\n", line_len);

        pos = strncmp(line, "QUIT", 4);
        if(pos == 0) 
        {
            break;
        }

        pos = strncmp(line, "MENU=", 5);
        if(pos == 0) 
        {
            count = 0;
            uint16_t i = 5;
            uint16_t lastPos = i;
            while(i < size) {
                if(line[i] == '|')
                {
                    uint16_t len = i - lastPos;
                    if(len >= 32) len = 31;
                    memcpy(menu[count], &line[lastPos], len);
                    menu[count][len] = '\0';
                    count++;
                    lastPos = i + 1;
                    if(count >= MAX_MENU) break;
                }
                i++;
            }
            continue;    
        }

        pos = strncmp(line, "VALUE=", 6);
        if(pos == 0) 
        {
            //printf("line (%d): %s\n", size, line);
            value_present = 0;
            uint16_t i = 6;
            uint16_t lastPos = i;
            while(i < size && line[i] != '\n') {
                if(line[i] == '|')
                {
                    uint16_t len = i - lastPos;
                    if(len >= 32) len = 31;
                    if(len > 0) {
                        memcpy(param, &line[lastPos], len);
                        param[len] = '\0';
                        //printf("param (%d): '%s'\n", lastPos, param);
                        lastPos = i + 1;
                        value_present = 1;
                        break;
                    }
                    lastPos = i + 1;
                }
                i++;
            }
            i++;
            if(!value_present) continue;
            value_present = 0;
            while(i < size && line[i] != '\n') {
                if(line[i] == '|')
                {
                    uint16_t len = i - lastPos;
                    if(len >= 32) len = 31;
                    if(len > 0) {
                        memcpy(value, &line[lastPos], len);
                        value[len] = '\0';
                        //printf("value (%d): '%s'\n", lastPos, value);
                        value_present = 1;
                        lastPos = i + 1;
                        break;
                    }
                    lastPos = i + 1;
                }
                i++;
            }
            continue;    
        }

        pos = strncmp(line, "STATUS=", 7);
        if(pos == 0) 
        {
            status_present = 0;
            uint16_t i = 7;
            uint16_t lastPos = i;
            while(i < size && line[i] != '\n') {
                if(line[i] == '|')
                {
                    uint16_t len = i - lastPos;
                    if(len >= 32) len = 31;
                    if(len > 0) {
                        memcpy(status, &line[lastPos], len);
                        status[len] = '\0';
                        //printf("status (%d): '%s'\n", lastPos, param);
                        lastPos = i + 1;
                        status_present = 1;
                        break;
                    }
                    lastPos = i + 1;
                }
                i++;
            }
            continue;    
        }

        pos = strncmp(line, "SELECT=", 7);
        if(pos == 0) 
        {
            if(size >= 7 + 3) {
                char tens = line[7];
                char ones = line[8];
                menu_selected = 0;
                if(tens >= '0' && tens <= '9') menu_selected += (tens - '0') * 10;
                if(ones >= '0' && ones <= '9') menu_selected += (ones - '0');
            }            
            continue;    
        }

        pos = strncmp(line, "DISPLAY", 7);
        if(pos == 0) 
        {
            play_sound("/home/view/current/sounds/tap-fuzzy.wav");
            newScreen();
            if(value_present)
            {
                drawValue(param, value, 0);
            }
            else
            {
                drawMenu(menu, count, (float)menu_selected, 0);
            }
            writeScreen();
            continue;    
        }

        pos = strncmp(line, "JPEG=", 4);
        if(pos == 0) 
        {
            line[strlen(line) - 1] = '\0';
            displayJpeg(&line[5], 0, 0);
            continue;    
        }

        pos = strncmp(line, "PNG=", 3);
        if(pos == 0) 
        {
            line[strlen(line) - 1] = '\0';
            displayPng(&line[4], 0, 0);
            continue;    
        }

        pos = strncmp(line, "VIDEO=", 4);
        if(pos == 0) 
        {
            uint16_t frames = 0;
            for(pos = 5; pos < strlen(line); pos++)
            {
                if(line[pos] == ':')
                {
                    line[pos] = '\0';
                    uint8_t i;
                    for(i = 1; i < strlen(&line[5]); i++)
                    {
                        frames *= 10;
                        frames += line[5 + i] - '0'; 
                    }
                    pos++;
                    break;
                }
            }
            line[pos + strlen(&line[pos]) - 1] = '\0';
            printf("Playing video: %s, %d frames\n", &line[pos], frames);
            play_video(&line[pos], FILE_TYPE_JPG, frames, 24);
            continue;    
        }

        pos = strncmp(line, "HIDE", 4);
        if(pos == 0) 
        {
            oled_power(0);
            continue;    
        }

        pos = strncmp(line, "SHOW", 4);
        if(pos == 0) 
        {
            oled_power(1);
            continue;    
        }

    }

    oled_close();
    oled_power(0);

    return 0;
}

#define MENU_ACTION_IMMEDIATE 0
#define MENU_ACTION_SLIDE_RIGHT 1
#define MENU_ACTION_SLIDE_LEFT 2
#define MENU_ACTION_SLIDE_UPDATE 3

#define MENU_XOFFSET 5
#define MENU_YOFFSET 35
#define MENU_LINE_HEIGHT 25
#define MENU_FONT_SIZE 14

void newScreen()
{
    screen = cairo_image_surface_create (CAIRO_FORMAT_RGB24, 160, 128);
}

void writeScreen()
{
    write_surface_to_oled(screen, 0, 0);
    oled_update();
    cairo_surface_destroy(screen);
}

void drawMenu(char list[MAX_MENU][32], uint8_t list_length, float selected, uint8_t action)
{
    cairo_t *cr = cairo_create (screen);

    cairo_select_font_face (cr, "Open Sans", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);

    cairo_set_source_rgb (cr, 0.1, 0.1, 0.5);
    rounded_rectangle(cr, MENU_XOFFSET / 2, MENU_YOFFSET - (MENU_LINE_HEIGHT / 2 + 5) + selected * MENU_LINE_HEIGHT, 160 - MENU_XOFFSET / 2, MENU_LINE_HEIGHT - 2, 3);
    cairo_fill(cr);

    cairo_set_font_size (cr, 8.0);
    cairo_move_to (cr, 5.0, 10.0);
    cairo_set_source_rgb (cr, 0.5, 0.5, 0.5);
    if(status_present)
    {
        cairo_show_text (cr, status);
    }
    else
    {
        cairo_show_text (cr, "Timelapse+ VIEW");
    }

    cairo_set_font_size (cr, MENU_FONT_SIZE);
    cairo_set_source_rgb (cr, 1.0, 1.0, 1.0);

    for(int i = 0; i < list_length; i++)
    {
        cairo_move_to (cr, MENU_XOFFSET, MENU_YOFFSET + i * MENU_LINE_HEIGHT);
        char name[strlen(list[i]) + 1];
        char *val = NULL;
        memcpy(name, list[i], strlen(list[i]));
        name[strlen(list[i])] = '\0';
        for(int j = 0; j < strlen(name); j++)
        {
            if(name[j] == '~')
            {
                name[j] = '\0';
                val = &name[j + 1];
            }
        }
        cairo_show_text (cr, name);
        if(val) {
            cairo_set_source_rgb (cr, 0.05, 0.05, 0.4);
            cairo_show_text (cr, "  ");
            cairo_show_text (cr, val);
            cairo_set_source_rgb (cr, 1.0, 1.0, 1.0);
        }
    }

    cairo_destroy (cr);
}

void drawValue(char param[32], char value[32], uint8_t action)
{
    cairo_t *cr = cairo_create (screen);

    cairo_select_font_face (cr, "Open Sans", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL);

    //cairo_set_source_rgb (cr, 0.1, 0.1, 0.5);
    //rounded_rectangle(cr, MENU_XOFFSET / 2, 128 / 2 - MENU_LINE_HEIGHT, 160 - MENU_XOFFSET, MENU_LINE_HEIGHT * 2, 5);
    //cairo_fill(cr);

    cairo_set_font_size (cr, 10.0);
    cairo_move_to (cr, MENU_XOFFSET * 2, 128 / 2 - MENU_FONT_SIZE - 5);
    cairo_set_source_rgb (cr, 0.1, 0.1, 0.5);
    cairo_show_text (cr, param);

    cairo_set_font_size (cr, MENU_FONT_SIZE * 1.5);
    cairo_set_source_rgb (cr, 1.0, 1.0, 1.0);
    cairo_move_to (cr, MENU_XOFFSET, 128 / 2 + 5);
    cairo_show_text (cr, value);

    cairo_destroy (cr);
}

void play_sound(char *path)
{
    char buf[strlen(path) + 22];
    buf[0] = '\0';

    strcat(buf, "aplay ");
    strcat(buf, path);
    strcat(buf, "&>/dev/null &");
    system(buf);
}

void write_surface_to_oled(cairo_surface_t *surface, int x, int y)
{
    uint8_t *data = cairo_image_surface_get_data(surface);

    int w = cairo_image_surface_get_width(surface);
    int h = cairo_image_surface_get_height(surface);

    int xi, yi;
    uint32_t i;

    int width = 160;
    int height = 128;

    uint8_t r, g, b;

    for(xi = 0; xi < width; xi++)
    {
        for(yi = 0; yi < height; yi++)
        {
            if(yi + y < h && xi + x < w && xi + x >= 0 && yi + y >= 0)
            {
                i = ((yi + y) * width + (width - (x + xi))) * 4;
                r = data[i + 2];
                g = data[i + 1];
                b = data[i + 0];
            }
            else
            {
                r = 0;
                g = 0;
                b = 0;
            }
            oled_pixel(xi, yi, r, g, b);
        }
    }
}

int displayJpeg(char *jpegFile, uint8_t x, uint8_t y)
{
    oled_jpeg(jpegFile, x, y);
    oled_update();
    return 0;
}

int displayPng(char *pngFile, uint8_t x, uint8_t y)
{
    oled_png(pngFile, x, y);
    oled_update();
    return 0;
}

void rounded_rectangle(cairo_t *cr, float x, float y, float w, float h, float r)
{
    //"Draw a rounded rectangle"
    //   A****BQ
    //  H      C
    //  *      *
    //  G      D
    //   F****E

    cairo_move_to(cr, x+r, y);                           // Move to A
    cairo_line_to(cr, x+w-r, y);                         // Straight line to B
    cairo_curve_to(cr, x+w, y, x+w, y, x+w, y+r);        // Curve to C, Control points are both at Q
    cairo_line_to(cr, x+w, y+h-r);                       // Move to D
    cairo_curve_to(cr, x+w, y+h, x+w, y+h, x+w-r, y+h);  // Curve to E
    cairo_line_to(cr, x+r, y+h);                         // Line to F
    cairo_curve_to(cr, x, y+h, x, y+h, x, y+h-r);        // Curve to G
    cairo_line_to(cr, x, y+r);                           // Line to H
    cairo_curve_to(cr, x, y, x, y, x+r, y);              // Curve to A

    return;
}

void rectangle(cairo_t *cr, float x, float y, float w, float h, float r)
{
    cairo_move_to(cr, x, y);    
    cairo_line_to(cr, x+w, y);  
    cairo_line_to(cr, x+w, y+h);
    cairo_line_to(cr, x, y+h);  
    cairo_line_to(cr, x, y);    

    return;
}

void play_video(char *pathFormat, uint8_t fileType, uint16_t frames, uint8_t framerate) {
    char filename[strlen(pathFormat) + 8];
    struct timeval frameStartT, frameEndT, startT, endT; 

    uint32_t frameTime, frameTargetTime = (1000000UL / (uint32_t)framerate) - 12000UL;
    uint16_t i;

    oled_fill(0, 0, 0);

    gettimeofday(&startT, NULL);
    for(i = 1; i < frames + 1; i++)
    {
        gettimeofday(&frameStartT, NULL);
        sprintf(filename, pathFormat, i);
        if(fileType == FILE_TYPE_JPG)
        {
            oled_jpeg(filename, 0, 0);
        }
        else
        {
            oled_png(filename, 0, 0);
        }
        oled_update();
        gettimeofday(&frameEndT, NULL);
        if(frameEndT.tv_sec > frameStartT.tv_sec)
        {
            frameTime = frameEndT.tv_usec + (1000000UL - frameStartT.tv_usec);
        }
        else
        {
            frameTime = frameEndT.tv_usec - frameStartT.tv_usec;
        }
        if(frameTime < frameTargetTime) usleep(frameTargetTime - frameTime);
    }
    gettimeofday(&endT, NULL);
    uint32_t rate = (uint32_t)frames / (uint32_t)(endT.tv_sec - startT.tv_sec);
    printf("Target Frame Rate: %d\nActual Frame Rate: %d\n\n", framerate, rate);
}


