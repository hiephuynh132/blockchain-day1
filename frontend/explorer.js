// ===============================
// Helper Functions
// ===============================
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

function formatNumber(num) {
    return num.toLocaleString('vi-VN');
}

function shortenAddress(address) {
    if (address.length <= 16) return address;
    return address.slice(0, 8) + "..." + address.slice(-6);
}

// ===============================
// Load Statistics
// ===============================
async function loadStats() {
    const statsData = await fetchJSON("/stats");
    if (!statsData) return;

    document.getElementById("totalBlocks").textContent = formatNumber(statsData.total_blocks);
    document.getElementById("totalTxs").textContent = formatNumber(statsData.total_transactions);
}

// ===============================
// Calculate Wallet Details
// ===============================
async function calculateWalletDetails() {
    const chainData = await fetchJSON("/chain");
    if (!chainData) return null;

    const wallets = new Map();

    // Duyệt qua tất cả các block và transaction
    chainData.chain.forEach(block => {
        block.transactions.forEach(tx => {
            const sender = tx.sender;
            const receiver = tx.receiver;

            // Bỏ qua GENESIS và COINBASE
            if (sender !== "GENESIS" && sender !== "COINBASE") {
                if (!wallets.has(sender)) {
                    wallets.set(sender, {
                        address: sender,
                        balance: 0,
                        sentCount: 0,
                        receivedCount: 0
                    });
                }
                wallets.get(sender).sentCount++;
            }

            if (receiver !== "GENESIS" && receiver !== "COINBASE") {
                if (!wallets.has(receiver)) {
                    wallets.set(receiver, {
                        address: receiver,
                        balance: 0,
                        sentCount: 0,
                        receivedCount: 0
                    });
                }
                wallets.get(receiver).receivedCount++;
            }
        });
    });

    // Lấy balance cho từng ví
    const walletArray = Array.from(wallets.values());
    
    for (const wallet of walletArray) {
        const balanceData = await fetchJSON(`/balance/${wallet.address}`);
        if (balanceData) {
            wallet.balance = balanceData.balance;
        }
    }

    return walletArray;
}

// ===============================
// Load Blockchain Table
// ===============================
async function loadBlockchain() {
    const tbody = document.getElementById("blockchainTableBody");
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Đang tải dữ liệu...</td></tr>';

    const chainData = await fetchJSON("/chain");
    if (!chainData || !chainData.chain) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Không thể tải blockchain</td></tr>';
        return;
    }

    const blocks = chainData.chain;
    let rows = "";

    blocks.forEach(block => {
        // Tìm miner từ COINBASE transaction
        let miner = "system";
        const coinbaseTx = block.transactions.find(tx => tx.sender === "COINBASE");
        if (coinbaseTx) {
            miner = coinbaseTx.receiver;
        } else if (block.transactions.length > 0 && block.transactions[0].sender === "GENESIS") {
            miner = "system";
        }

        // Sample transaction
        let sampleTx = "N/A";
        if (block.transactions.length > 0) {
            const tx = block.transactions[0];
            sampleTx = `${tx.sender}→${tx.receiver}:${tx.amount}`;
        }

        // Format timestamp
        const date = new Date(block.timestamp * 1000);
        const formattedDate = date.toLocaleString('sv-SE', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(' ', ' ');

        // Shorten hashes
        const prevHashShort = block.previous_hash.substring(0, 10);
        const hashShort = block.hash.substring(0, 10);

        rows += `
            <tr>
                <td>${block.index}</td>
                <td>${formattedDate}</td>
                <td class="miner-cell">${miner === "system" ? "system" : shortenAddress(miner)}</td>
                <td>${block.transactions.length}</td>
                <td class="sample-tx-cell" title="${sampleTx}">${sampleTx}</td>
                <td class="nonce-cell">${formatNumber(block.nonce)}</td>
                <td class="hash-cell" title="${block.previous_hash}">${prevHashShort}</td>
                <td class="hash-cell" title="${block.hash}">${hashShort}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows;
}

// ===============================
// Load Wallets Table
// ===============================
async function loadWallets() {
    const tbody = document.getElementById("walletsTableBody");
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Đang tải dữ liệu...</td></tr>';

    const wallets = await calculateWalletDetails();
    
    if (!wallets || wallets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Chưa có ví nào trong blockchain</td></tr>';
        document.getElementById("totalWallets").textContent = "0";
        document.getElementById("totalSupply").textContent = "0";
        return;
    }

    // Sắp xếp theo số dư giảm dần
    wallets.sort((a, b) => b.balance - a.balance);

    // Tính tổng giá trị
    const totalSupply = wallets.reduce((sum, w) => sum + w.balance, 0);
    document.getElementById("totalWallets").textContent = formatNumber(wallets.length);
    document.getElementById("totalSupply").textContent = formatNumber(totalSupply.toFixed(2));

    // Render table
    let rows = "";
    wallets.forEach((wallet, index) => {
        const totalTxs = wallet.sentCount + wallet.receivedCount;
        rows += `
            <tr>
                <td>${index + 1}</td>
                <td class="address-cell" title="${wallet.address}">${shortenAddress(wallet.address)}</td>
                <td class="balance-cell">${wallet.balance.toFixed(2)}</td>
                <td class="tx-count-cell">${wallet.sentCount}</td>
                <td class="tx-count-cell">${wallet.receivedCount}</td>
                <td>${totalTxs}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows;
}

// ===============================
// Load All Data
// ===============================
async function loadAllData() {
    await loadStats();
    await loadBlockchain();
    await loadWallets();
}

// ===============================
// Initialize
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    loadAllData();
});
