# Contributing to Muslim Prayer Reminder MCP

Thank you for your interest in improving this project!

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tareq7/muslim-prayer-mcp.git
   cd muslim-prayer-mcp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

## Pull Request Guidelines

* All pull requests must pass `npm test`, `npm run typecheck`, `npm run build`, and `npm audit`.
* Run `npm run build` before using `node bin/cli.js` locally. Published npm packages include compiled JavaScript; Docker runs the source directly.
* Keep changes scoped and minimal.
* Add unit tests for new calculation parameters, fiqh adjustments, or transport features.
