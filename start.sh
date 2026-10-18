#!/bin/sh

# Boot at 624 MHz, the top of the kernel's frequency table (it runs there at 1.2 V through the systemd part of every
# boot), at the 1.3 V hardware/power.js uses for live view; rc.local caps the CPU at 432 MHz otherwise. Voltage first,
# same AXP209 registers as performance(); back to 500 MHz once the core is up (below). First thing, and once: this
# file runs twice per start, as /root/startup.sh and then as the installed version.
read -r MAXFREQ < /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq
[ "$MAXFREQ" = 624000 ] || { i2cset -y -f 0 0x34 0x27 0x18 && i2cset -y -f 0 0x34 0x23 0x18 && cpufreq-set -u 624MHz; }

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
	killall fbi
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
# Diagnostics: seconds since boot and the CPU's cumulative user/system/idle/iowait time (1/100 s) at the boot
# milestones, to see how much CPU is left unused while the app starts.
cpustat() {
	read -r UP IDLE < /proc/uptime
	read -r CPU USR NIC SYS IDL IOW REST < /proc/stat
	echo "cpu at ${UP}s, $1: user=$USR sys=$SYS idle=$IDL iowait=$IOW"
}
cpustat "start.sh"
# Pull the files node is about to load into the page cache, roughly in load order: the node binary, our own code,
# the node modules listed in the fast-boot caches (written by the UI and the core on their first start) and the
# libraries sharp loads. Loading them is CPU-bound but starts from a cold cache; this way the SD card reads overlap
# with the compiling instead of stalling it. Lowest disk priority, so the app's own reads go first; normal CPU priority,
# as at nice 19 the busy UI starves it until it is too late to help (it needs very little CPU).
(
	cd /home/view/current
	ionice -c2 -n7 cat "$(command -v node)" > /dev/null 2>&1
	UIMODS=$(grep -oE ':"[^"]+\.(js|json|node)"' module-locations-cache.json 2>/dev/null | cut -d'"' -f2)
	COREMODS=$(grep -oE ':"[^"]+\.(js|json|node)"' module-locations-cache-core.json 2>/dev/null | cut -d'"' -f2)
	ionice -c2 -n7 cat main.js system/*.js hardware/*.js interface/*.js intervalometer/*.js camera/*.js camera/*/*.js $UIMODS \
		node_modules/sharp/lib/* camera/ptpjs/drivers/*.js motion/*.js motion/drivers/*.js $COREMODS > /dev/null 2>&1
) &

# Stop a running app, supervisors first or they would respawn node; a clean boot has nothing to stop.
# The pattern matches bin/view-supervise and the inline loop of the first 1.8.55 betas.
pkill -f '[v]iew-supervise' 2>/dev/null
if pgrep -x node > /dev/null; then
	killall node
	sleep 1
	killall -s 9 node
fi
cd /home/view/current;
# The splash, until the UI draws its menu. At boot the view-splash unit below has normally put it up already; this
# covers restarts of the app. A pre-converted frame written straight into the framebuffer: fbi, used before, took
# over a second (fonts) of the CPU the UI is starting on.
cat /home/view/current/media/view-splash.rgb565 > /dev/fb0 2>/dev/null
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
# bin/view-supervise keeps each process running like `forever` did (minus forever's 8-9 s of node start-up per
# launch) and, unlike forever, SIGKILLs it 5 s after a stop request so a hung node cannot block shutdown.
SUPERVISE="sh /home/view/current/bin/view-supervise"
# The pango/cairo/fontconfig the UI ends up using come from the sharp bundle and cannot find the
# system config on their own; without this the first OLED draw rescans every font for ~15 s.
export FONTCONFIG_FILE=/home/view/current/fonts/fonts.conf
echo "starting UI...";
$SUPERVISE ui node --max_old_space_size=128 /home/view/current/main.js 2>&1 | prepend_date >> $UILOGFILE &
# Housekeeping the UI does not have to wait for.
# rc-local.service (which runs all of this at boot) has TimeoutSec=0: at shutdown systemd waits for our processes
# with no limit, so a single one that ignores SIGTERM hangs the unit until the battery is pulled. Bound the wait;
# after 20 s systemd SIGKILLs whatever is left. Written once, only when missing or different.
DROPIN_DIR=/etc/systemd/system/rc-local.service.d
DROPIN="[Service]
TimeoutStopSec=20"
if [ "$(cat $DROPIN_DIR/view-stop-timeout.conf 2>/dev/null)" != "$DROPIN" ]; then
	mkdir -p $DROPIN_DIR && echo "$DROPIN" > $DROPIN_DIR/view-stop-timeout.conf && (systemctl daemon-reload &)
fi
# Services inherited from the Olimex Debian image that do nothing useful on a VIEW but compete with the app for
# the single CPU core while it starts: X login (X cannot run on this hardware), boot splash (we show ours), IR
# remote (unconfigured), a second DHCP server set up for a non-existent interface (dnsmasq serves the hotspot), PPP
# DNS restore (no PPP), ConsoleKit, cpufreq scripts (they set a governor this kernel lacks; rc.local and the app set
# the clock), ifupdown (only lo, which systemd brings up itself) and systemd-rfkill@, which restores the radios'
# saved soft-block state: sysinit.target waits for it until udev has handed over the rfkill devices of the Wi-Fi
# driver, while the app sets the Bluetooth state itself. Nothing depends on them. Masked once, takes
# effect from the next boot; `systemctl unmask <name>.service` undoes it.
UNNEEDED="systemd-rfkill@ slim lirc udhcpd pppd-dns console-kit-log-system-start loadcpufreq cpufrequtils networking plymouth-start plymouth-read-write plymouth-quit plymouth-quit-wait plymouth-halt plymouth-poweroff plymouth-reboot plymouth-kexec"
TOMASK=""
for u in $UNNEEDED; do
	[ -h /etc/systemd/system/$u.service ] || TOMASK="$TOMASK $u.service"
done
[ -n "$TOMASK" ] && (systemctl mask $TOMASK > /dev/null 2>&1 &)
# Put the splash up as early in the boot as possible, ~3 s after the kernel starts rather than ~14 s: a unit with no
# dependencies writes the frame (160x128 RGB565, converted from media/view-splash.png) into the OLED's framebuffer,
# which the kernel sets up 1.5 s into the boot. Written once, takes effect from the next boot;
# `systemctl disable view-splash` undoes it.
SPLASH_UNIT="[Unit]
Description=VIEW boot splash
DefaultDependencies=no

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'cat /home/view/current/media/view-splash.rgb565 > /dev/fb0 || true'

[Install]
WantedBy=sysinit.target"
if [ "$(cat /etc/systemd/system/view-splash.service 2>/dev/null)" != "$SPLASH_UNIT" ]; then
	echo "$SPLASH_UNIT" > /etc/systemd/system/view-splash.service && mkdir -p /etc/systemd/system/sysinit.target.wants &&
		ln -sf /etc/systemd/system/view-splash.service /etc/systemd/system/sysinit.target.wants/view-splash.service
fi
# Start the core as soon as the UI has drawn its first menu (used to be a fixed 35 s), 40 s at most; checked every
# 0.2 s, as the core waits for nothing else.
i=0
while [ $i -lt 200 ] && ! grep -q "Setting default status" "$UILOGFILE" 2>/dev/null; do sleep 0.2; i=$((i+1)); done
echo "UI ready after $((i / 5)).$((i % 5 * 2))s"
cpustat "UI ready"
test -e /lib/arm-linux-gnueabihf/libusb-0.1.so.4 && mv /lib/arm-linux-gnueabihf/libusb-0.1.so.4 /lib/arm-linux-gnueabihf/libusb--disabled--0.1.so.4 # disable libusb0.1 for Olympus support
echo "starting CORE...";
$SUPERVISE core node --max_old_space_size=320 --expose-gc /home/view/current/intervalometer/intervalometer-server.js 2>&1 | prepend_date | tee -a $CORELOGFILE ./logs/last.txt &
# Back to the everyday clock (rc.local's 500 MHz cap at 1.2 V) once the core is up; the app manages it from
# there. Frequency first, then voltage, like performance('low'). A live view started in this window just
# runs at the normal clock until the app raises it again.
(
	i=0
	while [ $i -lt 90 ] && ! grep -q "server bound" "$CORELOGFILE" 2>/dev/null; do sleep 1; i=$((i+1)); done
	cpustat "core ready"
	sleep 5
	cpufreq-set -u 500MHz && i2cset -y -f 0 0x34 0x23 0x14 && i2cset -y -f 0 0x34 0x27 0x14
	F=/sys/devices/system/cpu/cpu0/cpufreq
	echo "CPU back to 500MHz after ${i}s (max=$(cat $F/scaling_max_freq) cur=$(cat $F/scaling_cur_freq))"
	# Diagnostics: one boot showed the cap at 528000 some minutes later with nothing in the firmware setting it.
	sleep 60; echo "CPU cap +60s: max=$(cat $F/scaling_max_freq) cur=$(cat $F/scaling_cur_freq) dcdc2=$(i2cget -y -f 0 0x34 0x23)"
) &
