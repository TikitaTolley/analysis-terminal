/* Analysis Terminal: TFT + three-button breadboard test.
 * Board: ESP32 Dev Module (classic ESP32-WROOM, not S3).
 * Libraries: Adafruit ILI9341, Adafruit GFX Library (accept dependencies).
 *
 * TFT -> ESP32
 * VCC -> verified USB-powered VIN     GND -> GND
 * CS -> 33   RESET -> 22   DC -> 21   MOSI/SDI -> 23   SCK -> 18
 * LED/backlight -> 3V3. Leave MISO/SDO, touch and SD disconnected.
 * Buttons: BLUE -> GPIO25, WHITE -> GPIO26, RED -> GPIO32.
 * Each button connects its GPIO to GND when pressed (INPUT_PULLUP).
 * Select opposite switched contacts, not two internally joined legs.
 *
 * All three buttons are independent counters in this diagnostic.
 * Red does not reboot the board. Send 'r' in Serial Monitor to clear counts.
 * No Wi-Fi, API, NFC reader, or separate status LEDs are needed.
 */
#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>

constexpr int TFT_CS = 33;
constexpr int TFT_DC = 21;
constexpr int TFT_RST = 22;
constexpr int TFT_MOSI = 23;
constexpr int TFT_SCK = 18;
constexpr uint8_t SCREEN_ROTATION = 1;  // Change to 3 if upside down.
constexpr uint32_t DEBOUNCE_MS = 30;
constexpr uint32_t TFT_SPI_HZ = 10000000;  // Conservative breadboard clock.

Adafruit_ILI9341 tft(&SPI, TFT_DC, TFT_CS, TFT_RST);
const uint8_t buttonPins[] = {25, 26, 32};
const char* buttonNames[] = {"BLUE", "WHITE", "RED"};
const uint16_t buttonColours[] = {ILI9341_BLUE, ILI9341_WHITE, ILI9341_RED};
bool lastRaw[3] = {HIGH, HIGH, HIGH};
bool stableState[3] = {HIGH, HIGH, HIGH};
uint32_t changedAt[3] = {0, 0, 0};
uint32_t pressCount[3] = {0, 0, 0};
uint32_t lastHeartbeat = 0;

void drawButton(uint8_t i) {
  const int y = 54 + i * 46;
  const bool pressed = stableState[i] == LOW;
  tft.fillRect(8, y, 304, 42, ILI9341_BLACK);
  tft.drawRect(8, y, 304, 42, buttonColours[i]);
  tft.fillCircle(20, y + 12, 5, pressed ? ILI9341_GREEN : 0x4208);
  tft.setTextSize(1);
  tft.setTextColor(ILI9341_WHITE);
  tft.setCursor(32, y + 7);
  tft.print(buttonNames[i]);
  tft.print("  GPIO");
  tft.print(buttonPins[i]);
  tft.print(pressed ? "  HELD" : "  released");
  tft.setTextSize(2);
  tft.setCursor(16, y + 21);
  tft.print("Presses: ");
  tft.print(pressCount[i]);
}

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < 3; ++i) pinMode(buttonPins[i], INPUT_PULLUP);
  Serial.println("\nAnalysis Terminal breadboard test");
  Serial.println("TFT: CS33 DC21 RESET22 MOSI23 SCK18; MISO not connected.");
  Serial.println("Buttons: blue25 white26 red32, each switched to GND.");

  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.begin(TFT_SPI_HZ);
  tft.setRotation(SCREEN_ROTATION);
  tft.setTextWrap(false);
  const uint16_t colours[] = {ILI9341_RED, ILI9341_GREEN, ILI9341_BLUE};
  for (uint16_t colour : colours) {
    tft.fillScreen(colour);
    delay(250);
  }
  tft.fillScreen(ILI9341_BLACK);
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(2);
  tft.setCursor(10, 8);
  tft.print("TFT + BUTTON TEST");
  tft.setTextSize(1);
  tft.setCursor(10, 34);
  tft.print("Press each button; hold, then release.");
  for (uint8_t i = 0; i < 3; ++i) drawButton(i);
  tft.setCursor(10, 200);
  tft.print("Serial: 115200 baud | r: clear counts");
  Serial.println("Display commands sent. Visually check screen; no readback.");
}

void loop() {
  const uint32_t now = millis();
  for (uint8_t i = 0; i < 3; ++i) {
    const bool raw = digitalRead(buttonPins[i]);
    if (raw != lastRaw[i]) {
      lastRaw[i] = raw;
      changedAt[i] = now;
    }
    if (raw != stableState[i] && now - changedAt[i] >= DEBOUNCE_MS) {
      stableState[i] = raw;
      if (raw == LOW) ++pressCount[i];
      Serial.printf("%s GPIO%u: %s | presses=%lu\n", buttonNames[i],
                    buttonPins[i], raw == LOW ? "PRESSED" : "released",
                    static_cast<unsigned long>(pressCount[i]));
      drawButton(i);
    }
  }
  if (Serial.available()) {
    const char input = Serial.read();
    if (input == 'r' || input == 'R') {
      for (uint8_t i = 0; i < 3; ++i) {
        pressCount[i] = 0;
        drawButton(i);
      }
      Serial.println("Counters cleared.");
    }
  }
  if (now - lastHeartbeat >= 1000) {
    lastHeartbeat = now;
    tft.fillRect(8, 218, 304, 14, ILI9341_BLACK);
    tft.setTextSize(1);
    tft.setTextColor(ILI9341_CYAN);
    tft.setCursor(10, 220);
    tft.print("Running: ");
    tft.print(now / 1000);
    tft.print(" seconds");
    Serial.printf("Alive %lus | raw blue/white/red: %u %u %u (1=released)\n",
                  static_cast<unsigned long>(now / 1000),
                  lastRaw[0], lastRaw[1], lastRaw[2]);
  }
  delay(1);
}
