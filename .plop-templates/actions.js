function Action_CopyGitIgnore(outputPath) {
	return {
		type: 'add',
		path: `${outputPath}/.gitignore`,
		templateFile: `lib/_base/.gitignore`,
		skipIfExists: true // This tells Plop to skip if the file already exists.
	};
}

function Action_CopyLicense(outputPath) {
	return {
		type: 'add',
		path: `${outputPath}/LICENSE`,
		templateFile: `lib/_base/LICENSE`,
		skipIfExists: true // This tells Plop to skip if the file already exists.
	};
}

function Action_CopyFiles(basePath, templatePath, outputPath, skipIfExists = true) {
	return {
		type: 'addMany',
		destination: outputPath,
		base: basePath,
		templateFiles: `${basePath}/${templatePath}`,
		skipIfExists
	};
}

module.exports = {
	Actions: {
		CopyLicense: Action_CopyLicense,
		CopyGitIgnore: Action_CopyGitIgnore,
		CopyFiles: Action_CopyFiles
	}
}