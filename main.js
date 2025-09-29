// main.js

// ---------------------------------------------------------------------------
// 1. IMPOR SEMUA MODUL YANG DIBUTUHKAN
// ---------------------------------------------------------------------------
import { db, auth } from './firebase-init.js';
import { state, appState } from './state.js';
import * as utils from './utils.js';
import { renderFunctions } from './render.js';
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    doc,
    addDoc,
    setDoc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    writeBatch,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ATTENDANCE_SCRIPT_URL } from './config.js';
let contactModal,
    itemModal,
    expenseModal,
    customerOrderModal,
    reservationModal,
    statusFilterModal,
    datePickerModal,
    dailyReportDetailModal,
    customerDetailModal,
    confirmDeleteModal,
    confirmInvoiceModal,
    broadcastModal,
    broadcastProgressModal,
    confirmCancelReservationModal;

const fabContainer = document.getElementById('fab-container');

// Fungsi update bulan beranda
const updateMonthDisplay = () => {
    const displayEl = document.getElementById('month-display');
    const nextBtn = document.getElementById('next-month-btn');
    if (!displayEl || !nextBtn) return;
    
    displayEl.textContent = appState.displayedDate.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric'
    });
    
    const now = new Date();
    const isCurrentOrFutureMonth = appState.displayedDate.getFullYear() > now.getFullYear() ||
        (appState.displayedDate.getFullYear() === now.getFullYear() && appState.displayedDate.getMonth() >= now.getMonth());
    
    nextBtn.disabled = isCurrentOrFutureMonth;
    nextBtn.classList.toggle('opacity-50', isCurrentOrFutureMonth);
    nextBtn.classList.toggle('cursor-not-allowed', isCurrentOrFutureMonth);
};
// 2. FUNGSI INISIALISASI (UNTUK MODAL & EVENT LISTENER)
// ---------------------------------------------------------------------------
function initializeApplication(db) {
    const modalContainer = document.getElementById('modal-container');
    
    // -- Fungsi Bantuan Internal --
    const createModal = (id, title, content, onSubmit) => {
        const lastButtonIndex = content.lastIndexOf('<button type="submit"');
        const formFields = content.substring(0, lastButtonIndex);
        const submitButton = content.substring(lastButtonIndex);
        const modalHTML = ` <div id="${id}" class="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50 hidden"> <div class="modal-content bg-white w-full rounded-t-2xl relative"> <header class="p-4 border-b flex justify-between items-center"> <h3 class="font-bold text-lg">${title}</h3> <button class="close-modal-btn text-gray-500 text-2xl font-bold">&times;</button> </header> <form autocomplete="off"> <div class="p-4 max-h-[65vh] overflow-y-auto">${formFields}</div> <div class="p-4 border-t">${submitButton}</div> </form> </div> </div>`;
        modalContainer.insertAdjacentHTML('beforeend', modalHTML);
        const modalEl = document.getElementById(id);
        const formEl = modalEl.querySelector('form');
        const show = (data = {}) => {
            formEl.reset();
            formEl.dataset.id = data.id || '';
            Object.keys(data).forEach(key => {
                const input = formEl.elements[key];
                if (input) input.value = data[key];
            });
            modalEl.classList.remove('hidden');
        };
        const hide = () => modalEl.classList.add('hidden');
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) hide();
        });
        modalEl.querySelector('.close-modal-btn').addEventListener('click', hide);
        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = formEl.querySelector('button[type="submit"]');
            if (!submitBtn) return;
            const originalBtnHTML = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Menyimpan...`;
            const formData = new FormData(formEl);
            const data = Object.fromEntries(formData.entries());
            data.id = formEl.dataset.id;
            try {
                const successMessage = await onSubmit(data, formEl);
                if (successMessage) {
                    utils.showToast(successMessage);
                }
                hide();
            } catch (error) {
                console.error("Error submitting form: ", error);
                if (typeof error === 'string' || error instanceof String || error.message) utils.showToast(error.message || error);
                else utils.showToast("Gagal menyimpan data. Cek konsol.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
            }
        });
        return { show, hide, formEl, modalEl };
    };
    const createConfirmationModal = (id, title, message, confirmText = 'Hapus', confirmClass = 'bg-red-600') => {
        const modalHTML = `<div id="${id}" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] hidden"><div class="modal-content bg-white w-11/12 max-w-sm rounded-lg p-6 text-center" style="animation: none;"><h3 class="font-bold text-lg mb-2">${title}</h3><p class="text-gray-600 mb-6">${message}</p><div class="flex justify-center gap-4"><button class="cancel-btn px-6 py-2 rounded-lg border">Batal</button><button class="confirm-btn px-6 py-2 rounded-lg text-white ${confirmClass}">${confirmText}</button></div></div></div>`;
        modalContainer.insertAdjacentHTML('beforeend', modalHTML);
        const modalEl = document.getElementById(id);
        let resolvePromise;
        const show = () => {
            modalEl.classList.remove('hidden');
            return new Promise(resolve => {
                resolvePromise = resolve;
            });
        };
        const hide = () => modalEl.classList.add('hidden');
        modalEl.querySelector('.confirm-btn').addEventListener('click', () => {
            hide();
            if (resolvePromise) resolvePromise(true);
        });
        modalEl.querySelector('.cancel-btn').addEventListener('click', () => {
            hide();
            if (resolvePromise) resolvePromise(false);
        });
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                hide();
                if (resolvePromise) resolvePromise(false);
            }
        });
        return { show };
    };
    
    // -- Definisi Konten dan Pembuatan Semua Modal --
    const contactModalContent = `<div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700">Nama</label><input type="text" name="name" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">No. Telepon</label><input type="tel" name="phone" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"></div><div><label class="block text-sm font-medium text-gray-700">Alamat</label><textarea name="address" rows="3" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"></textarea></div></div><button type="submit" class="mt-6 w-full bg-emerald-600 text-white py-2 px-4 rounded-md shadow-sm font-medium">Simpan Pelanggan</button>`;
    
    
    
    contactModal = createModal('contact-modal', 'Tambah/Edit Pelanggan', contactModalContent, async (data) => {
        const payload = {
            name: data.name,
            phone: data.phone,
            address: data.address
        };
        if (data.id) {
            await updateDoc(doc(db, 'contacts', data.id), payload);
            return 'Pelanggan berhasil diperbarui!';
        } else {
            await addDoc(collection(db, 'contacts'), payload);
            return 'Pelanggan baru berhasil ditambahkan!';
        }
    });
    
    const itemModalContent = `<div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700">Nama Barang</label><input type="text" name="name" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">Harga Jual</label><input type="number" name="price" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div></div><button type="submit" class="mt-6 w-full bg-emerald-600 text-white py-2 px-4 rounded-md shadow-sm font-medium">Simpan Barang</button>`;
    itemModal = createModal('item-modal', 'Tambah/Edit Barang', itemModalContent, async (data) => {
        const payload = {
            name: data.name,
            price: Number(data.price)
        };
        if (data.id) {
            await updateDoc(doc(db, 'inventory', data.id), payload);
            return 'Barang berhasil diperbarui!';
        } else {
            await addDoc(collection(db, 'inventory'), payload);
            return 'Barang baru berhasil ditambahkan!';
        }
    });
    
    const expenseModalContent = `<div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700">Tanggal Pembelian</label><input type="date" name="purchaseDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">Nama Toko</label><input type="text" name="storeName" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"></div><div><label class="block text-sm font-medium text-gray-700">Nama Barang</label><input type="text" name="itemName" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">Jumlah/Satuan</label><input type="text" name="quantity" value="1" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">Total Harga</label><input type="number" name="total" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div></div><button type="submit" class="mt-6 w-full bg-emerald-600 text-white py-2 px-4 rounded-md shadow-sm font-medium">Simpan Belanja</button>`;
    expenseModal = createModal('expense-modal', 'Catat Belanja Baru', expenseModalContent, async (data) => {
        const purchaseDate = data.purchaseDate ? Timestamp.fromDate(new Date(data.purchaseDate)) : serverTimestamp();
        const payload = {
            itemName: data.itemName,
            quantity: data.quantity,
            total: Number(data.total),
            storeName: data.storeName,
            date: purchaseDate
        };
        await addDoc(collection(db, 'monthly_expenses'), payload);
        return 'Item belanja berhasil dicatat!';
    });
    
    const customerOrderModalContent = `<div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700">Tanggal Pesanan</label><input type="date" name="orderDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div class="relative"><label class="block text-sm font-medium text-gray-700">Nama Pelanggan</label><input type="text" name="customerName" id="customer-name-input" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required autocomplete="off"><div id="customer-suggestions-box" class="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto hidden"></div></div><div><label class="block text-sm font-medium text-gray-700">No. Telepon (Opsional)</label><input type="tel" name="customerPhone" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"></div><div><label class="block text-sm font-medium text-gray-700">Alamat Pengiriman</label><textarea name="alamat" rows="2" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"></textarea></div><div class="border-t pt-4"><h4 class="font-medium mb-2">Barang yang Dipesan</h4><div id="order-items-container" class="space-y-2"></div><button type="button" id="add-order-item-btn" class="mt-2 text-sm text-emerald-600 font-semibold">+ Tambah Barang</button></div><div class="border-t pt-4 space-y-3"><h4 class="font-medium">Diskon / Potongan Harga</h4><div class="flex items-center gap-2"><div class="flex-grow"><input type="number" id="order-discount-value" placeholder="Masukkan nilai" class="w-full border border-gray-300 rounded-md py-2 px-3 text-sm"></div><div class="flex-shrink-0"><div class="flex items-center border border-gray-300 rounded-md text-sm font-semibold"><button type="button" data-type="percent" class="order-discount-type-btn px-4 py-2 text-gray-500 rounded-l-md bg-emerald-100 text-emerald-800">%</button><button type="button" data-type="amount" class="order-discount-type-btn px-4 py-2 text-gray-500 rounded-r-md border-l">Rp</button></div><input type="hidden" id="order-discount-type" value="percent"></div></div></div><div class="border-t pt-4 space-y-2 text-right"><div><span class="text-sm text-gray-600">Subtotal:</span><span id="order-subtotal-amount" class="text-sm font-semibold text-gray-800">${utils.formatCurrency(0)}</span></div><div><span class="text-sm text-red-600">Diskon:</span><span id="order-discount-amount-display" class="text-sm font-semibold text-red-600">${utils.formatCurrency(0)}</span></div><div class="mt-1"><span class="text-gray-600 font-medium">Total Pesanan:</span><span id="order-total-amount" class="font-bold text-2xl">${utils.formatCurrency(0)}</span></div></div></div><button type="submit" class="mt-6 w-full bg-emerald-600 text-white py-2 px-4 rounded-md shadow-sm font-medium">Simpan Pesanan</button>`;
    customerOrderModal = createModal('customer-order-modal', 'Pesanan Baru', customerOrderModalContent, async (data, form) => {
        const customerName = data.customerName.trim();
        const customerPhone = data.customerPhone.trim();
        const customerAddress = form.elements['alamat'].value.trim();
        if (!customerName) {
            throw new Error("Nama pelanggan harus diisi.");
        }
        let contactId;
        let contactName = customerName;
        const existingContact = state.contacts.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        if (existingContact) {
            contactId = existingContact.id;
            if (existingContact.phone !== customerPhone || existingContact.address !== customerAddress) {
                await updateDoc(doc(db, 'contacts', existingContact.id), {
                    phone: customerPhone,
                    address: customerAddress
                });
                utils.showToast(`Info kontak ${customerName} diperbarui.`);
            }
        } else {
            const newContactPayload = {
                name: contactName,
                phone: customerPhone,
                address: customerAddress
            };
            const newContactRef = await addDoc(collection(db, 'contacts'), newContactPayload);
            contactId = newContactRef.id;
            utils.showToast(`Pelanggan baru "${contactName}" telah ditambahkan.`);
        }
        const items = [];
        form.querySelectorAll('.order-item-row').forEach(row => {
            const itemId = row.querySelector('select[name="itemId"]').value;
            const itemData = state.inventory.find(i => i.id === itemId);
            const qty = Number(row.querySelector('input[name="qty"]').value);
            if (itemData && qty > 0) {
                items.push({
                    id: itemId,
                    name: itemData.name,
                    price: itemData.price,
                    qty: qty
                });
            }
        });
        if (items.length === 0) {
            throw new Error("Tambahkan minimal satu barang pesanan.");
        }
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const discountValue = parseFloat(form.querySelector('#order-discount-value').value) || 0;
        const discountType = form.querySelector('#order-discount-type').value;
        let discountAmount = 0;
        if (discountType === 'percent' && discountValue > 0) {
            discountAmount = subtotal * (discountValue / 100);
        } else if (discountType === 'amount' && discountValue > 0) {
            discountAmount = discountValue;
        }
        discountAmount = Math.min(subtotal, discountAmount);
        const total = subtotal - discountAmount;
        const orderDate = data.orderDate ? Timestamp.fromDate(new Date(data.orderDate)) : serverTimestamp();
        const payload = {
            contactId: contactId,
            contactName: contactName,
            alamat: customerAddress,
            items: items,
            subtotal: subtotal,
            discountType: discountType,
            discountValue: discountValue,
            discountAmount: discountAmount,
            total: total,
            status: 'pending',
            orderDate: orderDate
        };
        await addDoc(collection(db, 'customer_orders'), payload);
        return 'Pesanan baru berhasil disimpan!';
    });
    //modal untuk detail di laporan harian
    const dailyReportDetailModalContent = `<div id="daily-report-detail-content"></div><button type="submit" class="hidden">OK</button>`;
    
    dailyReportDetailModal = createModal(
        'daily-report-detail-modal',
        'Detail Laporan Harian',
        dailyReportDetailModalContent,
        () => {} // Fungsi submit kosong
    );
    // main.js -> di dalam document.body.addEventListener('click', ...)
    
    
    
    
    // --- Helper functions for dynamic forms ---
    const updateOrderTotal = () => {
        let subtotal = 0;
        document.querySelectorAll('#order-items-container .order-item-row').forEach(row => {
            const itemId = row.querySelector('select[name="itemId"]').value;
            const itemData = state.inventory.find(i => i.id === itemId);
            const qty = Number(row.querySelector('input[name="qty"]').value);
            if (itemData && qty > 0) {
                subtotal += itemData.price * qty;
            }
        });
        const discountValue = parseFloat(document.getElementById('order-discount-value').value) || 0;
        const discountType = document.getElementById('order-discount-type').value;
        let discountAmount = 0;
        if (discountType === 'percent') {
            discountAmount = subtotal * (discountValue / 100);
        } else {
            discountAmount = discountValue;
        }
        discountAmount = Math.min(subtotal, discountAmount);
        const finalTotal = subtotal - discountAmount;
        document.getElementById('order-subtotal-amount').textContent = utils.formatCurrency(subtotal);
        document.getElementById('order-discount-amount-display').textContent = utils.formatCurrency(discountAmount);
        document.getElementById('order-total-amount').textContent = utils.formatCurrency(finalTotal);
    };
    
    const addOrderItemRow = () => {
        const container = document.getElementById('order-items-container');
        const itemRow = document.createElement('div');
        itemRow.className = 'order-item-row flex items-center gap-2';
        const options = state.inventory.map(item => `<option value="${item.id}" data-price="${item.price}">${item.name}</option>`).join('');
        itemRow.innerHTML = `<select name="itemId" class="flex-grow border border-gray-300 rounded-md py-1 px-2 text-sm">${options}</select><input type="number" name="qty" value="1" min="1" class="w-16 border border-gray-300 rounded-md py-1 px-2 text-sm"><button type="button" class="remove-order-item-btn text-red-500 text-2xl font-bold">&times;</button>`;
        container.appendChild(itemRow);
        updateOrderTotal();
    };
    // --- Event Listener untuk Pintasan Pesanan Baru ---
    const shortcutNewOrderBtn = document.getElementById('shortcut-new-order');
    if (shortcutNewOrderBtn) {
        shortcutNewOrderBtn.addEventListener('click', () => {
            if (state.inventory.length === 0) {
                utils.showToast("Tidak ada barang di inventaris untuk dipesan.");
                return;
            }
            
            // Pastikan variabel 'customerOrderModal' sudah didefinisikan
            const form = customerOrderModal.formEl;
            form.elements['orderDate'].value = new Date().toISOString().split('T')[0];
            
            const itemsContainer = document.getElementById('order-items-container');
            if (itemsContainer) itemsContainer.innerHTML = '';
            
            addOrderItemRow();
            customerOrderModal.show();
        });
    }
    
    // main.js -> di dalam initializeApplication()

const broadcastModalContent = `<div class="space-y-4"><div><label for="broadcast-message" class="block text-sm font-medium text-gray-700">Pesan Broadcast</label><textarea name="message" id="broadcast-message" rows="6" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="Ketik pesan Anda di sini... (cth: Halo {nama}, ...)" required></textarea><p class="mt-2 text-xs text-gray-500">Gunakan <code class="bg-gray-200 px-1 rounded">{nama}</code> untuk menyisipkan nama pelanggan.</p></div></div><button type="submit" class="mt-6 w-full bg-green-600 text-white py-2 px-4 rounded-md shadow-sm font-medium">Lanjutkan & Mulai Kirim</button>`;

broadcastModal = createModal('broadcast-modal', 'Broadcast WhatsApp', broadcastModalContent, async (data) => {
    appState.broadcastMessageTemplate = data.message;
    const checkedBoxes = document.querySelectorAll('#contact-list .contact-checkbox:checked');
    if (!appState.broadcastMessageTemplate) {
        throw new Error("Pesan tidak boleh kosong.");
    }
    appState.broadcastQueue = Array.from(checkedBoxes).map(cb => state.contacts.find(c => c.id === cb.dataset.id)).filter(contact => contact && contact.phone && utils.formatWhatsappNumber(contact.phone));
    if (appState.broadcastQueue.length === 0) {
        throw new Error("Tidak ada pelanggan terpilih yang memiliki nomor telepon valid.");
    }
    appState.currentBroadcastIndex = 0;
    
    // Tampilkan modal progres
    broadcastProgressModal.show();
    renderFunctions.updateBroadcastProgressUI();
    return `Memulai broadcast untuk ${appState.broadcastQueue.length} pelanggan...`;
});

// Modal untuk progres broadcast
const broadcastProgressModalContent = `
    <div id="broadcast-progress-content" class="text-center">
        <h3 id="broadcast-progress-title" class="font-bold text-lg mb-2">Mengirim Broadcast...</h3>
        <p id="broadcast-progress-status" class="text-gray-600 mb-4">Mempersiapkan...</p>
        <div id="broadcast-target-info" class="bg-gray-100 p-3 rounded-lg mb-6">
            <p class="text-sm">Berikutnya:</p>
            <p id="broadcast-next-contact-name" class="font-bold text-xl">-</p>
        </div>
        <div id="broadcast-actions">
            <button id="broadcast-send-next-btn" class="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold mb-3">Buka WhatsApp & Kirim</button>
            <button id="broadcast-cancel-btn" class="w-full text-gray-600 py-2">Batalkan Broadcast</button>
        </div>
        <div id="broadcast-complete" class="hidden">
             <svg class="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 class="font-bold text-lg mt-4">Broadcast Selesai</h3>
            <p class="text-gray-600 mb-6">Semua pesan telah diproses.</p>
            <button id="broadcast-close-btn" class="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg">Tutup</button>
        </div>
    </div>
    <button type="submit" class="hidden">OK</button>`;

broadcastProgressModal = createModal('broadcast-progress-modal', '', broadcastProgressModalContent, () => {});
    const reservationModalContent = `<div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700">Nama Pelanggan</label><input type="text" name="customerName" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">Nomor Telepon (Opsional)</label><input type="tel" name="customerPhone" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"></div><div><label class="block text-sm font-medium text-gray-700">Jumlah Orang</label><input type="number" name="numberOfGuests" min="1" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">Tanggal</label><input type="date" name="reservationDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">Waktu</label><input type="time" name="reservationTime" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required></div><div><label class="block text-sm font-medium text-gray-700">Catatan (Opsional)</label><textarea name="notes" rows="2" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"></textarea></div></div><button type="submit" class="mt-6 w-full bg-emerald-600 text-white py-2 px-4 rounded-md shadow-sm font-medium">Simpan Reservasi</button>`;
    reservationModal = createModal('reservation-modal', 'Buat/Edit Reservasi', reservationModalContent, async (data, formEl) => {
        const reservationDateTime = new Date(`${data.reservationDate}T${data.reservationTime}`);
        const payload = {
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            numberOfGuests: Number(data.numberOfGuests),
            reservationDate: Timestamp.fromDate(reservationDateTime),
            reservationTime: data.reservationTime,
            notes: data.notes,
        };
        if (formEl.dataset.id) {
            await updateDoc(doc(db, 'reservations', formEl.dataset.id), payload);
            return 'Reservasi berhasil diperbarui!';
        } else {
            payload.status = 'confirmed';
            payload.createdAt = serverTimestamp();
            await addDoc(collection(db, 'reservations'), payload);
            return 'Reservasi baru berhasil disimpan!';
        }
    });
    
    
    confirmDeleteModal = createConfirmationModal('confirm-delete-modal', 'Konfirmasi Hapus', 'Apakah Anda yakin ingin menghapus item ini?', 'Ya, Hapus', 'bg-red-600');
    const customerDetailModalContent = `<div id="customer-detail-list-container"></div><button type="submit" class="hidden">OK</button>`;
    
    customerDetailModal = createModal(
        'customer-detail-modal',
        'Detail Transaksi', // Ini hanya judul awal
        customerDetailModalContent,
        () => {}
    );
    confirmInvoiceModal = createConfirmationModal('confirm-invoice-modal', 'Konfirmasi Pembuatan Faktur', 'Buat faktur untuk pesanan ini? Aksi ini akan membuat catatan transaksi baru.', 'Ya, Buat Faktur', 'bg-green-600');
    confirmCancelReservationModal = createConfirmationModal('confirm-cancel-modal', 'Konfirmasi Pembatalan', 'Apakah Anda yakin ingin membatalkan reservasi ini?', 'Ya, Batalkan', 'bg-red-600');
    // main.js -> di dalam initializeApplication()
    
    // ...setelah definisi 'confirmCancelReservationModal'
    
    const statusFilterModalContent = `
    <div class="space-y-2">
        <button data-status="all" class="status-option-btn w-full text-left p-3 bg-gray-100 rounded-lg">Semua Status</button>
        <button data-status="confirmed" class="status-option-btn w-full text-left p-3 bg-gray-100 rounded-lg">Dikonfirmasi</button>
        <button data-status="arrived" class="status-option-btn w-full text-left p-3 bg-gray-100 rounded-lg">Telah Tiba</button>
        <button data-status="completed" class="status-option-btn w-full text-left p-3 bg-gray-100 rounded-lg">Selesai</button>
        <button data-status="cancelled" class="status-option-btn w-full text-left p-3 bg-gray-100 rounded-lg">Dibatalkan</button>
    </div>
    <button type="submit" class="hidden">OK</button>`;
    
    statusFilterModal = createModal(
        'status-filter-modal',
        'Filter Berdasarkan Status',
        statusFilterModalContent,
        () => {} // Fungsi submit kosong karena kita tangani via klik tombol
    );
    
    statusFilterModal.modalEl.addEventListener('click', (e) => {
        const target = e.target.closest('.status-option-btn');
        if (!target) return;
        
        const selectedStatus = target.dataset.status;
        const statusText = target.textContent;
        
        // 1. Update state
        appState.reservationFilter.status = selectedStatus;
        
        // 2. Update teks tombol filter utama
        document.getElementById('reservation-status-filter').textContent = statusText;
        
        // 3. Render ulang daftar
        renderFunctions.renderReservations();
        
        // 4. Tutup modal
        statusFilterModal.hide();
    });
    
    
    const datePickerModalContent = `
    <div class="p-4">
        <label for="modal-date-input" class="block text-sm font-medium text-gray-700">Pilih tanggal untuk ditampilkan</label>
        <input type="date" id="modal-date-input" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
    </div>
    <button type="submit" class="mt-4 w-full bg-emerald-600 text-white py-2.5 px-4 rounded-md font-medium">Terapkan Tanggal</button>`;
    
    datePickerModal = createModal('date-picker-modal', 'Pilih Tanggal', datePickerModalContent, (data, formEl) => {
        const dateInput = formEl.querySelector('#modal-date-input');
        const newDate = dateInput.value;
        
        if (newDate) {
            // 1. Update state
            appState.reservationFilter.date = newDate;
            
            // 2. Update teks tombol utama
            const displayDate = new Date(newDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            document.getElementById('show-custom-date-picker').textContent = displayDate;
            
            // 3. Render ulang daftar
            renderFunctions.renderReservations();
        }
        return null; // Tidak perlu toast
    });
    
    // -- Event Listener untuk Sugesti Pelanggan di Modal Pesanan --
const customerNameInput = customerOrderModal.formEl.querySelector('#customer-name-input');
const customerPhoneInput = customerOrderModal.formEl.querySelector('input[name="customerPhone"]');
const customerAddressInput = customerOrderModal.formEl.querySelector('textarea[name="alamat"]');
const suggestionsBox = customerOrderModal.formEl.querySelector('#customer-suggestions-box');

if (customerNameInput && suggestionsBox) {
    // 1. Tampilkan saran saat pengguna mengetik
    customerNameInput.addEventListener('input', () => {
        const searchTerm = customerNameInput.value.toLowerCase();
        if (searchTerm.length === 0) {
            suggestionsBox.classList.add('hidden');
            return;
        }
        
        const filteredContacts = state.contacts.filter(contact =>
            contact.name.toLowerCase().includes(searchTerm)
        ).slice(0, 5); // Batasi hingga 5 saran teratas
        
        if (filteredContacts.length > 0) {
            suggestionsBox.innerHTML = filteredContacts.map(contact =>
                `<div class="suggestion-item p-3 hover:bg-gray-100 cursor-pointer" data-id="${contact.id}">
                        <p class="font-semibold text-sm">${contact.name}</p>
                        <p class="text-xs text-gray-500">${contact.phone || 'No. Telepon tidak ada'}</p>
                    </div>`
            ).join('');
            suggestionsBox.classList.remove('hidden');
        } else {
            suggestionsBox.classList.add('hidden');
        }
    });
    
    // 2. Isi form saat salah satu saran diklik
    suggestionsBox.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestion-item');
        if (suggestionItem) {
            const contactId = suggestionItem.dataset.id;
            const selectedContact = state.contacts.find(c => c.id === contactId);
            if (selectedContact) {
                customerNameInput.value = selectedContact.name;
                customerPhoneInput.value = selectedContact.phone || '';
                customerAddressInput.value = selectedContact.address || '';
            }
            suggestionsBox.classList.add('hidden'); // Sembunyikan box setelah memilih
        }
    });
    
    // 3. Sembunyikan saran jika pengguna klik di luar area input/saran
    document.addEventListener('click', (e) => {
        if (!customerNameInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add('hidden');
        }
    });
}
    
    // -- Event Listener Umum (Delegasi Event untuk Tombol Dinamis) --
    document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('button, div');
        
        if (!target) return;
        
        // Aksi Tombol FAB (Floating Action Button)
        if (target.id === 'fab-add-contact') contactModal.show();
        if (target.id === 'fab-add-item') itemModal.show();
        if (target.id === 'fab-add-expense') expenseModal.show({ purchaseDate: new Date().toISOString().split('T')[0] });
        
        if (target.id === 'fab-add-order') {
            // Logika dari tombol pintasan kita salin langsung ke sini
            if (state.inventory.length === 0) {
                utils.showToast("Tidak ada barang di inventaris untuk dipesan.");
                return;
            }
            
            const form = customerOrderModal.formEl;
            form.elements['orderDate'].value = new Date().toISOString().split('T')[0];
            
            const itemsContainer = document.getElementById('order-items-container');
            if (itemsContainer) itemsContainer.innerHTML = '';
            
            addOrderItemRow();
            customerOrderModal.show();
        }
        if (target.id === 'fab-add-reservation') {
            const today = new Date();
            const dateString = today.toISOString().split('T')[0];
            reservationModal.show({ reservationDate: dateString, reservationTime: '07:00' });
        }
        //aksi untuk broadcast
if (target.id === 'broadcast-send-next-btn') {
    if (appState.currentBroadcastIndex < appState.broadcastQueue.length) {
        const contact = appState.broadcastQueue[appState.currentBroadcastIndex];
        const message = appState.broadcastMessageTemplate.replace(/{nama}/g, contact.name.split(' ')[0]);
        const whatsappNumber = utils.formatWhatsappNumber(contact.phone);
        const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        appState.currentBroadcastIndex++;
        renderFunctions.updateBroadcastProgressUI();
    }
}
if (target.id === 'broadcast-cancel-btn' || target.id === 'broadcast-close-btn') {
    broadcastProgressModal.hide();
}
        // Aksi untuk melihat detail Laporan Harian
        if (target.classList.contains('view-daily-report-btn')) {
            const reportId = target.dataset.id;
            const reportData = state.dailyReports.find(r => r.id === reportId);
            if (!reportData) {
                utils.showToast("Data laporan tidak ditemukan.");
                return;
            }
            
            // Menggunakan modal yang sudah didefinisikan di main.js
            const detailContent = dailyReportDetailModal.modalEl.querySelector('#daily-report-detail-content');
            
            let contentHtml = `<h4 class="font-bold text-lg mb-2">${utils.formatFullDate(reportData.date)}</h4>`;
            for (const [name, data] of Object.entries(reportData.restaurants)) {
                contentHtml += `<div class="mt-4 border-t pt-2">
                            <div class="flex justify-between items-center">
                                <h5 class="font-bold">${name}</h5>
                                <p class="font-semibold">${utils.formatCurrency(data.total)}</p>
                            </div>`;
                for (const [phone, phoneData] of Object.entries(data.phones)) {
                    contentHtml += `<div class="pl-4 mt-2">
                                <p class="font-medium text-sm">${phone}: ${utils.formatCurrency(phoneData.total)}</p>
                                <ul class="list-disc pl-5 text-xs text-gray-600">
                                    <li>Makan ditempat: ${utils.formatCurrency(phoneData['Makan ditempat'])}</li>
                                    <li>Naskot: ${utils.formatCurrency(phoneData['Naskot'])}</li>
                                    <li>Online: ${utils.formatCurrency(phoneData['Online'])}</li>
                                </ul>
                            </div>`;
                }
                contentHtml += `</div>`;
            }
            contentHtml += `<div class="mt-6 border-t pt-4 text-center space-y-2">
                        <p>Total Nasi Kotak: <strong class="text-lg">${reportData.totalNaskot}</strong></p>
                        <p>Grand Total: <strong class="text-2xl text-green-700">${utils.formatCurrency(reportData.grandTotal)}</strong></p>
                   </div>`;
            
            detailContent.innerHTML = contentHtml;
            dailyReportDetailModal.show(); // Tampilkan modal
        }
        
        // Aksi CRUD (Create, Read, Update, Delete)
        
        if (target.classList.contains('delete-contact-btn')) {
            const confirmed = await confirmDeleteModal.show();
            if (confirmed) {
                await deleteDoc(doc(db, 'contacts', target.dataset.id));
                utils.showToast('Pelanggan berhasil dihapus.');
            }
        }
        if (target.classList.contains('edit-contact-btn')) {
            const contact = state.contacts.find(c => c.id === target.dataset.id);
            if (contact) contactModal.show(contact);
        }
        if (target.classList.contains('delete-item-btn')) {
            const confirmed = await confirmDeleteModal.show();
            if (confirmed) {
                await deleteDoc(doc(db, 'inventory', target.dataset.id));
                utils.showToast('Barang berhasil dihapus.');
            }
        }
        if (target.classList.contains('edit-item-btn')) {
            const item = state.inventory.find(i => i.id === target.dataset.id);
            if (item) itemModal.show(item);
        }
        if (target.classList.contains('delete-order-btn')) {
            const confirmed = await confirmDeleteModal.show();
            if (confirmed) {
                await deleteDoc(doc(db, 'customer_orders', target.dataset.id));
                utils.showToast('Pesanan berhasil dihapus.');
            }
        }
// Aksi untuk menghapus Riwayat Pesanan Selesai (Versi Lengkap)
if (target.classList.contains('delete-completed-order-btn')) {
    const confirmed = await confirmDeleteModal.show();
    if (confirmed) {
        // Ambil kedua ID dari tombol yang Anda buat di render.js
        const orderId = target.dataset.orderId;
        const transactionId = target.dataset.transactionId;
        
        if (!orderId || !transactionId) {
            utils.showToast("Error: ID pesanan atau transaksi tidak ditemukan.");
            return;
        }
        
        try {
            // Gunakan batch write untuk memastikan keduanya terhapus atau tidak sama sekali
            const batch = writeBatch(db);
            
            const orderRef = doc(db, 'customer_orders', orderId);
            batch.delete(orderRef);
            
            const transactionRef = doc(db, 'transactions', transactionId);
            batch.delete(transactionRef);
            
            await batch.commit();
            utils.showToast('Riwayat pesanan & transaksi terkait berhasil dihapus.');
            
        } catch (error) {
            console.error("Gagal menghapus data ganda:", error);
            utils.showToast('Gagal menghapus data dari database.');
        }
    }
}
        if (target.classList.contains('create-invoice-from-order-btn')) {
            const orderId = target.dataset.id;
            const order = state.customerOrders.find(o => o.id === orderId);
            if (!order) {
                utils.showToast("Error: Pesanan tidak ditemukan.");
                return;
            }
            const confirmed = await confirmInvoiceModal.show();
            if (confirmed) {
                try {
                    const batch = writeBatch(db);
                    const newTransactionRef = doc(collection(db, "transactions"));
                    batch.set(newTransactionRef, {
                        contactId: order.contactId,
                        contactName: order.contactName,
                        items: order.items,
                        subtotal: order.subtotal,
                        discountType: order.discountType || 'percent',
                        discountValue: order.discountValue || 0,
                        discountAmount: order.discountAmount || 0,
                        total: order.total,
                        type: 'sale',
                        date: order.orderDate,
                        address: order.alamat || ''
                    });
                    const orderRef = doc(db, "customer_orders", orderId);
                    batch.update(orderRef, {
                        status: "completed"
                    });
                    await batch.commit();
                    utils.showToast("Faktur berhasil dibuat dari pesanan!");
                } catch (error) {
                    console.error("Gagal membuat faktur dari pesanan:", error);
                    utils.showToast("Gagal memproses faktur.");
                }
            }
        }
        
        
        // -- Aksi Khusus Halaman Reservasi --
        
        // Aksi untuk menandai reservasi 'confirmed' menjadi 'arrived'
        if (target.classList.contains('mark-arrived-btn')) {
            const reservationId = target.dataset.id;
            try {
                await updateDoc(doc(db, 'reservations', reservationId), {
                    status: 'arrived'
                });
                utils.showToast('Reservasi ditandai telah tiba.');
            } catch (error) {
                console.error("Gagal update status tiba: ", error);
                utils.showToast('Gagal memperbarui status.');
            }
        }
        
        // Aksi untuk menandai reservasi 'arrived' menjadi 'completed'
        if (target.classList.contains('mark-completed-btn')) {
            const reservationId = target.dataset.id;
            try {
                await updateDoc(doc(db, 'reservations', reservationId), {
                    status: 'completed'
                });
                utils.showToast('Reservasi ditandai selesai.');
            } catch (error) {
                console.error("Gagal update status selesai: ", error);
                utils.showToast('Gagal memperbarui status.');
            }
        }
        
        // Aksi untuk mengedit reservasi
        if (target.classList.contains('edit-reservation-btn')) {
            const reservationId = target.dataset.id;
            const reservation = state.reservations.find(r => r.id === reservationId);
            if (reservation) {
                // Salin data dan format tanggal agar sesuai dengan input form
                const dataForModal = { ...reservation };
                if (reservation.reservationDate) {
                    dataForModal.reservationDate = reservation.reservationDate.toDate().toISOString().split('T')[0];
                }
                reservationModal.show(dataForModal);
            }
        }
        
        // Aksi untuk membatalkan reservasi
        if (target.classList.contains('cancel-reservation-btn')) {
            const confirmed = await confirmCancelReservationModal.show();
            if (confirmed) {
                const reservationId = target.dataset.id;
                try {
                    await updateDoc(doc(db, 'reservations', reservationId), {
                        status: 'cancelled'
                    });
                    utils.showToast('Reservasi berhasil dibatalkan.');
                } catch (error) {
                    console.error("Gagal membatalkan reservasi: ", error);
                    utils.showToast('Gagal membatalkan reservasi.');
                }
            }
        }
        
        // Aksi untuk menghapus reservasi
        if (target.classList.contains('delete-reservation-btn')) {
            const confirmed = await confirmDeleteModal.show();
            if (confirmed) {
                const reservationId = target.dataset.id;
                try {
                    await deleteDoc(doc(db, 'reservations', reservationId));
                    utils.showToast('Reservasi berhasil dihapus.');
                } catch (error) {
                    console.error("Gagal menghapus reservasi: ", error);
                    utils.showToast('Gagal menghapus reservasi.');
                }
            }
        }
        
        // ... (logika tombol hapus lainnya) ...
        
        // Aksi untuk menghapus Laporan Harian
        if (target.classList.contains('delete-daily-report-btn')) {
            const reportId = target.dataset.id;
            
            // Tampilkan modal konfirmasi yang sudah kita miliki
            const confirmed = await confirmDeleteModal.show();
            
            if (confirmed) {
                try {
                    await deleteDoc(doc(db, 'daily_reports', reportId));
                    utils.showToast('Laporan harian berhasil dihapus.');
                } catch (error) {
                    console.error("Gagal menghapus laporan harian:", error);
                    utils.showToast('Gagal menghapus laporan.');
                }
            }
        }
        
        
        
        // ... (dan semua aksi hapus/edit lainnya)
        //...Lihat detail rangkuman
        if (target.classList.contains('view-customer-details-btn')) {
            const customerId = target.dataset.id;
            const transactionForName = state.transactions.find(tx => tx.contactId === customerId);
            
            if (!transactionForName) {
                utils.showToast("Error: Pelanggan tidak ditemukan.");
                return;
            }
            
            // Mengubah judul modal
            customerDetailModal.modalEl.querySelector('h3').textContent = `Transaksi: ${transactionForName.contactName}`;
            
            // ▼▼▼ PERBAIKAN UTAMA DI SINI ▼▼▼
            // 1. Cari wadah konten di dalam modal yang spesifik
            const detailsContainer = customerDetailModal.modalEl.querySelector('#customer-detail-list-container');
            
            // 2. Saring semua transaksi untuk pelanggan ini
            const sales = state.transactions
                .filter(tx => tx.type === 'sale' && tx.contactId === customerId)
                .sort((a, b) => b.date.seconds - a.date.seconds); // Urutkan dari terbaru
            
            if (sales.length > 0) {
                // 3. Buat HTML persis seperti di screenshot tujuan Anda
                detailsContainer.innerHTML = `
            <ul class="divide-y divide-gray-100 -mx-4">
                ${sales.map(sale => `
                    <li class="py-3 px-4">
                        <div class="flex justify-between items-center">
                            <p class="font-bold text-gray-800">${utils.formatDate(sale.date)}</p>
                            <p class="font-bold text-lg text-emerald-600">${utils.formatCurrency(sale.total)}</p>
                        </div>
                        <ul class="list-disc pl-5 text-sm text-gray-600 mt-2">
                            ${sale.items.map(item => `<li>${item.qty}x ${item.name} @ ${utils.formatCurrency(item.price)}</li>`).join('')}
                        </ul>
                        <div class="text-right mt-3">
                            <button data-id="${sale.id}" class="invoice-btn text-xs font-bold text-blue-600 hover:underline">ULANG FAKTUR</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
            } else {
                detailsContainer.innerHTML = `<p class="text-center text-gray-500 py-8">Tidak ada riwayat transaksi.</p>`;
            }
            
            customerDetailModal.show();
        }
        
        // Aksi Faktur dan Pesanan
        if (target.classList.contains('invoice-btn') || target.classList.contains('reprint-invoice-btn')) {
            renderFunctions.generateInvoice(target.dataset.id);
        }
        if (target.classList.contains('create-invoice-from-order-btn')) {
            const orderId = target.dataset.id;
            const order = state.customerOrders.find(o => o.id === orderId);
            if (!order) return;
            const confirmed = await confirmInvoiceModal.show();
            if (confirmed) {
                // ... (logika untuk membuat faktur dari pesanan) ...
            }
        }
    });
    
    // -- Event Listener Halaman Spesifik (dengan Pengecekan Null) --
    const prevMonthBtn = document.getElementById('prev-month-btn');
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            appState.displayedDate.setMonth(appState.displayedDate.getMonth() - 1);
            updateMonthDisplay();
            renderFunctions.renderDashboard();
        });
    }
    const nextMonthBtn = document.getElementById('next-month-btn');
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            if (nextMonthBtn.disabled) return;
            appState.displayedDate.setMonth(appState.displayedDate.getMonth() + 1);
            updateMonthDisplay();
            renderFunctions.renderDashboard();
        });
    }
    const chartWeekBtns = document.querySelectorAll('.chart-week-btn');
    if (chartWeekBtns.length > 0) {
        chartWeekBtns.forEach(button => {
            button.addEventListener('click', () => {
                appState.chartSelectedWeek = parseInt(button.dataset.week);
                renderFunctions.renderDashboard();
            });
        });
    }
    const contactSearchInput = document.getElementById('contactSearchInput');
    if (contactSearchInput) {
        contactSearchInput.addEventListener('input', renderFunctions.renderContactList);
    }
    
    // ... (Lanjutkan pola ini untuk semua listener elemen statis lainnya) ...
}


// FUNGSI UNTUK MENGATUR TOMBOL FAB
const updateFAB = (pageId) => {
    fabContainer.innerHTML = '';
    let fabHTML = '';
    const baseFabClass = "w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 transition-all";
    const plusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    
    if (pageId === 'page-pihak') {
        fabHTML = `<button title="Tambah Pelanggan" id="fab-add-contact" class="${baseFabClass}">${plusIcon}</button>`;
    } else if (pageId === 'page-inventaris') {
        fabHTML = `<button title="Tambah Barang" id="fab-add-item" class="${baseFabClass}">${plusIcon}</button>`;
    } else if (pageId === 'page-penjualan') {
        fabHTML = `<button title="Buat Faktur Penjualan" id="fab-add-sale" class="${baseFabClass}">${plusIcon}</button>`;
    } else if (pageId === 'page-pesanan') {
        fabHTML = `<button title="Tambah Pesanan" id="fab-add-order" class="${baseFabClass}">${plusIcon}</button>`;
    } else if (pageId === 'page-laporan') {
        fabHTML = `<button title="Catat Belanja Baru" id="fab-add-expense" class="${baseFabClass}">${plusIcon}</button>`;
        
    } else if (pageId === 'page-reservasi') {
        fabHTML = `<button title="Tambah Reservasi" id="fab-add-reservation" class="${baseFabClass}">${plusIcon}</button>`;
    }
    fabContainer.innerHTML = fabHTML;
};
// 3. ENTRY POINT APLIKASI (LOGIKA UTAMA)
document.addEventListener('DOMContentLoaded', () => {
    console.log("1. Halaman selesai dimuat (DOMContentLoaded).");
    
    let isAppInitialized = false;
    
    onAuthStateChanged(auth, (user) => {
        console.log("2. Status autentikasi dicek.");
        if (user) {
            console.log("3. Pengguna terautentikasi.");
            if (isAppInitialized) return;
            isAppInitialized = true;
            
            initializeApplication(db);
            
            // Ganti blok if/else if di dalam DOMContentLoaded Anda dengan ini
            
            const path = window.location.pathname;
            let currentPageId = '';
            
            // Mendeteksi halaman mana yang sedang aktif dan memuat datanya
            if (path.includes('index.html') || path.endsWith('/')) {
                currentPageId = 'page-beranda';
                onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
                    state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    renderFunctions.renderDashboard();
                });
                onSnapshot(query(collection(db, 'customer_orders'), orderBy('orderDate', 'desc')), (snapshot) => {
                    state.customerOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderFunctions.renderDashboard();
                });
                onSnapshot(query(collection(db, 'monthly_expenses'), orderBy('date', 'desc')), (snapshot) => {
                    state.monthlyExpenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderFunctions.renderDashboard();
                });
                onSnapshot(query(collection(db, 'inventory'), orderBy('name')), (snapshot) => {
                    state.inventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                });
                    onSnapshot(query(collection(db, 'contacts'), orderBy('name')), (snapshot) => {
        state.contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

            }
else if (path.includes('pesanan.html')) {
    currentPageId = 'page-pesanan';
    document.getElementById(currentPageId).classList.remove('hidden');
    
    // Listener untuk data pesanan utama
    onSnapshot(query(collection(db, 'customer_orders'), orderBy('orderDate', 'desc')), (snapshot) => {
        state.customerOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFunctions.renderOrderList();
        renderFunctions.renderCompletedOrderList();
        renderFunctions.renderCompletedOrderFilters();
    });
    
    // Listener untuk data transaksi (dibutuhkan untuk riwayat pesanan selesai)
    onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
        state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFunctions.renderCompletedOrderList();
    });
    
    // Listener untuk data inventaris (dibutuhkan untuk modal 'Pesanan Baru')
    onSnapshot(query(collection(db, 'inventory'), orderBy('name')), (snapshot) => {
        state.inventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    onSnapshot(query(collection(db, 'contacts'), orderBy('name')), (snapshot) => {
    state.contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
});
    
    // Aktifkan fitur di Riwayat Pesanan Selesai
    const completedOrderSearchInput = document.getElementById('completedOrderSearchInput');
    const completedOrderMonthFilter = document.getElementById('completedOrderMonthFilter');
    const exportBtn = document.getElementById('exportCompletedOrdersCsvBtn');
    
    completedOrderSearchInput.addEventListener('input', () => renderFunctions.renderCompletedOrderList());
    completedOrderMonthFilter.addEventListener('change', () => renderFunctions.renderCompletedOrderList());
    
    exportBtn.addEventListener('click', () => {
        const searchTerm = completedOrderSearchInput.value.toLowerCase();
        const selectedMonth = completedOrderMonthFilter.value;
        let filteredOrders = state.customerOrders.filter(o => o.status === 'completed');
        
        if (selectedMonth) {
            filteredOrders = filteredOrders.filter(order =>
                order.orderDate.toDate().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) === selectedMonth
            );
        }
        if (searchTerm) {
            filteredOrders = filteredOrders.filter(order =>
                order.contactName.toLowerCase().includes(searchTerm) ||
                order.items.some(item => item.name.toLowerCase().includes(searchTerm))
            );
        }
        
        if (filteredOrders.length === 0) {
            utils.showToast('Tidak ada data untuk diekspor.');
            return;
        }
        
        const headers = ["Tanggal Pesan", "Nama Pelanggan", "Alamat", "Nama Item", "Jumlah", "Harga Satuan", "Subtotal"];
        const data = filteredOrders.flatMap(order =>
            order.items.map(item => [
                utils.formatDate(order.orderDate),
                order.contactName,
                order.alamat || '-',
                item.name,
                item.qty,
                item.price,
                item.qty * item.price
            ])
        );
        
        const filename = `riwayat_pesanan_${selectedMonth.replace(' ', '_') || 'semua'}.csv`;
        utils.exportToCsv(filename, headers, data);
        utils.showToast('Laporan sedang diunduh...');
    });
}
            else if (path.includes('inventaris.html')) {
                currentPageId = 'page-inventaris';
                // Listener inventaris sekarang aman di dalam bloknya sendiri
                onSnapshot(query(collection(db, 'inventory'), orderBy('name')), (snapshot) => {
                    state.inventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderFunctions.renderInventoryList();
                });
            }
 // main.js -> Ganti blok 'pihak.html' yang lama dengan ini

else if (path.includes('pihak.html')) {
    currentPageId = 'page-pihak';
    document.getElementById(currentPageId).classList.remove('hidden');
    
    // Listener untuk data kontak dari Firestore
    onSnapshot(query(collection(db, 'contacts'), orderBy('name')), (snapshot) => {
        state.contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFunctions.renderContactList();
    });
    
    const contactSearchInput = document.getElementById('contactSearchInput');
    const selectAllCheckbox = document.getElementById('select-all-contacts-checkbox');
    const contactListEl = document.getElementById('contact-list');
    const broadcastControlsEl = document.getElementById('broadcast-controls');
    const showBroadcastModalBtn = document.getElementById('show-broadcast-modal');
    
    // Aktifkan pencarian
    contactSearchInput.addEventListener('input', renderFunctions.renderContactList);
    
    // Fungsi untuk update tampilan broadcast controls
    const updateBroadcastControls = () => {
        const selectedCountEl = document.getElementById('selected-count');
        const allVisibleCheckboxes = contactListEl.querySelectorAll('.contact-checkbox');
        const checkedCheckboxes = contactListEl.querySelectorAll('.contact-checkbox:checked');
        const checkedCount = checkedCheckboxes.length;
        
        broadcastControlsEl.classList.toggle('hidden', checkedCount === 0);
        if (checkedCount > 0) {
            selectedCountEl.textContent = checkedCount;
        }
        
        selectAllCheckbox.checked = allVisibleCheckboxes.length > 0 && checkedCount === allVisibleCheckboxes.length;
    };
    
    // Aktifkan "Pilih Semua"
    selectAllCheckbox.addEventListener('click', (e) => {
        const isChecked = e.target.checked;
        contactListEl.querySelectorAll('.contact-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        updateBroadcastControls();
    });
    
    // Listener jika salah satu checkbox diubah
    contactListEl.addEventListener('change', (e) => {
        if (e.target.classList.contains('contact-checkbox')) {
            updateBroadcastControls();
        }
    });
    
    // Listener untuk tombol "Broadcast Pesan"
    showBroadcastModalBtn.addEventListener('click', () => broadcastModal.show());
}            
            else if (path.includes('reservasi.html')) {
                currentPageId = 'page-reservasi';
                document.getElementById(currentPageId).classList.remove('hidden');
                
                // Ambil elemen-elemen filter
                const searchInput = document.getElementById('reservation-search-input');
                const datePickerBtn = document.getElementById('show-custom-date-picker');
                const statusFilterBtn = document.getElementById('reservation-status-filter');
                
                // Fungsi untuk memanggil ulang render setiap kali ada perubahan
                const applyFilters = () => renderFunctions.renderReservations();
                
                // Event listener untuk input pencarian
                searchInput.addEventListener('input', () => {
                    appState.reservationFilter.searchTerm = searchInput.value;
                    applyFilters();
                });
                
                // Event listener untuk tombol filter status
                statusFilterBtn.addEventListener('click', () => {
                    statusFilterModal.show();
                });
                
                // ▼▼▼ BAGIAN BARU UNTUK TOMBOL TANGGAL ▼▼▼
                datePickerBtn.addEventListener('click', () => {
                    // Ambil input tanggal di dalam modal
                    const modalDateInput = datePickerModal.formEl.querySelector('#modal-date-input');
                    // Atur nilainya sesuai state saat ini sebelum modal ditampilkan
                    modalDateInput.value = appState.reservationFilter.date;
                    // Tampilkan modal
                    datePickerModal.show();
                });
                
                // Atur tanggal default ke hari ini saat halaman dimuat
                const today = new Date().toISOString().split('T')[0];
                if (!appState.reservationFilter.date) {
                    appState.reservationFilter.date = today;
                }
                // Update teks tombol sesuai tanggal di state
                datePickerBtn.textContent = new Date(appState.reservationFilter.date + 'T00:00:00').toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                
                // Listener untuk data reservasi dari Firestore
                onSnapshot(query(collection(db, 'reservations'), orderBy('createdAt', 'desc')), (snapshot) => {
                    state.reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    applyFilters();
                });
            }
            else if (path.includes('rangkuman.html')) {
                currentPageId = 'page-pelanggan'; // Sesuai ID div di HTML lama
                onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
                    state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderFunctions.renderCustomerSummary();
                });
            }
            
            else if (path.includes('lainnya.html')) {
                currentPageId = 'page-lainnya';
                document.getElementById(currentPageId).classList.remove('hidden');
            }
            // main.js
            
            else if (path.includes('laporan_belanja.html')) {
                currentPageId = 'page-laporan';
                document.getElementById(currentPageId).classList.remove('hidden');
                
                // Listener untuk mengambil data belanja
                onSnapshot(query(collection(db, 'monthly_expenses'), orderBy('date', 'desc')), (snapshot) => {
                    state.monthlyExpenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderFunctions.renderExpenseReport();
                });
                
                // Aktifkan filter
                const monthFilter = document.getElementById('expenseMonthFilter');
                const resetBtn = document.getElementById('resetExpenseFilter');
                
                monthFilter.addEventListener('change', renderFunctions.renderExpenseReport);
                resetBtn.addEventListener('click', () => {
                    monthFilter.value = '';
                    renderFunctions.renderExpenseReport();
                });
            }
            
            //Laporan absensi
            else if (path.includes('pages/lainnya/laporan_absensi.html')) {
                currentPageId = 'page-laporan-absensi';
                document.getElementById(currentPageId).classList.remove('hidden');
                
                const dateFilter = document.getElementById('absensi-date-filter');
                const container = document.getElementById('absensi-report-container');
                
                const fetchAttendanceReport = async (dateString) => {
                    if (!dateString) return;
                    
                    container.innerHTML = `<div class="text-center py-10"><div class="spinner mx-auto"></div><p class="mt-2 text-sm text-gray-500">Memuat data absensi...</p></div>`;
                    
                    try {
                        const url = `${ATTENDANCE_SCRIPT_URL}?action=read&date=${dateString}`;
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error('Gagal mengambil data dari server.');
                        }
                        const result = await response.json();
                        const attendanceData = result.data || result; // Menangani format data yang mungkin berbeda
                        
                        state.attendances = Array.isArray(attendanceData) ? attendanceData : [];
                        renderFunctions.renderAttendanceReport(state.attendances);
                        
                    } catch (error) {
                        console.error('Error fetching attendance:', error);
                        container.innerHTML = `<div class="text-center py-10"><p class="text-sm text-red-500">Terjadi kesalahan: ${error.message}. Coba lagi nanti.</p></div>`;
                    }
                };
                
                dateFilter.addEventListener('change', () => {
                    fetchAttendanceReport(dateFilter.value);
                });
                
                const today = new Date().toISOString().split('T')[0];
                dateFilter.value = today;
                fetchAttendanceReport(today);
            }
            
            //Laporan Kebersihan
            // main.js -> Tambahkan di dalam blok routing if/else if
            
            else if (path.includes('lainnya/kebersihan.html')) {
                currentPageId = 'page-laporan-kebersihan';
                document.getElementById(currentPageId).classList.remove('hidden');
                
                // Listener untuk data checklist dari Firestore
                onSnapshot(query(collection(db, "checklist_history"), orderBy("tanggal", "desc")), (snapshot) => {
                    state.checklistHistory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // Panggil render saat data pertama kali dimuat
                    renderFunctions.renderChecklistReport();
                });
                
                // Event listener untuk mengaktifkan filter bulan
                const monthFilter = document.getElementById('checklistMonthFilter');
                monthFilter.addEventListener('change', () => {
                    renderFunctions.renderChecklistReport();
                });
            }
            //Kalkulator Omset
            else if (path.includes('lainnya/kal_omset.html')) {
                currentPageId = 'page-kalkulator-omset';
                document.getElementById(currentPageId).classList.remove('hidden');
                
                // Pastikan data 'dailyReports' selalu ada di state untuk halaman ini
                onSnapshot(query(collection(db, "daily_reports"), orderBy("date", "desc")), (snapshot) => {
                    state.dailyReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                });
                
                const hitungBtn = document.getElementById('hitung-omset-btn');
                hitungBtn.addEventListener('click', () => {
                    const startDateEl = document.getElementById('start-date');
                    const endDateEl = document.getElementById('end-date');
                    
                    if (!startDateEl.value || !endDateEl.value) {
                        utils.showToast("Silakan pilih tanggal mulai dan selesai.");
                        return;
                    }
                    
                    const startDate = new Date(startDateEl.value);
                    const endDate = new Date(endDateEl.value);
                    
                    if (startDate > endDate) {
                        utils.showToast("Tanggal mulai tidak boleh lebih dari tanggal selesai.");
                        return;
                    }
                    
                    // Panggil fungsi render yang akan kita buat untuk menampilkan hasilnya
                    renderFunctions.renderOmsetCalculationResult(startDate, endDate);
                });
            }
            //halaman kalkulator online
            
            else if (path.includes('lainnya/kal_online.html')) {
                currentPageId = 'page-kalkulator-online';
                document.getElementById(currentPageId).classList.remove('hidden');
                
                const hitungBtn = document.getElementById('hitung-online-btn');
                
                hitungBtn.addEventListener('click', () => {
                    const parseInput = (id) => parseFloat(document.getElementById(id).value) || 0;
                    
                    // Ambil semua nilai pendapatan dari form
                    const apsGrabPendapatan = parseInput('aps-grab-input');
                    const apsGojekPendapatan = parseInput('aps-gojek-input');
                    const apsShopeePendapatan = parseInput('aps-shopee-input');
                    const mjGrabPendapatan = parseInput('mj-grab-input');
                    const mjGojekPendapatan = parseInput('mj-gojek-input');
                    const mjShopeePendapatan = parseInput('mj-shopee-input');
                    
                    // Hitung komisi dan pendapatan bersih untuk APS
                    const apsGrabKomisi = Math.floor((apsGrabPendapatan * 0.10) / 1.1);
                    const apsGojekKomisi = Math.floor((apsGojekPendapatan * 0.13) / 1.1);
                    const apsShopeeKomisi = Math.floor(apsShopeePendapatan * 0.10);
                    const apsGrabBersih = apsGrabPendapatan - apsGrabKomisi;
                    const apsGojekBersih = apsGojekPendapatan - apsGojekKomisi;
                    const apsShopeeBersih = apsShopeePendapatan - apsShopeeKomisi;
                    const apsTotalBersih = apsGrabBersih + apsGojekBersih + apsShopeeBersih;
                    
                    // Hitung komisi dan pendapatan bersih untuk Mie Jogja
                    const mjGrabKomisi = Math.floor((mjGrabPendapatan * 0.10) / 1.1);
                    const mjGojekKomisi = Math.floor((mjGojekPendapatan * 0.13) / 1.1);
                    const mjShopeeKomisi = Math.floor(mjShopeePendapatan * 0.10);
                    const mjGrabBersih = mjGrabPendapatan - mjGrabKomisi;
                    const mjGojekBersih = mjGojekPendapatan - mjGojekKomisi;
                    const mjShopeeBersih = mjShopeePendapatan - mjShopeeKomisi;
                    const mjTotalBersih = mjGrabBersih + mjGojekBersih + mjShopeeBersih;
                    
                    // Hitung Total Gabungan
                    const grandTotalOnline = apsTotalBersih + mjTotalBersih;
                    const totalBersihGrab = apsGrabBersih + mjGrabBersih;
                    const totalBersihGojek = apsGojekBersih + mjGojekBersih;
                    const totalBersihShopee = apsShopeeBersih + mjShopeeBersih;
                    
                    // Tampilkan semua hasil ke elemen HTML yang sesuai
                    document.getElementById('aps-grab-komisi').textContent = utils.formatCurrency(apsGrabKomisi);
                    document.getElementById('aps-grab-bersih').textContent = utils.formatCurrency(apsGrabBersih);
                    document.getElementById('aps-gojek-komisi').textContent = utils.formatCurrency(apsGojekKomisi);
                    document.getElementById('aps-gojek-bersih').textContent = utils.formatCurrency(apsGojekBersih);
                    document.getElementById('aps-shopee-komisi').textContent = utils.formatCurrency(apsShopeeKomisi);
                    document.getElementById('aps-shopee-bersih').textContent = utils.formatCurrency(apsShopeeBersih);
                    document.getElementById('aps-total-bersih').textContent = utils.formatCurrency(apsTotalBersih);
                    
                    document.getElementById('mj-grab-komisi').textContent = utils.formatCurrency(mjGrabKomisi);
                    document.getElementById('mj-grab-bersih').textContent = utils.formatCurrency(mjGrabBersih);
                    document.getElementById('mj-gojek-komisi').textContent = utils.formatCurrency(mjGojekKomisi);
                    document.getElementById('mj-gojek-bersih').textContent = utils.formatCurrency(mjGojekBersih);
                    document.getElementById('mj-shopee-komisi').textContent = utils.formatCurrency(mjShopeeKomisi);
                    document.getElementById('mj-shopee-bersih').textContent = utils.formatCurrency(mjShopeeBersih);
                    document.getElementById('mj-total-bersih').textContent = utils.formatCurrency(mjTotalBersih);
                    
                    document.getElementById('total-bersih-grab').textContent = utils.formatCurrency(totalBersihGrab);
                    document.getElementById('total-bersih-gojek').textContent = utils.formatCurrency(totalBersihGojek);
                    document.getElementById('total-bersih-shopee').textContent = utils.formatCurrency(totalBersihShopee);
                    document.getElementById('grand-total-online').textContent = utils.formatCurrency(grandTotalOnline);
                    
                    // Tampilkan kontainer hasil
                    document.getElementById('hasil-online-container').classList.remove('hidden');
                });
            }
            //Halaman laporan Harian
            
            else if (path.includes('lainnya/lap_harian.html')) {
                currentPageId = 'page-laporan-harian';
                document.getElementById(currentPageId).classList.remove('hidden');
                
                const monthFilter = document.getElementById('dailyReportMonthFilter');
                let allReports = []; // Simpan semua laporan di sini untuk mengisi filter
                
                // Fungsi untuk memfilter dan menampilkan laporan
                const displayReports = () => {
                    const selectedMonth = monthFilter.value;
                    if (selectedMonth) {
                        state.dailyReports = allReports.filter(report => {
                            const reportMonth = report.date.toDate().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                            return reportMonth === selectedMonth;
                        });
                    } else {
                        state.dailyReports = allReports; // Tampilkan semua jika tidak ada filter
                    }
                    renderFunctions.renderDailyReportHistory();
                };
                
                // Ambil semua data sekali untuk mengisi state dan filter
                onSnapshot(query(collection(db, "daily_reports"), orderBy("date", "desc")), (snapshot) => {
                    allReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    // Panggil fungsi untuk mengisi dropdown filter
                    renderFunctions.renderDailyReportMonthFilter(allReports);
                    
                    // Tampilkan laporan (awalnya semua)
                    displayReports();
                });
                
                // Tambahkan listener ke filter
                monthFilter.addEventListener('change', displayReports);
                
                
                const prosesBtn = document.getElementById('proses-laporan-btn');
                prosesBtn.addEventListener('click', async () => {
                    const textarea = document.getElementById('laporan-harian-input');
                    const rawText = textarea.value;
                    if (!rawText.trim()) {
                        utils.showToast("Kotak teks tidak boleh kosong.");
                        return;
                    }
                    
                    prosesBtn.disabled = true;
                    prosesBtn.textContent = 'Memproses...';
                    
                    try {
                        const reportData = utils.parseDailyReport(rawText);
                        const jsDate = reportData.date.toDate();
                        const dateString = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;
                        
                        const docRef = doc(db, 'daily_reports', dateString);
                        await setDoc(docRef, reportData);
                        
                        utils.showToast(`Laporan untuk tanggal ${dateString} berhasil disimpan!`);
                        textarea.value = '';
                        
                    } catch (error) {
                        console.error("Gagal memproses laporan:", error);
                        utils.showToast(error.message);
                    } finally {
                        prosesBtn.disabled = false;
                        prosesBtn.textContent = 'Simpan & Proses Laporan';
                    }
                });
            }
            //halaman laporan bulanan
else if (path.includes('lainnya/lap_bulanan.html')) {
    currentPageId = 'page-laporan-bulanan';
    document.getElementById(currentPageId).classList.remove('hidden');
    
    // Listener untuk memastikan data laporan harian selalu tersedia
    onSnapshot(query(collection(db, "daily_reports"), orderBy("date", "desc")), (snapshot) => {
        state.dailyReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFunctions.renderMonthlyTurnoverReport();
    });
    
    // Aktifkan filter tahun
    const yearFilter = document.getElementById('monthly-report-year-filter');
    yearFilter.addEventListener('change', () => {
        renderFunctions.renderMonthlyTurnoverReport();
    });
    
    // ▼▼▼ LOGIKA BARU UNTUK TOMBOL EKSPOR ▼▼▼
    const exportBtn = document.getElementById('export-monthly-report-csv');
    exportBtn.addEventListener('click', () => {
        const selectedYear = yearFilter.value;
        if (!selectedYear) {
            utils.showToast("Pilih tahun terlebih dahulu.");
            return;
        }
        
        // 1. Filter laporan hanya untuk tahun yang dipilih
        const reportsInYear = state.dailyReports.filter(r => r.date.toDate().getFullYear() == selectedYear);
        if (reportsInYear.length === 0) {
            utils.showToast("Tidak ada data untuk diekspor pada tahun ini.");
            return;
        }
        
        // 2. Proses dan agregat data per bulan (mirip seperti di render function)
        const monthlyDataForExport = {};
        for (let i = 0; i < 12; i++) {
            monthlyDataForExport[i] = {
                total: 0,
                fullName: new Date(selectedYear, i).toLocaleString('id-ID', { month: 'long' }),
                categories: { 'Makan ditempat': 0, 'Naskot': 0, 'Online': 0 },
                restaurants: { 'Ayam Penyet Surabaya': 0, 'Mie Jogja': 0 }
            };
        }
        reportsInYear.forEach(report => {
            const month = report.date.toDate().getMonth();
            monthlyDataForExport[month].total += report.grandTotal || 0;
            for (const restoName in report.restaurants) {
                monthlyDataForExport[month].restaurants[restoName] += report.restaurants[restoName].total || 0;
                for (const phone of Object.values(report.restaurants[restoName].phones)) {
                    monthlyDataForExport[month].categories['Makan ditempat'] += phone['Makan ditempat'] || 0;
                    monthlyDataForExport[month].categories['Naskot'] += phone['Naskot'] || 0;
                    monthlyDataForExport[month].categories['Online'] += phone['Online'] || 0;
                }
            }
        });
        
        // 3. Siapkan data untuk CSV
        const headers = ["Bulan", "Total Omset", "Makan di Tempat", "Naskot", "Online", "Omset APS", "Omset MJ"];
        const dataToExport = Object.values(monthlyDataForExport)
            .filter(m => m.total > 0) // Hanya ekspor bulan yang ada datanya
            .map(m => [
                m.fullName,
                m.total,
                m.categories['Makan ditempat'],
                m.categories['Naskot'],
                m.categories['Online'],
                m.restaurants['Ayam Penyet Surabaya'],
                m.restaurants['Mie Jogja']
            ]);
        
        // 4. Panggil fungsi ekspor
        const filename = `laporan_omset_bulanan_${selectedYear}.csv`;
        utils.exportToCsv(filename, headers, dataToExport);
        utils.showToast('Laporan sedang diunduh...');
    });
}
            //Halaman Hitung Duit
            else if (path.includes('lainnya/duit.html')) {
    currentPageId = 'page-hitung-fisik';
    document.getElementById(currentPageId).classList.remove('hidden');
    
    const formContainer = document.getElementById('form-hitung-fisik');
    // Panggil render function untuk membangun form
    renderFunctions.renderCashCalculatorForm(formContainer);
    
    // Fungsi utama untuk kalkulasi
    const hitungUangFisik = () => {
        const parseInput = (selector) => parseFloat(document.querySelector(selector)?.value) || 0;
        
        let totalUangKertas = 0;
        formContainer.querySelectorAll('.uf-input-kertas').forEach(input => {
            const qty = parseFloat(input.value) || 0;
            const value = parseFloat(input.dataset.value);
            const subtotal = qty * value;
            totalUangKertas += subtotal;
            document.getElementById(`uf-subtotal-${input.id.split('-')[2]}`).textContent = utils.formatCurrency(subtotal);
        });
        
        const totalFisikDiLaci = totalUangKertas + parseInput('#uf-input-koin');
        document.getElementById('uf-total-fisik-laci').textContent = utils.formatCurrency(totalFisikDiLaci);
        
        let totalPengeluaran = 0;
        formContainer.querySelectorAll('.uf-input-pengeluaran').forEach(input => {
            totalPengeluaran += parseFloat(input.value) || 0;
        });
        document.getElementById('uf-total-pengeluaran').textContent = utils.formatCurrency(totalPengeluaran);
        
        let totalNonTunai = 0;
        formContainer.querySelectorAll('.uf-input-nontunai').forEach(input => {
            totalNonTunai += parseFloat(input.value) || 0;
        });
        document.getElementById('uf-total-nontunai').textContent = utils.formatCurrency(totalNonTunai);
        
        const modalKasir = parseInput('#uf-modal-kasir');
        const totalPenjualanSistem = parseInput('#uf-total-penjualan-sistem');
        
        const totalUangSeharusnya = (totalFisikDiLaci + totalPengeluaran - modalKasir) + totalNonTunai;
        document.getElementById('uf-total-seharusnya').textContent = utils.formatCurrency(totalUangSeharusnya);
        
        const selisih = totalUangSeharusnya - totalPenjualanSistem;
        const selisihEl = document.getElementById('uf-selisih');
        selisihEl.textContent = utils.formatCurrency(selisih);
        
        selisihEl.classList.toggle('text-red-600', selisih < 0);
        selisihEl.classList.toggle('text-emerald-600', selisih >= 0);
    };
    
    // Listener untuk menghitung otomatis saat ada input
    formContainer.addEventListener('input', hitungUangFisik);
    
    // Listener untuk tombol-tombol di dalam form
    formContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.id === 'uf-reset-btn') {
            formContainer.querySelectorAll('input[type="number"]').forEach(input => {
                input.value = '';
            });
            document.getElementById('uf-tanggal').value = new Date().toISOString().split('T')[0];
            hitungUangFisik();
        }
        if (target.id === 'uf-add-expense-btn') {
            const pengeluaranContainer = document.getElementById('uf-pengeluaran-container');
            const newInput = document.createElement('input');
            newInput.type = 'number';
            newInput.placeholder = 'Pengeluaran Lain';
            newInput.className = 'uf-input-pengeluaran w-full border-gray-300 rounded-md p-1.5';
            pengeluaranContainer.appendChild(newInput);
        }
    });
    
    // Atur tanggal ke hari ini saat halaman dimuat
    document.getElementById('uf-tanggal').value = new Date().toISOString().split('T')[0];
}
            
            // Tambahkan blok lain di sini jika ada halaman lain yang perlu memuat data
            updateFAB(currentPageId)
            
            
            // Sembunyikan loading overlay (sekarang aman untuk dijalankan)
            const loadingOverlay = document.getElementById('loading-overlay');
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                document.getElementById('app-container').classList.remove('hidden');
            }, 300);
            
        } else {
            signInAnonymously(auth).catch((error) => { console.error("Anonymous sign-in failed:", error); });
        }
    });
});