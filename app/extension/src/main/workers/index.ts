import {StorageKey_Name} from '../shared/consts';


chrome.runtime.onInstalled.addListener(async () => {
	await StorageKey_Name.set('ZEVEL');
	console.log('setting name to ZEVEL');
});
