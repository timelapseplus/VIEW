#!/bin.sh

## dual method (unstable)
#killall hostapd
#rm /run/hostapd.pid
#rm /var/run/hostapd/wlan1
#ip addr flush dev wlan1
#ifconfig wlan1 down

## single device method
killall hostapd
killall wpa_supplicant
killall dhclient
rm /run/hostapd.pid
rm /var/run/hostapd/wlan0
ip addr flush dev wlan0
ifconfig wlan0 down
