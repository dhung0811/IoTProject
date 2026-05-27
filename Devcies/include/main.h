#include "weather_API.h"
#include "FreeSerif9pt7b.h"
#include "GT_Pressura_Mono_Light12pt7b.h"
#include "GT_Pressura_Mono_Light20pt7b.h"
#include "GT_Pressura_Mono_Light30pt7b.h"
#include "i01d_data.h"
#include "i01n_data.h"
#include "i02d_data.h"
#include "i02n_data.h"
#include "i03_data.h"
#include "i04_data.h"
#include "i09_data.h"
#include "i10d_data.h"
#include "i10n_data.h"
#include "i11_data.h"
#include "i13_data.h"
#include "i50_data.h"
#include "heart_data.h"
#include "spo2_data.h"

#define ST77XX_GREY 0xC618

String getISOTime() {
  struct tm timeinfo;

  if(!getLocalTime(&timeinfo)){
    return "";
  }

  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S+07:00", &timeinfo);

  return String(buffer);
}

void tft_clear(tft_clr_t scope = TFT_FULL) {
  switch (scope)
  {
    case TFT_FULL:
    {
      tft.fillScreen(ST77XX_BLACK);
      break;
    }
    case TFT_HOUR:
    {
      tft.fillRect(63, TFT_MIDY - 51, 62, 55, ST77XX_BLACK);
      break;
    }
    case TFT_MIN:
    {
      tft.fillRect(127, TFT_MIDY - 46, 50, 55, ST77XX_BLACK);
      break;
    }
    case TFT_DAY:
    {
      tft.fillRect(106, 6, 90, 42, ST77XX_BLACK);
      break;
    }
    case TFT_WEATHER:
    {
      tft.fillRect(2, 2, 100, 80, ST77XX_BLACK);
      tft.fillRect(106, 50, 130, 28, ST77XX_BLACK);
      break;
    }
    case TFT_SV:
    {
      tft.fillRect(20, 189, 68, 36, ST77XX_BLACK);
      tft.fillRect(126, 189, 68, 36, ST77XX_BLACK);
      break;
    }
    default:
    {
      break;
    }
  }
  
  #ifdef WOKWI_SIM
  tft.drawRect(1, 1, 239, 239, ST77XX_CYAN);
  #endif
}

void tft_setup() {
  tft.invertDisplay(0);
  tft.setRotation(4);
  tft.setFont(&FreeSerif9pt7b);
  tft.setTextColor(ST77XX_WHITE);
  tft_clear();
  tft.setCursor(50, TFT_MIDY);
  tft.print("Connecting to WiFi");
}

void tft_clock(String icon_id) {
  struct tm timein4;

  if (!getLocalTime(&timein4)) {
    Serial.println("Failed to obtain time");
    return;
  }

  char day_buf[10];
  char date_buf[20];
  char hour_buf[5];
  char minute_buf[5];

  strftime(day_buf, sizeof(day_buf), "%a", &timein4);
  strftime(date_buf, sizeof(date_buf), "%d/%m/%Y", &timein4);
  strftime(hour_buf, sizeof(hour_buf), "%H", &timein4);
  strftime(minute_buf, sizeof(minute_buf), "%M", &timein4);

  Serial.print("Time infomation: ");
  Serial.println(String(day_buf) + " " + String(date_buf) + " " + String(hour_buf) + " " + String(minute_buf) + "icon: " + icon_id);

  if (strcmp(hour_buf, prev_hour) != 0) {
    tft_clear(TFT_HOUR);
    tft.setFont(&GT_Pressura_Mono_Light30pt7b);
    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(60, TFT_MIDY - 5);
    tft.print(hour_buf);
  }

  if (strcmp(minute_buf, prev_minute) != 0) {
    tft_clear(TFT_MIN);
    tft.setFont(&GT_Pressura_Mono_Light20pt7b);
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(129, TFT_MIDY - 5);
    tft.print(minute_buf);
  }

  if (strcmp(day_buf, prev_day) != 0) {
    tft_clear(TFT_DAY);
    tft.setFont(&FreeSerif9pt7b);
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(110, 20);
    tft.print(day_buf);
    tft.setCursor(110, 44);
    tft.print(date_buf);
  }

  if (icon_id != prev_weather) {
    tft_clear(TFT_WEATHER);
    tft.setFont(&FreeSerif9pt7b);
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(110, 68);
    
    if (icon_id == "01d") {
      tft.print("Clear sky");
      tft.drawRGBBitmap(20, 20, i01d_data, I01D_WIDTH, I01D_HEIGHT);
    }
    else if (icon_id == "01n") {
      tft.print("Clear sky");
      tft.drawRGBBitmap(20, 20, i01n_data, I01N_WIDTH, I01N_HEIGHT);
    }
    else if (icon_id == "02d") {
      tft.print("Few clouds");
      tft.drawRGBBitmap(20, 20, i02d_data, I02D_WIDTH, I02D_HEIGHT);
    }
    else if (icon_id == "02n") {
      tft.print("Few clouds");
      tft.drawRGBBitmap(20, 20, i02n_data, I02N_WIDTH, I02N_HEIGHT);
    }
    else if (icon_id == "03d" || icon_id == "03n") {
      tft.print("Scattered clouds");
      tft.drawRGBBitmap(20, 20, i03_data, I03_WIDTH, I03_HEIGHT);
    }
    else if (icon_id == "04d" || icon_id == "04n") {
      tft.print("Broken clouds");
      tft.drawRGBBitmap(20, 20, i04_data, I04_WIDTH, I04_HEIGHT);
    }
    else if (icon_id == "09d" || icon_id == "09n") {
      tft.print("Shower rain");
      tft.drawRGBBitmap(20, 20, i09_data, I09_WIDTH, I09_HEIGHT);
    }
    else if (icon_id == "10d") {
      tft.print("Rain");
      tft.drawRGBBitmap(20, 20, i10d_data, I10D_WIDTH, I10D_HEIGHT);
    }
    else if (icon_id == "10n") {
      tft.print("Rain");
      tft.drawRGBBitmap(20, 20, i10n_data, I10N_WIDTH, I10N_HEIGHT);
    }
    else if (icon_id == "11d" || icon_id == "11n") {
      tft.print("Thunderstorm");
      tft.drawRGBBitmap(20, 20, i11_data, I11_WIDTH, I11_HEIGHT);
    }
    else if (icon_id == "13d" || icon_id == "13n") {
      tft.print("Snow");
      tft.drawRGBBitmap(20, 20, i13_data, I13_WIDTH, I13_HEIGHT);
    }
    else if (icon_id == "50d" || icon_id == "50n") {
      tft.print("Mist");
      tft.drawRGBBitmap(20, 20, i50_data, I50_WIDTH, I50_HEIGHT);
    }
    else {
      tft.print("Unknown");
    }
  }

  strcpy(prev_day, day_buf);
  strcpy(prev_hour, hour_buf);
  strcpy(prev_minute, minute_buf);
  prev_weather = icon_id;
}

void tft_init_ui() {
  tft.drawFastHLine(0, 140, 240, ST77XX_GREY);
  tft.drawFastVLine(120, 140, 100, ST77XX_GREY);
  tft.setFont(&FreeSerif9pt7b);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(34, 166);
  tft.print("SpO2");
  tft.setCursor(140, 166);
  tft.print("H.Rate");
  tft.drawRGBBitmap(202, 144, heart_data, HEART_WIDTH, HEART_HEIGHT);
  tft.drawRGBBitmap(90, 144, spo2_data, SPO2_WIDTH, SPO2_HEIGHT);
  tft.setFont(&GT_Pressura_Mono_Light12pt7b);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(90, 220);
  tft.print("%");
  tft.setCursor(195, 220);
  tft.print("bpm");
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

void tft_sensor_disp(int hr, int spo2) {
  tft_clear(TFT_SV);
  tft.setFont(&GT_Pressura_Mono_Light20pt7b);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(22, 220);
  char sp02_buf[4];
  sprintf(sp02_buf, "%3d", spo2);
  tft.print(sp02_buf);
  tft.setTextColor(ST77XX_RED);
  tft.setCursor(127, 220);
  char bpm_buf[4];
  sprintf(bpm_buf, "%3d", hr);
  tft.print(bpm_buf);
}

void server_setup() {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String payload;

  if (server_connection == false) {
    http.begin(client, connect_server);
    http.setTimeout(60000);
    http.addHeader("Content-Type", "application/json");

    payload = "{";
    payload += "\"device_id\":\"ESP32_ID_" + String(device_id) + "\",";
    payload += "\"connection\":\"request\"";
    payload += "}";

    Serial.println("Requesting connection...");

    tft.setCursor(46, TFT_MIDY);
    tft.print("Connecting to server");

    Serial.println(payload);
    int httpResponseCode = http.POST(payload);

    Serial.print("HTTP Response: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
      String response = http.getString();
      JSONVar responseObj = JSON.parse(response);
      Serial.println("Server response:");
      Serial.println(response);

      if (JSON.typeof(responseObj) != "undefined") {
        String connection_status = (const char*) responseObj["connection"];

        if (connection_status == "denied") {
          Serial.println("Connection DENIED");
        }
        else if (connection_status == "approved") {
          server_connection = true;
          Serial.println("Connection ACCEPTED");

          tft_clear();
          tft.setCursor(50, TFT_MIDY);
          tft.print("Connected to server");
          delay(2000);
          tft_clear();
        }
        else {
          Serial.println("HTTP 404: Unknown server");
        }
      }
    }
  }

  if (server_connection == false) {
    delay(120000);
  }
}

void pkt2server(int hr = 0, int spo2 = 0) {
  WiFiClientSecure client;
  HTTPClient http;
  String payload;
  
  client.setInsecure();
  http.begin(client, data_server);
  http.setTimeout(60000);
  http.addHeader("Content-Type", "application/json");

  payload = "{";
  payload += "\"device_id\":\"ESP32_ID_" + String(device_id) + "\"" + ",";
  payload += "\"timestamp\":\"" + getISOTime() + "\",";
  payload += "\"heartrate\":" + String(hr) + ",";
  payload += "\"spO2\":" + String(spo2);
  payload += "}";

  Serial.println("Sending health data...");
  Serial.println(payload);
  
  int httpResponseCode = http.POST(payload);
  Serial.print("HTTP Response: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode > 0) {
    String response = http.getString();
    JSONVar responseObj = JSON.parse(response);
    Serial.println("Server response:");
    Serial.println(response);
  }

  http.end();
}

void get_sensor_data() {
  static bool finger_present = false;
  static bool measurement_done = false;

  particleSensor.check();

  if (!particleSensor.available()) {
    return;
  }

  long irValue = particleSensor.getIR();

  // ===== NO FINGER =====
  if (irValue < 50000) {
    if (finger_present) {
      Serial.println("Finger removed");
    }

    finger_present = false;
    measurement_done = false;
    valid_data = false;

    return;
  }

  // ===== FINGER DETECTED =====
  if (!finger_present) {
    finger_present = true;
    Serial.println("Finger detected");
  }

  // ===== ALREADY MEASURED =====
  if (measurement_done) {
    return;
  }

  Serial.println("Starting 10 measurements...");

  bool final_valid = false;

  // ===== 10 MEASUREMENTS =====
  for (int measure = 0; measure < 10; measure++) {
    Serial.print("Measurement #");
    Serial.println(measure + 1);

    bufferLength = BUFFER_SIZE;

    // ===== COLLECT 100 SAMPLES =====
    for (byte i = 0; i < bufferLength; i++) {
      uint32_t start = millis();

      while (!particleSensor.available()) {

        particleSensor.check();

        if (millis() - start > 1000) {

          Serial.println("Sensor timeout");

          valid_data = false;

          return;
        }
      }

      redBuffer[i] = particleSensor.getRed();
      irBuffer[i] = particleSensor.getIR();

      particleSensor.nextSample();
      #ifdef WOKWI_SIM
      delay(10);
      #endif
    }

    // ===== CALCULATE =====
    maxim_heart_rate_and_oxygen_saturation(
      irBuffer,
      bufferLength,
      redBuffer,
      &spo2_calc,
      &validSPO2,
      &heartRate_calc,
      &validHeartRate
    );

    Serial.print("HR=");
    Serial.print(heartRate_calc);

    Serial.print(" SPO2=");
    Serial.println(spo2_calc);

    // ===== KEEP ONLY LATEST VALID RESULT =====
    if (validHeartRate &&
        validSPO2 &&
        heartRate_calc > 40 &&
        heartRate_calc < 180 &&
        spo2_calc > 80 &&
        spo2_calc <= 100) {

      hr = heartRate_calc;
      spo2 = spo2_calc;

      final_valid = true;
    }
  }

  // ===== FINAL RESULT =====
  if (final_valid) {
    valid_data = true;
    measurement_done = true;

    Serial.println("================================");

    Serial.print("FINAL HR: ");
    Serial.println(hr);

    Serial.print("FINAL SPO2: ");
    Serial.println(spo2);

    Serial.println("================================");
  }
  else {
    valid_data = false;
    Serial.println("No valid measurement");
  }
}