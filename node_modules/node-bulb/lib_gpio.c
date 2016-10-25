/*******************************************************************************
Project  : Olimex A13
Module    : gpio.c
Version  : 0.1
Date      : 2013.02.15.
Authors  : Pádár Tamás
Company  : EMKE Kft.
Comments :
Chip type: A13
*******************************************************************************/

#include <ctype.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/select.h>
#include <pthread.h>
#include <unistd.h>
#include <sched.h>

#include "lib_gpio.h"

static unsigned int SUNXI_PIO_BASE   =0;
static unsigned int *SUNXI_PIO_G_DATA;


//------------------------------------------------------------------------------
int gpio_init() 
//------------------------------------------------------------------------------
{
   int fd;
   unsigned int addr_start, addr_offset, addr;
   unsigned int PageSize, PageMask;
   void *pc;

   fd = open("/dev/mem", O_RDWR);
   if(fd < 0) {
      perror("Unable to open /dev/mem");
      return(-1);
      }

   PageSize = sysconf(_SC_PAGESIZE);
   PageMask = (~(PageSize-1));
      
   addr_start  = SUNXI_SW_PORTC_IO_BASE &  PageMask;
   addr_offset = SUNXI_SW_PORTC_IO_BASE & ~PageMask;
      
   pc = (void *)mmap(0, PageSize*2, PROT_READ|PROT_WRITE, MAP_SHARED, fd, addr_start);
   if(pc == MAP_FAILED) {
      perror("Unable to mmap file");
      printf("pc:%8.8x\n", (unsigned int)pc);
      return(-1);
      }
          
   SUNXI_PIO_BASE = (unsigned int)pc;
   SUNXI_PIO_BASE += addr_offset;
   
   
   SUNXI_PIO_G_DATA=(unsigned int *) (SUNXI_PIO_BASE +  SUNXI_PORT_G_BASE + SUNXI_GPIO_DATA_OFFSET);
      
   close(fd);
         
   return 0;
}

//------------------------------------------------------------------------------
void gpio_cfg_output(unsigned int port_base,unsigned int pin_idx)
//------------------------------------------------------------------------------
{
   unsigned int cfg;

   unsigned int index  = (pin_idx>>3)*4;
   unsigned int offset = (pin_idx& 0x7) << 2;
   unsigned int *c     = (unsigned int*)  ((SUNXI_PIO_BASE + port_base + index));

   #ifdef SUNXI_GPIO_DEBUG
     printf("%20s base: %lu addr: %lu dat:%lu pin_idx: %lu\r\n",__func__,SUNXI_PIO_BASE,c,pin_idx);
   #endif
   
   cfg = *c;
   cfg &= ~(0xF << offset);
   cfg |= SUNXI_GPIO_OUTPUT << offset;

   *c = cfg;
}

//------------------------------------------------------------------------------
void gpio_cfg_input(unsigned int port_base,unsigned int pin_idx)
//------------------------------------------------------------------------------
{
   unsigned int cfg;

   unsigned int index  = pin_idx>>3;
   unsigned int offset = (pin_idx& 0x7) << 2;
   unsigned int *c     = (unsigned int *) ((SUNXI_PIO_BASE + port_base + index));

   #ifdef SUNXI_GPIO_DEBUG
     printf("%20s base: %lu addr: %lu dat:%lu pin_idx: %lu\r\n",__func__,SUNXI_PIO_BASE,c,pin_idx);
   #endif
   
   cfg = *c;
   cfg &= ~(0xF << offset);
   cfg |= SUNXI_GPIO_INPUT << offset;

   *c = cfg;
}

//------------------------------------------------------------------------------
void gpio_set_output(unsigned int port_base,unsigned int pin) 
//------------------------------------------------------------------------------
{
  unsigned int  *dat =  (unsigned int *) (SUNXI_PIO_BASE  +  port_base + SUNXI_GPIO_DATA_OFFSET);
  
  #ifdef SUNXI_GPIO_DEBUG 
    printf("%20s base:%lu, offset:%lu, addr:%lu, dat:%lu, pin:%lu\r\n",__func__,SUNXI_PIO_BASE,port_base + SUNXI_GPIO_DATA_OFFSET,dat,pin);
  #endif
  
  *(dat) |= pin;
}

//------------------------------------------------------------------------------
void gpio_clear_output(unsigned int port_base,unsigned int pin) 
//------------------------------------------------------------------------------
{
  unsigned int  *dat = (unsigned int *) (SUNXI_PIO_BASE +  port_base + SUNXI_GPIO_DATA_OFFSET);

  #ifdef SUNXI_GPIO_DEBUG 
    printf("%20s base:%lu, offset:%lu, addr:%lu, dat:%lu, pin:%lu\r\n",__func__,SUNXI_PIO_BASE,port_base + SUNXI_GPIO_DATA_OFFSET,dat,pin);
  #endif

  *(dat) &= ~(pin);
}

//------------------------------------------------------------------------------
int gpio_get_input(unsigned int port_base ,unsigned int pin) 
//------------------------------------------------------------------------------
{
  unsigned int  *dat =  (unsigned int *) (SUNXI_PIO_BASE +  port_base + SUNXI_GPIO_DATA_OFFSET);
  
  #ifdef SUNXI_GPIO_DEBUG 
     printf("%20s base:%lu, offset:%lu, addr:%lu, dat:%lu, pin:%lu\r\n",__func__,SUNXI_PIO_BASE,port_base + SUNXI_GPIO_DATA_OFFSET,dat,pin);
  #endif
     
  return (*dat & pin);
}

//------------------------------------------------------------------------------
void gpio_pg9_set_output()
//------------------------------------------------------------------------------
{
  (*SUNXI_PIO_G_DATA)  |= SUNXI_PIO_09;
}

//------------------------------------------------------------------------------
void gpio_pg9_clear_output()
//------------------------------------------------------------------------------
{
  (*SUNXI_PIO_G_DATA) &= ~(SUNXI_PIO_09);
}

//------------------------------------------------------------------------------
void  gpio_pg9_test()
//------------------------------------------------------------------------------
{
  while(1)
  {
   (*SUNXI_PIO_G_DATA) |=   SUNXI_PIO_09;
   (*SUNXI_PIO_G_DATA) &= ~(SUNXI_PIO_09);
  }
}

