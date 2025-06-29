# 🧬 Modern Biometric Fingerprint System (Python + Node.js)

A complete full-stack system for fingerprint **enrollment**, **identification (1\:N)**, and **verification (1:1)** using a hybrid Python–Node.js architecture with a beautiful real-time UI built in **React**.

---

## 🧩 System Architecture

```
+----------------+            +------------------+          +----------------------------+
|  Web Frontend  |  <----->   |   Node.js Proxy  |  <-----> | Python Fingerprint Agent   |
+----------------+  WebSocket/REST         REST           WebSocket/REST
```

* **React Frontend** – Real-time interface for enrollment, live preview, verification (1:1), and identification (1\:N)
* **Node.js Backend** – REST + Socket.IO server, SQLite storage
* **Python Agent** – Controls fingerprint scanner SDK, handles low-level capture & matching

---

## 📦 Requirements

### Node.js Server

```bash
npm install
```

### Python Agent

Use **32-bit Python** to work with most fingerprint SDKs:

```bash
pip install flask flask-socketio eventlet numpy opencv-python requests
```

---

## 🚀 Quick Start

### 1. Start Python Agent

```bash
python app.py
```

### 2. Start Node.js Proxy Server

```bash
node server.js
```

---

## 🧠 API Endpoints (Node.js)

### Enrollment

* `POST /api/start_enrollment` – Begin 3-step slap (4-4-2) fingerprint enrollment
* `POST /api/save_enrollment` – Store templates + user info (name, ID)

### Identification (1\:N)

* `POST /api/identify` – Match fingerprint against database

### Verification (1:1)

* `POST /api/match_templates` – Compare Template 1 vs Template 2

### Device Management

* `POST /api/init-device` – Initialize scanner
* `GET /api/device-status` – Get current scanner & SDK state

---

## 🗄️ SQLite Database

### Table: `users_and_templates`

| Column     | Type    | Description           |
| ---------- | ------- | --------------------- |
| id         | INTEGER | Primary Key           |
| id\_number | TEXT    | Unique user ID        |
| name       | TEXT    | User full name        |
| fmr\_\*    | BLOB    | Fingerprint templates |

### Table: `fingerprint_images`

| Column  | Type | Description                             |
| ------- | ---- | --------------------------------------- |
| img\_\* | BLOB | Raw slap or segmented fingerprint image |

---

## 🔁 Real-time Events (Socket.IO)

* `live_preview` – Show Base64-encoded fingerprint image live
* `capture_result` – Feedback from capture action (success/fail)
* `enrollment_step` – Step-by-step message during enrollment
* `identification_result` – Result after searching database (1\:N)
* `identification_step` – Status during 1\:N identification

---

## 💻 Frontend Features (React + Next.js)

> `components/FingerprintSystem.jsx`

* 📸 **Live Preview** of fingerprint in real-time
* 📝 **Automatic Enrollment** with full name + ID
* ✅ **Verification (1:1)** via manual capture
* 🔍 **Identification (1\:N)** against saved users
* 🔄 **State-aware WebSocket listeners** using `useRef`
* 🚨 **User feedback** via Toastify notifications
* 🎨 **Modern responsive design** with CSS-in-JS
* 🔒 Realtime image + state synchronization

---

## 🖼️ UI Snapshots *(coming soon)*

* Enrollment form with name + ID
* Fingerprint preview during slap scan
* Match score visualization (1:1)
* Identification result card (1\:N)

---

## 📁 .gitignore (Node.js)

```
node_modules/
package-lock.json
*.sqlite
```

---

## 📌 Notes

* All fingerprint templates and raw images are stored as BLOBs
* Make sure scanner DLLs are accessible in Python agent folder
* Tested with Windows, ZAZ SDK, and 32-bit Python

---

## ✨ Roadmap / Enhancements

* ✅ Real-time streaming via Socket.IO
* ✅ Support for 1\:N biometric search
* 🧪 Export to ISO19794-2 / ANSI
* 🚧 Admin Panel with template viewer
* 🚧 Biometric audit logging system

---

## 📬 License

MIT or custom license – contact the maintainer for enterprise use.

---

## 🤝 Credits

Built by combining robust fingerprint hardware SDKs, modern web technologies (React + Node.js), and real-time backend with Python.
