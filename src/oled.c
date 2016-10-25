#include <stdio.h>
#include <stdint.h>
#include <string.h>

#include "lib_oled.h"

typedef struct {
    char arg;
    char *description;
    char *param;
} arg_t;

typedef struct {
    uint8_t found;
    char *param;
} parsed_t;

#define ARG_INIT 0
#define ARG_PWR_ON 1
#define ARG_PWR_OFF 2
#define ARG_PATH 3
#define ARG_STDIN 4

parsed_t parsed_values[5];

arg_t options[] = 
    {
        {'s', "Power On & Initialize Display", 0},
        {'o', "Power On Display", 0},
        {'x', "Power Off Display", 0},
        {'p', "Load PNG Frame from path", "<path>"},
        {'i', "Load PNG Frame from STDIN", 0}
    }; 



int main (int argc, char *argv[])
{
    int i, expect_param = -1, err = 0, found;
    if(argc < 2) err = 1;

    for(i = 1; i < argc; i++) {
        int searchIndex;
        found = -1;
        for(searchIndex = 0; searchIndex < sizeof(options) / sizeof(arg_t); searchIndex++) {
            if(strlen(argv[i]) > 1 && options[searchIndex].arg == argv[i][1]) {
                found = searchIndex;
                break;
            }
        }

        if(argv[i][0] == '-' && expect_param == -1 && found != -1) {
            if(options[found].param) {
                expect_param = found;
            }
            parsed_values[found].found = 1;
        } else if(expect_param != -1 && argv[i][0] != '-') {
            parsed_values[expect_param].param = argv[i];
            expect_param = -1;
        } else {
            err = 1;
            if(expect_param != -1) {
                printf("Expected %s param for -%c\n", options[expect_param].param, options[expect_param].arg);
            } else {
                printf("Unexpected arg: %s\n", argv[i]);
            }
        }
    }
    if(expect_param != -1) {
        err = 1;
        printf("Expected %s param for -%c\n", options[expect_param].param, options[expect_param].arg);
    }

    //if(parsed_values[ARG_PATH])

    if(err) {
        goto print_usage_and_exit;
    }

    for(i = 0; i < 5; i++) {
        if(parsed_values[i].found) {
            if(!parsed_values[i].param) parsed_values[i].param = "";
            printf("Option: %c %s\n", options[i].arg, parsed_values[i].param);
        }
    }


    if(parsed_values[ARG_INIT].found) {
        printf("Initializing OLED\n");
        oled_init();
    }
    if(parsed_values[ARG_PWR_ON].found) {
        printf("OLED Power ON\n");
        oled_power(1);
    }
    if(parsed_values[ARG_PWR_OFF].found) {
        printf("OLED Power OFF\n");
        oled_power(0);
    }
    if(parsed_values[ARG_PATH].found) {
        printf("Displaying PNG file %s\n", parsed_values[ARG_PATH].param);
        oled_png(parsed_values[ARG_PATH].param, 0, 0);
        oled_update();
    }
    if(parsed_values[ARG_STDIN].found) {
        uint8_t *buf = malloc(1024 * 96);
        uint32_t len = 0;
        for(;;) {
            uint32_t bytes_read = read(STDIN_FILENO, &buf[len], sizeof(buf));
            len += bytes_read;
            if(bytes_read <= 0) break;
        }
        printf("Displaying PNG from stdin (%lu bytes)\n", len);
        oled_png_buf(buf, len, 0 , 0);
        oled_update();
    }

    oled_close();

    return 0;

    print_usage_and_exit:

    printf("Usage: %s opts\n  opts: \n", argv[0]);
    for(i = 0; i < sizeof(options) / sizeof(arg_t); i++) {
        char param[10];
        strncpy(param, "        ", sizeof(param));
        if(options[i].param) {
            size_t max = sizeof(param);
            if(strlen(options[i].param) < max) max = strlen(options[i].param);
            strncpy(param, options[i].param, max);
        }
        printf("    -%c %s %s\n", options[i].arg, param, options[i].description);
    }
     return 1;
}

