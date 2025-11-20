// ===============================
// Helper
// ===============================
function setMessage(el, text, success = true) {
    el.textContent = text;
    el.classList.remove("msg-success", "msg-error");
    el.classList.add(success ? "msg-success" : "msg-error");
    el.style.display = "block";
}

// ===============================
// LOAD CONFIG
// ===============================
async function loadCurrentDifficulty() {
    try {
        const res = await fetch("/difficulty");
        if (res.ok) {
            const data = await res.json();
            document.getElementById("difficulty").value = data.current_difficulty;
        }
    } catch (err) {
        console.error("Cannot load difficulty:", err);
    }
}

async function loadCurrentReward() {
    try {
        const res = await fetch("/reward");
        if (res.ok) {
            const data = await res.json();
            document.getElementById("rewardMin").value = data.min;
            document.getElementById("rewardMax").value = data.max;
        }
    } catch (err) {
        console.error("Cannot load reward:", err);
    }
}

// ===============================
// UPDATE DIFFICULTY
// ===============================
document.getElementById("btnUpdateDifficulty").addEventListener("click", async () => {
    const difficulty = parseInt(document.getElementById("difficulty").value);
    const msgEl = document.getElementById("difficultyMsg");

    if (isNaN(difficulty) || difficulty < 1 || difficulty > 10) {
        setMessage(msgEl, "Difficulty phải từ 1 đến 10", false);
        return;
    }

    setMessage(msgEl, "Đang cập nhật...", true);

    try {
        const res = await fetch(`/difficulty/${difficulty}`, { method: "POST" });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Update failed");
        }

        const data = await res.json();
        setMessage(msgEl, `✓ ${data.message}. Difficulty hiện tại: ${data.new_difficulty}`, true);
        loadMiningStats();

    } catch (err) {
        setMessage(msgEl, "Cập nhật thất bại: " + err.message, false);
    }
});

// ===============================
// UPDATE REWARD
// ===============================
document.getElementById("btnUpdateReward").addEventListener("click", async () => {
    const minReward = parseInt(document.getElementById("rewardMin").value);
    const maxReward = parseInt(document.getElementById("rewardMax").value);
    const msgEl = document.getElementById("rewardMsg");

    if (isNaN(minReward) || isNaN(maxReward)) {
        setMessage(msgEl, "Vui lòng nhập số hợp lệ", false);
        return;
    }

    if (minReward < 0 || maxReward < 0) {
        setMessage(msgEl, "Reward phải là số dương", false);
        return;
    }

    if (minReward > maxReward) {
        setMessage(msgEl, "Min phải nhỏ hơn hoặc bằng Max", false);
        return;
    }

    setMessage(msgEl, "Đang cập nhật...", true);

    try {
        const res = await fetch(`/reward?min_reward=${minReward}&max_reward=${maxReward}`, { 
            method: "POST" 
        });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Update failed");
        }

        const data = await res.json();
        setMessage(msgEl, `✓ ${data.message}. Range: ${data.min} - ${data.max}`, true);
        loadMiningStats();

    } catch (err) {
        setMessage(msgEl, "Cập nhật thất bại: " + err.message, false);
    }
});

// ===============================
// MINE BLOCK
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
        setMessage(msgEl, "✓ Đào block thành công! Hash: " + data.block.hash.substring(0, 16) + "...", true);
        loadMiningStats();

    } catch (err) {
        setMessage(msgEl, "Đào block thất bại: " + err.message, false);
    }
});

// ===============================
// LOAD MINING STATS
// ===============================
async function loadMiningStats() {
    try {
        // Load difficulty
        const diffRes = await fetch("/difficulty");
        if (diffRes.ok) {
            const diffData = await diffRes.json();
            document.getElementById("currentDifficulty").textContent = diffData.current_difficulty;
        }

        // Load reward range
        const rewardRes = await fetch("/reward");
        if (rewardRes.ok) {
            const rewardData = await rewardRes.json();
            document.getElementById("currentRewardRange").textContent = `${rewardData.min} - ${rewardData.max}`;
        }

        // Load chain stats
        const chainRes = await fetch("/chain");
        if (chainRes.ok) {
            const chainData = await chainRes.json();
            document.getElementById("totalBlocks").textContent = chainData.length;
            
            // Count pending transactions in mempool
            let pendingCount = 0;
            if (chainData.chain && chainData.chain.length > 0) {
                // This is a rough estimate - ideally we'd have a separate endpoint
                pendingCount = "Check /overview for details";
            }
            document.getElementById("pendingTxs").textContent = pendingCount;
        }

    } catch (err) {
        console.error("Error loading mining stats:", err);
    }
}

// ===============================
// INIT
// ===============================
window.addEventListener("DOMContentLoaded", () => {
    loadCurrentDifficulty();
    loadCurrentReward();
    loadMiningStats();
});
