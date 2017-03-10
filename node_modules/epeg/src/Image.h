#ifndef __EPEG_IMAGE_H__
# define __EPEG_IMAGE_H__

#include <node.h>
#include <v8.h>
#include <node_object_wrap.h>
#include <node_version.h>

#include "Epeg.h"

using namespace v8;

class Image: public node::ObjectWrap {
 public:
  static Persistent<FunctionTemplate> constructor;
  static void Initialize(Handle<Object>);

  static void New(const FunctionCallbackInfo<Value> &args);
  static void Downsize(const FunctionCallbackInfo<Value> &args);
  static void Crop(const FunctionCallbackInfo<Value> &args);
  static void Process(const FunctionCallbackInfo<Value> &args);
  static void SaveTo(const FunctionCallbackInfo<Value> &args);

  static void GetWidth(Local<String> prop, const PropertyCallbackInfo<Value> &info);
  static void GetHeight(Local<String> prop, const PropertyCallbackInfo<Value> &info);

  Image();

 private:
  ~Image();
  int   ProcessInternal();

  Epeg_Image *  im;
  int           width;
  int           height;

  bool          scaled;
  bool          cropped;
};

#endif /* __EPEG_IMAGE_H__ */
