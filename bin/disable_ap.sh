#!/bin.sh
killall hostapd
killall wpa_supplicant
killall dhclient
rm /run/hostapd.pid
rm /var/run/hostapd/wlan0
ip addr flush dev wlan0
ifconfig wlan0 down