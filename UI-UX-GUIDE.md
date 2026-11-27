# Tolk by Lunola — UI/UX Guide

Status: draft rekomendasi, belum mengubah source code.
Target visual: WhatsApp-minimal dengan liquid-glass hanya pada permukaan yang memang mengambang.

## 1. Prinsip produk

1. Chat dan pesan adalah prioritas visual. Dekorasi tidak boleh mengalahkan keterbacaan.
2. Satu aksi utama per konteks: kirim pesan, mulai panggilan, buat status, atau buat chat.
3. Semua layar harus terasa berasal dari sistem yang sama: radius, spacing, ikon, warna, dan motion konsisten.
4. Liquid glass dipakai sebagai material, bukan sebagai identitas di setiap elemen.
5. Feedback harus cepat dan tenang: state loading, sukses, gagal, offline, dan terkirim selalu terlihat.

## 2. Sistem token yang disarankan

Gunakan token CSS/tema terpusat. Komponen baru tidak boleh menambahkan hex inline kecuali ada alasan yang terdokumentasi.

### Warna

| Token | Light | Dark | Pemakaian |
|---|---|---|---|
| `--bg` | `#F6F2EB` | `#0F141E` | halaman utama |
| `--surface` | `#FFFFFF` | `#171E2C` | chat list, panel, drawer |
| `--surface-muted` | `#F5F7FA` | `#232D40` | input, hover, secondary surface |
| `--text` | `#161B26` | `#F5F7FA` | teks utama |
| `--text-muted` | `#5A6578` | `#AAB6C8` | metadata, placeholder |
| `--border` | `#E6ECF2` | `#2A364B` | separator dan outline |
| `--brand` | `#8C0027` | `#C83A5A` | aksi utama, unread, active |
| `--success` | `#16845B` | `#43C58B` | terkirim, online, sukses |
| `--danger` | `#B42318` | `#FF6B6B` | hapus, error, report |

Kontras minimum: 4.5:1 untuk teks biasa, 3:1 untuk teks besar/icon informatif. Jangan memakai maroon gelap sebagai teks kecil di surface gelap.

### Bentuk dan layout

- Radius: `8px` kontrol kecil, `12px` row/card, `16px` panel, `20px` composer/modal. Hindari radius baru di luar skala.
- Spacing: basis 4px; gunakan `4, 8, 12, 16, 20, 24, 32`.
- Border: satu garis `1px`; jangan menggabungkan border tebal + shadow keras.
- Shadow: satu shadow lembut untuk modal/FAB/composer; chat bubble dan row normal tanpa shadow.
- Ikon: satu library dan ukuran konsisten (16 metadata, 20 kontrol, 24 navigasi).
- Target sentuh minimum 44×44px.

## 3. Material liquid glass

Pakai glass hanya untuk elemen floating:

- composer pesan dan attachment tray;
- modal, drawer, context menu;
- bottom navigation/mobile action bar;
- call overlay dan floating action button.

Material recipe:

```css
background: color-mix(in srgb, var(--surface) 78%, transparent);
backdrop-filter: blur(18px) saturate(135%);
border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
box-shadow: 0 8px 28px rgb(15 20 30 / 12%);
```

Chat list, message area, dan halaman admin tetap solid. Ini menjaga teks jelas, mengurangi biaya rendering, dan membuat dark mode stabil.

## 4. Aturan per layar

### Auth

- Satu kolom fokus, logo kecil, judul singkat, helper text seperlunya.
- Login/register/error memakai field dan tombol yang sama; jangan membuat varian visual baru.
- Error tampil di dekat field dan tidak hanya lewat toast.
- Password punya show/hide, Caps Lock hint, dan status loading pada tombol.

### Chat list

- Header: logo kecil + judul + satu menu overflow.
- Search selalu mudah ditemukan, tetapi tidak mengambil tinggi berlebihan.
- Row: avatar 44px, nama maksimal satu baris, preview dua baris, waktu/unread sejajar.
- Pinned, archived, muted, locked dibedakan lewat ikon/label kecil, bukan warna tambahan besar.
- Empty state harus menawarkan satu CTA yang jelas: “Mulai chat”.

### Chat window

- Header solid; glass hanya composer dan menu yang mengambang.
- Bubble incoming/outgoing konsisten; status delivered/read berada di metadata kecil.
- Pesan panjang wrap normal; attachment punya preview dan ukuran file.
- Composer tetap terlihat di keyboard mobile; tombol mic/send berbentuk lingkaran terpisah.
- Typing indicator tidak menggeser layout secara agresif.

### Stories, calls, admin

- Stories: ring aksen secukupnya; jangan menjadikan seluruh kartu gradien.
- Calls: satu hierarki tombol: mute/speaker/video sebagai secondary, end call sebagai danger.
- Admin: gunakan tabel/card solid, status chip, filter jelas, dan konfirmasi sebelum aksi destruktif.

## 5. Motion system

- Default transition: 160–240ms, `ease-out`.
- Modal/drawer: opacity + translate 8–16px; tidak perlu slam/pop besar.
- Send message: satu spring ringan (overshoot kecil), maksimal 240ms.
- Tab switch: underline/pill bergerak, bukan seluruh layout melompat.
- Delete/archive: fade + collapse 220–280ms, lalu commit aksi.
- Jangan animasikan width/height besar bila transform/opacity cukup.
- `prefers-reduced-motion: reduce` wajib mematikan blur bergerak, parallax, spring, dan transition panjang.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 6. Konsistensi teknis yang perlu dibereskan

1. Selesaikan error TypeScript `Sidebar.tsx` (`onOpenOverflowMenu` vs `_onOpenOverflowMenu`) sebelum styling lanjutan.
2. Pindahkan warna/radius/shadow hard-coded ke token; review `Sidebar`, `ChatWindow`, `Modals`, `StoriesBar`, `CallsView`, dan `AdminPanel`.
3. Hapus varian lama yang bentrok (Playful Crisp/Sky-Butter/Maroon/brutal) atau map semuanya ke token baru.
4. Perbaiki string encoding rusak seperti `Â·`/`â€¢` dan pastikan file UTF-8.
5. Tambahkan visual regression screenshot untuk light/dark di desktop, tablet, dan mobile.

## 7. Urutan implementasi aman

### Sprint 1 — fondasi

- Fix lint/typecheck.
- Bekukan token warna, radius, spacing, typography, elevation.
- Tambahkan `prefers-reduced-motion` global.
- Rapikan encoding string.

### Sprint 2 — core chat

- Chat list, chat window, composer, modal, drawer.
- Terapkan glass hanya pada floating surfaces.
- Uji keyboard, focus, responsive, offline, loading, error.

### Sprint 3 — secondary surfaces

- Stories, calls, contacts, settings, admin.
- Samakan button/input/badge/icon dan dark mode.

### Sprint 4 — release hardening

- Screenshot regression dan accessibility pass.
- `npm ci`, lint, build frontend/server, smoke test health/auth/WebSocket.
- Review bundle, PWA cache, upload, dan mobile APK.

## 8. Definition of done UI

- `npm run lint` dan build bersih.
- Tidak ada hex inline baru di komponen yang sudah punya token.
- Light/dark memiliki kontras AA pada core flow.
- Semua kontrol utama keyboard-accessible dan target sentuh ≥44px.
- Reduced motion lolos cek manual.
- Chat list → chat → composer terasa satu sistem, tanpa lompatan layout.
- Screenshot regression tidak menunjukkan perubahan tak sengaja.
- Baru setelah checklist ini lulus, perubahan visual dianggap siap dipublish.

