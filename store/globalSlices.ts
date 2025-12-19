import { createSlice } from "@reduxjs/toolkit";
import { globalState as GlobalState} from "./states/globalState";
import { globalActions as GlobalActions} from "./actions/globalActions";

//Creates a Redux slice called "global"
//Uses your default state (globalState)
//Uses your state update functions (globalActions)
//Auto-generates Redux actions and reducers for your whole global state
export const globalSlices = createSlice({
    name: "global",
    initialState: GlobalState,
    reducers: GlobalActions,
});

export const globalActions = globalSlices.actions;
export default globalSlices.reducer;