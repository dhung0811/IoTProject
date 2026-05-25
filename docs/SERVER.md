# IoT Health Monitoring — Tài Liệu Kỹ Thuật Server

> **Phạm vi:** Chỉ bao gồm các dịch vụ backend và dashboard. Phần phần cứng (ESP32 + MAX30102) sẽ được tài liệu hoá riêng.

---

## Mục Lục

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Kiến Trúc](#2-kiến-trúc)
3. [Luồng Dữ Liệu](#3-luồng-dữ-liệu)
4. [Hạ Tầng](#4-hạ-tầng)
5. [Dịch Vụ: Backend API](#5-dịch-vụ-backend-api)
6. [Dịch Vụ: WebSocket Gateway](#6-dịch-vụ-websocket-gateway)
7. [Dịch Vụ: Stream Processor](#7-dịch-vụ-stream-processor)
8. [Dịch Vụ: Dashboard](#8-dịch-vụ-dashboard)
9. [Triển Khai](#9-triển-khai)
10. [Biến Môi Trường](#10-biến-môi-trường)

---

## 1. Tổng Quan Hệ Thống

Nền tảng theo dõi sinh trắc học thời gian thực:

- Nhận dữ liệu nhịp tim (BPM) và SpO2 từ cảm biến ESP32 qua HTTP
- Xác thực, kiểm duyệt thiết bị và đẩy dữ liệu lên message broker
- Xử lý và lưu trữ dữ liệu vào cơ sở dữ liệu chuỗi thời gian
- Truyền dữ liệu trực tiếp lên dashboard qua WebSocket
- Tích hợp trợ lý AI (Gemini) có ngữ cảnh sức khỏe theo thời gian thực

**Công nghệ sử dụng:**

| Tầng | Công nghệ |
|---|---|
| API tiếp nhận dữ liệu | FastAPI (Python 3.12) |
| Message Broker | RabbitMQ 3.13 |
| Xử lý luồng dữ liệu | Python async worker |
| Cơ sở dữ liệu chuỗi thời gian | InfluxDB 2.7 |
| WebSocket Gateway | FastAPI + aio-pika |
| Giao diện người dùng | Next.js 16 (React 19) |
| Container hoá | Docker Compose |
| Reverse Proxy | Nginx (systemd trên VM) |

---

## 2. Kiến Trúc

```
┌─────────────┐     POST /api/v1/metrics     ┌─────────────────┐
│  ESP32      │ ─────────────────────────────▶│  Backend API    │
│  Cảm biến   │                               │  (FastAPI :8000)│
└─────────────┘                               └────────┬────────┘
                                                       │ publish (AMQP)
                                                       ▼
                                              ┌─────────────────┐
                                              │    RabbitMQ     │
                                              │  Fanout Exchange│
                                              │ health_metrics  │
                                              │    _fanout      │
                                              └───────┬─────────┘
                                    ┌──────────────────┴───────────────────┐
                               (exclusive queue)                      (durable queue)
                                    ▼                                      ▼
                          ┌──────────────────┐                  ┌──────────────────┐
                          │ WebSocket Gateway│                  │ Stream Processor │
                          │  (FastAPI :8080) │                  │  (worker)        │
                          └────────┬─────────┘                  └────────┬─────────┘
                                   │ broadcast JSON                      │ ghi điểm dữ liệu
                                   ▼                                     ▼
                          ┌──────────────────┐                  ┌──────────────────┐
                          │    Trình duyệt   │                  │    InfluxDB      │
                          │ (WebSocket /ws)  │                  │    :8086         │
                          │  Next.js :3000   │                  └──────────────────┘
                          └──────────────────┘
```

**Các quyết định thiết kế quan trọng:**

- **Fanout exchange** — RabbitMQ phát bản sao của mỗi message đến tất cả các queue được bind. WebSocket Gateway và Stream Processor đều nhận được dữ liệu mà không phụ thuộc nhau.
- **Exclusive queue (WebSocket Gateway)** — tự động xoá khi gateway khởi động lại; không tích lũy message cũ.
- **Durable queue (Stream Processor)** — tồn tại qua các lần khởi động lại; không mất dữ liệu nếu processor tạm dừng.
- **Cổng kiểm duyệt thiết bị** — thiết bị phải hoàn thành handshake (`POST /api/v1/connect`) và được operator chấp thuận trước khi metric được chấp nhận.

---

## 3. Luồng Dữ Liệu

### 3.1 Luồng metric thông thường

```
1. ESP32 gửi POST /api/v1/metrics kèm JSON payload
2. Backend xác thực payload (Pydantic) và kiểm tra trạng thái thiết bị
3. Backend publish JSON thô lên RabbitMQ fanout exchange
4. [Song song]:
   a. WebSocket Gateway nhận message, broadcast đến tất cả dashboard đang kết nối
   b. Stream Processor nhận message, tính trung bình động và cờ cảnh báo,
      sau đó ghi điểm dữ liệu đã xử lý vào InfluxDB
5. Dashboard render dữ liệu theo thời gian thực
```

### 3.2 Luồng kết nối / phê duyệt thiết bị

```
1. ESP32 gửi POST /api/v1/connect {"device_id": "...", "connection": "request"}
2. Backend đăng ký thiết bị với trạng thái PENDING và publish sự kiện
   {type: "device_approval_request", device_id: "..."} lên RabbitMQ
3. WebSocket Gateway chuyển tiếp sự kiện đến tất cả dashboard
4. Dashboard hiện DeviceApprovalModal để operator quyết định
5. Operator nhấn Accept/Deny → dashboard POST /api/v1/devices/{id}/decision
6. Backend cập nhật registry và giải phóng kết nối HTTP đang chờ của ESP32
7. ESP32 nhận {"connection": "approved"} hoặc {"connection": "denied"} và tiếp tục
```

### 3.3 Schema payload

```json
{
  "device_id": "esp32-001",
  "timestamp": "2026-05-25T10:00:00Z",
  "heartrate": 76.3,
  "spO2": 98.4
}
```

Quy tắc xác thực (bắt buộc bởi Pydantic):
- `heartrate`: phải trong khoảng `[30, 220]` BPM
- `spO2`: phải trong khoảng `[70, 100]` %

---

## 4. Hạ Tầng

### 4.1 RabbitMQ

- **Image:** `rabbitmq:3.13-management-alpine`
- **Exchange:** `health_metrics_fanout` (kiểu: `FANOUT`, durable)
- **Các queue:**
  - `health_metrics` — durable, được Stream Processor tiêu thụ
  - `""` (ẩn danh) — exclusive + auto-delete, được WebSocket Gateway tiêu thụ
- **Cổng:** `5672` (AMQP), `15672` (giao diện quản lý)
- **Ngưỡng bộ nhớ:** 70% giới hạn container (179 MB trên 256 MB)

### 4.2 InfluxDB

- **Image:** `influxdb:2.7-alpine`
- **Organisation:** `iot`
- **Bucket:** `health_metrics`
- **Measurement:** `health_metrics`
- **Tag:** `device_id`
- **Fields:** `heartrate`, `spo2`, `heartrate_avg`, `spo2_avg`, `alert_low_spo2`, `alert_high_heartrate`
- **Timestamp:** theo thiết bị báo cáo (UTC), độ chính xác nanosecond

---

## 5. Dịch Vụ: Backend API

**Thư mục:** `backend/`  
**Runtime:** Python 3.12, FastAPI 0.115, Uvicorn  
**Cổng:** `8000` (nội bộ), expose ra host qua `API_PORT`

### 5.1 File: `app/main.py`

Điểm khởi động ứng dụng. Tạo FastAPI app, gắn CORS middleware và đăng ký các router.

```python
app = FastAPI(title="IoT Health Monitoring API", version="1.0.0")
```

- **CORS:** `allow_origins=["*"]` — mở hoàn toàn cho môi trường dev; nên thu hẹp trong production.
- **Các router được mount tại `/api/v1`:**
  - `metrics_router` — tiếp nhận dữ liệu cảm biến
  - `chat_router` — trợ lý AI
  - `devices_router` — vòng đời thiết bị
- **`GET /health`** — liveness probe, trả về `{"status": "ok"}`

### 5.2 File: `app/config.py`

Class `BaseSettings` của Pydantic. Đọc giá trị từ biến môi trường (hoặc file `.env`).

| Trường | Mặc định | Mô tả |
|---|---|---|
| `rabbitmq_url` | `amqp://guest:guest@rabbitmq:5672/` | Chuỗi kết nối RabbitMQ |
| `rabbitmq_queue` | `health_metrics` | Tên queue durable |
| `rabbitmq_exchange` | `health_metrics_fanout` | Tên fanout exchange |
| `app_env` | `development` | Nhãn môi trường |
| `gemini_api_key` | `""` | API key của Google Gemini |

### 5.3 File: `app/models.py`

Model Pydantic cho payload cảm biến đầu vào.

**Class `HealthMetric`**

| Trường | Kiểu | Xác thực |
|---|---|---|
| `device_id` | `str` | — |
| `timestamp` | `datetime` | ISO 8601 |
| `heartrate` | `float` | 30 ≤ giá trị ≤ 220 |
| `spO2` | `float` | 70 ≤ giá trị ≤ 100 |

- **`validate_heartrate(v)`** — validator class method; raise `ValueError` nếu ngoài phạm vi.
- **`validate_spo2(v)`** — validator class method; raise `ValueError` nếu ngoài phạm vi.

### 5.4 File: `app/messaging.py`

Xử lý việc publish message lên RabbitMQ. Mỗi lần gọi mở một kết nối mới — phù hợp với tần suất ghi thấp (một lần mỗi reading).

**`async publish_fanout(body: bytes) -> None`**

Mở kết nối đến RabbitMQ, khai báo fanout exchange (`health_metrics_fanout`, durable), và publish `body` với delivery mode `PERSISTENT`. Kết nối được đóng sau khi publish thông qua `async with`.

**`async publish_approval_request(device_id: str) -> None`**

Tạo JSON payload `{"type": "device_approval_request", "device_id": "..."}` và gọi `publish_fanout`. Lỗi được bắt và log mà không raise — broadcast thất bại không chặn quá trình handshake ESP32.

### 5.5 File: `app/registry.py`

Registry thiết bị trong bộ nhớ. Theo dõi thiết bị đang hoạt động duy nhất và trạng thái phê duyệt của nó. Sử dụng `asyncio.Event` để endpoint `/connect` có thể chờ hiệu quả cho đến khi operator quyết định.

**Class `DeviceStatus` (str enum)**

Giá trị: `PENDING`, `APPROVED`, `DENIED`

**Dataclass `DeviceRecord`**

| Trường | Kiểu | Mô tả |
|---|---|---|
| `device_id` | `str` | Định danh thiết bị |
| `status` | `DeviceStatus` | Trạng thái hiện tại |
| `first_seen` | `datetime` | Thời điểm UTC lần đầu gọi `connect` |
| `decided_at` | `datetime \| None` | Thời điểm UTC operator ra quyết định |
| `event` | `asyncio.Event` | Được kích hoạt khi có quyết định |

**`register_pending(device_id: str) -> DeviceRecord`**

Thay thế `_current` bằng `DeviceRecord` mới với trạng thái `PENDING`. Mọi record trước đó (kể cả thiết bị đã được phê duyệt) đều bị ghi đè — chỉ một thiết bị hoạt động tại một thời điểm.

**`decide(device_id: str, approved: bool) -> bool`**

Đặt trạng thái thành `APPROVED` hoặc `DENIED`, ghi `decided_at`, và kích hoạt `record.event`. Trả về `False` nếu `device_id` không khớp với record hiện tại (quyết định đã lỗi thời).

**`get_status(device_id: str) -> DeviceStatus | None`**

Trả về trạng thái của thiết bị, hoặc `None` nếu không phải thiết bị hiện tại.

**`get_all() -> list[DeviceRecord]`**

Trả về `[_current]` hoặc `[]`. Được dùng bởi `GET /devices`.

### 5.6 File: `app/routes/metrics.py`

**`POST /api/v1/metrics`** — tiếp nhận dữ liệu cảm biến

1. Deserialise request body thành `HealthMetric` (Pydantic tự động xác thực).
2. Gọi `get_status(metric.device_id)` — từ chối với `403` nếu thiết bị không phải `APPROVED`.
3. Serialise metric về JSON và gọi `publish_fanout`.
4. Trả về `202 Accepted` khi thành công; `503` nếu RabbitMQ không khả dụng.

### 5.7 File: `app/routes/devices.py`

**`POST /api/v1/connect`** — handshake ESP32 (long-poll)

1. Gọi `register_pending(device_id)` để tạo `DeviceRecord`.
2. Publish sự kiện phê duyệt qua `publish_approval_request`.
3. Await `record.event.wait()` với timeout 300 giây.
4. Trả về `200` (`approved`), `403` (`denied`), hoặc `408` (`timeout`).

Kết nối HTTP giữ mở tối đa 5 phút — ESP32 chờ đồng bộ quyết định của operator.

**`GET /api/v1/devices`** — danh sách thiết bị

Trả về registry hiện tại dưới dạng danh sách `DeviceRecordOut`. Tối đa một phần tử.

**`POST /api/v1/devices/{device_id}/decision`** — operator phê duyệt/từ chối

Body: `{"approved": true | false}`

1. Gọi `decide(device_id, approved)`.
2. Trả về `404` nếu thiết bị không tìm thấy trong registry (đã lỗi thời hoặc đã bị thay thế).

### 5.8 File: `app/routes/chat.py`

Trợ lý AI sử dụng Google Gemini 2.5 Flash Lite.

**`POST /api/v1/chat`**

Request body (`ChatRequest`):
- `messages: list[Message]` — lịch sử hội thoại (`role`: `"user"` | `"assistant"`)
- `context: HealthContext` — snapshot chỉ số sức khỏe hiện tại (tùy chọn)

**`HealthContext`** các trường: `deviceId`, `heartrate`, `spO2`, `status`, `alertHighHr`, `alertLowSpo2`, `avgHr`, `avgSpO2`, `sessionReadings`

**`_system_prompt(ctx: HealthContext) -> str`**

Tạo system instruction cho Gemini. Bao gồm:
- Chỉ số sinh hiệu hiện tại (nhịp tim, SpO2, trung bình phiên, số lần đo)
- Mô tả cảnh báo đang hoạt động kèm ngưỡng
- Vai trò và giới hạn của trợ lý (không chẩn đoán, không kê đơn)

**`_build_history(messages) -> list[dict]`**

Chuyển đổi `messages[:-1]` (tất cả trừ message cuối) sang định dạng `contents` của Gemini. Bỏ qua các lượt đầu tiên nếu là assistant (Gemini yêu cầu content đầu tiên phải là user turn).

**Logic endpoint:**

1. Kiểm tra `GEMINI_API_KEY` đã được cấu hình và `messages` không rỗng.
2. Tạo request payload cho Gemini với system instruction, lịch sử hội thoại và message cuối cùng.
3. POST đến Gemini REST API (`gemini-2.5-flash-lite:generateContent`) dùng `httpx.AsyncClient` với timeout 30 giây.
4. Trả về text của candidate đầu tiên dưới dạng `{"text": "..."}`.

---

## 6. Dịch Vụ: WebSocket Gateway

**Thư mục:** `websocket-gateway/`  
**Runtime:** Python 3.12, FastAPI, Uvicorn  
**Cổng:** `8080` (nội bộ), expose ra host qua `WEBSOCKET_PORT`

### 6.1 File: `app/config.py`

| Trường | Mặc định | Mô tả |
|---|---|---|
| `rabbitmq_url` | `amqp://guest:guest@rabbitmq:5672/` | Chuỗi kết nối RabbitMQ |
| `rabbitmq_exchange` | `health_metrics_fanout` | Exchange fanout cần đăng ký |

### 6.2 File: `app/broadcaster.py`

Quản lý kết nối WebSocket và cầu nối message từ RabbitMQ đến chúng.

**Class `ConnectionManager`**

Duy trì hai tập hợp:
- `_all: set[WebSocket]` — client đăng ký tất cả thiết bị
- `_by_device: dict[str, set[WebSocket]]` — client đăng ký một thiết bị cụ thể

**`async connect(ws, device_id=None)`**

Chấp nhận WebSocket handshake và đăng ký kết nối vào `_all` (nếu không có `device_id`) hoặc `_by_device[device_id]`.

**`disconnect(ws, device_id=None)`**

Xóa kết nối khỏi tất cả các tập hợp theo dõi. An toàn khi gọi dù kết nối không tồn tại.

**`async broadcast(payload: dict)`**

Xác định tập đích là hợp của `_all` và `_by_device[device_id]` (nếu payload có `device_id`). Gửi `json.dumps(payload)` đến từng đích. Các kết nối chết (raise exception khi gửi) được thu thập và xóa im lặng.

**`async consume_loop()`**

Được chạy như background task lúc app khởi động:
1. Kết nối RabbitMQ bằng `connect_robust` (tự động kết nối lại).
2. Khai báo fanout exchange và bind một queue exclusive, auto-delete vào đó.
3. Lặp message vô hạn; với mỗi message, parse JSON body và gọi `manager.broadcast(payload)`.
4. Queue tự động xóa khi gateway dừng — không tích lũy message.

**Singleton cấp module:** `manager = ConnectionManager()`

### 6.3 File: `app/main.py`

**Lifespan context manager**

Khi khởi động: tạo `asyncio.Task` chạy `consume_loop()`.  
Khi tắt: hủy task và await `CancelledError`.

**`GET /health`** — liveness probe

**`WebSocket /ws`** — đăng ký tất cả thiết bị

Chấp nhận kết nối, sau đó loop `receive_text()` để giữ kết nối sống. Khi `WebSocketDisconnect`, gọi `manager.disconnect(ws)`.

**`WebSocket /ws/{device_id}`** — đăng ký một thiết bị cụ thể

Tương tự `/ws`, nhưng truyền `device_id` vào `connect` và `disconnect`. Dashboard client có thể dùng endpoint này để chỉ nhận dữ liệu từ một thiết bị.

---

## 7. Dịch Vụ: Stream Processor

**Thư mục:** `stream-processor/`  
**Runtime:** Python 3.12, asyncio  
**Vai trò:** Worker chạy nền liên tục — không có HTTP server

### 7.1 File: `app/config.py`

| Trường | Mặc định | Mô tả |
|---|---|---|
| `rabbitmq_url` | `amqp://guest:guest@rabbitmq:5672/` | Kết nối RabbitMQ |
| `rabbitmq_queue` | `health_metrics` | Tên queue durable |
| `rabbitmq_exchange` | `health_metrics_fanout` | Exchange cần bind |
| `influxdb_url` | `http://influxdb:8086` | Endpoint InfluxDB |
| `influxdb_token` | `my-super-secret-token` | Token xác thực |
| `influxdb_org` | `iot` | Organisation |
| `influxdb_bucket` | `health_metrics` | Bucket |
| `moving_avg_window` | `10` | Kích thước cửa sổ trung bình động |

### 7.2 File: `app/processor.py`

Xử lý tín hiệu có trạng thái. Tính trung bình động theo thiết bị và phát sinh cờ cảnh báo.

**Dataclass `ProcessedMetric`**

| Trường | Kiểu | Mô tả |
|---|---|---|
| `device_id` | `str` | Định danh thiết bị |
| `timestamp` | `str` | ISO 8601 từ payload gốc |
| `heartrate` | `float` | Giá trị thô |
| `spo2` | `float` | Giá trị thô |
| `heartrate_avg` | `float` | Trung bình động (cửa sổ = `moving_avg_window`) |
| `spo2_avg` | `float` | Trung bình động |
| `alert_low_spo2` | `bool` | `spo2_avg < 92.0` |
| `alert_high_heartrate` | `bool` | `heartrate_avg > 120.0` |

**Trạng thái cấp module: `_windows`**

```python
_windows: dict[str, dict[str, deque]] = defaultdict(
    lambda: {"heartrate": deque(maxlen=N), "spo2": deque(maxlen=N)}
)
```

Một cặp deque cho mỗi `device_id`, giới hạn tại `moving_avg_window` phần tử. Tự động loại bỏ reading cũ nhất khi đầy.

**`process(payload: dict) -> ProcessedMetric`**

1. Trích xuất `device_id`, `heartrate`, `spO2` từ payload thô.
2. Thêm reading vào deque của thiết bị.
3. Tính trung bình và cờ cảnh báo.
4. Trả về `ProcessedMetric`.

Ngưỡng cảnh báo:
- SpO2 thấp: trung bình động < **92%**
- Nhịp tim cao: trung bình động > **120 BPM**

Sử dụng trung bình động (thay vì giá trị thô) để tránh các spike thoáng qua gây cảnh báo sai.

### 7.3 File: `app/influx_writer.py`

Ghi metric đã xử lý vào InfluxDB dùng synchronous write API (chạy trong thread để không block event loop).

**`_parse_timestamp(ts: str) -> datetime`**

Chuyển đổi chuỗi ISO 8601 (kể cả suffix `Z`) thành `datetime` object có thông tin timezone.

**`_write_sync(point: Point) -> None`**

Mở `InfluxDBClient` đồng bộ, ghi point vào bucket đã cấu hình, và đóng client. Được gọi qua `asyncio.to_thread`.

**`async write(metric: ProcessedMetric) -> None`**

Tạo InfluxDB `Point`:

```
measurement:  health_metrics
tag:          device_id = <device_id>
fields:       heartrate, spo2, heartrate_avg, spo2_avg,
              alert_low_spo2, alert_high_heartrate
timestamp:    thời gian UTC do thiết bị báo cáo
```

Gọi `_write_sync` trong thread pool và log kết quả ở mức INFO với giờ Việt Nam (UTC+7).

### 7.4 File: `app/consumer.py`

Điểm khởi động ứng dụng (chạy bằng `python -m app.consumer`).

**`async handle_message(message: aio_pika.IncomingMessage) -> None`**

Handler được gọi với mỗi delivery từ RabbitMQ:
1. Parse body thành JSON.
2. Bỏ qua message có trường `type` (đây là sự kiện điều khiển như `device_approval_request`, không phải metric).
3. Gọi `process(payload)` để tính metric đã xử lý.
4. Gọi `await write(metric)` để lưu vào InfluxDB.
5. Log cảnh báo nếu `alert_low_spo2` hoặc `alert_high_heartrate` được kích hoạt.
6. Khi có exception, re-raise để aio-pika requeue message (`requeue=True`).

**`async main() -> None`**

Trình tự khởi động với logic retry:
1. Thử kết nối RabbitMQ tối đa **10 lần**, chờ 5 giây giữa các lần thử với timeout kết nối 10 giây. Điều này xử lý race condition khi container khởi động trước khi cổng AMQP của RabbitMQ sẵn sàng.
2. Đặt QoS `prefetch_count=10` — xử lý tối đa 10 message song song trước khi acknowledge.
3. Khai báo exchange durable và queue, bind chúng.
4. Gọi `queue.consume(handle_message)`.
5. Await `asyncio.Future()` để chạy vô hạn.

---

## 8. Dịch Vụ: Dashboard

**Thư mục:** `dashboard/`  
**Runtime:** Node.js 24, Next.js 16 (App Router), React 19  
**Cổng:** `3000` (nội bộ), expose ra host qua `DASHBOARD_PORT`

### 8.1 Tổng quan

Dashboard dạng single-page, tối ưu cho mobile. Toàn bộ trạng thái thời gian thực chảy qua một kết nối WebSocket duy nhất được quản lý bởi `useMetricsStream`. Không có server-side rendering dữ liệu trực tiếp — tất cả là client-side sau lần tải đầu tiên.

**Các thư viện chính:**

| Package | Mục đích |
|---|---|
| `recharts` | Biểu đồ đường cho xu hướng metric |
| `framer-motion` | Animation và chuyển trang |
| `next-themes` | Chuyển đổi theme sáng/tối |

### 8.2 File: `app/layout.tsx`

Layout gốc. Bọc app trong:
- `ThemeProvider` (next-themes, mặc định: dark) — lưu theme vào thuộc tính `class` trên `<html>`
- Font `Geist` + `Geist Mono` qua `next/font/google`

### 8.3 File: `app/page.tsx`

Component trang duy nhất (`'use client'`). Kết hợp tất cả các section và quản lý điều hướng tab.

**Trạng thái chính:**

| Trạng thái / Hook | Nguồn | Mô tả |
|---|---|---|
| `devices`, `connected`, `pendingApprovals` | `useMetricsStream` | Dữ liệu thiết bị thời gian thực và trạng thái WS |
| `alerts`, `dismiss`, `clearAll` | `useAlerts` | Lịch sử cảnh báo dẫn xuất từ device data |
| `tab` | `useState` cục bộ | Tab đang active của bottom nav |

**`EmptyState`**

Hiển thị trên tab Home khi chưa có dữ liệu thiết bị. Hiện thông báo khác nhau tùy WebSocket đã kết nối hay chưa.

**`HomeSection`**

View dashboard chính. Render: daily quote, `ConnectionBar`, `AlertBanner`, `HeartRateCard`, `SpO2Card`, `DailySummary`, `HealthInsights`, và các ô placeholder (Sleep, Stress, Activity — coming soon).

**`SECTION_TITLES`**

Map `TabId` → chuỗi hiển thị trên header trang.

**`HomePage` (default export)**

- Đọc `NEXT_PUBLIC_WS_URL` ở cấp module (được bake vào lúc build).
- Lấy thiết bị đầu tiên (và duy nhất) từ map `devices`.
- Render header, section đang active (có animation framer-motion), `BottomNav`, và `DeviceApprovalModal`.

### 8.4 File: `hooks/useMetricsStream.ts`

Hook trạng thái thời gian thực cốt lõi.

**Các kiểu được export:**

- `HealthStatus` — `'normal' | 'elevated' | 'low'`
- `MetricPoint` — `{ time, heartrate, spO2 }`
- `DeviceData` — toàn bộ trạng thái mỗi thiết bị (lịch sử points, reading mới nhất, cờ cảnh báo, trạng thái kết nối)

**`deriveStatus(heartrate, spO2, backendStatus?)`**

Xác định trạng thái sức khỏe. Ưu tiên `status` từ backend nếu là `'elevated'` hoặc `'low'`; nếu không, dẫn xuất từ ngưỡng (`HR > 120` hoặc `SpO2 < 92`).

**`useMetricsStream(url: string)`**

Trả về: `{ devices, connected, pendingApprovals, dismissApproval }`

- Mở WebSocket đến `url` khi mount.
- Khi ngắt kết nối, lên lịch kết nối lại sau **2 giây**.
- Handler `ws.onmessage`:
  - Nếu `msg.type === 'device_approval_request'` → thêm `device_id` vào `pendingApprovals` (loại trùng lặp).
  - Ngược lại → parse message metric, chuyển đổi `timestamp` sang giờ địa phương (Asia/Ho_Chi_Minh), thêm vào mảng `points` của thiết bị (giới hạn **60 điểm**), và cập nhật state `devices`. Map được thay thế hoàn toàn mỗi lần cập nhật (chỉ một thiết bị active tại một thời điểm).
- Dọn dẹp khi unmount (đóng socket, xóa timer kết nối lại).

**`dismissApproval(deviceId)`**

Xóa thiết bị khỏi `pendingApprovals` sau khi operator đưa ra quyết định.

### 8.5 File: `hooks/useAlerts.ts`

Dẫn xuất lịch sử cảnh báo từ state `devices`. Chỉ kích hoạt trên **cạnh lên** — cảnh báo được tạo một lần khi cờ chuyển từ `false` sang `true`, không phải mỗi reading.

**Các kiểu được export:**

- `AlertType` — `'high_hr' | 'low_spo2'`
- `HealthAlert` — bản ghi cảnh báo với `id`, `timestamp`, `deviceId`, `type`, `value`, `threshold`, và chỉ số thô tại thời điểm cảnh báo

**`useAlerts(devices)`**

Trả về: `{ alerts, dismiss, clearAll }`

- Chạy effect mỗi khi `devices` thay đổi.
- So sánh cờ `alertHighHr` / `alertLowSpo2` hiện tại với giá trị trước đó lưu trong `prevRef`.
- Tạo `HealthAlert` trên mỗi chuyển đổi `false → true`.
- `dismiss(id)` — xóa một cảnh báo theo ID.
- `clearAll()` — xóa toàn bộ danh sách cảnh báo.

### 8.6 Các Component

| Component | File | Mô tả |
|---|---|---|
| `ConnectionBar` | `components/ConnectionBar.tsx` | Hiển thị device ID, chỉ báo chất lượng kết nối và thời gian cập nhật cuối |
| `AlertBanner` | `components/AlertBanner.tsx` | Banner inline khi `alertHighHr` hoặc `alertLowSpo2` đang hoạt động |
| `HeartRateCard` | `components/HeartRateCard.tsx` | BPM hiện tại kèm biểu đồ đường trực tiếp (Recharts) |
| `SpO2Card` | `components/SpO2Card.tsx` | SpO2% hiện tại kèm biểu đồ đường trực tiếp |
| `DailySummary` | `components/DailySummary.tsx` | HR trung bình phiên, SpO2 trung bình và số lần đo |
| `HealthInsights` | `components/HealthInsights.tsx` | Diễn giải văn bản về chỉ số hiện tại (bình thường / cao / thấp) |
| `MetricChart` | `components/MetricChart.tsx` | Wrapper tái sử dụng `<ResponsiveContainer>` + `<LineChart>` cho cả hai metric card |
| `DeviceCard` | `components/DeviceCard.tsx` | Card nhỏ gọn hiển thị trạng thái thiết bị (dùng trong Trends/Profile) |
| `ThemeToggle` | `components/ThemeToggle.tsx` | Nút mặt trời/mặt trăng gắn với next-themes |
| `BottomNav` | `components/BottomNav.tsx` | Điều hướng bottom cố định với 5 tab: Home, Trends, Alerts, Chat, Profile |
| `DeviceApprovalModal` | `components/DeviceApprovalModal.tsx` | Modal overlay hiển thị khi `pendingApprovals` không rỗng. Gọi `POST /api/v1/devices/{id}/decision` khi Accept/Deny |

### 8.7 Các Section (view theo tab)

| Section | File | Mô tả |
|---|---|---|
| `TrendsSection` | `components/sections/TrendsSection.tsx` | Biểu đồ lịch sử HR và SpO2 trong phiên |
| `AlertsSection` | `components/sections/AlertsSection.tsx` | Lịch sử cảnh báo có thể cuộn kèm nút dismiss |
| `ChatSection` | `components/sections/ChatSection.tsx` | Giao diện chat AI; gửi `POST /api/v1/chat` với lịch sử hội thoại và chỉ số thời gian thực làm ngữ cảnh |
| `ProfileSection` | `components/sections/ProfileSection.tsx` | Thống kê phiên và thông tin thiết bị |

### 8.8 Lưu ý về build

Biến môi trường `NEXT_PUBLIC_*` được **bake vào JavaScript bundle lúc build**. Chúng phải được truyền qua Docker build argument, không phải runtime environment variable.

Trong `docker-compose.yml`:
```yaml
build:
  args:
    NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL}
    NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
```

Bất kỳ thay đổi nào với các giá trị này đều cần rebuild image: `docker compose up -d --build dashboard`.

---

## 9. Triển Khai

### 9.1 Cấu trúc thư mục

```
IoTProject/
├── backend/              # FastAPI: tiếp nhận dữ liệu, chat, quản lý thiết bị
├── websocket-gateway/    # FastAPI: broadcaster WebSocket
├── stream-processor/     # Worker: consumer RabbitMQ + ghi InfluxDB
├── dashboard/            # Next.js: giao diện người dùng
├── nginx/                # Cấu hình nginx host (không dockerise)
│   ├── health.dhunggg.io.vn.conf
│   └── health-api.dhunggg.io.vn.conf
├── docker-compose.yml
├── .env                  # Bí mật — đã gitignore
└── .env.example          # Template được commit lên git
```

### 9.2 Giới hạn bộ nhớ Docker

| Dịch vụ | Giới hạn cứng | Reservation |
|---|---|---|
| Backend API | 128 MB | 64 MB |
| Dashboard | 256 MB | 128 MB |
| WebSocket Gateway | 128 MB | 64 MB |
| Stream Processor | 128 MB | 64 MB |
| RabbitMQ | 256 MB | 128 MB |
| InfluxDB | 384 MB | 192 MB |

Heap Node.js bên trong container dashboard được giới hạn thêm qua `NODE_OPTIONS=--max-old-space-size=224`.

### 9.3 Routing nginx host

```
health.dhunggg.io.vn/         →  Dashboard   :3000
health.dhunggg.io.vn/ws       →  WS Gateway  :8082  (Upgrade: websocket)
health-api.dhunggg.io.vn/     →  Backend API :8081
```

Cấu hình nằm trong `nginx/`. Symlink vào `/etc/nginx/sites-enabled/` và chạy `sudo nginx -t && sudo systemctl reload nginx`.

### 9.4 Checklist khởi động lần đầu

```bash
# 1. Thêm swap (bắt buộc để build Next.js trên VM 1.8 GB)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 2. Sao chép và cấu hình .env
cp .env.example .env
# Sửa .env: đặt INFLUXDB_TOKEN, INFLUXDB_INIT_PASSWORD, GEMINI_API_KEY,
#            NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_API_URL

# 3. Build và khởi động
docker compose up -d --build

# 4. Cấu hình nginx
sudo cp nginx/*.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/health.dhunggg.io.vn.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/health-api.dhunggg.io.vn.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. (Tuỳ chọn) Bật HTTPS
sudo certbot --nginx -d health.dhunggg.io.vn -d health-api.dhunggg.io.vn
```

### 9.5 Lưu ý khởi động lại InfluxDB

`INFLUXDB_INIT_MODE=setup` chỉ chạy lần đầu tiên. Từ lần khởi động sau, InfluxDB tự phát hiện bolt file đã tồn tại và bỏ qua setup. **Không** thay đổi biến này.

---

## 10. Biến Môi Trường

Tất cả các biến đều nằm trong một file `.env` duy nhất ở thư mục gốc dự án.

| Biến | Dùng bởi | Mô tả |
|---|---|---|
| `TZ` | tất cả dịch vụ | Timezone (vd: `Asia/Ho_Chi_Minh`) |
| `DASHBOARD_PORT` | compose | Cổng host map đến dashboard :3000 |
| `API_PORT` | compose | Cổng host map đến backend :8000 |
| `WEBSOCKET_PORT` | compose | Cổng host map đến gateway :8080 |
| `RABBITMQ_AMQP_PORT` | compose | Cổng host map đến RabbitMQ :5672 |
| `RABBITMQ_MGMT_PORT` | compose | Cổng host map đến giao diện quản lý RabbitMQ :15672 |
| `INFLUXDB_PORT` | compose | Cổng host map đến InfluxDB :8086 |
| `RABBITMQ_URL` | backend, gateway, processor | Chuỗi kết nối AMQP đầy đủ |
| `INFLUXDB_URL` | stream-processor | Endpoint HTTP InfluxDB |
| `INFLUXDB_TOKEN` | stream-processor, influxdb | Token admin (đổi trong production) |
| `INFLUXDB_ORG` | stream-processor, influxdb | Tên organisation |
| `INFLUXDB_BUCKET` | stream-processor, influxdb | Tên bucket |
| `INFLUXDB_INIT_MODE` | influxdb | `setup` chỉ lần chạy đầu tiên |
| `INFLUXDB_INIT_USERNAME` | influxdb | Tên người dùng admin ban đầu |
| `INFLUXDB_INIT_PASSWORD` | influxdb | Mật khẩu admin ban đầu (đổi trong production) |
| `NEXT_PUBLIC_WS_URL` | dashboard (build-time) | URL WebSocket phía trình duyệt |
| `NEXT_PUBLIC_API_URL` | dashboard (build-time) | URL Backend API phía trình duyệt |
| `GEMINI_API_KEY` | backend | API key Google Gemini |
