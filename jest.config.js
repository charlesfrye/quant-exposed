module.exports = {
	testEnvironment: "node",
	roots: ["<rootDir>/tests"],
	moduleFileExtensions: ["js", "jsx"],
	testPathIgnorePatterns: ["/node_modules/", "/.next/"],
	transform: {
		"^.+\\.(js|jsx)$": "babel-jest",
	},
	moduleNameMapper: {
		"^../../src/(.*)$": "<rootDir>/src/$1",
	},
	verbose: true,
};
