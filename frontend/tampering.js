// Store original blockchain data
let originalChain = [];
let currentChain = [];

// ===============================
// SHA256 Hash Function (same as Python)
// ===============================
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// ===============================
// Sort Keys Recursively (giống Python sort_keys=True)
// ===============================
function sortKeysRecursive(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => sortKeysRecursive(item));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).sort().reduce((result, key) => {
            result[key] = sortKeysRecursive(obj[key]);
            return result;
        }, {});
    }
    return obj;
}

// ===============================
// Calculate Block Hash
// ===============================
async function calculateBlockHash(block) {
    // Tạo object với tất cả keys sorted giống Python (sort_keys=True)
    const data = {
        difficulty: block.difficulty,
        index: block.index,
        nonce: block.nonce,
        previous_hash: block.previous_hash,
        timestamp: block.timestamp,
        transactions: block.transactions
    };
    
    // Sort keys recursively để match với Python's json.dumps(sort_keys=True)
    const sortedData = sortKeysRecursive(data);
    const blockString = JSON.stringify(sortedData);
    
    return await sha256(blockString);
}

// ===============================
// Load Blockchain
// ===============================
async function loadBlockchain() {
    try {
        const res = await fetch('/chain');
        if (!res.ok) throw new Error('Failed to load chain');
        
        const data = await res.json();
        originalChain = JSON.parse(JSON.stringify(data.chain)); // Deep copy
        currentChain = JSON.parse(JSON.stringify(data.chain));
        
        document.getElementById('totalBlocks').textContent = data.length;
        
        await renderBlocks();
        updateChainStatus();
        
    } catch (err) {
        alert('Error loading blockchain: ' + err.message);
    }
}

// ===============================
// Render Blocks
// ===============================
async function renderBlocks() {
    const container = document.getElementById('blocksContainer');
    container.innerHTML = '';
    
    // Validate current chain with backend - backend sẽ tính hash
    const validationResult = await fetch('/validate/chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: currentChain })
    }).then(r => r.json()).catch(() => ({ invalid_blocks: [], block_details: [] }));
    
    const blockDetails = validationResult.block_details || [];
    
    for (let i = 0; i < currentChain.length; i++) {
        const block = currentChain[i];
        const originalBlock = originalChain[i];
        
        // Lấy thông tin validation từ backend
        const blockInfo = blockDetails[i] || {
            is_valid: true,
            hash_valid: true,
            pow_valid: true,
            previous_hash_valid: true,
            calculated_hash: block.hash,
            stored_hash: block.hash,
            errors: []
        };
        
        const isValid = blockInfo.is_valid;
        const calculatedHash = blockInfo.calculated_hash;
        const isHashValid = blockInfo.hash_valid;
        const isPreviousHashValid = blockInfo.previous_hash_valid;
        const isDataModified = JSON.stringify(block.transactions) !== JSON.stringify(originalBlock.transactions);
        
        const blockCard = document.createElement('div');
        blockCard.className = `block-card ${isValid ? 'valid' : 'invalid'}`;
        blockCard.innerHTML = `
            <div class="block-header">
                <div class="block-index">Block #${block.index}</div>
                <div class="block-status ${isValid ? 'status-valid' : 'status-invalid'}">
                    ${isValid ? '✓ VALID' : '✗ INVALID'}
                </div>
            </div>
            
            <div class="block-field">
                <label>Timestamp:</label>
                <span class="value">${new Date(block.timestamp * 1000).toLocaleString('vi-VN')}</span>
            </div>
            
            <div class="block-field">
                <label>Nonce:</label>
                <span class="value">${block.nonce}</span>
            </div>
            
            <div class="block-field">
                <label>Previous Hash:</label>
                <span class="value ${!isPreviousHashValid ? 'hash-value mismatch' : ''}">${block.previous_hash.substring(0, 16)}...</span>
            </div>
            
            <div class="block-field">
                <label>Transactions:</label>
                <span class="value">${block.transactions.length} giao dịch</span>
            </div>
            
            ${!isValid ? `
                <div class="hash-compare">
                    <div class="hash-row">
                        <span class="hash-label">Stored Hash:</span>
                        <span class="hash-value">${block.hash}</span>
                    </div>
                    <div class="hash-row">
                        <span class="hash-label">Calculated Hash:</span>
                        <span class="hash-value mismatch">${calculatedHash}</span>
                    </div>
                    <div style="color: #991b1b; font-size: 12px; margin-top: 8px;">
                        ${!isHashValid ? '❌ Hash không khớp - dữ liệu đã bị thay đổi!' : ''}
                        ${!isPreviousHashValid ? '❌ Previous hash không khớp với block trước!' : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="tamper-controls">
                <strong style="color: #1e293b; display: block; margin-bottom: 8px;">🛠️ Thử nghiệm Tampering:</strong>
                <div id="tamper-form-${i}" style="display: none; margin-bottom: 12px;">
                    <label style="color: #475569; display: block; margin-bottom: 4px; font-size: 12px;">
                        Số lượng transactions:
                    </label>
                    <div id="tx-inputs-${i}"></div>
                    <button class="tamper-button" onclick="applyChanges(${i})" style="margin-top: 8px;">
                        ✅ Cập nhật Block
                    </button>
                    <button class="tamper-button" onclick="cancelEdit(${i})" style="background: #6b7280; margin-top: 8px;">
                        ❌ Hủy
                    </button>
                </div>
                <button class="tamper-button" id="edit-btn-${i}" onclick="startEdit(${i})">
                    ✏️ Sửa Block Này
                </button>
                <button class="tamper-button reset-button" onclick="restoreBlock(${i})">
                    ↶ Khôi phục
                </button>
            </div>
        `;
        
        container.appendChild(blockCard);
    }
}

// ===============================
// Start Edit Block
// ===============================
function startEdit(index) {
    const formDiv = document.getElementById(`tamper-form-${index}`);
    const editBtn = document.getElementById(`edit-btn-${index}`);
    const txInputsDiv = document.getElementById(`tx-inputs-${index}`);
    
    // Show form, hide edit button
    formDiv.style.display = 'block';
    editBtn.style.display = 'none';
    
    // Render transaction inputs
    const block = currentChain[index];
    txInputsDiv.innerHTML = '';
    
    block.transactions.forEach((tx, txIndex) => {
        const txDiv = document.createElement('div');
        txDiv.style.cssText = 'background: #ffffff; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; margin-bottom: 8px;';
        txDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px; color: #1e293b;">Transaction ${txIndex + 1}</div>
            <div style="margin-bottom: 6px;">
                <label style="color: #64748b; font-size: 11px; display: block;">Sender:</label>
                <input type="text" id="tx-${index}-${txIndex}-sender" value="${tx.sender}" 
                       style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
            </div>
            <div style="margin-bottom: 6px;">
                <label style="color: #64748b; font-size: 11px; display: block;">Receiver:</label>
                <input type="text" id="tx-${index}-${txIndex}-receiver" value="${tx.receiver}" 
                       style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
            </div>
            <div style="margin-bottom: 6px;">
                <label style="color: #64748b; font-size: 11px; display: block;">Amount:</label>
                <input type="number" step="0.01" id="tx-${index}-${txIndex}-amount" value="${tx.amount}" 
                       style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
            </div>
        `;
        txInputsDiv.appendChild(txDiv);
    });
}

// ===============================
// Cancel Edit
// ===============================
function cancelEdit(index) {
    const formDiv = document.getElementById(`tamper-form-${index}`);
    const editBtn = document.getElementById(`edit-btn-${index}`);
    
    formDiv.style.display = 'none';
    editBtn.style.display = 'inline-block';
}

// ===============================
// Apply Changes (Tamper Block)
// ===============================
async function applyChanges(index) {
    try {
        const block = currentChain[index];
        const newTransactions = [];
        
        // Collect all transaction data from inputs
        for (let txIndex = 0; txIndex < block.transactions.length; txIndex++) {
            const sender = document.getElementById(`tx-${index}-${txIndex}-sender`).value;
            const receiver = document.getElementById(`tx-${index}-${txIndex}-receiver`).value;
            const amount = parseFloat(document.getElementById(`tx-${index}-${txIndex}-amount`).value);
            
            // Preserve signature and public_key from original
            newTransactions.push({
                sender: sender,
                receiver: receiver,
                amount: amount,
                signature: block.transactions[txIndex].signature || "",
                public_key: block.transactions[txIndex].public_key || ""
            });
        }
        
        // Modify the block
        currentChain[index].transactions = newTransactions;
        
        // Recalculate hash (but DON'T update it - to show the mismatch)
        // This simulates an attacker changing data without updating hash
        
        await renderBlocks();
        updateChainStatus();
        
        showAlert(`Block #${index} đã bị sửa đổi! Hash không còn hợp lệ.`);
        
    } catch (err) {
        alert('Lỗi khi cập nhật block: ' + err.message);
    }
}

// ===============================
// Restore Block
// ===============================
async function restoreBlock(index) {
    currentChain[index] = JSON.parse(JSON.stringify(originalChain[index]));
    await renderBlocks();
    updateChainStatus();
}

// ===============================
// Reset All
// ===============================
async function resetAll() {
    currentChain = JSON.parse(JSON.stringify(originalChain));
    await renderBlocks();
    updateChainStatus();
    hideAlert();
}

// ===============================
// Update Chain Status
// ===============================
async function updateChainStatus() {
    let tamperedCount = 0;
    let allValid = true;
    
    for (let i = 0; i < currentChain.length; i++) {
        const block = currentChain[i];
        const originalBlock = originalChain[i];
        
        const calculatedHash = await calculateBlockHash(block);
        const isHashValid = calculatedHash === block.hash;
        const isDataModified = JSON.stringify(block.transactions) !== JSON.stringify(originalBlock.transactions);
        
        let isPreviousHashValid = true;
        if (i > 0) {
            isPreviousHashValid = block.previous_hash === currentChain[i - 1].hash;
        }
        
        if (!isHashValid || !isPreviousHashValid || isDataModified) {
            tamperedCount++;
            allValid = false;
        }
    }
    
    document.getElementById('tamperedCount').textContent = tamperedCount;
    
    const statusEl = document.getElementById('integrityStatus');
    if (allValid) {
        statusEl.textContent = '✓ VALID';
        statusEl.className = 'info-value valid';
    } else {
        statusEl.textContent = '✗ INVALID';
        statusEl.className = 'info-value invalid';
    }
}

// ===============================
// Validate with Backend API
// ===============================
async function validateWithBackend() {
    try {
        const res = await fetch('/validate');
        if (!res.ok) throw new Error('Validation failed');
        
        const result = await res.json();
        
        const statusEl = document.getElementById('integrityStatus');
        document.getElementById('tamperedCount').textContent = result.invalid_blocks.length;
        
        if (result.valid) {
            statusEl.textContent = '✓ VALID';
            statusEl.className = 'info-value valid';
            hideAlert();
        } else {
            statusEl.textContent = '✗ INVALID';
            statusEl.className = 'info-value invalid';
            
            // Show detailed errors
            const errorMsg = result.errors.join('\n');
            showAlert(`Backend validation failed:\n${errorMsg}`);
        }
        
        return result;
        
    } catch (err) {
        console.error('Backend validation error:', err);
        return null;
    }
}

// ===============================
// Show/Hide Alert
// ===============================
function showAlert(message) {
    const alertBox = document.getElementById('alertBox');
    const alertMessage = document.getElementById('alertMessage');
    
    alertMessage.textContent = message;
    alertBox.classList.add('show');
}

function hideAlert() {
    const alertBox = document.getElementById('alertBox');
    alertBox.classList.remove('show');
}

// ===============================
// Init
// ===============================
window.addEventListener('DOMContentLoaded', () => {
    // Auto load blockchain on page load
    loadBlockchain();
});
