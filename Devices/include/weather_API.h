#pragma once

String dailyWeatherCall = "https://api.openweathermap.org/data/2.5/weather?lat=10.847216247461693&lon=106.78197469839604";
String apiKey = "209e3b62d541a1a3b5c635fa0785658f";

String getDailyWeatherIcon() {
  #ifdef WOKWI_SIM
  String serverPath = "http://15.235.222.68/data/2.5/weather?lat=10.847216247461693&lon=106.78197469839604&appid=209e3b62d541a1a3b5c635fa0785658f&units=metric";
  #else
  String serverPath = dailyWeatherCall + "&appid=" + apiKey + "&units=metric";
  #endif

  Serial.println("======================================");
  Serial.println("Requesting weather...");
  Serial.println(serverPath);

  WiFiClient client;
  HTTPClient http;

  http.begin(client, serverPath);

  String icon_id = "";

  int httpResponseCode = http.GET();

  Serial.print("HTTP Response Code: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode > 0) {
    String payload = http.getString();

    Serial.println("Server Payload:");
    Serial.println(payload);

    JSONVar obj = JSON.parse(payload);

    if (JSON.typeof(obj) != "undefined") {
      icon_id = (const char*) obj["weather"][0]["icon"];

      Serial.print("Weather Icon ID: ");
      Serial.println(icon_id);
    }
    else {
      Serial.println("JSON Parse Failed");
    }
  }
  else {
    Serial.print("HTTP Error: ");
    Serial.println(http.errorToString(httpResponseCode));
  }

  http.end();

  return icon_id;
}