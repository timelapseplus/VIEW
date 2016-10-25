#include <unistd.h>
#include <node.h>
#include <string.h>
#include <v8.h>
//#include <iostream>

extern "C" {
#include "bulb.h"
}

using namespace v8;

// the 'baton' is the carrier for data between functions
struct BulbBaton
{
    // required
    uv_work_t request;                  // libuv
    Persistent<Function> callback;      // javascript callback

    // optional : data goes here.
    // data that doesn't go back to javascript can be any typedef
    // data that goes back to javascript needs to be a supported type

    // inputs
    int32_t bulbMicroSeconds;
    int32_t preFocusMs;
    int32_t endLagMicroSeconds;
    int32_t startLagMicroSeconds;
    bool expectSync;
    bool runTest;
    uint8_t fbConfig;

    //outputs
    int64_t startDiff;
    int64_t stopDiff;
    int64_t actualTime;
    float errPercent;
    int32_t errorCode;

};

// called by libuv worker in separate thread
static void BulbAsync(uv_work_t *req)
{
    BulbBaton *baton = static_cast<BulbBaton *>(req->data);
    
    bulb_config_t config;
    bulb_result_t result;
    
    // setup inputs
    config.bulbMicroSeconds = baton->bulbMicroSeconds;
    config.preFocusMs = baton->preFocusMs;
    config.endLagMicroSeconds = baton->endLagMicroSeconds;
    config.startLagMicroSeconds = baton->startLagMicroSeconds;
    config.expectSync = (uint8_t)baton->expectSync ? 1 : 0;
    config.runTest = (uint8_t)baton->runTest ? 1 : 0;
    config.runTest = baton->fbConfig;

    // run bulb (blocking)
    uint8_t err = bulb(config, &result);

    // save outputs
    baton->errorCode = (int32_t)err;
    baton->startDiff = result.startDiff;
    baton->stopDiff = result.stopDiff;
    baton->actualTime = result.actualTime;
    baton->errPercent = result.errPercent;
}

// called by libuv in event loop when async function completes
static void BulbAsyncAfter(uv_work_t *req,int status)
{
    // get the reference to the baton from the request
    BulbBaton *baton = static_cast<BulbBaton *>(req->data);

    // set up return arguments
    Handle<Value> argv[] =
        {
            Handle<Value>(Number::New(baton->errorCode)),
            Handle<Value>(Number::New(baton->startDiff)),
            Handle<Value>(Number::New(baton->stopDiff)),
            Handle<Value>(Number::New(baton->actualTime)),
            Handle<Value>(Number::New(baton->errPercent))
        };

    int argc = baton->errorCode ? 1 : 5;
    if(baton->runTest) argc = 4;

    // execute the callback
    baton->callback->Call(Context::GetCurrent()->Global(), argc, argv);

    // dispose the callback object from the baton
    baton->callback.Dispose();

    // delete the baton object
    delete baton;
}

// javascript callable function
Handle<Value> Bulb(const Arguments &args)
{
    // create 'baton' data carrier
    BulbBaton *baton = new BulbBaton;

    // get callback argument
    if (args.Length() <= (1) || !args[1]->IsFunction()) {
    return ThrowException(Exception::TypeError(
      String::New("Argument 1 must be a function")));
    }
    Handle<Function> cb = Handle<Function>::Cast(args[1]);

    if (args.Length() <= (0) || !args[0]->IsObject()) {
    return ThrowException(Exception::TypeError(
      String::New("Argument 0 must be an Object")));
    }
    Handle<Array> options = Handle<Array>::Cast(args[0]);

    // setup defaults
    baton->bulbMicroSeconds = 40000;
    baton->preFocusMs = 500;
    baton->endLagMicroSeconds = 39000;
    baton->startLagMicroSeconds = 80000;
    baton->expectSync = true;
    baton->runTest = false;
    baton->fbConfig = FB_USE_BOTH;

    // validate and attach options argument
    Local<Value> bulbMicroSeconds = options->Get(String::New("bulbMicroSeconds"));
    Local<Value> preFocusMs = options->Get(String::New("preFocusMs"));
    Local<Value> endLagMicroSeconds = options->Get(String::New("endLagMicroSeconds"));
    Local<Value> startLagMicroSeconds = options->Get(String::New("startLagMicroSeconds"));
    Local<Value> expectSync = options->Get(String::New("expectSync"));
    Local<Value> runTest = options->Get(String::New("runTest"));
    Local<Value> fbConfig = options->Get(String::New("fbConfig"));

    if (bulbMicroSeconds->IsNumber()) {
      baton->bulbMicroSeconds = (int32_t)bulbMicroSeconds->NumberValue();
      //std::cout << "bulbMicroSeconds: " << baton->bulbMicroSeconds << "\n\r";
    }
    if (preFocusMs->IsNumber()) {
      baton->preFocusMs = (int32_t)preFocusMs->NumberValue();
    }
    if (endLagMicroSeconds->IsNumber()) {
      baton->endLagMicroSeconds = (int32_t)endLagMicroSeconds->NumberValue();
    }
    if (startLagMicroSeconds->IsNumber()) {
      baton->startLagMicroSeconds = (int32_t)startLagMicroSeconds->NumberValue();
    }
    if (expectSync->IsBoolean()) {
      baton->expectSync = expectSync->ToBoolean()->Value();
    }
    if (runTest->IsBoolean()) {
      baton->runTest = runTest->ToBoolean()->Value();
    }
    if (fbConfig->IsNumber()) {
      baton->fbConfig = (uint8_t)fbConfig->NumberValue();
    }

    // attach baton to uv work request
    baton->request.data = baton;

    // assign callback to baton
    baton->callback = Persistent<Function>::New(cb);

    // queue the async function to the event loop
    // the uv default loop is the node.js event loop
    uv_queue_work(uv_default_loop(),&baton->request,BulbAsync,BulbAsyncAfter);

    // nothing returned
    return Undefined();
}

void init(Handle<Object> exports, Handle<Object> module) {

  // add the async function to the exports for this object
  module->Set(
                String::NewSymbol("exports"),                       // javascript function name
                FunctionTemplate::New(Bulb)->GetFunction()          // attach 'Bulb' function to javascript name
              );
}

NODE_MODULE(bulb, init)


