#!/bin/sh
WDIR = `cwd`

cd $WDIR
/bin/mkdir -p '/usr/local/lib/libgphoto2/2.5.11.1'
/bin/bash libtool   --mode=install /usr/bin/install -c   ptp2.la '/usr/local/lib/libgphoto2/2.5.11.1'

cd /root/libgphoto2/camlibs; /bin/bash /root/libgphoto2/libtool  --tag CC --mode=relink gcc -g -O2 -Wall -Wmissing-declarations -Wmissing-prototypes -Wshadow -g -O2 -Wall -Wmissing-declarations -Wmissing-prototypes -module -no-undefined -avoid-version -export-dynamic -export-symbols ../camlibs/camlib.sym -rpath /usr/local/lib/libgphoto2/2.5.11.1 -o ptp2.la ptp2/ptp2_la-ptp.lo ptp2/ptp2_la-library.lo ptp2/ptp2_la-usb.lo ptp2/ptp2_la-ptpip.lo ptp2/ptp2_la-config.lo ptp2/ptp2_la-olympus-wrap.lo ptp2/ptp2_la-chdk.lo ../libgphoto2/libgphoto2.la ../libgphoto2_port/libgphoto2_port/libgphoto2_port.la

cd $WDIR
echo "{ global:" > _libs/ptp2.ver
cat ../camlibs/camlib.sym | sed -e "s/\(.*\)/\1;/" >> _libs/ptp2.ver
echo "local: *; };" >> _libs/ptp2.ver


cd $WDIR
gcc -shared  -fPIC -DPIC  ptp2/_libs/ptp2_la-ptp.o ptp2/_libs/ptp2_la-library.o ptp2/_libs/ptp2_la-usb.o ptp2/_libs/ptp2_la-ptpip.o ptp2/_libs/ptp2_la-config.o ptp2/_libs/ptp2_la-olympus-wrap.o ptp2/_libs/ptp2_la-chdk.o   -L/usr/local/lib -lgphoto2 -lgphoto2_port  -O2 -O2   -Wl,-soname -Wl,ptp2.so -Wl,-version-script -Wl,_libs/ptp2.ver -o _libs/ptp2.so

cd $WDIR
/usr/bin/install -c _libs/ptp2.soT /usr/local/lib/libgphoto2/2.5.11.1/ptp2.so
/usr/bin/install -c _libs/ptp2.lai /usr/local/lib/libgphoto2/2.5.11.1/ptp2.la
PATH="/root/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/sbin" ldconfig -n /usr/local/lib/libgphoto2/2.5.11.1
