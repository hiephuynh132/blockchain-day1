import hashlib
import json
import time
import os
from typing import List, Dict, Set

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from ecdsa import SigningKey, VerifyingKey, SECP256k1
import random

# =========================
#  CONFIG
# =========================

INITIAL_DIFFICULTY = 4

BLOCK_REWARD_MIN = 1
BLOCK_REWARD_MAX = 10

COINBASE_MASTER_ADDRESS = "01a31d45447b0ab14da6843208d8967d3c5ea9ae"


# =========================
#  MODELS
# =========================

class TxModel(BaseModel):
    sender: str
    receiver: str
    amount: float
    signature: str
    public_key: str

class SignRequest(BaseModel):
    private_key: str
    sender: str
    receiver: str
    amount: float

class WalletCreateRequest(BaseModel):
    initial_balance: float = 0
# =========================
#  BLOCK
# =========================

class Block:
    def __init__(self, index, timestamp, transactions, previous_hash, difficulty):
        self.index = index
        self.timestamp = timestamp
        self.transactions = transactions
        self.previous_hash = previous_hash
        self.nonce = 0
        self.difficulty = difficulty
        self.hash = self.calculate_hash()

    def to_dict(self):
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": self.transactions,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
            "difficulty": self.difficulty,
            "hash": self.hash,
        }

    def calculate_hash(self):
        data = {
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": self.transactions,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
            "difficulty": self.difficulty,
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    def mine_block(self):
        prefix = "0" * self.difficulty
        while True:
            self.hash = self.calculate_hash()
            if self.hash.startswith(prefix):
                break
            self.nonce += 1


# =========================
#  BLOCKCHAIN
# =========================

# File lưu trữ blockchain
BLOCKCHAIN_DATA_FILE = "blockchain_data.json"

class Blockchain:
    def __init__(self):
        self.chain: List[Block] = []
        self.mempool: List[Dict] = []
        self.tx_log: List[Dict] = []
        self.current_difficulty = INITIAL_DIFFICULTY
        
        # Load dữ liệu từ file nếu tồn tại
        if os.path.exists(BLOCKCHAIN_DATA_FILE):
            self.load_from_file()
        else:
            self.create_genesis_block()

    def create_genesis_block(self):
        genesis_tx = [{
            "sender": "GENESIS",
            "receiver": COINBASE_MASTER_ADDRESS,
            "amount": 1000.0,  # Float for consistency
            "signature": "",
            "public_key": ""
        }]

        genesis = Block(
            index=0,
            timestamp=time.time(),
            transactions=genesis_tx,
            previous_hash="0" * 64,
            difficulty=self.current_difficulty,
        )

        # Mine genesis block để có hash hợp lệ
        genesis.mine_block()
        self.chain.append(genesis)

    # Signature verification
    @staticmethod
    def verify_transaction_signature(tx):
        if tx["sender"] == "COINBASE":
            return True
        try:
            msg = json.dumps({
                "sender": tx["sender"],
                "receiver": tx["receiver"],
                "amount": tx["amount"],
            }, sort_keys=True).encode()

            vk = VerifyingKey.from_string(bytes.fromhex(tx["public_key"]), curve=SECP256k1)
            vk.verify(bytes.fromhex(tx["signature"]), msg, hashfunc=hashlib.sha256)
            return True
        except Exception:
            return False

    # Balance calculation
    def get_balance(self, address: str) -> float:
        balance = 0.0

        for block in self.chain:
            for tx in block.transactions:
                # COINBASE và GENESIS không bị trừ balance (tạo token từ không)
                if tx["sender"] == address and address not in ["COINBASE", "GENESIS"]:
                    balance -= tx["amount"]
                if tx["receiver"] == address:
                    balance += tx["amount"]

        for tx in self.mempool:
            # COINBASE và GENESIS không bị trừ balance
            if tx["sender"] == address and address not in ["COINBASE", "GENESIS"]:
                balance -= tx["amount"]
            if tx["receiver"] == address:
                balance += tx["amount"]

        return balance

    def has_sufficient_balance(self, sender, amount):
        if sender == "COINBASE":
            return True
        return self.get_balance(sender) >= amount

    def add_transaction(self, tx: Dict):
        # Sai chữ ký
        if not self.verify_transaction_signature(tx):
            self.tx_log.append({
                "status": "FAILED",
                "reason": "Invalid signature",
                "tx": tx,
                "timestamp": time.time()
            })
            return False

        # Không đủ balance
        if not self.has_sufficient_balance(tx["sender"], tx["amount"]):
            self.tx_log.append({
                "status": "FAILED",
                "reason": "Insufficient balance",
                "tx": tx,
                "timestamp": time.time()
            })
            return False

        # Thành công đưa vào mempool
        self.mempool.append(tx)

        self.tx_log.append({
            "status": "SUCCESS",
            "reason": "Added to mempool",
            "tx": tx,
            "timestamp": time.time()
        })

        self.save_to_file()  # Lưu sau khi thêm transaction
        return True
    def last_block(self):
        return self.chain[-1]

    def add_block(self, block: Block):
        if block.previous_hash != self.last_block().hash:
            return False
        if block.calculate_hash() != block.hash:
            return False
        if not block.hash.startswith("0" * block.difficulty):
            return False

        self.chain.append(block)
        return True

    def mine_pending_transactions(self, miner_address: str):
        # Cho phép mine empty block (chỉ có coinbase reward)
        reward = random.randint(BLOCK_REWARD_MIN, BLOCK_REWARD_MAX)
        coinbase_tx = {
            "sender": "COINBASE",
            "receiver": miner_address,
            "amount": float(reward),  # Convert to float for consistency
            "signature": "",
            "public_key": "",
        }

        txs = [coinbase_tx] + self.mempool

        new_block = Block(
            index=len(self.chain),
            timestamp=time.time(),
            transactions=txs,
            previous_hash=self.last_block().hash,
            difficulty=self.current_difficulty,
        )

        new_block.mine_block()

        if not self.add_block(new_block):
            return None

        self.mempool = []
        self.save_to_file()  # Lưu sau khi mine
        return new_block

    def save_to_file(self):
        """Lưu blockchain vào file JSON"""
        try:
            data = {
                "chain": [b.to_dict() for b in self.chain],
                "mempool": self.mempool,
                "tx_log": self.tx_log,
                "current_difficulty": self.current_difficulty
            }
            with open(BLOCKCHAIN_DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving blockchain: {e}")

    def load_from_file(self):
        """Load blockchain từ file JSON"""
        try:
            with open(BLOCKCHAIN_DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Restore chain
            for block_data in data.get("chain", []):
                block = Block(
                    index=block_data["index"],
                    timestamp=block_data["timestamp"],
                    transactions=block_data["transactions"],
                    previous_hash=block_data["previous_hash"],
                    difficulty=block_data["difficulty"]
                )
                block.nonce = block_data["nonce"]
                block.hash = block_data["hash"]
                self.chain.append(block)
            
            # Restore mempool và tx_log
            self.mempool = data.get("mempool", [])
            self.tx_log = data.get("tx_log", [])
            self.current_difficulty = data.get("current_difficulty", INITIAL_DIFFICULTY)
            
            print(f"Loaded blockchain from file: {len(self.chain)} blocks")
        except Exception as e:
            print(f"Error loading blockchain: {e}")
            self.create_genesis_block()

    def is_chain_valid(self):
        """
        Kiểm tra tính toàn vẹn của blockchain.
        Checks hash integrity and previous_hash links.
        
        Returns:
            dict: {
                "valid": bool,
                "errors": list of error messages,
                "invalid_blocks": list of block indices
            }
        """
        errors = []
        invalid_blocks = []
        
        for i in range(len(self.chain)):
            current_block = self.chain[i]
            
            # Check 1: Verify block hash is correct
            calculated_hash = current_block.calculate_hash()
            if current_block.hash != calculated_hash:
                error_msg = f"Block #{i}: Hash mismatch (stored: {current_block.hash[:16]}..., calculated: {calculated_hash[:16]}...)"
                errors.append(error_msg)
                invalid_blocks.append(i)
            
            # Check 2: Verify proof-of-work (hash has required difficulty)
            required_prefix = "0" * current_block.difficulty
            if not current_block.hash.startswith(required_prefix):
                error_msg = f"Block #{i}: Invalid proof-of-work (difficulty {current_block.difficulty})"
                errors.append(error_msg)
                if i not in invalid_blocks:
                    invalid_blocks.append(i)
            
            # Check 3: Verify previous_hash link (except genesis block)
            if i > 0:
                previous_block = self.chain[i - 1]
                if current_block.previous_hash != previous_block.hash:
                    error_msg = f"Block #{i}: Previous hash mismatch (expected: {previous_block.hash[:16]}..., got: {current_block.previous_hash[:16]}...)"
                    errors.append(error_msg)
                    if i not in invalid_blocks:
                        invalid_blocks.append(i)
        
        is_valid = len(errors) == 0
        
        return {
            "valid": is_valid,
            "errors": errors,
            "invalid_blocks": invalid_blocks,
            "total_blocks": len(self.chain),
            "message": "Blockchain is valid" if is_valid else f"Blockchain is invalid: {len(errors)} error(s) found"
        }


# =========================
# WALLET
# =========================

def generate_wallet():
    sk = SigningKey.generate(curve=SECP256k1)
    vk = sk.get_verifying_key()
    private_key = sk.to_string().hex()
    public_key = vk.to_string().hex()
    addr = hashlib.sha256(bytes.fromhex(public_key)).hexdigest()[:40]
    return private_key, public_key, addr


def sign_transaction(private_key, sender, receiver, amount):
    sk = SigningKey.from_string(bytes.fromhex(private_key), curve=SECP256k1)
    msg = json.dumps({
        "sender": sender,
        "receiver": receiver,
        "amount": amount
    }, sort_keys=True).encode()

    sig = sk.sign(msg, hashfunc=hashlib.sha256)
    return sig.hex()


# =========================
# FASTAPI
# =========================

app = FastAPI(title="Blockchain Node")
blockchain = Blockchain()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/miner")
def miner():
    return FileResponse(os.path.join(FRONTEND_DIR, "miner.html"))

@app.get("/tampering")
def tampering():
    return FileResponse(os.path.join(FRONTEND_DIR, "tampering.html"))

@app.get("/overview")
def overview():
    return FileResponse(os.path.join(FRONTEND_DIR, "overview.html"))


@app.get("/chain")
def get_chain():
    return {"length": len(blockchain.chain), "chain": [b.to_dict() for b in blockchain.chain]}


@app.post("/mine/{miner_address}")
def mine(miner_address: str):
    block = blockchain.mine_pending_transactions(miner_address)
    if block is None:
        raise HTTPException(400, "No transactions to mine")
    return {"message": "Block mined", "block": block.to_dict()}


@app.post("/transactions/new")
def new_tx(tx: TxModel):
    if not blockchain.add_transaction(tx.dict()):
        raise HTTPException(400, "Invalid TX or insufficient balance")
    return {"message": "Transaction added", "mempool": len(blockchain.mempool)}


@app.post("/wallet/new")
def new_wallet_api(req: WalletCreateRequest = None):
    priv, pub, addr = generate_wallet()
    
    # Lấy initial balance (mặc định 0 nếu không truyền)
    initial_balance = req.initial_balance if req else 0
    
    message = f"Ví mới đã được tạo."
    
    # Chỉ tạo giao dịch COINBASE nếu initial_balance > 0
    if initial_balance > 0:
        coinbase_tx = {
            "sender": "COINBASE",
            "receiver": addr,
            "amount": float(initial_balance),  # Convert to float for consistency
            "signature": "",
            "public_key": ""
        }
        
        # Thêm giao dịch vào mempool
        blockchain.add_transaction(coinbase_tx)
        message = f"Ví mới đã được tạo với {initial_balance} tokens từ COINBASE. Cần mine để xác nhận."
    
    return {
        "private_key": priv, 
        "public_key": pub, 
        "address": addr,
        "initial_balance": initial_balance,
        "message": message
    }


@app.get("/balance/{address}")
def balance(address):
    return {"address": address, "balance": blockchain.get_balance(address)}


# -------------------------
#   OVERVIEW ROUTES
# -------------------------

@app.get("/stats")
def stats():
    total_blocks = len(blockchain.chain)
    total_txs = sum(len(b.transactions) for b in blockchain.chain)

    return {
        "total_blocks": total_blocks,
        "total_transactions": total_txs
    }


@app.get("/accounts")
def accounts():
    addresses = set()

    for block in blockchain.chain:
        for tx in block.transactions:
            addresses.add(tx["sender"])
            addresses.add(tx["receiver"])

    for tx in blockchain.mempool:
        addresses.add(tx["sender"])
        addresses.add(tx["receiver"])

    addresses.discard("GENESIS")

    return {
        "accounts": [
            {"address": a, "balance": blockchain.get_balance(a)}
            for a in addresses
        ]
    }


@app.get("/coinbase")
def coinbase():
    rewards = []

    for block in blockchain.chain:
        for tx in block.transactions:
            if tx["sender"] == "COINBASE":
                rewards.append({
                    "block_index": block.index,
                    "miner": tx["receiver"],
                    "reward": tx["amount"],
                    "timestamp": block.timestamp
                })

    return {"coinbase_rewards": rewards}

@app.get("/txlog")
def get_tx_log():
    return {"txlog": blockchain.tx_log}

@app.get("/difficulty")
def get_difficulty():
    return {
        "current_difficulty": blockchain.current_difficulty,
        "initial_difficulty": INITIAL_DIFFICULTY
    }

@app.post("/difficulty/{new_difficulty}")
def update_difficulty(new_difficulty: int):
    if new_difficulty < 1 or new_difficulty > 10:
        raise HTTPException(400, "Difficulty must be between 1 and 10")
    blockchain.current_difficulty = new_difficulty
    return {
        "message": "Difficulty updated",
        "new_difficulty": blockchain.current_difficulty
    }

@app.get("/reward")
def get_reward():
    global BLOCK_REWARD_MIN, BLOCK_REWARD_MAX
    return {
        "min": BLOCK_REWARD_MIN,
        "max": BLOCK_REWARD_MAX
    }

@app.post("/reward")
def update_reward(min_reward: int, max_reward: int):
    global BLOCK_REWARD_MIN, BLOCK_REWARD_MAX
    
    if min_reward < 0 or max_reward < 0:
        raise HTTPException(400, "Reward must be positive")
    if min_reward > max_reward:
        raise HTTPException(400, "Min reward must be less than or equal to max reward")
    if max_reward > 1000:
        raise HTTPException(400, "Max reward cannot exceed 1000")
    
    BLOCK_REWARD_MIN = min_reward
    BLOCK_REWARD_MAX = max_reward
    
    return {
        "message": "Reward range updated",
        "min": BLOCK_REWARD_MIN,
        "max": BLOCK_REWARD_MAX
    }

@app.post("/sign")
def sign_api(req: SignRequest):
    """
    Ký giao dịch bằng private_key (DEMO).
    Trả về signature + public_key để client dán vào form.
    """
    try:
        # Dùng lại logic sign_transaction để đảm bảo giống hệt
        sig = sign_transaction(
            req.private_key,
            req.sender,
            req.receiver,
            req.amount
        )

        # Lấy public key từ private key
        sk = SigningKey.from_string(bytes.fromhex(req.private_key), curve=SECP256k1)
        vk = sk.get_verifying_key()
        pub_key = vk.to_string().hex()

        return {
            "signature": sig,
            "public_key": pub_key
        }
    except Exception as e:
        raise HTTPException(400, f"Sign error: {e}")

@app.get("/validate")
def validate_chain():
    """
    Kiểm tra tính toàn vẹn của blockchain.
    Sử dụng method is_chain_valid() để validate hash integrity và previous_hash links.
    """
    result = blockchain.is_chain_valid()
    return result

@app.post("/validate/chain")
def validate_custom_chain(chain_data: dict):
    """
    Validate a custom chain sent from client (for tampering demo).
    Trả về chi tiết validation cho từng block.
    """
    try:
        chain_list = chain_data.get("chain", [])
        errors = []
        invalid_blocks = []
        block_details = []  # Chi tiết từng block
        
        for i in range(len(chain_list)):
            block_data = chain_list[i]
            
            # Normalize transactions (đảm bảo amount là float)
            normalized_txs = []
            for tx in block_data["transactions"]:
                normalized_tx = {
                    "sender": tx["sender"],
                    "receiver": tx["receiver"],
                    "amount": float(tx["amount"]),  # Force float
                    "signature": tx.get("signature", ""),
                    "public_key": tx.get("public_key", "")
                }
                normalized_txs.append(normalized_tx)
            
            # Recreate block to calculate hash
            temp_block = Block(
                index=block_data["index"],
                timestamp=block_data["timestamp"],
                transactions=normalized_txs,  # Use normalized
                previous_hash=block_data["previous_hash"],
                difficulty=block_data["difficulty"]
            )
            temp_block.nonce = block_data["nonce"]
            
            # Calculate hash
            calculated_hash = temp_block.calculate_hash()
            stored_hash = block_data["hash"]
            
            # Khởi tạo thông tin block
            block_info = {
                "index": i,
                "stored_hash": stored_hash,
                "calculated_hash": calculated_hash,
                "hash_valid": calculated_hash == stored_hash,
                "pow_valid": stored_hash.startswith("0" * block_data["difficulty"]),
                "previous_hash_valid": True,
                "is_valid": True,
                "errors": []
            }
            
            # Check 1: Hash mismatch
            if calculated_hash != stored_hash:
                errors.append(f"Block #{i}: Hash mismatch")
                invalid_blocks.append(i)
                block_info["is_valid"] = False
                block_info["errors"].append("Hash mismatch")
            
            # Check 2: PoW
            required_prefix = "0" * block_data["difficulty"]
            if not stored_hash.startswith(required_prefix):
                errors.append(f"Block #{i}: Invalid PoW")
                if i not in invalid_blocks:
                    invalid_blocks.append(i)
                block_info["is_valid"] = False
                block_info["errors"].append(f"Invalid PoW (need {block_data['difficulty']} zeros)")
            
            # Check 3: Previous hash link
            if i > 0:
                prev_hash = chain_list[i - 1]["hash"]
                if block_data["previous_hash"] != prev_hash:
                    errors.append(f"Block #{i}: Previous hash mismatch")
                    if i not in invalid_blocks:
                        invalid_blocks.append(i)
                    block_info["is_valid"] = False
                    block_info["previous_hash_valid"] = False
                    block_info["errors"].append("Previous hash mismatch")
            
            block_details.append(block_info)
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "invalid_blocks": invalid_blocks,
            "total_blocks": len(chain_list),
            "block_details": block_details  # Thêm chi tiết từng block
        }
    except Exception as e:
        raise HTTPException(400, f"Validation error: {str(e)}")


@app.post("/debug/hash")
def debug_calculate_hash(block_data: dict):
    """
    Debug endpoint: Tính hash của một block để so sánh.
    """
    try:
        temp_block = Block(
            index=block_data["index"],
            timestamp=block_data["timestamp"],
            transactions=block_data["transactions"],
            previous_hash=block_data["previous_hash"],
            difficulty=block_data["difficulty"]
        )
        temp_block.nonce = block_data["nonce"]
        
        calculated_hash = temp_block.calculate_hash()
        
        # In ra để debug
        import json
        data_for_hash = {
            "index": temp_block.index,
            "timestamp": temp_block.timestamp,
            "transactions": temp_block.transactions,
            "previous_hash": temp_block.previous_hash,
            "nonce": temp_block.nonce,
            "difficulty": temp_block.difficulty,
        }
        json_string = json.dumps(data_for_hash, sort_keys=True)
        
        return {
            "calculated_hash": calculated_hash,
            "stored_hash": block_data.get("hash", "N/A"),
            "match": calculated_hash == block_data.get("hash", ""),
            "json_string": json_string,
            "json_length": len(json_string)
        }
    except Exception as e:
        raise HTTPException(400, f"Debug error: {str(e)}")
