const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
    {
        files:['**/*.ts','**/*.tsx'],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        languageOptions: {
            globals: {
                Atomics: "readonly",
                SharedArrayBuffer: "readonly",
            },

            parser: tsParser,
            ecmaVersion: 2018,
            sourceType: "module",
        },

        rules: {
            "no-mixed-spaces-and-tabs": "off",
            "no-unused-vars": "off",
            "no-useless-escape": "off",
            "no-inferrable-types": "off",
            "no-unnecessary-type-constraint": "off",
        },
    },
];