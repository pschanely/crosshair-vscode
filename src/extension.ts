import * as vscode from 'vscode';

function getConfiguration (section?: string, document?: vscode.TextDocument): vscode.WorkspaceConfiguration {
	// Adapted from:
	// https://github.com/formulahendry/vscode-code-runner/blob/2bed9aeeabc1118a5f3d75e47bdbcfaf412765ed/src/utility.ts#L6

	if (document) {
	  return vscode.workspace.getConfiguration(section, document.uri);
	} else {
	  return vscode.workspace.getConfiguration(section);
	}
  }
  
  async function inferPythonPath (document?: vscode.TextDocument): Promise<string> {
	const defaultPythonPath = 'python';
  
	try {
	  const extension = vscode.extensions.getExtension('ms-python.python');
	  if (!extension) {
		return defaultPythonPath;
	  }
  
	  const usingNewInterpreterStorage = extension.packageJSON?.featureFlags?.usingNewInterpreterStorage;
	  if (usingNewInterpreterStorage) {
		if (!extension.isActive) {
		  await extension.activate();
		}
		const pythonPath = extension.exports.settings.getExecutionCommand(document?.uri).join(' ');
		return pythonPath;
	  }
  
	  const configuration = getConfiguration('python', document);
	  if (configuration === null || configuration === undefined) {
		return defaultPythonPath;
	  }
  
	  const value = configuration.get<string>('pythonPath');
	  if (value === null || value === undefined) {
		return defaultPythonPath;
	  }
  
	  return value;
	} catch (error) {
	  return defaultPythonPath;
	}
  }
  
  /**
   * Execute the command in a terminal.
   *
   * The terminals related to this extension are all expected to have the same name.
   * If a terminal exists with this name, it will first be closed and a new terminal
   * will be created.
   *
   * @param name of the terminal
   * @param command to be executed
   */
  function executeInRestartedTerminal (name: string, command: string): void {
	// Close the terminal, if it has been already open
	for (const terminal of vscode.window.terminals) {
	  if (terminal.name === name) {
		terminal.dispose();
		break;
	  }
	}
  
	// Open a new one
	const terminal = vscode.window.createTerminal(name);
  
	// We can not wait for terminal to be ready so we wait at least a little bit.
	// See: https://github.com/microsoft/vscode-python/issues/15197
	const registration = vscode.window.onDidChangeActiveTerminal((activeTerminal) => {
	  if (activeTerminal === terminal) {
		setTimeout(() => {
		  terminal.sendText(command);
		}, 1000);
		registration.dispose();
	  }
	});
  }

/**
 * Escape special characters in the path so that it can be passed into the terminal command.
 * 
 * @param path to be escaped
 * @returns [escaped path, error if any]
 */
function escapePath(path: string): [string | null, string | null] {
  // We do not escape double-quotes. This is so uncommon that we ignore it here.
  if (path.includes('"')) {
	return [null, 'Path to the Python file unexpectedly contains double-quotes, ' +
	`so crosshair-vscode can not handle it: ${path}`];
  }

  const escapedPath = path.includes(' ') ? `"${path}"` : path;
  return [escapedPath, null];
}

function inferPathOfActiveFile(): string | null {
	if (!vscode.window.activeTextEditor) {
		return null;
	}
	
	if (!vscode.window.activeTextEditor.document) {
		return null;
	}
	
	if (!vscode.workspace) {
		return null;
	}
	
	const path = vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.fileName);
	return path;
}

export function activate(context: vscode.ExtensionContext) {
	inferPythonPath().then(pythonPath => {
		context.subscriptions.push(
			vscode.commands.registerCommand('crosshair-vscode.check', (event) => {
				let path: string | null;
				
				if(!event) {
					path = inferPathOfActiveFile();
				} else {
					if(event.fsPath) {
						path = event.fsPath;
					} else {
						path = inferPathOfActiveFile();
					}
				}
				
				if(!path) {
					return;
				}

				const [escapedPath, error] = escapePath(path);
				if(error) {
					vscode.window.showErrorMessage(error);
					return;
				}
				
				executeInRestartedTerminal(
					"crosshair check", `${pythonPath} -m crosshair check --analysis_kind=icontract ${escapedPath}`);
			})
		);
	});

	inferPythonPath().then(pythonPath => {
		context.subscriptions.push(
			vscode.commands.registerCommand('crosshair-vscode.watch', (event) => {
				let path: string | null;
				
				if(!event) {
					path = inferPathOfActiveFile();
				} else {
					if(event.fsPath) {
						path = event.fsPath;
					} else {
						path = inferPathOfActiveFile();
					}
				}
				
				if(!path) {
					return;
				}		
				
				const [escapedPath, error] = escapePath(path);
				if(error) {
					vscode.window.showErrorMessage(error);
					return;
				}
				
				executeInRestartedTerminal(
					"crosshair watch", `${pythonPath} -m crosshair watch --analysis_kind=icontract ${escapedPath}`);
			})
		);
	});
}

export function deactivate() {}
