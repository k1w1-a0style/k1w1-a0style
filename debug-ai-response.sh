#!/bin/bash
echo "Letzten 100 Log-Zeilen nach 'Extrahiert' suchen:"
adb logcat -d | grep -A 5 "Extrahiert" | tail -n 20
