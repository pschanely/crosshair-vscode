# crosshair-vscode

![Build-and-lint](https://github.com/mristin/icontract-hypothesis-vscode/workflows/Build-and-lint/badge.svg)

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
[crosshair-tool][crosshair-tool] is *via* pip3:

```
pip3 insatll crosshair-tool
```

If you use a [virtual environment][venv], make sure that you activate it
beforehand so that the package [crosshair-tool][crosshair-tool] is
installed in it (instead of globally).

You have to [set up ms-python.python][vscode-venv] extension so that
crosshair-vscode can access the package
[[crosshair-tool][crosshair-tool].

**crosshair-vscode**.
Use the Visual Studio marketplace to install the extension ms-python.python by
following [this link][crosshair-vscode].

[vscode]: https://code.visualstudio.com/
[ms-python.python]: https://marketplace.visualstudio.com/items?itemName=ms-python.python
[crosshair-tool]: https://pypi.org/project/crosshair-tool/
[venv]: https://docs.python.org/3/tutorial/venv.html
[vscode-venv]: https://code.visualstudio.com/docs/python/environments
[crosshair-vscode]: https://marketplace.visualstudio.com/items?itemName=mristin.crosshair-vscode

## Usage

The crosshair-vscode is automatically activated when you start your
[VS Code][vscode] (and [ms-python.python[ms-python.python] is activated).

You access it through the editor context pop-up menu:

<!-- TODO: capture images after discussing with @pshanely -->
<img src="https://raw.githubusercontent.com/mristin/crosshair-vscode/main/readme/editor-popup.png" width=400 alt="editor pop-up" />

Or, alternatively, through the explorer pop-up menu:

<img src="https://raw.githubusercontent.com/mristin/crosshair-vscode/main/readme/explorer-popup.png" width=400 alt="explorer pop-up" />

You can also check or watch a folder by selecting it in the explorer:

<img src="https://raw.githubusercontent.com/mristin/crosshair-vscode/main/readme/explorer-popup-folder.png" width=400 alt="explorer folder pop-up" />

The commands are executed in a terminal named "crosshair check" and
"crosshair watch", respectively.
(If a terminal with that name already exists, it will be closed first and then
freshly re-opened.
This is necessary so that we do not pollute your terminal space on many command
calls.)

Following commands are provided.

**crosshair check**.
Run CrossHair to check the code statically.

If you run it from the editor's pop-up menu, it will check the current file.

If you run it from the explorer's pop-up menu, it will check the the selected
item.
This can be a file, but also a folder.
If it is a folder, it will check all the Python files beneath it.

**crosshair watch**.
Start CrossHair and check the code continuously, on every file change.

If you run it from the editor's pop-up menu, it will watch the current file.

Analogously to `crosshair check`, if you run it from the explorer's pop-up menu,
it will watch the selected file or folder, depending on what you selected.

## Commands

The extension defines the following commands:

* `crosshair-vscode.check`. Check the file or folder. 

   There is an optional argument indicating the path (to a file or a folder).
   If no path is given, check the current active file in the editor.
* `crosshair-vscode.watch`. Watch the file or folder.

   There is an optional argument indicating the path (to a file or a folder).
   If no path is given, watch the current active file in the editor.
   
Please see [Section "Usage"](#Usage) for more details.

## Known Issues

It is hard to control terminals in VS Code (see
[this issue](https://github.com/microsoft/vscode-python/issues/15197)).
We wait for a short delay (~1 second) till we send commands to the terminal.
This might cause racing conditions in some rare cases.

## Contributing

Please see [CONTRIBUTING.md] for how to help us with development of the extension.

## Versioning

<!-- TODO: discuss with @pshanely -->
TODO

## Release Notes

### 1.0.0

Initial release of crosshair-vscode.
