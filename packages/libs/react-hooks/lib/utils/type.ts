import type { Dispatch, SetStateAction } from 'react';

export type State<S> = [S, Dispatch<SetStateAction<S>>];
