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

  static Handle<Value> New(const Arguments &args);
  static Handle<Value> Downsize(const Arguments &args);
  static Handle<Value> Crop(const Arguments &args);
  static Handle<Value> Process(const Arguments &args);
  static Handle<Value> SaveTo(const Arguments &args);

  static Handle<Value> GetWidth(Local<String> prop, const AccessorInfo &info);
  static Handle<Value> GetHeight(Local<String> prop, const AccessorInfo &info);

  Image();

 private:
  ~Image();
  int   ProcessInternal();

  Epeg_Image *  im;
  int           width;
  int           height;

  bool          scaled = false;
  bool          croped = false;
};

#endif /* __EPEG_IMAGE_H__ */
