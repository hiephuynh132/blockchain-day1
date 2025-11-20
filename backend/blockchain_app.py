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
BLOCK_REWARD_MAX = 100

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

class Blockchain:
    def __init__(self):
        self.chain: List[Block] = []
        self.mempool: List[Dict] = []
        self.tx_log: List[Dict] = []
        self.current_difficulty = INITIAL_DIFFICULTY
        self.create_genesis_block()

    def create_genesis_block(self):
        genesis_tx = [{
            "sender": "GENESIS",
            "receiver": COINBASE_MASTER_ADDRESS,
            "amount": 10,
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

        genesis.hash = genesis.calculate_hash()
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
                if tx["sender"] == address:
                    balance -= tx["amount"]
                if tx["receiver"] == address:
                    balance += tx["amount"]

        for tx in self.mempool:
            if tx["sender"] == address:
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
        if not self.mempool:
            return None
        reward = random.randint(BLOCK_REWARD_MIN, BLOCK_REWARD_MAX)
        coinbase_tx = {
            "sender": "COINBASE",
            "receiver": miner_address,
            "amount": reward,
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
        return new_block


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
def new_wallet_api():
    priv, pub, addr = generate_wallet()
    return {"private_key": priv, "public_key": pub, "address": addr}


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
