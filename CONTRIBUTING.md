# Contributing

(All the following commands are expected to be run from the repository root, unless stated
otherwise.)

## Install Development Dependencies

We assume you have [Node.js 14.x](https://nodejs.org/en/download/) installed. 
The package manager `npm` is expected to be part of the Node.js, so you do not have to install it
separately. 

To install the development dependencies of the project, call:
```
npm install
```

## Compile

```
npm run compile
```

## Lint

To check the code:
```
npm run lint
```

To automatically fix some of the issues:
```
npx eslint src --ext ts --fix
```

## Run Tests

You need to compile first.

Then run:
```
node ./out/test/runTest.js
```

## Commit Messages

We follow 
[the guideline written by Chris Beam](https://chris.beams.io/posts/git-commit/):

1) Separate subject from body with a blank line
2) Limit the subject line to 50 characters
3) Capitalize the subject line
4) Do not end the subject line with a period
5) Use the imperative mood in the subject line
6) Wrap the body at 72 characters
7) Use the body to explain *what* and *why* vs. *how*