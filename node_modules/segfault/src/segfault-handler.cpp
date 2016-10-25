#include <string.h>
#include <execinfo.h>
#include <stdlib.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <assert.h>
#include <stdarg.h>
#include <node.h>
#include <time.h>
#include <node_buffer.h>
#include <node_object_wrap.h>
#include <v8-debug.h>
#include <nan.h>

using namespace v8;
using namespace node;

#define STDERR_FD 2

static char *dir = NULL;

static void segfault_handler(int sig, siginfo_t *si, void *unused) {
  void    *array[32]; // Array to store backtrace symbols
  size_t  size;       // To store the size of the stack backtrace
  char    sbuff[128];
  int     n;          // chars written to buffer
  int     fd;
  time_t  now;
  int     pid;
  const char * signame;


  if (sig == SIGSEGV) {
    signame = "SIGSEGV\0";
  } else if (sig == SIGABRT) {
    signame = "SIGABRT\0";
  } else {
    signame = "UNKNOWN\0";
  }

  // Construct a filename
  time(&now);
  pid = getpid();
  snprintf(sbuff, sizeof(sbuff), "%s/stacktrace-%d-%d.log", dir, (int)now, pid );

  // Open the File
  fd = open(sbuff, O_CREAT | O_APPEND | O_WRONLY, S_IRUSR | S_IRGRP | S_IROTH);
  // Write the header line
  n = snprintf(sbuff, sizeof(sbuff), "PID %d received %s for address: 0x%lx\n", pid, signame, (long) si->si_addr);
  if(fd > 0) write(fd, sbuff, n);
  write(STDERR_FD, sbuff, n);

  // Write the Backtrace
  size = backtrace(array, 32);
  if(fd > 0) backtrace_symbols_fd(array, size, fd);
  backtrace_symbols_fd(array, size, STDERR_FD);

  // Exit violently
  close(fd);
  exit(-1);
}

// create some stack frames to inspect from CauseSegfault
__attribute__ ((noinline)) 
void segfault_stack_frame_1()
{
  // DDOPSON-2013-04-16 using the address "1" instead of "0" prevents a nasty compiler over-optimization
  // When using "0", the compiler will over-optimize (unless using -O0) and generate a UD2 instruction
  // UD2 is x86 for "Invalid Instruction" ... (yeah, they have a valid code that means invalid)
  // Long story short, we don't get our SIGSEGV.  Which means no pretty demo of stacktraces.
  // Instead, you see "Illegal Instruction: 4" on the console and the program stops.

  int *foo = (int*)1;
  printf("NodeSegfaultHandlerNative: about to dereference NULL (will cause a SIGSEGV)\n");
  *foo = 78; // trigger a SIGSEGV

}

__attribute__ ((noinline)) 
void segfault_stack_frame_2(void) {
  // use a function pointer to thwart inlining
  void (*fn_ptr)() = segfault_stack_frame_1;
  fn_ptr();
}

NAN_METHOD(CauseSegfault) {
  NanScope();
  // use a function pointer to thwart inlining
  void (*fn_ptr)() = segfault_stack_frame_2;
  fn_ptr();
  NanReturnUndefined();  // this line never runs
}

NAN_METHOD(CauseAbort) {
  NanScope();
  assert(dir == NULL);
  NanReturnUndefined();  // this line never runs
}

NAN_METHOD(RegisterHandler) {

  NanUtf8String *str;

  NanScope();

  dir = (char *)malloc(64); /* never freed, used by sigaction */
  str = new NanUtf8String(args[0]);
  if (str->length() > 0 && str->length() < 64) {
    char * src = **str;
    strncpy(dir, src, 64);
  } else {
    dir[0] = '.'; dir[1] = '\0';
  }

  struct sigaction sa;
  memset(&sa, 0, sizeof(struct sigaction));
  sigemptyset(&sa.sa_mask);
  sa.sa_sigaction = segfault_handler;
  sa.sa_flags   = SA_SIGINFO;
  sigaction(SIGSEGV, &sa, NULL);
  sigaction(SIGABRT, &sa, NULL);
  NanReturnUndefined();
}

extern "C" {
  void init(Handle<Object> target) {
    NODE_SET_METHOD(target, "registerHandler", RegisterHandler);
    NODE_SET_METHOD(target, "causeSegfault", CauseSegfault);
    NODE_SET_METHOD(target, "causeAbort", CauseAbort);
  }
  NODE_MODULE(segfault_handler, init);
}
