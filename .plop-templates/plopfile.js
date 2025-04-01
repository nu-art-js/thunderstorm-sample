const {Prompts} = require("./prompts");
const {Actions} = require("./actions");

function normalizePath(data) {
	data.pathToLib = data.pathToLib.trim() === "" ? process.cwd() : `${data.pathToLib}`;
	data.pathToLib = data.pathToLib.startsWith("/") ? `${data.pathToLib}` : `${process.cwd()}/${data.pathToLib}`;
	return data.pathToLib = data.pathToLib.endsWith("/") ? data.pathToLib : `${data.pathToLib}/`
}

module.exports = function (plop) {
	// Optional: Register helper for conditionals
	// plop.setHelper('eq', (a, b) => a === b);

	plop.setGenerator('lib', {
		description: 'Generate a new library',
		prompts: [
			Prompts.Name("library"),
			Prompts.OutputFolder(),
			Prompts.IsPrivate(),
			Prompts.PathTo(),
			Prompts.LibType(['frontend', 'backend'])
		],
		actions: data => {
			const _outputPath = normalizePath(data);
			let pathToLibTemplate = `${__dirname}/lib`;
			const pathTemplateBase = `${pathToLibTemplate}/_base`;

			const actions = []
			data.libTypes.push('shared')
			data.libTypes.forEach((libType) => {
				const outputPath = `${_outputPath}${data.libName}/${libType}`;
				actions.push(...[
					Actions.CopyLicense(outputPath),
					Actions.CopyGitIgnore(outputPath),
					Actions.CopyFiles(pathTemplateBase, "**", outputPath),
					Actions.CopyFiles(`${pathToLibTemplate}/${libType}`, "**/*", outputPath),
				])
			})
			return actions;
		}
	});

	plop.setGenerator('package', {
		description: 'Generate a new library',
		prompts: [
			Prompts.PackageName("package"),
			Prompts.Name("package"),
			Prompts.Description(),
			Prompts.OutputFolder(),
			Prompts.IsPrivate(),
			Prompts.PathTo(),
			Prompts.LibType(['react', 'node'])
		],
		actions: data => {
			const _outputPath = normalizePath(data);
			const pathToLibTemplate = `${__dirname}/package`;

			const actions = []
			data.libTypes.forEach((libType) => {
				const outputPath = `${_outputPath}${data.libName}`;
				actions.push(...[
					Actions.CopyLicense(outputPath),
					Actions.CopyGitIgnore(outputPath),
					Actions.CopyFiles(`${pathToLibTemplate}/${libType}`, "**/*", outputPath),
				])
			})
			return actions;
		}
	});

	plop.setGenerator('proto-db', {
		description: 'Generate DB Proto Entity',
		prompts: [
			Prompts.EntityName(),
			Prompts.PackageName(),
			Prompts.LibType(['frontend', 'backend'])
		],
		actions: data => {
			const _outputPath = normalizePath(data);

			const actions = []
			data.libTypes.push('shared')
			data.libTypes.forEach((libType) => {
				const pathToLibTemplate = `${__dirname}/roto-db/${libType}`;
				const outputPath = `${_outputPath}${data.libName}/${libType}/src/main/_entity/`;
				actions.push(...[
					Actions.CopyFiles(pathToLibTemplate, "**/*", outputPath),
				])
			})
			return actions;
		}
	});
};
