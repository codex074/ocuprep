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
2. Build ไฟล์ portable บน Windows: `npm run electron:build:portable`
3. สร้าง manifest:
   `ELECTRON_DOWNLOAD_BASE_URL=https://... npm run electron:manifest`
4. อัปโหลด `.exe` ไปยัง URL ที่กำหนด และ deploy `latest.json` ไป Vercel
5. ในแอปหน้าโปรไฟล์ ตั้ง Manifest URL เช่น
   `https://your-project.vercel.app/updates/latest.json`

## การค้นชื่อผู้ป่วยจาก HN

ตั้งแต่ v2.0.4 แอปไม่ฝัง Token ใด ๆ การค้นชื่อเรียก Vercel function `/api/patient`
(ดู `api/_lib/lookupCore.js`) ก่อน build ต้องตั้ง `VITE_LOOKUP_BASE_URL` ใน `.env.production`
เป็น URL ของ Vercel project ไม่เช่นนั้นปุ่มค้นชื่อในแอปจะใช้ไม่ได้
ไฟล์ `electron/secrets.cjs` เดิม (Token HOSxP เก่า) ไม่ถูกใช้และไม่ถูกนำเข้า exe แล้ว ลบทิ้งได้
