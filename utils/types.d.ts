//Parameters for text truncation function
export interface TruncateParams {
  text: string
  startChars: number
  endChars: number
  maxLength: number
}

//Input data needed to create a poll
export interface PollParams {
  image: string
  title: string
  description: string
  startsAt: number | string
  endsAt: number | string
}

//Structure of a poll returned from blockchain
export interface PollStruct {
  id: number
  image: string
  title: string
  description: string
  votes: number
  contestants: number
  deleted: boolean
  director: string
  startsAt: number
  endsAt: number
  timestamp: number
  avatars: string[]
  voters: string[]
}

//Structure of each contestant
export interface ContestantStruct {
  id: number
  image: string
  name: string
  voter: string
  votes: number
  voters: string[]
  deleted?: boolean
}

//Registered voter information stored in the backend
export interface UserStruct {
  id: string
  name: string
  email: string
  blockchainAddress: string
  createdAt: string
}

//State of your DApp (wallet, modals, polls)
export interface GlobalState {
  wallet: string
  createModal: string
  updateModal: string
  deleteModal: string
  contestModal: string
  polls: PollStruct[]
  poll: PollStruct | null
  contestants: ContestantStruct[]
}

//Root Redux state
export interface RootState {
  globalStates: GlobalState
}
