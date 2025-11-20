# Blockchain Day1 - AI Agent Instructions

## Architecture Overview

This is an educational blockchain implementation with a **FastAPI backend** (`backend/blockchain_app.py`) and **vanilla JavaScript frontend** (`frontend/`). The backend serves both as the API and static file server for the frontend.

### Key Components
- **Blockchain**: In-memory blockchain with PoW mining, transaction mempool, and ECDSA signature verification
- **Wallet**: SECP256k1 key generation and transaction signing
- **Mining**: Proof-of-work with configurable difficulty, random block rewards (1-100)
- **Transaction Log**: Records all transaction attempts with status (SUCCESS/FAILED) and failure reasons

## Development Workflow

### Start the Server
```bash
uvicorn blockchain_app:app --reload --port 8000
```
Run from the `backend/` directory. The server auto-reloads on code changes.

### Frontend Access
- Main UI: `http://localhost:8000/` (wallet, transactions, mining, chain viewer)
- Overview Dashboard: `http://localhost:8000/overview` (stats, accounts, coinbase rewards, tx log)
- Sign Tool: `sign_popup.html` (helper for generating signatures with private keys)

### Dependencies
Install with: `pip install -r backend/requirements.txt`
- `fastapi` + `uvicorn` for API
- `ecdsa` for cryptographic signatures
- CORS enabled for all origins (development setup)

## Critical Patterns

### Transaction Validation Flow
Transactions fail if:
1. Signature verification fails (logged to `tx_log` with reason "Invalid signature")
2. Insufficient balance (logged with reason "Insufficient balance")

Only valid transactions enter the `mempool`. Check `blockchain.tx_log` for debugging failed transactions.

### Balance Calculation
`get_balance()` scans the entire chain + mempool. No UTXO model - uses account-based ledger:
- Receiver gets `+amount`, sender gets `-amount`
- COINBASE and GENESIS addresses have special privileges (unlimited balance)

### Signature Scheme
Sign the **canonical JSON** of transaction fields (sorted keys):
```python
msg = json.dumps({
    "sender": tx["sender"],
    "receiver": tx["receiver"],
    "amount": tx["amount"]
}, sort_keys=True).encode()
```
Use SHA256 hash. Public key must match the sender address (SHA256 hash of public key, first 40 hex chars).

### Mining Process
1. Creates coinbase transaction with random reward (`BLOCK_REWARD_MIN` to `BLOCK_REWARD_MAX`)
2. Adds all mempool transactions to the new block
3. Mines with PoW (difficulty = number of leading zeros in hash)
4. Clears mempool on successful mining

## Configuration Constants
Located at top of `blockchain_app.py`:
- `INITIAL_DIFFICULTY = 4` (mining difficulty)
- `BLOCK_REWARD_MIN/MAX = 1/100` (coinbase reward range)
- `COINBASE_MASTER_ADDRESS` (genesis coinbase recipient)

## Frontend-Backend Integration

### API Endpoints
- `POST /wallet/new` - Generate new ECDSA wallet
- `GET /balance/{address}` - Get account balance
- `POST /transactions/new` - Submit signed transaction
- `POST /mine/{miner_address}` - Mine pending transactions
- `GET /chain` - Full blockchain data
- `POST /sign` - Sign transaction with private key (DEMO only)
- `GET /stats`, `/accounts`, `/coinbase`, `/txlog` - Dashboard data

### Frontend Structure
- `index.html` + `app.js`: Main interface (5 sections: wallet, balance, tx, mining, chain viewer)
- `overview.html` + `overview.js`: Read-only dashboard with 4 data tables
- `sign_popup.html`: Standalone tool for transaction signing
- All frontend uses `fetch()` API with async/await pattern

## Common Tasks

### Adding a New Transaction Field
1. Update `TxModel` in `blockchain_app.py`
2. Modify `sign_transaction()` message format (maintain sorted keys)
3. Update `verify_transaction_signature()` accordingly
4. Adjust frontend forms and API calls

### Changing Mining Difficulty
Modify `INITIAL_DIFFICULTY` or implement adaptive difficulty in `Blockchain.__init__()`. Affects `mine_block()` validation prefix.

### Debugging Transaction Failures
Check `GET /txlog` endpoint - logs all attempts with timestamps, status, and failure reasons.
