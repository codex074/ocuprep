# Deployment Documentation

รายละเอียดฉบับเต็มอยู่ใน `README.md`

สรุปสั้น:

- Frontend ใช้ React/Vite และ deploy แบบ static ไป GitHub Pages
- Backend ใช้ Google Apps Script ตามไฟล์ `gas/Code.gs`
- ค่าที่ต้องตั้งใน frontend คือ `VITE_GAS_URL`
- ผู้ใช้ admin เริ่มต้น: `admin`
- รหัสผ่านเริ่มต้นคือ `1234`

ขั้นตอนแนะนำ:

1. Deploy GAS Web App
2. นำ URL ไปตั้งเป็น `VITE_GAS_URL`
3. Deploy Frontend ผ่าน GitHub Actions หรือ `npm run deploy`
