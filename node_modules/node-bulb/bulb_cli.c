#include <stdio.h>
#include <string.h>
#include "bulb.h"

#define B 0
#define I 1
#define O 2
#define F 3
#define T 4
#define J 5
#define D 6

int main(int argc, char *argv[])
{
    bulb_config_t config;
    bulb_result_t result;

    config.bulbMicroSeconds = 40000;
    config.preFocusMs = 500;
    config.endLagMicroSeconds = 39000;
    config.startLagMicroSeconds = 80000;
    config.expectSync = 1;
    config.runTest = 0;

    uint8_t jsonOut = 0;

    uint8_t i;
    int8_t nextArg = -1;
    uint8_t invalidArgs = 0;

    char *args[4];
    uint8_t found[7];
    for(i = 0; i < 7; i++) found[i] = 0;

    for(i = 1; i < argc; i++)
    {
        if(strcmp(argv[i], "-j") == 0)
        {
            jsonOut = 1;
            break;   
        }
    }

    i = 1;
    while(i < argc)
    {
        if(nextArg == -1)
        {
            if(strcmp(argv[i], "-b") == 0)
            {
                nextArg = B;            
            }
            else if(strcmp(argv[i], "-i") == 0)
            {
                nextArg = I;            
            }
            else if(strcmp(argv[i], "-o") == 0)
            {
                nextArg = O;            
            }
            else if(strcmp(argv[i], "-f") == 0)
            {
                nextArg = F;            
            }
            else if(strcmp(argv[i], "-t") == 0)
            {
                found[T] = 1;
            }
            else if(strcmp(argv[i], "-j") == 0)
            {
                found[J] = 1;
            }
            else if(strcmp(argv[i], "-d") == 0)
            {
                found[D] = 1;
            }
            else
            {
                if(!jsonOut) printf("ERROR: Invalid argument: %s\r\n", argv[i]);   
                invalidArgs = 1;
                break;
            }
        }
        else
        {
            if(argv[i][0] == '-')
            {
                if(!jsonOut) printf("ERROR: Invalid argument value: %s\r\n", argv[i]);   
                break;
            }
            else
            {
                args[nextArg] = argv[i];
                found[nextArg] = 1;
                nextArg = -1;
            }
        }

        i++;
    }
    if(nextArg >= 0 || argc < 2)
    {
        invalidArgs = 1;
        if(nextArg >= 0 && !jsonOut) printf("ERROR: Value required for argument\r\n");   
    }

    if(!invalidArgs)
    {
        char *endptr;
        if(found[J])
        {
            jsonOut = 1;
        }
        if(found[F])
        {
            config.preFocusMs = strtol(args[F], &endptr, 10);;
            if(!(config.preFocusMs > 0 && endptr[0] == '\0'))
            {
                if(!jsonOut) printf("ERROR: Invalid value for -f\r\n");
                invalidArgs = 1;
            }
        }

        if(found[D])
        {
            uint8_t auxReading, syncReading, i = 0, sh = 0;
            _bulb_init();
            bulb_set_shutter(0);
            for(;;)
            {
                auxReading = bulb_read_aux();
                syncReading = bulb_read_sync();
                printf("Shutter: %d, AUX: %d, SYNC: %d\n", sh, auxReading, syncReading);
                i++;
                if(i == 4)
                {
                    sh = 1;
                    bulb_set_shutter(1);
                }
                if(i == 8)
                {
                    sh = 0;
                    bulb_set_shutter(0);
                    i = 0;
                }
                usleep(250000);
            }
        }
        else if(found[T])
        {
            // test mode
            config.runTest = 1;
            config.bulbMicroSeconds = 0;
            config.startLagMicroSeconds = 0;
            config.endLagMicroSeconds = 0;
            config.expectSync = 1;
        }
        else if(found[B])
        {
            config.bulbMicroSeconds = strtol(args[B], &endptr, 10);  
            if(!(config.bulbMicroSeconds > 0 && endptr[0] == '\0'))
            {
                if(!jsonOut) printf("ERROR: Invalid value for -b\r\n");
                invalidArgs = 1;
            }
            if(found[I] && found[O])
            {
                config.expectSync = 1;
                config.startLagMicroSeconds = strtol(args[I], &endptr, 10);
                if(!(config.startLagMicroSeconds > 0 && endptr[0] == '\0'))
                {
                    if(!jsonOut) printf("ERROR: Invalid values for -o\r\n");
                    invalidArgs = 1;
                }
                config.endLagMicroSeconds = strtol(args[O], &endptr, 10);
                if(!(config.endLagMicroSeconds > 0 && endptr[0] == '\0'))
                {
                    if(!jsonOut) printf("ERROR: Invalid values for -o\r\n");
                    invalidArgs = 1;
                }
            }
            else if(found[I] || found[O]) // need both if we have one
            {
                if(!jsonOut) printf("ERROR: Both -i & -o required\r\n");
                invalidArgs = 1;
            }
            else
            {
                config.expectSync = 0;
            }
        }
        else
        {
            if(!jsonOut) printf("ERROR: Bulb time (-b) required\r\n");
            invalidArgs = 1;
        }
    }
    if(invalidArgs && !found[J])
    {
        if(jsonOut)
        {
            printf("{\"error\": \"config error\"}\r\n");
        }
        else
        {
            printf("\r\nUsage: bulb {-b N [-i N -o N] | -t} [-f N] [-j]\r\n\
    -b (us)    Bulb time in microseconds (required unless test)\r\n\
    -f (500ms) Focus press in milliseconds\r\n\
    -i (us)    Sync In lag in microseconds\r\n\
    -o (us)    Sync Out lag in microseconds\r\n\
    -t         Run test\r\n\
    -d         Debug Inputs\r\n\
    -j         Output JSON\r\n\
\r\n©2015 Elijah Parker / Timelapse+\r\n\r\n");
        }
        return 1;
    }

    uint8_t err = bulb(config, &result);

    if(err)
    {
        char *errMessage;
        if(err == ERROR_FAILED_TO_INIT) errMessage = "failed to initialize";
        else if(err == ERROR_INVALID_PC_STATE) errMessage = "invalid pc-sync state";
        else if(err == ERROR_PC_TIMEOUT) errMessage = "pc-sync timeout";
        else if(err == ERROR_STATE_SEQUENCE) errMessage = "invalid state sequence";
        else errMessage = "unknown error";

        if(jsonOut)
        {
            printf("{\"error_code\":\"%d\", \"error_message\":\"%s\"}\r\n", err, errMessage);
        }
        else
        {
            printf("Error %d: \"%s\"\r\n", err, errMessage);
        }
        return 1;
    } 
    else
    {
        if(jsonOut)
        {
            if(config.runTest)
                printf("{\"inMs\":\"%.3f\", \"outMs\":\"%.3f\", \"minMs\":\"%.3f\"}\r\n", ((double)result.startDiff / 1000.0), ((double)result.stopDiff / 1000.0), ((double)result.actualTime /1000.0));
            else
                printf("{\"inMs\":\"%.3f\", \"outMs\":\"%.3f\", \"actualMs\":\"%.3f\", \"errorPercent\":\"%.1f\"}\r\n", ((double)result.startDiff / 1000.0), ((double)result.stopDiff / 1000.0), (result.actualTime / 1000.0), result.errPercent);
        }
        else
        {
            if(config.runTest)
                printf("In: %.3fms, Out: %.3fms, Min: %.3fms\r\n", ((double)result.startDiff / 1000.0), ((double)result.stopDiff / 1000.0), ((double)result.actualTime / 1000.0));
            else
                printf("In: %.3fms, Out: %.3fms, Actual: %.3fms, Error: %.1f%%\r\n", ((double)result.startDiff / 1000.0), ((double)result.stopDiff / 1000.0), ((double)result.actualTime / 1000.0), result.errPercent);
        }
    }

    return 0;
}

