{
  "targets": [
    {
      "target_name": "jpeglum",
      "sources": [ "./lib/jpeg-lum.cc", "./lib/lib.cc" ],
      "link_settings": {
          "libraries": [
              "-ljpeg"
          ]
      }
    }
  ]
}

