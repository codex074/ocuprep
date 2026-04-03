# UTTH ED-Extemp

เว็บแอปสำหรับบันทึกการผลิตยาหยอดตาเฉพาะรายของกลุ่มงานเภสัชกรรม โรงพยาบาลอุตรดิตถ์ โดยแยกเป็น:

- Frontend: React + Vite + PWA
- Hosting: GitHub Pages
- Backend: Google Apps Script Web App
- Database: Google Spreadsheet

ตอนนี้โปรเจกต์ถูกปรับให้เหมาะกับการ deploy แบบ static แล้ว โดยใช้ `HashRouter` และ `base: './'` เพื่อให้เปิดผ่าน GitHub Pages ได้ครบ

## บัญชีเริ่มต้น

เมื่อ GAS สร้างฐานข้อมูลครั้งแรก ระบบจะ seed ผู้ใช้เริ่มต้นให้อัตโนมัติ

- Admin กลางของระบบ: `admin`
- รหัสผ่านเริ่มต้น: `1234`
- ผู้ใช้ทุกคนถูกตั้ง `must_change_password = true`
- `pha0` จะเป็นบัญชีของเภสัชกรตามปกติ ไม่ถูกใช้เป็น admin แล้ว

หลัง login ครั้งแรก ระบบจะบังคับเปลี่ยนรหัสผ่านทันที

## โครงสร้างสำคัญ

- `src/lib/api.ts` ตัวเชื่อมต่อ frontend ไปยัง GAS
- `gas/Code.gs` backend สำหรับ Apps Script
- `.github/workflows/deploy-pages.yml` workflow deploy ไป GitHub Pages
- `.env.example` ตัวอย่าง environment variable

## วิธีรันในเครื่อง

1. ติดตั้ง dependencies

```bash
npm install
```

2. สร้างไฟล์ `.env`

```bash
cp .env.example .env
```

3. ใส่ URL ของ Google Apps Script Web App ลงใน `VITE_GAS_URL`

```env
VITE_GAS_URL=https://script.google.com/macros/s/xxxxxxxxxxxxxxxx/exec
```

4. รันโปรเจกต์

```bash
npm run dev
```

## วิธี deploy Back end บน Google Apps Script

1. เปิด [Google Apps Script](https://script.google.com/)
2. สร้างโปรเจกต์ใหม่แบบ Standalone
3. เปิดไฟล์ `gas/Code.gs` แล้วคัดลอกไปวางในโปรเจกต์นั้น
4. กด `Deploy > New deployment > Web app`
5. ตั้งค่า:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
6. กด Deploy และอนุญาตสิทธิ์ตามขั้นตอนของ Google
7. คัดลอก `Web app URL`

หมายเหตุ:

- ไม่ต้องสร้าง Google Sheet เองก็ได้ เพราะ backend จะสร้าง Spreadsheet ให้อัตโนมัติในครั้งแรกที่ถูกเรียก
- ถ้าต้องการดู Spreadsheet ที่ถูกสร้าง สามารถเรียก action `ping` หรือดู log จากฟังก์ชัน `setupSpreadsheet()` ใน GAS ได้

## วิธี deploy Frontend ไป GitHub Pages

### แบบแนะนำ: ใช้ GitHub Actions

1. push โค้ดขึ้น GitHub repository
2. ไปที่ `Settings > Pages`
3. ที่ `Build and deployment` ให้เลือก `Source = GitHub Actions`
4. ไปที่ `Settings > Secrets and variables > Actions > Variables`
5. สร้าง repository variable ชื่อ `VITE_GAS_URL`
6. ใส่ค่าเป็น URL ของ GAS Web App ที่ได้จากขั้นตอนก่อนหน้า
7. push เข้า branch `main`
8. workflow `.github/workflows/deploy-pages.yml` จะ build และ deploy ให้อัตโนมัติ

### แบบ manual

ถ้าต้องการ deploy ด้วยเครื่องตัวเอง:

1. สร้าง `.env` และใส่ `VITE_GAS_URL`
2. รัน

```bash
npm run deploy
```

คำสั่งนี้จะ build แล้วส่ง `dist/` ไปที่ branch สำหรับ GitHub Pages ผ่าน package `gh-pages`

## ลำดับ deploy ที่แนะนำ

1. Deploy GAS ก่อน
2. ทดสอบ URL ของ GAS ด้วยการเปิด:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=ping
```

ควรได้ JSON กลับมา เช่น `{"ok":true,...}`

3. ตั้ง `VITE_GAS_URL`
4. Deploy Frontend ไป GitHub Pages
5. เปิดเว็บแล้ว login ด้วย `admin / 1234`
6. เปลี่ยนรหัสผ่าน admin ทันที

## คำสั่งที่ใช้บ่อย

```bash
npm run dev
npm run build
npm run deploy
```

## สถานะการตรวจสอบ

- `npm run build` ผ่าน
- `npm run lint` ยังไม่ผ่าน เพราะมี lint issue เดิมในหลายไฟล์ที่ไม่ได้เกี่ยวกับงานย้ายไป GAS โดยตรง
