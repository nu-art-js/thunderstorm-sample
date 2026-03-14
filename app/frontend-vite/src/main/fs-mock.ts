/*
 * Browser mock for Node fs - used so logger and other Node-only code can be bundled.
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 */
const noop = () => {};
const noopSync = () => {};
const noopStream = () => ({write: noop, end: noop, on: noop});

export const existsSync = noopSync as (path: string) => boolean;
export const mkdirSync = noopSync;
export const statSync = noopSync;
export const renameSync = noopSync;
export const unlinkSync = noopSync;
export const createWriteStream = noopStream as any;
export default {existsSync, mkdirSync, statSync, renameSync, unlinkSync, createWriteStream};
