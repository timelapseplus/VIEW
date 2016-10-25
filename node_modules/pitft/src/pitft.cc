#include <nan.h>
#include "framebuffer.h"

using namespace v8;

NAN_METHOD(CreateObject) {
  Nan::HandleScope scope;
  info.GetReturnValue().Set(FrameBuffer::NewInstance(info[0], info[1]));
}

void InitAll(Handle<Object> exports, Handle<Object> module) {
  Nan::HandleScope scope;

  FrameBuffer::Init();

  module->Set(Nan::New("exports").ToLocalChecked(),
      Nan::New<FunctionTemplate>(CreateObject)->GetFunction());
}

NODE_MODULE(pitft, InitAll)
