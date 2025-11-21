# Simple Blockchain

**Trường Đại học Sư phạm Kỹ thuật TP. Hồ Chí Minh** 
**Khoa Công nghệ thông tin** 
**Giảng viên hướng dẫn:** TS. Huỳnh Xuân Phụng  
**Nhóm thực hiện:** Nhóm 6

---

## Thành viên nhóm

| MSSV        | Họ tên                  |
| :---------- | :---------------------- |
| **2591302** | **Nguyễn Thanh Bình**   |
| **2591303** | **Huỳnh Đình Hiệp**     |
| **2591311** | **Lê Nguyễn Tuấn Kiệt** |
| **2591322** | **Trần Minh Sang**      |

---

## Mô tả dự án

Đây là một blockchain mô phỏng được viết bằng **Python + FastAPI** nhằm mục đích học tập và minh họa trực quan các khái niệm của công nghệ blockchain:

* **Chữ ký số:** Tạo và xác minh chữ ký số ECDSA (SECP256k1).
*  **Proof-of-Work (PoW):** Cơ chế đào block với độ khó điều chỉnh được.
* **Giao dịch:** Giao dịch có chữ ký, mempool, và phần thưởng miner ngẫu nhiên.
* **Tính bất biến:** Demo tính bất biến của chuỗi khối (Tampering).
* **Trực quan hóa:** Explorer chi tiết, dashboard giao dịch, giao diện miner.

---

## Tính năng chính

1.  **Quản lý ví:** Tạo ví mới (Private Key, Public Key, Address Hex).
2.  **Giao dịch:** Ký giao dịch bằng Private Key (ECDSA) và gửi vào Mempool.
3.  **Mining (Đào coin):** Miner đào block (PoW), nhận thưởng.
4.  **Cấu hình:** Điều chỉnh độ khó (Difficulty) và khoảng thưởng ngay trên giao diện.
5.  **Explorer:** Xem danh sách block, chi tiết ví, lịch sử giao dịch, coinbase reward.
6.  **Tampering Demo (Giả lập tấn công):** Sửa dữ liệu block cũ để thấy ngay chuỗi bị `invalid`.
7.  **Validation:** Kiểm tra tính toàn vẹn của chuỗi bằng cả Backend và Frontend.

---

## Công nghệ sử dụng

| Thành phần        | Công nghệ                                              |
| :---------------- | :----------------------------------------------------- |
| **Backend**       | Python 3.10+, FastAPI, Uvicorn                         |
| **Crypto**        | ecdsa (SECP256k1)                                      |
| **Frontend**      | HTML + CSS + Vanilla JavaScript                        |
| **Lưu trữ**       | File JSON (`blockchain_data.json`)                     |
| **Thư viện khác** | `pydantic`, `hashlib`, `json`                          |


---
## Hướng dẫn cài đặt & Chạy
### 1. Chuẩn bị môi trường
Khuyến khích sử dụng Virtual Environment để tránh xung đột thư viện.

#### Tạo virtual environment
```
python -m venv venv
```

#### Kích hoạt môi trường (Windows)
```
venv\Scripts\activate
```

#### Kích hoạt môi trường (macOS/Linux)
```
source venv/bin/activate
```
### 2. Cài đặt dependencies
Cài đặt các thư viện cần thiết từ file requirements.txt.


```
pip install -r requirements.txt
```
### 3. Chạy Server
Khởi chạy ứng dụng backend với Uvicorn.


```
uvicorn blockchain_app:app --reload --port 8000
```
### 4. Truy cập ứng dụng

Mở trình duyệt và truy cập các đường dẫn sau:

- **Dashboard chính:**  
  <http://localhost:8000>

- **Miner Interface:**  
  <http://localhost:8000/miner>

- **Explorer / Overview:**  
  <http://localhost:8000/overview>

- **Tampering Demo:**  
  <http://localhost:8000/tampering>
