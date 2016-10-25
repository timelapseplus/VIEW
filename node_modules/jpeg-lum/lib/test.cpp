#include <stdio.h>
#include <jpeglib.h>
#include <stdlib.h>
#include <unistd.h>
#include <cstring>
#include <math.h>

unsigned int size;
unsigned int histogram[256];
unsigned int width;
unsigned int height;
double luminance;
double pixel;
double clipped;

int read_jpeg_file(char *filename);

int main()
{

  for(int i = 1; i<32; i++) {
    char filename[64];
    sprintf(filename, "thumb_thm%03d.jpg", i);
    read_jpeg_file(filename);
    printf("%f\n", luminance);
  }
}


#define LUT_LENGTH 33
struct lut_t {
  double x;
  double y;
};
lut_t lut[LUT_LENGTH] = 
{
  {4.793865/4,  -7},
  {4.793865/2,  -6},
  {4.793865,  -5},
  {6.056875,  -4.66666666666667},
  {7.697362,  -4.33333333333333},
  {9.780035,  -4},
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
  {89.6882,   -0.333333333333333},
  {103.382354,  0},
  {118.336503,  0.333333333333333},
  {135.244366,  0.666666666666667},
  {147.969053,  1},
  {162.615242,  1.33333333333333},
  {182.654258,  1.66666666666667},
  {194.224312,  2},
  {206.764022,  2.33333333333333},
  {213.891809,  2.66666666666667},
  {230.007117,  3},
  {238.483315,  3.33333333333333},
  {246.258409,  3.66666666666667},
  {249.447248,  4},
  {249.495413,  4.33333333333333},
  {252,  5},
  {253,  6}
};

double lum(double x)
{
    int i;

    if(x < lut[0].x) return lut[0].y - 1;
    if(x > lut[LUT_LENGTH-1].x) return lut[LUT_LENGTH-1].y + 1;

    for( i = 0; i < LUT_LENGTH-1; i++ )
    {
        if ( lut[i].x <= x && lut[i+1].x >= x )
        {
            double diffx = x - lut[i].x;
            double diffn = lut[i+1].x - lut[i].x;

            return lut[i].y + ( lut[i+1].y - lut[i].y ) * diffx / diffn; 
        }
    }
    printf("error - not found\n");
    return 0; // Not in Range
}

int read_jpeg_file(char *filename)
{
  struct jpeg_decompress_struct cinfo;
  struct jpeg_error_mgr jerr;
  JSAMPROW row_pointer[1];
  FILE *infile = fopen(filename, "rb");
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
  luminance = 0.0;
  size = cinfo.output_width*cinfo.output_height*cinfo.num_components*sizeof(unsigned int);
  memset(histogram, 0, sizeof(int)*256);
  row_pointer[0] = (unsigned char *)malloc(cinfo.output_width*cinfo.num_components);
  unsigned long count = 0;
  while (cinfo.output_scanline < cinfo.image_height) {
      jpeg_read_scanlines( &cinfo, row_pointer, 1 );
      for (i=0; i<cinfo.image_width;i+=cinfo.num_components) {
          pixel = 0.0;
          for(component=0;component<cinfo.num_components;component++) {
              if(component < 2) {
                  pixel = (double) row_pointer[0][i + component];
                  pixel = lum(pixel);
                  if(pixel > 4) clipped++;
                  luminance += pixel;
                  count++;
//          histogram[(int)pixel]++;
              }
          }
      }
  }
  luminance /= (double)count;
  clipped /= (double)count;
  jpeg_finish_decompress(&cinfo);
  jpeg_destroy_decompress(&cinfo);
  free(row_pointer[0]);
  fclose(infile);
  return 1;
}

/*
int read_jpeg_file(char *filename)
{
  struct jpeg_decompress_struct cinfo;
  struct jpeg_error_mgr jerr;
  JSAMPROW row_pointer[1];
  FILE *infile = fopen(filename, "rb");
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
  size = cinfo.output_width*cinfo.output_height*cinfo.num_components*sizeof(unsigned int);
  row_pointer[0] = (unsigned char *)malloc(cinfo.output_width*cinfo.num_components);
  unsigned long count = 0;
  rgb[0] = 0.0;
  rgb[1] = 0.0;
  rgb[2] = 0.0;
  
  while (cinfo.output_scanline < cinfo.image_height) {
      jpeg_read_scanlines( &cinfo, row_pointer, 1 );
      int black_row = 1;
      for (i=0; i<cinfo.image_width*cinfo.num_components;i++) {
        if(row_pointer[0][i]) {
          black_row = 0;
          break;
        }
      }
      if(black_row) continue;
      for (i=0; i<cinfo.image_width*cinfo.num_components;i+=cinfo.num_components) {
          for(component=0;component<cinfo.num_components;component++) {
              if(component < 3) {
                  rgb[component] += (double) row_pointer[0][i + component];
              }
          }
          count++;
      }
  }
  rgb[0] /= count;
  rgb[1] /= count;
  rgb[2] /= count;
  double avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
  printf("%f\n", avg);
  jpeg_finish_decompress(&cinfo);
  jpeg_destroy_decompress(&cinfo);
  free(row_pointer[0]);
  fclose(infile);
  return 1;
}*/
