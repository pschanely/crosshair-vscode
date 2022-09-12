# crosshair-vscode

Crosshair-vscode is an extension for [Visual Studio Code (VS Code)][vscode] that
allows you to statically test your Python code using [CrossHair][crosshair-tool].

## Installation

Crosshair-vscode has two dependencies:
* The Python extension [ms-python.python][ms-python.python] for
  [VS Code][vscode], and
* The Python package [crosshair-tool][crosshair-tool].

**ms-python.python**.
Use the Visual Studio marketplace to install the extension ms-python.python by
following [this link][ms-python.python].

**crosshair-tool**. The easiest way to install the package
[crosshair-tool][crosshair-tool] is to open the terminal tab and run pip3:

```
pip3 install crosshair-tool
```

[crosshair-tool][crosshair-tool] must be installed in each Python environment that you wish to use. (the environment is displayed and can be changed in the status bar)

**crosshair-vscode**.
Use the Visual Studio marketplace to install the extension ms-python.python by
following [this link][crosshair-vscode].

[vscode]: https://code.visualstudio.com/
[ms-python.python]: https://marketplace.visualstudio.com/items?itemName=ms-python.python
[crosshair-tool]: https://pypi.org/project/crosshair-tool/
[venv]: https://docs.python.org/3/tutorial/venv.html
[vscode-venv]: https://code.visualstudio.com/docs/python/environments
[crosshair-vscode]: https://marketplace.visualstudio.com/items?itemName=CrossHair.crosshair-vscode

## Usage

The extension can be accessed from the status bar. When editing Python files, you'll see a new item labeled "CH off" (or "CH on" if the background watcher is already running).

<img src="https://raw.githubusercontent.com/pschanely/crosshair-vscode/main/readme/status-bar-item.png" width=100 alt="status bar item" />

Click on this item to open a menu and perform various commands.

<img src="https://raw.githubusercontent.com/pschanely/crosshair-vscode/main/readme/quick-pick.png" width=450 alt="crosshair menu" />

Most importantly, you'll want to start the background watcher; by default, it does not auto-start. Once started, CrossHair will attempt to detect contract counterexamples in the background. When it finds something, you'll see it highlighted like this:

<img src="https://raw.githubusercontent.com/pschanely/crosshair-vscode/main/readme/example-error.png" width=550 alt="example crosshair error" />


NOTE: To reduce wasteful computation, the background watcher only checks contracts in files that are open. You may decide to leave some files open to ensure some contracts continue to be checked as you work.

If you want to be even more targeted by just checking an individual file, use the "watch in terminal" command.


## Commands

The extension defines the following commands:

* `crosshair-vscode.pick`. Show a quick pick that allows you to select a command
  to execute.
  
  This is handy if you do not want to memorize individual commands, and want to set up
  a single keyboard shortcut to invoke crosshair-vscode.

* `crosshair-vscode.start`. Start the background watcher process.

* `crosshair-vscode.stop`. Start the background watcher process.

* `crosshair-vscode.watch`. Open a new terminal watching a file with crosshair.

   There is an optional argument indicating the path to a file.
   If no path is given, watch the current active file in the editor.

* `crosshair-vscode.gentests`. Produce tests for the function at the current cursor position.


## Settings

Search your VSCode settings for "crosshair" to see the options that you can configure. Here, you can do things like set project-specific contract types (icontract vs asserts) and change whether the background watcher automatically starts.

## Known Issues

It is hard to control terminals in VS Code (see
[this issue](https://github.com/microsoft/vscode-python/issues/15197)).
We wait for a short delay (~1 second) till we send commands to the terminal.
This might cause racing conditions in some rare cases.

## Contributing

Please see [CONTRIBUTING.md] for how to help us with development of the extension.

## Credits

This plugin was authored by
[Marko Ristin](https://github.com/mristin)
and is now maintained by [Phillip Schanely](https://github.com/pschanely).

## Versioning

We follow a bit unusual semantic versioning schema:

* X is the oldest supported major version of
  [crosshair-tool],
* Y is the minor version (new or modified features), and
* Z is the patch version (only bug fixes).

## Release Notes

### 0.0.1

Initial release of crosshair-vscode.

### 0.0.2

CrossHair now runs transparently in the background and highlights counterexamples directly in your code, just like a typechecker or linter would.
You can stop or start CrossHair in the status bar.
Some of the more specialized check commands have been removed, as background execution is the recommended way to use CrossHair.
