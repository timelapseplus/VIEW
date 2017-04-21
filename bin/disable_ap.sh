#!/bin.sh
killall hostapd
#killall wpa_supplicant
#killall dhclient
rm /run/hostapd.pid
rm /var/run/hostapd/wlan1
ip addr flush dev wlan1
ifconfig wlan1 down