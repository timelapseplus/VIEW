#!/bin/sh
killall fbi
fbi -T 1 -d /dev/fb0 -noverbose /root/view-splash.png &
killall node
cd /home/view/current;
DATE=`date +"%Y%m%d-%H%M%S"`
UILOGFILE="/var/log/view-ui-$DATE.txt"
CORELOGFILE="/var/log/view-core-$DATE.txt"
cat ./logs/current.txt > ./logs/previous.txt
echo $CORELOGFILE > ./logs/current.txt
prepend_date() { while read line; do echo $(date +%Y%m%d-%H%M%S) $line; done }
forever main.js 2>&1 | prepend_date >> $UILOGFILE &
forever intervalometer/intervalometer-server.js 2>&1 | prepend_date >> $CORELOGFILE &
