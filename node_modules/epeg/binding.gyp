{
  'targets': [
    {
      'target_name': 'epeg',
      'sources': [
        'src/epeg.cc',
        'src/Image.cc',
        'src/epeg_main.c'
      ],
      'cflags': [
        '-w'
      ],
      'libraries': [
        '-ljpeg'
      ]
    }
  ]
}