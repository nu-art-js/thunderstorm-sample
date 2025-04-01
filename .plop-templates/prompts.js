function Prompt_Name(type, regexp = /^[a-zA-Z0-9-]{3,}$/) {
	return {
		type: 'input',
		name: 'libName',
		message: `How would you like to call the folder name for this ${type}?`,
		validate: function (value) {
			if (!value || value.trim() === '')
				return `${type} name cannot be empty.`;

			// Optional: Validate that the library name contains only letters, numbers, and hyphens.
			if (!regexp.test(value))
				return `${type} name must only contain letters, numbers, and hyphens.`;

			return true;
		}

	};
}

function Prompt_Description(regexp = /^[a-zA-Z0-9-\s]{3,}$/) {
	return {
		type: 'input',
		name: 'description',
		message: `Write some description?`,
		default: "",
		validate: function (value) {
			if (value.trim() === '')
				return true

			// Optional: Validate that the library name contains only letters, numbers, and hyphens.
			if (!regexp.test(value))
				return `Bad description.`;

			return true;
		}

	};
}

function Prompt_PathTo(regexp=/^[a-zA-Z0-9-_/]{3,}$/) {
	return {
		type: 'input',
		name: 'pathToLib',
		message: 'Where to generate the template?',
		validate: function (value) {
			if (!value || value.trim() === '')
				return true;

			// Optional: Validate that the library name contains only letters, numbers, and hyphens.
			if (!regexp.test(value))
				return 'invalid path';

			return true;
		}
	};
}

function Prompt_LibType(options) {
	return {
		type: 'checkbox', // <-- here’s the key difference
		name: 'libTypes',
		message: 'Which template type do you want to generate?',
		choices: options,
		validate: function (answer) {
			if (!answer || answer.length === 0)
				return 'You must choose at least one library type.';

			return true;
		},
	};
}

function Prompt_PackageName() {
	return {
		type: 'input',
		name: 'packageName',
		message: 'What is the package name?',
		validate: function (value) {
			if (!value || value.trim() === '')
				return true;

			// Optional: Validate that the library name contains only letters, numbers, and hyphens.
			if (!/^[a-zA-Z0-9-/@]{3,}$/.test(value))
				return `invalid path '${value}'`;

			return true;
		}
	};
}

function Prompt_OutputFolder() {
	return {
		type: 'input',
		name: 'outputFolder',
		default: 'dist',
		message: 'What is the output folder of the lib?',
		validate(value) {
			// Let them leave it blank => default to process.cwd()
			if (!value || value.trim() === '')
				return true;

			// Simple check for invalid path chars
			if (!/^[\w\/\-\_]+$/.test(value))
				return 'Invalid folder path.';

			return true;
		}
	};
}

function Prompt_IsPrivate() {
	return {
		type: 'confirm',
		name: 'isPrivate',
		message: 'Is this library private?',
		default: true
	};
}

function Prompt_EntityName() {
	return {
		type: 'input',
		name: 'entityName',
		message: 'How do you call this entity?',
		validate: function (value) {
			if (!value || value.trim() === '')
				return 'Entity name cannot be empty.';

			// Optional: Validate that the library name contains only letters, numbers, and hyphens.
			if (!/^[A-Z][a-zA-Z0-9]{2,}$/.test(value))
				return 'Entity name must only contain letters, numbers, and hyphens.';

			return true;
		}
	};
}

module.exports = {
	Prompts: {
		Name: Prompt_Name,
		Description: Prompt_Description,
		PackageName: Prompt_PackageName,
		EntityName: Prompt_EntityName,
		IsPrivate: Prompt_IsPrivate,
		OutputFolder: Prompt_OutputFolder,
		LibType: Prompt_LibType,
		PathTo: Prompt_PathTo,
	}
}