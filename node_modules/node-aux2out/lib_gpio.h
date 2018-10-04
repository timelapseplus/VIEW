/*******************************************************************************
Project  : Olimex A13
Module    : gpio.h
Version  : 0.1
Date      : 2013.02.15.
Authors  : Pádár Tamás
Company  : EMKE Kft.
Comments :
Chip type: A13
*******************************************************************************/
#ifndef _MY_GPIO_H_
#define _MY_GPIO_H_

//----------------------------------//
//       PORT BASE DEFINITIONS      //
//----------------------------------//

#define SUNXI_PORT_A_BASE      (0*0x24)
#define SUNXI_PORT_B_BASE      (1*0x24)
#define SUNXI_PORT_C_BASE      (2*0x24)
#define SUNXI_PORT_D_BASE      (3*0x24)
#define SUNXI_PORT_E_BASE      (4*0x24)
#define SUNXI_PORT_F_BASE      (5*0x24)
#define SUNXI_PORT_G_BASE      (6*0x24)
#define SUNXI_PORT_H_BASE      (7*0x24)
#define SUNXI_PORT_I_BASE      (8*0x24)


//----------------------------------//
//         PIO DEFINITIONS          //
//----------------------------------//

#define SUNXI_PIO_00           (0x00000001L <<  0)
#define SUNXI_PIO_01           (0x00000001L <<  1)
#define SUNXI_PIO_02           (0x00000001L <<  2)
#define SUNXI_PIO_03           (0x00000001L <<  3)
#define SUNXI_PIO_04           (0x00000001L <<  4)
#define SUNXI_PIO_05           (0x00000001L <<  5)
#define SUNXI_PIO_06           (0x00000001L <<  6)
#define SUNXI_PIO_07           (0x00000001L <<  7)
#define SUNXI_PIO_08           (0x00000001L <<  8)
#define SUNXI_PIO_09           (0x00000001L <<  9)
#define SUNXI_PIO_10           (0x00000001L <<  10)
#define SUNXI_PIO_11           (0x00000001L <<  11)
#define SUNXI_PIO_12           (0x00000001L <<  12)
#define SUNXI_PIO_13           (0x00000001L <<  13)
#define SUNXI_PIO_14           (0x00000001L <<  14)
#define SUNXI_PIO_15           (0x00000001L <<  15)
#define SUNXI_PIO_16           (0x00000001L <<  16)
#define SUNXI_PIO_17           (0x00000001L <<  17)
#define SUNXI_PIO_18           (0x00000001L <<  18)
#define SUNXI_PIO_19           (0x00000001L <<  19)
#define SUNXI_PIO_20           (0x00000001L <<  20)
#define SUNXI_PIO_21           (0x00000001L <<  21)
#define SUNXI_PIO_22           (0x00000001L <<  22)
#define SUNXI_PIO_23           (0x00000001L <<  23)
#define SUNXI_PIO_24           (0x00000001L <<  24)
#define SUNXI_PIO_25           (0x00000001L <<  25)
#define SUNXI_PIO_26           (0x00000001L <<  26)
#define SUNXI_PIO_27           (0x00000001L <<  27)
#define SUNXI_PIO_28           (0x00000001L <<  28)
#define SUNXI_PIO_29           (0x00000001L <<  29)
#define SUNXI_PIO_30           (0x00000001L <<  30)
#define SUNXI_PIO_31           (0x00000001L <<  31)

#define SUNXI_PIO_00_IDX           (0)
#define SUNXI_PIO_01_IDX           (1)
#define SUNXI_PIO_02_IDX           (2)
#define SUNXI_PIO_03_IDX           (3)
#define SUNXI_PIO_04_IDX           (4)
#define SUNXI_PIO_05_IDX           (5)
#define SUNXI_PIO_06_IDX           (6)
#define SUNXI_PIO_07_IDX           (7)
#define SUNXI_PIO_08_IDX           (8)
#define SUNXI_PIO_09_IDX           (9)
#define SUNXI_PIO_10_IDX           (10)
#define SUNXI_PIO_11_IDX           (11)
#define SUNXI_PIO_12_IDX           (12)
#define SUNXI_PIO_13_IDX           (13)
#define SUNXI_PIO_14_IDX           (14)
#define SUNXI_PIO_15_IDX           (15)
#define SUNXI_PIO_16_IDX           (16)
#define SUNXI_PIO_17_IDX           (17)
#define SUNXI_PIO_18_IDX           (18)
#define SUNXI_PIO_19_IDX           (19)
#define SUNXI_PIO_20_IDX           (20)
#define SUNXI_PIO_21_IDX           (21)
#define SUNXI_PIO_22_IDX           (22)
#define SUNXI_PIO_23_IDX           (23)
#define SUNXI_PIO_24_IDX           (24)
#define SUNXI_PIO_25_IDX           (25)
#define SUNXI_PIO_26_IDX           (26)
#define SUNXI_PIO_27_IDX           (27)
#define SUNXI_PIO_28_IDX           (28)
#define SUNXI_PIO_29_IDX           (29)
#define SUNXI_PIO_30_IDX           (30)
#define SUNXI_PIO_31_IDX           (31)

//----------------------------------//
//       CONSTANT DEFINITIONS       //
//----------------------------------//


#define SUNXI_SW_PORTC_IO_BASE  (0x01c20800)
#define SUNXI_GPIO_DATA_OFFSET  (0x10)
#define SUNXI_GPIO_INPUT        (0)
#define SUNXI_GPIO_OUTPUT       (1)

// Debug function
//#define SUNXI_GPIO_DEBUG

//----------------------------------//
//        METHOD DEFINITIONS        //
//----------------------------------//

#define SUNXI_PIO_GET_BIT_INDEX(a) ( (SUNXI_PIO_00)?1:(SUNXI_PIO_01)?2:(SUNXI_PIO_02)?3:(SUNXI_PIO_03)?4:(SUNXI_PIO_04)?5:(SUNXI_PIO_05)?6:(SUNXI_PIO_06)?7:(SUNXI_PIO_07)?8:(SUNXI_PIO_08)?9:(SUNXI_PIO_09)?10:(SUNXI_PIO_10)?11:(SUNXI_PIO_11)?12:(SUNXI_PIO_12)?13:(SUNXI_PIO_13)?14:(SUNXI_PIO_14)?15:(SUNXI_PIO_15)?16:(SUNXI_PIO_16)?17:(SUNXI_PIO_17)?18:(SUNXI_PIO_18)?19:(SUNXI_PIO_19)?20:(SUNXI_PIO_20)?21:(SUNXI_PIO_21)?22:(SUNXI_PIO_22)?23:(SUNXI_PIO_23)?24:(SUNXI_PIO_24)?25:(SUNXI_PIO_25)?26:(SUNXI_PIO_26)?27:(SUNXI_PIO_27)?28:(SUNXI_PIO_28)?29:(SUNXI_PIO_29)?30:(SUNXI_PIO_30)?31:(SUNXI_PIO_31)?32:0 )


#endif

