scp -r hardware/oled.js root@192.168.31.21:/home/view/current/hardware
scp -r main.js root@192.168.31.21:/home/view/current/
scp -r intervalometer/intervalometer-server.js root@192.168.31.21:/home/view/current/intervalometer

ssh root@192.168.31.21 "./startup.sh"
