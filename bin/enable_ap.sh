#!/bin.sh

## dual method (unstable)
#killall hostapd
#rm /run/hostapd.pid
#rm /var/run/hostapd/wlan1
#ip addr flush dev wlan1
#/usr/local/bin/hostapd -B -P /run/hostapd.pid /etc/hostapd/hostapd.conf
#ip addr add 10.0.0.1/24 dev wlan1

## single device method
killall hostapd
rm /run/hostapd.pid
rm /var/run/hostapd/wlan0
ip addr flush dev wlan0
/home/view/current/bin/hostapd -B -P /run/hostapd.pid /etc/hostapd/hostapd.conf
ip addr add 10.0.0.1/24 dev wlan0
#ip route add default via 10.0.0.1