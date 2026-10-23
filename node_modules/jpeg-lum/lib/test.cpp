#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "lib.h"

int main() {
    char filename[64];
    sprintf(filename, "all_hist.csv");
    FILE* of = fopen(filename, "w");
    for (int i = 1; i < 9999; i++) {
        sprintf(filename, "tl/%04d.jpg", i);

        if (access(filename, F_OK) != 0)
            continue;

        read_jpeg_file(filename);
        printf("%d %s: %f, %f\n", i, filename, luminance, clipped);

        fprintf(of, "%s, ", filename);

        for (int h = 0; h < 256; h++) {
            fprintf(of, "%d", histogram[h]);
            fprintf(of, ", ");
        }
        fprintf(of, "\n");
    }
    fclose(of);
}
