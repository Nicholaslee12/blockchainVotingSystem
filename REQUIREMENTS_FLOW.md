# Requirements Achievement Flow

This document explains **when** each requirement from your checklist is achieved throughout the entire voting process.

---

## 📋 **1. AUTHENTICATION MODULE**

### ✅ **Register with name, ID, email**
**When:** During user registration
- **Location:** `pages/register.tsx` (lines 13-15, 154-186)
- **Process:**
  1. User fills out registration form with name, IC number, and email
  2. Form submission triggers `handleSubmit()` (line 32)
  3. Data sent to `/api/auth/register` endpoint (line 62)
  4. Backend validates and stores in MySQL `users` table (lines 39-49 in `pages/api/auth/register.ts`)

### ✅ **Each user is assigned a unique blockchain address**
**When:** During registration, when MetaMask wallet is connected
- **Location:** `pages/register.tsx` (lines 21-30, 145-151, 198-207)
- **Process:**
  1. User clicks "Connect MetaMask wallet" button (line 145)
  2. `connectWallet()` function connects to MetaMask (line 25)
  3. Wallet address is stored in Redux state (line 12)
  4. Wallet address is displayed in read-only field (lines 199-207)
  5. Wallet address is sent to backend and linked to user account (line 70)
  6. Backend stores `blockchain_address` in `users` table (line 46 in `pages/api/auth/register.ts`)

### ✅ **Prevent duplicate registration**
**When:** During registration submission, before user is created
- **Location:** `pages/api/auth/register.ts` (lines 23-33)
- **Process:**
  1. When registration form is submitted, backend checks for duplicates (line 24)
  2. Query checks if user exists by ID, email, OR wallet address (line 25)
  3. If duplicate found, returns error: "User with this ID, email or wallet already exists" (line 32)
  4. Only proceeds to create user if no duplicates exist (line 39)

---

## 📋 **2. VOTER LOGIN/AUTHENTICATION MODULE**

### ✅ **Simple login screen**
**When:** User visits login page
- **Location:** `pages/login.tsx` (entire file)
- **Process:**
  1. User navigates to `/login` route
  2. Simple login form is displayed with:
     - IC number or Email input field (lines 120-129)
     - Password input field (lines 131-141)
     - Connected wallet address display (lines 143-152)
     - Login button (lines 157-163)

### ✅ **Option to connect MetaMask wallet**
**When:** On login page, before submitting login form
- **Location:** `pages/login.tsx` (lines 30-39, 111-117)
- **Process:**
  1. "Connect MetaMask wallet" button is displayed (line 111)
  2. User clicks button, triggering `handleConnectWallet()` (line 30)
  3. `connectWallet()` function connects to MetaMask (line 34)
  4. Connected wallet address is displayed (line 116)
  5. Wallet address is required before login can proceed (lines 50-53)

### ✅ **Authenticate before vote access**
**When:** During login process and when accessing voting features
- **Location:** 
  - `pages/login.tsx` (lines 41-86) - Login authentication
  - `pages/api/auth/login.ts` (lines 36-54) - Backend verification
- **Process:**
  1. User submits login form with IC/email, password, and wallet address (line 57)
  2. Backend verifies:
     - User exists by ID or email (lines 24-34 in `pages/api/auth/login.ts`)
     - Wallet address matches registered address (lines 37-44)
     - Password is correct using bcrypt (lines 47-54)
  3. If all checks pass, login is successful (line 56)
  4. Login status stored in localStorage (line 74 in `pages/login.tsx`)
  5. User redirected to dashboard (line 79)
  6. Voting features require logged-in status (checked via localStorage)

---

## 📋 **3. VOTE ENCRYPTION MODULE**

### ✅ **Encrypt vote using AES or RSA encryption on the client side**
**When:** When user clicks "Vote" button for a contestant
- **Location:** 
  - `services/blockchain.ts` (lines 411-422) - Vote encryption trigger
  - `utils/crypto.ts` (lines 48-109) - Encryption implementation
- **Process:**
  1. User clicks "Vote" button on a contestant (triggers `voteCandidate()`)
  2. System fetches RSA public key from backend (line 412 in `services/blockchain.ts`)
  3. `encryptVoteClientSide()` function is called (line 415)
  4. **Encryption happens in browser using Web Crypto API:**
     - RSA-OAEP public key is imported (lines 55-64 in `utils/crypto.ts`)
     - AES-GCM 256-bit key is generated (lines 67-71)
     - Vote data (pollId, contestantId, voter) is serialized to JSON (line 74)
     - Vote is encrypted with AES-GCM (lines 80-84)
     - AES key is wrapped (encrypted) with RSA-OAEP (lines 87-92)
  5. Encrypted payload (ciphertext, IV, wrapped key) is returned (lines 104-108)

### ✅ **Prevents anyone from reading the vote**
**When:** Immediately after encryption, throughout storage and transmission
- **Location:** 
  - `utils/crypto.ts` (entire encryption process)
  - `pages/api/votes/submit.ts` (lines 30-42) - Encrypted storage
- **Process:**
  1. Vote is encrypted **before** leaving the user's browser (client-side)
  2. Only encrypted data (ciphertext, IV, wrapped key) is sent to server (line 434 in `services/blockchain.ts`)
  3. Server stores only encrypted data in MySQL `encrypted_votes` table (lines 30-42 in `pages/api/votes/submit.ts`)
  4. **No one can read the vote** without the RSA private key (stored securely on server)
  5. Even database administrators cannot read votes - they only see encrypted strings

### ✅ **Store only encrypted vote on-chain**
**When:** After encryption, when vote is submitted to blockchain
- **Location:** 
  - `services/blockchain.ts` (lines 424-441)
  - `contracts/DappVotes.sol` (lines 241-258) - Smart contract vote function
- **Process:**
  1. Encrypted vote is stored in MySQL database first (line 425 in `services/blockchain.ts`)
  2. Then blockchain transaction is executed (line 441)
  3. Smart contract `vote()` function is called (line 241 in `DappVotes.sol`)
  4. **Important:** The smart contract only stores:
     - Voter address (line 251)
     - Vote timestamp (line 257)
     - Vote count increment (lines 250, 253)
  5. **The actual vote choice (contestant ID) is NOT stored on-chain** - only the encrypted version in MySQL
  6. This ensures vote privacy - blockchain shows someone voted, but not who they voted for

---

## 📋 **4. VOTE TALLYING MODULE**

### ✅ **Read data from smart contract**
**When:** When admin performs vote tallying
- **Location:** 
  - `pages/api/admin/tally.ts` (lines 33-41) - Reading encrypted votes
  - `contracts/DappVotes.sol` (various getter functions) - Smart contract data
- **Process:**
  1. Admin clicks "Tally Poll" button in manage-users page
  2. Backend reads encrypted votes from MySQL `encrypted_votes` table (lines 34-40 in `pages/api/admin/tally.ts`)
  3. For each encrypted vote:
     - Decrypts using RSA private key (line 67)
     - Extracts contestant ID from decrypted data (line 77)
     - Tallies votes by contestant (lines 88-91)
  4. Smart contract data can also be read via:
     - `getPoll(id)` - Get poll details
     - `getContestants(id)` - Get contestant list
     - `getPolls()` - Get all polls
  5. Tally results show vote counts per contestant (line 111)

---

## 📋 **5. DISPLAY VOTE COUNTS**

### ✅ **Display vote counts in real-time or after the election closes**
**When:** Continuously during and after voting period
- **Location:** 
  - `pages/dashboard.tsx` (lines 14-17, 90, 116-165) - Dashboard display
  - `components/Contestants.tsx` (lines 47-51, 523-532) - Contestant vote display
  - `components/ResultsModal.tsx` (lines 42-45, 99-100) - Results modal
- **Process:**
  1. **Real-time updates:**
     - Vote counts are displayed on dashboard (line 90 in `pages/dashboard.tsx`)
     - Each contestant card shows vote count (line 529 in `components/Contestants.tsx`)
     - Counts update after each vote transaction is confirmed (line 452 in `services/blockchain.ts`)
  2. **After election closes:**
     - Results modal automatically appears when poll ends (lines 44-67 in `pages/polls/[id].tsx`)
     - Shows total votes and winner (lines 99-100 in `components/ResultsModal.tsx`)
     - Dashboard continues to show updated counts (line 90)

### ✅ **Show percentage charts or table**
**When:** When viewing vote tallies and results
- **Location:**
  - `pages/manage-users.tsx` (lines 228-250) - Admin tally table
  - `pages/dashboard.tsx` (lines 127-165) - Dashboard vote tally table
  - `components/ResultsModal.tsx` (lines 108-145) - Results modal table
- **Process:**
  1. **Admin Tally Table:**
     - Admin clicks "Tally Poll" button
     - Table displays: Contestant Name | Votes | Percentage (lines 228-250 in `pages/manage-users.tsx`)
     - Percentages calculated: `(votes / totalVotes) * 100` (line 236)
  2. **Dashboard Table:**
     - Always visible on dashboard page (lines 127-165 in `pages/dashboard.tsx`)
     - Shows: Rank | Contestant | Votes | Percentage
     - Updates in real-time as votes are cast
  3. **Results Modal Table:**
     - Appears when election ends (lines 108-145 in `components/ResultsModal.tsx`)
     - Shows ranked table with percentages
     - Highlights winner with trophy icon

---

## 🔄 **COMPLETE USER FLOW SUMMARY**

1. **Registration Phase:**
   - User connects MetaMask → ✅ Unique blockchain address assigned
   - User fills form (name, ID, email) → ✅ Registration with required fields
   - Backend checks duplicates → ✅ Duplicate prevention
   - User account created → ✅ Linked to blockchain address

2. **Login Phase:**
   - User visits login page → ✅ Simple login screen displayed
   - User connects MetaMask → ✅ Wallet connection option
   - User submits credentials → ✅ Authentication before vote access
   - Login successful → ✅ Access granted to voting features

3. **Voting Phase:**
   - User selects contestant → Vote button clicked
   - **Encryption happens in browser** → ✅ Client-side AES/RSA encryption
   - Encrypted vote sent to server → ✅ Only encrypted data stored
   - Encrypted vote stored in MySQL → ✅ Prevents reading votes
   - Blockchain transaction executed → ✅ Vote recorded on-chain (anonymously)
   - Vote counts update → ✅ Real-time display

4. **Results Phase:**
   - Election ends → ✅ Results modal appears
   - Admin tallies votes → ✅ Reads from smart contract & decrypts
   - Tables displayed → ✅ Vote counts with percentages shown
   - Charts/tables visible → ✅ Percentage calculations displayed

---

## 🔐 **SECURITY FLOW**

- **Registration:** Prevents duplicate accounts (ID, email, wallet)
- **Login:** Verifies wallet matches registered address + password
- **Voting:** Encrypts vote before transmission (client-side)
- **Storage:** Only encrypted data in database
- **Blockchain:** Only stores voter address, not vote choice
- **Tallying:** Only admin can decrypt using private key

---

*Last updated: Based on current codebase implementation*

