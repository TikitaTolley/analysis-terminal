# Firmware

ESP32-WROOM, ILI9341 320 x 240 display, three buttons. [Wiring and upload steps](../README.md#wiring).

## Configuration

Copy [secrets.example.h](secrets.example.h) to `secrets.h` and fill in:

| Setting | Value |
| --- | --- |
| `WIFI_SSID`, `WIFI_PASSWORD` | Your 2.4 GHz Wi-Fi |
| `API_URL` | Your companion Worker's base URL |
| `DEVICE_KEY` | Same secret as the Worker |

Dependencies: ESP32 Arduino core, Adafruit ILI9341 with dependencies, ArduinoJson 7. Serial Monitor: 115200 baud.

## Behaviour

- Previous/Next wrap through overview, win rate and standings.
- Reset ends the session; while idle it returns to the first demo page.
- HTTPS polling runs separately from the display and buttons.
- A lost connection keeps the last screen and shows connection status.
- Sessions expire after 15 minutes, returning to the fictional demo.

## Files

| File | Purpose |
| --- | --- |
| [main.ino](main.ino) | Display, controls and network requests |
| [navigation.h](navigation.h) | Button navigation |
| [demo_data.h](demo_data.h) | Fictional idle data |
| [certificates.h](certificates.h) | HTTPS trust certificate |

## Check after uploading

Connect Wi-Fi, submit a player ID, check the screen and phone confirmation, try all three buttons, then submit again. Briefly disconnect Wi-Fi to check reconnection.
