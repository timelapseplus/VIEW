#include <stdio.h>
#include <jpeglib.h>
#include <stdlib.h>
#include <unistd.h>
#include <cstring>
#include <math.h>
#include "lib.h"

#ifndef BUILDING_NODE_EXTENSION
#define BUILDING_NODE_EXTENSION
#endif

#include <node.h>

using namespace v8;

Handle<Value> CreateObject(const Arguments& args) {
    HandleScope scope;

    Local<Object> obj = Object::New();
    Local<Array> histArray = Array::New(256);

    for (unsigned int i = 0; i < 256; i++) histArray->Set(i, Number::New((histogram[i] * 16) / ((hist_max * 16) / 256)));
    // compress to 256 max, integer math for speed

    obj->Set(String::NewSymbol("histogram"), histArray);
    obj->Set(String::NewSymbol("luminance"), Number::New(luminance));
    obj->Set(String::NewSymbol("clipped"), Number::New(clipped));
    obj->Set(String::NewSymbol("width"), Number::New(width));
    obj->Set(String::NewSymbol("height"), Number::New(height));

    return obj;
}

Handle<Value> Read(const Arguments& args) {
    HandleScope scope;

    Local<Function> callback = Local<Function>::Cast(args[1]);

    if (args.Length() < 2) {
        Local<Value> err = Exception::Error(String::New("Specify an image filename to read"));
        Local<Value> argv[] = {err};

        callback->Call(Context::GetCurrent()->Global(), 1, argv);

        return scope.Close(Undefined());
    }

    String::AsciiValue string(args[0]);
    char* filename = (char*)malloc(string.length() + 1);
    strcpy(filename, *string);

    if (read_jpeg_file(filename)) {
        Handle<Value> value = CreateObject(args);
        Local<Value> argv[] = {
            Local<Value>::New(Null()),
            Local<Value>::New(value),
        };
        callback->Call(Context::GetCurrent()->Global(), 2, argv);
        return scope.Close(value);
    } else {
        Local<Value> err = Exception::Error(String::New("Error reading image file"));
        Local<Value> argv[] = {err};

        callback->Call(Context::GetCurrent()->Global(), 1, argv);

        return scope.Close(Undefined());
    }

    return scope.Close(CreateObject(args));
}

void init(Handle<Object> exports) {
    exports->Set(String::NewSymbol("read"),
                 FunctionTemplate::New(Read)->GetFunction());
}

NODE_MODULE(jpeglum, init)
