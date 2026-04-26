# Deployment Documentation

รายละเอียดฉบับเต็มอยู่ใน `README.md`

สรุปสั้น:

- Frontend ใช้ React/Vite และ deploy แบบ static ไป GitHub Pages
- Database ใช้ Firebase Firestore
- Login ใช้ข้อมูล username/password ที่เก็บใน collection `users` โดยตรง ไม่ได้ใช้ Firebase Auth
- `VITE_GAS_URL` ใช้เฉพาะตอนรัน migration script เพื่อดึงข้อมูลจาก GAS/Google Sheets เดิม
- ผู้ใช้ admin เริ่มต้น: `admin`
- รหัสผ่านเริ่มต้นคือ `1234`

ขั้นตอนแนะนำ:

1. เปิดใช้ Firestore และ deploy rules จากไฟล์ `firestore.rules`
2. ถ้าต้องการย้ายข้อมูลเดิม ให้ตั้ง `VITE_GAS_URL` แล้วรัน `npm run migrate:firestore`
3. Deploy Frontend ผ่าน GitHub Actions หรือ `npm run deploy`
