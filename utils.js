// utils.js

// Impor Timestamp dari Firebase SDK karena dibutuhkan oleh fungsi parseDailyReport
import { Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { monthMap } from './config.js';

/**
 * Mengubah angka menjadi format mata uang Rupiah (contoh: Rp 150.000).
 * @param {number} amount - Angka yang akan diformat.
 * @returns {string} - String dalam format mata uang.
 */
export const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

/**
 * Mengubah angka menjadi format mata uang singkat (contoh: Rp 1,5 jt).
 * @param {number} amount - Angka yang akan diformat.
 * @returns {string} - String dalam format mata uang singkat.
 */
export const formatCurrencyShort = (amount) => {
        if (amount >= 1000000) {
                return 'Rp ' + (amount / 1000000).toFixed(1).replace('.', ',') + ' jt';
        }
        if (amount >= 1000) {
                return 'Rp ' + (amount / 1000).toFixed(1).replace('.', ',') + ' rb';
        }
        return formatCurrency(amount);
};

/**
 * Mengubah objek Timestamp Firebase menjadi format tanggal singkat (contoh: 26 Sep 2025).
 * @param {object} timestamp - Objek Timestamp dari Firebase.
 * @returns {string} - String tanggal yang sudah diformat.
 */
export const formatDate = (timestamp) => timestamp ? new Date(timestamp.seconds * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/**
 * Mengubah objek Timestamp Firebase menjadi format tanggal lengkap (contoh: Jumat, 26 September 2025).
 * @param {object} timestamp - Objek Timestamp dari Firebase.
 * @returns {string} - String tanggal yang sudah diformat lengkap.
 */
export const formatFullDate = (timestamp) => timestamp ? new Date(timestamp.seconds * 1000).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

// Variabel untuk mengontrol timer notifikasi toast
let toastTimer;

/**
 * Menampilkan notifikasi toast singkat di bagian bawah layar.
 * @param {string} message - Pesan yang ingin ditampilkan.
 */
export const showToast = (message) => {
        const toast = document.getElementById('toast');
        if (toastTimer) clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.add('show');
        toastTimer = setTimeout(() => {
                toast.classList.remove('show');
        }, 3000);
};

/**
 * Mengubah nomor telepon ke format standar internasional WhatsApp (62xxxx).
 * @param {string} phone - Nomor telepon yang akan diformat.
 * @returns {string} - Nomor telepon dalam format WhatsApp.
 */
export const formatWhatsappNumber = (phone) => {
        if (!phone) return '';
        let formatted = phone.replace(/\D/g, '');
        if (formatted.startsWith('0')) {
                formatted = '62' + formatted.substring(1);
        } else if (!formatted.startsWith('62')) {
                if (formatted.length > 5) {
                        formatted = '62' + formatted;
                }
        }
        return formatted;
};

/**
 * Mengekspor data array menjadi file CSV dan mengunduhnya.
 * @param {string} filename - Nama file yang akan diunduh (contoh: laporan.csv).
 * @param {string[]} headers - Array berisi judul kolom.
 * @param {Array<Array<string|number>>} data - Array 2D berisi data baris.
 */
export const exportToCsv = (filename, headers, data) => {
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
        csvContent += data.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
};

/**
 * Menghitung jarak antara dua koordinat geografis menggunakan formula Haversine.
 * @param {object} coords1 - Objek koordinat pertama {lat, lon}.
 * @param {object} coords2 - Objek koordinat kedua {lat, lon}.
 * @returns {number} - Jarak dalam kilometer.
 */
export const haversineDistance = (coords1, coords2) => {
        const toRad = (x) => x * Math.PI / 180;
        const R = 6371; // Radius bumi dalam km
        
        const dLat = toRad(coords2.lat - coords1.lat);
        const dLon = toRad(coords2.lon - coords1.lon);
        const lat1 = toRad(coords1.lat);
        const lat2 = toRad(coords2.lat);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
};

/**
 * Mem-parsing teks mentah dari laporan harian WhatsApp menjadi objek terstruktur.
 * @param {string} rawText - Teks laporan mentah.
 * @returns {object} - Objek laporan yang sudah terstruktur.
 */
export const parseDailyReport = (rawText) => {
        const report = {
                date: null,
                grandTotal: 0,
                totalNaskot: 0,
                restaurants: {
                        "Ayam Penyet Surabaya": { total: 0, phones: {} },
                        "Mie Jogja": { total: 0, phones: {} }
                }
        };
        
        const lines = rawText.trim().split('\n').map(line => line.trim()).filter(Boolean);
        const parseNumber = (str) => parseInt(String(str).replace(/[.,Rp\sbox]/g, ''), 10) || 0;
        
        let dateFound = false;
        lines.forEach(line => {
                if (!dateFound) {
                        const dateMatch = line.match(/(\d{1,2}\s\w+\s\d{4})/);
                        if (dateMatch) {
                                const [day, monthName, year] = dateMatch[1].split(' ');
                                const monthIndex = Object.keys(monthMap).findIndex(m => m.toLowerCase() === monthName.toLowerCase());
                                if (monthIndex > -1) {
                                        const jsDate = new Date(year, monthIndex, day);
                                        report.date = Timestamp.fromDate(jsDate);
                                        dateFound = true;
                                }
                        }
                }
                const totalMatch = line.match(/^\*Total\s*:\s*\*\s*([\d.,]+)/i);
                if (totalMatch) {
                        report.grandTotal = parseNumber(totalMatch[1]);
                }
                const naskotMatch = line.match(/^\*total naskot\*\s*:\s*(\d+)/i);
                if (naskotMatch) {
                        report.totalNaskot = parseNumber(naskotMatch[1]);
                }
        });
        
        if (!dateFound) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                report.date = Timestamp.fromDate(today);
        }
        
        let currentRestaurantKey = null;
        let currentPhoneKey = null;
        
        for (const line of lines) {
                if (line.toLowerCase().includes('ayam penyet surabaya')) {
                        currentRestaurantKey = "Ayam Penyet Surabaya";
                        currentPhoneKey = null;
                        continue;
                }
                if (line.toLowerCase().includes('mie jogja')) {
                        currentRestaurantKey = "Mie Jogja";
                        currentPhoneKey = null;
                        continue;
                }
                
                if (!currentRestaurantKey) {
                        continue;
                }
                
                const hpMatch = line.match(/^(Hp\d+)\s*:\s*([\d.,]+)/);
                if (hpMatch) {
                        currentPhoneKey = hpMatch[1];
                        const phoneTotal = parseNumber(hpMatch[2]);
                        report.restaurants[currentRestaurantKey].phones[currentPhoneKey] = {
                                total: phoneTotal,
                                "Makan ditempat": 0,
                                "Naskot": 0,
                                "Online": 0
                        };
                        continue;
                }
                
                const categoryMatch = line.match(/^-\s*([A-Za-z\s]+)\s*:\s*([\d.,]+)/);
                if (categoryMatch) {
                        if (!currentPhoneKey) continue;
                        
                        const categoryName = categoryMatch[1].trim();
                        const categoryValue = parseNumber(categoryMatch[2]);
                        
                        if (report.restaurants[currentRestaurantKey].phones[currentPhoneKey].hasOwnProperty(categoryName)) {
                                report.restaurants[currentRestaurantKey].phones[currentPhoneKey][categoryName] = categoryValue;
                        }
                }
        }
        
        for (const key in report.restaurants) {
                const restaurant = report.restaurants[key];
                restaurant.total = Object.values(restaurant.phones).reduce((sum, phone) => sum + phone.total, 0);
        }
        
        const hasAyamPenyetData = report.restaurants["Ayam Penyet Surabaya"].total > 0;
        const hasMieJogjaData = report.restaurants["Mie Jogja"].total > 0;
        if (!hasAyamPenyetData && !hasMieJogjaData) {
                throw new Error("Tidak ada data penjualan yang dapat dibaca. Cek kembali format teks Anda.");
        }
        
        return report;
};
