// config.js

// ---------------------------------------------------------------------------
// 1. IMPOR FUNGSI-FUNGSI DARI FIREBASE SDK
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ---------------------------------------------------------------------------
// 2. DATA KONFIGURASI STATIS
// Semua variabel dan konstanta untuk aplikasi Anda.
// ---------------------------------------------------------------------------
export const firebaseConfig = {
        apiKey: "AIzaSyDqvDqNWOu80VwrtJCnUgPewztWXDEx52o",
        authDomain: "database-f3684.firebaseapp.com",
        projectId: "database-f3684",
        storageBucket: "database-f3684.firebasestorage.app",
        messagingSenderId: "378595640412",
        appId: "1:378595640412:web:c18e3ccde798cad320d299",
        measurementId: "G-Z67FJLC8X3"
};

export const companyInfo = {
        name: "Ayam Penyet Surabaya",
        address: "Jl. Soekarno Hatta no. 725A",
        city: "Kota Bandung, 40286",
        phone: "0811-6594-527",
        email: "ayampenyetsurabaya725@gmail.com"
};

export const HIGH_QUALITY_LOGO_URL = "favicon/logo-faktur.png";
export const ATTENDANCE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMEmykWQdLjTOEvqwRpbNcoK9fXHrE6reNIBMrP27JajZ7A_X9Yj3mAsO0Fm5EiCBW/exec";
export const OFFICE_COORDS = { lat: -6.9385360, lon: 107.6662661 };
export const ALLOWED_RADIUS_KM = 0.1;

export const SHIFT_TIMES = {
        'PAGI': { hour: 7, minute: 40, grace: 0 },
        'SIANG': { hour: 12, minute: 5, grace: 0 },
        'MALAM': { hour: 13, minute: 40, grace: 0 }
};

export const monthMap = {
        "Januari": 0,
        "Februari": 1,
        "Maret": 2,
        "April": 3,
        "Mei": 4,
        "Juni": 5,
        "Juli": 6,
        "Agustus": 7,
        "September": 8,
        "Oktober": 9,
        "November": 10,
        "Desember": 11
};


// ---------------------------------------------------------------------------
// 3. INISIALISASI FIREBASE
// Menjalankan koneksi ke Firebase menggunakan konfigurasi di atas.
// ---------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

signInAnonymously(auth).catch((error) => {
        console.error("Gagal melakukan sign-in anonim:", error);
});


// ---------------------------------------------------------------------------
// 4. EKSPOR GABUNGAN
// Ekspor objek 'db' dan 'auth' yang sudah aktif agar bisa langsung dipakai.
// ---------------------------------------------------------------------------
export { db, auth };