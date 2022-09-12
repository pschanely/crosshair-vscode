import * as vscode from 'vscode'
import * as pathModule from 'path'

function getConfiguration(
  section?: string,
  document?: vscode.TextDocument
): vscode.WorkspaceConfiguration {
  // Adapted from:
  // https://github.com/formulahendry/vscode-code-runner/blob/2bed9aeeabc1118a5f3d75e47bdbcfaf412765ed/src/utility.ts#L6

  if (document) {
    return vscode.workspace.getConfiguration(section, document.uri)
  } else {
    return vscode.workspace.getConfiguration(section)
  }
}

async function inferPythonPath(
  document?: vscode.TextDocument
): Promise<string> {
  const defaultPythonPath = 'python'

  try {
    const extension = vscode.extensions.getExtension('ms-python.python')
    if (!extension) {
      return defaultPythonPath
    }

    const usingNewInterpreterStorage =
      extension.packageJSON?.featureFlags?.usingNewInterpreterStorage
    if (usingNewInterpreterStorage) {
      if (!extension.isActive) {
        await extension.activate()
      }
      const pythonPath = extension.exports.settings
        .getExecutionCommand(document?.uri)
        .join(' ')
      return pythonPath
    }

    const configuration = getConfiguration('python', document)
    if (configuration === null || configuration === undefined) {
      return defaultPythonPath
    }

    const value = configuration.get<string>('pythonPath')
    if (value === null || value === undefined) {
      return defaultPythonPath
    }

    return value
  } catch (error) {
    return defaultPythonPath
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
function executeInRestartedTerminal(name: string, command: string): void {
  // Close the terminal, if it has been already open
  for (const terminal of vscode.window.terminals) {
    if (terminal.name === name) {
      terminal.dispose()
      break
    }
  }

  // Open a new one
  const terminal = vscode.window.createTerminal(name)

  // We can not wait for terminal to be ready so we wait at least a little bit.
  // See: https://github.com/microsoft/vscode-python/issues/15197
  const registration = vscode.window.onDidChangeActiveTerminal(
    (activeTerminal) => {
      if (activeTerminal === terminal) {
        setTimeout(() => {
          terminal.sendText(command)
        }, 1000)
        registration.dispose()
      }
    }
  )
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
    return [
      null,
      'Path to the Python file unexpectedly contains double-quotes, ' +
        `so crosshair-vscode can not handle it: ${path}`,
    ]
  }

  const escapedPath = path.includes(' ') ? `"${path}"` : path
  return [escapedPath, null]
}

function inferPathOfActiveFile(): string | null {
  if (!vscode.window.activeTextEditor) {
    return null
  }

  if (!vscode.window.activeTextEditor.document) {
    return null
  }

  if (!vscode.workspace) {
    return null
  }

  const path = vscode.workspace.asRelativePath(
    vscode.window.activeTextEditor.document.fileName
  )
  return path
}

function inferPath(event: any): string | null {
  let path: string | null = null
  if (!event) {
    path = inferPathOfActiveFile()
  } else {
    if (event.fsPath) {
      path = event.fsPath
    } else {
      path = inferPathOfActiveFile()
    }
  }

  return path
}

function inferLine(): number | null {
  if (vscode.window.activeTextEditor === undefined) {
    return null
  }

  const line: number = vscode.window.activeTextEditor.selection.active.line + 1
  return line
}

type CommandWithLineImpl = (
  pythonPath: string,
  escapedPath: string,
  line: number
) => void

/**
 * Takes care of the plumbing so that you can easily add new VS Code commands which depend
 * on the path to the python interpreter, the path to the active file, and the line under the caret.
 */
function executeCommandWithLine(
  event: any,
  pythonPath: string,
  saveActiveDocument: boolean,
  commandWithLineImpl: CommandWithLineImpl
) {
  if (saveActiveDocument) {
    if (vscode.window.activeTextEditor?.document?.isDirty) {
      vscode.window.activeTextEditor.document.save()
    }
  }

  const path: string | null = inferPath(event)
  if (!path) {
    return
  }

  const [escapedPath, error] = escapePath(path)
  if (error) {
    vscode.window.showErrorMessage(error)
    return
  }

  if (escapedPath === null) {
    vscode.window.showErrorMessage('Unexpected escapedPath null and no error.')
    return
  }

  const line: number | null = inferLine()
  if (line === null) {
    vscode.window.showErrorMessage(
      'Unexpected execution of a command with line when there is no active text editor.'
    )
    return
  }

  commandWithLineImpl(pythonPath, escapedPath, line)
}

type CommandImpl = (pythonPath: string, escapedPath: string) => void

/**
 * Takes care of the plumbing so that you can easily add new VS Code commands which depend
 * on the path to the python interpreter and the path to the active file.
 */
function executeCommand(
  event: any,
  pythonPath: string,
  saveActiveDocument: boolean,
  commandImpl: CommandImpl
) {
  if (saveActiveDocument) {
    if (vscode.window.activeTextEditor?.document?.isDirty) {
      vscode.window.activeTextEditor.document.save()
    }
  }

  const path: string | null = inferPath(event)
  if (!path) {
    return
  }

  const [escapedPath, error] = escapePath(path)
  if (error) {
    vscode.window.showErrorMessage(error)
    return
  }

  if (escapedPath === null) {
    vscode.window.showErrorMessage('Unexpected escapedPath null and no error.')
    return
  }

  commandImpl(pythonPath, escapedPath)
}

function executeCheckCommand(event: any, pythonPath: string) {
  executeCommand(event, pythonPath, true, (pythonPath, escapedPath) =>
    executeInRestartedTerminal(
      'crosshair check',
      `${pythonPath} -m crosshair check ${escapedPath}`
    )
  )
}

function executeCheckAtCommand(event: any, pythonPath: string) {
  executeCommandWithLine(
    event,
    pythonPath,
    true,
    (pythonPath, escapedPath, line) =>
      executeInRestartedTerminal(
        'crosshair check at',
        `${pythonPath} -m crosshair check ${escapedPath}:${line}`
      )
  )
}

function executeWatchCommand(event: any, pythonPath: string) {
  executeCommand(event, pythonPath, true, (pythonPath, escapedPath) =>
    executeInRestartedTerminal(
      'crosshair watch',
      `${pythonPath} -m crosshair watch ${escapedPath}`
    )
  )
}

function executePickCommand(event: any, pythonPath: string) {
  const path: string | null = inferPath(event)
  if (!path) {
    vscode.window.showErrorMessage(
      'Unexpected execution of a pick command when no path could be inferred.'
    )
    return
  }

  const fileName = pathModule.basename(path)

  const line: number | null = inferLine()

  // We can not dynamically change editor context menu so we need to use QuickPick,
  // see https://stackoverflow.com/questions/42586589/build-dynamic-menu-in-vscode-extension
  const quickPick = vscode.window.createQuickPick()
  quickPick.canSelectMany = false
  const items: vscode.QuickPickItem[] = []

  items.push({
    label: 'check',
    description: `Crosshair check ${fileName}`,
  })
  if (line !== null) {
    items.push({
      label: 'check at',
      description: `Crosshair check ${fileName} at line ${line}`,
    })
  }

  items.push({
    label: 'watch',
    description: `Crosshair watch ${fileName}`,
  })
  quickPick.items = items

  quickPick.onDidAccept((e) => {
    switch (quickPick.selectedItems.length) {
      case 0:
        break
      case 1:
        {
          const label = quickPick.selectedItems[0].label

          switch (label) {
            case 'check':
              executeCheckCommand(event, pythonPath)
              break
            case 'check at':
              executeCheckAtCommand(event, pythonPath)
              break
            case 'watch':
              executeWatchCommand(event, pythonPath)
              break
            default:
              vscode.window.showErrorMessage(
                `Bug: unhandled action for crosshair quick pick: ${label}`
              )
              break
          }
        }
        break
      default:
        vscode.window.showErrorMessage(
          'Bug: unexpectedly select multiple actions for crosshair quick pick.'
        )
        break
    }
    quickPick.hide()
  })
  quickPick.show()
}

export function activate(context: vscode.ExtensionContext) {
  inferPythonPath().then((pythonPath) => {
    context.subscriptions.push(
      vscode.commands.registerCommand('crosshair-vscode.pick', (event) =>
        executePickCommand(event, pythonPath)
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand('crosshair-vscode.check', (event) =>
        executeCheckCommand(event, pythonPath)
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand('crosshair-vscode.check-at', (event) =>
        executeCheckAtCommand(event, pythonPath)
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand('crosshair-vscode.watch', (event) =>
        executeWatchCommand(event, pythonPath)
      )
    )
  })

  const updateNowItem = { title: 'Upgrade now' }
  vscode.window
    .showWarningMessage(
      'The extension was migrated to a new publisher. Please upgrade now.',
      updateNowItem
    )
    .then(async (value) => {
      if (value === updateNowItem) {
        await vscode.commands.executeCommand(
          'workbench.extensions.uninstallExtension',
          'mristin.crosshair-vscode'
        )
        await vscode.commands.executeCommand(
          'workbench.extensions.installExtension',
          'crosshair.crosshair',
          { installPreReleaseVersion: true }
        )
        await vscode.commands.executeCommand('workbench.action.reloadWindow')
      }
    })
}

export function deactivate() {
  // Intentionally left empty.
  // See: https://code.visualstudio.com/api/references/vscode-api#ExtensionContext
  //   subscriptions: {dispose}[]
  //
  //   An array to which disposables can be added. When this extension is deactivated
  //   the disposables will be disposed.
}
