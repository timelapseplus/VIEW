#!/bin/sh
#cpufreq-set -f 528MHz
#cpufreq-set -d 100MHz
#cpufreq-set -u 528MHz
#cpufreq-set -g userspace
fbi -T 1 -d /dev/fb0 -noverbose /root/view-splash.png &
#modprobe btusb
killall node
echo "N" > /sys/module/musb_hdrc/parameters/use_dma
cd /home/view/current;
DATE=`date +"%Y%m%d-%H%M%S"`
forever main.js >> ./logs/log-$DATE.txt 2>&1 &
