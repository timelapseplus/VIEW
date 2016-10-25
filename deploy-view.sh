#/bin/sh

#rsync -r ./ root@10.0.0.1:/root/tlpv2 --stats --exclude "node_modules"
rsync -r ./ root@192.168.1.8:/root/tlpv2 --stats --exclude "node_modules", "frontend/node_modules"
#ssh root@edison 'cd /root/tlpv2/src; mkdir ../bin; gcc -Wall -O3 ./bulb.c -o ../bin/bulb -lmraa; chmod "+x" ../bin/bulb; gcc dcraw.c -o ../bin/dcraw  -O4 dcraw.c -lm  -DNODEPS; chmod "+x" ../bin/dcraw;'
#ssh root@edison 'cd /view/app; npm install;
#ssh root@edison 'cd /view/app; /etc/init.d/tlpv2 stop --force; /etc/init.d/tlpv2 start'
