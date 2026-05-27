# Báo Cáo Kỹ Thuật — Hệ Thống Giám Sát Sức Khỏe IoT Thời Gian Thực

---

## Mục Lục

1. [Giới Thiệu](#1-giới-thiệu)
2. [Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
3. [Thiết Bị Phần Cứng](#3-thiết-bị-phần-cứng)
4. [Firmware ESP32](#4-firmware-esp32)
5. [Thuật Toán Đo Sinh Trắc](#5-thuật-toán-đo-sinh-trắc)
6. [Mô Phỏng Wokwi](#6-mô-phỏng-wokwi)
7. [Backend API](#7-backend-api)
8. [Message Broker — RabbitMQ](#8-message-broker--rabbitmq)
9. [Stream Processor](#9-stream-processor)
10. [WebSocket Gateway](#10-websocket-gateway)
11. [Dashboard](#11-dashboard)
12. [Trí Tuệ Nhân Tạo](#12-trí-tuệ-nhân-tạo)
13. [Hạ Tầng và Triển Khai](#13-hạ-tầng-và-triển-khai)
14. [Luồng Dữ Liệu End-to-End](#14-luồng-dữ-liệu-end-to-end)

---

## 1. Giới Thiệu

### 1.1 Mô tả dự án

Hệ thống giám sát sức khỏe IoT thời gian thực là một nền tảng phần cứng-phần mềm tích hợp, thu thập dữ liệu sinh trắc học từ cảm biến đeo tay, xử lý và truyền liên tục đến giao diện người dùng. Hệ thống đo hai chỉ số sinh hiệu chính:

- **Heart Rate (HR):** Nhịp tim tính bằng nhịp/phút (BPM)
- **SpO2:** Nồng độ oxy trong máu, tính bằng phần trăm (%)

Dữ liệu từ cảm biến được đẩy qua kiến trúc phân tán đến dashboard web, hiển thị theo thời gian thực kèm biểu đồ lịch sử, cảnh báo thông minh và trợ lý AI có khả năng tư vấn dựa trên chỉ số sức khỏe thực tế của người dùng.

### 1.2 Mục tiêu

- Thu thập HR và SpO2 liên tục từ cảm biến MAX30102 gắn trên ESP32
- Truyền dữ liệu lên server theo thời gian thực, không polling
- Phát cảnh báo tự động khi phát hiện bất thường qua phân tích moving average
- Lưu trữ toàn bộ lịch sử vào time-series database
- Cung cấp trợ lý AI có ngữ cảnh sức khỏe thực tế
- Hỗ trợ mô phỏng đầy đủ không cần phần cứng thật (Wokwi)

### 1.3 Phạm vi

Hệ thống gồm hai phần lớn:

| Phần | Thành phần | Ngôn ngữ / Framework |
|---|---|---|
| **Thiết bị** | Firmware ESP32-C3 | C++ / Arduino / PlatformIO |
| **Thiết bị** | Custom chip giả lập MAX30102 | C → WebAssembly (Wokwi) |
| **Backend** | Ingestion API | Python / FastAPI |
| **Backend** | Message Broker | RabbitMQ |
| **Backend** | Stream Processor | Python asyncio |
| **Backend** | Time-series Database | InfluxDB 2.7 |
| **Backend** | WebSocket Gateway | Python / FastAPI |
| **Backend** | Dashboard | TypeScript / Next.js / React |
| **Hạ tầng** | Container orchestration | Docker Compose |
| **Hạ tầng** | Reverse proxy | Nginx |

---

## 2. Kiến Trúc Hệ Thống

### 2.1 Sơ đồ tổng thể

```
╔══════════════════════════════════════════════════╗
║              THIẾT BỊ (ESP32-C3)                 ║
║                                                  ║
║  [MAX30102]──I²C──►[Thuật toán PPG]──►[ST7789]   ║
║   HR + SpO2           Maxim MAXREFDES117  TFT     ║
║                              │                   ║
╚══════════════════════════════╪═══════════════════╝
                               │ HTTPS POST
                               │ /api/v1/metrics
                   ╔═══════════▼══════════╗
                   ║     Backend API      ║
                   ║   FastAPI  :8000     ║
                   ║ • Pydantic validate  ║
                   ║ • Device registry   ║
                   ╚═══════════╤══════════╝
                               │ AMQP publish
                   ╔═══════════▼══════════╗
                   ║      RabbitMQ        ║
                   ║  Fanout Exchange     ║
                   ╚═════╤════════╤═══════╝
              ┌──────────┘        └──────────┐
   ╔══════════▼═══════╗          ╔═══════════▼══════════╗
   ║ WebSocket Gateway║          ║   Stream Processor   ║
   ║  FastAPI :8080   ║          ║   Python worker      ║
   ║ broadcast JSON   ║          ║ • Moving average     ║
   ╚══════════╤═══════╝          ║ • Alert flags        ║
              │                  ╚═══════════╤══════════╝
   ╔══════════▼═══════╗                      │ write
   ║    Dashboard     ║          ╔═══════════▼══════════╗
   ║  Next.js :3000   ║          ║      InfluxDB        ║
   ║ • Charts realtime║          ║  Time-series DB      ║
   ║ • Alert history  ║          ║      :8086           ║
   ║ • AI Chat        ║          ╚══════════════════════╝
   ╚══════════════════╝
```

### 2.2 Các quyết định thiết kế

**Tại sao dùng Message Broker thay vì ghi thẳng vào DB?**

Backend API tiếp nhận metric từ ESP32 không ghi thẳng vào database mà publish lên RabbitMQ. Điều này tách biệt hoàn toàn ingestion khỏi processing: nếu InfluxDB tạm ngừng, Stream Processor restart, hay Dashboard mất kết nối — ESP32 vẫn gửi được dữ liệu bình thường và không mất message. Mỗi consumer (WebSocket Gateway, Stream Processor) nhận bản sao độc lập qua Fanout Exchange.

**Tại sao dùng WebSocket thay vì polling?**

Dashboard dùng WebSocket để nhận dữ liệu ngay khi có reading mới (~vài giây một lần). Polling HTTP định kỳ sẽ tốn tài nguyên và tăng latency hiển thị — không phù hợp với yêu cầu "realtime" của hệ thống y tế.

**Tại sao cần thủ tục phê duyệt thiết bị?**

Bất kỳ thiết bị nào cũng có thể gọi `/connect`, nhưng chỉ thiết bị được operator xác nhận mới được gửi metric. Điều này ngăn dữ liệu rác hoặc thiết bị lạ xâm nhập hệ thống.

**RabbitMQ thay vì Kafka cho MVP?**

RabbitMQ đơn giản hơn về cấu hình, phù hợp với throughput thấp (một thiết bị, vài giây/reading). Có thể migrate sang Kafka khi cần horizontal scale nhiều thiết bị đồng thời.

---

## 3. Thiết Bị Phần Cứng

### 3.1 Danh sách linh kiện

| Linh kiện | Model | Vai trò |
|---|---|---|
| Vi điều khiển | ESP32-C3 Super Mini | Xử lý, WiFi 802.11 b/g/n, điều phối I²C và SPI |
| Cảm biến sinh trắc | MAX30102 | Đo HR và SpO2 bằng phương pháp PPG quang học |
| Màn hình | ST7789 240×240 IPS | Hiển thị đồng hồ, thời tiết, chỉ số sức khỏe |

### 3.2 Sơ đồ kết nối

**SPI — Màn hình ST7789 (80 MHz)**

| ESP32-C3 GPIO | Chân ST7789 | Chức năng |
|---|---|---|
| GPIO 4 | SCK | SPI clock |
| GPIO 6 | MOSI | SPI data out |
| GPIO 7 | CS | Chip select (TFT_CS) |
| GPIO 3 | RST | Hardware reset (TFT_RST) |
| GPIO 2 | DC | Data / Command select (TFT_DC) |
| 3.3V | VCC + LED | Nguồn và backlight |
| GND | GND | — |

**I²C — Cảm biến MAX30102 (400 kHz Fast Mode)**

| ESP32-C3 GPIO | Chân MAX30102 | Chức năng |
|---|---|---|
| GPIO 8 | SDA | I²C data |
| GPIO 9 | SCL | I²C clock |
| 3.3V | VIN | Nguồn |
| GND | GND | — |

I²C address của MAX30102: `0x57`

### 3.3 Thư viện phần cứng

Tất cả thư viện được vendor trong thư mục `lib/` (không dùng PlatformIO registry), đảm bảo build offline và kiểm soát phiên bản:

| Thư viện | Mục đích |
|---|---|
| `SparkFun_MAX3010x_Sensor` | Driver I²C cho MAX30102 + thuật toán Maxim MAXREFDES117 |
| `Adafruit_ST7735_and_ST7789` | Driver SPI cho màn hình ST7789 |
| `Adafruit_GFX` | Primitives đồ họa: text, bitmap, hình học |
| `Adafruit_BusIO` | Abstraction layer I²C/SPI (dependency của Adafruit) |
| `Arduino_JSON` | Parse JSON phản hồi từ server và OpenWeatherMap |

---

## 4. Firmware ESP32

### 4.1 Cấu trúc code

```
Devcies/
├── src/main.cpp          # Entry point: khai báo biến toàn cục, setup(), loop()
├── include/
│   ├── main.h            # Toàn bộ logic: hàm TFT, sensor, HTTP
│   ├── weather_API.h     # getDailyWeatherIcon() — gọi OpenWeatherMap
│   ├── heart_data.h      # Bitmap icon trái tim (RGB565, 32×32)
│   ├── spo2_data.h       # Bitmap icon SpO2 (RGB565, 32×32)
│   ├── i01d_data.h ... i50_data.h   # Bitmap icon thời tiết (RGB565)
│   └── GT_Pressura_Mono_*.h         # Font tùy chỉnh (12pt / 20pt / 30pt)
└── lib/                  # Thư viện vendor
```

> `main.h` được include **sau** khi tất cả biến toàn cục đã khai báo trong `main.cpp`. Các hàm trong `main.h` truy cập trực tiếp các biến đó, tránh overhead truyền tham số trên hệ thống nhúng.

### 4.2 Cấu hình MAX30102

```cpp
byte ledBrightness = 50;   // ~10 mA — đủ xuyên qua ngón tay
byte sampleAverage = 1;    // Không average, lấy raw
byte ledMode = 2;          // Red + IR (cần cả 2 để tính SpO2)
byte sampleRate = 100;     // 100 mẫu/giây
int  pulseWidth = 69;      // 69 µs — pulse ngắn nhất, tiết kiệm điện
int  adcRange = 4096;      // ADC 18-bit full range

particleSensor.setPulseAmplitudeRed(0x1F);  // ~6.2 mA
particleSensor.setPulseAmplitudeIR(0x1F);   // ~6.2 mA
```

### 4.3 Luồng khởi động `setup()`

```
Serial.begin(115200)
    │
    ▼
Wire.begin(8, 9) → particleSensor.begin(I2C_SPEED_FAST)
particleSensor.setup(ledBrightness, sampleAverage, ledMode,
                     sampleRate, pulseWidth, adcRange)
    │
    ▼
tft.init(240, 240) → tft.setSPISpeed(80000000) → tft_setup()
    │
    ▼
WiFi.begin(ssid, password)
while (status != WL_CONNECTED) delay(500)        ← blocking
    │
    ▼
configTime(7*3600, 0, ntpServer)
while (!getLocalTime(&timeinfo)) delay(500)      ← blocking
    │
    ▼
do { server_setup() } while (!server_connection) ← blocking, retry 2 phút
    │
    ▼
tft_init_ui()   ← vẽ layout cố định
```

### 4.4 Vòng lặp chính `loop()`

```
WiFi connected?
│
├─ KHÔNG ──► reset trạng thái toàn bộ (server_connection, prev_*, hr, spo2)
│            hiển thị "Wifi disconnected!" lên TFT
│            WiFi.begin() → chờ reconnect (blocking)
│            đăng ký lại server → tft_init_ui()
│
└─ CÓ
     │
     ├─ [mỗi 60 giây hoặc khi min_count ≥ 60]
     │   tft_clock(getDailyWeatherIcon())
     │       └─ gọi OpenWeatherMap API → lấy icon_id
     │       └─ cập nhật vùng thay đổi trên màn hình
     │
     ├─ get_sensor_data()
     │   ├─ IR < 50.000 → không có ngón tay, return
     │   └─ IR ≥ 50.000 → đo 10 × 100 mẫu (blocking)
     │           └─ valid_data = true nếu có kết quả hợp lệ
     │
     ├─ valid_data == true
     │   ├─ tft_sensor_disp(hr, spo2)   ← cập nhật màn hình
     │   └─ pkt2server(hr, spo2)        ← HTTP POST /api/v1/metrics
     │
     ├─ showingMeasurement && millis() - lastValidDataTime ≥ 5000
     │   └─ hiển thị "--" (trở về trạng thái chờ)
     │
     └─ delay(10)
```

### 4.5 Màn hình TFT — Bố cục và tối ưu vẽ lại

**Bố cục 240×240 px:**

```
┌──────────────────────────────────────┐ y=0
│  [Icon thời tiết]   Thu              │
│     60×60 px        27/05/2026       │ y=2..80 — vùng thời tiết + ngày
│                     Clear sky        │
│                                      │
│          14    :    30               │ y=79..135 — giờ (30pt cyan) : phút (20pt white)
│                                      │
├──────────────────────────────────────┤ y=140 — đường kẻ ngang GREY
│  [SpO2 icon]   │   [Heart icon]      │ y=144..165
│    SpO2        │     H.Rate          │ y=160..170
│     98         │      76             │ y=189..225 — giá trị 20pt
│      %         │     bpm             │ y=210..225 — đơn vị 12pt
└──────────────────────────────────────┘ y=239
```

**Tối ưu dirty-region — chỉ vẽ lại phần thay đổi:**

```cpp
void tft_clock(String icon_id) {
    if (strcmp(hour_buf, prev_hour) != 0) {
        tft_clear(TFT_HOUR);    // fillRect(63, 79, 62, 55)
        // vẽ giờ mới bằng GT_Pressura_Mono_Light30pt7b
    }
    if (strcmp(minute_buf, prev_minute) != 0) {
        tft_clear(TFT_MIN);     // fillRect(127, 84, 50, 55)
        // vẽ phút mới bằng GT_Pressura_Mono_Light20pt7b
    }
    if (strcmp(day_buf, prev_day) != 0) {
        tft_clear(TFT_DAY);     // fillRect(106, 6, 90, 42)
        // vẽ ngày + thứ mới
    }
    if (icon_id != prev_weather) {
        tft_clear(TFT_WEATHER); // fillRect(2,2,100,80) + fillRect(106,50,130,28)
        // vẽ icon bitmap RGB565 + tên thời tiết
    }
}
```

Icon thời tiết là bitmap RGB565 nhúng thẳng vào flash. Mapping từ code OpenWeatherMap (`01d`, `02n`, v.v.) đến 12 file header bitmap tương ứng.

### 4.6 Giao tiếp server

**Định danh thiết bị:**

```cpp
uint64_t device_id = ESP.getEfuseMac() % 10000;
// → "ESP32_ID_7423"
```

`getEfuseMac()` đọc MAC address 48-bit được ghi cứng vào eFuse của chip — duy nhất mỗi ESP32. Modulo 10000 để rút gọn thành chuỗi 4 chữ số.

**Đăng ký kết nối — `server_setup()`:**

```
POST /api/v1/connect
Body: {"device_id": "ESP32_ID_7423", "connection": "request"}

├─ Response "approved" → server_connection = true, tiếp tục
├─ Response "denied"   → delay(120.000 ms = 2 phút), thử lại
└─ HTTP error          → thử lại ngay
```

Gọi trong vòng `do...while` — blocking hoàn toàn cho đến khi được chấp thuận.

**Gửi metric — `pkt2server()`:**

```json
POST /api/v1/metrics
{
  "device_id": "ESP32_ID_7423",
  "timestamp": "2026-05-27T14:30:15+07:00",
  "heartrate": 76,
  "spO2": 98
}
```

Timestamp định dạng ISO 8601, timezone UTC+7 hardcoded. Gọi một lần sau mỗi lần đo thành công. Dùng `WiFiClientSecure` với `setInsecure()` — HTTPS không xác minh certificate (phù hợp môi trường dev/demo).

---

## 5. Thuật Toán Đo Sinh Trắc

### 5.1 Nguyên lý PPG (Photoplethysmography)

MAX30102 chiếu hai bước sóng LED xuyên qua mô ngón tay:
- **LED đỏ (660 nm):** bị deoxyhemoglobin hấp thụ mạnh hơn
- **LED hồng ngoại (880 nm):** bị oxyhemoglobin hấp thụ mạnh hơn

Mỗi nhịp đập tim bơm máu qua mạch, thay đổi lượng ánh sáng xuyên qua — tạo ra tín hiệu AC dao động chồng lên nền DC. Photodetector đo cường độ ánh sáng phản xạ và chuyển thành giá trị số 18-bit.

```
Tín hiệu IR thô:
         ┌─┐   ┌─┐   ┌─┐
    ─────┘ └───┘ └───┘ └───  ← thành phần AC (nhịp tim)
    ═══════════════════════   ← thành phần DC (mô, xương, máu tĩnh)
```

### 5.2 Pipeline thu thập mẫu

**Bước 1 — Phát hiện ngón tay:**
```cpp
long irValue = particleSensor.getIR();
if (irValue < 50000) return; // ambient IR rất thấp khi không có tay
```
Ngưỡng 50.000 tương đương ~30% dải ADC 18-bit — đủ để phân biệt ánh sáng môi trường với tín hiệu ngón tay.

**Bước 2 — Thu 100 mẫu × 10 lần:**
```
BUFFER_SIZE = FreqS × 4 = 25 × 4 = 100 mẫu
```
Mỗi mẫu đọc: `redBuffer[i] = getRed()`, `irBuffer[i] = getIR()`, sau đó `nextSample()` để xoá khỏi FIFO. Mỗi lần đọc có timeout 1000 ms — nếu FIFO không có dữ liệu trong 1 giây thì abort.

**Bước 3 — Tính toán và lọc:**

Sau 10 lần tính, lấy kết quả hợp lệ **mới nhất** trong 10 lần thỏa mãn đồng thời:

| Điều kiện | Lý do |
|---|---|
| `validHeartRate == 1` | Thuật toán tìm đủ ≥ 2 đỉnh để tính interval |
| `validSPO2 == 1` | Tỉ lệ AC/DC nằm trong dải hợp lệ (2–184) |
| `heartRate ∈ (40, 180)` | Loại giá trị sinh lý bất khả thi |
| `spo2 ∈ (80, 100]` | Loại giá trị ngoài dải có thể sống được |

**Bước 4 — One-shot per placement:**

```cpp
measurement_done = true; // không đo lại cho đến khi nhấc tay
```
Mỗi lần đặt ngón tay → tối đa một lần gửi lên server.

### 5.3 Thuật toán tính Heart Rate

Triển khai trong `spo2_algorithm.cpp` — thuật toán **Maxim MAXREFDES117** (Maxim Integrated, 2016):

```
irBuffer[100]
    │
    ▼  (1) Tính DC mean:
    │      un_ir_mean = sum(irBuffer) / 100
    │
    ▼  (2) Loại DC + đảo tín hiệu:
    │      an_x[k] = -(irBuffer[k] - un_ir_mean)
    │      (đảo để dùng peak detector tìm valley)
    │
    ▼  (3) Làm mượt bằng 4-point Moving Average:
    │      an_x[k] = (an_x[k] + an_x[k+1] + an_x[k+2] + an_x[k+3]) / 4
    │
    ▼  (4) Tính ngưỡng thích nghi:
    │      n_th1 = mean(an_x), clamp vào [30, 60]
    │
    ▼  (5) Phát hiện đỉnh — maxim_find_peaks():
    │      • Tìm đỉnh > n_th1
    │      • Loại đỉnh cách nhau < 4 samples (min_distance)
    │      • Giữ tối đa 15 đỉnh
    │
    ▼  (6) Tính HR:
           n_peak_interval = sum(interval[k]) / (n_peaks - 1)
           HR = (FreqS × 60) / n_peak_interval
              = (25 × 60) / avg_interval
```

Nếu tìm được < 2 đỉnh → `validHeartRate = 0`, `HR = -999`.

### 5.4 Thuật toán tính SpO2

```
irBuffer + redBuffer
    │
    ▼  Với mỗi cặp valley liền kề [k, k+1]:
    │
    │  (1) Tìm DC max của IR và Red giữa 2 valley:
    │      n_x_dc_max = max(irBuffer[valley_k .. valley_k+1])
    │      n_y_dc_max = max(redBuffer[valley_k .. valley_k+1])
    │
    │  (2) Tính AC bằng cách trừ đường nền tuyến tính:
    │      n_x_ac = ir[peak]  - interpolate(ir[valley_k],  ir[valley_k+1])
    │      n_y_ac = red[peak] - interpolate(red[valley_k], red[valley_k+1])
    │
    │  (3) Tính tỉ lệ R (nhân 100 giữ nguyên số nguyên):
    │      ratio = (n_y_ac × n_x_dc_max) / (n_x_ac × n_y_dc_max)
    │
    ▼  (4) Lấy median của tối đa 5 giá trị ratio
    │      (bất biến trước noise từng nhịp tim)
    │
    ▼  (5) Tính SpO2:
           SpO2 = 103.0 - 17.0 × ratio_average / 100
           (áp dụng khi 2 < ratio_average < 184)
```

Công thức xấp xỉ tuyến tính từ định luật Beer–Lambert: SpO2 cao → máu bão hòa oxy → hấp thụ ít ánh sáng đỏ → tỉ lệ Red/IR thấp → SpO2 cao.

Nếu `ratio_average` ngoài khoảng (2, 184) → `validSPO2 = 0`, `SpO2 = -999`.

---

## 6. Mô Phỏng Wokwi

### 6.1 Tổng quan

Wokwi là nền tảng mô phỏng vi điều khiển trên trình duyệt. Do Wokwi không có chip MAX30102 built-in, dự án tự xây một **custom chip WebAssembly** (`chip.c` → `chip.wasm`) giả lập đầy đủ giao thức I²C và tín hiệu PPG quang học.

Sơ đồ mạch (`diagram.json`) kết nối:
- ESP32-C3 Super Mini
- ILI9341 (tương thích ST7789)
- `chip-max_30102` (custom chip)

### 6.2 Giao diện điều khiển

```json
// chip.json
"controls": [
  { "id": "finger",  "type": "range", "min": 0,   "max": 1,   "step": 1 },
  { "id": "beatAvg", "type": "range", "min": 40,  "max": 180, "step": 1 },
  { "id": "spo2Avg", "type": "range", "min": 80,  "max": 100, "step": 1 }
]
```

Ba slider trong UI Wokwi:

| Slider | Khoảng | Mặc định | Ý nghĩa |
|---|---|---|---|
| `finger` | 0–1 | 0 | 0 = không có ngón tay, 1 = có ngón tay |
| `beatAvg` | 40–180 BPM | 75 | Nhịp tim muốn giả lập |
| `spo2Avg` | 80–100 % | 98 | SpO2 muốn giả lập |

### 6.3 Sinh tín hiệu — khi `finger = 0`

Sinh giá trị IR/Red rất thấp để firmware nhận biết "không có ngón tay":

```c
uint32_t ir_val  = 800 + (rand() % 200);   // ~800–1000
uint32_t red_val = 700 + (rand() % 200);   // ~700–900
// Firmware ngưỡng 50.000 → sẽ trả về không có ngón tay
```

### 6.4 Sinh tín hiệu — khi `finger = 1`

Mô phỏng sóng PPG quang học:

**Sóng mang (pulse wave):**
```c
float freq = adjusted_bpm / 60.0f;
chip->phase += 2π × freq × 0.01f;  // 0.01 = 1/100Hz (sample rate)

// Half-rectified sine, sharpened để giống PPG thực
float wave = powf((sinf(phase) + 1.0f) * 0.5f, 1.5f);
```

**Tín hiệu IR và Red:**
```c
float ir_dc  = 150000.0f;  // DC baseline IR
float red_dc = 140000.0f;  // DC baseline Red (thấp hơn do hấp thụ máu)
float ir_ac  = 6000.0f;    // Biên độ AC IR (~4% DC — sinh lý bình thường)

// SpO2 mapping theo Beer-Lambert:
// SpO2=100 → ratio=0.40 (ít hấp thụ đỏ)
// SpO2=80  → ratio=0.70 (nhiều hấp thụ đỏ)
float ratio  = 0.4f + (100.0f - spo2) * 0.03f;
float red_ac = ir_ac × ratio × (red_dc / ir_dc);

float ir  = ir_dc  + wave × ir_ac  + noise;  // noise ±25 LSB
float red = red_dc + wave × red_ac + noise;
```

**FIFO 32 entries, sample rate 100 Hz (10 ms/sample):**

```c
// Đóng gói 6 bytes theo datasheet MAX30102 (MSB first):
// [Red: 3 bytes][IR: 3 bytes]
sample[0] = (red_val >> 16) & 0xFF;
sample[1] = (red_val >> 8)  & 0xFF;
sample[2] =  red_val        & 0xFF;
sample[3] = (ir_val >> 16)  & 0xFF;
sample[4] = (ir_val >> 8)   & 0xFF;
sample[5] =  ir_val         & 0xFF;
```

### 6.5 Giao thức I²C

Custom chip xử lý I²C theo đúng datasheet MAX30102:

```
WRITE (chọn register):
    on_i2c_write(reg_addr) → register_selected = true
    on_i2c_write(data)     → registers[reg] = data; reg++

READ:
    REG_PART_ID (0xFF)   → 0x15  (MAX30102 Part ID)
    REG_FIFO_WR_PTR      → gọi update_fifo(), trả về write pointer
    REG_FIFO_RD_PTR      → read pointer hiện tại
    REG_FIFO_DATA (0x07) → byte tiếp theo từ FIFO (tự advance sau 6 bytes)
    REG khác             → registers[reg]
```

### 6.6 Chuyển đổi Simulation ↔ Thiết bị thật

Toàn bộ sự khác biệt được kiểm soát bởi một macro duy nhất:

```cpp
// src/main.cpp — dòng 21
#define WOKWI_SIM   // có: chạy Wokwi | không có (comment out): thiết bị thật
```

| Phần | `WOKWI_SIM` bật | `WOKWI_SIM` tắt |
|---|---|---|
| WiFi SSID | `"Wokwi-GUEST"`, no password | `"dhung"` + password |
| NTP server | IP tĩnh `103.70.12.61` | `pool.ntp.org` |
| Weather API | HTTP tới IP proxy `15.235.222.68` | HTTPS tới `api.openweathermap.org` |
| TFT | Vẽ thêm border cyan 1px (debug visual) | Không border |
| Sensor loop | `delay(10)` giữa các mẫu | Không delay |

---

## 7. Backend API

**Thư mục:** `backend/`  
**Runtime:** Python 3.12, FastAPI 0.115, Uvicorn  
**Cổng:** `8000` nội bộ Docker, expose ra host qua `API_PORT`

### 7.1 Endpoint

| Method | Path | Mô tả | Response |
|---|---|---|---|
| `POST` | `/api/v1/metrics` | Nhận reading từ ESP32 | `202 Accepted` |
| `POST` | `/api/v1/connect` | Handshake thiết bị, long-poll tối đa 5 phút | `200 approved / 403 denied / 408 timeout` |
| `GET` | `/api/v1/devices` | Danh sách thiết bị trong registry | `200 [DeviceRecord]` |
| `POST` | `/api/v1/devices/{id}/decision` | Operator phê duyệt/từ chối | `200 / 404` |
| `POST` | `/api/v1/chat` | Trợ lý AI Gemini | `200 {"text": "..."}` |
| `GET` | `/health` | Liveness probe | `200 {"status":"ok"}` |

### 7.2 Xác thực payload — Pydantic HealthMetric

```python
class HealthMetric(BaseModel):
    device_id: str
    timestamp: datetime          # ISO 8601
    heartrate: float             # validator: 30 ≤ HR ≤ 220
    spO2: float                  # validator: 70 ≤ SpO2 ≤ 100
```

Request tới `/metrics` bị từ chối với `422 Unprocessable Entity` nếu:
- `heartrate` < 30 hoặc > 220 BPM
- `spO2` < 70 hoặc > 100 %

Bị từ chối với `403 Forbidden` nếu thiết bị chưa được `APPROVED` trong registry.

### 7.3 Registry thiết bị — `registry.py`

In-memory, hỗ trợ **một thiết bị active tại một thời điểm**. Mỗi lần ESP32 gọi `/connect`, record cũ bị ghi đè hoàn toàn.

```python
@dataclass
class DeviceRecord:
    device_id:  str
    status:     DeviceStatus    # PENDING | APPROVED | DENIED
    first_seen: datetime
    decided_at: datetime | None
    event:      asyncio.Event   # được set khi operator ra quyết định
```

**`register_pending(device_id)`** — tạo record mới `PENDING`, thay thế bất kỳ record nào trước đó.

**`decide(device_id, approved)`** — cập nhật status thành `APPROVED` hoặc `DENIED`, ghi `decided_at`, gọi `event.set()` để giải phóng request `/connect` đang chờ.

**`get_status(device_id)`** — trả về `None` nếu không phải thiết bị hiện tại (quyết định lỗi thời sẽ nhận `404`).

### 7.4 Luồng phê duyệt thiết bị

```
ESP32 POST /connect
    │
    ├─ register_pending() → DeviceRecord(status=PENDING, event=Event())
    ├─ publish_approval_request() → RabbitMQ → WS Gateway → Dashboard
    └─ await record.event.wait(timeout=300s)   ← HTTP giữ mở

Dashboard hiện DeviceApprovalModal
    │
    └─ Operator Accept/Deny
         POST /devices/{id}/decision {"approved": true}
             │
             └─ decide() → event.set()
                    │
                    └─ /connect giải phóng → trả về "approved"/"denied" cho ESP32
```

### 7.5 Messaging — `messaging.py`

```python
async def publish_fanout(body: bytes) -> None:
    # Mỗi lần gọi: mở kết nối → khai báo exchange → publish PERSISTENT → đóng
    # Phù hợp throughput thấp; không cần connection pooling ở tần suất vài giây/lần
```

**`publish_approval_request(device_id)`** — publish `{"type":"device_approval_request","device_id":"..."}`. Lỗi được bắt và log mà không raise — thất bại broadcast không chặn handshake ESP32.

---

## 8. Message Broker — RabbitMQ

**Image:** `rabbitmq:3.13-management-alpine`  
**Cổng:** `5672` (AMQP), `15672` (management UI)

### 8.1 Topology

```
Backend API
    │ publish
    ▼
health_metrics_fanout  (Fanout Exchange, durable)
    │
    ├──► health_metrics  (durable queue)     → Stream Processor
    └──► ""              (exclusive queue)   → WebSocket Gateway
```

**Fanout Exchange** — mỗi message được sao chép đến tất cả queue đang bind. Backend không cần biết có bao nhiêu consumer.

| Queue | Kiểu | Hành vi khi service restart |
|---|---|---|
| `health_metrics` | durable | Tồn tại, tích lũy message cho đến khi consumer reconnect |
| ẩn danh (exclusive) | auto-delete | Tự xóa, không tích lũy message cũ — WS Gateway luôn nhận dữ liệu mới nhất |

### 8.2 Tại sao fanout thay vì direct/topic?

Với fanout, thêm consumer mới (ví dụ: ML alert service, audit logger) chỉ cần bind thêm một queue — không cần thay đổi code Backend API. Direct/topic exchange sẽ yêu cầu Backend biết routing key của từng consumer.

---

## 9. Stream Processor

**Thư mục:** `stream-processor/`  
**Runtime:** Python 3.12, asyncio, aio-pika  
**Vai trò:** Worker chạy nền — không có HTTP server

### 9.1 Luồng xử lý

```
RabbitMQ message
    │
    ├─ Có trường "type" (device_approval_request) → bỏ qua
    │
    └─ Metric message → process(payload)
            │
            ├─ Thêm vào deque[device_id] (maxlen = 10)
            ├─ heartrate_avg = mean(deque_hr)
            ├─ spo2_avg      = mean(deque_spo2)
            ├─ alert_low_spo2        = spo2_avg < 92.0
            └─ alert_high_heartrate  = heartrate_avg > 120.0
                    │
                    └─ write(ProcessedMetric) → InfluxDB
```

### 9.2 Tại sao dùng moving average cho cảnh báo?

Tín hiệu PPG từ cảm biến đeo tay có thể nhiễu do cử động tay (motion artifact). Một reading sai đơn lẻ (HR = 150 BPM do giật tay) không nên kích hoạt cảnh báo. Moving average window = 10 readings làm mịn nhiễu ngắn hạn — cảnh báo chỉ phát khi xu hướng kéo dài.

**Ngưỡng cảnh báo:**

| Cảnh báo | Điều kiện | Ý nghĩa lâm sàng |
|---|---|---|
| `alert_high_heartrate` | `heartrate_avg > 120 BPM` | Tachycardia khi nghỉ ngơi |
| `alert_low_spo2` | `spo2_avg < 92 %` | Ngưỡng hypoxemia nhẹ |

### 9.3 InfluxDB schema

```
Measurement:  health_metrics
Tag:          device_id = "ESP32_ID_7423"
Fields:       heartrate             (float)
              spo2                  (float)
              heartrate_avg         (float)
              spo2_avg              (float)
              alert_low_spo2        (bool)
              alert_high_heartrate  (bool)
Timestamp:    do thiết bị báo cáo, UTC, độ chính xác nanosecond
```

### 9.4 Khởi động với retry

Stream Processor thử kết nối RabbitMQ tối đa **10 lần**, chờ 5 giây giữa các lần — xử lý race condition khi container stream-processor start trước khi cổng AMQP của RabbitMQ sẵn sàng. `prefetch_count = 10` cho phép xử lý tối đa 10 message song song.

---

## 10. WebSocket Gateway

**Thư mục:** `websocket-gateway/`  
**Runtime:** Python 3.12, FastAPI, aio-pika  
**Cổng:** `8080` nội bộ Docker

### 10.1 Kiến trúc

```
[RabbitMQ] ──consume_loop()──► [ConnectionManager] ──broadcast()──► [Browsers]
              background task       _all: set[WS]
                                    _by_device: dict[str, set[WS]]
```

`consume_loop()` chạy như background asyncio task khi app khởi động. Dùng `connect_robust` của aio-pika — tự động reconnect RabbitMQ khi mất kết nối.

### 10.2 Endpoints WebSocket

| Endpoint | Mô tả |
|---|---|
| `WS /ws` | Đăng ký nhận tất cả thiết bị — vào `_all` |
| `WS /ws/{device_id}` | Đăng ký nhận từ một thiết bị cụ thể — vào `_by_device[device_id]` |

### 10.3 Broadcast logic

```python
async def broadcast(payload: dict):
    targets = _all | _by_device.get(payload.get("device_id"), set())
    dead = set()
    for ws in targets:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            dead.add(ws)  # kết nối chết — xóa im lặng
    for ws in dead:
        disconnect(ws)
```

Queue exclusive tự xóa khi gateway dừng — không tích lũy message cũ, Dashboard luôn nhận dữ liệu hiện tại khi reconnect.

---

## 11. Dashboard

**Thư mục:** `dashboard/`  
**Runtime:** Node.js 24, Next.js 16, React 19  
**Cổng:** `3000` nội bộ Docker

### 11.1 Kiến trúc state

```
WebSocket (useMetricsStream)
    │
    ├─► devices: Map<deviceId, DeviceData>
    │     ├─ points[60]      : MetricPoint[]   ← 60 điểm cuối cho biểu đồ
    │     ├─ latest          : { heartrate, spO2, heartrate_avg, spo2_avg }
    │     ├─ alertHighHr     : boolean         ← từ stream processor
    │     ├─ alertLowSpo2    : boolean
    │     └─ status          : 'normal' | 'elevated' | 'low'
    │
    └─► pendingApprovals: string[]    ← device_id chờ operator phê duyệt

useAlerts(devices)
    └─► alerts[]    ← chỉ tạo mới khi cờ chuyển false → true (edge detection)
```

### 11.2 `useMetricsStream` — Hook WebSocket

```typescript
// Khi nhận message từ WebSocket:
if (msg.type === 'device_approval_request') {
    // Thêm device_id vào pendingApprovals → hiện DeviceApprovalModal
} else {
    // Parse metric, convert timestamp sang Asia/Ho_Chi_Minh
    // Append vào points[], giữ 60 điểm cuối (window sliding)
    // Cập nhật latest, alert flags, status
}

// Reconnect sau 2 giây nếu mất kết nối
```

**`deriveStatus(heartrate, spO2, backendStatus)`** — ưu tiên status từ backend (do stream processor tính); nếu không, suy ra từ ngưỡng HR > 120 hoặc SpO2 < 92.

### 11.3 `useAlerts` — Edge Detection

```typescript
// Mỗi lần devices thay đổi:
for (device of devices) {
    const prev = prevRef.current.get(device.id);
    
    if (!prev?.alertHighHr && device.alertHighHr) {
        createAlert('high_hr', device.latest.heartrate);
    }
    if (!prev?.alertLowSpo2 && device.alertLowSpo2) {
        createAlert('low_spo2', device.latest.spO2);
    }
}
prevRef.current = snapshot(devices);
```

Cảnh báo chỉ tạo một lần tại thời điểm cờ chuyển `false → true`, không phát lại mỗi reading.

### 11.4 Các tab và component

| Tab | Component chính | Nội dung |
|---|---|---|
| **Home** | `HomeSection` | HR/SpO2 realtime, biểu đồ trực tiếp, cảnh báo inline, Daily Summary, HealthInsights |
| **Trends** | `TrendsSection` | Lịch sử HR và SpO2 toàn phiên qua Recharts |
| **Alerts** | `AlertsSection` | Lịch sử cảnh báo — dismiss từng cái hoặc xóa tất cả |
| **Chat** | `ChatSection` | AI chat gửi kèm snapshot sức khỏe hiện tại |
| **Profile** | `ProfileSection` | Thống kê phiên, thông tin thiết bị |

**Các component quan trọng:**

| Component | Vai trò |
|---|---|
| `ConnectionBar` | Device ID, chỉ báo chất lượng kết nối, thời gian cập nhật cuối |
| `HeartRateCard` | BPM hiện tại + biểu đồ đường realtime (Recharts) |
| `SpO2Card` | SpO2% hiện tại + biểu đồ đường realtime |
| `AlertBanner` | Banner inline khi `alertHighHr` hoặc `alertLowSpo2` đang active |
| `DailySummary` | HR trung bình, SpO2 trung bình, số lần đo trong phiên |
| `DeviceApprovalModal` | Modal overlay khi có thiết bị mới chờ phê duyệt |

### 11.5 Lưu ý build

Biến `NEXT_PUBLIC_*` được **nhúng vào JavaScript bundle tại thời điểm build**, không phải runtime. Thay đổi URL WebSocket hoặc API URL đòi hỏi rebuild image:

```bash
docker compose up -d --build dashboard
```

---

## 12. Trí Tuệ Nhân Tạo

**Model:** Google Gemini 2.5 Flash Lite  
**Endpoint:** `POST /api/v1/chat`

### 12.1 Context-aware chat

Mỗi lượt chat gửi kèm `HealthContext` — snapshot chỉ số thực tế của người dùng:

```typescript
interface HealthContext {
    deviceId:         string
    heartrate:        number     // reading hiện tại
    spO2:             number
    status:           string     // 'normal' | 'elevated' | 'low'
    alertHighHr:      boolean
    alertLowSpo2:     boolean
    avgHr:            number     // trung bình phiên
    avgSpO2:          number
    sessionReadings:  number     // tổng số lần đo
}
```

### 12.2 System prompt

`_system_prompt(ctx)` tạo instruction cho Gemini bao gồm:
- Chỉ số sinh hiệu hiện tại và trung bình phiên
- Mô tả cảnh báo đang active kèm ngưỡng kích hoạt
- Vai trò: trợ lý sức khỏe tổng quát, **không chẩn đoán bệnh, không kê đơn thuốc**

### 12.3 Luồng xử lý

```
Dashboard ChatSection
    │
    ├─ messages: lịch sử hội thoại (role: user | assistant)
    └─ context:  HealthContext (snapshot realtime)
         │
         ▼
POST /api/v1/chat
    │
    ├─ _build_history(messages[:-1]) → Gemini contents format
    │  (bỏ qua lượt đầu nếu là assistant — Gemini yêu cầu user turn đầu tiên)
    │
    ├─ POST Gemini REST API (httpx.AsyncClient, timeout 30s)
    │  endpoint: gemini-2.5-flash-lite:generateContent
    │  system_instruction: _system_prompt(ctx)
    │
    └─ Trả về text của candidate[0]
```

---

## 13. Hạ Tầng và Triển Khai

### 13.1 Docker Compose stack

```
docker-compose.yml
├── backend           mem: 128 MB (reserve 64 MB)
├── websocket-gateway mem: 128 MB (reserve 64 MB)
├── stream-processor  mem: 128 MB (reserve 64 MB)
├── dashboard         mem: 256 MB (NODE_OPTIONS=--max-old-space-size=224)
├── rabbitmq          mem: 256 MB (reserve 128 MB)
└── influxdb          mem: 384 MB (reserve 192 MB)
```

### 13.2 Routing Nginx (host, systemd)

```
health.dhunggg.io.vn/          →  Dashboard         :3000
health.dhunggg.io.vn/ws        →  WebSocket Gateway :8082  (Upgrade: websocket)
health-api.dhunggg.io.vn/      →  Backend API       :8081
```

Nginx chạy trực tiếp trên host VM (không dockerise) để xử lý TLS termination qua Certbot và forward đến các container theo port.

### 13.3 Biến môi trường

| Biến | Dùng bởi | Mô tả |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | dashboard (build-time) | URL WebSocket phía browser |
| `NEXT_PUBLIC_API_URL` | dashboard (build-time) | URL API phía browser |
| `GEMINI_API_KEY` | backend | Google Gemini API key |
| `INFLUXDB_TOKEN` | stream-processor, influxdb | Token admin InfluxDB |
| `INFLUXDB_ORG` | stream-processor, influxdb | Organisation `iot` |
| `INFLUXDB_BUCKET` | stream-processor, influxdb | Bucket `health_metrics` |
| `RABBITMQ_URL` | backend, gateway, processor | Chuỗi kết nối AMQP |
| `TZ` | tất cả | `Asia/Ho_Chi_Minh` |

### 13.4 Khởi động lần đầu

```bash
# 1. Thêm swap (bắt buộc để build Next.js trên VM ≤ 2 GB RAM)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 2. Cấu hình môi trường
cp .env.example .env
# Điền: INFLUXDB_TOKEN, GEMINI_API_KEY, NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_API_URL

# 3. Build và khởi động toàn bộ stack
docker compose up -d --build

# 4. Cấu hình nginx + HTTPS
sudo cp nginx/*.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/*.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d health.dhunggg.io.vn -d health-api.dhunggg.io.vn
sudo systemctl reload nginx
```

> `INFLUXDB_INIT_MODE=setup` chỉ chạy lần đầu tiên. InfluxDB tự phát hiện bolt file đã tồn tại ở các lần khởi động sau.

---

## 14. Luồng Dữ Liệu End-to-End

### 14.1 Luồng metric hoàn chỉnh (từ ngón tay đến màn hình)

```
① [Người dùng đặt ngón tay lên MAX30102]
       │ LED đỏ + IR xuyên qua mô, photodetector thu phản xạ
       ▼
② [ESP32: thu 100 mẫu × 10 lần đo]
       │ I²C 400 kHz, 100 samples/giây, FIFO 32 entries
       ▼
③ [Maxim MAXREFDES117 algorithm]
       │ DC removal → 4-pt MA → valley detection → HR
       │ AC/DC ratio → median → SpO2 = 103 - 17R
       │ Lọc: HR ∈ (40,180), SpO2 ∈ (80,100]
       ▼
④ [Hiển thị lên ST7789 TFT]  ←────────────────────────────────┐
       │ dirty-region update                                    │
       ▼                                                        │
⑤ [HTTPS POST /api/v1/metrics]                                  │
       │ {"device_id","timestamp","heartrate","spO2"}           │
       ▼                                                        │
⑥ [FastAPI — Backend]                                           │
       │ Pydantic validate HR∈[30,220], SpO2∈[70,100]          │
       │ Kiểm tra device_id = APPROVED                         │
       ▼                                                        │
⑦ [RabbitMQ Fanout Exchange]                                    │
       │                                                        │
       ├─────────────────────────┐                             │
       ▼                         ▼                             │
⑧ [WebSocket Gateway]    ⑨ [Stream Processor]                  │
       │ broadcast JSON          │ moving average (window=10)  │
       │ thô đến browser         │ alert_low_spo2  (<92%)      │
       ▼                         │ alert_high_hr   (>120 BPM)  │
⑩ [Dashboard — useMetricsStream] │ write InfluxDB              │
       │ append points[]         ▼                             │
       │ giữ 60 điểm      ⑪ [InfluxDB time-series]             │
       │ cập nhật status         health_metrics measurement     │
       ▼                                                        │
⑫ [React re-render]                                             │
       HeartRateCard, SpO2Card ──────────────────────────────────┘
       AlertBanner (nếu cờ lên)
       DailySummary (avg session)
```

### 14.2 Luồng phê duyệt thiết bị (một lần khi ESP32 khởi động)

```
① ESP32 POST /api/v1/connect {"device_id":"ESP32_ID_7423","connection":"request"}
       │
② FastAPI: register_pending() → DeviceRecord(PENDING, asyncio.Event)
       │
③ FastAPI: publish {"type":"device_approval_request","device_id":"ESP32_ID_7423"}
       │
④ RabbitMQ → WS Gateway → Dashboard WebSocket
       │
⑤ Dashboard: pendingApprovals.push("ESP32_ID_7423")
       │       → DeviceApprovalModal hiện ra
       │
⑥ Operator nhấn "Accept"
       │       POST /api/v1/devices/ESP32_ID_7423/decision {"approved":true}
       │
⑦ FastAPI: decide() → status=APPROVED, event.set()
       │
⑧ /connect giải phóng → ESP32 nhận {"connection":"approved"}
       │
⑨ ESP32 vào loop() chính — bắt đầu đo và gửi metric
```

### 14.3 Luồng mất kết nối WiFi và tự phục hồi

```
loop() phát hiện WiFi.status() != WL_CONNECTED
    │
    ├─ Reset: server_connection=false, prev_*="", hr=0, spo2=0
    ├─ Hiển thị "Wifi disconnected!" lên TFT
    ├─ WiFi.begin() → chờ kết nối lại (blocking)
    ├─ Sau khi WiFi reconnect: đăng ký lại server (do /connect long-poll)
    └─ tft_init_ui() → tiếp tục vòng lặp bình thường
```
