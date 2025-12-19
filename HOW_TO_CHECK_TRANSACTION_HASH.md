# How to Check Transaction Hash During Deployment

## Quick Guide

When you deploy your smart contract, the transaction hash will be automatically displayed in the console output.

## Step-by-Step Instructions

### 1. For Localhost Testing (Recommended First)

**Terminal 1 - Start Local Blockchain:**
```bash
npx hardhat node
```

**Terminal 2 - Deploy Contract:**
```bash
npx hardhat run scripts/deploy.js --network localhost
```

**What You'll See:**
```
Deploying contract...

📝 Transaction Hash: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
🔗 View on Explorer: http://localhost:8545/tx/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
⏳ Waiting for deployment confirmation...

✅ Deployment successful!
📍 Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
📝 Transaction Hash: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
🔗 View on Explorer: http://localhost:8545/tx/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### 2. For Sepolia Testnet (Real Blockchain)

**Prerequisites:**
- Set up `.env` file with your `PRIVATE_KEY` and `SEPOLIA_RPC_URL`
- Have Sepolia ETH in your wallet

**Deploy:**
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

**What You'll See:**
```
Deploying contract...

📝 Transaction Hash: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
🔗 View on Explorer: https://sepolia.etherscan.io/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
⏳ Waiting for deployment confirmation...

✅ Deployment successful!
📍 Contract Address: 0xYourContractAddressHere
📝 Transaction Hash: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
🔗 View on Explorer: https://sepolia.etherscan.io/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

### 3. For Goerli Testnet

```bash
npx hardhat run scripts/deploy.js --network goerli
```

### 4. For Ethereum Mainnet

⚠️ **Warning**: This costs real ETH!

```bash
npx hardhat run scripts/deploy.js --network mainnet
```

## Where to Find the Transaction Hash

The transaction hash appears in **3 places** in the console output:

1. **Immediately after deployment starts** (before confirmation):
   ```
   📝 Transaction Hash: 0x...
   🔗 View on Explorer: https://...
   ```

2. **After deployment is confirmed**:
   ```
   ✅ Deployment successful!
   📝 Transaction Hash: 0x...
   ```

3. **In the saved file** (`artifacts/contractAddress.json`):
   - The contract address is saved, but you can also check the console for the hash

## Viewing Transaction on Blockchain Explorer

### For Testnets:
- **Sepolia**: https://sepolia.etherscan.io/tx/YOUR_TX_HASH
- **Goerli**: https://goerli.etherscan.io/tx/YOUR_TX_HASH

### For Mainnet:
- **Etherscan**: https://etherscan.io/tx/YOUR_TX_HASH

### For Localhost:
- The explorer URL is shown, but localhost transactions aren't viewable on public explorers

## Example Output

Here's what a real deployment output looks like:

```
Deploying contract...

📝 Transaction Hash: 0x7a8f3e2d1c9b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0
🔗 View on Explorer: https://sepolia.etherscan.io/tx/0x7a8f3e2d1c9b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0
⏳ Waiting for deployment confirmation...

✅ Deployment successful!
📍 Contract Address: 0x1234567890123456789012345678901234567890
📝 Transaction Hash: 0x7a8f3e2d1c9b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0
🔗 View on Explorer: https://sepolia.etherscan.io/tx/0x7a8f3e2d1c9b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0
```

## Troubleshooting

### If you don't see the transaction hash:

1. **Check your network connection** - Make sure you're connected to the right network
2. **Check your .env file** - Ensure `PRIVATE_KEY` and RPC URLs are set correctly
3. **Check your wallet balance** - Make sure you have enough ETH/testnet ETH for gas
4. **Check the console output** - The hash should appear right after "Deploying contract..."

### If deployment fails:

- Check the error message in the console
- Verify your private key is correct
- Ensure you have enough funds for gas fees
- Check that your RPC URL is working

## Quick Test (Localhost)

To quickly test and see the transaction hash:

```bash
# Terminal 1
npx hardhat node

# Terminal 2 (in a new terminal)
npx hardhat run scripts/deploy.js --network localhost
```

You'll immediately see the transaction hash in the console output!

