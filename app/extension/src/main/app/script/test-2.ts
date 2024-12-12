import { StorageKey_Name } from '../../shared/consts';


export default (async () => {
	console.log('running2');
	const body = document.createElement('body');
	console.log('running3');
	const pah = await StorageKey_Name.get();
	body.innerText = pah;
	console.log('running4', pah);
	document.body = body;
	console.log('running5');
})();