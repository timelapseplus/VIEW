#include <node.h>
#include <v8.h>

#include "Image.h"

void init(Handle<Object> target) {
  Image::Initialize(target);
}

NODE_MODULE(epeg, init)

