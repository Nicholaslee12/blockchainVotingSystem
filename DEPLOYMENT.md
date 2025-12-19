# Smart Contract Deployment Guide

This guide will help you deploy the DappVotes smart contract to Ethereum networks.

## Prerequisites

1. **MetaMask or another Ethereum wallet** with some ETH/testnet ETH
2. **Node.js and npm/yarn** installed
3. **Hardhat** (already installed in this project)

## Step 1: Set Up Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your values:

   - **PRIVATE_KEY**: Your wallet's private key (the account that will deploy)
     - Get it from MetaMask: Account Details > Export Private Key
     - ⚠️ **NEVER share this key or commit it to Git!**

   - **RPC_URL**: Choose one based on where you want to deploy:
     - For **Sepolia Testnet**: `SEPOLIA_RPC_URL`
     - For **Goerli Testnet**: `GOERLI_RPC_URL`
     - For **Mainnet**: `MAINNET_RPC_URL`
     
     You can get free RPC URLs from:
     - [Alchemy](https://www.alchemy.com/) (Recommended)
     - [Infura](https://www.infura.io/)
     - [QuickNode](https://www.quicknode.com/)

   - **ETHERSCAN_API_KEY**: For contract verification (optional but recommended)
     - Get it from [Etherscan](https://etherscan.io/apis)

## Step 2: Get Testnet ETH (For Testnet Deployment)

If deploying to a testnet, you'll need testnet ETH:

- **Sepolia**: Get from [Sepolia Faucet](https://sepoliafaucet.com/)
- **Goerli**: Get from [Goerli Faucet](https://goerli-faucet.pk910.de/)

## Step 3: Deploy the Contract

### Deploy to Localhost (For Testing)

```bash
# Start a local Hardhat node (in one terminal)
npx hardhat node

# Deploy to localhost (in another terminal)
npx hardhat run scripts/deploy.js --network localhost
```

### Deploy to Sepolia Testnet (Recommended)

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Deploy to Goerli Testnet

```bash
npx hardhat run scripts/deploy.js --network goerli
```

### Deploy to Ethereum Mainnet

⚠️ **Warning**: Deploying to mainnet costs real ETH. Make sure you've tested thoroughly!

```bash
npx hardhat run scripts/deploy.js --network mainnet
```

## Step 4: Verify the Contract (Optional but Recommended)

After deployment, verify your contract on Etherscan:

```bash
# For Sepolia
npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS>

# For Goerli
npx hardhat verify --network goerli <DEPLOYED_CONTRACT_ADDRESS>

# For Mainnet
npx hardhat verify --network mainnet <DEPLOYED_CONTRACT_ADDRESS>
```

## Step 5: Update Your Frontend

After deployment, the contract address will be saved in `artifacts/contractAddress.json`. 

**Important**: If you deployed to a testnet or mainnet, you need to:

1. Update `artifacts/contractAddress.json` with the new address
2. Update `services/blockchain.ts` to use the correct RPC URL for the network you deployed to
3. Make sure your MetaMask is connected to the same network

## Troubleshooting

### Error: "insufficient funds"
- Make sure your wallet has enough ETH/testnet ETH for gas fees

### Error: "nonce too high"
- Wait a few seconds and try again, or reset your MetaMask account

### Error: "network not found"
- Check that your `.env` file has the correct RPC URL
- Make sure you're using the correct network name in the deploy command

## Security Notes

1. **Never commit your `.env` file** to Git
2. **Never share your private key** with anyone
3. **Test thoroughly on testnets** before deploying to mainnet
4. The contract has an ADMIN address hardcoded - make sure this matches your deployment wallet address

## Contract Admin Address

The contract has a hardcoded ADMIN address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

**Important**: This is the Hardhat default account. If you're deploying to a testnet or mainnet, you should:

1. Update the ADMIN address in `contracts/DappVotes.sol` to your deployment wallet address
2. Recompile the contract: `npx hardhat compile`
3. Deploy again

Or deploy with the account that matches the ADMIN address.


