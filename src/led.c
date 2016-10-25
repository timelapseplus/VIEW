#include <stdio.h>
#include "lib_gpio.h"


int main (int argc, char *argv[])
{
        gpio_init();
        gpio_cfg_output(SUNXI_PORT_C_BASE, SUNXI_PIO_19_IDX); // LED Anode
        gpio_cfg_output(SUNXI_PORT_C_BASE, SUNXI_PIO_15_IDX); // LED Cathode
        gpio_cfg_output(SUNXI_PORT_C_BASE, SUNXI_PIO_14_IDX); // CHGLED Anode

        gpio_set_output(SUNXI_PORT_C_BASE, SUNXI_PIO_14); // enable CHGLED

        if(argc > 1 && argv[1][0] == '0')
        {
            gpio_clear_output(SUNXI_PORT_C_BASE, SUNXI_PIO_15); // enable LED
            gpio_set_output(SUNXI_PORT_C_BASE, SUNXI_PIO_19);
            printf("LED OFF\n");
        }
        else if(argc > 1 && argv[1][0] == '1')
        {
            gpio_set_output(SUNXI_PORT_C_BASE, SUNXI_PIO_15); // enable LED
            gpio_clear_output(SUNXI_PORT_C_BASE, SUNXI_PIO_19);
            printf("LED ON\n");
        }
        else
        {
            printf("Usage:\n   %s {0|1}\n    0: LED OFF\n    1: LED ON\n", argv[0]);
        }
        return 0;
}
