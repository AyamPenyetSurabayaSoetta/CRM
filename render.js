import { state, appState } from './state.js';
import {
    formatCurrency,
    formatDate,
    formatCurrencyShort,
    formatFullDate,
    showToast,
    formatWhatsappNumber
} from './utils.js';
import {
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { companyInfo, HIGH_QUALITY_LOGO_URL } from './config.js';
import { haversineDistance } from './utils.js';
import { OFFICE_COORDS, ALLOWED_RADIUS_KM, SHIFT_TIMES } from './config.js';


// 2. VARIABEL LOKAL MODUL
// Variabel untuk menyimpan instance chart agar bisa dihancurkan dan dibuat ulang.

let salesChart, expensesChart, omsetTrendChart, monthlyTurnoverChart;


// 3. EKSPOR UTAMA
// Objek renderFunctions yang berisi semua fungsi untuk memanipulasi DOM.

export const renderFunctions = {
    
    //render kalkulator omset
    renderOmsetCalculationResult: (startDate, endDate) => {
        const container = document.getElementById('hasil-omset-container');
        if (!container) return;
        
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        const filteredReports = state.dailyReports.filter(report => {
            if (!report.date) return false;
            const reportDate = report.date.toDate();
            return reportDate >= startDate && reportDate <= endDate;
        });
        
        if (filteredReports.length === 0) {
            showToast("Tidak ada data laporan harian pada rentang tanggal tersebut."); // DIUBAH
            container.classList.add('hidden');
            return;
        }
        
        const totals = {
            aps: { "Makan ditempat": 0, "Naskot": 0, "Online": 0, total: 0 },
            mj: { "Makan ditempat": 0, "Naskot": 0, "Online": 0, total: 0 },
        };
        
        filteredReports.forEach(report => {
            const apsData = report.restaurants["Ayam Penyet Surabaya"];
            if (apsData && apsData.phones) {
                Object.values(apsData.phones).forEach(phoneData => {
                    totals.aps["Makan ditempat"] += phoneData["Makan ditempat"] || 0;
                    totals.aps["Naskot"] += phoneData["Naskot"] || 0;
                    totals.aps["Online"] += phoneData["Online"] || 0;
                });
            }
            const mjData = report.restaurants["Mie Jogja"];
            if (mjData && mjData.phones) {
                Object.values(mjData.phones).forEach(phoneData => {
                    totals.mj["Makan ditempat"] += phoneData["Makan ditempat"] || 0;
                    totals.mj["Naskot"] += phoneData["Naskot"] || 0;
                    totals.mj["Online"] += phoneData["Online"] || 0;
                });
            }
        });
        
        totals.aps.total = totals.aps["Makan ditempat"] + totals.aps["Naskot"] + totals.aps["Online"];
        totals.mj.total = totals.mj["Makan ditempat"] + totals.mj["Naskot"] + totals.mj["Online"];
        const grandTotal = totals.aps.total + totals.mj.total;
        
        container.innerHTML = `
        <h3 class="font-bold text-lg mb-4 text-center">Hasil Perhitungan Omset</h3>
        <div class="mb-6">
            <div class="bg-gray-100 p-3 rounded-t-lg"><h4 class="font-bold text-xl">Ayam Penyet Surabaya</h4></div>
            <div class="border border-t-0 rounded-b-lg p-4 space-y-2 text-gray-700">
                <div class="flex justify-between"><span>Makan ditempat:</span> <span class="font-semibold">${formatCurrency(totals.aps["Makan ditempat"])}</span></div>
                <div class="flex justify-between"><span>Naskot:</span> <span class="font-semibold">${formatCurrency(totals.aps["Naskot"])}</span></div>
                <div class="flex justify-between"><span>Online:</span> <span class="font-semibold">${formatCurrency(totals.aps["Online"])}</span></div>
                <div class="flex justify-between border-t pt-2 mt-2"><span class="font-bold">Total:</span><span class="font-bold text-lg text-emerald-600">${formatCurrency(totals.aps.total)}</span></div>
            </div>
        </div>
        <div class="mb-6">
            <div class="bg-gray-100 p-3 rounded-t-lg"><h4 class="font-bold text-xl">Mie Jogja</h4></div>
            <div class="border border-t-0 rounded-b-lg p-4 space-y-2 text-gray-700">
                <div class="flex justify-between"><span>Makan ditempat:</span> <span class="font-semibold">${formatCurrency(totals.mj["Makan ditempat"])}</span></div>
                <div class="flex justify-between"><span>Naskot:</span> <span class="font-semibold">${formatCurrency(totals.mj["Naskot"])}</span></div>
                <div class="flex justify-between"><span>Online:</span> <span class="font-semibold">${formatCurrency(totals.mj["Online"])}</span></div>
                <div class="flex justify-between border-t pt-2 mt-2"><span class="font-bold">Total:</span><span class="font-bold text-lg text-emerald-600">${formatCurrency(totals.mj.total)}</span></div>
            </div>
        </div>
        <div class="bg-emerald-600 text-white p-4 rounded-lg flex justify-between items-center">
            <span class="font-bold text-2xl">Grand Total</span>
            <span class="font-bold text-3xl">${formatCurrency(grandTotal)}</span>
        </div>
    `;
        container.classList.remove('hidden');
    },
    //render brodcast pihak

updateBroadcastProgressUI: () => {
    const titleEl = document.getElementById('broadcast-progress-title');
    const statusEl = document.getElementById('broadcast-progress-status');
    const nextContactNameEl = document.getElementById('broadcast-next-contact-name');
    const actionsEl = document.getElementById('broadcast-actions');
    const completeEl = document.getElementById('broadcast-complete');
    
    if (appState.currentBroadcastIndex >= appState.broadcastQueue.length) {
        titleEl.textContent = "Broadcast Selesai";
        actionsEl.classList.add('hidden');
        completeEl.classList.remove('hidden');
    } else {
        titleEl.textContent = "Mengirim Broadcast...";
        const contact = appState.broadcastQueue[appState.currentBroadcastIndex];
        statusEl.textContent = `Mengirim ke ${appState.currentBroadcastIndex + 1} dari ${appState.broadcastQueue.length}...`;
        nextContactNameEl.textContent = contact.name;
        actionsEl.classList.remove('hidden');
        completeEl.classList.add('hidden');
    }
},
    //render absensi
    renderAttendanceReport: (attendanceData) => {
        const container = document.getElementById('absensi-report-container');
        if (!container) return;
        container.innerHTML = '';
        
        if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
            container.innerHTML = `<div class="text-center py-10"><p class="text-gray-500">Tidak ada data absensi untuk tanggal yang dipilih.</p></div>`;
            return;
        }
        
        const getStatusInfo = (status) => {
            const icons = { H: '✅', S: '🤒', I: '✉️', A: '❌' };
            const colors = { H: 'text-green-500', S: 'text-yellow-500', I: 'text-blue-500', A: 'text-red-500' };
            return { icon: icons[status] || '?', color: colors[status] || 'text-gray-400' };
        };
        
        const sortedData = attendanceData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        sortedData.forEach(entry => {
            if (!entry.timestamp || !entry.nama_karyawan) return;
            
            const itemEl = document.createElement('div');
            itemEl.className = 'bg-white p-3 border rounded-lg flex items-start gap-3 shadow-sm';
            
            const attendanceTime = new Date(entry.timestamp);
            const time = attendanceTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const statusInfo = getStatusInfo(entry.keterangan);
            
            // --- Logika untuk status "Di Lokasi" / "Di Luar Lokasi" ---
            let locationStatus = { text: 'Lokasi T/A', color: 'text-gray-400' };
            const lat = parseFloat(entry.latitude);
            const lon = parseFloat(entry.longitude);
            
            if (!isNaN(lat) && !isNaN(lon)) {
                const distance = haversineDistance(OFFICE_COORDS, { lat, lon });
                if (distance <= ALLOWED_RADIUS_KM) {
                    locationStatus = { text: 'Di Lokasi', color: 'text-green-600' };
                } else {
                    locationStatus = { text: `Di Luar Lokasi (${(distance * 1000).toFixed(0)} m)`, color: 'text-red-600' };
                }
            }
            
            // --- Logika untuk status "Tepat Waktu" / "Terlambat" ---
            let lateStatus = { text: '', color: '' };
            const shiftKey = (entry.shift?.toUpperCase() || '').split(' ')[1];
            const shiftRule = SHIFT_TIMES[shiftKey];
            
            if (shiftRule && entry.keterangan === 'H') {
                const deadline = new Date(attendanceTime);
                deadline.setHours(shiftRule.hour, shiftRule.minute, 0, 0);
                
                lateStatus = (attendanceTime > deadline) ?
                    { text: 'Terlambat', color: 'text-red-600' } :
                    { text: 'Tepat Waktu', color: 'text-green-600' };
            }
            
            const iframeHtml = !isNaN(lat) && !isNaN(lon) ?
                `<div class="mt-2 rounded-lg overflow-hidden border">
                       <iframe width="100%" height="150" style="border:0;" loading="lazy" 
                               src="https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.005},${lat-0.005},${lon+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lon}">
                       </iframe>
                   </div>` :
                '';
            
            itemEl.innerHTML = `
                <div class="flex-shrink-0 w-16 text-center">
                    <p class="font-bold text-lg text-gray-800">${time}</p>
                    <div class="mt-1 ${statusInfo.color}" title="Status: ${entry.keterangan}">
                        <span class="text-3xl">${statusInfo.icon}</span>
                    </div>
                </div>
                <div class="flex-grow border-l pl-3">
                    <p class="font-bold text-gray-900">${entry.nama_karyawan}</p>
                    <p class="text-sm text-gray-600">${entry.bagian || 'N/A'} - ${entry.shift || 'N/A'}</p>
                    <div class="flex items-center flex-wrap gap-2 text-xs mt-2">
                        ${lateStatus.text ? `<span class="font-semibold px-2 py-0.5 rounded-full ${lateStatus.color} bg-opacity-10 ${lateStatus.color.replace('text', 'bg')}">${lateStatus.text}</span>` : ''}
                        <span class="font-semibold px-2 py-0.5 rounded-full ${locationStatus.color} bg-opacity-10 ${locationStatus.color.replace('text', 'bg')}">${locationStatus.text}</span>
                    </div>
                    ${iframeHtml}
                </div>`;
            container.appendChild(itemEl);
        });
    },
    
    // render reservation
    renderReservations: () => {
        const listEl = document.getElementById('reservation-list');
        if (!listEl) return;
        
        // Ambil semua nilai filter dari appState yang terpusat
        const { date, searchTerm, status } = appState.reservationFilter;
        
        let filteredReservations = state.reservations;
        
        // 1. Filter berdasarkan tanggal yang dipilih
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            
            filteredReservations = filteredReservations.filter(res => {
                if (!res.reservationDate) return false; // Pengaman jika tanggal tidak ada
                const resDate = res.reservationDate.toDate();
                return resDate >= startOfDay && resDate <= endOfDay;
            });
        }
        
        // 2. Filter berdasarkan pencarian nama
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            filteredReservations = filteredReservations.filter(res =>
                res.customerName.toLowerCase().includes(lowerCaseSearch)
            );
        }
        
        // 3. (Nanti kita tambahkan filter status di sini)
        if (status && status !== 'all') {
            filteredReservations = filteredReservations.filter(res => res.status === status);
        }
        
        // Urutkan hasil akhir berdasarkan tanggal reservasi terbaru
        filteredReservations.sort((a, b) => {
            const dateA = a.reservationDate ? a.reservationDate.seconds : 0;
            const dateB = b.reservationDate ? b.reservationDate.seconds : 0;
            return dateB - dateA;
        });
        
        // Proses render seperti biasa...
        listEl.innerHTML = '';
        if (filteredReservations.length === 0) {
            listEl.innerHTML = `<div class="text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><h3 class="mt-2 text-sm font-medium text-gray-900">Reservasi Tidak Ditemukan</h3><p class="mt-1 text-sm text-gray-500">Tidak ada data untuk filter yang dipilih.</p></div>`;
        } else {
            filteredReservations.forEach(res => {
                const el = document.createElement('div');
                el.className = 'p-4 border rounded-lg';
                
                const resDate = res.reservationDate ? res.reservationDate.toDate() : new Date();
                const dateString = resDate.toLocaleString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                const timeString = res.reservationTime || '';
                
                const statusStyles = {
                    confirmed: 'bg-blue-100 text-blue-800',
                    arrived: 'bg-green-100 text-green-800',
                    completed: 'bg-gray-200 text-gray-700',
                    cancelled: 'bg-red-100 text-red-800'
                };
                const statusText = {
                    confirmed: 'Dikonfirmasi',
                    arrived: 'Telah Tiba',
                    completed: 'Selesai',
                    cancelled: 'Dibatalkan'
                };
                const statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full ${statusStyles[res.status] || ''}">${statusText[res.status] || res.status}</span>`;
                
                let actionButtons = '';
                if (res.status === 'confirmed') {
                    actionButtons = `<button data-id="${res.id}" class="mark-arrived-btn w-full bg-green-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold">Tandai Tiba</button>`;
                } else if (res.status === 'arrived') {
                    actionButtons = `<button data-id="${res.id}" class="mark-completed-btn w-full bg-gray-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold">Tandai Selesai</button>`;
                }
                
                let managementButtons = '';
                if (res.status === 'confirmed' || res.status === 'arrived') {
                    managementButtons = `<button data-id="${res.id}" class="edit-reservation-btn text-sm font-bold text-blue-600">EDIT</button><button data-id="${res.id}" class="cancel-reservation-btn text-sm font-bold text-orange-600">BATAL</button>`;
                }
                
                el.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-lg">${res.customerName}</p>
                        <p class="text-sm text-gray-600">${res.customerPhone || 'No. Tlp tidak ada'}</p>
                        <p class="text-sm text-gray-600 mt-1">${res.numberOfGuests} orang</p>
                    </div>
                    <div class="text-right flex-shrink-0 ml-4">
                        <p class="font-semibold">${dateString}</p>
                        <p class="text-sm font-medium text-emerald-600">${timeString}</p>
                        <div class="mt-2">${statusBadge}</div>
                    </div>
                </div>
                ${res.notes ? `<div class="mt-2 pt-2 border-t text-sm text-gray-500"><strong>Catatan:</strong> ${res.notes}</div>` : ''}
                <div class="mt-4 pt-3 border-t flex items-center justify-between">
                    <div class="flex-grow pr-4">${actionButtons}</div>
                    <div class="flex-shrink-0 flex gap-3">${managementButtons}<button data-id="${res.id}" class="delete-reservation-btn text-sm font-bold text-red-600">HAPUS</button></div>
                </div>
            `;
                listEl.appendChild(el);
            });
        }
    },
    
    renderContactList: () => {
        const listEl = document.getElementById('contact-list');
        listEl.innerHTML = '';
        const whatsappSvgIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 16 16" fill="currentColor"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg>`;
        const searchInput = document.getElementById('completedOrderSearchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const filteredContacts = state.contacts.filter(contact => {
            const nameMatch = contact.name.toLowerCase().includes(searchTerm);
            const phoneMatch = contact.phone && contact.phone.toLowerCase().includes(searchTerm);
            const addressMatch = contact.address && contact.address.toLowerCase().includes(searchTerm);
            return nameMatch || phoneMatch || addressMatch;
        });
        if (filteredContacts.length === 0) {
            listEl.innerHTML = `<div class="text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 11a4 4 0 110-5.292" /></svg><h3 class="mt-2 text-sm font-medium text-gray-900">Pelanggan tidak ditemukan</h3><p class="mt-1 text-sm text-gray-500">Coba kata kunci lain atau tambahkan pelanggan baru.</p></div>`;
        } else {
            filteredContacts.forEach(contact => {
                const item = document.createElement('div');
                item.className = 'p-3 border rounded-lg flex justify-between items-center';
                const whatsappNumber = formatWhatsappNumber(contact.phone);
                const whatsappButton = whatsappNumber ? `<a href="https://wa.me/${whatsappNumber}" target="_blank" class="text-green-600 hover:text-green-700" title="Kirim WhatsApp">${whatsappSvgIcon}</a>` : '';
                item.innerHTML = `
        <div class="flex-grow flex items-center gap-3 min-w-0">
            <input type="checkbox" data-id="${contact.id}" class="contact-checkbox h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 flex-shrink-0">
            <div class="flex-grow min-w-0">
                <p class="font-bold truncate">${contact.name}</p>
                <p class="text-sm text-gray-500 truncate">${contact.phone || '-'}</p>
                <p class="text-xs text-gray-400 mt-1 truncate">${contact.address || 'Alamat tidak tersedia'}</p>
            </div>
        </div>
        <div class="flex items-center space-x-3 flex-shrink-0">
            ${whatsappButton}
            <button data-id="${contact.id}" class="edit-contact-btn text-blue-500 font-semibold text-sm">Edit</button>
            <button data-id="${contact.id}" class="delete-contact-btn text-red-500 font-semibold text-sm">Hapus</button>
        </div>`;
                listEl.appendChild(item);
            });
        }
    },
    
    renderInventoryList: () => {
        const listEl = document.getElementById('inventory-list');
        listEl.innerHTML = '';
        if (state.inventory.length === 0) {
            listEl.innerHTML = `<div class="text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg><h3 class="mt-2 text-sm font-medium text-gray-900">Menu kosong</h3><p class="mt-1 text-sm text-gray-500">Tambahkan item untuk mengelolanya.</p></div>`;
        } else {
            state.inventory.forEach(item => {
                const el = document.createElement('div');
                el.className = 'p-3 border rounded-lg flex justify-between items-center';
                el.innerHTML = `<div><p class="font-bold">${item.name}</p></div><div class="text-right"><p class="font-semibold">${formatCurrency(item.price)}</p><div class="space-x-2"><button data-id="${item.id}" class="edit-item-btn text-xs text-blue-500 font-semibold">Edit</button><button data-id="${item.id}" class="delete-item-btn text-xs text-red-500 font-semibold">Hapus</button></div></div>`;
                listEl.appendChild(el);
            });
        }
    },
    
    renderSalesReport: () => {
        const listEl = document.getElementById('sales-report-list');
        const monthFilterEl = document.getElementById('salesMonthFilter');
        listEl.innerHTML = '';
        const sales = state.transactions.filter(tx => tx.type === 'sale');
        const monthMap = { "Januari": 0, "Februari": 1, "Maret": 2, "April": 3, "Mei": 4, "Juni": 5, "Juli": 6, "Agustus": 7, "September": 8, "Oktober": 9, "November": 10, "Desember": 11 };
        const availableMonths = [...new Set(sales.map(sale => new Date(sale.date.seconds * 1000).toLocaleString('id-ID', {
            month: 'long',
            year: 'numeric'
        })))].sort((a, b) => new Date(b.split(' ')[1], monthMap[b.split(' ')[0]]) - new Date(a.split(' ')[1], monthMap[a.split(' ')[0]]));
        const currentFilterValue = monthFilterEl.value;
        monthFilterEl.innerHTML = '<option value="">Semua Bulan</option>';
        availableMonths.forEach(month => monthFilterEl.add(new Option(month, month)));
        monthFilterEl.value = currentFilterValue;
        const searchTerm = document.getElementById('salesSearchInput').value.toLowerCase();
        const selectedMonth = monthFilterEl.value;
        const filteredSales = sales.filter(tx => (!selectedMonth || new Date(tx.date.seconds * 1000).toLocaleString('id-ID', {
            month: 'long',
            year: 'numeric'
        }) === selectedMonth) && (!searchTerm || (tx.contactName && tx.contactName.toLowerCase().includes(searchTerm))));
        if (filteredSales.length === 0) {
            listEl.innerHTML = `<div class="text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><h3 class="mt-2 text-sm font-medium text-gray-900">Tidak ada penjualan</h3><p class="mt-1 text-sm text-gray-500">Tidak ada data yang cocok dengan filter Anda.</p></div>`;
            return;
        }
        const salesByMonth = filteredSales.reduce((acc, sale) => {
            const monthYear = new Date(sale.date.seconds * 1000).toLocaleString('id-ID', {
                month: 'long',
                year: 'numeric'
            });
            if (!acc[monthYear]) {
                acc[monthYear] = {
                    sales: [],
                    total: 0
                };
            }
            acc[monthYear].sales.push(sale);
            acc[monthYear].total += sale.total;
            return acc;
        }, {});
        Object.keys(salesByMonth).sort((a, b) => new Date(b.split(' ')[1], monthMap[b.split(' ')[0]]) - new Date(a.split(' ')[1], monthMap[a.split(' ')[0]])).forEach(month => {
            const monthData = salesByMonth[month];
            const monthEl = document.createElement('div');
            monthEl.className = 'border rounded-lg';
            const salesHtml = monthData.sales.map(sale => `<li class="flex justify-between items-start py-3 px-3 border-b last:border-b-0"><div class="flex-1"><p class="font-medium">Penjualan ke ${sale.contactName}</p><p class="text-xs text-gray-500">${formatDate(sale.date)}</p><div class="mt-2 space-x-2"><button data-id="${sale.id}" class="invoice-btn text-xs font-bold text-green-600">FAKTUR</button><button data-id="${sale.id}" class="delete-tx-btn text-xs font-bold text-red-600">HAPUS</button></div></div><p class="font-semibold text-green-600 ml-4 whitespace-nowrap">${formatCurrency(sale.total)}</p></li>`).join('');
            monthEl.innerHTML = `<header class="bg-gray-50 p-3 rounded-t-lg flex justify-between items-center"><h3 class="font-bold text-lg">${month}</h3><p class="font-bold text-green-700">${formatCurrency(monthData.total)}</p></header><ul class="divide-y">${salesHtml}</ul>`;
            listEl.appendChild(monthEl);
        });
    },
    
    renderOrderList: () => {
        const listEl = document.getElementById('order-list');
        listEl.innerHTML = '';
        const pendingOrders = state.customerOrders.filter(o => o.status === 'pending');
        if (pendingOrders.length === 0) {
            listEl.innerHTML = `<div class="text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg><h3 class="mt-2 text-sm font-medium text-gray-900">Belum ada pesanan aktif</h3><p class="mt-1 text-sm text-gray-500">Tambahkan pesanan pelanggan baru.</p></div>`;
        } else {
            pendingOrders.forEach(order => {
                const itemsHtml = order.items.map(item => `<li>${item.qty}x ${item.name}</li>`).join('');
                const item = document.createElement('div');
                item.className = 'p-4 border rounded-lg space-y-3';
                const discountInfo = order.discountAmount > 0 ?
                    ` <div class="flex justify-between items-center text-sm">
                        <p class="text-red-600">Diskon</p>
                        <p class="font-semibold text-red-600">-${formatCurrency(order.discountAmount)}</p>
                    </div>` :
                    '';
                const totalSectionHtml = `
                    <div class="space-y-1 pt-3 border-t">
                        <div class="flex justify-between items-center text-sm">
                            <p class="text-gray-600">Subtotal</p>
                            <p class="font-semibold">${formatCurrency(order.subtotal || order.total)}</p>
                        </div>
                        ${discountInfo}
                        <div class="flex justify-between items-center pt-1 mt-1 border-t">
                            <p class="font-bold text-lg">Total</p>
                            <p class="font-bold text-lg">${formatCurrency(order.total)}</p>
                        </div>
                    </div>`;
                item.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-lg">${order.contactName}</p>
                            <p class="text-sm text-gray-600">Alamat: ${order.alamat || '-'}</p>
                        </div>
                        <p class="text-xs text-gray-500">${formatDate(order.orderDate)}</p>
                    </div>
                    <div class="text-sm space-y-1 pt-2 border-t">
                        <p class="font-medium">Detail Pesanan:</p>
                        <ul class="list-disc pl-5 text-gray-700">${itemsHtml}</ul>
                    </div>
                    ${totalSectionHtml} 
                    <div class="text-right space-x-2">
                        <button data-id="${order.id}" class="delete-order-btn text-xs font-bold text-red-600">HAPUS</button>
                        <button data-id="${order.id}" class="create-invoice-from-order-btn text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-md">BUAT FAKTUR</button>
                    </div>`;
                listEl.appendChild(item);
            });
        }
    },
    
    renderExpenseReport: () => {
        const listEl = document.getElementById('expense-report-list');
        const monthFilterEl = document.getElementById('expenseMonthFilter');
        listEl.innerHTML = '';
        const monthMap = { "Januari": 0, "Februari": 1, "Maret": 2, "April": 3, "Mei": 4, "Juni": 5, "Juli": 6, "Agustus": 7, "September": 8, "Oktober": 9, "November": 10, "Desember": 11 };
        const availableMonths = [...new Set(state.monthlyExpenses.map(ex => new Date(ex.date.seconds * 1000).toLocaleString('id-ID', { month: 'long', year: 'numeric' })))].sort((a, b) => new Date(b.split(' ')[1], monthMap[b.split(' ')[0]]) - new Date(a.split(' ')[1], monthMap[a.split(' ')[0]]));
        const currentFilterValue = monthFilterEl.value;
        monthFilterEl.innerHTML = '<option value="">Semua Bulan</option>';
        availableMonths.forEach(month => monthFilterEl.add(new Option(month, month)));
        monthFilterEl.value = currentFilterValue;
        const selectedMonth = monthFilterEl.value;
        const filteredExpenses = state.monthlyExpenses.filter(ex => !selectedMonth || new Date(ex.date.seconds * 1000).toLocaleString('id-ID', { month: 'long', year: 'numeric' }) === selectedMonth);
        if (filteredExpenses.length === 0) {
            listEl.innerHTML = `<div class="text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg><h3 class="mt-2 text-sm font-medium text-gray-900">Belum ada belanja</h3><p class="mt-1 text-sm text-gray-500">Catat item belanja baru melalui tombol (+).</p></div>`;
            return;
        }
        const expensesByMonth = filteredExpenses.reduce((acc, expense) => {
            const date = new Date(expense.date.seconds * 1000);
            const monthYear = date.toLocaleString('id-ID', {
                month: 'long',
                year: 'numeric'
            });
            if (!acc[monthYear]) {
                acc[monthYear] = {
                    items: [],
                    total: 0
                };
            }
            acc[monthYear].items.push(expense);
            acc[monthYear].total += expense.total;
            return acc;
        }, {});
        Object.keys(expensesByMonth).sort((a, b) => new Date(b.split(' ')[1], monthMap[b.split(' ')[0]]) - new Date(a.split(' ')[1], monthMap[a.split(' ')[0]])).forEach(month => {
            const monthData = expensesByMonth[month];
            const monthEl = document.createElement('div');
            monthEl.className = 'border rounded-lg';
            const itemsHtml = monthData.items.map(item => `<li class="flex justify-between items-center py-2 border-b last:border-b-0"><div><p class="font-medium">${item.itemName} (${item.quantity})</p><p class="text-xs text-gray-500">${formatDate(item.date)} - <strong>${item.storeName || 'N/A'}</strong></p></div><div class="flex items-center gap-4"><p class="font-semibold text-red-600">${formatCurrency(item.total)}</p><button data-id="${item.id}" class="delete-expense-btn text-red-500 text-2xl font-bold">&times;</button></div></li>`).join('');
            monthEl.innerHTML = `<header class="bg-gray-50 p-3 rounded-t-lg flex justify-between items-center"><h3 class="font-bold text-lg">${month}</h3><p class="font-bold text-red-700">${formatCurrency(monthData.total)}</p></header><ul class="p-3">${itemsHtml}</ul>`;
            listEl.appendChild(monthEl);
        });
    },
    
    renderCustomerSummary: () => {
        const listEl = document.getElementById('customer-summary-list');
        const monthFilterEl = document.getElementById('customer-summary-month-filter');
        if (!listEl || !monthFilterEl) return;
        
        listEl.innerHTML = '';
        const allSales = state.transactions.filter(tx => tx.type === 'sale');
        
        const monthMap = { "Januari": 0, "Februari": 1, "Maret": 2, "April": 3, "Mei": 4, "Juni": 5, "Juli": 6, "Agustus": 7, "September": 8, "Oktober": 9, "November": 10, "Desember": 11 };
        const availableMonths = [...new Set(allSales.map(sale => new Date(sale.date.seconds * 1000).toLocaleString('id-ID', { month: 'long', year: 'numeric' })))].sort((a, b) => new Date(b.split(' ')[1], monthMap[b.split(' ')[0]]) - new Date(a.split(' ')[1], monthMap[a.split(' ')[0]]));
        const currentFilterValue = monthFilterEl.value;
        monthFilterEl.innerHTML = '<option value="">Tampilkan Semua Bulan</option>';
        availableMonths.forEach(month => monthFilterEl.add(new Option(month, month)));
        monthFilterEl.value = currentFilterValue;
        const selectedMonth = monthFilterEl.value;
        const salesToProcess = selectedMonth ?
            allSales.filter(tx => new Date(tx.date.seconds * 1000).toLocaleString('id-ID', { month: 'long', year: 'numeric' }) === selectedMonth) :
            allSales;
        
        if (salesToProcess.length === 0) {
            listEl.innerHTML = `<div class="text-center py-16">...</div>`; // Pesan "data tidak ditemukan"
            return;
        }
        
        const summary = salesToProcess.reduce((acc, sale) => {
            const id = sale.contactId;
            if (!acc[id]) {
                acc[id] = { id: id, name: sale.contactName, purchaseCount: 0, totalSpent: 0, lastPurchaseDate: null };
            }
            acc[id].purchaseCount += 1;
            acc[id].totalSpent += sale.total;
            if (!acc[id].lastPurchaseDate || sale.date.seconds > acc[id].lastPurchaseDate.seconds) {
                acc[id].lastPurchaseDate = sale.date;
            }
            return acc;
        }, {});
        
        const sortedSummary = Object.values(summary).sort((a, b) => b.totalSpent - a.totalSpent);
        sortedSummary.forEach((customer, index) => {
            const el = document.createElement('div');
            el.className = 'p-3 border rounded-lg';
            el.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                   <span class="font-bold text-gray-400 w-6 text-center">${index + 1}</span>
                   <div>
                       <p class="font-bold">${customer.name}</p>
                       <p class="text-sm text-gray-500">Terakhir beli: ${formatDate(customer.lastPurchaseDate)}</p>
                   </div>
                </div>
                <div class="text-right">
                   <p class="font-semibold text-green-600">${formatCurrency(customer.totalSpent)}</p>
                   <p class="text-xs text-gray-500">${customer.purchaseCount}x transaksi</p>
                </div>
            </div>
            <div class="text-right mt-2 pt-2 border-t">
                <button data-id="${customer.id}" class="view-customer-details-btn text-xs font-bold text-blue-600">LIHAT DETAIL</button>
            </div>`;
            listEl.appendChild(el);
        });
    },
    
    renderCompletedOrderList: () => {
        const listEl = document.getElementById('completed-orders-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        
        // Ambil nilai filter dari elemen HTML
        const searchTerm = document.getElementById('completedOrderSearchInput')?.value.toLowerCase() || '';
        const selectedMonth = document.getElementById('completedOrderMonthFilter')?.value || '';
        
        let completedOrders = state.customerOrders.filter(o => o.status === 'completed');
        
        // Terapkan filter bulan jika ada
        if (selectedMonth) {
            completedOrders = completedOrders.filter(order =>
                order.orderDate.toDate().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) === selectedMonth
            );
        }
        
        // Terapkan filter pencarian jika ada
        if (searchTerm) {
            completedOrders = completedOrders.filter(order =>
                order.contactName.toLowerCase().includes(searchTerm) ||
                order.items.some(item => item.name.toLowerCase().includes(searchTerm))
            );
        }
        
        if (completedOrders.length === 0) {
            listEl.innerHTML = `<div class="text-center py-8"><p class="text-sm text-gray-500">Tidak ada pesanan selesai yang cocok dengan filter Anda.</p></div>`;
            return;
        }
        
        completedOrders.forEach(order => {
            const matchingTransaction = state.transactions.find(tx => tx.type === 'sale' && tx.contactId === order.contactId && tx.total === order.total && tx.date && order.orderDate && tx.date.seconds === order.orderDate.seconds);
            const itemsHtml = order.items.map(item => `<li>${item.qty}x ${item.name}</li>`).join('');
            const item = document.createElement('div');
            item.className = 'p-3 border rounded-lg bg-gray-50/70';
            item.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold">${order.contactName}</p>
                    <p class="text-sm text-gray-500">${formatCurrency(order.total)}</p>
                </div>
                <p class="text-xs text-gray-500">${formatDate(order.orderDate)}</p>
            </div>
            <div class="text-sm space-y-1 mt-2 pt-2 border-t">
                <ul class="list-disc pl-5 text-gray-600 text-xs">${itemsHtml}</ul>
            </div>
            ${matchingTransaction ?
            `<div class="text-right mt-3 pt-3 border-t flex justify-end items-center gap-4">
                <button data-id="${matchingTransaction.id}" class="reprint-invoice-btn text-xs font-bold text-blue-600">Download Faktur</button>
                <button data-order-id="${order.id}" data-transaction-id="${matchingTransaction.id}" class="delete-completed-order-btn text-xs font-bold text-red-600">HAPUS</button>
            </div>` : ''}
        `;
            listEl.appendChild(item);
        });
    },
    
    renderCompletedOrderFilters: () => {
        const monthFilterEl = document.getElementById('completedOrderMonthFilter');
        if (!monthFilterEl) return;
        const completedOrders = state.customerOrders.filter(o => o.status === 'completed');
        const monthMap = { "Januari": 0, "Februari": 1, "Maret": 2, "April": 3, "Mei": 4, "Juni": 5, "Juli": 6, "Agustus": 7, "September": 8, "Oktober": 9, "November": 10, "Desember": 11 };
        const availableMonths = [...new Set(completedOrders.map(order => new Date(order.orderDate.seconds * 1000).toLocaleString('id-ID', { month: 'long', year: 'numeric' })))].sort((a, b) => new Date(b.split(' ')[1], monthMap[b.split(' ')[0]]) - new Date(a.split(' ')[1], monthMap[a.split(' ')[0]]));
        const currentFilterValue = monthFilterEl.value;
        monthFilterEl.innerHTML = '<option value="">Ekspor Semua Bulan</option>';
        availableMonths.forEach(month => {
            const option = new Option(month, month);
            monthFilterEl.add(option);
        });
        monthFilterEl.value = currentFilterValue;
    },
    
    // render.js
    
    // Ganti seluruh fungsi renderDashboard Anda dengan ini:
    renderDashboard: () => {
        // Pastikan Anda sudah mengimpor appState di bagian atas file
        // import { state, appState } from './state.js';
        
        const currentMonth = appState.displayedDate.getMonth();
        const currentYear = appState.displayedDate.getFullYear();
        const monthlySales = state.transactions.filter(tx => tx.date && tx.type === 'sale' && new Date(tx.date.seconds * 1000).getMonth() === currentMonth && new Date(tx.date.seconds * 1000).getFullYear() === currentYear).reduce((sum, tx) => sum + tx.total, 0);
        const monthlyExpensesTotal = state.monthlyExpenses.filter(ex => ex.date && new Date(ex.date.seconds * 1000).getMonth() === currentMonth && new Date(ex.date.seconds * 1000).getFullYear() === currentYear).reduce((sum, ex) => sum + ex.total, 0);
        
        document.getElementById('monthly-sales-card').textContent = formatCurrency(monthlySales);
        document.getElementById('monthly-expenses-card').textContent = formatCurrency(monthlyExpensesTotal);
        
        const pendingOrders = state.customerOrders.filter(o => o.status === 'pending');
        document.getElementById('active-orders-count').textContent = `${pendingOrders.length} Pesanan`;
        document.getElementById('active-orders-total').textContent = formatCurrency(pendingOrders.reduce((sum, order) => sum + order.total, 0));
        
        document.querySelectorAll('.chart-week-btn').forEach(btn => {
            const week = parseInt(btn.dataset.week);
            // ▼▼▼ PERBAIKAN DI SINI ▼▼▼
            if (week === appState.chartSelectedWeek) {
                btn.classList.add('bg-emerald-100', 'text-emerald-800');
                btn.classList.remove('text-gray-500');
            } else {
                btn.classList.remove('bg-emerald-100', 'text-emerald-800');
                btn.classList.add('text-gray-500');
            }
        });
        
        const labels = [];
        const salesData = [];
        const expensesData = [];
        let startDate, endDate;
        
        // ▼▼▼ PERBAIKAN DI SINI ▼▼▼
        switch (appState.chartSelectedWeek) {
            case 1:
                startDate = new Date(currentYear, currentMonth, 1);
                endDate = new Date(currentYear, currentMonth, 7);
                break;
            case 2:
                startDate = new Date(currentYear, currentMonth, 8);
                endDate = new Date(currentYear, currentMonth, 14);
                break;
            case 3:
                startDate = new Date(currentYear, currentMonth, 15);
                endDate = new Date(currentYear, currentMonth, 21);
                break;
            case 4:
                startDate = new Date(currentYear, currentMonth, 22);
                endDate = new Date(currentYear, currentMonth + 1, 0);
                break;
        }
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            if (d.getMonth() !== currentMonth) continue;
            const startOfDay = new Date(d);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(d);
            endOfDay.setHours(23, 59, 59, 999);
            const startOfDayTimestamp = Timestamp.fromDate(startOfDay);
            const endOfDayTimestamp = Timestamp.fromDate(endOfDay);
            const dailySales = state.transactions.filter(tx => tx.type === 'sale' && tx.date && tx.date >= startOfDayTimestamp && tx.date <= endOfDayTimestamp).reduce((sum, tx) => sum + tx.total, 0);
            const dailyExpenses = state.monthlyExpenses.filter(ex => ex.date && ex.date >= startOfDayTimestamp && ex.date <= endOfDayTimestamp).reduce((sum, ex) => sum + ex.total, 0);
            labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            salesData.push(dailySales);
            expensesData.push(dailyExpenses);
        }
        renderFunctions.updateSalesChart(labels, salesData);
        renderFunctions.updateExpensesChart(labels, expensesData);
    }, // <-- Jangan lupa koma jika ada fungsi lain setelah ini
    
    renderProfile: () => {},
    
    updateSalesChart: (labels, data) => {
        const ctx = document.getElementById('sales-chart').getContext('2d');
        if (salesChart) {
            salesChart.destroy();
        }
        salesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Uang Masuk',
                    data: data,
                    backgroundColor: 'rgba(16, 185, 129, 0.5)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    },
    
    updateExpensesChart: (labels, data) => {
        const ctx = document.getElementById('expenses-chart').getContext('2d');
        if (expensesChart) {
            expensesChart.destroy();
        }
        expensesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Uang Keluar',
                    data: data,
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    },
    
    generateInvoice: async (purchaseId) => {
        const purchase = state.transactions.find(p => p.id === purchaseId);
        if (!purchase) {
            showToast("Error: Data transaksi tidak ditemukan.");
            return;
        }
        
        if (!purchase.items || !Array.isArray(purchase.items) || purchase.items.length === 0) {
            showToast("Error: Transaksi ini tidak memiliki item untuk dibuatkan faktur.");
            return;
        }
        
        const getLogoBase64 = () => {
            return new Promise((resolve, reject) => {
                if (!HIGH_QUALITY_LOGO_URL) {
                    return resolve(null);
                }
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = HIGH_QUALITY_LOGO_URL;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataURL = canvas.toDataURL('image/jpeg', 0.90);
                    resolve(dataURL);
                };
                img.onerror = () => {
                    reject(new Error("Gagal memuat gambar logo."));
                };
            });
        };
        
        showToast('Mempersiapkan faktur...');
        
        let logoBase64 = null;
        try {
            logoBase64 = await getLogoBase64();
        } catch (error) {
            console.warn(error.message);
        }
        
        try {
            const contact = state.contacts.find(c => c.id === purchase.contactId);
            const {
                jsPDF
            } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: 'a4'
            });
            
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const margin = 30;
            
            if (logoBase64) {
                doc.addImage(logoBase64, 'JPEG', margin, margin, 70, 70);
            }
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("INVOICE", pageWidth - margin, margin + 10, {
                align: 'right'
            });
            
            const d = purchase.date.toDate();
            const startOfDay = new Date(d);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(d);
            endOfDay.setHours(23, 59, 59, 999);
            const transactionsToday = state.transactions.filter(tx => {
                if (!tx.date) return false;
                const txDate = tx.date.toDate();
                return txDate >= startOfDay && txDate <= endOfDay && tx.id !== purchase.id;
            });
            const dailySequence = (transactionsToday.length + 1).toString().padStart(3, '0');
            const numericInvoiceId = `INV/${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}/${dailySequence}`;
            
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(numericInvoiceId, pageWidth - margin, margin + 25, {
                align: 'right'
            });
            
            let yPos = margin + 90;
            let sellerY = yPos;
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text("DITERBITKAN ATAS NAMA", margin, sellerY);
            sellerY += 12;
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text(companyInfo.name, margin, sellerY);
            sellerY += 12;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(companyInfo.address, margin, sellerY);
            sellerY += 10;
            doc.text(`Email: ${companyInfo.email}`, margin, sellerY);
            sellerY += 10;
            doc.text(`No. Tlpn: ${companyInfo.phone}`, margin, sellerY);
            
            let buyerY = yPos;
            const rightColX = pageWidth / 2;
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text("UNTUK", rightColX, buyerY);
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.setFont("helvetica", "normal");
            const addBuyerInfo = (label, value, y) => {
                doc.setTextColor(100);
                doc.text(label, rightColX, y);
                doc.setTextColor(0);
                doc.text(`: ${value}`, rightColX + 85, y);
                return y + 14;
            };
            buyerY = yPos + 12;
            const phone = contact ? (contact.phone || '-') : '-';
            buyerY = addBuyerInfo("Nama", purchase.contactName, buyerY);
            buyerY = addBuyerInfo("Tlpn", phone, buyerY);
            buyerY = addBuyerInfo("Tanggal Pembelian", formatDate(purchase.date), buyerY);
            doc.setTextColor(100);
            doc.text("Alamat Pengiriman", rightColX, buyerY);
            doc.setTextColor(0);
            const address = purchase.address || (contact ? contact.address : 'Tidak ada alamat');
            const addressLines = doc.splitTextToSize(address, 180);
            doc.text(`: ${addressLines.join('\n')}`, rightColX + 85, buyerY);
            buyerY += (addressLines.length * 12);
            const tableStartY = Math.max(sellerY, buyerY) + 20;
            
            const tableHead = [
                ['INFO PRODUK', 'JUMLAH', 'HARGA SATUAN', 'TOTAL HARGA']
            ];
            const tableBody = purchase.items.map(item => [
                item.name, item.qty, formatCurrency(item.price), formatCurrency(item.qty * item.price)
            ]);
            doc.autoTable({
                head: tableHead,
                body: tableBody,
                startY: tableStartY,
                theme: 'plain',
                margin: {
                    left: margin,
                    right: margin
                },
                styles: {
                    fontSize: 10,
                    cellPadding: {
                        top: 8,
                        bottom: 8,
                        left: 4,
                        right: 4
                    }
                },
                headStyles: {
                    fillColor: false,
                    textColor: 100,
                    fontStyle: 'bold',
                    lineWidth: {
                        top: 1.5,
                        bottom: 1.5
                    },
                    lineColor: [220, 220, 220]
                },
                columnStyles: {
                    0: {
                        cellWidth: 'auto',
                        fontStyle: 'bold',
                        textColor: [5, 150, 105]
                    },
                    1: {
                        halign: 'center',
                        cellWidth: 50
                    },
                    2: {
                        halign: 'right',
                        cellWidth: 80
                    },
                    3: {
                        halign: 'right',
                        cellWidth: 80
                    }
                }
            });
            
            let finalY = doc.autoTable.previous.finalY;
            const addTotalLine = (label, value, y, isBold = false) => {
                doc.setFont("helvetica", isBold ? "bold" : "normal");
                doc.text(label, pageWidth - margin - 150, y);
                doc.text(value, pageWidth - margin, y, {
                    align: 'right'
                });
                return y + 15;
            };
            
            const subtotal = purchase.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            const discountAmount = purchase.discountAmount || 0;
            const total = purchase.total;
            
            let totalY = finalY + 20;
            totalY = addTotalLine("Subtotal", formatCurrency(subtotal), totalY);
            
            if (discountAmount > 0) {
                let discountLabel = "Diskon";
                if (purchase.discountType === 'percent') {
                    discountLabel += ` (${purchase.discountValue}%)`;
                }
                doc.setTextColor(239, 68, 68);
                totalY = addTotalLine(discountLabel, `-${formatCurrency(discountAmount)}`, totalY);
                doc.setTextColor(0);
            }
            
            doc.setLineDashPattern([2, 2], 0);
            doc.line(pageWidth - margin - 150, totalY, pageWidth - margin, totalY);
            doc.setLineDashPattern([], 0);
            totalY += 10;
            doc.setFontSize(12);
            addTotalLine("TOTAL TAGIHAN", formatCurrency(total), totalY, true);
            
            const footerY = pageHeight - 50;
            doc.setLineWidth(0.5);
            doc.line(margin, footerY, pageWidth - margin, footerY);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text("Metode Pembayaran:", margin, footerY + 15);
            doc.setFont("helvetica", "bold");
            doc.text("Transfer atau COD", margin, footerY + 25);
            const updateDate = new Date().toLocaleString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            doc.setFont("helvetica", "normal");
            doc.setTextColor(150);
            doc.text(`Terakhir diupdate: ${updateDate} WIB`, pageWidth - margin, pageHeight - margin, {
                align: 'right'
            });
            
            doc.save(`faktur-${purchase.contactName.replace(/\s/g, '_')}-${numericInvoiceId}.pdf`);
        } catch (error) {
            console.error("Gagal membuat faktur (setelah memuat logo):", error);
            showToast(`Gagal: ${error.message || 'Terjadi kesalahan saat membuat PDF.'}`);
        }
    },
    
    renderChecklistReport: () => {
        const listEl = document.getElementById('checklist-report-list');
        const monthFilterEl = document.getElementById('checklistMonthFilter');
        if (!listEl || !monthFilterEl) return;
        listEl.innerHTML = '';
        const monthMap = { "Januari": 0, "Februari": 1, "Maret": 2, "April": 3, "Mei": 4, "Juni": 5, "Juli": 6, "Agustus": 7, "September": 8, "Oktober": 9, "November": 10, "Desember": 11 };
        const availableMonths = [...new Set(state.checklistHistory.map(report => report.tanggal ? new Date(report.tanggal.seconds * 1000).toLocaleString('id-ID', { month: 'long', year: 'numeric' }) : null).filter(Boolean))].sort((a, b) => new Date(b.split(' ')[1], monthMap[b.split(' ')[0]]) - new Date(a.split(' ')[1], monthMap[a.split(' ')[0]]));
        const currentFilterValue = monthFilterEl.value;
        monthFilterEl.innerHTML = '<option value="">Semua Bulan</option>';
        availableMonths.forEach(month => monthFilterEl.add(new Option(month, month)));
        monthFilterEl.value = currentFilterValue;
        const selectedMonth = monthFilterEl.value;
        const filteredReports = state.checklistHistory.filter(report => !selectedMonth || (report.tanggal && new Date(report.tanggal.seconds * 1000).toLocaleString('id-ID', { month: 'long', year: 'numeric' }) === selectedMonth));
        if (filteredReports.length === 0) {
            listEl.innerHTML = `<div class="text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><h3 class="mt-2 text-sm font-medium text-gray-900">Tidak ada laporan</h3><p class="mt-1 text-sm text-gray-500">Tidak ada data laporan kebersihan yang cocok dengan filter Anda.</p></div>`;
            return;
        }
        filteredReports.forEach(report => {
            const dateEl = document.createElement('div');
            const reportDate = report.tanggal ? new Date(report.tanggal.seconds * 1000).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }) : 'Tanggal Tidak Valid';
            const tasks = report.tasks;
            let tasksArray = [];
            if (Array.isArray(tasks)) {
                tasksArray = tasks;
            } else if (tasks && typeof tasks === 'object') {
                tasksArray = Object.values(tasks);
            }
            const tasksHtml = tasksArray.filter(task => task && task.done).map((task, index) => {
                const taskId = Object.keys(report.tasks).find(key => report.tasks[key].text === task.text && report.tasks[key].completedBy === task.completedBy);
                
                const imageHtml = task.proofUrl ? `<a href="${task.proofUrl}" target="_blank" rel="noopener noreferrer" title="Lihat gambar penuh"><img src="${task.proofUrl}" alt="${task.text}" class="w-16 h-16 object-cover rounded-md bg-gray-200"></a>` : `<div class="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400">Tdk ada gbr</div>`;
                
                const staffReviewHtml = `
                    <div class="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        <label class="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" 
                                   class="staff-check-task w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" 
                                   data-report-id="${report.id}" 
                                   data-task-id="${taskId}" 
                                   ${task.isChecked ? 'checked' : ''}>
                            Tandai sudah dicek
                        </label>
                        <div class="flex items-center gap-2">
                            <input type="text" 
                                   class="staff-comment-input flex-grow border-gray-300 rounded-md shadow-sm text-sm p-1.5" 
                                   placeholder="Beri komentar..." 
                                   data-report-id="${report.id}" 
                                   data-task-id="${taskId}"
                                   value="${task.staffComment || ''}">
                             <button 
                                class="save-comment-btn bg-indigo-500 text-white px-3 py-1 rounded-md text-sm font-semibold hover:bg-indigo-600"
                                data-report-id="${report.id}"
                                data-task-id="${taskId}">
                                Simpan
                             </button>
                        </div>
                    </div>
                `;
                
                return `<li class="flex items-start gap-3 py-3 border-b last:border-b-0">
                            ${imageHtml}
                            <div class="flex-1">
                                <p class="font-medium">${task.text}</p>
                                <p class="text-sm text-gray-600">Oleh: <strong>${task.completedBy || 'N/A'}</strong></p>
                                ${staffReviewHtml}
                            </div>
                        </li>`;
            }).join('');
            if (tasksHtml) {
                dateEl.innerHTML = `<div class="border rounded-lg mb-4"><header class="bg-gray-50 p-3 rounded-t-lg"><h3 class="font-bold text-lg">${reportDate}</h3></header><ul class="px-3">${tasksHtml}</ul></div>`;
                listEl.appendChild(dateEl);
            }
        });
    },
    
    //laporan harian
    renderDailyReportHistory: () => {
        const listEl = document.getElementById('daily-report-history-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        
        if (state.dailyReports.length === 0) {
            listEl.innerHTML = `<div class="text-center py-10"><p class="text-sm text-gray-500">Belum ada laporan yang diimpor.</p></div>`;
            return;
        }
        
        // Langkah 1: Kelompokkan semua laporan berdasarkan bulannya
        const reportsByMonth = state.dailyReports.reduce((acc, report) => {
            if (!report.date) return acc;
            const monthYear = report.date.toDate().toLocaleDateString('id-ID', {
                month: 'long',
                year: 'numeric'
            });
            if (!acc[monthYear]) {
                acc[monthYear] = [];
            }
            acc[monthYear].push(report);
            return acc;
        }, {});
        
        // Langkah 2: Dapatkan daftar bulan dan urutkan dari yang terbaru
        const sortedMonths = Object.keys(reportsByMonth).sort((a, b) => {
            return new Date(b) - new Date(a);
        });
        
        // Langkah 3: Ulangi setiap bulan untuk membuat header dan daftar laporannya
        sortedMonths.forEach(month => {
            const monthContainer = document.createElement('div');
            monthContainer.className = 'mb-6';
            
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'font-bold text-lg text-gray-700 mb-3 pb-2 border-b';
            monthHeader.textContent = month;
            monthContainer.appendChild(monthHeader);
            
            const monthList = document.createElement('div');
            monthList.className = 'space-y-3';
            
            // Langkah 4: Ulangi setiap laporan di dalam bulan tersebut
            reportsByMonth[month].forEach(report => {
                const itemEl = document.createElement('div');
                itemEl.className = 'p-4 border rounded-lg bg-white shadow-sm space-y-3';
                itemEl.innerHTML = `
                <div>
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="font-bold">${formatFullDate(report.date)}</p>
                            <p class="text-sm text-gray-500">${Object.keys(report.restaurants).length} Restoran</p>
                        </div>
                        <div class="text-right">
                            <p class="font-semibold text-green-600">${formatCurrency(report.grandTotal)}</p>
                            <p class="text-xs text-gray-500">${report.totalNaskot} Nasi Kotak</p>
                        </div>
                    </div>
                </div>
                <div class="border-t pt-3 flex justify-end items-center gap-4">
                     <button data-id="${report.id}" class="view-daily-report-btn text-sm font-bold text-blue-600 hover:underline">
                        LIHAT DETAIL
                    </button>
                    <button data-id="${report.id}" class="delete-daily-report-btn text-gray-400 hover:text-red-500 p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
                monthList.appendChild(itemEl);
            });
            
            monthContainer.appendChild(monthList);
            listEl.appendChild(monthContainer);
        });
    },
    // render.js -> di dalam objek renderFunctions

// render.js

renderCashCalculatorForm: (container) => {
    if (!container) return;
    container.innerHTML = `
        <div class="space-y-3 p-4 bg-gray-50 rounded-lg border">
            <div><label for="uf-tanggal" class="block text-sm font-medium text-gray-700">Tanggal</label><input type="date" id="uf-tanggal" class="mt-1 block w-full border-gray-300 rounded-md"></div>
            <div><label for="uf-shift" class="block text-sm font-medium text-gray-700">Shift</label><select id="uf-shift" class="mt-1 block w-full border-gray-300 rounded-md"><option>PAGI</option><option>MALAM</option></select></div>
        </div>
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg"><h3 class="font-bold text-lg mb-3">Uang Kertas & Koin</h3><div class="space-y-2">
            <div class="flex items-center gap-2"><span class="w-20 font-medium text-gray-700">Rp 100.000</span><input type="number" id="uf-input-100k" data-value="100000" placeholder="0" class="uf-input-kertas w-16 text-center border-gray-300 rounded-md p-1"><span class="flex-1 text-right font-semibold" id="uf-subtotal-100k">Rp 0</span></div>
            <div class="flex items-center gap-2"><span class="w-20 font-medium text-gray-700">Rp 50.000</span><input type="number" id="uf-input-50k" data-value="50000" placeholder="0" class="uf-input-kertas w-16 text-center border-gray-300 rounded-md p-1"><span class="flex-1 text-right font-semibold" id="uf-subtotal-50k">Rp 0</span></div>
            <div class="flex items-center gap-2"><span class="w-20 font-medium text-gray-700">Rp 20.000</span><input type="number" id="uf-input-20k" data-value="20000" placeholder="0" class="uf-input-kertas w-16 text-center border-gray-300 rounded-md p-1"><span class="flex-1 text-right font-semibold" id="uf-subtotal-20k">Rp 0</span></div>
            <div class="flex items-center gap-2"><span class="w-20 font-medium text-gray-700">Rp 10.000</span><input type="number" id="uf-input-10k" data-value="10000" placeholder="0" class="uf-input-kertas w-16 text-center border-gray-300 rounded-md p-1"><span class="flex-1 text-right font-semibold" id="uf-subtotal-10k">Rp 0</span></div>
            <div class="flex items-center gap-2"><span class="w-20 font-medium text-gray-700">Rp 5.000</span><input type="number" id="uf-input-5k" data-value="5000" placeholder="0" class="uf-input-kertas w-16 text-center border-gray-300 rounded-md p-1"><span class="flex-1 text-right font-semibold" id="uf-subtotal-5k">Rp 0</span></div>
            <div class="flex items-center gap-2"><span class="w-20 font-medium text-gray-700">Rp 2.000</span><input type="number" id="uf-input-2k" data-value="2000" placeholder="0" class="uf-input-kertas w-16 text-center border-gray-300 rounded-md p-1"><span class="flex-1 text-right font-semibold" id="uf-subtotal-2k">Rp 0</span></div>
            <div class="flex items-center gap-2 mt-3 pt-3 border-t"><span class="w-20 font-medium text-gray-700">Koin</span><input type="number" id="uf-input-koin" placeholder="Rp 0" class="uf-input flex-grow border-gray-300 rounded-md p-1"></div>
        </div><div class="flex justify-between items-center mt-4 pt-3 border-t border-blue-300"><span class="font-bold">Jumlah Uang Fisik</span><span id="uf-total-fisik-laci" class="font-bold text-lg text-blue-700">Rp 0</span></div></div>
        
        <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 class="font-bold text-lg mb-3">Pengeluaran</h3>
            <div id="uf-pengeluaran-container" class="space-y-2">
                <input type="number" placeholder="Diskon" class="uf-input-pengeluaran w-full border-gray-300 rounded-md p-1.5">
                <input type="number" placeholder="Pengeluaran Lain" class="uf-input-pengeluaran w-full border-gray-300 rounded-md p-1.5">
            </div>
            <button type="button" id="uf-add-expense-btn" class="text-sm text-emerald-600 font-semibold mt-3">+ Tambah Baris Pengeluaran</button>
            <div class="flex justify-between items-center mt-4 pt-3 border-t border-red-300">
                <span class="font-bold">Jumlah Pengeluaran</span>
                <span id="uf-total-pengeluaran" class="font-bold text-lg text-red-700">Rp 0</span>
            </div>
        </div>
        <div class="p-4 bg-gray-50 border rounded-lg"><label for="uf-modal-kasir" class="block text-sm font-medium text-gray-700">Modal Kasir</label><input type="number" id="uf-modal-kasir" placeholder="Rp 0" class="uf-input mt-1 w-full border-gray-300 rounded-md p-1.5"></div>
        <div class="p-4 bg-green-50 border border-green-200 rounded-lg"><h3 class="font-bold text-lg mb-3">Non Tunai</h3><div class="space-y-2"><input type="number" placeholder="GOFOOD" class="uf-input-nontunai w-full border-gray-300 rounded-md p-1.5"><input type="number" placeholder="GRAB" class="uf-input-nontunai w-full border-gray-300 rounded-md p-1.5"><input type="number" placeholder="SHOPEE" class="uf-input-nontunai w-full border-gray-300 rounded-md p-1.5"><input type="number" placeholder="EDC/QRIS" class="uf-input-nontunai w-full border-gray-300 rounded-md p-1.5"></div><div class="flex justify-between items-center mt-4 pt-3 border-t border-green-300"><span class="font-bold">Jumlah Non Tunai</span><span id="uf-total-nontunai" class="font-bold text-lg text-green-700">Rp 0</span></div></div>
        <div class="p-4 bg-gray-100 border rounded-lg space-y-4"><div><label for="uf-total-penjualan-sistem" class="block text-sm font-medium text-gray-700">Total Penjualan Sistem (PJL/PLU)</label><input type="number" id="uf-total-penjualan-sistem" placeholder="Rp 0" class="uf-input mt-1 w-full border-gray-300 rounded-md p-1.5"></div><div class="text-center p-4 rounded-lg bg-white border"><p class="text-sm text-gray-600">Total Uang Seharusnya</p><p id="uf-total-seharusnya" class="font-bold text-3xl text-gray-800">Rp 0</p><div class="mt-4 pt-4 border-t"><p class="text-sm font-medium text-gray-600">Selisih (+/-)</p><p id="uf-selisih" class="font-bold text-4xl text-emerald-600">Rp 0</p></div></div></div>
        <button id="uf-reset-btn" class="w-full bg-gray-200 text-gray-800 py-2.5 px-4 rounded-lg font-semibold mt-6">Reset Form</button>
    `;
},
    // render.js -> tambahkan fungsi baru ini di dalam objek renderFunctions
    
    renderDailyReportMonthFilter: (allReports) => {
        const monthFilterEl = document.getElementById('dailyReportMonthFilter');
        if (!monthFilterEl) return;
        
        // Ambil bulan unik dari semua laporan
        const availableMonths = [...new Set(allReports.map(report =>
            report.date.toDate().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        ))];
        
        // Simpan nilai yang sedang dipilih
        const currentFilterValue = monthFilterEl.value;
        
        monthFilterEl.innerHTML = '<option value="">Tampilkan Semua Bulan</option>';
        availableMonths.forEach(month => {
            const option = new Option(month, month);
            monthFilterEl.add(option);
        });
        
        // Kembalikan ke nilai yang dipilih sebelumnya (jika ada)
        monthFilterEl.value = currentFilterValue;
    },
    
    renderOmsetTrendChart: (labels, makanData, naskotData, onlineData) => {
        const chartContainer = document.getElementById('omset-trend-chart-container');
        if (!chartContainer) return;
        
        const ctx = document.getElementById('omset-trend-chart').getContext('2d');
        if (omsetTrendChart) {
            omsetTrendChart.destroy();
        }
        omsetTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Makan di Tempat',
                    data: makanData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.2
                }, {
                    label: 'Naskot',
                    data: naskotData,
                    borderColor: 'rgb(234, 179, 8)',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    fill: true,
                    tension: 0.2
                }, {
                    label: 'Online',
                    data: onlineData,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                }
            }
        });
        chartContainer.classList.remove('hidden');
    },
    
    renderMonthlyTurnoverReport: () => {
        const yearFilter = document.getElementById('monthly-report-year-filter');
        if (yearFilter.options.length === 0) {
            const availableYears = [...new Set(state.dailyReports.map(r => r.date.toDate().getFullYear()))].sort((a, b) => b - a);
            availableYears.forEach(year => yearFilter.add(new Option(year, year)));
        }
        const selectedYear = yearFilter.value ? parseInt(yearFilter.value) : new Date().getFullYear();
        
        const reportsInYear = state.dailyReports.filter(r => r.date.toDate().getFullYear() === selectedYear);
        
        const monthlyData = {};
        for (let i = 0; i < 12; i++) {
            monthlyData[i] = {
                total: 0,
                label: new Date(selectedYear, i).toLocaleString('id-ID', {
                    month: 'short'
                }),
                fullName: new Date(selectedYear, i).toLocaleString('id-ID', {
                    month: 'long',
                    year: 'numeric'
                }),
                categories: {
                    'Makan ditempat': 0,
                    'Naskot': 0,
                    'Online': 0
                },
                restaurants: {
                    'Ayam Penyet Surabaya': 0,
                    'Mie Jogja': 0
                }
            };
        }
        
        reportsInYear.forEach(report => {
            const month = report.date.toDate().getMonth();
            monthlyData[month].total += report.grandTotal || 0;
            
            for (const restoName in report.restaurants) {
                monthlyData[month].restaurants[restoName] += report.restaurants[restoName].total || 0;
                for (const phone of Object.values(report.restaurants[restoName].phones)) {
                    monthlyData[month].categories['Makan ditempat'] += phone['Makan ditempat'] || 0;
                    monthlyData[month].categories['Naskot'] += phone['Naskot'] || 0;
                    monthlyData[month].categories['Online'] += phone['Online'] || 0;
                }
            }
        });
        
        const processedMonths = Object.values(monthlyData).filter(m => m.total > 0);
        
        const totalTurnover = processedMonths.reduce((sum, val) => sum + val.total, 0);
        const avgTurnover = processedMonths.length > 0 ? totalTurnover / processedMonths.length : 0;
        
        let maxTurnover = 0;
        let bestMonthName = '-';
        processedMonths.forEach(m => {
            if (m.total > maxTurnover) {
                maxTurnover = m.total;
                bestMonthName = m.label + " " + selectedYear;
            }
        });
        
        let momGrowth = 0;
        if (processedMonths.length >= 2) {
            const currentMonthTotal = processedMonths[processedMonths.length - 1].total;
            const prevMonthTotal = processedMonths[processedMonths.length - 2].total;
            if (prevMonthTotal > 0) {
                momGrowth = ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
            }
        }
        document.getElementById('avg-monthly-turnover').textContent = formatCurrencyShort(Math.round(avgTurnover));
        document.getElementById('best-month-name').textContent = bestMonthName;
        const momEl = document.getElementById('mom-growth');
        momEl.textContent = `${momGrowth.toFixed(1)}%`;
        momEl.className = `font-bold text-lg ${momGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`;
        
        const yearlyRestoTotals = {
            'Ayam Penyet Surabaya': 0,
            'Mie Jogja': 0
        };
        Object.values(monthlyData).forEach(m => {
            yearlyRestoTotals['Ayam Penyet Surabaya'] += m.restaurants['Ayam Penyet Surabaya'];
            yearlyRestoTotals['Mie Jogja'] += m.restaurants['Mie Jogja'];
        });
        document.getElementById('aps-yearly-total').textContent = formatCurrency(yearlyRestoTotals['Ayam Penyet Surabaya']);
        document.getElementById('mj-yearly-total').textContent = formatCurrency(yearlyRestoTotals['Mie Jogja']);
        
        
        const ctx = document.getElementById('monthly-turnover-chart').getContext('2d');
        if (monthlyTurnoverChart) monthlyTurnoverChart.destroy();
        
        const monthsWithData = Object.values(monthlyData).filter(m => m.total > 0);
        
        monthlyTurnoverChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthsWithData.map(m => m.label),
                datasets: [{
                    label: 'Makan di Tempat',
                    data: monthsWithData.map(m => m.categories['Makan ditempat']),
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                }, {
                    label: 'Naskot',
                    data: monthsWithData.map(m => m.categories['Naskot']),
                    backgroundColor: 'rgba(251, 146, 60, 0.7)',
                }, {
                    label: 'Online',
                    data: monthsWithData.map(m => m.categories['Online']),
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
};