export const scriptTest3 = function () {
	function loadScript(url: string, callback: () => void) {
		// Adding the script tag to the head as suggested before
		const head = document.head;
		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = url;

		script.onload = callback;

		// Fire the loading
		head.appendChild(script);
	}

	console.log('STARTING');
	loadScript('chrome-extension://acmnlhicjmlcebcjgfolngpbjaaebnca/dist/scriptTest2.js', () => {
		console.log('GOT HERE');
	});
};

