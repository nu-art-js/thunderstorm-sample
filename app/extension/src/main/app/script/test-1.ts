export const scriptTest1 = function () {
	const getShit = async (key: string) => {
		return (await chrome.storage.sync.get(key))[key];
	};

	(async () => {
		console.log('running2');
		const body = document.createElement('body');
		console.log('running3');
		const pah = await getShit('selected-name');
		body.innerText = pah;
		console.log('running4', pah);
		document.body = body;
		console.log('running5');
	})();
};