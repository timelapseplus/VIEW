cmake_minimum_required(VERSION 3.22)
project(jpeg-lum-test)

set(CMAKE_C_STANDARD 99)

include_directories(
        /opt/libjpeg-turbo/include
)

add_executable(jpeg-lum-test
        lib/test.cpp
        lib/lib.cc
)

target_link_directories(jpeg-lum-test PUBLIC
        /opt/libjpeg-turbo/lib64
)

target_link_libraries(jpeg-lum-test PUBLIC jpeg )
