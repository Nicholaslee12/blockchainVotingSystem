import { GlobalState } from '@/utils/types'

export const globalState: GlobalState = {
    wallet: '',
    createModal: 'scale-0', //scale-0 means hidden scale-100 means visible
    updateModal: 'scale-0',
    deleteModal: 'scale-0',
    contestModal: 'scale-0',
    polls: [],
    poll: null,
    contestants: [],
    
}
