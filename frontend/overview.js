async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
    } catch (err) {
        console.error("Fetch error:", err);
        return null;
    }
}

// ===============================
// LOAD STATS
// ===============================
async function loadStats() {
    const statsEl = document.getElementById("stats");
    statsEl.innerHTML = "Đang tải...";

    const data = await fetchJSON("/stats");
    if (!data) {
        statsEl.innerHTML = "<p class='error'>Không tải được thống kê</p>";
        return;
    }

    statsEl.innerHTML = `
        <p><b>Tổng số block:</b> ${data.total_blocks}</p>
        <p><b>Tổng số giao dịch:</b> ${data.total_transactions}</p>
    `;
}

// ===============================
// LOAD ACCOUNT LIST
// ===============================
async function loadAccounts() {
    const tbody = document.querySelector("#accountTable tbody");
    tbody.innerHTML = "<tr><td colspan='2'>Đang tải...</td></tr>";

    const data = await fetchJSON("/accounts");
    if (!data) {
        tbody.innerHTML = `<tr><td colspan="2" class="error">Không tải được danh sách tài khoản</td></tr>`;
        return;
    }

    let rows = "";
    data.accounts.forEach(acc => {
        rows += `
            <tr>
                <td>${acc.address}</td>
                <td>${acc.balance}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows || `<tr><td colspan="2">Chưa có tài khoản nào</td></tr>`;
}

// ===============================
// LOAD COINBASE TRANSACTIONS
// ===============================
async function loadCoinbase() {
    const tbody = document.querySelector("#coinbaseTable tbody");
    tbody.innerHTML = "<tr><td colspan='4'>Đang tải...</td></tr>";

    const data = await fetchJSON("/coinbase");
    if (!data) {
        tbody.innerHTML = `<tr><td colspan="4" class="error">Không tải được coinbase transactions</td></tr>`;
        return;
    }

    let rows = "";
    data.coinbase_rewards.forEach(rew => {
        rows += `
            <tr>
                <td>${rew.block_index}</td>
                <td>${rew.miner}</td>
                <td>${rew.reward}</td>
                <td>${new Date(rew.timestamp * 1000).toLocaleString()}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows || `<tr><td colspan="4">Chưa có block reward nào</td></tr>`;
}

async function loadTxLog() {
    const tbody = document.querySelector("#txlogTable tbody");
    tbody.innerHTML = "<tr><td colspan='6'>Đang tải...</td></tr>";

    const data = await fetchJSON("/txlog");
    if (!data) {
        tbody.innerHTML = "<tr><td colspan='6' class='error'>Không tải được lịch sử giao dịch</td></tr>";
        return;
    }

    let rows = "";
    data.txlog.forEach(log => {
        rows += `
            <tr>
                <td>${new Date(log.timestamp * 1000).toLocaleString()}</td>
                <td>${log.tx.sender}</td>
                <td>${log.tx.receiver}</td>
                <td>${log.tx.amount}</td>
                <td style="color:${log.status === "SUCCESS" ? "green" : "red"};">
                    ${log.status}
                </td>
                <td>${log.reason}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows || `<tr><td colspan="6">Chưa có giao dịch nào</td></tr>`;
}

// ===============================
// AUTO LOAD ALL WHEN PAGE OPENS
// ===============================
window.addEventListener("DOMContentLoaded", () => {
    loadStats();
    loadAccounts();
    loadCoinbase();
    loadTxLog();
});
