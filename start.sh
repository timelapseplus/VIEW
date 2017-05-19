#!/bin/sh
ACTION=""
if (/opt/sunxi-tools/pio -m PB10 | grep -q "PB10<0><1><0><0>") && test -e /sys/class/block/mmcblk1p1; then
    echo "button pressed"
    mount /dev/mmcblk1p1 /media
    if ls /media/VIEW-*.zip 1> /dev/null 2>&1; then
	    echo "firmware available"
	    ACTION="install"
	else
		umount /media
	fi
fi

if [ "$ACTION" = "install" ]; then
	fbi -T 1 -d /dev/fb0 -noverbose /root/view-splash.png &
	killall node
	cd /home/view/current;
	node sd_card_update.js
	echo "installation complete!"
	umount /media
else
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
fi

