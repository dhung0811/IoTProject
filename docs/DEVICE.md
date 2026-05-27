# IoT Health Monitoring — Tài Liệu Kỹ Thuật Thiết Bị (ESP32 Firmware)

> **Phạm vi:** Firmware ESP32-C3 đọc dữ liệu sinh trắc từ cảm biến MAX30102, hiển thị lên màn hình TFT và gửi lên server qua HTTPS.

---

## Mục Lục

1. [Phần Cứng & Pinout](#1-phần-cứng--pinout)
2. [Cấu Trúc Dự Án](#2-cấu-trúc-dự-án)
3. [Luồng Hoạt Động](#3-luồng-hoạt-động)
4. [Pipeline Đọc Cảm Biến](#4-pipeline-đọc-cảm-biến)
5. [Thuật Toán SpO2 / Heart Rate](#5-thuật-toán-spo2--heart-rate)
6. [Hiển Thị TFT](#6-hiển-thị-tft)
7. [Giao Tiếp Server](#7-giao-tiếp-server)
8. [Mô Phỏng Wokwi — Custom Chip MAX30102](#8-mô-phỏng-wokwi--custom-chip-max30102)
9. [Chuyển Đổi Simulation ↔ Thiết Bị Thật](#9-chuyển-đổi-simulation--thiết-bị-thật)
10. [Build & Nạp Firmware](#10-build--nạp-firmware)

---

## 1. Phần Cứng & Pinout

### Thành phần

| Thành phần | Model | Vai trò |
|---|---|---|
| Vi điều khiển | ESP32-C3 Super Mini | Xử lý, WiFi, điều phối |
| Cảm biến sinh trắc | MAX30102 | Đo nhịp tim (HR) và SpO2 qua PPG |
| Màn hình | ST7789 240×240 IPS | Hiển thị đồng hồ, thời tiết, chỉ số |

### SPI — Màn hình ST7789

| ESP32-C3 GPIO | Chân ST7789 | Ghi chú |
|---|---|---|
| GPIO 4 | SCK | SPI clock |
| GPIO 6 | MOSI | SPI data out |
| GPIO 5 | MISO | Không dùng (one-way display) |
| GPIO 7 | CS | `TFT_CS` — chip select |
| GPIO 3 | RST | `TFT_RST` — hardware reset |
| GPIO 2 | DC | `TFT_DC` — data/command select |
| 3.3V | VCC + LED | Nguồn và backlight |
| GND | GND | — |

SPI speed: **80 MHz** (`tft.setSPISpeed(80000000)`)

### I²C — Cảm biến MAX30102

| ESP32-C3 GPIO | Chân MAX30102 | Ghi chú |
|---|---|---|
| GPIO 8 | SDA | I²C data (`Wire.begin(8, 9)`) |
| GPIO 9 | SCL | I²C clock |
| 3.3V | VIN | Nguồn |
| GND | GND | — |

I²C speed: **Fast mode 400 kHz** (`I2C_SPEED_FAST`)  
I²C address: `0x57`

---

## 2. Cấu Trúc Dự Án

```
Devcies/
├── src/
│   └── main.cpp              # Entry point — khai báo biến, setup(), loop()
├── include/
│   ├── main.h                # Toàn bộ logic: TFT, sensor, HTTP (included sau khai báo biến)
│   ├── weather_API.h         # getDailyWeatherIcon() — gọi OpenWeatherMap
│   ├── heart_data.h          # Bitmap icon trái tim RGB565 (32×32)
│   ├── spo2_data.h           # Bitmap icon SpO2 RGB565 (32×32)
│   ├── i01d_data.h           # Bitmap icon thời tiết: clear sky day
│   ├── i01n_data.h           #   clear sky night
│   ├── i02d/n, i03..i50      #   (các icon còn lại tương tự)
│   ├── FreeSerif9pt7b.h      # Font serif 9pt — label, ngày tháng
│   ├── GT_Pressura_Mono_Light12pt7b.h  # Font mono 12pt — đơn vị %, bpm
│   ├── GT_Pressura_Mono_Light20pt7b.h  # Font mono 20pt — giá trị HR / SpO2
│   └── GT_Pressura_Mono_Light30pt7b.h  # Font mono 30pt — giờ (HH)
├── lib/                      # Thư viện vendor (không dùng PlatformIO registry)
│   ├── SparkFun_MAX3010x_Sensor/   # Driver MAX30102 + thuật toán Maxim
│   ├── Adafruit_ST7735_and_ST7789/ # Driver TFT
│   ├── Adafruit_GFX/               # Primitives: text, bitmap, shapes
│   ├── Adafruit_BusIO/             # I²C/SPI abstraction (dep của Adafruit)
│   └── Arduino_JSON/               # JSON parse (dùng cJSON nội bộ)
├── chip.c                    # Mã nguồn custom Wokwi chip (MAX30102 giả lập)
├── chip.wasm                 # chip.c đã biên dịch sang WebAssembly
├── chip.json                 # Khai báo pins + controls của custom chip
├── diagram.json              # Sơ đồ mạch Wokwi (ESP32-C3 + ILI9341 + chip-max_30102)
├── wokwi.toml                # Config Wokwi: firmware path, port forwarding
└── platformio.ini            # Build config: board esp32-c3-devkitm-1, framework arduino
```

> **Lưu ý kiến trúc:** `main.h` được include **sau** khi tất cả biến toàn cục đã được khai báo trong `main.cpp`. Các hàm trong `main.h` dùng trực tiếp những biến đó mà không cần truyền tham số — đây là pattern deliberate để tránh overhead trên embedded.

---

## 3. Luồng Hoạt Động

### `setup()` — Khởi Động Tuần Tự (Blocking)

```
Serial.begin(115200)
        │
        ▼
Wire.begin(8, 9) → particleSensor.begin()  ← I²C FAST 400kHz
        │         particleSensor.setup(...)  ← cấu hình LED, ADC, FIFO
        ▼
tft.init(240, 240) → tft_setup()            ← xoá màn hình, hiển thị "Connecting to WiFi"
        │
        ▼
WiFi.begin(ssid, password)
while (status != WL_CONNECTED) delay(500)   ← BLOCKING
        │
        ▼
configTime(7*3600, 0, ntpServer)
while (!getLocalTime(&timeinfo)) delay(500) ← BLOCKING
        │
        ▼
do { server_setup() }
while (server_connection == false)          ← BLOCKING, retry mỗi 2 phút nếu bị từ chối
        │
        ▼
tft_init_ui()                               ← vẽ layout cố định
```

### `loop()` — Vòng Lặp Chính

```
WiFi connected?
    │
    ├─ NO ──► reset trạng thái → reconnect WiFi (blocking)
    │                          → đăng ký lại server (blocking)
    │                          → tft_init_ui()
    │
    └─ YES
         │
         ├─ millis() - lastClockUpdate ≥ 60s  (hoặc lần đầu, min_count=60)
         │       └─► tft_clock(getDailyWeatherIcon())   ← gọi API thời tiết + cập nhật màn hình
         │
         ├─ get_sensor_data()
         │       ├─ IR < 50000: không có ngón tay → return ngay
         │       └─ IR ≥ 50000: đo 10 lần × 100 mẫu (blocking ~1–10 giây)
         │               └─ valid_data = true nếu có kết quả hợp lệ
         │
         ├─ valid_data == true
         │       ├─► tft_sensor_disp(hr, spo2)   ← cập nhật vùng giá trị trên màn hình
         │       └─► pkt2server(hr, spo2)         ← HTTP POST lên /api/v1/metrics
         │
         ├─ showingMeasurement && millis() - lastValidDataTime ≥ 5000
         │       └─► hiển thị "--" (reset về trạng thái chờ)
         │
         └─ delay(10)
```

---

## 4. Pipeline Đọc Cảm Biến

### Cấu Hình MAX30102

```cpp
byte ledBrightness = 50;   // ~10 mA, đủ cho ngón tay người lớn
byte sampleAverage = 1;    // Không average, lấy raw từng sample
byte ledMode = 2;           // Chế độ Red + IR (cần cả 2 cho SpO2)
byte sampleRate = 100;      // 100 samples/giây
int  pulseWidth = 69;       // 69 µs — pulse ngắn nhất, giảm power
int  adcRange = 4096;       // ADC 18-bit full range

particleSensor.setPulseAmplitudeRed(0x1F);  // ~6.2 mA
particleSensor.setPulseAmplitudeIR(0x1F);   // ~6.2 mA
```

### `get_sensor_data()` — Chi Tiết Từng Bước

**Bước 1 — Phát hiện ngón tay**

```cpp
long irValue = particleSensor.getIR();
if (irValue < 50000) {
    // Không có ngón tay: IR ambient rất thấp (thường < 1000 khi không đặt tay)
    // Ngưỡng 50000 tương đương ~30% ADC range, đủ để phân biệt
    finger_present = false;
    measurement_done = false;
    return;
}
```

**Bước 2 — Thu thập mẫu (10 lần đo, mỗi lần 100 mẫu)**

```cpp
for (int measure = 0; measure < 10; measure++) {
    bufferLength = BUFFER_SIZE; // = 100 samples

    for (byte i = 0; i < bufferLength; i++) {
        // Chờ sample mới với timeout 1000ms
        while (!particleSensor.available()) {
            particleSensor.check();
            if (millis() - start > 1000) { valid_data = false; return; }
        }
        redBuffer[i] = particleSensor.getRed();
        irBuffer[i]  = particleSensor.getIR();
        particleSensor.nextSample(); // xoá sample khỏi FIFO
    }

    // Tính toán sau mỗi 100 mẫu
    maxim_heart_rate_and_oxygen_saturation(...);
}
```

> `BUFFER_SIZE = FreqS × 4 = 25 × 4 = 100` — đủ dữ liệu cho ~4 giây ở tần số xử lý 25 Hz.

**Bước 3 — Lọc kết quả hợp lệ**

Sau 10 lần đo, chỉ giữ lại kết quả **mới nhất** thỏa mãn đồng thời 4 điều kiện:

| Điều kiện | Ý nghĩa |
|---|---|
| `validHeartRate == 1` | Thuật toán tìm đủ đỉnh sóng để tính HR |
| `validSPO2 == 1` | Tỉ lệ AC/DC nằm trong dải cho phép (2–184) |
| `heartRate_calc ∈ (40, 180)` | Loại giá trị sinh lý bất khả thi |
| `spo2_calc ∈ (80, 100]` | Loại giá trị ngoài dải sinh lý |

```cpp
// Chỉ cập nhật nếu hợp lệ — KHÔNG lấy average, chỉ lấy giá trị cuối cùng valid
if (validHeartRate && validSPO2 && hr > 40 && hr < 180 && spo2 > 80 && spo2 <= 100) {
    hr    = heartRate_calc;
    spo2  = spo2_calc;
    final_valid = true;
}
```

**Bước 4 — One-shot per placement**

```cpp
if (final_valid) {
    valid_data = true;
    measurement_done = true;  // Không đo lại cho đến khi nhấc ngón tay
}
```

Một lần đặt ngón tay → tối đa một lần gửi dữ liệu lên server.

---

## 5. Thuật Toán SpO2 / Heart Rate

Thuật toán **Maxim MAXREFDES117** (bản quyền Maxim Integrated, 2016) — triển khai trong `lib/SparkFun_MAX3010x_Sensor/src/spo2_algorithm.cpp`.

### Pipeline Tính HR

```
irBuffer[100]
    │
    ▼  (1) Tính DC mean: un_ir_mean = sum(irBuffer) / 100
    │
    ▼  (2) Loại DC + đảo tín hiệu: an_x[k] = -(irBuffer[k] - un_ir_mean)
    │      (đảo để dùng bộ phát hiện đỉnh thay cho thung lũng)
    │
    ▼  (3) Làm mượt: 4-point Moving Average
    │      an_x[k] = (an_x[k] + an_x[k+1] + an_x[k+2] + an_x[k+3]) / 4
    │
    ▼  (4) Tính ngưỡng thích nghi:
    │      n_th1 = mean(an_x), clamp vào [30, 60]
    │
    ▼  (5) Phát hiện đỉnh: maxim_find_peaks()
    │      — Tìm tất cả đỉnh > n_th1
    │      — Loại các đỉnh cách nhau < 4 samples (min_distance)
    │      — Giữ tối đa 15 đỉnh
    │
    ▼  (6) Tính HR từ khoảng cách trung bình giữa các đỉnh:
           n_peak_interval_sum = sum(interval[k]) / (n_peaks - 1)
           HR = (FreqS × 60) / n_peak_interval_sum
              = (25 × 60) / avg_interval
```

> Nếu tìm được < 2 đỉnh → `validHeartRate = 0`, `HR = -999`.

### Pipeline Tính SpO2

```
(Tiếp theo sau khi đã có valley locations từ bước HR)

irBuffer + redBuffer
    │
    ▼  (1) Với mỗi cặp valley liền kề [k, k+1]:
    │      - Tìm DC max của IR (n_x_dc_max) và Red (n_y_dc_max) giữa 2 valley
    │      - Tính AC component bằng cách trừ đường nền tuyến tính:
    │        n_x_ac = IR[peak] - linear_baseline_IR
    │        n_y_ac = Red[peak] - linear_baseline_Red
    │
    ▼  (2) Tính tỉ lệ R:
    │      ratio = (n_y_ac × n_x_dc_max) / (n_x_ac × n_y_dc_max)
    │      (nhân 100 để giữ nguyên số nguyên, tránh float)
    │
    ▼  (3) Lấy median của tối đa 5 giá trị ratio
    │      (bất biến trước nhiễu từng nhịp tim)
    │
    ▼  (4) Tra bảng lookup hoặc công thức tuyến tính:
           SpO2 = 103.0 - 17.0 × ratio_average / 100
           (áp dụng khi 2 < ratio_average < 184)
```

Công thức xấp xỉ bậc nhất `SpO2 ≈ 103 - 17R` là đơn giản hóa từ đường cong Beer–Lambert. Thư viện cũng có bảng lookup `uch_spo2_table[184]` nhưng phiên bản hiện tại dùng công thức tuyến tính.

> Nếu `ratio_average` ngoài khoảng (2, 184) → `validSPO2 = 0`, `SpO2 = -999`.

---

## 6. Hiển Thị TFT

### Bố Cục Màn Hình (240×240 px)

```
(0,0)─────────────────────────(239,0)
│  [Icon 60×60]    Thu          │  y: 2–80   — vùng thời tiết + ngày
│  thời tiết       27/05/2026   │
│                  Clear sky    │  y: 50–80  — tên thời tiết
│                               │
│         14   :   30           │  y: 79–135 — giờ (30pt cyan) : phút (20pt white)
│                               │
(0,140)────────────────────────(239,140)  ← đường kẻ ngang GREY
│    [spo2 icon] │ [heart icon] │  y: 144–165
│      SpO2      │    H.Rate    │  y: 160–170
│      98        │      76      │  y: 189–225 — giá trị 20pt
│       %        │     bpm      │  y: 210–225 — đơn vị 12pt
(0,239)─────────────────────────(239,239)
```

### Tối Ưu Vẽ Lại — Dirty Regions

`tft_clock()` so sánh với giá trị lần trước trước khi vẽ, tránh redraw toàn màn hình:

```cpp
void tft_clock(String icon_id) {
    // Chỉ xoá + vẽ lại phần bị thay đổi
    if (strcmp(hour_buf, prev_hour) != 0) {
        tft_clear(TFT_HOUR);          // fillRect(63, 79, 62, 55)
        // vẽ giờ mới
    }
    if (strcmp(minute_buf, prev_minute) != 0) {
        tft_clear(TFT_MIN);           // fillRect(127, 84, 50, 55)
        // vẽ phút mới
    }
    if (strcmp(day_buf, prev_day) != 0) {
        tft_clear(TFT_DAY);           // fillRect(106, 6, 90, 42)
        // vẽ ngày mới
    }
    if (icon_id != prev_weather) {
        tft_clear(TFT_WEATHER);       // fillRect(2,2,100,80) + fillRect(106,50,130,28)
        // vẽ icon + tên thời tiết mới
    }
}
```

Các vùng dirty region `tft_clr_t`:

| Scope | Vùng xoá | Khi nào |
|---|---|---|
| `TFT_FULL` | Toàn màn hình | WiFi reconnect, setup |
| `TFT_HOUR` | `(63, 79, 62×55)` | Mỗi giờ |
| `TFT_MIN` | `(127, 84, 50×55)` | Mỗi phút |
| `TFT_DAY` | `(106, 6, 90×42)` | Mỗi ngày |
| `TFT_WEATHER` | `(2, 2, 100×80)` + `(106, 50, 130×28)` | Khi thay đổi icon |
| `TFT_SV` | `(20, 189, 68×36)` + `(126, 189, 68×36)` | Sau mỗi lần đo |

> Trong mode `WOKWI_SIM`, `tft_clear()` luôn vẽ thêm border cyan 1px quanh màn hình để xác nhận render đúng.

### Thời Tiết

Icon thời tiết là bitmap RGB565 được nhúng thẳng vào flash (`include/i01d_data.h`, v.v.). Mapping code OpenWeatherMap → icon:

| Code | Icon file | Mô tả |
|---|---|---|
| `01d` / `01n` | `i01d` / `i01n` | Clear sky |
| `02d` / `02n` | `i02d` / `i02n` | Few clouds |
| `03d`, `03n` | `i03` | Scattered clouds |
| `04d`, `04n` | `i04` | Broken clouds |
| `09d`, `09n` | `i09` | Shower rain |
| `10d` / `10n` | `i10d` / `i10n` | Rain |
| `11d`, `11n` | `i11` | Thunderstorm |
| `13d`, `13n` | `i13` | Snow |
| `50d`, `50n` | `i50` | Mist |

---

## 7. Giao Tiếp Server

### Định Danh Thiết Bị

```cpp
uint64_t device_id = ESP.getEfuseMac() % 10000;
// device_id_string = "ESP32_ID_" + String(device_id)
// Ví dụ: "ESP32_ID_7423"
```

`getEfuseMac()` trả về MAC address 48-bit được burned vào eFuse của chip — duy nhất mỗi ESP32. Modulo 10000 rút gọn thành 4 chữ số để dễ đọc (có thể trùng trong hệ thống lớn).

### Đăng Ký Thiết Bị — `server_setup()`

**Endpoint:** `POST https://health-api.dhunggg.io.vn/api/v1/connect`

```json
// Request
{
  "device_id": "ESP32_ID_7423",
  "connection": "request"
}

// Response — chấp thuận
{ "connection": "approved" }

// Response — từ chối
{ "connection": "denied" }
```

**Retry logic:**
```
POST /connect
    │
    ├─ "approved" ──► server_connection = true → tiếp tục
    │
    ├─ "denied"   ──► delay(120000ms = 2 phút) → thử lại
    │
    └─ HTTP error ──► không delay, thử lại ngay
```

Hàm này được gọi trong vòng `do...while` — **blocking hoàn toàn** cho đến khi được chấp thuận.

### Gửi Dữ Liệu — `pkt2server()`

**Endpoint:** `POST https://health-api.dhunggg.io.vn/api/v1/metrics`

```json
{
  "device_id": "ESP32_ID_7423",
  "timestamp": "2026-05-27T14:30:15+07:00",
  "heartrate": 76,
  "spO2": 98
}
```

- `timestamp`: định dạng ISO 8601, hardcoded timezone `+07:00` (UTC+7)
- `heartrate` và `spO2`: kiểu `int` (đã làm tròn từ thuật toán)
- Gọi sau mỗi lần đo thành công, tối đa một lần mỗi lần đặt ngón tay

**Lưu ý SSL:** Cả `server_setup()` và `pkt2server()` dùng `WiFiClientSecure` với `client.setInsecure()` — kết nối HTTPS nhưng không xác minh certificate server.

---

## 8. Mô Phỏng Wokwi — Custom Chip MAX30102

Wokwi không có chip MAX30102 built-in. Dự án tự xây một custom chip WebAssembly (`chip.c` → `chip.wasm`) giả lập đầy đủ giao thức I²C và tín hiệu PPG quang học.

### Giao Diện Điều Khiển

Khai báo trong `chip.json`, hiển thị dưới dạng slider trong UI Wokwi:

| Thuộc tính | Khoảng | Mặc định | Ý nghĩa |
|---|---|---|---|
| `finger` | 0–1 | 0 | 0 = không có ngón tay, 1 = có ngón tay |
| `beatAvg` | 40–180 BPM | 75 | Nhịp tim muốn giả lập |
| `spo2Avg` | 80–100 % | 98 | SpO2 muốn giả lập |

### Sinh Tín Hiệu — Khi `finger = 0`

Sinh nhiễu thấp để firmware nhận ra "không có ngón tay" (IR < 50.000):

```c
uint32_t ir_val  = 800 + (rand() % 200);   // ~800–1000, rất thấp
uint32_t red_val = 700 + (rand() % 200);   // ~700–900
```

### Sinh Tín Hiệu — Khi `finger = 1`

Mô phỏng sóng PPG thực tế (photoplethysmography):

**1. Sóng mang (pulse wave)**

```c
// Phase increment mỗi sample (100 Hz)
float freq = adjusted_bpm / 60.0f;
chip->phase += 2π × freq × 0.01f;     // 0.01 = 1/100Hz

// Half-rectified sine, sharpened
float wave = ((sinf(phase) + 1.0f) * 0.5f) ^ 1.5f;
// powf(x, 1.5) làm nhọn đỉnh, phẳng đáy — gần giống PPG thực
```

**2. Tín hiệu IR và Red**

```c
float ir_dc  = 150000.0f;     // DC offset IR (baseline mô phỏng mô hấp thụ)
float red_dc = 140000.0f;     // DC offset Red (thấp hơn vì máu hấp thụ đỏ nhiều hơn)
float ir_ac  = 6000.0f;       // Biên độ AC IR (~4% của DC, sinh lý học bình thường)

// SpO2 mapping: SpO2 cao → red_ac nhỏ (máu bão hòa oxy hấp thụ ít đỏ)
//               SpO2 thấp → red_ac lớn (máu thiếu oxy hấp thụ nhiều đỏ)
float ratio = 0.4f + (100.0f - spo2) * 0.03f;
// SpO2=100 → ratio=0.40,  SpO2=90 → ratio=0.70,  SpO2=80 → ratio=1.0 (clamp 0.8)
float red_ac = ir_ac × ratio × (red_dc / ir_dc);

float ir  = ir_dc  + wave × ir_ac;
float red = red_dc + wave × red_ac;

// Nhiễu ngẫu nhiên nhỏ ±25 LSB (~0.017% của DC)
ir  += ((rand() % 100) - 50) / 2.0f;
red += ((rand() % 100) - 50) / 2.0f;
```

**3. Đóng gói vào FIFO**

MAX30102 đóng gói mỗi sample dưới dạng 6 bytes (Red 3 bytes + IR 3 bytes, MSB first):

```c
sample[0] = (red_val >> 16) & 0xFF;
sample[1] = (red_val >> 8)  & 0xFF;
sample[2] =  red_val        & 0xFF;
sample[3] = (ir_val >> 16)  & 0xFF;
sample[4] = (ir_val >> 8)   & 0xFF;
sample[5] =  ir_val         & 0xFF;
```

FIFO có 32 slot (con trỏ 5-bit, mask `0x1F`). Sample được sinh mỗi 10ms (`SAMPLE_PERIOD = 10.000.000 ns`).

### Giao Thức I²C

Custom chip xử lý I²C theo đúng datasheet MAX30102:

```
WRITE (register select):
    on_i2c_connect() → on_i2c_write(reg_addr) → register_selected = true
    on_i2c_write(data) → registers[current_reg] = data; current_reg++

READ:
    on_i2c_connect() → on_i2c_read()
        - REG_PART_ID (0xFF) → trả về 0x15 (MAX30102 part ID)
        - REG_FIFO_WR_PTR  → gọi update_fifo() rồi trả về write pointer
        - REG_FIFO_DATA    → trả về từng byte từ FIFO, tự increment byte index
                             đọc đủ 6 byte → tự advance read pointer
        - các register khác → trả về registers[reg]
```

### Port Forwarding

`wokwi.toml` forward `localhost:8180` → `target:80`:

```toml
[[net.forward]]
from = "localhost:8180"
to = "target:80"
```

Trong `WOKWI_SIM`, weather API và server kết nối qua HTTP (không phải HTTPS) tới địa chỉ IP tĩnh. Wokwi Cloud proxy các request này ra internet thay mặt thiết bị giả lập.

---

## 9. Chuyển Đổi Simulation ↔ Thiết Bị Thật

Toàn bộ sự khác biệt được kiểm soát bởi một macro duy nhất trong `src/main.cpp`:

```cpp
#define WOKWI_SIM   // Có: chạy Wokwi. Không có (comment out): thiết bị thật
```

Ảnh hưởng của macro này:

| Phần | `WOKWI_SIM` bật | `WOKWI_SIM` tắt |
|---|---|---|
| WiFi SSID | `"Wokwi-GUEST"`, no password | `"dhung"` + password |
| NTP server | IP tĩnh `103.70.12.61`, `103.186.65.246`, `45.252.250.189` | `pool.ntp.org` |
| Weather API | HTTP tới IP `15.235.222.68` | HTTPS tới `api.openweathermap.org` |
| TFT | Vẽ border cyan 1px | Không border |
| Sensor loop | `delay(10)` sau mỗi sample | Không delay |

---

## 10. Build & Nạp Firmware

### Yêu Cầu

- [PlatformIO Core](https://docs.platformio.org/en/latest/core/index.html) hoặc VS Code + PlatformIO extension
- Board đích: ESP32-C3 Super Mini (compatible `esp32-c3-devkitm-1`)

### Chạy Simulation Wokwi

```bash
# 1. Đảm bảo #define WOKWI_SIM còn trong src/main.cpp

# 2. Build firmware
cd Devcies
pio run

# Output: .pio/build/esp32c3_supermini/firmware.bin
#         .pio/build/esp32c3_supermini/firmware.elf

# 3. Chạy Wokwi
#    VS Code: Ctrl+Shift+P → "Wokwi: Start Simulator"
#    CLI: wokwi-cli simulate --elf .pio/build/esp32c3_supermini/firmware.elf
```

### Nạp Lên Thiết Bị Thật

```bash
# 1. Comment out dòng #define WOKWI_SIM trong src/main.cpp

# 2. Cập nhật WiFi credentials trong src/main.cpp (dòng 28-29)

# 3. Build + upload
pio run --target upload

# 4. Monitor serial output
pio device monitor --baud 115200
```

### Serial Output Tham Khảo

Khi hoạt động bình thường, Serial Monitor sẽ in:

```
Initializing MAX30102...
Sensor ready
Connecting to WiFi....
WiFi Connected
Time synchronized!
Requesting connection...
{"device_id":"ESP32_ID_7423","connection":"request"}
HTTP Response: 200
Connection ACCEPTED

Time information: Wed 27/05/2026 14 30 icon: 01d
Weather Icon ID: 01d

Finger detected
Starting 10 measurements...
Measurement #1
HR=76 SPO2=98
...
================================
FINAL HR: 76
FINAL SPO2: 98
================================
Sending health data...
{"device_id":"ESP32_ID_7423","timestamp":"2026-05-27T14:30:15+07:00","heartrate":76,"spO2":98}
HTTP Response: 200
```
