#include <Arduino.h>
// ====== Library ======
#include "WiFi.h"
#include <WiFiClientSecure.h>
#include "HTTPClient.h"
#include <Arduino_JSON.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include "time.h"
#include <ctime>
#include <SPI.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"

// ====== Defines ======
#define TFT_CS   7
#define TFT_DC   2
#define TFT_RST  3
#define TFT_MIDY 130
#define WOKWI_SIM   // <--- Comment out if not using Wokwi

// ====== Constants ======
#ifdef WOKWI_SIM
  const char *ssid = "Wokwi-GUEST";
  const char *password = NULL;
#else
  const char *ssid = "dhung";
  const char *password = "khucngoctram";
#endif
const char *data_server = "https://health-api.dhunggg.io.vn/api/v1/metrics";
const char *connect_server = "https://health-api.dhunggg.io.vn/api/v1/connect";

// ====== Typedef ======
typedef enum {TFT_HOUR, TFT_MIN, TFT_DAY, TFT_DATE, TFT_FULL, TFT_WEATHER, TFT_SV} tft_clr_t;

// ====== Variables ======
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);
MAX30105 particleSensor;
uint64_t device_id = ESP.getEfuseMac() % 10000;
bool server_connection = false;
String prev_weather;
char prev_day[10] = "";
char prev_hour[5] = "";
char prev_minute[5] = "";
uint8_t min_count = 60;
int hr;
int spo2;
bool valid_data;
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];
int32_t bufferLength;
int32_t spo2_calc;
int8_t validSPO2;
int32_t heartRate_calc;
int8_t validHeartRate;


// ====== Include ======
#include "main.h"

// ====== Main ======
void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  Wire.begin(8, 9);
  Serial.println("Initializing MAX30102...");
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not found");
  }
  else {
    Serial.println("Sensor ready");
  }
  byte ledBrightness = 50;
  byte sampleAverage = 1;
  byte ledMode = 2;
  byte sampleRate = 100;
  int pulseWidth = 69;
  int adcRange = 4096;

  particleSensor.setup(
    ledBrightness,
    sampleAverage,
    ledMode,
    sampleRate,
    pulseWidth,
    adcRange
  );

  particleSensor.setPulseAmplitudeRed(0x1F);
  particleSensor.setPulseAmplitudeIR(0x1F);

  tft.init(240, 240, SPI_MODE0);
  tft.setSPISpeed(80000000);
  tft_setup();

  Serial.println("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  delay(2000);
  Serial.println("WiFi Connected");
  #ifdef WOKWI_SIM
  configTime(7 * 3600, 0, "103.70.12.61", "103.186.65.246", "45.252.250.189");
  #else
  configTime(7 * 3600, 0, "pool.ntp.org");
  #endif

  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.println("Waiting for NTP time sync...");
    delay(500);
  }
  Serial.println("Time synchronized!");

  tft_clear();
  tft.setCursor(80, TFT_MIDY);
  tft.print("Connected");
  delay(2000);
  tft_clear();

  do {
    server_setup();
  } while (server_connection == false);
  
  tft_init_ui();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    static unsigned long lastClockUpdate = 0;
    static unsigned long lastValidDataTime = 0;
    static bool showingMeasurement = false;

    // ===== CLOCK UPDATE =====
    if (millis() - lastClockUpdate >= 60000 || min_count >= 60) {
      lastClockUpdate = millis();
      min_count = 0;
      tft_clock(getDailyWeatherIcon());
    }

    // ===== SENSOR =====
    get_sensor_data();

    // ===== DISPLAY + SERVER =====
    if (valid_data) {
      valid_data = false;
      lastValidDataTime = millis();
      showingMeasurement = true;
      tft_sensor_disp(hr, spo2);
      pkt2server(hr, spo2);
    }

    if (showingMeasurement && (millis() - lastValidDataTime >= 5000)) {
      showingMeasurement = false;
      tft_clear(TFT_SV);
      tft.setFont(&GT_Pressura_Mono_Light20pt7b);
      tft.setTextColor(ST77XX_CYAN);
      tft.setCursor(22, 220);
      char sp02_buf[4];
      strcpy(sp02_buf, " --");
      tft.print(sp02_buf);
      tft.setTextColor(ST77XX_RED);
      tft.setCursor(127, 220);
      char bpm_buf[4];
      strcpy(bpm_buf, " --");
      tft.print(bpm_buf);
    }

    delay(10);
  }
  else {
    server_connection = false;
    prev_weather = "";
    min_count = 60;
    hr = 0;
    spo2 = 0;
    valid_data = 0;
    strcpy(prev_day, "");
    strcpy(prev_hour, "");
    strcpy(prev_minute, "");
    tft_clear();
    tft.setCursor(50, TFT_MIDY);
    tft.print("Wifi disconnected!");

    Serial.print("WiFi disconnected!");
    WiFi.begin(ssid, password);
    tft_setup();

    Serial.println("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }

    delay(2000);
    Serial.println("WiFi Connected");
    tft_clear();
    tft.setCursor(80, TFT_MIDY);
    tft.print("Connected");
    delay(2000);
    tft_clear();

    do {
      server_setup();
    } while (server_connection == false); 

    tft_init_ui();
  }
}