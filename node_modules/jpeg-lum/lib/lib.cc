#include <stdio.h>
#include <jpeglib.h>
#include <stdlib.h>
#include <unistd.h>
#include <cstring>
#include <math.h>
#include "lib.h"

unsigned int size;
unsigned int histogram[256];
unsigned int hist_max = 0;
unsigned int width;
unsigned int height;
double luminance;
double clipped;

#define LUT_LENGTH 33

struct lut_t
{
    double x;
    double y;
};

lut_t lut[LUT_LENGTH] =
{
    {4.793865 / 4, -7},
    {4.793865 / 2, -6},
    {4.793865, -5},
    {6.056875, -4.66666666666667},
    {7.697362, -4.33333333333333},
    {9.780035, -4},
    {12.092661, -3.66666666666667},
    {15.089602, -3.33333333333333},
    {18.683953, -3},
    {23.421734, -2.66666666666667},
    {28.643862, -2.33333333333333},
    {35.019192, -2},
    {42.607219, -1.66666666666667},
    {52.126612, -1.33333333333333},
    {63.956853, -1},
    {76.885797, -0.666666666666667},
    {89.6882, -0.333333333333333},
    {103.382354, 0},
    {118.336503, 0.333333333333333},
    {135.244366, 0.666666666666667},
    {147.969053, 1},
    {162.615242, 1.33333333333333},
    {182.654258, 1.66666666666667},
    {194.224312, 2},
    {206.764022, 2.33333333333333},
    {213.891809, 2.66666666666667},
    {230.007117, 3},
    {238.483315, 3.33333333333333},
    {246.258409, 3.66666666666667},
    {249.447248, 4},
    {249.495413, 4.33333333333333},
    {252, 5},
    {253, 6}
};

double lum(double x) {
    int i;

    if (x < lut[0].x) return lut[0].y - 1;
    if (x > lut[LUT_LENGTH - 1].x) return lut[LUT_LENGTH - 1].y + 1;

    for (i = 0; i < LUT_LENGTH - 1; i++) {
        if (lut[i].x <= x && lut[i + 1].x >= x) {
            double diffx = x - lut[i].x;
            double diffn = lut[i + 1].x - lut[i].x;

            return lut[i].y + (lut[i + 1].y - lut[i].y) * diffx / diffn;
        }
    }
    printf("error - not found\n");
    return 0; // Not in Range
}

int read_jpeg_file(char* filename) {
    struct jpeg_decompress_struct cinfo;
    struct jpeg_error_mgr jerr;
    JSAMPROW row_pointer[1];
    FILE* infile = fopen(filename, "rb");
    unsigned int i = 0, component = 0;
    if (!infile) {
        printf("Error opening jpeg file %s\n!", filename);
        return -1;
    }
    cinfo.err = jpeg_std_error(&jerr);
    jpeg_create_decompress(&cinfo);
    jpeg_stdio_src(&cinfo, infile);
    jpeg_read_header(&cinfo, TRUE);
    jpeg_start_decompress(&cinfo);

    width = cinfo.output_width;
    height = cinfo.output_height;
#ifdef DEBUG_PPM
    FILE* ppm = fopen("first.ppm", "wb"); /* b - binary mode */
    (void)fprintf(ppm, "P6\n%d %d\n255\n", width, height);
#endif

    luminance = 0.0;
    size = cinfo.output_width * cinfo.output_height * cinfo.num_components * sizeof(unsigned int);
    memset(histogram, 0, sizeof(int) * 256);
    row_pointer[0] = (unsigned char*)malloc(cinfo.output_width * cinfo.num_components);
    unsigned long total_count = 0;

    unsigned int row_number = 0;
    int skip_rows = 0;
    float ratio = (float)width / (float)height;
    if (ratio < 1.75) {
        skip_rows = (height - ((float)width) / 1.75) / 2;
        //printf("skipping %d rows on top and bottom ", skip_rows);
    }
    int n = cinfo.num_components;
    while (cinfo.output_scanline < cinfo.image_height) {
        row_number++;
        jpeg_read_scanlines(&cinfo, row_pointer, 1);
        //TODO hide for now
        //if(row_number <= skip_rows) continue;
        //if(row_number > height - skip_rows) continue;
        for (i = 0; i < cinfo.image_width; i++) {
            unsigned int m;
            float r = (float)row_pointer[0][i * n + 0] * 0.299f;
            float g = (float)row_pointer[0][i * n + 1] * 0.587f;
            float b = (float)row_pointer[0][i * n + 2] * 0.114f;
            m = r + g + b;
#ifdef DEBUG_PPM

            static unsigned char color[3];
            color[0] = m; /* red */
            color[1] = m; /* green */
            color[2] = m; /* blue */
            fwrite(color, 1, 3, ppm);
#endif
            histogram[m]++;
            total_count++;
        }
    }
#ifdef DEBUG_PPM
    fclose(ppm);
#endif

    unsigned long count = 0, sum = 0;
    luminance = 0.0;
    hist_max = 0;
    for (int i = 0; i < 256; i++) {
        sum += histogram[i];
        if (histogram[i] > hist_max) hist_max = histogram[i];
        //if (sum < total_count / 2) continue; // only look at the upper 50%
        luminance += lum((float)i) * (float)histogram[i];
        count += histogram[i];
    }

    clipped = (double)histogram[255] / (double)count;
    luminance /= (double)count;
    jpeg_finish_decompress(&cinfo);
    jpeg_destroy_decompress(&cinfo);
    free(row_pointer[0]);
    fclose(infile);
    return 1;
}
