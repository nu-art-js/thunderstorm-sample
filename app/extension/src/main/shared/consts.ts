import {StorageKeyEX} from '@nu-art/thunderstorm/chrome-extension';


export const StorageKey_Name = new StorageKeyEX<string>('selected-name');
export const StorageKey_Title = new StorageKeyEX<{ item: string }>('selected-title');