// firebase-init.js

// 1. Impor konfigurasi mentah dari file config.js
import { firebaseConfig } from './config.js';

// 2. Impor fungsi-fungsi yang diperlukan dari Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 3. Inisialisasi aplikasi Firebase menggunakan konfigurasi yang diimpor
const app = initializeApp(firebaseConfig);

// 4. Dapatkan instance untuk layanan Autentikasi dan Firestore
const auth = getAuth(app);
const db = getFirestore(app);

// 5. Lakukan sign-in secara anonim saat aplikasi pertama kali dimuat
signInAnonymously(auth).catch((error) => {
        console.error("Gagal melakukan sign-in anonim:", error);
});

// 6. Ekspor variabel 'db' dan 'auth' yang sudah aktif dan siap pakai
export { db, auth };