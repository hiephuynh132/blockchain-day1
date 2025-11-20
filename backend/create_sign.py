from blockchain_app import sign_transaction

priv = "6872288c1ef7c7ff63b75380f3a1bccfb68b56a58dd3c20bbb3b1ac05a1f7564"
sender = "01a31d45447b0ab14da6843208d8967d3c5ea9ae"
# ví dummy, có thể tự tạo ví mới
receiver = "6a7234d1283eb466a5ffba1f817d954169ebb699"
amount = 3.0

sig = sign_transaction(priv, sender, receiver, amount)
print(sig)
