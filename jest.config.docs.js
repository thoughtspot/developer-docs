module.exports = {
    transform: {
        '^.+\\.[jt]sx?$': '<rootDir>/jest-preprocess.js',
        '\\.tsx?$': 'ts-jest',
    },
    moduleNameMapper: {
        '.+\\.(css|styl|less|sass|scss)$': 'identity-obj-proxy',
        '.+\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
            '<rootDir>/__mocks__/file-mock.js',
        "^gatsby-page-utils/(.*)$": `gatsby-page-utils/dist/$1`,
    },
    testPathIgnorePatterns: [
        'node_modules',
        '\\.cache',
        '/lib/',
        '/cjs/',
    ],
    transformIgnorePatterns: ['node_modules/(?!(gatsby)/)'],
    globals: {
        __PATH_PREFIX__: '',
        'ts-jest': {
            tsConfig: '<rootDir>/tsconfig.json',
        },
    },
    testURL: 'http://localhost',
    setupFiles: ['<rootDir>/loadershim.js'],
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/setup-test-env.js'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
    collectCoverage: true,
    clearMocks: true,
    coverageDirectory: 'coverage/',
};
