# Predicte Commit

<div align="center">
  <img src="images/icon.png" alt="Predicte Commit Icon" width="128" height="128" />
  <h1>Predicte Commit: AI Commit Message Generator</h1>
  <p>
    <b>Zero-Friction, Privacy-Aware AI Commit Messages for VS Code</b><br>
    Powered by Mistral AI or Local LLMs (Ollama, vLLM, etc.)
  </p>
</div>

<div align="center">

![CI](https://github.com/gasatrya/predicte-commit/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/github/license/gasatrya/predicte-commit)

</div>

**Predicte Commit** analyzes your staged changes and generates concise, descriptive commit messages using AI. It brings the magic of AI automation to your git workflow while keeping you in control.

_This extension is for developers who want to automate the tedious task of writing commit messages without leaving their source control view._

## Features

- **100% Free**: Use Mistral's latest coding models (Devstral 2).
- **Zero-Friction**: Generate messages with a single click or command.
- **Privacy-Aware**: Built-in content filtering and explicit file ignores to keep secrets safe.
- **Flexible Providers**: Use **Mistral AI** (cloud) or your own **Local** instance (Ollama, vLLM, LM Studio).
- **Smart Truncation**: Automatically handles large diffs to stay within context windows.
- **Efficient**: Streamlined to provide quick results directly in your commit input box.

## Installation

1. Open the **Extensions** sidebar in VS Code (`Ctrl+Shift+X`).
2. Search for `Predicte Commit`.
3. Click **Install**.

## Getting Started

1.  **Get an API Key**: Sign up at [Mistral AI](https://console.mistral.ai/) and get your API key.
2.  **Set Key**: Open Command Palette (`Ctrl+Shift+P`) and run **Predicte Commit: Set API Key**.
3.  **Stage Changes**: Stage your files in the Source Control view as usual.
4.  **Generate Message**:
    - Click the **Sparkle Icon** in the Source Control title bar.
    - _Or_ open the Command Palette (`Ctrl+Shift+P`) and run **Predicte Commit: Generate Message**.
5.  **Review**: The generated message will appear in your commit input box. Edit if needed, then commit!

> **Note**: If using the Mistral provider (default), you will be prompted to enter your API key on the first run.

## Configuration

| Setting                        | Default                               | Description                                                      |
| :----------------------------- | :------------------------------------ | :--------------------------------------------------------------- |
| `predicteCommit.provider`      | `mistral`                             | Choose provider (default: mistral).                              |
| `predicteCommit.models`        | `[]`                                  | List of models to use. If empty, uses provider defaults.         |
| `predicteCommit.ignoredFiles`  | `["*-lock.json", "*.svg", "dist/**"]` | Glob patterns to exclude from analysis.                          |
| `predicteCommit.useLocal`      | `false`                               | Enable to use a local provider instead of Mistral.               |
| `predicteCommit.localProvider` | `ollama`                              | Local provider to use when Use Local is enabled.                 |
| `predicteCommit.localBaseUrl`  | _(empty)_                             | Base URL for local provider (e.g., `http://localhost:11434/v1`). |
| `predicteCommit.localModel`    | _(empty)_                             | Model name for local provider.                                   |
| `predicteCommit.debugLogging`  | `false`                               | Log prompt payload and diagnostics to the output channel.        |

## Build VSIX Locally

Local VSIX packaging is configured without publishing to Visual Studio Marketplace.

### Standard VSIX build

```bash
npm ci
npm exec vsce package
```

This creates a file like `predicte-commit-1.0.2.vsix` in the project root.

### Local build with personal ignore rules

If you use a local `.vscodeignore.local`, run:

```bash
npm run package:local
```

This also creates a local `.vsix`, but merges `.vscodeignore` with your personal `.vscodeignore.local` rules first.

## Contributing

We love contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) to get started.

## License

MIT © [Ga Satrya](https://github.com/gasatrya)
