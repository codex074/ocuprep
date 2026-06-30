# YATA Portable Update ผ่าน Vercel

แอปตรวจไฟล์ manifest ทุก 6 ชั่วโมงและหลังเปิดแอป 5 วินาที เมื่อพบเวอร์ชันใหม่
ผู้ใช้กดอนุญาตครั้งเดียว จากนั้นแอปจะดาวน์โหลด ตรวจ SHA-256 แทนที่ไฟล์ portable
เดิม และเปิดใหม่อัตโนมัติ

## รูปแบบ manifest

เผยแพร่ `latest.json` บน HTTPS:

```json
{
  "version": "1.1.0",
  "url": "https://your-project.vercel.app/downloads/YATA-1.1.0-portable.exe",
  "sha256": "64-character-lowercase-sha256",
  "notes": "รายละเอียดการเปลี่ยนแปลง"
}
```

ไฟล์ `.exe` อาจเก็บใน Vercel Blob แล้วใส่ Blob URL ใน `url` เพื่อไม่ติดข้อจำกัด
ขนาดไฟล์ deploy ของ Vercel ส่วน `latest.json` วางเป็น static file ใน Vercel project ได้

## ขั้นตอน release

1. เปลี่ยน `version` ใน `package.json`
2. Build บน Windows: `npm run electron:build`
3. สร้าง manifest:
   `ELECTRON_DOWNLOAD_BASE_URL=https://... npm run electron:manifest`
4. อัปโหลด `.exe` ไปยัง URL ที่กำหนด และ deploy `latest.json` ไป Vercel
5. ในแอปหน้าโปรไฟล์ ตั้ง Manifest URL เช่น
   `https://your-project.vercel.app/updates/latest.json`

Token HOSxP ถูกฝังเฉพาะใน portable executable ที่ build ภายในองค์กรและไม่ถูกส่งไป Vercel

## Token สำหรับ build ภายในองค์กร

คัดลอก `electron/secrets.example.cjs` เป็น `electron/secrets.cjs` แล้วใส่ Token จริง
ก่อน build ไฟล์ `electron/secrets.cjs` ถูก `.gitignore` และต้องไม่ commit ขึ้น GitHub
แต่ electron-builder จะนำไฟล์นี้เข้า portable executable จากเครื่อง build
