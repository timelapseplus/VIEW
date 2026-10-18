
#!/bin/bash

# Find the PIDs of Node.js processes associated with main.js
PIDS=$(pgrep -f "main.js")

killall fbi
fbi -T 1 -d /dev/fb0 -noverbose /root/view-splash.png &

# If processes persist, forcefully terminate them
for PID in $PIDS; do
        echo "$PID"
        kill -s 9 "$PID"  # SIGKILL (forceful termination)
done



cd /home/view/current;
DATE=`date +"%Y%m%d-%H%M%S"`
UILOGFILE="/var/log/view-ui-$DATE.txt"
prepend_date() { while read line; do echo "$(date +%Y%m%d-%H%M%S) $line"; done }
trap '' PIPE # see start.sh: keep the log pipeline alive when the SSH session that started it closes
# See start.sh: keeps the sharp-bundled fontconfig from rescanning all fonts at every start.
export FONTCONFIG_FILE=/home/view/current/fonts/fonts.conf
echo "starting UI...";
sh /home/view/current/bin/view-supervise ui node --max_old_space_size=128 /home/view/current/main.js 2>&1 | prepend_date >> $UILOGFILE &
