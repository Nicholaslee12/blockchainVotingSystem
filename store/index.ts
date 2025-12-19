//Why need this file?
//Easy exporting

import { configureStore } from "@reduxjs/toolkit";
import { globalSlices } from "./globalSlices";

export const store = configureStore({
    //The reducer field expects an object or a function.(In this case, an object))
    //If it’s an object, each key represents a slice of state.
    //The value for each key must be a reducer function, i.e., a function that takes (state, action) and returns the new state.
    
    reducer: {
        //globalSlices.reducer → the function that actually handles state updates
        globalStates: globalSlices.reducer,
    },
});