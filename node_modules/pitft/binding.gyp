{
  "targets": [
    {
      "target_name": "pitft",
      "include_dirs": [
        "<!(node -e \"require('nan')\")",
        "<!@(pkg-config pangocairo --cflags-only-I | sed s/-I//g)"
      ],
      "sources": [ "src/pitft.cc", "src/framebuffer.cc", "src/lib_jpeg.c" ],
      "conditions": [
        ['OS=="linux"', {
          "libraries": [
            "<!@(pkg-config pangocairo --libs)"
          ],
                    "include_dirs": [
                      "<!@(pkg-config pangocairo --cflags-only-I | sed s/-I//g)"
                    ]
        }]
        ]
    }
  ]
}
