// state.js

// Menyimpan data dari Firestore
export const state = {
        contacts: [],
        inventory: [],
        transactions: [],
        customerOrders: [],
        monthlyExpenses: [],
        checklistHistory: [],
        dailyReports: [],
        reservations: []
};

// Menyimpan state UI dan filter yang bisa berubah
export const appState = {
        displayedDate: new Date(),
        chartSelectedWeek: getWeekOfMonth(new Date()),
        turnoverChartSelectedWeek: 0,
        calculatedDailyData: {},
        reservationFilter: {
        date: '',
        searchTerm: '',
        status: 'all' // 'all', 'confirmed', 'completed', 'cancelled'
}
};

// Helper function kecil yang dibutuhkan oleh state
function getWeekOfMonth(date) {
        const day = date.getDate();
        if (day <= 7) return 1;
        if (day <= 14) return 2;
        if (day <= 21) return 3;
        return 4;
};