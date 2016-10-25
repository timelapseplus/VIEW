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
Image::Initialize(Handle<Object> target)
{
  HandleScope  scope;

  // Constructor                                                                                                                               
  constructor = Persistent<FunctionTemplate>::New(FunctionTemplate::New(Image::New));
  constructor->InstanceTemplate()->SetInternalFieldCount(1);
  constructor->SetClassName(String::NewSymbol("Image"));

  // Prototype                                                                                                                                 
  Local<ObjectTemplate> proto = constructor->PrototypeTemplate();

  NODE_SET_PROTOTYPE_METHOD(constructor, "downsize", Downsize);
  NODE_SET_PROTOTYPE_METHOD(constructor, "crop", Crop);
  NODE_SET_PROTOTYPE_METHOD(constructor, "process", Process);
  NODE_SET_PROTOTYPE_METHOD(constructor, "saveTo", SaveTo);

  proto->SetAccessor(String::NewSymbol("width"), GetWidth);
  proto->SetAccessor(String::NewSymbol("height"), GetHeight);

  target->Set(String::NewSymbol("Image"), constructor->GetFunction());
}

Handle<Value>
Image::New(const Arguments &args)
{
  HandleScope  scope;

  Image * image = new Image();
  image->Wrap(args.This());

  if (args.Length() < 1) {
    ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
    return scope.Close(Undefined());
  }

  if (args[0]->IsObject()) {
    Handle<Object> object = Handle<Object>::Cast(args[0]);
    Handle<Value> pathValue = object->Get(String::New("path"));
    Handle<Value> dataValue = object->Get(String::New("data"));

    if (pathValue->IsString()) {
      String::AsciiValue path(pathValue);
      image->im = epeg_file_open(*path);
    }
    else if (node::Buffer::HasInstance(dataValue)) {
      unsigned char * buffer = (uint8_t *) node::Buffer::Data(dataValue->ToObject());
      int size = node::Buffer::Length(dataValue->ToObject());

      image->im = epeg_memory_open(buffer, size);
    }
    else {
      ThrowException(Exception::TypeError(String::New("Wrong arguments")));
      return scope.Close(Undefined());
    }

    if (!image->im) {
      ThrowException(Exception::TypeError(String::New("Cannot create image")));
      return scope.Close(Undefined());
    }
    epeg_size_get(image->im, &(image->width), &(image->height));
  }
  return scope.Close(args.This());
}

Handle<Value>
Image::Process(const Arguments &args)
{
  HandleScope scope;

  unsigned char *       data;
  int                   size;

  Image * image = ObjectWrap::Unwrap<Image>(args.This());
  if (!image->im) {
    ThrowException(Exception::TypeError(String::New("Image already updated")));
    return scope.Close(Undefined());
  }

  epeg_memory_output_set(image->im, &data, &size);

  if (image->ProcessInternal() != 0) {
    ThrowException(Exception::TypeError(String::New("Could not save to buffer")));
    return scope.Close(Undefined());
  }

  epeg_close(image->im);
  image->im = NULL;

  node::Buffer * buffer = node::Buffer::New(size);
  memcpy(node::Buffer::Data(buffer), data, size);

  return buffer->handle_;
}

Handle<Value>
Image::SaveTo(const Arguments &args)
{
  HandleScope scope;

  Image * image = ObjectWrap::Unwrap<Image>(args.This());
  if (!image->im) {
    ThrowException(Exception::TypeError(String::New("Image already updated")));
    return scope.Close(Undefined());
  }

  if (!args[0]->IsString()) {
    ThrowException(Exception::TypeError(String::New("Wrong arguments")));
    return scope.Close(Undefined());
  }
  String::AsciiValue output_file(args[0]->ToString());

  epeg_file_output_set(image->im, *output_file);

  if (image->ProcessInternal() != 0) {
    ThrowException(Exception::TypeError(String::New("Could not save to file")));
    return scope.Close(Undefined());
  }

  epeg_close(image->im);
  image->im = NULL;

  return scope.Close(Undefined());
}

Handle<Value>
Image::Downsize(const Arguments& args)
{
    HandleScope  scope;

    Image * image = ObjectWrap::Unwrap<Image>(args.This());

    if (image->scaled || image->croped) {
      ThrowException(Exception::TypeError(String::New("Image already updated")));
      return scope.Close(Undefined());
    }
    if (args.Length() < 2) {
      ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
      return scope.Close(Undefined());
    }

    if (!args[0]->IsNumber() || !args[1]->IsNumber()) {
      ThrowException(Exception::TypeError(String::New("Wrong arguments")));
      return scope.Close(Undefined());
    }

    int width = args[0]->NumberValue();
    int height = args[1]->NumberValue();
    if (width < 0 || width > image->width ||
        height < 0 || height > image->height) {
      ThrowException(Exception::TypeError(String::New("Wrong arguments")));
      return scope.Close(Undefined());
    }

    int quality = DEFAULT_QUALITY;
    if (args[2]->IsNumber())
        quality = args[2]->NumberValue();

    epeg_quality_set(image->im, quality);
    epeg_decode_size_set(image->im, width, height);

    image->scaled = true;

    return scope.Close(args.This());
}

Handle<Value>
Image::Crop(const Arguments& args)
{
    HandleScope  scope;

    Image * image = ObjectWrap::Unwrap<Image>(args.This());

    if (image->scaled || image->croped) {
      ThrowException(Exception::TypeError(String::New("Image already updated")));
      return scope.Close(Undefined());
    }
    if (args.Length() < 4) {
      ThrowException(Exception::TypeError(String::New("Wrong number of arguments")));
      return scope.Close(Undefined());
    }

    if (!args[0]->IsNumber() ||
        !args[1]->IsNumber() ||
        !args[2]->IsNumber() ||
        !args[3]->IsNumber()) {
      ThrowException(Exception::TypeError(String::New("Wrong arguments")));
      return scope.Close(Undefined());
    }

    int x = args[0]->NumberValue();
    int y = args[1]->NumberValue();

    int width = args[2]->NumberValue();
    int height = args[3]->NumberValue();

    if (x < 0 || y < 0 || width < 0 || height < 0 ||
        (x + width) > image->width || (y + height) > image->height) {
      ThrowException(Exception::TypeError(String::New("Wrong arguments")));
      return scope.Close(Undefined());
    }

    int quality = DEFAULT_QUALITY;
    if (args[4]->IsNumber())
        quality = args[4]->NumberValue();

    epeg_decode_bounds_set(image->im, x, y, width, height);

    image->croped = true;
    return scope.Close(args.This());
}

Handle<Value>
Image::GetWidth(Local<String>, const  AccessorInfo &info)
{
  HandleScope scope;

  Image * image = ObjectWrap::Unwrap<Image>(info.This());
  return scope.Close(Number::New(image->width));
}

Handle<Value>
Image::GetHeight(Local<String>, const  AccessorInfo &info)
{
  HandleScope scope;

  Image * image = ObjectWrap::Unwrap<Image>(info.This());
  return scope.Close(Number::New(image->height));
}

int
Image::ProcessInternal()
{
  if (scaled) {
    return epeg_encode(im);
  }
  else if (croped) {
    return epeg_trim(im);
  }
}
