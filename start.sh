#!/bin/sh

echo Y > /sys/module/usbcore/parameters/old_scheme_first
echo -1 >/sys/module/usbcore/parameters/autosuspend

ACTION=""
MD51=`md5sum /root/startup.sh`
MD52=`md5sum /root/sd_card_update.js`
if [ "$MD51" = "72cc8b90d9ecaff265e29a3b5c836b40  /root/startup.sh" ] || [ "$MD52" = "44fb0e4e8ea2dd85a7119b88dc2597ae  /root/sd_card_update.js" ]
then
		test -e /home/view/current/media/view-splash-updating.png && cp /home/view/current/media/view-splash-updating.png /root/view-splash-updating.png
		test -e /home/view/current/sd_card_update.js && cp /home/view/current/sd_card_update.js /root/sd_card_update.js
        echo "md5 matches, copied files"
fi

test -e /home/view/current/start.sh && cp /home/view/current/start.sh /root/startup.sh

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
	killall fbi
	fbi -T 1 -d /dev/fb0 -noverbose /root/view-splash-updating.png &
	killall node
	sleep 1
	killall -s 9 node
	cd /root;
	node sd_card_update.js
	echo "installation complete!"
	umount /media
fi

echo "current script=$0"
if [ "$0" != "/home/view/current/start.sh" ] && [ -e /home/view/current/start.sh ]
then
        echo "starting installed version...";
        sh /home/view/current/start.sh;
        exit;
else
	if [ "$0" != "/home/view/current/start.sh" ]
	then
        echo "running recovery version...";
    else
        echo "running installed version...";
    fi
fi

echo "STARTING processes...";

killall fbi
fbi -T 1 -d /dev/fb0 -noverbose /root/view-splash.png &
# Stop a running app, supervisors first or they would respawn node; a clean boot has nothing to stop.
pkill -f view-supervise- 2>/dev/null
if pgrep -x node > /dev/null; then
	killall node
	sleep 1
	killall -s 9 node
fi
cd /home/view/current;
DATE=`date +"%Y%m%d-%H%M%S"`
UILOGFILE="/var/log/view-ui-$DATE.txt"
CORELOGFILE="/var/log/view-core-$DATE.txt"
cat ./logs/current.txt > ./logs/previous.txt
echo $CORELOGFILE > ./logs/current.txt
> ./logs/last.txt
prepend_date() { while read line; do echo "$(date +%Y%m%d-%H%M%S) $line"; done }
# The core is also tee'd to our stdout (the journal at boot, an SSH session or the old app process when
# restarted). When that stdout goes away, tee would die of SIGPIPE and take prepend_date, the supervisor and
# node with it; with SIGPIPE ignored tee just drops the dead output and keeps writing the log files.
trap '' PIPE
# Keeps a process running like `forever` did, minus forever's own 8-9 s of node start-up per launch.
# The loop is a shell named view-supervise-<name>, so the stop/restart scripts can kill it by name.
supervise() {
	name=$1; shift
	sh -c 'while :; do "$@"; echo "supervise: $1 exited with status $?, restarting in 1 s"; sleep 1; done' "view-supervise-$name" "$@"
}
# The pango/cairo/fontconfig the UI ends up using come from the sharp bundle and cannot find the
# system config on their own; without this the first OLED draw rescans every font for ~15 s.
export FONTCONFIG_FILE=/home/view/current/fonts/fonts.conf
# Boot at the clock the app itself uses for live view (hardware/power.js performance('high'): 576 MHz at
# 1.3 V, voltage first, same AXP209 registers); rc.local caps the CPU at 432 MHz otherwise. Restored below
# once the core is up.
i2cset -y -f 0 0x34 0x27 0x18 && i2cset -y -f 0 0x34 0x23 0x18 && cpufreq-set -u 576MHz
echo "starting UI...";
supervise ui node --max_old_space_size=128 /home/view/current/main.js 2>&1 | prepend_date >> $UILOGFILE &
# Start the core as soon as the UI has drawn its first menu (used to be a fixed 35 s), 40 s at most.
i=0
while [ $i -lt 40 ] && ! grep -q "Setting default status" "$UILOGFILE" 2>/dev/null; do sleep 1; i=$((i+1)); done
echo "UI ready after ${i}s"
test -e /lib/arm-linux-gnueabihf/libusb-0.1.so.4 && mv /lib/arm-linux-gnueabihf/libusb-0.1.so.4 /lib/arm-linux-gnueabihf/libusb--disabled--0.1.so.4 # disable libusb0.1 for Olympus support
echo "starting CORE...";
supervise core node --max_old_space_size=320 --expose-gc /home/view/current/intervalometer/intervalometer-server.js 2>&1 | prepend_date | tee -a $CORELOGFILE ./logs/last.txt &
# Back to the everyday clock (rc.local's 500 MHz cap at 1.2 V) once the core is up; the app manages it from
# there. Frequency first, then voltage, like performance('low'). A live view started in this window just
# runs at the normal clock until the app raises it again.
(
	i=0
	while [ $i -lt 90 ] && ! grep -q "server bound" "$CORELOGFILE" 2>/dev/null; do sleep 1; i=$((i+1)); done
	sleep 5
	cpufreq-set -u 500MHz && i2cset -y -f 0 0x34 0x23 0x14 && i2cset -y -f 0 0x34 0x27 0x14
	F=/sys/devices/system/cpu/cpu0/cpufreq
	echo "CPU back to 500MHz after ${i}s (max=$(cat $F/scaling_max_freq) cur=$(cat $F/scaling_cur_freq))"
	# Diagnostics: one boot showed the cap at 528000 some minutes later with nothing in the firmware setting it.
	sleep 60; echo "CPU cap +60s: max=$(cat $F/scaling_max_freq) cur=$(cat $F/scaling_cur_freq) dcdc2=$(i2cget -y -f 0 0x34 0x23)"
) &
