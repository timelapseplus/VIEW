
#!/bin/bash

# Find the PIDs of Node.js processes associated with main.js
PIDS=$(pgrep -f "intervalometer")

# If processes persist, forcefully terminate them
for PID in $PIDS; do
        echo "$PID"
        kill -s 9 "$PID"  # SIGKILL (forceful termination)
done


cd /home/view/current;
DATE=`date +"%Y%m%d-%H%M%S"`
CORELOGFILE="/var/log/view-core-$DATE.txt"
cat ./logs/current.txt > ./logs/previous.txt
> ./logs/last.txt
prepend_date() { bash -c 'while IFS= read -r line; do printf "%(%Y%m%d-%H%M%S)T %s\n" -1 "$line"; done'; } # see start.sh
trap '' PIPE # see start.sh: keep the log pipeline alive when the SSH session that started it closes
echo "starting CORE (log: tail -f /home/view/current/logs/last.txt)...";
# No copy to stdout (2026-10-21, see start.sh): over SSH this script now returns at once instead of holding the session.
sh /home/view/current/bin/view-supervise core node --max_old_space_size=320 --expose-gc /home/view/current/intervalometer/intervalometer-server.js 2>&1 | prepend_date | tee -a $CORELOGFILE ./logs/last.txt > /dev/null &
