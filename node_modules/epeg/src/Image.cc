#include <v8.h>
#include <node.h>
#include <node_buffer.h>

#include <string.h>

#include "Epeg.h"
#include "Image.h"

using namespace v8;

Persistent<FunctionTemplate> Image::constructor;

#define DEFAULT_QUALITY 85;

Image::Image()
{
  im = NULL;
}

Image::~Image()
{
  if (im)
    epeg_close(im);
}

void
Image::Initialize(Local<Object> target)
{
  Isolate* isolate = target->GetIsolate();

  // Constructor
  Local<FunctionTemplate> constructor = FunctionTemplate::New(isolate, Image::New);
  constructor->InstanceTemplate()->SetInternalFieldCount(1);
  constructor->SetClassName(String::NewFromUtf8(isolate, "Image"));
  
  // Prototype
  Local<ObjectTemplate> proto = constructor->PrototypeTemplate();

  NODE_SET_PROTOTYPE_METHOD(constructor, "downsize", Downsize);
  NODE_SET_PROTOTYPE_METHOD(constructor, "crop", Crop);
  NODE_SET_PROTOTYPE_METHOD(constructor, "process", Process);
  NODE_SET_PROTOTYPE_METHOD(constructor, "saveTo", SaveTo);

  proto->SetAccessor(String::NewFromUtf8(isolate, "width"), GetWidth);
  proto->SetAccessor(String::NewFromUtf8(isolate, "height"), GetHeight);

  Local<Context> context = isolate->GetCurrentContext();

  target->Set(
      context,
      String::NewFromUtf8(isolate, "Image"),
      constructor->GetFunction(context).ToLocalChecked()
  );
}

void Image::New(const FunctionCallbackInfo<Value> &args)
{
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();

  Image * image = new Image();
  image->Wrap(args.This());

  if (args.Length() < 1) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "epeg.image.new - Must pass data or path")));
    return;
  }

  if (args[0]->IsObject()) {
    Local<Object> object = Local<Object>::Cast(args[0]);
    Local<Value> pathValue = object->Get(context, String::NewFromUtf8(isolate, "path")).ToLocalChecked();
    Local<Value> dataValue = object->Get(context, String::NewFromUtf8(isolate, "data")).ToLocalChecked();

    if (pathValue->IsString()) {
      String::Utf8Value path(pathValue);
      image->im = epeg_file_open(*path);
    }
    else if (node::Buffer::HasInstance(dataValue)) {
      unsigned char * buffer = (uint8_t *) node::Buffer::Data(dataValue->ToObject());
      int size = node::Buffer::Length(dataValue->ToObject());

      image->im = epeg_memory_open(buffer, size);
    }
    else {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
          "[!] epeg.image.new - Invalid arguents. Must pass data or path")));
      return;
    }

    if (!image->im) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "[!] epeg.image.new - Failed to create image")));
      return;
    }
    epeg_size_get(image->im, &(image->width), &(image->height));
    
    
    // Flags must start false
    image->cropped = false;
    image->scaled = false;

  }
}

void
Image::Process(const FunctionCallbackInfo<Value> &args)
{
  Isolate* isolate = args.GetIsolate();

  unsigned char *       data;
  int                   size;

  Image * image = ObjectWrap::Unwrap<Image>(args.This());
  if (!image->im) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
                 "[!] epeg.image.process() - Image was null. Task may already be finished?")));
    return;
  }

  epeg_memory_output_set(image->im, &data, &size);

  if (image->ProcessInternal() != 0) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "[!] epeg.image.process - Could not save to buffer")));
    return;
  }

  epeg_close(image->im);
  image->im = NULL;

  Local<Value> buffer = node::Buffer::New(isolate, size).ToLocalChecked();
  memcpy(node::Buffer::Data(buffer), data, size);

  args.GetReturnValue().Set(buffer);
}

void
Image::SaveTo(const FunctionCallbackInfo<Value> &args)
{
  Isolate* isolate = args.GetIsolate();

  Image * image = ObjectWrap::Unwrap<Image>(args.This());
  if (!image->im) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
                  "[!] epeg.image.saveTo - Image was null. Task may already be finished?")));
    return;
  }

  if (!args[0]->IsString()) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
                  "[!] epeg.image.saveTo - Arg1 must be string path to save")));
    return;
  }
  String::Utf8Value output_file(args[0]->ToString());

  epeg_file_output_set(image->im, *output_file);

  if (image->ProcessInternal() != 0) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "[!] epeg.image.saveTo - Could not save to file")));
    return;
  }

  epeg_close(image->im);
  image->im = NULL;

  return;
}

void
Image::Downsize(const FunctionCallbackInfo<Value>& args)
{
    Isolate* isolate = args.GetIsolate();
    Image * image = ObjectWrap::Unwrap<Image>(args.This());

    // if (image->scaled || image->cropped) {
    //   ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Image already updated")));
    //   return;
    // }
    if (args.Length() < 2) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
             "[!] epeg.image.downsize - Downsize expects two arguments!")));
      return;
    }

    if (!args[0]->IsInt32() || !args[1]->IsInt32()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, 
             "[!] epeg.image.downsize - Downsize arguments must be integers! (Int32)!")));
      return;
    }

    int width = args[0]->Int32Value();
    int height = args[1]->Int32Value();
    if (width < 0 || width > image->width ||
        height < 0 || height > image->height) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, 
             "[!] epeg.image.downsize - Argument discrepancy! new height/width must be less than old height/width and non-negative!")));
      return;
    }

    int quality = DEFAULT_QUALITY;
    if (args[2]->IsInt32())
        quality = args[2]->Int32Value();

    epeg_quality_set(image->im, quality);
    epeg_decode_size_set(image->im, width, height);

    image->scaled = true;

    args.GetReturnValue().Set(args.This());
}

void
Image::Crop(const FunctionCallbackInfo<Value>& args)
{
    Isolate* isolate = args.GetIsolate();

    Image * image = ObjectWrap::Unwrap<Image>(args.This());

    if (image->scaled) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
             "[!] epeg.image.crop - Image has already been scaled. So we can't crop. Get buffer with .process() and make new Image")));
      return;
    } else if (image->cropped) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
             "[!] epeg.image.crop - Image has already been cropped. So we can't crop. Get buffer with .process() and make new Image")));
      return;
    }
    if (args.Length() < 4) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
              "[!] epeg.image.crop - Four arguments must be passed to crop: (startX, startY, newWidth, newHeight)")));
      return;
    }

    if (!args[0]->IsInt32() ||
        !args[1]->IsInt32() ||
        !args[2]->IsInt32() ||
        !args[3]->IsInt32()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, 
              "[!] epeg.image.crop - Arguments to crop must be integers. (Int32)")));
      return;
    }

    int x = args[0]->Int32Value();
    int y = args[1]->Int32Value();

    int width = args[2]->Int32Value();
    int height = args[3]->Int32Value();

    if (x < 0 || y < 0 || width < 0 || height < 0 ||
        (x + width) > image->width || (y + height) > image->height) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate,
               "[!] epeg.image.crop - Discrepancy! Trying to crop outside bounds (or negative argument passed?)")));
      return;
    }

    int quality = DEFAULT_QUALITY;
    if (args[4]->IsInt32())
        quality = args[4]->Int32Value();

    epeg_quality_set(image->im, quality);
    epeg_decode_bounds_set(image->im, x, y, width, height);

    image->cropped = true;
    args.GetReturnValue().Set(args.This());
}

void
Image::GetWidth(Local<String>, const PropertyCallbackInfo<Value> &info)
{
  Isolate* isolate = info.GetIsolate();

  Image * image = ObjectWrap::Unwrap<Image>(info.This());
  info.GetReturnValue().Set(Number::New(isolate, image->width));
}

void
Image::GetHeight(Local<String>, const PropertyCallbackInfo<Value> &info)
{
  Isolate* isolate = info.GetIsolate();

  Image * image = ObjectWrap::Unwrap<Image>(info.This());
  info.GetReturnValue().Set(Number::New(isolate, image->height));
}

int
Image::ProcessInternal()
{
  if (scaled) {
    return epeg_encode(im);
  }
  else if (cropped) {
    return epeg_trim(im);
  }
}
