import { ContestantStruct, GlobalState, PollStruct } from "@/utils/types"
import { PayloadAction } from "@reduxjs/toolkit"

export const globalActions = {
    //Updates the connected wallet address.
    //Payload is telling TypeScript action.payload is ALWAYS PollStruct[],It cannot be something else
    setWallet: (state: GlobalState, action: PayloadAction<string>) => {
        state.wallet = action.payload
    },
    //Controls the visibility of your create poll modal.
    setCreateModal: (state: GlobalState, action: PayloadAction<string>) => {
        state.createModal = action.payload
    },
    //Controls the update poll modal.
    setUpdateModal: (state: GlobalState, action: PayloadAction<string>) => {
        state.updateModal = action.payload
    },
    //Controls the delete poll modal.
    setDeleteModal: (state: GlobalState, action: PayloadAction<string>) => {
        state.deleteModal = action.payload
    },
    //Controls the contest modal for contestants.
    setContestModal: (state: GlobalState, action: PayloadAction<string>) => {
        state.contestModal = action.payload
    },

    //Why It Works Without Returning State?
    //Redux Toolkit uses Immer, which allows writing: state.wallet = "..."
    //Behind the scenes Immer automatically converts it to immutable updates, So you don't return state manually.
    //This action updates the list of all polls.
    //Loading polls from the server
    //Refreshing the poll list
    setPolls: (state: GlobalState, action: PayloadAction<PollStruct[]>) => {
        state.polls = action.payload
    },
    //This action updates one single selected poll.
    //Used when:Opening a poll detail page,Editing a poll,Viewing a single poll
    setPoll: (state: GlobalState, action: PayloadAction<PollStruct | null>) => {
        state.poll = action.payload
    },
    //updates the entire list of contestants in your Redux store
    setContestants: (state: GlobalState, action: PayloadAction<ContestantStruct[]>) => {
        state.contestants = action.payload
    },
}