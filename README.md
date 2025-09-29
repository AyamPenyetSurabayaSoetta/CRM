# Database APS SOETTA - Aplikasi Manajemen Bisnis

## Deskripsi Singkat
Aplikasi ini adalah sistem manajemen internal (CRM/ERP sederhana) berbasis web yang dirancang untuk membantu operasional bisnis "Ayam Penyet Surabaya Soekarno-Hatta". Aplikasi ini dibangun dengan pendekatan modular menggunakan HTML, Tailwind CSS, dan Vanilla JavaScript, serta didukung oleh Firebase sebagai backend.

---

## Fitur Utama
Aplikasi ini memiliki serangkaian fitur untuk mengelola berbagai aspek bisnis:

* **Dashboard Utama**: Menampilkan ringkasan finansial bulan berjalan (penjualan vs. belanja), jumlah pesanan aktif, dan grafik penjualan mingguan.
* **Manajemen Pelanggan (Pihak)**:
    * Menambah, mengedit, dan menghapus data pelanggan.
    * Fitur pencarian pelanggan.
    * Fitur "Pilih Semua" untuk memilih beberapa pelanggan.
    * Broadcast pesan WhatsApp ke pelanggan yang dipilih.
* **Manajemen Pesanan**:
    * Membuat pesanan baru dengan detail item dan diskon (persen atau nominal).
    * Melihat daftar pesanan yang masih aktif (*pending*).
    * Melihat riwayat pesanan yang sudah selesai, lengkap dengan fitur pencarian dan filter per bulan.
* **Manajemen Menu (Inventaris)**: Mengelola daftar produk atau menu yang dijual beserta harganya.
* **Laporan & Utilitas**:
    * **Laporan Penjualan**: Menampilkan riwayat semua transaksi penjualan dengan filter.
    * **Laporan Belanja**: Mengelola dan menampilkan riwayat pengeluaran bisnis.
    * **Laporan Absensi**: Terintegrasi dengan Google Apps Script untuk menampilkan laporan kehadiran karyawan, lengkap dengan status keterlambatan, pelacakan lokasi, dan peta.
    * **Laporan Kebersihan**: Menampilkan riwayat checklist kebersihan.
    * **Laporan Omset Bulanan**: Visualisasi data omset bulanan dalam bentuk KPI dan grafik.
    * **Kalkulator**: Termasuk Kalkulator Omset, Kalkulator Pendapatan Online, dan Kalkulator Uang Fisik untuk rekap kasir.
* **Manajemen Reservasi**: Mengelola reservasi pelanggan, mengubah status (dikonfirmasi, tiba, selesai, batal), dan memfilternya berdasarkan tanggal dan nama.
* **Ekspor ke CSV**: Sebagian besar laporan memiliki fitur untuk mengekspor data ke format CSV.
* **Cetak Faktur**: Kemampuan untuk menghasilkan faktur penjualan dalam format PDF.

---

## 🛠️ Teknologi yang Digunakan
* **Frontend**:
    * HTML5
    * Tailwind CSS
    * JavaScript (ES6 Modules)
* **Backend & Database**:
    * Firebase (Firestore & Firebase Authentication)
* **Library**:
    * Chart.js (untuk grafik dan diagram)
    * jsPDF & jsPDF-AutoTable (untuk membuat faktur PDF)
* **Layanan Eksternal**:
    * Google Apps Script (untuk sistem absensi)

---

##  Cara Menjalankan Proyek
1.  **Firebase Setup**:
    * Buat sebuah proyek baru di [Firebase Console](https://console.firebase.google.com/).
    * Aktifkan **Firestore Database** dan **Authentication** (dengan metode *Anonymous sign-in*).
    * Salin konfigurasi Firebase Anda (API Key, Auth Domain, dll.).
2.  **Konfigurasi Lokal**:
    * Buka file `config.js`.
    * Tempel konfigurasi Firebase Anda ke dalam objek `firebaseConfig`.
    * Pastikan semua konstanta lain seperti `ATTENDANCE_SCRIPT_URL` sudah benar.
3.  **Jalankan Server Lokal**:
    * Karena proyek ini menggunakan ES Modules, Anda perlu menjalankannya melalui server lokal untuk menghindari error CORS.
    * Jika Anda menggunakan Visual Studio Code, ekstensi seperti **Live Server** sangat direkomendasikan. Cukup klik kanan pada file `index.html` dan pilih "Open with Live Server".