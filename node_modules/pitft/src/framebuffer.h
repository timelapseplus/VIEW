#ifndef FRAMEBUFFER_H
#define FRAMEBUFFER_H

#include <unistd.h>
#include <sys/ioctl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <linux/fb.h>
#include <sys/mman.h>
#include <cairo/cairo.h>
#include <pango/pangocairo.h>

#include <sys/types.h>
#include <stdint.h>
#include <unistd.h>
#include <sys/ioctl.h>

extern "C" {
#include "lib_jpeg.h"
}

#include <v8.h>
#include <node.h>
#include <nan.h>

using namespace v8;
using namespace node;

class FrameBuffer : public Nan::ObjectWrap {
    public:
        static void Init();
        static v8::Local<v8::Object> NewInstance(v8::Local<v8::Value> arg, v8::Local<v8::Value> arg2);
        static NAN_METHOD(New);
        static NAN_METHOD(Size);
        static NAN_METHOD(Data);
        static NAN_METHOD(Clear);
        static NAN_METHOD(Blit);
        static NAN_METHOD(Color);
        static NAN_METHOD(Fill);
        static NAN_METHOD(Line);
        static NAN_METHOD(Rect);
        static NAN_METHOD(Circle);
        static NAN_METHOD(Font);
        static NAN_METHOD(Text);
        static NAN_METHOD(TextSize);
        static NAN_METHOD(ImagePNG);
        static NAN_METHOD(ImageJPEG);
        static cairo_t* getDrawingContext(FrameBuffer *obj);
    private:
        FrameBuffer(const char *path);
        ~FrameBuffer();

        static Nan::Persistent<v8::Function> constructor;
        int fbfd;
        struct fb_var_screeninfo orig_vinfo;
        struct fb_var_screeninfo vinfo;
        struct fb_fix_screeninfo finfo;
        long int screenSize;

        char *bbp;
        char *fbp;

        cairo_surface_t *bufferSurface;
        cairo_surface_t *screenSurface;

        double r, g, b;

        const char *fontName;
        double fontSize;
        bool fontBold;
        bool fontMono;

        bool drawToBuffer;
};

int write_fb_jpeg(const char *jpegFile, uint8_t xPos, uint8_t yPos);
int open_raw_fb();
int close_raw_fb();

#endif
