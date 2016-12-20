#!/bin/sh
killall fbi
fbi -T 1 -d /dev/fb0 -noverbose /root/view-splash.png &
killall node
cd /home/view/current;
DATE=`date +"%Y%m%d-%H%M%S"`
LOGFILE="logs/log-$DATE.txt"
cat ./logs/current.txt > ./logs/previous.txt
echo $LOGFILE > ./logs/current.txt
prepend_date() { while read line; do echo $(date +%Y%m%d-%H%M%S) $line; done }
forever main.js 2>&1 | prepend_date >> $LOGFILE &
