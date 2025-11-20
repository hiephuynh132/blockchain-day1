// ===============================
// Helper hiển thị message
// ===============================
function setMessage(el, text, success = true) {
    el.textContent = text;
    el.classList.remove("msg-success", "msg-error");
    el.classList.add(success ? "msg-success" : "msg-error");
    el.style.display = "block";
}

// ===============================
// 1. TẠO VÍ
// ===============================
document.getElementById("btnNewWallet").addEventListener("click", async () => {
    const msgEl = document.getElementById("walletMsg");
    setMessage(msgEl, "Đang tạo ví...", true);

    try {
        const res = await fetch("/wallet/new", { method: "POST" });
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        document.getElementById("walletAddress").value = data.address;
        document.getElementById("walletPub").value = data.public_key;
        document.getElementById("walletPriv").value = data.private_key;

        setMessage(msgEl, "Tạo ví thành công!", true);
    } catch (err) {
        setMessage(msgEl, "Lỗi tạo ví: " + err.message, false);
    }
});

// ===============================
// 2. KIỂM TRA SỐ DƯ
// ===============================
document.getElementById("btnCheckBalance").addEventListener("click", async () => {
    const addr = document.getElementById("balanceAddress").value.trim();
    const msgEl = document.getElementById("balanceMsg");

    if (!addr) {
        setMessage(msgEl, "Vui lòng nhập address", false);
        return;
    }

    setMessage(msgEl, "Đang lấy số dư...", true);

    try {
        const res = await fetch("/balance/" + addr);
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        setMessage(msgEl, `Số dư của ${data.address}: ${data.balance}`, true);
    } catch (err) {
        setMessage(msgEl, "Lỗi: " + err.message, false);
    }
});

// ===============================
// 3. GỬI GIAO DỊCH
// ===============================
document.getElementById("btnSendTx").addEventListener("click", async () => {
    const sender = document.getElementById("txSender").value.trim();
    const receiver = document.getElementById("txReceiver").value.trim();
    const amount = parseFloat(document.getElementById("txAmount").value);
    const pub = document.getElementById("txPub").value.trim();
    const sig = document.getElementById("txSig").value.trim();
    const msgEl = document.getElementById("txMsg");

    if (!sender || !receiver || !pub || !sig || isNaN(amount)) {
        setMessage(msgEl, "Thiếu dữ liệu giao dịch", false);
        return;
    }

    setMessage(msgEl, "Đang gửi giao dịch...", true);

    try {
        const res = await fetch("/transactions/new", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sender: sender,
                receiver: receiver,
                amount: amount,
                public_key: pub,
                signature: sig
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || ("HTTP " + res.status));
        }

        const data = await res.json();
        setMessage(msgEl, "Giao dịch thành công. Mempool size = " + data.mempool, true);

    } catch (err) {
        setMessage(msgEl, "Giao dịch thất bại: " + err.message, false);
    }
});

// ===============================
// 4. MINE BLOCK
// ===============================
document.getElementById("btnMine").addEventListener("click", async () => {
    const miner = document.getElementById("minerAddress").value.trim();
    const msgEl = document.getElementById("mineMsg");

    if (!miner) {
        setMessage(msgEl, "Vui lòng nhập miner address", false);
        return;
    }

    setMessage(msgEl, "Đang đào block...", true);

    try {
        const res = await fetch("/mine/" + miner, { method: "POST" });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Mine failed");
        }

        const data = await res.json();
        setMessage(msgEl, "Đào block thành công! Hash: " + data.block.hash, true);

    } catch (err) {
        setMessage(msgEl, "Đào block thất bại: " + err.message, false);
    }
});

// ===============================
// 5. LOAD BLOCKCHAIN
// ===============================
document.getElementById("btnLoadChain").addEventListener("click", async () => {
    const infoEl = document.getElementById("chainInfo");
    const jsonEl = document.getElementById("chainJson");

    infoEl.textContent = "Đang tải chain...";
    jsonEl.textContent = "";

    try {
        const res = await fetch("/chain");
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        infoEl.textContent = `length=${data.length}`;

        jsonEl.textContent = JSON.stringify(data.chain, null, 2);

    } catch (err) {
        infoEl.textContent = "Lỗi: " + err.message;
    }
});

// ===============================
// 6. Nhận dữ liệu từ popup tạo chữ ký
// ===============================
window.addEventListener("message", (event) => {
    if (event.data.type === "SIGNED_DATA") {
        document.getElementById("txPub").value = event.data.public_key;
        document.getElementById("txSig").value = event.data.signature;

        const msgEl = document.getElementById("txMsg");
        setMessage(msgEl, "Đã nhận chữ ký từ popup!", true);
    }
});
