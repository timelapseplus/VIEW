scp root@192.168.31.21:"$(ssh root@192.168.31.21 'ls -td /root/time-lapse/*/ | head -n 1')"details.csv ./logs
scp root@192.168.31.21:"$(ssh root@192.168.31.21 'ls -td /root/time-lapse/*/ | head -n 1')"data.js ./logs
