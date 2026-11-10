# Sinkronisasi Akun User OPD ke Firebase Authentication — OPTIMIS Kabupaten Blora

Menyediakan mekanisme registrasi dan sinkronisasi otomatis maupun massal untuk seluruh akun OPD/Instansi (`[username]@oppkpke.com`) dari menu **Manajemen User** langsung ke **Firebase Authentication** tanpa mengganggu sesi login Admin yang sedang aktif.

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan konfirmasi Anda, sinkronisasi akun ke Firebase Authentication akan berjalan secara **otomatis setiap kali Admin menambah/memperbarui user** serta dilengkapi **tombol Sinkronisasi Massal** dengan **notifikasi progres** untuk mendaftarkan seluruh akun OPD yang sudah ada sekaligus.

- **Confirmed Decision 1 (Metode Sinkronisasi)**: Sinkronisasi berjalan otomatis saat tambah/edit user baru di Manajemen User **dan** tersedia tombol sinkronisasi massal (*Sinkronkan ke Firebase Auth*) untuk mendaftarkan seluruh akun OPD yang sudah ada di tabel.
- **Confirmed Decision 2 (Umpan Balik Antarmuka)**: Menampilkan **notifikasi progres berjalan** (jumlah akun yang sedang didaftarkan dari total akun) beserta notifikasi selesai tanpa menambah kolom/badge baru di setiap baris tabel agar tabel tetap ringkas dan mudah dibaca.

---

## 1. Overview & Core Concept

- **What It Does**:
  - Sebelumnya, akun OPD yang dibuat di menu **Manajemen User** langsung tersimpan di koleksi Cloud Firestore (`user_accounts`), namun baru didaftarkan ke tab **Firebase Console > Authentication > Users** saat masing-masing OPD melakukan login pertama kali (*lazy registration*).
  - Dengan pembaruan ini, setiap akun OPD akan langsung didaftarkan ke **Firebase Authentication** menggunakan *Secondary Firebase Auth Provisioner* begitu akun dibuat, maupun secara serentak melalui tombol **Sinkronkan ke Firebase Auth**.
- **Target Audience / Persona**: Administrator Bapperida Kabupaten Blora yang mengelola puluhan akun OPD/Dinas/Badan, RSUD, Puskesmas, Kecamatan, dan Kelurahan serta memantau daftar pengguna di Firebase Console.
- **Key Value**: Seluruh akun OPD langsung tercatat di **Firebase Authentication > Users** secara utuh tanpa harus menunggu masing-masing OPD login satu per satu, sekaligus menjaga sesi Admin tetap aktif.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Tambah / Edit User Otomatis**: Saat Admin menambahkan atau menyimpan perubahan akun OPD pada modal **Tambah User**, sistem langsung menyimpan data ke Firestore sekaligus mendaftarkan email `[username]@oppkpke.com` ke Firebase Authentication di latar belakang, lalu menampilkan notifikasi sukses.
  2. **Sinkronisasi Massal Satu Klik**: Pada header halaman **Manajemen User**, Admin menekan tombol **Sinkronkan ke Firebase Auth**. Sistem menampilkan banner/notifikasi progres (`Menyinkronkan akun ke Firebase Authentication: 8 / 65 akun...`) hingga seluruh akun selesai terdaftar di Firebase Authentication.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Clean Institutional Enterprise Dashboard yang selaras dengan identitas visual **OPTIMIS** Kabupaten Blora.
  - *Color Palette & Mood*: Kanvas utama putih bersih (`#FFFFFF`) dan abu-abu sejuk (`#F8FAFF`), aksen utama biru institusional (`#2563EB` / `#1D4ED8`), serta warna semantik hijau zamrud (`#059669`) untuk indikator keberhasilan sinkronisasi.
  - *Typography & Hierarchy*: Menggunakan `Plus Jakarta Sans` untuk struktur judul dan navigasi, serta `JetBrains Mono` (`tabular-nums`) untuk angka progres sinkronisasi (`12 / 65`) dan kredensial.
  - *Component Styling & Layout*: Mengikuti prinsip *Single-Elevation Depth* pada toolbar **Manajemen User** dengan tombol aksi satu baris (`whitespace-nowrap shrink-0`) dan banner progres ringkas yang muncul hanya saat proses sinkronisasi massal berlangsung.
- **Interactive Feedback & Motion**:
  - Tombol **Sinkronkan ke Firebase Auth** menampilkan ikon pemutar (*spinner*) dan teks progres *real-time* selama proses berjalan, kemudian ditutup dengan *toast notification* yang merangkum jumlah akun yang berhasil disinkronkan.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Secondary Firebase App Instance untuk Provisioning Akun**
  - *Chosen Approach*: Menggunakan instance aplikasi Firebase kedua yang terisolasi (*Secondary Auth Provisioner*) khusus untuk memanggil pendaftaran akun baru ke Firebase Authentication.
  - *Why*: Pada SDK Web Firebase standar, pemanggilan `createUserWithEmailAndPassword` pada instance utama akan otomatis mengubah sesi login aktif menjadi user yang baru dibuat (sehingga Admin akan ter-logout). Dengan *Secondary App Instance*, akun OPD dapat didaftarkan ke Firebase Authentication di latar belakang sementara Admin tetap login dengan aman.
  - *Alternatives Considered*: Mendaftarkan akun menggunakan instance autentikasi utama — ditolak karena akan memutus sesi Admin setiap kali menambah user baru.
- **Decision 2: Penanganan Akun yang Sudah Terdaftar (`email-already-in-use`)**
  - *Chosen Approach*: Saat sinkronisasi massal menemukan akun yang sudah lebih dulu ada di Firebase Authentication (misalnya 4 akun yang sudah pernah login sebelumnya), sistem otomatis melewati atau memverifikasi akun tersebut sebagai sudah tersinkron tanpa menghasilkan pesan error.
  - *Why*: Memastikan tombol sinkronisasi massal bersifat *idempotent* (aman dijalankan kapan saja berulang kali tanpa duplikasi atau kegagalan).

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Halaman Manajemen User (UI)                      │
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐  │
│  │ Modal Tambah / Edit / Massal  │  │ Tombol Sinkronkan Firebase Auth│  │
│  └───────────────┬───────────────┘  └────────────────┬───────────────┘  │
│                  │                                   │                  │
│                  ▼                                   ▼                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │         Banner & Toast Notifikasi Progres (X / Total Akun)        │  │
│  └───────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Layanan Data & Sinkronisasi (Service)                 │
│                                                                         │
│   1. Simpan Dokumen Profil  ──────►  Cloud Firestore (`user_accounts`)  │
│                                                                         │
│   2. Secondary Auth App     ──────►  Firebase Authentication (`Users`)  │
│      (Tanpa memutus sesi Admin)      Email: [username]@oppkpke.com      │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - Setiap entitas `AuthUser` memiliki `username`, `email` berformat standar `[username]@oppkpke.com`, dan `password_hint` (dinormalisasi minimal 6 karakter sesuai syarat Firebase Authentication).
  - State progres sinkronisasi massal (`isSyncingAuth`, `syncProgress: { current, total, currentEmail }`) dikelola di komponen tampilan **Manajemen User** untuk menampilkan progres secara langsung.
- **Interactive Component & State Mapping**:
  - **Saat Tambah/Edit User Disimpan**: Menyimpan ke `localStorage` dan koleksi Firestore `user_accounts`, lalu secara asinkron memanggil *Secondary Auth Provisioner* untuk memastikan akun langsung terdaftar di Firebase Authentication.
  - **Saat Tombol Sinkronkan ke Firebase Auth Diklik**: Membaca seluruh daftar akun aktif, menjalankan *batch provisioning* secara berurutan dengan jeda aman agar tidak terkena *rate-limit* Firebase Auth, memperbarui indikator `current / total`, dan menampilkan *toast* hasil akhir.
