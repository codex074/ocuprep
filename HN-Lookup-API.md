# HOSxP Patient Lookup — API Reference

ระบบดึงชื่อผู้ป่วยจาก HN ผ่าน HOSxP API ภายในเครือข่ายโรงพยาบาล

---

## ภาพรวม

เซิร์ฟเวอร์ทำหน้าที่เป็น **proxy** รับ HN จาก browser แล้วส่งต่อไปยัง HOSxP API พร้อม token ที่ลับอยู่ใน server ไม่เปิดเผยต่อ client

```
Browser → GET /api/patient?q={HN} → Node.js Server → HOSxP API → ชื่อผู้ป่วย
```

---

## การเชื่อมต่อ HOSxP API

### Base URL

```
http://172.17.1.70:3000
```

### Endpoints ที่ใช้

| Endpoint | ใช้สำหรับ |
|---|---|
| `GET /api/hosxp/patient` | ค้นหาหลัก (OPD) |
| `GET /api/hosxp/HIS` | ค้นหาสำรอง (HIS fallback) |

---

## Authentication Tokens

🔴 **ห้ามเขียน token จริงลงในไฟล์นี้** — repo นี้เป็น **public** บน GitHub
ใครก็อ่านได้ ใช้ placeholder เท่านั้น

| ตัวแปร | ใช้กับ endpoint |
|---|---|
| `HOSXP_TOKEN` | `/api/hosxp/patient` |
| `HOSXP_TOKEN_HIS` | `/api/hosxp/HIS` |

เป็น JWT ที่ payload หน้าตาแบบนี้ (ค่าจริงไม่เขียนไว้ที่นี่):

```json
{ "id": 3, "username": "admin", "iat": 1727648065, "exp": 1727734465 }
```

### token จริงเก็บที่ไหน

- **แอป YATA desktop** → `electron/secrets.cjs` (gitignored — ฝังเข้า exe ตอน build)
- **แอป HN Lookup proxy** → กรอกผ่านหน้า Settings ของแอปตอนเปิดครั้งแรก
  (เก็บใน `settings.json` ใน userData ของเครื่อง)

> ⚠️ **Token มีอายุจำกัด** ถ้าระบบแจ้ง 401 / Unauthorized = token หมดอายุ
> ต้องขอใหม่จากผู้ดูแล HOSxP แล้วอัปเดตในที่เก็บข้างบน **อย่าเอามาใส่ในเอกสารนี้**
>
> ดู SEC-3 ใน [`Audit.md`](Audit.md) เรื่องความเสี่ยงของ token ที่ฝังใน exe

---

## วิธีเรียก HOSxP API โดยตรง (curl)

### ค้นหาด้วย HN ผ่าน `/api/hosxp/patient`

```bash
# ใส่ token จริงผ่าน env var — อย่า paste ลงในไฟล์นี้
curl -X GET "http://172.17.1.70:3000/api/hosxp/patient" \
  -H "Authorization: Bearer $HOSXP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"HN":"0012345"}'
```

### ค้นหาด้วย HN ผ่าน `/api/hosxp/HIS` (fallback)

```bash
curl -X GET "http://172.17.1.70:3000/api/hosxp/HIS" \
  -H "Authorization: Bearer $HOSXP_TOKEN_HIS" \
  -H "Content-Type: application/json" \
  -d '{"HN":"0012345"}'
```

### ตัวอย่าง Response

```json
{
  "data": [
    {
      "hn": "0012345",
      "pname": "นาย",
      "fname": "สมชาย",
      "lname": "ใจดี",
      "vn": "670001234",
      "oqueue": "A001"
    }
  ]
}
```

---

## Proxy API ของระบบนี้

### Endpoint

```
GET http://127.0.0.1:3100/api/patient?q={HN}
```

### ตัวอย่าง Request

```bash
curl "http://127.0.0.1:3100/api/patient?q=0012345"
```

> ⚠️ เรียกจาก **เบราว์เซอร์ไม่ได้** — request ใดที่มี header `Origin` จะได้ 403
> (ปิดไว้ตั้งแต่ 2026-07-13 ดู SEC-5 ใน [`Audit.md`](Audit.md)) แอป YATA เวอร์ชัน desktop
> ไม่ได้ใช้ proxy ตัวนี้ — มันคุยกับ HOSxP ผ่าน IPC โดยตรง

### ตัวอย่าง Response (สำเร็จ)

```json
{
  "ok": true,
  "searchType": "hn",
  "patient": {
    "source": "hosxp/patient",
    "hn": "0012345",
    "an": "",
    "vn": "670001234",
    "qn": "A001",
    "ward": "",
    "pname": "นาย",
    "fname": "สมชาย",
    "lname": "ใจดี",
    "fullName": "นายสมชาย ใจดี"
  }
}
```

### ตัวอย่าง Response (ไม่พบ)

```json
{
  "ok": false,
  "message": "ไม่พบข้อมูลผู้ป่วย (HN: 0099999)",
  "q": "0099999",
  "searchType": "hn"
}
```

---

## ❌ ค้นด้วย AN — ใช้ไม่ได้ (ทดสอบแล้ว 2026-07-13)

ระบบ**ค้นได้ด้วย HN เท่านั้น** เคยลองเพิ่มการค้นด้วย AN (เลขที่นอน รพ. สำหรับผู้ป่วยใน)
โดยส่ง AN เข้าไปใน field `HN` ของ API ตัวเดิม — **ทดสอบในเครือข่าย รพ. แล้วไม่สำเร็จ**
จึงถอดออกทั้งหมด

สาเหตุที่น่าจะเป็น: `/api/hosxp/patient` เป็น endpoint ฝั่ง **OPD** ส่วน AN เป็นเรื่องของ **IPD**
คนละบริบทกัน

### ถ้าจะลองใหม่ในอนาคต

ต้องได้อย่างใดอย่างหนึ่งนี้ก่อน แล้วค่อยเขียนโค้ด (อย่าเริ่มจากการเขียนโค้ด):

1. **endpoint ฝั่ง IPD/AN จากผู้ดูแล API** — ถามว่า *"มี endpoint ค้นผู้ป่วยด้วย AN ไหม"*
2. **ต่อ PostgreSQL ของ HOSxP ตรงๆ** — ต้องมี host / ชื่อ DB / user แบบ read-only + password
   วิธีนี้การันตีว่าได้ผล เพราะเป็น query ที่ HOSxP ใช้เอง (`ipt` ไม่มีคอลัมน์ชื่อ ต้อง join `patient` ผ่าน `hn`):

   ```sql
   select concat(patient.pname, patient.fname, ' ', patient.lname) as patient_name
   from ipt
     left outer join patient on patient.hn = ipt.hn
   where ipt.an = '<an>'
   ```

> 💾 โค้ดฟีเจอร์ AN ที่เขียนไว้ (UI, การเก็บฟิลด์ `an`, การกันผลิตซ้ำด้วย AN) เก็บไว้ใน git stash
> ดูด้วย `git stash list` → กู้คืนด้วย `git stash pop` ถ้าวันหนึ่งได้ช่องทางค้น AN มาแล้ว

---

## Environment Variables

| ตัวแปร | ค่า Default | คำอธิบาย |
|---|---|---|
| `PORT` | `3100` | Port ของ proxy server |
| `HOST` | `127.0.0.1` | Host binding |
| `HOSXP_API_URL` | `http://172.17.1.70:3000` | Base URL ของ HOSxP API |
| `HOSXP_TOKEN` | *(token ด้านบน)* | Token สำหรับ `/api/hosxp/patient` |
| `HOSXP_TOKEN_HIS` | *(token ด้านบน)* | Token สำหรับ `/api/hosxp/HIS` |

ตัวอย่างการ override token:

```bash
HOSXP_TOKEN="eyJ..." HOSXP_TOKEN_HIS="eyJ..." ./hn-lookup.exe
```
