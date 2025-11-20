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
    const initialBalance = parseFloat(document.getElementById("initialBalance").value);
    
    if (isNaN(initialBalance) || initialBalance < 0) {
        setMessage(msgEl, "Số dư ban đầu không hợp lệ", false);
        return;
    }
    
    setMessage(msgEl, "Đang tạo ví...", true);

    try {
        const res = await fetch("/wallet/new", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initial_balance: initialBalance })
        });
        
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        document.getElementById("walletAddress").value = data.address;
        document.getElementById("walletPub").value = data.public_key;
        document.getElementById("walletPriv").value = data.private_key;

        setMessage(msgEl, `✓ ${data.message}`, true);
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
// 2.5. MỞ POPUP TẠO CHỮ KÝ
// ===============================
document.getElementById("btnOpenSignPopup").addEventListener("click", () => {
    const sender = document.getElementById("txSender").value.trim();
    const receiver = document.getElementById("txReceiver").value.trim();
    const amount = document.getElementById("txAmount").value.trim();
    
    // Tạo URL với query parameters để truyền dữ liệu sang popup
    const params = new URLSearchParams({
        sender: sender,
        receiver: receiver,
        amount: amount
    });
    
    // Mở popup với kích thước phù hợp
    window.open(
        `/static/sign_popup.html?${params.toString()}`, 
        'signPopup', 
        'width=600,height=700,left=200,top=100'
    );
});

// Hàm nhận dữ liệu từ popup (gọi từ popup)
window.receiveSignature = function(signature, publicKey) {
    document.getElementById("txSig").value = signature;
    document.getElementById("txPub").value = publicKey;
    
    const msgEl = document.getElementById("txMsg");
    setMessage(msgEl, "✓ Chữ ký đã được tạo thành công!", true);
}

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
// 4. LOAD BLOCKCHAIN
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
